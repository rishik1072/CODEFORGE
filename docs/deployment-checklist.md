# CodeForge Production Deployment Checklist

Before exposing CodeForge to live public traffic, verify and check each requirement below:

- [ ] **1. HTTPS / TLS Termination**: Reverse proxy configured with valid Let's Encrypt or trusted SSL certificates.
- [ ] **2. Environment Secrets**: `.env.production` contains secure, unique passwords for `DATABASE_URL`.
- [ ] **3. Database Permissions**: Non-superuser `codeforge_app` PostgreSQL role provisioned with least privilege.
- [ ] **4. Private Networking**: PostgreSQL port `5432` and Docker daemon socket are not exposed to the public internet.
- [ ] **5. Schema Migrations**: All schema migrations applied via `drizzle-kit` before booting web server.
- [ ] **6. Build Workers**: At least one dedicated worker running with `CODEFORGE_WORKER_CONCURRENCY` matched to host CPU/RAM.
- [ ] **7. Sandbox Limits**: CPU, memory (1.5GB), processes (64), and network isolation (`--network none`) verified.
- [ ] **8. Security Headers**: Strict-Transport-Security, Content-Security-Policy, and X-Content-Type-Options active.
- [ ] **9. Rate Limiting**: Request limits active on public API endpoints (`/api/v1/builds`).
- [ ] **10. Artifact Retention**: Cleanup TTL (`CODEFORGE_ARTIFACT_TTL_MS`) set and verified.
- [ ] **11. Readiness Checks**: `/api/health/ready` returns `200 OK` with database connectivity.
- [ ] **12. Database Backups**: Automated `pg_dump` cron configured and tested with a restore dry-run.
