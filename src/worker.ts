import "dotenv/config";
import { BuildWorker } from "./lib/codeforge/worker";

const concurrency = process.env.BUILD_WORKER_CONCURRENCY
  ? Number.parseInt(process.env.BUILD_WORKER_CONCURRENCY, 10)
  : undefined;

const worker = new BuildWorker({ concurrency });

console.log("[codeforge] Starting dedicated standalone build worker...");
worker.start();

const shutdown = async (signal: string) => {
  console.log(`[codeforge] Received ${signal}, stopping worker...`);
  await worker.stop();
  process.exit(0);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
