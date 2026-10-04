package handlers

import (
	"bytes"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"kleiora-backend/internal/config"
	"kleiora-backend/internal/models"
	"kleiora-backend/internal/services"
)

type paymentTransport func(*http.Request) (*http.Response, error)

func (f paymentTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func qrisTest(t *testing.T) (*fiber.App, *gorm.DB, *Handler, models.Booking, string) {
	t.Helper()
	app, db := bookingTestApp(t)
	if err := db.AutoMigrate(&models.PaymentNotice{}); err != nil {
		t.Fatal(err)
	}
	h := NewHandler(db, &config.Config{JWTSecret: "test-secret", MidtransServerKey: "test-key", MidtransBaseURL: "https://api.sandbox.midtrans.com", MidtransNotificationURL: "https://example.test/api/v1/payments/midtrans-notification"}, nil)
	app.Post("/bookings/:code/qris", h.CreateQRIS)
	app.Get("/bookings/:code/payment", h.GetPayment)
	app.Get("/bookings/:code/qris.png", h.QRISImage)
	app.Post("/payments/midtrans-notification", h.MidtransNotification)
	app.Patch("/studio/bookings/:code/complete", h.CompleteBooking)
	b, token := createBookingForTest(t, app, "QRIS Client")
	return app, db, h, b, token
}

func providerPayment(b models.Booking, status string) services.MidtransPayment {
	return services.MidtransPayment{OrderID: *b.PaymentOrderID, TransactionID: "550e8400-e29b-41d4-a716-446655440000", Status: status, StatusCode: "200", Amount: "625000.00", Currency: "IDR", PaymentType: "qris", FraudStatus: "accept"}
}

func providerResponse(p any, status int) *http.Response {
	data, _ := json.Marshal(p)
	return &http.Response{StatusCode: status, Body: io.NopCloser(bytes.NewReader(data)), Header: make(http.Header)}
}

func paymentRequest(t *testing.T, app *fiber.App, method, path, token string, body any) *http.Response {
	t.Helper()
	data, _ := json.Marshal(body)
	r := httptest.NewRequest(method, path, bytes.NewReader(data))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set(bookingTokenHeader, token)
	response, err := app.Test(r, 15000)
	if err != nil {
		t.Fatal(err)
	}
	return response
}

func signedNotification(b models.Booking, status string) services.MidtransPayment {
	p := providerPayment(b, status)
	sum := sha512.Sum512([]byte(p.OrderID + p.StatusCode + p.Amount + "test-key"))
	p.Signature = hex.EncodeToString(sum[:])
	return p
}

func TestQRISChargeRetryAndPrivatePNG(t *testing.T) {
	app, _, h, b, token := qrisTest(t)
	charges := 0
	h.midtrans.HTTP.Transport = paymentTransport(func(r *http.Request) (*http.Response, error) {
		if strings.HasSuffix(r.URL.Path, "/qr-code") {
			if r.Header.Get("Authorization") != "" {
				t.Fatal("QR image request must not carry server credentials")
			}
			return &http.Response{StatusCode: 200, Body: io.NopCloser(bytes.NewReader([]byte{137, 80, 78, 71, 13, 10, 26, 10})), Header: make(http.Header)}, nil
		}
		key, _, ok := r.BasicAuth()
		if !ok || key != "test-key" {
			t.Fatal("missing backend authentication")
		}
		if r.Method == "GET" {
			return providerResponse(map[string]string{"status_code": "404"}, 404), nil
		}
		charges++
		var req struct {
			PaymentType string `json:"payment_type"`
			Details     struct {
				OrderID string `json:"order_id"`
				Amount  int64  `json:"gross_amount"`
			} `json:"transaction_details"`
			Expiry struct {
				Duration int `json:"expiry_duration"`
			} `json:"custom_expiry"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			t.Fatal(err)
		}
		if req.PaymentType != "qris" || req.Details.Amount != b.AmountDue || req.Details.OrderID != *b.PaymentOrderID || req.Expiry.Duration != 30 {
			t.Fatal("charge does not use persisted order/amount/expiry")
		}
		if r.Header.Get("X-Override-Notification") != h.midtrans.NotificationURL {
			t.Fatal("notification URL missing")
		}
		p := providerPayment(b, "pending")
		p.Actions = append(p.Actions, struct {
			Name string `json:"name"`
			URL  string `json:"url"`
		}{"generate-qr-code", h.midtrans.BaseURL + "/v2/qris/" + p.TransactionID + "/qr-code"})
		return providerResponse(p, 201), nil
	})
	for i := 0; i < 2; i++ {
		resp := paymentRequest(t, app, "POST", "/bookings/"+b.Code+"/qris", token, map[string]any{"gross_amount": 1})
		if resp.StatusCode != 200 {
			t.Fatalf("charge response: %d", resp.StatusCode)
		}
	}
	if charges != 1 {
		t.Fatalf("retry made %d charges", charges)
	}
	if resp := paymentRequest(t, app, "GET", "/bookings/"+b.Code+"/qris.png", "", nil); resp.StatusCode != 401 {
		t.Fatal("image accessible without token")
	}
	resp := paymentRequest(t, app, "GET", "/bookings/"+b.Code+"/qris.png?download=1", token, nil)
	if resp.StatusCode != 200 || resp.Header.Get("Content-Type") != "image/png" || !strings.Contains(resp.Header.Get("Content-Disposition"), "attachment") || resp.Header.Get("Cache-Control") != "no-store" {
		t.Fatal("invalid private PNG download response")
	}
}

func TestWebhookAuthenticityAmountAndIdempotency(t *testing.T) {
	app, db, h, b, _ := qrisTest(t)
	status, amount := "pending", "625000.00"
	calls := 0
	h.midtrans.HTTP.Transport = paymentTransport(func(r *http.Request) (*http.Response, error) {
		calls++
		p := providerPayment(b, status)
		p.Amount = amount
		return providerResponse(p, 200), nil
	})
	n := signedNotification(b, "settlement")
	n.Signature = "forged"
	if resp := paymentRequest(t, app, "POST", "/payments/midtrans-notification", "", n); resp.StatusCode != 401 || calls != 0 {
		t.Fatal("forged signature accepted or triggered provider request")
	}
	n = signedNotification(b, "settlement")
	// A signed payload alone cannot override the provider's actual pending state.
	if resp := paymentRequest(t, app, "POST", "/payments/midtrans-notification", "", n); resp.StatusCode != 200 {
		t.Fatal(resp.StatusCode)
	}
	db.First(&b, b.ID)
	if b.PaymentStatus != "pending" || b.PaidAmount != 0 {
		t.Fatal("browser/webhook payload marked pending order paid")
	}
	status, amount = "settlement", "1.00"
	if resp := paymentRequest(t, app, "POST", "/payments/midtrans-notification", "", n); resp.StatusCode != 503 {
		t.Fatal("wrong amount accepted")
	}
	amount = "625000.00"
	for i := 0; i < 2; i++ {
		if resp := paymentRequest(t, app, "POST", "/payments/midtrans-notification", "", n); resp.StatusCode != 200 {
			t.Fatal(resp.StatusCode)
		}
	}
	db.First(&b, b.ID)
	if b.PaymentStatus != "verified" || b.Status != "confirmed" || b.PaidAmount != b.AmountDue {
		t.Fatal("settlement was not persisted")
	}
	var count int64
	db.Model(&models.PaymentNotice{}).Count(&count)
	if count != 1 {
		t.Fatal("duplicate payment notification queued")
	}
	status = "pending"
	paymentRequest(t, app, "POST", "/payments/midtrans-notification", "", n)
	db.First(&b, b.ID)
	if b.PaymentStatus != "verified" {
		t.Fatal("older notification downgraded paid order")
	}
}

func TestExpiredReservationReleasesSlotAndLatePaymentNeedsReview(t *testing.T) {
	app, db, h, b, token := qrisTest(t)
	createBookingForTest(t, app, "Second Client")
	past := time.Now().Add(-time.Minute)
	db.Model(&b).Update("payment_expires_at", past)
	if resp := postBooking(t, app, "Replacement Client"); resp.StatusCode != 201 {
		t.Fatal("expired unpaid hold still occupies capacity")
	}
	if resp := paymentRequest(t, app, "POST", "/bookings/"+b.Code+"/qris", token, nil); resp.StatusCode != 409 {
		t.Fatal("expired QRIS charge allowed")
	}
	h.midtrans.HTTP.Transport = paymentTransport(func(r *http.Request) (*http.Response, error) {
		return providerResponse(providerPayment(b, "settlement"), 200), nil
	})
	if resp := paymentRequest(t, app, "POST", "/payments/midtrans-notification", "", signedNotification(b, "settlement")); resp.StatusCode != 200 {
		t.Fatal(resp.StatusCode)
	}
	db.First(&b, b.ID)
	if b.PaymentStatus != "payment_review" || b.Status != "payment_review" || b.PaidAmount != b.AmountDue {
		t.Fatal("late payment confirmed a released slot or lost received funds")
	}
}

func TestQRISCannotBeManuallyVerifiedCompletedOrDeleted(t *testing.T) {
	app, _, _, b, token := qrisTest(t)
	for _, path := range []string{"/studio/bookings/" + b.Code + "/verify-payment", "/studio/bookings/" + b.Code + "/complete"} {
		if resp := paymentRequest(t, app, "PATCH", path, "", nil); resp.StatusCode != 409 {
			t.Fatalf("unsafe manual transition %s: %d", path, resp.StatusCode)
		}
	}
	if resp := paymentRequest(t, app, "POST", "/bookings/"+b.Code+"/payment-proof", token, nil); resp.StatusCode != 409 {
		t.Fatal("QRIS proof upload allowed")
	}
	if resp := paymentRequest(t, app, "DELETE", "/studio/bookings/"+b.Code, "", nil); resp.StatusCode != 409 {
		t.Fatal("QRIS financial history deleted")
	}
}

func TestSettlementAndNoticeAreAtomic(t *testing.T) {
	app, db, h, b, _ := qrisTest(t)
	// A failed event write must roll back the payment state, so the webhook
	// remains retryable rather than acknowledging a partially saved settlement.
	if err := db.Migrator().DropTable(&models.PaymentNotice{}); err != nil {
		t.Fatal(err)
	}
	h.midtrans.HTTP.Transport = paymentTransport(func(r *http.Request) (*http.Response, error) {
		return providerResponse(providerPayment(b, "settlement"), 200), nil
	})
	if resp := paymentRequest(t, app, "POST", "/payments/midtrans-notification", "", signedNotification(b, "settlement")); resp.StatusCode != 503 {
		t.Fatal("failed database persistence was acknowledged")
	}
	db.First(&b, b.ID)
	if b.PaymentStatus != "pending" || b.PaidAmount != 0 {
		t.Fatal("settlement committed without its notification event")
	}
}

func TestBookingRequestRetryIsIdempotent(t *testing.T) {
	app, db := bookingTestApp(t)
	request := map[string]any{"request_id": strings.Repeat("a", 64), "package_code": "premium", "full_name": "Retry Client", "campus_name": "UNM", "whatsapp": "081234567890", "session_date": "2099-08-20", "session_hour": "10", "session_location": "Makassar", "payment_type": "dp"}
	var code, token string
	for i := 0; i < 2; i++ {
		resp := paymentRequest(t, app, "POST", "/bookings", "", request)
		if resp.StatusCode != 201 {
			t.Fatal(resp.StatusCode)
		}
		var result struct {
			Booking models.Booking `json:"booking"`
			Token   string         `json:"access_token"`
		}
		json.NewDecoder(resp.Body).Decode(&result)
		if i == 0 {
			code, token = result.Booking.Code, result.Token
		} else if code != result.Booking.Code || token != result.Token {
			t.Fatal("retry created a new booking or lost recovery token")
		}
	}
	var count int64
	db.Model(&models.Booking{}).Count(&count)
	if count != 1 {
		t.Fatal("duplicate booking persisted")
	}
	request["full_name"] = "Changed Client"
	if resp := paymentRequest(t, app, "POST", "/bookings", "", request); resp.StatusCode != 409 {
		t.Fatal("idempotency key reused for different booking")
	}
}
