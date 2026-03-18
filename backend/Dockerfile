### Build stage
FROM golang:1.22-alpine AS builder

RUN apk add --no-cache ca-certificates

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ENV CGO_ENABLED=0
RUN go build -trimpath -ldflags="-s -w" -o /out/nexustickets-api ./cmd/server

# Copy a static busybox so we can run healthchecks in scratch.
RUN cp /bin/busybox /out/busybox
RUN cp /etc/ssl/certs/ca-certificates.crt /out/ca-certificates.crt

### Runtime stage (scratch)
FROM scratch

WORKDIR /

COPY --from=builder /out/nexustickets-api /nexustickets-api
COPY --from=builder /out/busybox /busybox
COPY --from=builder /out/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=builder /src/migrations /migrations

ENV APP_PORT=8080
EXPOSE 8080

USER 65532:65532

ENTRYPOINT ["/nexustickets-api"]
