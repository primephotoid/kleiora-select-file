package services

import (
	"io"
	"kleiora-backend/internal/models"
	"net/http"
	"strings"
	"testing"
)

type midtransTestTransport func(*http.Request) (*http.Response, error)

func (f midtransTestTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestMidtrans202RequiresUnsuccessfulTransactionStatus(t *testing.T) {
	for _, tc := range []struct {
		status   string
		httpCode int
		accepted bool
	}{
		{"expire", 200, true}, {"deny", 200, true}, {"cancel", 200, true}, {"failure", 200, true},
		{"settlement", 200, false}, {"pending", 200, false}, {"", 200, false},
		{"expire", 500, false}, {"deny", 401, false},
	} {
		t.Run(tc.status+http.StatusText(tc.httpCode), func(t *testing.T) {
			m := Midtrans{BaseURL: "https://api.sandbox.midtrans.com", ServerKey: "test", HTTP: &http.Client{Transport: midtransTestTransport(func(r *http.Request) (*http.Response, error) {
				return &http.Response{StatusCode: tc.httpCode, Body: io.NopCloser(strings.NewReader(`{"status_code":"202","transaction_status":"` + tc.status + `"}`)), Header: make(http.Header)}, nil
			})}}
			for _, method := range []string{http.MethodGet, http.MethodPost} {
				_, err := m.request(method, "/v2/test", nil)
				if (err == nil) != tc.accepted {
					t.Fatalf("%s: accepted=%v, error=%v", method, tc.accepted, err)
				}
			}
		})
	}
}

func TestMidtransIdentityAndQRURLValidation(t *testing.T) {
	order := "KLR-test"
	b := models.Booking{PaymentOrderID: &order, AmountDue: 625000, PaymentTransactionID: "transaction-1"}
	p := MidtransPayment{OrderID: order, Amount: "625000.00", Currency: "IDR", PaymentType: "qris", TransactionID: "transaction-1"}
	if !p.Matches(b) {
		t.Fatal("matching payment rejected")
	}
	for _, field := range []string{"amount", "order", "currency", "type", "transaction"} {
		bad := p
		switch field {
		case "amount":
			bad.Amount = "1.00"
		case "order":
			bad.OrderID = "other"
		case "currency":
			bad.Currency = "USD"
		case "type":
			bad.PaymentType = "bank_transfer"
		case "transaction":
			bad.TransactionID = "another-transaction"
		}
		if bad.Matches(b) {
			t.Fatalf("mismatching %s accepted", field)
		}
	}
	m := Midtrans{BaseURL: "https://api.sandbox.midtrans.com"}
	if m.QRURL(p) != "https://api.sandbox.midtrans.com/v2/qris/transaction-1/qr-code" {
		t.Fatal("interrupted charge cannot recover QR URL")
	}
	for _, badURL := range []string{"https://attacker.test/v2/qris/transaction-1/qr-code", "https://api.sandbox.midtrans.com@attacker.test/v2/qris/x/qr-code", "http://api.sandbox.midtrans.com/v2/qris/x/qr-code", "https://api.sandbox.midtrans.com/v2/qris/x/qr-code?redirect=evil"} {
		bad := p
		bad.Actions = append(bad.Actions, struct {
			Name string `json:"name"`
			URL  string `json:"url"`
		}{"generate-qr-code", badURL})
		if m.QRURL(bad) != "" {
			t.Fatalf("unsafe image host or URL accepted: %s", badURL)
		}
	}
}

func TestQRISChargeRejectsInvalidAmountBeforeRequest(t *testing.T) {
	// No HTTP client: validation must return before any provider request.
	m := Midtrans{}
	for _, amount := range []int64{0, -1, MaxQRISAmount + 1} {
		if _, err := m.Charge(models.Booking{AmountDue: amount}); err == nil {
			t.Fatalf("invalid QRIS amount %d accepted", amount)
		}
	}
}
