import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Registered user accounts
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// User sessions (stored securely in DB with HttpOnly session cookies)
export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// API keys for programmatic / CLI access
export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyPrefix: text("key_prefix").notNull(), // e.g. cf_live_ab12
  keyHash: text("key_hash").notNull(), // SHA-256 hash of raw key
  scopes: jsonb("scopes").notNull().default(["build:read", "build:create", "build:cancel", "project:read", "project:write"]),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// User projects
export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  defaultLanguage: text("default_language").notNull().default("cpp"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// A single compilation job submitted by a user.
export const builds = pgTable("builds", {
  id: text("id").primaryKey(),

  // Ownership (nullable for legacy/anonymous builds)
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),

  // Idempotency tracking
  idempotencyKey: text("idempotency_key"),

  // Language: cpp, c, or rust
  language: text("language").notNull().default("cpp"),

  // Client-provided metadata (validated, never trusted for file paths).
  originalFilename: text("original_filename").notNull(),
  projectType: text("project_type").notNull().default("single"),
  sourceFileCount: integer("source_file_count").notNull().default(1),
  headerFileCount: integer("header_file_count").notNull().default(0),
  cppStandard: text("cpp_standard").notNull(), // Column stores the validated standard string
  sourceSizeBytes: integer("source_size_bytes").notNull(),

  // Serverless / Distributed payload storage (Base64-encoded source payload)
  sourcePayloadBase64: text("source_payload_base64"),

  // Lifecycle state. See src/lib/codeforge/types.ts for the full union.
  status: text("status").notNull().default("queued"),

  // Ordered list of {stage, message, at} entries describing pipeline progress
  stages: jsonb("stages").notNull().default([]),

  // Captured + size-capped + sanitized compiler output
  stdout: text("stdout"),
  stderr: text("stderr"),

  // Human-readable, sanitized summary of what happened
  errorMessage: text("error_message"),

  // Which isolation backend actually executed the build
  compilerBackend: text("compiler_backend"),

  // Artifact bookkeeping (Supports local path on worker or Base64 payload / remote storage URL)
  artifactPath: text("artifact_path"),
  artifactPayloadBase64: text("artifact_payload_base64"),
  artifactFilename: text("artifact_filename"),
  artifactSizeBytes: integer("artifact_size_bytes"),
  artifactSha256: text("artifact_sha256"),
  artifactExpiresAt: timestamp("artifact_expires_at", { withTimezone: true }),

  durationMs: integer("duration_ms"),

  clientIp: text("client_ip"),

  workerId: text("worker_id"),
  attemptCount: integer("attempt_count").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  queuedAt: timestamp("queued_at", { withTimezone: true }).notNull().defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type SessionRow = typeof sessions.$inferSelect;
export type ApiKeyRow = typeof apiKeys.$inferSelect;
export type NewApiKeyRow = typeof apiKeys.$inferInsert;
export type ProjectRow = typeof projects.$inferSelect;
export type NewProjectRow = typeof projects.$inferInsert;
export type BuildRow = typeof builds.$inferSelect;
export type NewBuildRow = typeof builds.$inferInsert;
