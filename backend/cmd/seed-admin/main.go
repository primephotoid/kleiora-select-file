package main

import (
	"log"
	"net/mail"
	"os"
	"strings"

	"kleiora-backend/internal/config"
	"kleiora-backend/internal/models"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	cfg := config.LoadConfig()
	email := strings.ToLower(strings.TrimSpace(os.Getenv("ADMIN_EMAIL")))
	password := os.Getenv("ADMIN_PASSWORD")
	fullName := strings.TrimSpace(os.Getenv("ADMIN_FULL_NAME"))
	studioName := strings.TrimSpace(os.Getenv("ADMIN_STUDIO_NAME"))

	if _, err := mail.ParseAddress(email); err != nil {
		log.Fatal("ADMIN_EMAIL wajib berupa alamat email yang valid")
	}
	if len(password) < 12 {
		log.Fatal("ADMIN_PASSWORD wajib memiliki minimal 12 karakter")
	}
	if fullName == "" {
		fullName = "Administrator Kleiora"
	}
	if studioName == "" {
		studioName = "Kleiora"
	}

	db, err := gorm.Open(mysql.Open(cfg.DatabaseURL), &gorm.Config{})
	if err != nil {
		log.Fatalf("Gagal terhubung ke MySQL: %v", err)
	}
	if err := db.AutoMigrate(&models.User{}); err != nil {
		log.Fatalf("Gagal menjalankan migrasi tabel users: %v", err)
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("Gagal mengenkripsi password admin: %v", err)
	}

	var user models.User
	result := db.Where("email = ?", email).First(&user)
	switch {
	case result.Error == nil:
		user.PasswordHash = string(hashedPassword)
		user.FullName = fullName
		user.StudioName = studioName
		user.Role = "admin"
		if err := db.Save(&user).Error; err != nil {
			log.Fatalf("Gagal memperbarui admin: %v", err)
		}
		log.Printf("Admin %s berhasil diperbarui", email)
	case result.Error == gorm.ErrRecordNotFound:
		user = models.User{
			Email:        email,
			PasswordHash: string(hashedPassword),
			FullName:     fullName,
			StudioName:   studioName,
			Role:         "admin",
		}
		if err := db.Create(&user).Error; err != nil {
			log.Fatalf("Gagal membuat admin: %v", err)
		}
		log.Printf("Admin %s berhasil dibuat", email)
	default:
		log.Fatalf("Gagal memeriksa akun admin: %v", result.Error)
	}
}
