package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port              string
	DatabaseURL       string
	JWTSecret         string
	GoogleDriveAPIKey string
	FrontendOrigin    string
	UploadDir         string
	Environment       string
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

	environment := os.Getenv("APP_ENV")
	if environment == "" {
		environment = "development"
	}

	return &Config{
		Port:              port,
		DatabaseURL:       dbURL,
		JWTSecret:         jwtSecret,
		GoogleDriveAPIKey: apiKey,
		FrontendOrigin:    frontendOrigin,
		UploadDir:         uploadDir,
		Environment:       environment,
	}
}
