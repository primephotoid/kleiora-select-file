package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
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

var paymentProofFilePattern = regexp.MustCompile(`(?i)^[a-f0-9]{32}\.(jpe?g|png)$`)

func newPaymentProofVersion() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", err
	}
	return hex.EncodeToString(value), nil
}

func validatePaymentProofStorage(paymentProofDir string) error {
	publicRoot, err := filepath.Abs("uploads")
	if err != nil {
		return err
	}
	proofRoot, err := filepath.Abs(paymentProofDir)
	if err != nil {
		return err
	}
	relative, err := filepath.Rel(publicRoot, proofRoot)
	if err != nil {
		return err
	}
	privatePrefix := ".private" + string(os.PathSeparator)
	if relative != ".private" && !strings.HasPrefix(relative, privatePrefix) {
		return fmt.Errorf("PAYMENT_PROOF_DIR must be below uploads/.private")
	}
	return nil
}

func shouldBlockUploadPath(requestPath string) bool {
	decodedPath := requestPath
	for range 3 {
		unescaped, err := url.PathUnescape(decodedPath)
		if err != nil {
			return true
		}
		if unescaped == decodedPath {
			break
		}
		decodedPath = unescaped
	}
	decodedPath = path.Clean("/" + strings.TrimPrefix(decodedPath, "/"))
	relativePath := strings.TrimPrefix(decodedPath, "/uploads/")
	return relativePath == ".private" || strings.HasPrefix(relativePath, ".private/") || (!strings.Contains(relativePath, "/") && paymentProofFilePattern.MatchString(relativePath))
}

func migrateLegacyPaymentProofs(db *gorm.DB, cfg *config.Config) error {
	if err := os.MkdirAll(cfg.PaymentProofDir, 0o750); err != nil {
		return err
	}
	var bookings []models.Booking
	if err := db.Select("id", "payment_proof_path", "payment_proof_version").Where("payment_proof_path <> ''").Find(&bookings).Error; err != nil {
		return err
	}
	uploadDir := filepath.Clean(cfg.UploadDir)
	absoluteUploadDir, _ := filepath.Abs(uploadDir)
	for _, booking := range bookings {
		normalizedStoredPath := strings.ReplaceAll(booking.PaymentProofPath, "\\", string(os.PathSeparator))
		source := filepath.Clean(normalizedStoredPath)
		sourceDir := filepath.Dir(source)
		target := source
		moved := false
		if (sourceDir == uploadDir || sourceDir == absoluteUploadDir) && paymentProofFilePattern.MatchString(filepath.Base(source)) {
			target = filepath.Join(cfg.PaymentProofDir, filepath.Base(source))
			_, sourceErr := os.Stat(source)
			_, targetErr := os.Stat(target)
			switch {
			case sourceErr == nil && os.IsNotExist(targetErr):
				if err := os.Rename(source, target); err != nil {
					return err
				}
				moved = true
			case os.IsNotExist(sourceErr) && targetErr == nil:
				// Recover a prior move that completed before its database update.
			case sourceErr == nil && targetErr == nil:
				return fmt.Errorf("payment proof migration target already exists: %s", target)
			case sourceErr != nil && !os.IsNotExist(sourceErr):
				return sourceErr
			case targetErr != nil && !os.IsNotExist(targetErr):
				return targetErr
			default:
				continue
			}
		}
		proofVersion := booking.PaymentProofVersion
		if proofVersion == "" {
			var err error
			proofVersion, err = newPaymentProofVersion()
			if err != nil {
				if moved {
					_ = os.Rename(target, source)
				}
				return err
			}
		}
		updates := map[string]any{"payment_proof_path": target, "payment_proof_version": proofVersion}
		if err := db.Model(&models.Booking{}).Where("id = ?", booking.ID).Updates(updates).Error; err != nil {
			if moved {
				_ = os.Rename(target, source)
			}
			return err
		}
	}
	return nil
}

