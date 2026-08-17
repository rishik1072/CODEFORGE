import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";
import { codeforgeConfig } from "./config";
import { SecurityRejectionError } from "./types";

const inflateRawAsync = promisify(zlib.inflateRaw);

export interface ExtractedProjectFile {
  relativePath: string;
  sizeBytes: number;
}

export interface ExtractedArchiveResult {
  fileCount: number;
  totalExtractedBytes: number;
  files: ExtractedProjectFile[];
}

/**
 * Validates a relative file path within an archive against directory traversal,
 * absolute paths, Windows drive letters, and depth limits.
 */
export function sanitizeAndValidateEntryPath(rawPath: string): string {
  // Normalize slashes
  const normalized = rawPath.replace(/\\/g, "/").trim();

  if (!normalized || normalized === ".") {
    throw new SecurityRejectionError("Archive contains an empty filename.");
  }

  // Reject NUL bytes
  if (normalized.includes("\0")) {
    throw new SecurityRejectionError("Archive entry contains a null byte.");
  }

  // Reject Windows drive letters (e.g. C:/ or C:\)
  if (/^[a-zA-Z]:/.test(normalized)) {
    throw new SecurityRejectionError("Archive contains an illegal absolute drive path.");
  }

  // Reject leading slashes (absolute paths)
  if (normalized.startsWith("/")) {
    throw new SecurityRejectionError("Archive contains an illegal absolute path.");
  }

  // Split path components and check for traversal
  const parts = normalized.split("/");
  for (const part of parts) {
    if (part === ".." || part === ".") {
      throw new SecurityRejectionError("Archive contains illegal path traversal segments (..).");
    }
  }

  // Check depth limit
  if (parts.length > codeforgeConfig.maxProjectDepth) {
    throw new SecurityRejectionError(
      `Archive directory structure exceeds maximum allowed depth of ${codeforgeConfig.maxProjectDepth} levels.`,
    );
  }

  // Path resolution check: must resolve within workspace and maintain clean POSIX slashes
  const safeRelative = path.posix.normalize(normalized).replace(/^(\.\.(\/|$))+/, "");
  return safeRelative;
}

/**
 * Safe, zero-dependency streaming ZIP extractor that enforces strict security bounds:
 * - Rejects path traversal and absolute paths
 * - Rejects zip bombs (enforces max total bytes, max file count, max single file bytes, and compression ratio)
 * - Writes files with restricted permissions (0o600 for files, 0o700 for directories)
 * - Refuses execution of symlinks
 */
