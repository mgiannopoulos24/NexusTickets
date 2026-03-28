package middleware

import (
	"context"
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	redisv9 "github.com/redis/go-redis/v9"
)

var slidingWindowScript = redisv9.NewScript(`
local key = KEYS[1]
local now_ms = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call("ZREMRANGEBYSCORE", key, 0, now_ms - window_ms)
redis.call("ZADD", key, now_ms, member)
local count = redis.call("ZCARD", key)
redis.call("PEXPIRE", key, window_ms)

if count > limit then
	return 0
end
return 1
`)

// keySegment separates limit buckets (e.g. "global" vs "auth"); same IP uses different keys per segment.
func RateLimiter(redisClient *redisv9.Client, keySegment string, maxRequests int, window time.Duration) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ip := c.IP()
		key := fmt.Sprintf("rate_limit:%s:%s", keySegment, ip)
		nowMs := time.Now().UnixMilli()

		allowed, err := slidingWindowScript.Run(
			context.Background(),
			redisClient,
			[]string{key},
			nowMs,
			window.Milliseconds(),
			maxRequests,
			fmt.Sprintf("%d-%s", nowMs, c.Get(fiber.HeaderXRequestID)),
		).Int()
		if err != nil {
			return fiber.NewError(fiber.StatusServiceUnavailable, "rate limiter unavailable")
		}

		if allowed == 0 {
			c.Set("Retry-After", fmt.Sprintf("%d", int(window.Seconds())))
			return fiber.NewError(fiber.StatusTooManyRequests, "too many requests")
		}
		return c.Next()
	}
}
