package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	"kleiora-backend/internal/models"
)

// SendTelegramBookingNotification sends an alert to the Admin's Telegram when a new booking is created.
func SendTelegramBookingNotification(booking models.Booking, packageName string) {
	botToken := os.Getenv("TELEGRAM_BOT_TOKEN")
	chatID := os.Getenv("TELEGRAM_CHAT_ID")

	if botToken == "" || chatID == "" {
		log.Println("Telegram credentials not configured. Skipping notification.")
		return
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)

	paymentTypeLabel := "Full Payment (Lunas)"
	if booking.PaymentType == "dp" {
		paymentTypeLabel = "Down Payment (Setengah Harga)"
	}

	message := fmt.Sprintf(
		"🔔 *Booking Baru Diterima!*\n\n"+
			"*Kode:* `%s`\n"+
			"*Klien:* %s\n"+
			"*Kampus:* %s\n"+
			"*WhatsApp:* %s\n"+
			"*Paket:* %s\n"+
			"*Tanggal Foto:* %s\n"+
			"*Jam Sesi:* %s:00 WITA\n"+
			"*Lokasi:* %s\n"+
			"*Tipe Bayar:* %s\n"+
			"*Total Tagihan:* Rp %s\n\n"+
			"Silakan cek panel admin untuk memverifikasi pembayaran.",
		booking.Code,
		booking.FullName,
		booking.CampusName,
		booking.WhatsApp,
		packageName,
		booking.SessionDate,
		booking.SessionHour,
		booking.SessionLocation,
		paymentTypeLabel,
		formatRupiah(booking.AmountDue),
	)

	payload := map[string]interface{}{
		"chat_id":    chatID,
		"text":       message,
		"parse_mode": "Markdown",
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal telegram payload: %v\n", err)
		return
	}

	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonPayload))
	if err != nil {
		log.Printf("Failed to send telegram message: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Telegram API returned non-OK status: %d\n", resp.StatusCode)
	} else {
		log.Println("Telegram notification sent for booking:", booking.Code)
	}
}

func formatRupiah(amount int64) string {
	s := fmt.Sprintf("%d", amount)
	n := len(s)
	result := ""
	for i, ch := range s {
		if i > 0 && (n-i)%3 == 0 {
			result += "."
		}
		result += string(ch)
	}
	return result
}
