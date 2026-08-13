package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"pilihin-backend/internal/config"
	"pilihin-backend/internal/models"
	"pilihin-backend/internal/services"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type Handler struct {
	db           *gorm.DB
	cfg          *config.Config
	driveService *services.DriveService
}

func NewHandler(db *gorm.DB, cfg *config.Config, driveService *services.DriveService) *Handler {
	return &Handler{
		db:           db,
		cfg:          cfg,
		driveService: driveService,
	}
}

// GenerateRandomSlug creates a unique 8-char slug for galleries
func generateRandomSlug() string {
	b := make([]byte, 4)
	rand.Read(b)
	return hex.EncodeToString(b)
}

// DemoParseDrive parses a Google Drive link and returns photos for instant preview
func (h *Handler) DemoParseDrive(c *gin.Context) {
	var req models.DriveFolderParseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Drive URL is required"})
		return
	}

	folderID, err := h.driveService.ExtractFolderID(req.DriveURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Google Drive folder link format"})
		return
	}

	photos, err := h.driveService.FetchPhotosFromFolder(c.Request.Context(), folderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch photos from Google Drive"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"folder_id":   folderID,
		"total_photos": len(photos),
		"photos":      photos,
	})
}

// Register creates a new photographer user
func (h *Handler) Register(c *gin.Context) {
	var req struct {
		Email      string `json:"email" binding:"required"`
		Password   string `json:"password" binding:"required"`
		FullName   string `json:"full_name"`
		StudioName string `json:"studio_name"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := models.User{
		Email:        strings.ToLower(req.Email),
		PasswordHash: string(hashedPassword),
		FullName:     req.FullName,
		StudioName:   req.StudioName,
		Role:         "photographer",
	}

	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Email already registered"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "User registered successfully", "user": user})
}

// Login authenticates a photographer user and returns a JWT token
func (h *Handler) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email" binding:"required"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Email and password are required"})
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", strings.ToLower(req.Email)).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid email or password"})
		return
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"user_id": user.ID,
		"email":   user.Email,
		"exp":     time.Now().Add(time.Hour * 72).Unix(),
	})

	tokenString, err := token.SignedString([]byte(h.cfg.JWTSecret))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": tokenString,
		"user":  user,
	})
}

// CreateGallery creates a new gallery for a photographer
func (h *Handler) CreateGallery(c *gin.Context) {
	var req models.CreateGalleryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	folderID, err := h.driveService.ExtractFolderID(req.DriveURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Drive URL"})
		return
	}

	photos, err := h.driveService.FetchPhotosFromFolder(c.Request.Context(), folderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to load photos from Drive"})
		return
	}

	slug := generateRandomSlug()
	gallery := models.Gallery{
		Slug:           slug,
		PhotographerID: 1, // Default or extracted from Auth context
		DriveFolderID:  folderID,
		Title:          req.Title,
		ClientName:     req.ClientName,
		ClientEmail:    req.ClientEmail,
		MaxSelection:   req.MaxSelection,
		Status:         "active",
		Photos:         photos,
	}

	if err := h.db.Create(&gallery).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save gallery"})
		return
	}

	c.JSON(http.StatusCreated, gallery)
}

// GetGalleryBySlug returns a gallery and its photos for client viewing & selection
func (h *Handler) GetGalleryBySlug(c *gin.Context) {
	slug := c.Param("slug")
	var gallery models.Gallery

	if err := h.db.Preload("Photos").Preload("Selection").Where("slug = ?", slug).First(&gallery).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Gallery not found"})
		return
	}

	c.JSON(http.StatusOK, gallery)
}

// SubmitSelection records client's selected photos
func (h *Handler) SubmitSelection(c *gin.Context) {
	slug := c.Param("slug")
	var req models.SubmitSelectionRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Selected files list is required"})
		return
	}

	var gallery models.Gallery
	if err := h.db.Where("slug = ?", slug).First(&gallery).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Gallery not found"})
		return
	}

	jsonBytes, _ := json.Marshal(req.SelectedFiles)

	selection := models.Selection{
		GalleryID:     gallery.ID,
		SelectedFiles: string(jsonBytes),
		TotalSelected: len(req.SelectedFiles),
		ClientNotes:   req.ClientNotes,
		SubmittedAt:   time.Now(),
	}

	// Update selection or create
	if err := h.db.Where("gallery_id = ?", gallery.ID).Assign(selection).FirstOrCreate(&selection).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save selection"})
		return
	}

	// Update gallery status
	h.db.Model(&gallery).Update("status", "submitted")

	c.JSON(http.StatusOK, gin.H{
		"message":   "Selection submitted successfully",
		"selection": selection,
	})
}

// ExportSelection returns selected photos in plain text format for easy copy to Lightroom / Explorer
func (h *Handler) ExportSelection(c *gin.Context) {
	slug := c.Param("slug")
	var gallery models.Gallery

	if err := h.db.Preload("Selection").Where("slug = ?", slug).First(&gallery).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Gallery not found"})
		return
	}

	if gallery.Selection == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No selections have been submitted for this gallery yet"})
		return
	}

	var files []string
	json.Unmarshal([]byte(gallery.Selection.SelectedFiles), &files)

	commaSeparated := strings.Join(files, ", ")
	lineSeparated := strings.Join(files, "\n")

	c.JSON(http.StatusOK, gin.H{
		"title":           gallery.Title,
		"client_name":     gallery.ClientName,
		"total_selected":  gallery.Selection.TotalSelected,
		"submitted_at":    gallery.Selection.SubmittedAt,
		"comma_separated": commaSeparated,
		"line_separated":  lineSeparated,
		"file_list":       files,
		"client_notes":    gallery.Selection.ClientNotes,
	})
}
