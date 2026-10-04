package services

import (
	"bytes"
	"crypto/sha512"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"kleiora-backend/internal/config"
	"kleiora-backend/internal/models"
)

var ErrMidtransNotFound = errors.New("midtrans order not found")

type MidtransPayment struct {
	OrderID       string `json:"order_id"`
	TransactionID string `json:"transaction_id"`
	Status        string `json:"transaction_status"`
	StatusCode    string `json:"status_code"`
	Amount        string `json:"gross_amount"`
	Currency      string `json:"currency"`
	PaymentType   string `json:"payment_type"`
	FraudStatus   string `json:"fraud_status"`
	Signature     string `json:"signature_key"`
	Actions       []struct {
		Name string `json:"name"`
		URL  string `json:"url"`
	} `json:"actions"`
}

type Midtrans struct {
	BaseURL         string
	ServerKey       string
	NotificationURL string
	HTTP            *http.Client
}

func NewMidtrans(c *config.Config) *Midtrans {
	return &Midtrans{BaseURL: c.MidtransBaseURL, ServerKey: c.MidtransServerKey, NotificationURL: c.MidtransNotificationURL,
		HTTP: &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}}
}

func (m *Midtrans) request(method, path string, body any) (*MidtransPayment, error) {
	if m.ServerKey == "" {
		return nil, errors.New("Midtrans is not configured")
	}
	var data []byte
	var err error
	if body != nil {
		data, err = json.Marshal(body)
		if err != nil {
			return nil, err
		}
	}
	req, err := http.NewRequest(method, m.BaseURL+path, bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	req.SetBasicAuth(m.ServerKey, "")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Content-Type", "application/json")
	if method == http.MethodPost {
		req.Header.Set("X-Override-Notification", m.NotificationURL)
	}
	resp, err := m.HTTP.Do(req)
	if err != nil {
		return nil, errors.New("Midtrans request failed; retry with the same booking")
	}
	defer resp.Body.Close()
	var payment MidtransPayment
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&payment); err != nil {
		return nil, errors.New("Invalid Midtrans response")
	}
	if resp.StatusCode == 404 || payment.StatusCode == "404" {
		return nil, ErrMidtransNotFound
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 || (payment.StatusCode != "200" && payment.StatusCode != "201") {
		return nil, fmt.Errorf("Midtrans rejected request (%d/%s)", resp.StatusCode, payment.StatusCode)
	}
	return &payment, nil
}

func (m *Midtrans) Status(order string) (*MidtransPayment, error) {
	return m.request(http.MethodGet, "/v2/"+url.PathEscape(order)+"/status", nil)
}

func (m *Midtrans) Charge(b models.Booking) (*MidtransPayment, error) {
	return m.request(http.MethodPost, "/v2/charge", map[string]any{
		"payment_type": "qris", "qris": map[string]string{"acquirer": "gopay"},
		"transaction_details": map[string]any{"order_id": *b.PaymentOrderID, "gross_amount": b.AmountDue},
		"customer_details":    map[string]string{"first_name": b.FullName, "phone": b.WhatsApp},
		"custom_expiry":       map[string]any{"order_time": b.PaymentExpiresAt.Add(-30 * time.Minute).In(time.FixedZone("WIB", 7*3600)).Format("2006-01-02 15:04:05 -0700"), "expiry_duration": 30, "unit": "minute"},
	})
}

func (m *Midtrans) ValidSignature(p MidtransPayment) bool {
	if m.ServerKey == "" {
		return false
	}
	sum := sha512.Sum512([]byte(p.OrderID + p.StatusCode + p.Amount + m.ServerKey))
	decoded, err := hex.DecodeString(p.Signature)
	return err == nil && subtle.ConstantTimeCompare(sum[:], decoded) == 1
}

func (p MidtransPayment) Matches(b models.Booking) bool {
	amount, ok := new(big.Rat).SetString(p.Amount)
	return ok && amount.Cmp(new(big.Rat).SetInt64(b.AmountDue)) == 0 && b.PaymentOrderID != nil && p.OrderID == *b.PaymentOrderID &&
		p.TransactionID != "" && (b.PaymentTransactionID == "" || b.PaymentTransactionID == p.TransactionID) && p.Currency == "IDR" && p.PaymentType == "qris"
}

func (m *Midtrans) QRURL(p MidtransPayment) string {
	for _, action := range p.Actions {
		if action.Name != "generate-qr-code" {
			continue
		}
		u, err := url.Parse(action.URL)
		base, _ := url.Parse(m.BaseURL)
		if err == nil && u.Scheme == base.Scheme && u.Host == base.Host && u.User == nil && u.RawQuery == "" && u.Fragment == "" && strings.HasPrefix(u.Path, "/v2/qris/") && strings.HasSuffix(u.Path, "/qr-code") {
			return u.String()
		}
	}
	// Get Status may omit actions after an interrupted charge. Midtrans's
	// documented PNG endpoint also accepts its immutable transaction ID.
	if len(p.Actions) == 0 && regexp.MustCompile(`^[a-zA-Z0-9-]{1,128}$`).MatchString(p.TransactionID) {
		return m.BaseURL + "/v2/qris/" + p.TransactionID + "/qr-code"
	}
	return ""
}

func (m *Midtrans) QRImage(qrURL string) ([]byte, error) {
	// Revalidate stored provider URLs before any credential-bearing request.
	p := MidtransPayment{}
	p.Actions = append(p.Actions, struct {
		Name string `json:"name"`
		URL  string `json:"url"`
	}{"generate-qr-code", qrURL})
	if m.QRURL(p) == "" {
		return nil, errors.New("Invalid QRIS image URL")
	}
	req, err := http.NewRequest(http.MethodGet, qrURL, nil)
	if err != nil {
		return nil, err
	}
	// Public QR image endpoint: no server key is exposed to the browser or image host.
	resp, err := m.HTTP.Do(req)
	if err != nil {
		return nil, errors.New("QRIS image unavailable")
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(io.LimitReader(resp.Body, (2<<20)+1))
	if err != nil || resp.StatusCode != 200 || len(data) > 2<<20 || !bytes.HasPrefix(data, []byte{137, 80, 78, 71, 13, 10, 26, 10}) {
		return nil, errors.New("Invalid QRIS PNG")
	}
	return data, nil
}
