package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

type Config struct {
	Port                    string
	DatabaseURL             string
	JWTSecret               string
	GoogleDriveAPIKey       string
	FrontendOrigin          string
	UploadDir               string
	PaymentProofDir         string
	Environment             string
	MidtransServerKey       string
	MidtransBaseURL         string
	MidtransIsProduction    bool
	MidtransNotificationURL string
}

func LoadConfig() *Config {
	// Overload stale shell variables during local development. The two calls
	// support running from either backend/ or the repository root.
	_ = godotenv.Overload("../.env")
	_ = godotenv.Overload(".env")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "root:@tcp(127.0.0.1:3306)/kleiora?charset=utf8mb4&parseTime=True&loc=Asia%2FMakassar"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "kleiora-development-only-secret-change-me"
	}

	apiKey := os.Getenv("GOOGLE_DRIVE_API_KEY")
	frontendOrigin := os.Getenv("FRONTEND_ORIGIN")
	if frontendOrigin == "" {
		frontendOrigin = "http://localhost:3000"
	}

	uploadDir := os.Getenv("UPLOAD_DIR")
	if uploadDir == "" {
		uploadDir = "uploads"
	}
	paymentProofDir := os.Getenv("PAYMENT_PROOF_DIR")
	if paymentProofDir == "" {
		paymentProofDir = uploadDir + "/.private/payment-proofs"
	}

	environment := os.Getenv("APP_ENV")
	if environment == "" {
		environment = "development"
	}
	midtransBase := "https://api.sandbox.midtrans.com"
	if strings.EqualFold(os.Getenv("MIDTRANS_IS_PRODUCTION"), "true") {
		midtransBase = "https://api.midtrans.com"
	}
	if value := strings.TrimRight(os.Getenv("MIDTRANS_BASE_URL"), "/"); value != "" {
		midtransBase = value
	}
	notificationURL := strings.TrimSpace(os.Getenv("MIDTRANS_NOTIFICATION_URL"))
	if notificationURL == "" {
		notificationURL = strings.TrimRight(strings.Split(frontendOrigin, ",")[0], "/") + "/api/v1/payments/midtrans-notification"
	}

	return &Config{
		Port:                    port,
		DatabaseURL:             dbURL,
		JWTSecret:               jwtSecret,
		GoogleDriveAPIKey:       apiKey,
		FrontendOrigin:          frontendOrigin,
		UploadDir:               uploadDir,
		PaymentProofDir:         paymentProofDir,
		Environment:             environment,
		MidtransServerKey:       strings.TrimSpace(os.Getenv("MIDTRANS_SERVER_KEY")),
		MidtransBaseURL:         midtransBase,
		MidtransIsProduction:    strings.EqualFold(os.Getenv("MIDTRANS_IS_PRODUCTION"), "true"),
		MidtransNotificationURL: notificationURL,
	}
}

func (c *Config) ValidateMidtrans() error {
	expected := "https://api.sandbox.midtrans.com"
	if c.MidtransIsProduction {
		expected = "https://api.midtrans.com"
	}
	if c.MidtransBaseURL != expected {
		return fmt.Errorf("MIDTRANS_BASE_URL must match MIDTRANS_IS_PRODUCTION (%s)", expected)
	}
	if (c.Environment == "production" || c.MidtransIsProduction) && c.MidtransServerKey == "" {
		return fmt.Errorf("MIDTRANS_SERVER_KEY is required")
	}
	u, err := url.Parse(c.MidtransNotificationURL)
	if err != nil || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Scheme != "https" && u.Scheme != "http") || (u.Scheme != "https" && (c.Environment == "production" || c.MidtransIsProduction)) {
		return fmt.Errorf("MIDTRANS_NOTIFICATION_URL must be a public HTTPS URL without credentials, query or fragment")
	}
	return nil
}
