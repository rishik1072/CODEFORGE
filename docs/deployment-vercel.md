# CodeForge Production Deployment: Vercel + External Docker Worker

## 1. System Topology Overview

In production, CodeForge separates the **Web / API layer** (hosted on Vercel) from the **Compiler Sandbox Worker** (hosted on a dedicated Docker-capable Linux server).

```
                         INTERNET
                            │
                            ▼
                         VERCEL
                    Next.js 16 App
              (UI, Auth, REST API, Queue Enqueue)
                            │
                            │ (Managed PostgreSQL SSL Connection)
                            ▼
                       POSTGRESQL
                      (Build Queue)
                            ▲
                            │ (Atomic Claim: SELECT FOR UPDATE SKIP LOCKED)
                            │
                    EXTERNAL WORKER
               (Dedicated Docker Host)
                            │
                      Docker Engine
                            │
                ┌───────────┼───────────┐
                ▼           ▼           ▼
             C GCC       C++ G++       Rust
           (Air-gapped: --network none, non-root)
                            │
                            ▼
                  Windows .exe Artifact
```

---

## 2. Component Separation & Responsibilities

| Component | Host Platform | Responsibilities |
|---|---|---|
| **Web & API** | **Vercel** (Serverless) | Next.js frontend, user authentication, session cookies, project management, API keys, build enqueuing (`HTTP 202`), polling status (`GET /api/v1/builds/:id`), and artifact downloads. |
| **Database** | **Managed Postgres** (e.g. Neon, Supabase, RDS) | Persistent storage for users, sessions, projects, API keys, and transactional build queue. |
| **Compiler Worker** | **External Host** (Ubuntu Linux / Docker Engine) | Background polling process (`npm run worker`), atomic job claiming (`FOR UPDATE SKIP LOCKED`), Docker sandbox execution, artifact generation, and workspace cleanup. |

---

## 3. Step-by-Step Vercel Deployment

### Step 1: Set Up Managed PostgreSQL Database
1. Create a managed PostgreSQL database (e.g. on Neon, Supabase, or AWS RDS).
2. Obtain the connection string with SSL:
   ```
   postgresql://username:password@db-host.com:5432/codeforge?sslmode=require
   ```
3. Initialize the schema from your local terminal:
   ```bash
   DATABASE_URL="your-database-url" npx drizzle-kit push
   ```

### Step 2: Deploy to Vercel
1. Push your repository to GitHub.
2. Go to [Vercel Dashboard](https://vercel.com) -> **Add New Project** -> Import your CodeForge repository.
3. Select **Next.js** framework preset.
4. Add the following **Environment Variables** in Vercel:
   - `DATABASE_URL`: Your managed PostgreSQL connection URL.
   - `NODE_ENV`: `production`
5. Click **Deploy**.

---

## 4. Setting Up the External Build Worker

The compilation worker must run on a server with Docker Engine installed (e.g. a $6/mo VPS on DigitalOcean, Hetzner, AWS EC2, or a dedicated home server).

### Step 1: Install Prerequisites on the Worker Host
```bash
# On Ubuntu 22.04 / 24.04:
sudo apt-get update
sudo apt-get install -y docker.io nodejs npm git

# Add your user to the docker group
sudo usermod -aG docker $USER
```

### Step 2: Clone and Build Compiler Images on Worker Host
```bash
git clone https://github.com/your-username/codeforge.git
cd codeforge

# Build compiler Docker images locally on the worker host:
docker build -t codeforge-cpp-windows:latest ./compiler/cpp-windows
docker build -t codeforge-c-windows:latest ./compiler/c-windows
docker build -t codeforge-rust-windows:latest ./compiler/rust-windows
```

### Step 3: Configure Environment & Run Worker
```bash
# Copy worker environment template
cp .env.worker.example .env.local

# Edit .env.local and insert your managed DATABASE_URL
nano .env.local

# Install dependencies and start the standalone worker
npm install
npm run worker
```

To run the worker continuously in the background, use `systemd` or `pm2`:
```bash
# Using PM2:
npm install -g pm2
pm2 start "npm run worker" --name codeforge-worker
pm2 save
pm2 startup
```

---

## 5. Security & Worker Isolation Guarantees

1. **Air-Gapped Compilers**: Compiler containers run with `--network none` — no outbound network access is granted to untrusted code.
2. **Read-Only Root Filesystem**: Compilers cannot tamper with the container root filesystem.
3. **Non-Root Execution**: Runs under unprivileged UID `1000:1000`.
4. **No Docker Daemon Exposure**: The Docker socket (`/var/run/docker.sock`) is accessed strictly locally by the background Node process on the worker machine and is never exposed over the network.
5. **No Secrets in Sandbox**: Database credentials, API keys, and session secrets are never passed into compiler containers.

---

## 6. Verifying the Deployment

1. Open your Vercel URL (`https://your-project.vercel.app`).
2. Register a new user account.
3. Upload `hello.cpp` or a multi-file `.zip` archive.
4. Click **Build Windows Executable**.
5. Observe the status transition: `QUEUED` -> `COMPILING` -> `SUCCESS`.
6. Download and run the compiled `.exe`.
