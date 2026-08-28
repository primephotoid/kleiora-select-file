package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"kleiora-backend/internal/config"
	"kleiora-backend/internal/models"
	"kleiora-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func bookingTestApp(t *testing.T) (*fiber.App, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.Package{}, &models.BookingSequence{}, &models.Booking{}, &models.Gallery{}, &models.Photo{}, &models.Selection{}); err != nil {
		t.Fatal(err)
	}
	pkg := models.Package{Code: "premium", Name: "Premium", Price: 1250000, DurationHours: 3, LocationCount: 3, EditedPhotos: 60, IsActive: true}
	if err := db.Create(&pkg).Error; err != nil {
		t.Fatal(err)
	}
	uploadDir := t.TempDir()
	h := NewHandler(db, &config.Config{JWTSecret: "test-secret", UploadDir: uploadDir, PaymentProofDir: uploadDir + "/.private/payment-proofs", Environment: "development"}, services.NewDriveService(""))
	app := fiber.New()
	app.Get("/availability", h.GetAvailability)
	app.Post("/bookings", h.CreateBooking)
	app.Get("/bookings/:code", h.GetBooking)
	app.Post("/bookings/:code/payment-proof", h.UploadPaymentProof)
	app.Get("/studio/bookings", h.ListBookings)
	app.Post("/studio/bookings/:code/access-token", h.RotateBookingAccessToken)
	app.Get("/studio/bookings/:code/payment-proof", h.ViewPaymentProof)
	app.Patch("/studio/bookings/:code/verify-payment", h.VerifyBookingPayment)
	app.Delete("/studio/bookings/:code", h.DeleteBooking)
	app.Post("/galleries/:slug/select", h.SubmitSelection)
	return app, db
}

func postBooking(t *testing.T, app *fiber.App, name string) *http.Response {
	return postBookingAt(t, app, name, "2099-08-20", "10")
}

