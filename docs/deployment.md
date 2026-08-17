# CodeForge Production Deployment & Architecture Guide

## 1. Production Architecture Topology

In a production environment, CodeForge runs with dedicated components to guarantee high availability, strict isolation, and resilience against hardware or traffic spikes.

```
                         INTERNET
                            │
                            ▼
                     Reverse Proxy (Nginx / Caddy / Cloudflare)
                            │ HTTPS / TLS Termination (Port 443)
                            │ Security Headers & SSL Offloading
                            ▼
              ┌───────────────────────────┐
              │   Next.js App Instance    │
              │  (API Server & Dashboard) │
              └─────────────┬─────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        ▼                                       ▼
PostgreSQL Database                     Build Queue (PostgreSQL)
(Users, Sessions, Projects)                     │
                                      ┌─────────┴─────────┐
                                      ▼                   ▼
                               Build Worker 1       Build Worker 2
                                      │                   │
                                      ▼                   ▼
                              Docker Sandbox      Docker Sandbox
                              (C / C++ / Rust)    (C / C++ / Rust)
```

---

## 2. Docker Compose Production Deployment

A production-ready `docker-compose.yml` template:

```yaml
version: "3.8"

services:
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB: codeforge
      POSTGRES_USER: codeforge_app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - internal-net

  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://codeforge_app:${DB_PASSWORD}@db:5432/codeforge?sslmode=disable
      CODEFORGE_DATA_DIR: /var/lib/codeforge
    ports:
      - "3000:3000"
    volumes:
      - codeforge-data:/var/lib/codeforge
    depends_on:
      - db
    networks:
      - internal-net

  worker:
    build:
      context: .
      dockerfile: Dockerfile
    command: ["npm", "run", "worker"]
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://codeforge_app:${DB_PASSWORD}@db:5432/codeforge?sslmode=disable
      CODEFORGE_DATA_DIR: /var/lib/codeforge
      CODEFORGE_WORKER_CONCURRENCY: 4
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - codeforge-data:/var/lib/codeforge
    depends_on:
      - db
    networks:
      - internal-net

volumes:
  pgdata:
  codeforge-data:

networks:
  internal-net:
    internal: true
```

---

## 3. Reverse Proxy Configuration (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name codeforge.example.com;

    ssl_certificate /etc/letsencrypt/live/codeforge.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/codeforge.example.com/privkey.pem;

    client_max_body_size 12M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

---

## 4. Graceful Shutdown & Container Lifecycle

- **Signals**: Worker processes trap `SIGTERM` and `SIGINT`.
- **Drain Policy**: When a signal is received, the worker terminates the queue polling loop, allows in-flight compilations to finish, safely removes temporary workspaces, and flushes database transactions before exiting.
