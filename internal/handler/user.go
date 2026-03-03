package handler

import (
	"errors"
	"log"
	"net/http"
	"time"

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
		log.Println("Error unmarshalling request body:",err)
		c.JSON(http.StatusBadRequest,gin.H{"success":false,"message":"Invalid request payload"})
		return
	}
	
	user, err := u.user.GetByEmail(c.Request.Context(),data.Email)
	if err != nil {
		if errors.Is(err,pgx.ErrNoRows){
			log.Println("User not found:",data.Email)
			c.JSON(http.StatusUnauthorized,gin.H{"success":false,"message":"Invalid email or password"})
			return
		}
		log.Println("Error checking if user with email:",data.Email,"exists:",err)
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	if user.ID == "" {
		log.Println("User with email:",data.Email,"doesnt exists")
		c.JSON(http.StatusUnauthorized,gin.H{"success":true,"message":"Invalid email or password"})
		return
	}

	if match := utils.CheckHash(data.Password,user.Password); !match {
		log.Println("Incorrect password for user:",data.Email)
		c.JSON(http.StatusOK,gin.H{"success":true,"message":"Invalid email or password"})
		return
	}

	accessToken,err := utils.NewAccessToken(user.ID)
	if err != nil {
		log.Println("Error creating access token:",err)
		c.JSON(http.StatusOK,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	refreshToken,err := utils.NewRefreshToken(user.ID)
	if err != nil {
		log.Println("Error creating refresh token:",err)
		c.JSON(http.StatusOK,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}

	if err := u.user.UpdateRefreshToken(c.Request.Context(),user.ID,refreshToken); err != nil {
		log.Println("Error updating refresh token:",err)
	}
	c.SetCookie("epub-tool-access-token",accessToken,15*60,"/","",false,true)
	c.SetCookie("epub-tool-refresh-token",refreshToken,15*60,"/","",false,true)

	c.JSON(http.StatusOK,gin.H{"success":true,"data":user})
}

func (u *UserHandler) SignUp(c *gin.Context){
	data := new(dto.LoginRequest)
	if err := c.ShouldBind(data); err != nil {
		log.Println("Error unmarshalling request body:",err)
		c.JSON(http.StatusBadRequest,gin.H{"success":false,"message":"Invalid request payload"})
		return
	}
	existingUser, err := u.user.GetByEmail(c.Request.Context(),data.Email)
	if err != nil {
		log.Println("Error checking if user with email:",data.Email,"exists:",err)
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	if existingUser.ID != ""{
		log.Println("User with email:",data.Email,"already exists")
		c.JSON(http.StatusConflict,gin.H{"success":true,"message":"User already exists"})
		return
	}
	password,err := utils.Hash(data.Password)
	if err != nil {
		log.Println("Error hashing user password:",err)
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	userData := new(model.User)
	userData.Email=data.Email
	userData.Password=password
	user,err := u.user.Create(c.Request.Context(),userData)
	if err != nil {
		log.Println("Error creaing new user",err)
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	accessToken,err := utils.NewAccessToken(user.ID)
	if err != nil {
		log.Println("Error creating access token:",err)
		c.JSON(http.StatusOK,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	refreshToken,err := utils.NewRefreshToken(user.ID)
	if err != nil {
		log.Println("Error creating refresh token:",err)
		c.JSON(http.StatusOK,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	if err := u.user.UpdateRefreshToken(c.Request.Context(),user.ID,refreshToken); err != nil {
		log.Println("Error updating refresh token:",err)
	}
	c.SetCookie("epub-tool-access-token",accessToken,15*60,"/","",false,true)
	c.SetCookie("epub-tool-refresh-token",refreshToken,15*60,"/","",false,true)

	c.JSON(http.StatusCreated,gin.H{"success":true,"data":user})
}

func (u *UserHandler) Refresh(c *gin.Context){
	refreshToken, err := c.Cookie("epub-tool-refresh-token")
	if err != nil {
		log.Println("Refresh token not found:",err)
		c.JSON(http.StatusPermanentRedirect,gin.H{"success":false,"url":"/signin"})
		return
	}
	
	token,err := utils.ValidateRefreshToken(refreshToken)
	if err != nil {
		log.Println("Error validating refresh token:",err)
		c.JSON(http.StatusPermanentRedirect,gin.H{"success":false,"url":"/signin"})
		return
	}

	if err := u.user.CheckRefreshToken(c.Request.Context(),token.UserID,refreshToken);err != nil {
		if err == pgx.ErrNoRows {
			log.Println("user refresh token not matched:",token.UserID)
			c.JSON(http.StatusUnauthorized,gin.H{"success":false,"url":"/signin"})
			return
		}
		log.Println("Error checking user refresh token from db:",err)
		c.JSON(http.StatusInternalServerError,gin.H{"success":false,"url":"/signin"})
		return
	}
	
	if token.ExpiresAt.Compare(time.Now()) == -1 {
		log.Println("Refresh token expired !")
		c.JSON(http.StatusPermanentRedirect,gin.H{"success":false,"url":"/signin"})
		return
	}
	accessToken,err := utils.NewAccessToken(token.UserID)
	if err != nil {
		log.Println("Error creating access token:",err)
		c.JSON(http.StatusOK,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	newRefreshToken, err := utils.NewRefreshToken(token.UserID)
	if err != nil {
		log.Println("Error creating refresh token:",err)
		c.JSON(http.StatusOK,gin.H{"success":false,"message":"Internal Server Error"})
		return
	}
	if err := u.user.UpdateRefreshToken(c.Request.Context(),token.UserID,newRefreshToken);err != nil {
		log.Println("Error updating refresh token:",err)
	}
	c.SetCookie("epub-tool-access-token",accessToken,15*60,"/","",false,true)
	c.SetCookie("epub-tool-refresh-token",newRefreshToken,15*60,"/","",false,true)
	c.JSON(http.StatusCreated,gin.H{"success":true})
}