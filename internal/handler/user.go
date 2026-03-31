package handler

import (
	"errors"
	"net/http"
	"os"
	"regexp"

	"github.com/rs/zerolog/log"

	"github.com/gin-gonic/gin"
	"github.com/hritesh04/epub-web-tool/internal/dto"
	"github.com/hritesh04/epub-web-tool/internal/model"
	"github.com/hritesh04/epub-web-tool/internal/repository"
	"github.com/hritesh04/epub-web-tool/internal/utils"
	"github.com/jackc/pgx/v5"
)

type UserHandler struct {
	user *repository.UserRepository
}

func NewUserHandler(userRepo *repository.UserRepository) *UserHandler {
	return &UserHandler{
		user: userRepo,
	}
}

func (u *UserHandler) SignIn(c *gin.Context){
	data := new(dto.LoginRequest)
	
	if err := c.ShouldBind(data); err != nil {
		log.Warn().Err(err).Msg("Error unmarshalling request body")
		c.JSON(http.StatusBadRequest,gin.H{"success":false,"message":"Invalid request payload"})
		return
	}
	
	user, err := u.user.GetByEmail(c.Request.Context(),data.Email)
	if err != nil {
		if errors.Is(err,pgx.ErrNoRows){
			log.Warn().Str("email", data.Email).Msg("User not found")
			c.JSON(http.StatusUnauthorized,gin.H{"success":false,"message":"Invalid email or password"})
			return
		}
		log.Error().Err(err).Msg("Error checking if user exists")
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	if user.ID == "" {
		log.Warn().Str("email", data.Email).Msg("User does not exist")
		c.JSON(http.StatusUnauthorized,gin.H{"success":true,"message":"Invalid email or password"})
		return
	}

	if match := utils.CheckHash(data.Password,user.Password); !match {
		log.Warn().Str("email", data.Email).Msg("Incorrect password")
		c.JSON(http.StatusOK,gin.H{"success":true,"message":"Invalid email or password"})
		return
	}

	accessToken,err := utils.NewAccessToken(user.ID)
	if err != nil {
		log.Error().Err(err).Msg("Error creating access token")
		c.JSON(http.StatusOK,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	refreshToken,err := utils.NewRefreshToken(user.ID)
	if err != nil {
		log.Error().Err(err).Msg("Error creating refresh token")
		c.JSON(http.StatusOK,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	hashedRefreshToken,err := utils.Hash(refreshToken)
	if err != nil {
		log.Error().Err(err).Msg("Error hashing refresh token")
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	if err := u.user.UpdateRefreshToken(c.Request.Context(),user.ID,hashedRefreshToken); err != nil {
		log.Error().Err(err).Msg("Error updating refresh token")
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	setCookie(c,"epub-tool-access-token",accessToken,15*60)
	setCookie(c,"epub-tool-refresh-token",refreshToken,30*24*60*60)

	c.JSON(http.StatusOK,gin.H{"success":true,"data":user})
}

func (u *UserHandler) SignUp(c *gin.Context){
	data := new(dto.LoginRequest)
	if err := c.ShouldBind(data); err != nil {
		log.Warn().Err(err).Msg("Error unmarshalling request body")
		c.JSON(http.StatusBadRequest,gin.H{"success":false,"message":"Invalid request payload"})
		return
	}
	emailRegexPattern := regexp.MustCompile(`^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,4}$`)
	if valid := emailRegexPattern.MatchString(data.Email); !valid {
		log.Warn().Str("email", data.Email).Msg("Invalid email address")
		c.JSON(http.StatusBadRequest,gin.H{"success":false,"message":"Invalid email"})
		return
	}
	if len(data.Password) > 128 {
		log.Warn().Msg("Password length too long")
		c.JSON(http.StatusBadRequest,gin.H{"success":false,"message":"Password should be shorter than 128 characters"})
		return
	}
	existingUser, err := u.user.GetByEmail(c.Request.Context(),data.Email)
	if err != nil {
		log.Error().Err(err).Msg("Error checking if user exists")
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	if existingUser.ID != ""{
		log.Warn().Str("email", data.Email).Msg("User already exists")
		c.JSON(http.StatusConflict,gin.H{"success":true,"message":"User already exists"})
		return
	}
	password,err := utils.Hash(data.Password)
	if err != nil {
		log.Error().Err(err).Msg("Error hashing password")
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	userData := new(model.User)
	userData.Email=data.Email
	userData.Password=password
	user,err := u.user.Create(c.Request.Context(),userData)
	if err != nil {
		log.Error().Err(err).Msg("Error creating new user")
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	accessToken,err := utils.NewAccessToken(user.ID)
	if err != nil {
		log.Error().Err(err).Msg("Error creating access token")
		c.JSON(http.StatusOK,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	refreshToken,err := utils.NewRefreshToken(user.ID)
	if err != nil {
		log.Error().Err(err).Msg("Error creating refresh token")
		c.JSON(http.StatusOK,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	hashedRefreshToken,err := utils.Hash(refreshToken)
	if err != nil {
		log.Error().Err(err).Msg("Error hashing refresh token")
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	if err := u.user.UpdateRefreshToken(c.Request.Context(),user.ID,hashedRefreshToken); err != nil {
		log.Error().Err(err).Msg("Error updating refresh token")
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	setCookie(c,"epub-tool-access-token",accessToken,15*60)
	setCookie(c,"epub-tool-refresh-token",refreshToken,30*24*60*60)
	c.JSON(http.StatusCreated,gin.H{"success":true,"data":user})
}

func (u *UserHandler) Refresh(c *gin.Context){
	refreshToken, err := c.Cookie("epub-tool-refresh-token")
	if err != nil {
		log.Error().Msg("Refresh token not found")
		c.JSON(http.StatusUnauthorized,gin.H{"success":false,"message":"Refresh token not found"})
		return
	}
	
	token,err := utils.ValidateRefreshToken(refreshToken)
	if err != nil {
		log.Error().Err(err).Msg("Error validating refresh token")
		c.JSON(http.StatusUnauthorized,gin.H{"success":false,"message":"Invalid or expired refresh token"})
		return
	}

	hashedToken,err := u.user.CheckRefreshToken(c.Request.Context(),token.UserID)
	if err != nil {
		log.Warn().Err(err).Str("user_id", token.UserID).Msg("Refresh token check failed")
		c.JSON(http.StatusUnauthorized,gin.H{"success":false,"message":"Invalid refresh token"})
		return
	}
	
	if !utils.CheckHash(refreshToken,hashedToken) {
		log.Warn().Str("user_id", token.UserID).Msg("Refresh token check failed")
		c.JSON(http.StatusUnauthorized,gin.H{"success":false,"message":"Invalid refresh token"})
		return
	}

	accessToken,err := utils.NewAccessToken(token.UserID)
	if err != nil {
		log.Error().Err(err).Msg("Error creating access token")
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	newRefreshToken, err := utils.NewRefreshToken(token.UserID)
	if err != nil {
		log.Error().Err(err).Msg("Error creating refresh token")
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	if err := u.user.UpdateRefreshToken(c.Request.Context(),token.UserID,newRefreshToken);err != nil {
		log.Error().Err(err).Msg("Error updating refresh token")
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	setCookie(c,"epub-tool-access-token",accessToken,15*60)
	setCookie(c,"epub-tool-refresh-token",newRefreshToken,30*24*60*60)
	c.JSON(http.StatusOK,gin.H{"success":true})
}

func (u *UserHandler) Auth(c *gin.Context) {
	userID := c.Keys["userID"].(string)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "message": "Unauthorized"})
		return
	}

	user, err := u.user.GetByID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "Internal Server Error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "data": user})
}

func (u *UserHandler) SignOut(c *gin.Context) {
	setCookie(c,"epub-tool-access-token", "", -1)
	setCookie(c,"epub-tool-refresh-token", "", -1)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Signed out successfully"})
}

func setCookie(c *gin.Context,name,token string,maxAge int){
	secure :=  os.Getenv("ENVIRONMENT") == "production"
	c.SetCookie(name,token,maxAge,"/","",secure,true)
	c.SetSameSite(http.SameSiteStrictMode)
}