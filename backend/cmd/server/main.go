package main

import (
	"log"
	"net/http"

	"pilihin-backend/internal/config"
	"pilihin-backend/internal/handlers"
	"pilihin-backend/internal/models"
	"pilihin-backend/internal/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	cfg := config.LoadConfig()

	// Initialize Database
	db, err := gorm.Open(sqlite.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto Migrate Models
	err = db.AutoMigrate(&models.User{}, &models.Gallery{}, &models.Photo{}, &models.Selection{})
	if err != nil {
		log.Fatalf("Failed to run database migration: %v", err)
	}

	// Initialize Services & Handlers
	driveService := services.NewDriveService(cfg.GoogleDriveAPIKey)
	h := handlers.NewHandler(db, cfg, driveService)

	// Setup Gin Router
	r := gin.Default()

	// Enable CORS for frontend integration
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// Healthcheck Endpoint
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status":  "ok",
			"message": "Pilihin Backend API (Go) is running smoothly",
		})
	})

	// API v1 Router Group
	api := r.Group("/api/v1")
	{
		// Demo Sandbox Parsing
		api.POST("/demo/parse-drive", h.DemoParseDrive)

		// Auth Endpoints
		api.POST("/auth/register", h.Register)
		api.POST("/auth/login", h.Login)

		// Gallery & Selection Endpoints
		api.POST("/galleries", h.CreateGallery)
		api.GET("/galleries/:slug", h.GetGalleryBySlug)
		api.POST("/galleries/:slug/select", h.SubmitSelection)
		api.GET("/galleries/:slug/export", h.ExportSelection)
	}

	log.Printf("Starting Pilihin Backend Server on port :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("Server failed to run: %v", err)
	}
}