func postBookingAt(t *testing.T, app *fiber.App, name, sessionDate, sessionHour string) *http.Response {
	t.Helper()
	body, _ := json.Marshal(map[string]any{"package_code": "premium", "full_name": name, "campus_name": "Universitas Hasanuddin", "whatsapp": "081234567890", "session_date": sessionDate, "session_hour": sessionHour, "session_location": "Makassar", "payment_type": "dp"})
	req := httptest.NewRequest("POST", "/bookings", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	response, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	return response
}

func decodeCreatedBooking(t *testing.T, response *http.Response) models.Booking {
	t.Helper()
	if response.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected booking creation to return 201, got %d", response.StatusCode)
	}
	var payload struct {
		Booking models.Booking `json:"booking"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	return payload.Booking
}

func TestCreateBookingCalculatesDPAndEnforcesCapacity(t *testing.T) {
	app, _ := bookingTestApp(t)
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

func TestBookingSequenceResetsEachYearWithoutDeletingBookings(t *testing.T) {
	app, db := bookingTestApp(t)
	first := decodeCreatedBooking(t, postBookingAt(t, app, "Year One A", "2099-08-20", "10"))
	second := decodeCreatedBooking(t, postBookingAt(t, app, "Year One B", "2099-08-21", "10"))
	newYear := decodeCreatedBooking(t, postBookingAt(t, app, "Year Two A", "2100-01-02", "10"))

	if !strings.HasSuffix(first.Code, "-001") || !strings.HasSuffix(second.Code, "-002") {
		t.Fatalf("expected 2099 sequence 001/002, got %s and %s", first.Code, second.Code)
	}
	if !strings.HasSuffix(newYear.Code, "-001") {
		t.Fatalf("expected 2100 sequence to reset to 001, got %s", newYear.Code)
	}
	var bookingCount int64
	if err := db.Model(&models.Booking{}).Count(&bookingCount).Error; err != nil {
		t.Fatal(err)
	}
	if bookingCount != 3 {
		t.Fatalf("expected all historical bookings to remain, got %d", bookingCount)
	}
}

func TestBookingSequenceContinuesFromExistingAnnualCodes(t *testing.T) {
	app, db := bookingTestApp(t)
	var pkg models.Package
	if err := db.Where("code = ?", "premium").First(&pkg).Error; err != nil {
		t.Fatal(err)
	}
	existing := models.Booking{
		Code: "KLR-PKG-010199-007", PackageID: pkg.ID, FullName: "Existing", CampusName: "Campus", WhatsApp: "081234567890",
		SessionDate: "2099-01-01", SessionHour: "10", SessionLocation: "Makassar", PaymentType: "full", AmountDue: pkg.Price,
		PaymentStatus: "pending", Status: "pending_payment",
	}
	if err := db.Create(&existing).Error; err != nil {
		t.Fatal(err)
	}
	created := decodeCreatedBooking(t, postBookingAt(t, app, "Next Existing", "2099-08-22", "10"))
	if !strings.HasSuffix(created.Code, "-008") {
		t.Fatalf("expected existing annual sequence to continue at 008, got %s", created.Code)
	}
}

func createBookingForTest(t *testing.T, app *fiber.App, name string) (models.Booking, string) {
	t.Helper()
	response := postBooking(t, app, name)
	if response.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected booking creation to return 201, got %d", response.StatusCode)
	}
	var payload struct {
		Booking     models.Booking `json:"booking"`
		AccessToken string         `json:"access_token"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.AccessToken == "" {
		t.Fatal("expected a booking access token")
	}
	return payload.Booking, payload.AccessToken
}

func TestBookingDetailsAndPaymentProofRequireAccessToken(t *testing.T) {
	app, db := bookingTestApp(t)
	booking, accessToken := createBookingForTest(t, app, "Dewi")

	request := httptest.NewRequest(http.MethodGet, "/bookings/"+booking.Code, nil)
	response, err := app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected booking details without token to return 401, got %d", response.StatusCode)
	}

	request = httptest.NewRequest(http.MethodGet, "/bookings/"+booking.Code, nil)
	request.Header.Set(bookingTokenHeader, accessToken)
	response, err = app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("expected booking details with token to return 200, got %d", response.StatusCode)
	}

	request = httptest.NewRequest(http.MethodPost, "/bookings/"+booking.Code+"/payment-proof", nil)
	response, err = app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected payment upload without token to return 401, got %d", response.StatusCode)
	}

	proofBytes, err := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
	if err != nil {
		t.Fatal(err)
	}
	var upload bytes.Buffer
	writer := multipart.NewWriter(&upload)
	part, err := writer.CreateFormFile("proof", "proof.png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(proofBytes); err != nil {
		t.Fatal(err)
	}
	if err := writer.WriteField("payment_method", "transfer"); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	request = httptest.NewRequest(http.MethodPost, "/bookings/"+booking.Code+"/payment-proof", &upload)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	request.Header.Set(bookingTokenHeader, accessToken)
	response, err = app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("expected payment upload with token to return 200, got %d", response.StatusCode)
	}

	var stored models.Booking
	if err := db.First(&stored, booking.ID).Error; err != nil {
		t.Fatal(err)
	}
	if stored.AccessTokenHash == "" || stored.AccessTokenHash == accessToken {
		t.Fatal("expected only a non-plaintext access-token hash to be persisted")
	}
	if !strings.Contains(filepath.ToSlash(stored.PaymentProofPath), "/.private/payment-proofs/") {
		t.Fatalf("expected payment proof in private storage, got %s", stored.PaymentProofPath)
	}
	if _, err := os.Stat(stored.PaymentProofPath); err != nil {
		t.Fatalf("expected stored payment proof to exist: %v", err)
	}
	request = httptest.NewRequest(http.MethodGet, "/studio/bookings/"+booking.Code+"/payment-proof", nil)
	response, err = app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("expected admin proof view to return 200, got %d", response.StatusCode)
	}
	proofVersion := response.Header.Get(paymentProofVersionHeader)
	if proofVersion == "" {
		t.Fatal("expected proof view to return its version")
	}
	request = httptest.NewRequest(http.MethodPatch, "/studio/bookings/"+booking.Code+"/verify-payment", nil)
	request.Header.Set(paymentProofVersionHeader, "wrong-version")
	response, err = app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusConflict {
		t.Fatalf("expected wrong proof version verification to return 409, got %d", response.StatusCode)
	}
	request = httptest.NewRequest(http.MethodPatch, "/studio/bookings/"+booking.Code+"/verify-payment", nil)
	request.Header.Set(paymentProofVersionHeader, proofVersion)
	response, err = app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("expected current proof version verification to return 200, got %d", response.StatusCode)
	}
	request = httptest.NewRequest(http.MethodPost, "/bookings/"+booking.Code+"/payment-proof", nil)
	request.Header.Set(bookingTokenHeader, accessToken)
	response, err = app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusConflict {
		t.Fatalf("expected finalized payment proof replacement to return 409, got %d", response.StatusCode)
	}
}

