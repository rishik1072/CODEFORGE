# Self-hosting Dockerfile for the CodeForge Next.js application.
#
# NOT used by the managed sandbox this project was developed in (that
# platform builds/runs the app directly with Node.js). This is provided
# for anyone who wants to `docker compose up` CodeForge on their own
# machine or server - see docker-compose.yml.
#
# Bakes in the MinGW-w64 cross-compiler so the namespace sandbox backend
# works out of the box. If a Docker daemon is also reachable from inside
# this container (i.e. you mount /var/run/docker.sock), the app will
# automatically prefer the stronger Docker backend instead - see
# docs/security.md.
FROM node:22-bookworm-slim AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        mingw-w64 \
        util-linux \
        coreutils \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

ENV NODE_ENV=production
RUN npx next build

EXPOSE 3000
CMD ["npm", "run", "start"]
