import zlib from "node:zlib";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { extractZipSafely, sanitizeAndValidateEntryPath } from "@/lib/codeforge/unzip";
import { SecurityRejectionError } from "@/lib/codeforge/types";

/**
 * Minimal in-memory ZIP builder for testing ZIP parsing and security boundaries.
 */
function createMockZip(entries: Array<{ name: string; content?: string | Buffer; isDir?: boolean }>): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const isDir = entry.isDir || entry.name.endsWith("/");
    const nameBuf = Buffer.from(entry.name, "utf8");
    const rawData = isDir ? Buffer.alloc(0) : (typeof entry.content === "string" ? Buffer.from(entry.content, "utf8") : (entry.content ?? Buffer.alloc(0)));
    const compressed = isDir || rawData.length === 0 ? Buffer.alloc(0) : zlib.deflateRawSync(rawData);
    const method = isDir || rawData.length === 0 ? 0 : 8;

    // Local file header (30 bytes + name + extra + data)
    const local = Buffer.alloc(30 + nameBuf.length + (method === 0 ? rawData.length : compressed.length));
    local.writeUInt32LE(0x04034b50, 0); // signature
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(method, 8); // compression
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(0, 14); // crc32
    local.writeUInt32LE(method === 0 ? rawData.length : compressed.length, 18); // compressed size
    local.writeUInt32LE(rawData.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    nameBuf.copy(local, 30);
    if (method === 0) {
      rawData.copy(local, 30 + nameBuf.length);
    } else {
      compressed.copy(local, 30 + nameBuf.length);
    }

    localHeaders.push(local);

    // Central directory header (46 bytes + name)
    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(method === 0 ? rawData.length : compressed.length, 20);
    central.writeUInt32LE(rawData.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42); // local header offset
    nameBuf.copy(central, 46);

    centralHeaders.push(central);
    offset += local.length;
  }

  const centralOffset = offset;
  const centralSize = centralHeaders.reduce((acc, b) => acc + b.length, 0);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

describe("sanitizeAndValidateEntryPath", () => {
  it("accepts valid relative filenames", () => {
    expect(sanitizeAndValidateEntryPath("main.cpp")).toBe("main.cpp");
    expect(sanitizeAndValidateEntryPath("src/utils/math.cpp")).toBe("src/utils/math.cpp");
  });

  it("rejects path traversal attempts with ..", () => {
    expect(() => sanitizeAndValidateEntryPath("../../evil.cpp")).toThrow(SecurityRejectionError);
    expect(() => sanitizeAndValidateEntryPath("src/../../../evil.cpp")).toThrow(SecurityRejectionError);
    expect(() => sanitizeAndValidateEntryPath("..\\..\\evil.cpp")).toThrow(SecurityRejectionError);
  });

  it("rejects absolute paths and Windows drive paths", () => {
    expect(() => sanitizeAndValidateEntryPath("/etc/passwd")).toThrow(SecurityRejectionError);
    expect(() => sanitizeAndValidateEntryPath("C:\\Windows\\System32\\evil.dll")).toThrow(SecurityRejectionError);
    expect(() => sanitizeAndValidateEntryPath("D:/project/evil.cpp")).toThrow(SecurityRejectionError);
  });

  it("rejects filenames with null bytes", () => {
    expect(() => sanitizeAndValidateEntryPath("main.cpp\0.exe")).toThrow(SecurityRejectionError);
  });
});

describe("extractZipSafely", () => {
  it("extracts a valid multi-file ZIP into workspace", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-zip-"));
    try {
      const mockZip = createMockZip([
        { name: "main.cpp", content: "#include <iostream>\nint main() { return 0; }\n" },
        { name: "Student.h", content: "struct Student { int id; };\n" },
        { name: "Student.cpp", content: '#include "Student.h"\n' },
      ]);

      const result = await extractZipSafely(mockZip, tmpDir);
      expect(result.fileCount).toBe(3);
      expect(result.totalExtractedBytes).toBeGreaterThan(0);

      const mainContent = await fs.readFile(path.join(tmpDir, "main.cpp"), "utf8");
      expect(mainContent).toContain("int main()");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("rejects empty ZIP archives", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-zip-"));
    try {
      const emptyZip = createMockZip([]);
      await expect(extractZipSafely(emptyZip, tmpDir)).rejects.toThrow(SecurityRejectionError);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("rejects ZIP archives attempting path traversal", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "cf-test-zip-"));
    try {
      const traversalZip = createMockZip([
        { name: "../../evil.cpp", content: "int main() {}" },
      ]);
      await expect(extractZipSafely(traversalZip, tmpDir)).rejects.toThrow(SecurityRejectionError);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});
