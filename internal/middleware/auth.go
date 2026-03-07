package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hritesh04/epub-web-tool/internal/utils"
)

func Auth() gin.HandlerFunc {
    return func(c *gin.Context) {
        authorizationToken,err := c.Cookie("epub-tool-access-token")
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
            return
        }

        token, err := utils.ValidateAccessToken(authorizationToken)
        if err != nil || token.ExpiresAt.Compare(time.Now()) == -1 {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
            return
        }

        c.Set("userID", token.UserID)
        c.Next()
    }
}
