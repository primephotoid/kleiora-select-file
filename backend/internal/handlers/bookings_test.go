package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"kleiora-backend/internal/config"
	"kleiora-backend/internal/models"
	"kleiora-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func bookingTestApp(t *testing.T) *fiber.App {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.Package{}, &models.Booking{}, &models.Gallery{}, &models.Photo{}, &models.Selection{}); err != nil {
		t.Fatal(err)
	}
	pkg := models.Package{Code: "premium", Name: "Premium", Price: 1250000, DurationHours: 3, LocationCount: 3, EditedPhotos: 60, IsActive: true}
	if err := db.Create(&pkg).Error; err != nil {
		t.Fatal(err)
	}
	h := NewHandler(db, &config.Config{JWTSecret: "test-secret", UploadDir: t.TempDir()}, services.NewDriveService(""))
	app := fiber.New()
	app.Get("/availability", h.GetAvailability)
	app.Post("/bookings", h.CreateBooking)
	return app
}

func postBooking(t *testing.T, app *fiber.App, name string) *http.Response {
	t.Helper()
	body, _ := json.Marshal(map[string]any{"package_code": "premium", "full_name": name, "campus_name": "Universitas Hasanuddin", "whatsapp": "081234567890", "session_date": "2099-08-20", "session_hour": "10", "session_location": "Makassar", "payment_type": "dp"})
	req := httptest.NewRequest("POST", "/bookings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	response, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	return response
}

func TestCreateBookingCalculatesDPAndEnforcesCapacity(t *testing.T) {
	app := bookingTestApp(t)
	for _, name := range []string{"Alya", "Bima"} {
		response := postBooking(t, app, name)
		if response.StatusCode != fiber.StatusCreated {
			t.Fatalf("expected booking for %s to succeed, got %d", name, response.StatusCode)
		}
		var payload struct {
			Booking models.Booking `json:"booking"`
		}
		if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		if payload.Booking.AmountDue != 625000 {
			t.Fatalf("expected DP 625000, got %d", payload.Booking.AmountDue)
		}
	}
	if response := postBooking(t, app, "Citra"); response.StatusCode != fiber.StatusConflict {
		t.Fatalf("expected full slot to return 409, got %d", response.StatusCode)
	}
}
