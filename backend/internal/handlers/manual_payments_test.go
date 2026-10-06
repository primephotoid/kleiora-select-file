package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"kleiora-backend/internal/config"
	"kleiora-backend/internal/models"
)

func manualBookingRequest(method string) map[string]any {
	return map[string]any{"package_code": "premium", "full_name": "Manual Client", "campus_name": "UNM", "whatsapp": "081234567890", "session_date": "2099-08-20", "session_hour": "10", "session_location": "Makassar", "payment_type": "dp", "payment_method": method}
}

func uploadManualProof(t *testing.T, app *fiber.App, b models.Booking, token, method string) *http.Response {
	t.Helper()
	png, _ := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	part, err := w.CreateFormFile("proof", "proof.png")
	if err != nil {
		t.Fatal(err)
	}
	part.Write(png)
	w.WriteField("payment_method", method)
	w.Close()
	r := httptest.NewRequest("POST", "/bookings/"+b.Code+"/payment-proof", &body)
	r.Header.Set("Content-Type", w.FormDataContentType())
	r.Header.Set(bookingTokenHeader, token)
	resp, err := app.Test(r)
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func TestManualMethodsUploadReviewAndExpiry(t *testing.T) {
	for _, method := range []string{"transfer", "ewallet"} {
		t.Run(method, func(t *testing.T) {
			app, db := bookingTestApp(t)
			resp := paymentRequest(t, app, "POST", "/bookings", "", manualBookingRequest(method))
			if resp.StatusCode != 201 {
				t.Fatal(resp.StatusCode)
			}
			var result struct {
				Booking models.Booking `json:"booking"`
				Token   string         `json:"access_token"`
			}
			json.NewDecoder(resp.Body).Decode(&result)
			b := result.Booking
			if b.PaymentOrderID != nil || b.PaymentMethod != method {
				t.Fatal("manual booking generated a provider order")
			}
			if resp := uploadManualProof(t, app, b, result.Token, "qris"); resp.StatusCode != 400 {
				t.Fatal("method switch accepted", resp.StatusCode)
			}
			if resp := uploadManualProof(t, app, b, result.Token, method); resp.StatusCode != 200 {
				t.Fatal("proof rejected", resp.StatusCode)
			}
			db.First(&b, b.ID)
			if b.PaymentStatus != "submitted" || b.Status != "pending_payment" || b.PaidAmount != 0 {
				t.Fatal("proof marked payment successful")
			}
			var notice models.PaymentNotice
			db.First(&notice)
			if !strings.Contains(notice.Message, "MENUNGGU VERIFIKASI ADMIN") {
				t.Fatal("misleading notification")
			}
			if resp := uploadManualProof(t, app, b, result.Token, method); resp.StatusCode != 409 {
				t.Fatal("duplicate proof accepted")
			}
			var notices int64
			db.Model(&models.PaymentNotice{}).Count(&notices)
			if notices != 1 {
				t.Fatal("duplicate notice")
			}
			past := time.Now().Add(-time.Minute)
			db.Model(&b).Update("payment_expires_at", past)
			h := NewHandler(db, &config.Config{}, nil)
			h.ProcessPayments()
			db.First(&b, b.ID)
			if b.Status != "pending_payment" {
				t.Fatal("submitted booking expired while awaiting review")
			}
			var occupied int64
			occupiedBookings(db, b.SessionDate, b.SessionHour).Count(&occupied)
			if occupied != 1 {
				t.Fatal("submitted proof did not hold slot")
			}
			r := httptest.NewRequest("PATCH", "/studio/bookings/"+b.Code+"/verify-payment", nil)
			r.Header.Set(paymentProofVersionHeader, b.PaymentProofVersion)
			resp, err := app.Test(r)
			if err != nil || resp.StatusCode != 200 {
				t.Fatal("manual verification failed", err)
			}
			db.First(&b, b.ID)
			if b.Status != "confirmed" || b.PaymentStatus != "verified" || b.PaidAmount != b.AmountDue {
				t.Fatal("incorrect verified manual payment")
			}
		})
	}
}

func TestManualExpiredUploadAndMethodValidation(t *testing.T) {
	app, db := bookingTestApp(t)
	if resp := paymentRequest(t, app, "POST", "/bookings", "", manualBookingRequest("cash")); resp.StatusCode != 400 {
		t.Fatal("unsupported payment method accepted")
	}
	request := manualBookingRequest("transfer")
	request["request_id"] = strings.Repeat("b", 64)
	resp := paymentRequest(t, app, "POST", "/bookings", "", request)
	var result struct {
		Booking models.Booking `json:"booking"`
		Token   string         `json:"access_token"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	request["payment_method"] = "qris"
	if resp := paymentRequest(t, app, "POST", "/bookings", "", request); resp.StatusCode != 409 {
		t.Fatal("retry changed payment method")
	}
	b := result.Booking
	db.Model(&b).Update("payment_expires_at", time.Now().Add(-time.Minute))
	if resp := uploadManualProof(t, app, b, result.Token, "transfer"); resp.StatusCode != 409 {
		t.Fatal("expired proof accepted")
	}
	h := NewHandler(db, &config.Config{}, nil)
	h.ProcessPayments()
	db.First(&b, b.ID)
	if b.Status != "expired" {
		t.Fatal("manual unpaid booking did not expire")
	}
	var count int64
	occupiedBookings(db, b.SessionDate, b.SessionHour).Count(&count)
	if count != 0 {
		t.Fatal("expired manual booking holds slot")
	}
}

func TestManualNoticeFailureRollsBackProof(t *testing.T) {
	app, db := bookingTestApp(t)
	resp := paymentRequest(t, app, "POST", "/bookings", "", manualBookingRequest("ewallet"))
	var result struct {
		Booking models.Booking `json:"booking"`
		Token   string         `json:"access_token"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	db.Migrator().DropTable(&models.PaymentNotice{})
	if resp := uploadManualProof(t, app, result.Booking, result.Token, "ewallet"); resp.StatusCode != 500 {
		t.Fatal("notice failure not propagated")
	}
	var b models.Booking
	db.First(&b, result.Booking.ID)
	if b.PaymentStatus != "pending" || b.PaymentProofPath != "" {
		t.Fatal("failed transaction persisted proof")
	}
}

func TestDeletingManualBookingRemovesQueuedNotice(t *testing.T) {
	app, db := bookingTestApp(t)
	resp := paymentRequest(t, app, "POST", "/bookings", "", manualBookingRequest("transfer"))
	var result struct {
		Booking models.Booking `json:"booking"`
		Token   string         `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatal(err)
	}
	if resp := uploadManualProof(t, app, result.Booking, result.Token, "transfer"); resp.StatusCode != 200 {
		t.Fatal(resp.StatusCode)
	}
	if resp := paymentRequest(t, app, "DELETE", "/studio/bookings/"+result.Booking.Code, "", nil); resp.StatusCode != 200 {
		t.Fatal(resp.StatusCode)
	}
	var count int64
	db.Model(&models.PaymentNotice{}).Count(&count)
	if count != 0 {
		t.Fatal("deleted booking still has a queued notice")
	}
}
