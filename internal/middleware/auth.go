package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/hritesh04/epub-web-tool/internal/utils"
)

func Auth() gin.HandlerFunc {
    return func(c *gin.Context) {
        authorizationToken,err := c.Cookie("epub-tool-access-token")
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success":false,"error": "Authorization header required"})
            return
        }

        token, err := utils.ValidateAccessToken(authorizationToken)
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"success":false,"error": "Invalid or expired token"})
            return
        }

        c.Set("userID", token.UserID)
        c.Next()
    }
}