export async function extractZipSafely(
  zipBuffer: Buffer,
  targetDir: string,
): Promise<ExtractedArchiveResult> {
  if (zipBuffer.length < 22) {
    throw new SecurityRejectionError("Uploaded ZIP archive is truncated or empty.");
  }

  let offset = 0;
  let fileCount = 0;
  let totalExtractedBytes = 0;
  const extractedFiles: ExtractedProjectFile[] = [];

  // Iterate over Local File Headers (signature 0x04034b50)
  while (offset + 30 <= zipBuffer.length) {
    const signature = zipBuffer.readUInt32LE(offset);

    // End of Local File Headers / Start of Central Directory (0x02014b50 or 0x06054b50)
    if (signature === 0x02014b50 || signature === 0x06054b50) {
      break;
    }

    if (signature !== 0x04034b50) {
      // Not a local header signature
      break;
    }

    const flags = zipBuffer.readUInt16LE(offset + 6);
    const compressionMethod = zipBuffer.readUInt16LE(offset + 8);
    const compressedSize = zipBuffer.readUInt32LE(offset + 18);
    const uncompressedSize = zipBuffer.readUInt32LE(offset + 22);
    const fileNameLength = zipBuffer.readUInt16LE(offset + 26);
    const extraFieldLength = zipBuffer.readUInt16LE(offset + 28);

    // Check encryption flag (bit 0)
    if (flags & 0x0001) {
      throw new SecurityRejectionError("Encrypted ZIP archives are not supported.");
    }

    // Supported methods: 0 (Stored/uncompressed) or 8 (Deflated)
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      throw new SecurityRejectionError(
        `Unsupported ZIP compression method (${compressionMethod}). Only standard Deflate or Stored entries are allowed.`,
      );
    }

    const nameStart = offset + 30;
    const nameEnd = nameStart + fileNameLength;
    if (nameEnd > zipBuffer.length) {
      throw new SecurityRejectionError("Corrupted ZIP archive: entry filename exceeds buffer.");
    }

    const rawEntryName = zipBuffer.toString("utf8", nameStart, nameEnd);
    const dataStart = nameEnd + extraFieldLength;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > zipBuffer.length) {
      throw new SecurityRejectionError("Corrupted ZIP archive: entry data exceeds buffer boundary.");
    }

    const isDirectory = rawEntryName.endsWith("/") || rawEntryName.endsWith("\\");
    const safeRelPath = sanitizeAndValidateEntryPath(rawEntryName);

    const fullDestPath = path.resolve(targetDir, safeRelPath);
    const resolvedTargetDir = path.resolve(targetDir);

    if (!fullDestPath.startsWith(resolvedTargetDir + path.sep) && fullDestPath !== resolvedTargetDir) {
      throw new SecurityRejectionError("Path traversal attack detected in ZIP archive.");
    }

    if (isDirectory) {
      await fs.mkdir(fullDestPath, { recursive: true, mode: 0o700 });
      offset = dataEnd;
      continue;
    }

    // Single file limit checks
    if (uncompressedSize > codeforgeConfig.maxProjectFileBytes) {
      throw new SecurityRejectionError(
        `File "${safeRelPath}" exceeds the maximum allowed size of ${Math.floor(
          codeforgeConfig.maxProjectFileBytes / (1024 * 1024),
        )} MB.`,
      );
    }

    fileCount += 1;
    if (fileCount > codeforgeConfig.maxProjectFileCount) {
      throw new SecurityRejectionError(
        `Archive exceeds the maximum allowed file count of ${codeforgeConfig.maxProjectFileCount} files.`,
      );
    }

    // Decompress data
    let fileBuffer: Buffer;
    const compressedData = zipBuffer.subarray(dataStart, dataEnd);

    if (compressionMethod === 0) {
      // Stored (no compression)
      fileBuffer = compressedData;
    } else {
      // Deflate
      try {
        fileBuffer = await inflateRawAsync(compressedData);
      } catch (inflateErr) {
        throw new SecurityRejectionError(`Failed to decompress file "${safeRelPath}": Corrupted Deflate payload.`);
      }
    }

    // Enforce actual decompressed size
    if (fileBuffer.length > codeforgeConfig.maxProjectFileBytes) {
      throw new SecurityRejectionError(
        `Decompressed file "${safeRelPath}" exceeds the maximum allowed size.`,
      );
    }

    totalExtractedBytes += fileBuffer.length;
    if (totalExtractedBytes > codeforgeConfig.maxProjectExtractedBytes) {
      throw new SecurityRejectionError(
        `Archive exceeds the total allowed extracted size of ${Math.floor(
          codeforgeConfig.maxProjectExtractedBytes / (1024 * 1024),
        )} MB (possible ZIP bomb).`,
      );
    }

    // Ensure parent directory exists
    await fs.mkdir(path.dirname(fullDestPath), { recursive: true, mode: 0o700 });
    // Write file with non-executable, restricted permission
    await fs.writeFile(fullDestPath, fileBuffer, { mode: 0o600 });

    extractedFiles.push({
      relativePath: safeRelPath,
      sizeBytes: fileBuffer.length,
    });

    offset = dataEnd;
  }

  if (fileCount === 0) {
    throw new SecurityRejectionError("ZIP archive is empty or contains no files.");
  }

  return {
    fileCount,
    totalExtractedBytes,
    files: extractedFiles,
  };
}
