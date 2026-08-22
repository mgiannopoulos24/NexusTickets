package service

import (
	"os"

	"github.com/redis/go-redis/v9"
)

// newTestRedis builds a client for the Redis these tests need.
//
// Address and password come from the environment so the suite runs against a
// bare local server (the default) or the password-protected one from
// docker-compose, without editing the tests.
func newTestRedis() *redis.Client {
	addr := os.Getenv("TEST_REDIS_ADDR")
	if addr == "" {
		addr = os.Getenv("REDIS_ADDR")
	}
	if addr == "" {
		host := os.Getenv("REDIS_HOST")
		if host == "" {
			host = "localhost"
		}
		port := os.Getenv("REDIS_PORT")
		if port == "" {
			port = "6379"
		}
		addr = host + ":" + port
	}

	return redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: os.Getenv("REDIS_PASSWORD"),
	})
}
