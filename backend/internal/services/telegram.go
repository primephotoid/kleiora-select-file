package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"kleiora-backend/internal/models"
)

// SendTelegramBookingNotification sends an alert to the Admin's Telegram when a new booking is created.
func SendTelegramBookingNotification(booking models.Booking, packageName string) {
	botToken := strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN"))
	chatID := strings.TrimSpace(os.Getenv("TELEGRAM_CHAT_ID"))

	if botToken == "" || chatID == "" {
		log.Println("Telegram credentials not configured. Skipping notification.")
		return
	}

	url := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)

	paymentTypeLabel := "Full Payment (Lunas)"
	if booking.PaymentType == "dp" {
		paymentTypeLabel = "Down Payment (Setengah Harga)"
	} else if booking.PaymentType == "dp_custom" {
		paymentTypeLabel = "Down Payment (Nominal Custom)"
	}

	notes := booking.Notes
	if notes == "" {
		notes = "-"
	}

	sessionDateFmt := booking.SessionDate
	parts := strings.Split(booking.SessionDate, "-")
	if len(parts) == 3 {
		sessionDateFmt = fmt.Sprintf("%s/%s/%s", parts[2], parts[1], parts[0])
	}

	message := fmt.Sprintf(
		"● *Booking Baru Diterima!*\n\n"+
			"*Kode:* `%s`\n"+
			"*Klien:* %s\n"+
			"*Kampus:* %s\n"+
			"*WhatsApp:* %s\n"+
			"*Paket:* %s\n"+
			"*Tanggal Foto:* %s\n"+
			"*Jam Sesi:* %s:00 WITA\n"+
			"*Lokasi:* %s\n"+
			"*Tipe Bayar:* %s\n"+
			"*Total Tagihan:* Rp %s\n"+
			"*Catatan:* %s\n\n"+
			"Silakan cek panel admin untuk memverifikasi pembayaran.",
		booking.Code,
		booking.FullName,
		booking.CampusName,
		booking.WhatsApp,
		packageName,
		sessionDateFmt,
		booking.SessionHour,
		booking.SessionLocation,
		paymentTypeLabel,
		formatRupiah(booking.AmountDue),
		notes,
	)

	payload := map[string]interface{}{
		"chat_id": chatID,
		"text":    message,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		log.Printf("Failed to marshal telegram payload: %v\n", err)
		return
	}

	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		log.Printf("Failed to prepare telegram request: %v\n", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
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

// SendTelegramGallerySelectionNotification sends an alert to the Admin's Telegram when a client submits their photo selection.
func SendTelegramGallerySelectionNotification(gallery models.Gallery, selection models.Selection, files []string, whatsapp string) {
	botToken := strings.TrimSpace(os.Getenv("TELEGRAM_BOT_TOKEN"))
	chatID := strings.TrimSpace(os.Getenv("TELEGRAM_CHAT_ID"))

	if botToken == "" || chatID == "" {
		log.Println("Telegram credentials not configured. Skipping notification.")
		return
	}

	waText := whatsapp
	if waText == "" {
		waText = "-"
	}

	messages := buildGallerySelectionMessages(gallery, selection, files, waText)
	endpoint := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", botToken)
	for _, message := range messages {
		if err := postTelegramHTMLMessage(endpoint, chatID, message); err != nil {
			log.Printf("Failed to send gallery selection notification: %v\n", err)
			return
		}
	}
	log.Println("Telegram notification sent for gallery selection:", gallery.Slug)
}

func buildGallerySelectionMessages(gallery models.Gallery, selection models.Selection, files []string, whatsapp string) []string {
	notes := selection.ClientNotes
	if strings.TrimSpace(notes) == "" {
		notes = ""
	}
	
	summary := fmt.Sprintf(
		"● Pilihan Foto Baru Diterima!\n\n"+
			"Klien: %s\n"+
			"WhatsApp: %s\n"+
			"Galeri: %s\n"+
			"Total Dipilih: %d foto\n"+
			"Catatan Klien: %s\n\n"+
			"Daftar File:\n",
		html.EscapeString(gallery.ClientName), html.EscapeString(whatsapp), html.EscapeString(gallery.Title),
		selection.TotalSelected, html.EscapeString(notes),
	)

	const telegramSafeLimit = 3800
	messages := []string{}
	current := summary
	
	for _, fileName := range SortFileNamesNatural(files) {
		label := html.EscapeString(fileName)
		line := fmt.Sprintf("- %s\n", label)
		if len(current)+len(line) > telegramSafeLimit {
			messages = append(messages, current)
			current = ""
		}
		current += line
	}
	
	if current != "" {
		messages = append(messages, current)
	}
	return messages
}

func postTelegramHTMLMessage(endpoint, chatID, message string) error {
	payload := map[string]interface{}{
		"chat_id":                  chatID,
		"text":                     message,
		"parse_mode":               "HTML",
		"disable_web_page_preview": true,
	}
	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshal telegram payload: %w", err)
	}
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return fmt.Errorf("prepare telegram request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 10 * time.Second}).Do(req)
	if err != nil {
		return fmt.Errorf("send telegram request: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("telegram API returned status %d", resp.StatusCode)
	}
	return nil
}