func TestAdminCanRotateAccessTokenForLegacyBooking(t *testing.T) {
	app, db := bookingTestApp(t)
	booking, oldToken := createBookingForTest(t, app, "Legacy Client")
	if err := db.Model(&models.Booking{}).Where("id = ?", booking.ID).Update("access_token_hash", "").Error; err != nil {
		t.Fatal(err)
	}

	request := httptest.NewRequest(http.MethodPost, "/studio/bookings/"+booking.Code+"/access-token", nil)
	response, err := app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("expected token recovery to return 200, got %d", response.StatusCode)
	}
	var payload struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.AccessToken == "" || payload.AccessToken == oldToken {
		t.Fatal("expected a fresh access token")
	}

	request = httptest.NewRequest(http.MethodGet, "/bookings/"+booking.Code, nil)
	request.Header.Set(bookingTokenHeader, payload.AccessToken)
	response, err = app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("expected recovered access token to authorize booking, got %d", response.StatusCode)
	}
}

func TestRotateAccessTokenRouteRequiresAdminAuthentication(t *testing.T) {
	_, db := bookingTestApp(t)
	h := NewHandler(db, &config.Config{JWTSecret: "test-secret", Environment: "production"}, services.NewDriveService(""))
	app := fiber.New()
	studio := app.Group("/studio", h.AdminRequired)
	studio.Post("/bookings/:code/access-token", h.RotateBookingAccessToken)

	response, err := app.Test(httptest.NewRequest(http.MethodPost, "/studio/bookings/ANY/access-token", nil))
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusUnauthorized {
		t.Fatalf("expected unauthenticated token rotation to return 401, got %d", response.StatusCode)
	}
}

func TestSubmitSelectionDoesNotVerifyOrCompleteBooking(t *testing.T) {
	app, db := bookingTestApp(t)
	booking, _ := createBookingForTest(t, app, "Eka")
	gallery := models.Gallery{
		Slug: "secure-gallery", PhotographerID: 1, BookingID: &booking.ID,
		DriveFolderID: "folder", Title: "Eka Gallery", ClientName: "Eka", MaxSelection: 1, Status: "active",
		Photos: []models.Photo{{DriveFileID: "drive-1", FileName: "photo-1.jpg"}},
	}
	if err := db.Create(&gallery).Error; err != nil {
		t.Fatal(err)
	}
	body, _ := json.Marshal(map[string]any{"selected_files": []string{"drive-1"}})
	request := httptest.NewRequest(http.MethodPost, "/galleries/secure-gallery/select", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response, err := app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("expected selection submission to return 200, got %d", response.StatusCode)
	}
	if err := db.First(&booking, booking.ID).Error; err != nil {
		t.Fatal(err)
	}
	if booking.PaymentStatus != "pending" || booking.Status != "pending_payment" {
		t.Fatalf("selection changed booking state to %s/%s", booking.PaymentStatus, booking.Status)
	}
}

