package main

import (
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"

	"kleiora-backend/internal/models"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(".env"); err != nil {
		log.Println("No .env file found")
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("failed to connect database", err)
	}

	var pkg models.Package
	if err := db.Where("name LIKE ?", "%Couple Package Gold%").First(&pkg).Error; err != nil {
		log.Fatal("Package not found", err)
	}

	sourcePath := "C:/Users/prime/.gemini/antigravity-ide/brain/987c578d-4527-46d0-913e-0fe053ac158b/.user_uploaded/media_1787718952550.jpg"
	ext := filepath.Ext(sourcePath)
	destName := "pkg_couple_gold_new" + ext
	destPath := filepath.Join("uploads", destName)

	source, err := os.Open(sourcePath)
	if err != nil {
		log.Fatal("Cannot open source file:", err)
	}
	defer source.Close()

	dest, err := os.Create(destPath)
	if err != nil {
		log.Fatal("Cannot create dest file:", err)
	}
	defer dest.Close()

	_, err = io.Copy(dest, source)
	if err != nil {
		log.Fatal("Failed to copy file:", err)
	}

	pkg.ImagePath = "/uploads/" + destName
	if err := db.Save(&pkg).Error; err != nil {
		log.Fatal("Failed to update database:", err)
	}

	fmt.Println("Successfully updated image path to:", pkg.ImagePath)
}
