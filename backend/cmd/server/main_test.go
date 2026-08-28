package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"kleiora-backend/internal/config"
	"kleiora-backend/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestShouldBlockPrivateAndLegacyPaymentProofPaths(t *testing.T) {
	blocked := []string{
		"/uploads/.private/payment-proofs/0123456789abcdef0123456789abcdef.jpg",
		"/uploads/%2eprivate/payment-proofs/0123456789abcdef0123456789abcdef.jpg",
		"/uploads/%252eprivate/payment-proofs/0123456789abcdef0123456789abcdef.jpg",
		"/uploads/0123456789abcdef0123456789abcdef.png",
		"/uploads/%30%31%32%33%34%35%36%37%38%39abcdef0123456789abcdef.png",
		"/uploads/%zz",
	}
	for _, path := range blocked {
		if !shouldBlockUploadPath(path) {
			t.Fatalf("expected %s to be blocked", path)
		}
	}
	allowed := []string{"/uploads/pkg_0123456789abcdef0123456789abcdef.jpg", "/uploads/portfolios/image.jpg"}
	for _, path := range allowed {
		if shouldBlockUploadPath(path) {
			t.Fatalf("expected %s to remain public", path)
		}
	}
}

func TestValidatePaymentProofStorageRejectsPublicSubdirectory(t *testing.T) {
	if err := validatePaymentProofStorage("uploads/payment-proofs"); err == nil {
		t.Fatal("expected public payment proof directory to be rejected")
	}
	if err := validatePaymentProofStorage("uploads/.private/payment-proofs"); err != nil {
		t.Fatalf("expected private uploads subdirectory to be accepted: %v", err)
	}
	if err := validatePaymentProofStorage(t.TempDir()); err == nil {
		t.Fatal("expected storage outside the persistent private uploads tree to be rejected")
	}
}

func TestMigrateLegacyPaymentProofsMovesFileAndUpdatesBooking(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Package{}, &models.Booking{}); err != nil {
		t.Fatal(err)
	}
	pkg := models.Package{Code: "test", Name: "Test", Price: 100000, DurationHours: 1, LocationCount: 1, IsActive: true}
	if err := db.Create(&pkg).Error; err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	uploadDir := filepath.Join(root, "uploads")
	privateDir := filepath.Join(uploadDir, ".private", "payment-proofs")
	if err := os.MkdirAll(uploadDir, 0o750); err != nil {
		t.Fatal(err)
	}
	name := "0123456789abcdef0123456789abcdef.jpg"
	legacyPath := filepath.Join(uploadDir, name)
	if err := os.WriteFile(legacyPath, []byte("proof"), 0o600); err != nil {
		t.Fatal(err)
	}
	booking := models.Booking{
		Code: "KLR-TEST", PackageID: pkg.ID, FullName: "Client", CampusName: "Campus", WhatsApp: "081234567890",
		SessionDate: "2099-01-01", SessionHour: "10", SessionLocation: "Makassar", PaymentType: "full",
		AmountDue: 100000, PaymentProofPath: legacyPath, PaymentStatus: "submitted", Status: "pending_payment",
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatal(err)
	}
	if err := migrateLegacyPaymentProofs(db, &config.Config{UploadDir: uploadDir, PaymentProofDir: privateDir}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(legacyPath); !os.IsNotExist(err) {
		t.Fatalf("expected legacy proof to be moved, got %v", err)
	}
	target := filepath.Join(privateDir, name)
	if _, err := os.Stat(target); err != nil {
		t.Fatalf("expected private proof file: %v", err)
	}
	if err := db.First(&booking, booking.ID).Error; err != nil {
		t.Fatal(err)
	}
	if booking.PaymentProofPath != target {
		t.Fatalf("expected stored path %s, got %s", target, booking.PaymentProofPath)
	}
	if booking.PaymentProofVersion == "" {
		t.Fatal("expected legacy proof migration to assign a proof version")
	}
}

func TestMigrateLegacyPaymentProofsNormalizesWindowsSeparators(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Package{}, &models.Booking{}); err != nil {
		t.Fatal(err)
	}
	pkg := models.Package{Code: "windows-test", Name: "Test", Price: 100000, DurationHours: 1, LocationCount: 1, IsActive: true}
	if err := db.Create(&pkg).Error; err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	uploadDir := filepath.Join(root, "uploads")
	privateDir := filepath.Join(uploadDir, ".private", "payment-proofs")
	if err := os.MkdirAll(uploadDir, 0o750); err != nil {
		t.Fatal(err)
	}
	name := "abcdef0123456789abcdef0123456789.png"
	legacyPath := filepath.Join(uploadDir, name)
	if err := os.WriteFile(legacyPath, []byte("proof"), 0o600); err != nil {
		t.Fatal(err)
	}
	booking := models.Booking{
		Code: "KLR-WINDOWS", PackageID: pkg.ID, FullName: "Client", CampusName: "Campus", WhatsApp: "081234567890",
		SessionDate: "2099-01-01", SessionHour: "10", SessionLocation: "Makassar", PaymentType: "full",
		AmountDue: 100000, PaymentProofPath: strings.ReplaceAll(legacyPath, "/", "\\"), PaymentStatus: "submitted", Status: "pending_payment",
	}
	if err := db.Create(&booking).Error; err != nil {
		t.Fatal(err)
	}
	if err := migrateLegacyPaymentProofs(db, &config.Config{UploadDir: uploadDir, PaymentProofDir: privateDir}); err != nil {
		t.Fatal(err)
	}
	if err := db.First(&booking, booking.ID).Error; err != nil {
		t.Fatal(err)
	}
	expected := filepath.Join(privateDir, name)
	if booking.PaymentProofPath != expected || booking.PaymentProofVersion == "" {
		t.Fatalf("expected normalized private proof path and version, got %s / %s", booking.PaymentProofPath, booking.PaymentProofVersion)
	}
	if _, err := os.Stat(expected); err != nil {
		t.Fatalf("expected normalized proof to be moved: %v", err)
	}
}
