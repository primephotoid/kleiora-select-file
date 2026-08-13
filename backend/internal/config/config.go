package config

import (
	"os"
)

type Config struct {
	Port              string
	DatabaseURL       string
	JWTSecret         string
	GoogleDriveAPIKey string
}

func LoadConfig() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "pilihin.db"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "pilihin-super-secret-jwt-key-2026"
	}

	apiKey := os.Getenv("GOOGLE_DRIVE_API_KEY")

	return &Config{
		Port:              port,
		DatabaseURL:       dbURL,
		JWTSecret:         jwtSecret,
		GoogleDriveAPIKey: apiKey,
	}
}
