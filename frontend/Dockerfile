### Build stage
FROM oven/bun:1.2.22-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install

COPY . .
RUN bun run build

### Runtime stage (nginx)
FROM nginx:1.27-alpine

COPY --from=builder /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 5173

HEALTHCHECK --interval=10s --timeout=3s --retries=12 CMD wget -qO- http://127.0.0.1:5173/ >/dev/null 2>&1 || exit 1
