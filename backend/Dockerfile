### Build stage
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache ca-certificates

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/nexustickets-api ./cmd/server

RUN cp /etc/ssl/certs/ca-certificates.crt /out/ca-certificates.crt

### Runtime stage (scratch)
FROM scratch

WORKDIR /

COPY --from=builder /out/nexustickets-api /nexustickets-api
COPY --from=builder /out/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt

ENV APP_PORT=8080
EXPOSE 8080

# scratch has no shell or wget, so the binary probes itself. It follows
# TLS_CERT_FILE / TLS_KEY_FILE to pick http or https, like the server does.
HEALTHCHECK --interval=10s --timeout=5s --retries=20 \
  CMD ["/nexustickets-api", "healthcheck"]

USER 65532:65532

ENTRYPOINT ["/nexustickets-api"]
