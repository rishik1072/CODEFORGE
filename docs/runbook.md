# CodeForge Operational Runbook & Incident Response

## 1. Routine Operational Commands

### Starting & Stopping Services

```bash
# Production server
npm run build
npm run start

# Standalone worker
npm run worker

# Run database migrations
npx drizzle-kit push
```

### Checking System Health & Readiness

```bash
# Public liveness check
curl http://localhost:3000/api/v1/health

# Internal readiness & database metrics
curl http://localhost:3000/api/health/ready
```

---

## 2. Incident Scenarios & Remediation

### Scenario A: Build Queue Stuck / Backlogged

**Symptoms**: `queue_depth` growing, builds remaining in `queued` status for >1 minute.
**Root Cause**:
1. No active workers running.
2. Database connection pool exhausted.
**Remediation**:
1. Check worker logs: `docker logs codeforge_worker_1`.
2. Ensure worker process is running: `npm run worker`.
3. Check PostgreSQL connection count:
   ```sql
   SELECT count(*) FROM pg_stat_activity WHERE datname = 'codeforge';
   ```

---

### Scenario B: Disk Space Exhaustion

**Symptoms**: Uploads failing with `payload_too_large` or worker failing with `ENOSPC`.
**Root Cause**:
Accumulation of temporary workspaces or expired artifacts.
**Remediation**:
1. Run automated cleanup sweep:
   ```bash
   node -e "require('./dist/lib/codeforge/workspace').sweepExpiredWorkspaces()"
   ```
2. Clean stale Docker build cache:
   ```bash
   docker system prune -f --filter "label=com.codeforge.managed=true"
   ```

---

### Scenario C: Database Failure or Unavailability

**Symptoms**: `/api/health/ready` returns `503 Service Unavailable`, `readiness.database: "unavailable"`.
**Remediation**:
1. Restart PostgreSQL container / service: `docker compose restart db`.
2. Verify credentials in `.env.production`.
3. Check PostgreSQL disk space and read-only flags.

---

## 3. Database Backup & Restore

### Logical Backup (pg_dump)

```bash
# Create encrypted backup
pg_dump -U codeforge_app -h localhost -F c -b -v -f codeforge_backup_$(date +%Y%m%d_%H%M%S).dump codeforge
```

### Database Restore

```bash
# Restore into fresh database
pg_restore -U codeforge_app -h localhost -d codeforge -v codeforge_backup.dump
```
