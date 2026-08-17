#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const CONFIG_PATH = path.join(os.homedir(), ".codeforge", "config.json");

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    }
  } catch {
    // Ignore
  }
  return {};
}

function saveConfig(config) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

const args = process.argv.slice(2);
const command = args[0];

const apiUrl = process.env.CODEFORGE_API_URL || loadConfig().apiUrl || "http://localhost:3000";
const apiKey = process.env.CODEFORGE_API_KEY || loadConfig().apiKey;

async function request(endpoint, options = {}) {
  const headers = new Headers(options.headers || {});
  if (apiKey) {
    headers.set("Authorization", `Bearer ${apiKey}`);
  }
  const res = await fetch(`${apiUrl}${endpoint}`, { ...options, headers });
  return res;
}

async function main() {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(`
CodeForge CLI - Secure Multi-Language Code Compilation

Usage:
  codeforge login <API_KEY>                Save your CodeForge API key
  codeforge projects                       List your projects
  codeforge build <file> [options]         Submit a single file or ZIP build
  codeforge status <build-id>              Check the status of a build
  codeforge download <build-id> [options]  Download the compiled .exe
  codeforge cancel <build-id>              Cancel a queued or compiling build

Options for 'build':
  --language <cpp|c|rust>                  Target language (default: cpp)
  --standard <std>                         Language standard / toolchain (default: c++20)
  --project <id>                           Associate with a project ID
  --wait                                   Poll and wait until build finishes

Options for 'download':
  --output <path>                          Local path to save .exe (default: output.exe)
`);
    process.exit(0);
  }

  if (command === "login") {
    const key = args[1];
    if (!key) {
      console.error("Error: Please provide your API key. Example: codeforge login cf_live_...");
      process.exit(1);
    }
    saveConfig({ ...loadConfig(), apiKey: key.trim(), apiUrl });
    console.log("✓ CodeForge API key saved securely to ~/.codeforge/config.json");
    process.exit(0);
  }

  if (!apiKey && command !== "help") {
    console.error("Error: Not logged in. Run 'codeforge login <API_KEY>' or set CODEFORGE_API_KEY env variable.");
    process.exit(1);
  }

  if (command === "projects") {
    const res = await request("/api/v1/projects");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`Error: ${err.error?.message || res.statusText}`);
      process.exit(1);
    }
    const data = await res.json();
    console.log("\nYour Projects:");
    for (const p of data.projects || []) {
      console.log(`- [${p.id}] ${p.name} (${p.defaultLanguage.toUpperCase()}) - ${p.buildCount} builds`);
    }
    process.exit(0);
  }

  if (command === "build") {
    const filePath = args[1];
    if (!filePath || !fs.existsSync(filePath)) {
      console.error("Error: Please specify a valid source file or .zip archive to build.");
      process.exit(1);
    }

    let language = "cpp";
    let standard = "c++20";
    let projectId = null;
    let wait = false;

    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--language" && args[i + 1]) language = args[++i];
      if (args[i] === "--standard" && args[i + 1]) standard = args[++i];
      if (args[i] === "--project" && args[i + 1]) projectId = args[++i];
      if (args[i] === "--wait") wait = true;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath);

    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append("file", blob, filename);
    formData.append("language", language);
    formData.append("standard", standard);
    if (projectId) formData.append("projectId", projectId);

    console.log(`Uploading ${filename} to CodeForge (${language.toUpperCase()} / ${standard})...`);
    const res = await request("/api/v1/builds", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`Build failed: ${err.error?.message || res.statusText}`);
      process.exit(1);
    }

    const build = await res.json();
    console.log(`✓ Build enqueued successfully!`);
    console.log(`  Build ID : ${build.buildId}`);
    console.log(`  Status   : ${build.status.toUpperCase()}`);

    if (wait) {
      console.log("\nWaiting for build to finish...");
      const terminal = ["success", "compile_error", "security_rejected", "timeout", "cancelled", "internal_error"];
      while (true) {
        await new Promise((r) => setTimeout(r, 1000));
        const check = await request(`/api/v1/builds/${build.buildId}`);
        if (!check.ok) continue;
        const current = await check.json();
        process.stdout.write(`\rStatus: ${current.status.toUpperCase()} `);
        if (terminal.includes(current.status)) {
          console.log(`\n\nFinal Status: ${current.status.toUpperCase()}`);
          if (current.status === "success") {
            console.log(`✓ Artifact ready: ${current.artifact?.filename} (${current.artifact?.sizeBytes} bytes)`);
            console.log(`  SHA-256: ${current.artifact?.sha256}`);
            console.log(`  Download with: codeforge download ${build.buildId}`);
          } else {
            console.error(`\nCompiler Diagnostics:\n${current.stderr || current.stdout || current.errorMessage}`);
          }
          break;
        }
      }
    }
    process.exit(0);
  }

  if (command === "status") {
    const id = args[1];
    if (!id) {
      console.error("Error: Please provide a build ID.");
      process.exit(1);
    }
    const res = await request(`/api/v1/builds/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`Error: ${err.error?.message || res.statusText}`);
      process.exit(1);
    }
    const b = await res.json();
    console.log(`
Build Status:
  ID        : ${b.buildId}
  Language  : ${b.language.toUpperCase()} (${b.cppStandard})
  Status    : ${b.status.toUpperCase()}
  Created   : ${b.createdAt}
  Duration  : ${b.durationMs ? `${b.durationMs}ms` : "N/A"}
  Artifact  : ${b.artifact ? `${b.artifact.filename} (${b.artifact.sizeBytes} bytes)` : "None"}
  SHA-256   : ${b.artifact?.sha256 || "None"}
`);
    process.exit(0);
  }

  if (command === "download") {
    const id = args[1];
    if (!id) {
      console.error("Error: Please provide a build ID.");
      process.exit(1);
    }
    let outputPath = "output.exe";
    for (let i = 2; i < args.length; i++) {
      if (args[i] === "--output" && args[i + 1]) outputPath = args[++i];
    }

    const res = await request(`/api/v1/builds/${id}/artifact`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`Download failed: ${err.error?.message || res.statusText}`);
      process.exit(1);
    }

    const arrayBuffer = await res.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
    console.log(`✓ Downloaded executable saved to: ${outputPath} (${arrayBuffer.byteLength} bytes)`);
    process.exit(0);
  }

  if (command === "cancel") {
    const id = args[1];
    if (!id) {
      console.error("Error: Please provide a build ID.");
      process.exit(1);
    }
    const res = await request(`/api/v1/builds/${id}/cancel`, { method: "POST" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error(`Cancel failed: ${err.error?.message || res.statusText}`);
      process.exit(1);
    }
    console.log(`✓ Build ${id} cancelled successfully.`);
    process.exit(0);
  }

  console.error(`Unknown command: ${command}. Run 'codeforge --help' for usage.`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Unexpected CLI error:", err);
  process.exit(1);
});
