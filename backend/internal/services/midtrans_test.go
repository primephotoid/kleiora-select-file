package services

import (
	"kleiora-backend/internal/models"
	"testing"
)

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