func TestListBookingsIsReadOnlyAndDoesNotFuzzyLinkGallery(t *testing.T) {
	app, db := bookingTestApp(t)
	booking, _ := createBookingForTest(t, app, "Fajar")
	gallery := models.Gallery{Slug: "unlinked-gallery", PhotographerID: 1, DriveFolderID: "folder", Title: "Fajar graduation", ClientName: "Fajar", Status: "submitted"}
	if err := db.Create(&gallery).Error; err != nil {
		t.Fatal(err)
	}

	response, err := app.Test(httptest.NewRequest(http.MethodGet, "/studio/bookings", nil))
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("expected list bookings to return 200, got %d", response.StatusCode)
	}
	if err := db.First(&booking, booking.ID).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.First(&gallery, gallery.ID).Error; err != nil {
		t.Fatal(err)
	}
	if gallery.BookingID != nil || booking.PaymentStatus != "pending" || booking.Status != "pending_payment" {
		t.Fatal("listing bookings mutated a booking or fuzzy-linked an unrelated gallery")
	}
}

func TestListBookingsSupportsServerSidePaginationSearchFilterAndSort(t *testing.T) {
	app, db := bookingTestApp(t)
	var pkg models.Package
	if err := db.Where("code = ?", "premium").First(&pkg).Error; err != nil {
		t.Fatal(err)
	}
	for index := 1; index <= 13; index++ {
		booking := models.Booking{
			Code: fmt.Sprintf("KLR-TEST-%03d", index), PackageID: pkg.ID,
			FullName: fmt.Sprintf("Client %02d", index), CampusName: "Campus", WhatsApp: fmt.Sprintf("08120000%04d", index),
			SessionDate: "2099-09-01", SessionHour: "10", SessionLocation: "Makassar",
			PaymentType: "dp", AmountDue: int64(index * 1000), PaymentStatus: "pending", Status: "pending_payment",
		}
		if index%3 == 0 {
			booking.PaymentStatus = "submitted"
		}
		if index%4 == 0 {
			booking.PaymentStatus = "verified"
			booking.Status = "completed"
		}
		if err := db.Create(&booking).Error; err != nil {
			t.Fatal(err)
		}
	}

	response, err := app.Test(httptest.NewRequest(http.MethodGet, "/studio/bookings?page=2&per_page=5&search=client&sort_by=code&sort_dir=asc", nil))
	if err != nil {
		t.Fatal(err)
	}
	var payload struct {
		Bookings []models.Booking `json:"bookings"`
		Meta     struct {
			Page       int `json:"page"`
			PerPage    int `json:"per_page"`
			Total      int `json:"total"`
			TotalPages int `json:"total_pages"`
		} `json:"meta"`
		Summary struct {
			Total       int `json:"total"`
			NeedsAction int `json:"needs_action"`
			Confirmed   int `json:"confirmed"`
			Completed   int `json:"completed"`
		} `json:"summary"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusOK || len(payload.Bookings) != 5 {
		t.Fatalf("expected second page with 5 rows, got status %d and %d rows", response.StatusCode, len(payload.Bookings))
	}
	if payload.Bookings[0].Code != "KLR-TEST-006" || payload.Bookings[4].Code != "KLR-TEST-010" {
		t.Fatalf("unexpected sorted page: %s ... %s", payload.Bookings[0].Code, payload.Bookings[4].Code)
	}
	if payload.Meta.Page != 2 || payload.Meta.PerPage != 5 || payload.Meta.Total != 13 || payload.Meta.TotalPages != 3 {
		t.Fatalf("unexpected pagination metadata: %+v", payload.Meta)
	}
	if payload.Summary.Total != 13 || payload.Summary.NeedsAction != 3 || payload.Summary.Completed != 3 {
		t.Fatalf("unexpected booking summary: %+v", payload.Summary)
	}

	filtered, err := app.Test(httptest.NewRequest(http.MethodGet, "/studio/bookings?filter=needs_action&per_page=10", nil))
	if err != nil {
		t.Fatal(err)
	}
	var filteredPayload struct {
		Bookings []models.Booking `json:"bookings"`
		Meta     struct {
			Total int `json:"total"`
		} `json:"meta"`
	}
	if err := json.NewDecoder(filtered.Body).Decode(&filteredPayload); err != nil {
		t.Fatal(err)
	}
	if filteredPayload.Meta.Total != 3 || len(filteredPayload.Bookings) != 3 {
		t.Fatalf("expected 3 bookings needing action, got total %d and %d rows", filteredPayload.Meta.Total, len(filteredPayload.Bookings))
	}
}

func TestDeleteBookingOnlyDeletesExactlyLinkedGallery(t *testing.T) {
	app, db := bookingTestApp(t)
	booking, _ := createBookingForTest(t, app, "Gita")
	linked := models.Gallery{Slug: "linked-gallery", PhotographerID: 1, BookingID: &booking.ID, DriveFolderID: "folder-1", Title: "Gita", ClientName: "Gita", Status: "active"}
	unrelated := models.Gallery{Slug: "unrelated-gallery", PhotographerID: 1, DriveFolderID: "folder-2", Title: "Gita graduation", ClientName: "Gita", Status: "active"}
	if err := db.Create(&linked).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&unrelated).Error; err != nil {
		t.Fatal(err)
	}

	response, err := app.Test(httptest.NewRequest(http.MethodDelete, "/studio/bookings/"+booking.Code, nil))
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusOK {
		t.Fatalf("expected delete booking to return 200, got %d", response.StatusCode)
	}
	if err := db.First(&unrelated, unrelated.ID).Error; err != nil {
		t.Fatalf("expected similarly named unlinked gallery to remain: %v", err)
	}
	if err := db.First(&linked, linked.ID).Error; !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected exactly linked gallery to be deleted, got %v", err)
	}
}

func TestConcurrentBookingRequestsCannotExceedSlotCapacity(t *testing.T) {
	app, db := bookingTestApp(t)
	const requests = 8
	statuses := make(chan int, requests)
	var wg sync.WaitGroup
	for i := 0; i < requests; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			response := postBooking(t, app, "Concurrent "+string(rune('A'+index)))
			statuses <- response.StatusCode
		}(i)
	}
	wg.Wait()
	close(statuses)
	created := 0
	for status := range statuses {
		if status == fiber.StatusCreated {
			created++
		} else if status != fiber.StatusConflict {
			t.Fatalf("expected 201 or 409, got %d", status)
		}
	}
	if created != int(slotCapacity) {
		t.Fatalf("expected exactly %d bookings, got %d", slotCapacity, created)
	}
	var count int64
	if err := db.Model(&models.Booking{}).Count(&count).Error; err != nil {
		t.Fatal(err)
	}
	if count != slotCapacity {
		t.Fatalf("expected %d persisted bookings, got %d", slotCapacity, count)
	}
}

func TestRegistrationCreatesAdminOnlyOutsideProduction(t *testing.T) {
	app, db := bookingTestApp(t)
	h := NewHandler(db, &config.Config{Environment: "development"}, services.NewDriveService(""))
	app.Post("/register", h.Register)
	body := []byte(`{"email":"admin@example.com","password":"very-strong-password","full_name":"Admin","studio_name":"Studio"}`)
	request := httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response, err := app.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusCreated {
		t.Fatalf("expected development bootstrap to return 201, got %d", response.StatusCode)
	}
	var user models.User
	if err := db.Where("email = ?", "admin@example.com").First(&user).Error; err != nil {
		t.Fatal(err)
	}
	if user.Role != "admin" {
		t.Fatalf("expected bootstrap user to be admin, got %s", user.Role)
	}

	productionApp := fiber.New()
	productionHandler := NewHandler(db, &config.Config{Environment: "production"}, services.NewDriveService(""))
	productionApp.Post("/register", productionHandler.Register)
	request = httptest.NewRequest(http.MethodPost, "/register", bytes.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response, err = productionApp.Test(request)
	if err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != fiber.StatusForbidden {
		t.Fatalf("expected production registration to return 403, got %d", response.StatusCode)
	}
}
