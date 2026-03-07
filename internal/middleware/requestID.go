package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		rid := uuid.New().String()
		c.Set("requestID", rid)
		c.Writer.Header().Set("X-Request-Id", rid)
		c.Next()
	}
}