func seedPackages(db *gorm.DB) error {
	var count int64
	db.Model(&models.Package{}).Count(&count)
	if count > 0 {
		// Database already seeded/modified by admin, do not aggressively re-seed
		return nil
	}

	packages := []models.Package{
		{Code: "personal", Name: "Personal Package", Description: "1 Wisudawan beserta keluarga.", Price: 400000, DurationHours: 1, DurationLabel: "1 jam", LocationCount: 1, EditedPhotos: 30, ImagePath: "/images/package-basic.jpg", IsActive: true},
		{Code: "couple-gold", Name: "Couple Package Gold", Description: "1 Wisudawan dan partner.", Price: 450000, DurationHours: 1, DurationLabel: "1 jam", LocationCount: 1, EditedPhotos: 35, ImagePath: "/images/package-standard.jpg", IsActive: true},
		{Code: "couple-platinum", Name: "Couple Package Platinum", Description: "2 Wisudawan dan partner.", Price: 600000, DurationHours: 1, DurationLabel: "1 jam 30 menit", LocationCount: 1, EditedPhotos: 50, ImagePath: "/images/package-standard.jpg", IsActive: true},
		{Code: "group-gold", Name: "Group Package Gold", Description: "3 Wisudawan.", Price: 700000, DurationHours: 1, DurationLabel: "1 jam", LocationCount: 1, EditedPhotos: 35, ImagePath: "/images/package-premium.jpg", IsActive: true},
		{Code: "cinematic", Name: "Cinematic Package", Description: "1 Wisudawan + keluarga dan teman.", Price: 1000000, DurationHours: 1, DurationLabel: "1 jam", LocationCount: 1, EditedPhotos: 0, ImagePath: "/images/package-premium.jpg", IsActive: true},
		{Code: "group-platinum", Name: "Group Package Platinum", Description: "5 Wisudawan.", Price: 1250000, DurationHours: 2, DurationLabel: "2 jam", LocationCount: 1, EditedPhotos: 45, ImagePath: "/images/package-premium.jpg", IsActive: true},
		{Code: "group-diamond", Name: "Group Package Diamond", Description: "10 Wisudawan.", Price: 2000000, DurationHours: 3, DurationLabel: "3 jam", LocationCount: 1, EditedPhotos: 60, ImagePath: "/images/package-premium.jpg", IsActive: true},
	}
	// Deactivate old packages no longer in use
	oldCodes := []string{"family", "premium"}
	if err := db.Model(&models.Package{}).Where("code IN ?", oldCodes).Update("is_active", false).Error; err != nil {
		return err
	}
	for _, pkg := range packages {
		var existing models.Package
		result := db.Where("code = ?", pkg.Code).First(&existing)
		if result.Error == nil {
			// Do not overwrite existing packages so admin edits are not lost on restart
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
	if err := validatePaymentProofStorage(cfg.PaymentProofDir); err != nil {
		log.Fatalf("Invalid payment-proof storage configuration: %v", err)
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
	if err := db.AutoMigrate(&models.User{}, &models.Package{}, &models.BookingSequence{}, &models.Booking{}, &models.Gallery{}, &models.Photo{}, &models.Selection{}, &models.Portfolio{}, &models.Review{}, &models.VisitorLog{}); err != nil {
		log.Fatalf("Failed to run database migration: %v", err)
	}
	if err := migrateLegacyPaymentProofs(db, cfg); err != nil {
		log.Fatalf("Failed to move payment proofs to private storage: %v", err)
	}
	if err := seedPackages(db); err != nil {
		log.Fatalf("Failed to seed packages: %v", err)
	}

	driveService := services.NewDriveService(cfg.GoogleDriveAPIKey)
	h := handlers.NewHandler(db, cfg, driveService)
	app := fiber.New(fiber.Config{
		AppName:      "Kleiora API",
		UnescapePath: true,
		BodyLimit:    200 * 1024 * 1024,
		ReadTimeout:  120 * time.Second,
		WriteTimeout: 120 * time.Second,
		IdleTimeout:  120 * time.Second,
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
	app.Use(cors.New(cors.Config{AllowOrigins: cfg.FrontendOrigin, AllowMethods: "GET,POST,PUT,PATCH,DELETE,OPTIONS", AllowHeaders: "Origin, Content-Type, Accept, Authorization, X-Booking-Token, X-Payment-Proof-Version", ExposeHeaders: "X-Payment-Proof-Version", AllowCredentials: true}))
	app.Use(limiter.New(limiter.Config{Max: 120, Expiration: time.Minute, LimitReached: func(c *fiber.Ctx) error {
		return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{"error": "Too many requests"})
	}}))

	app.Get("/ping", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "message": "Kleiora Fiber API is running"})
	})
	app.Use("/uploads", func(c *fiber.Ctx) error {
		if shouldBlockUploadPath(c.Path()) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return c.Next()
	})
	app.Static("/uploads", "./uploads")
	// Public images are also exposed below the API prefix so deployments only
	// need to proxy /api/v1 to the backend. Existing database paths remain
	// /uploads/... and are translated by the frontend.
	app.Use("/api/v1/media", func(c *fiber.Ctx) error {
		uploadPath := strings.Replace(c.Path(), "/api/v1/media", "/uploads", 1)
		if shouldBlockUploadPath(uploadPath) {
			return c.SendStatus(fiber.StatusNotFound)
		}
		return c.Next()
	})
	app.Static("/api/v1/media", "./uploads")
	api := app.Group("/api/v1")
	api.Post("/auth/register", h.Register)
	api.Post("/auth/login", h.Login)
	api.Post("/auth/logout", h.Logout)
	api.Get("/packages", h.ListPackages)
	api.Get("/portfolios", h.ListActivePortfolios)
	api.Get("/reviews", h.ListApprovedReviews)
	api.Post("/reviews", h.CreateReview)
	api.Get("/availability", h.GetAvailability)
	api.Post("/bookings", h.CreateBooking)
	api.Get("/bookings/:code", h.GetBooking)
	api.Post("/bookings/:code/payment-proof", h.UploadPaymentProof)
	api.Get("/galleries/:slug", h.GetGalleryBySlug)
	api.Post("/galleries/:slug/select", h.SubmitSelection)
	api.Post("/analytics/track", h.TrackEvent)

	studio := api.Group("/studio", h.AdminRequired)
	studio.Get("/bookings", h.ListBookings)
	studio.Post("/bookings/:code/access-token", h.RotateBookingAccessToken)
	studio.Patch("/bookings/:code/verify-payment", h.VerifyBookingPayment)
	studio.Patch("/bookings/:code/complete", h.CompleteBooking)
	studio.Get("/bookings/:code/payment-proof", h.ViewPaymentProof)
	studio.Delete("/bookings/:code", h.DeleteBooking)
	studio.Get("/galleries", h.ListGalleries)
	studio.Post("/galleries", h.CreateGallery)
	studio.Delete("/galleries/:id", h.DeleteGallery)
	studio.Get("/galleries/:slug/export", h.ExportSelection)
	studio.Get("/analytics", h.GetAnalyticsSummary)

	studio.Get("/packages", h.ListAllPackages)
	studio.Post("/packages", h.CreatePackage)
	studio.Patch("/packages/reorder", h.ReorderPackages)
	studio.Put("/packages/:id", h.UpdatePackage)
	studio.Delete("/packages/:id", h.DeletePackage)
	studio.Post("/packages/upload-image", h.UploadPackageImage)

	studio.Get("/portfolios", h.ListAllPortfolios)
	studio.Post("/portfolios", h.CreatePortfolio)
	studio.Put("/portfolios/:id", h.UpdatePortfolio)
	studio.Delete("/portfolios/:id", h.DeletePortfolio)
	studio.Post("/portfolios/upload-image", h.UploadPortfolioImage)

	studio.Get("/reviews", h.ListAllReviews)
	studio.Patch("/reviews/:id/approve", h.ToggleReviewApproval)
	studio.Delete("/reviews/:id", h.DeleteReview)

	log.Printf("Starting Kleiora Fiber API on port :%s", cfg.Port)
	if err := app.Listen(fmt.Sprintf(":%s", cfg.Port)); err != nil {
		log.Fatalf("Server failed to run: %v", err)
	}
}
