package main

import (
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"kleiora-backend/internal/config"
	"kleiora-backend/internal/handlers"
	"kleiora-backend/internal/models"
	"kleiora-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func seedPackages(db *gorm.DB) error {
	packages := []models.Package{
		{Code: "personal", Name: "Personal Package", Description: "Sesi personal yang ringkas dan fokus pada wisudawan.", Price: 400000, DurationHours: 1, LocationCount: 1, EditedPhotos: 20, ImagePath: "/images/package-basic.jpg", IsActive: true},
		{Code: "family", Name: "Family Package", Description: "Sesi lebih panjang untuk wisudawan bersama keluarga.", Price: 500000, DurationHours: 2, LocationCount: 2, EditedPhotos: 40, IncludesPrint: "1 cetak foto 10R", ImagePath: "/images/package-standard.jpg", IsActive: true},
		{Code: "premium", Name: "Premium Package", Description: "Dokumentasi lengkap dengan lebih banyak lokasi dan video teaser.", Price: 1250000, DurationHours: 3, LocationCount: 3, EditedPhotos: 60, IncludesPrint: "2 cetak foto 10R", IncludesTeaser: true, ImagePath: "/images/package-premium.jpg", IsActive: true},
	}
	for _, pkg := range packages {
		var existing models.Package
		result := db.Where("code = ?", pkg.Code).First(&existing)
		if result.Error == nil {
			if err := db.Model(&existing).Updates(pkg).Error; err != nil {
				return err
			}
			continue
		}
		if result.Error != gorm.ErrRecordNotFound {
			return result.Error
		}
		if err := db.Create(&pkg).Error; err != nil {
			return err
		}
	}
	return nil
}

func main() {
	cfg := config.LoadConfig()
	if cfg.Environment == "production" && strings.Contains(cfg.JWTSecret, "development-only") {
		log.Fatal("JWT_SECRET must be configured in production")
	}

	db, err := gorm.Open(mysql.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to MySQL: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("Failed to initialize MySQL connection pool: %v", err)
	}
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetMaxOpenConns(20)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
	if err := sqlDB.Ping(); err != nil {
		log.Fatalf("Failed to ping MySQL: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Package{}, &models.Booking{}, &models.Gallery{}, &models.Photo{}, &models.Selection{}); err != nil {
		log.Fatalf("Failed to run database migration: %v", err)
	}
	if err := seedPackages(db); err != nil {
		log.Fatalf("Failed to seed packages: %v", err)
	}

	driveService := services.NewDriveService(cfg.GoogleDriveAPIKey)
	h := handlers.NewHandler(db, cfg, driveService)
	app := fiber.New(fiber.Config{
		AppName:      "Kleiora API",
		BodyLimit:    6 * 1024 * 1024,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			code := fiber.StatusInternalServerError
			if fiberErr, ok := err.(*fiber.Error); ok {
				code = fiberErr.Code
			}
			if code >= 500 {
				log.Printf("request failed: %v", err)
			}
			return c.Status(code).JSON(fiber.Map{"error": http.StatusText(code)})
		},
	})
	app.Use(recover.New())
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{AllowOrigins: cfg.FrontendOrigin, AllowMethods: "GET,POST,PATCH,OPTIONS", AllowHeaders: "Origin, Content-Type, Accept, Authorization"}))
	app.Use(limiter.New(limiter.Config{Max: 120, Expiration: time.Minute, LimitReached: func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{"error": "Too many requests"})
	}}))

	app.Get("/ping", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "message": "Kleiora Fiber API is running"})
	})
	api := app.Group("/api/v1")
	api.Post("/auth/register", h.Register)
	api.Post("/auth/login", h.Login)
	api.Get("/packages", h.ListPackages)
	api.Get("/availability", h.GetAvailability)
	api.Post("/bookings", h.CreateBooking)
	api.Get("/bookings/:code", h.GetBooking)
	api.Post("/bookings/:code/payment-proof", h.UploadPaymentProof)
	api.Post("/demo/parse-drive", h.DemoParseDrive)
	api.Get("/galleries/:slug", h.GetGalleryBySlug)
	api.Post("/galleries/:slug/select", h.SubmitSelection)

	studio := api.Group("/studio", h.AuthRequired)
	studio.Get("/bookings", h.ListBookings)
	studio.Patch("/bookings/:code/verify-payment", h.VerifyBookingPayment)
	studio.Get("/galleries", h.ListGalleries)
	studio.Post("/galleries", h.CreateGallery)
	studio.Get("/galleries/:slug/export", h.ExportSelection)

	log.Printf("Starting Kleiora Fiber API on port :%s", cfg.Port)
	if err := app.Listen(fmt.Sprintf(":%s", cfg.Port)); err != nil {
		log.Fatalf("Server failed to run: %v", err)
	}
}
