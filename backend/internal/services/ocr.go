package services

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// DetectNominalFromReceipt attempts to read the transfer receipt image using Gemini Vision API
// or Google Vision API if configured. It returns a formatted alert/notice string if a discrepancy is detected.
func DetectNominalFromReceipt(imagePath string, expectedAmount int64) string {
	apiKey := strings.TrimSpace(os.Getenv("GEMINI_API_KEY"))
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GOOGLE_VISION_API_KEY"))
	}
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("GOOGLE_DRIVE_API_KEY"))
	}
	if apiKey == "" {
		return ""
	}

	imgData, err := os.ReadFile(imagePath)
	if err != nil {
		log.Printf("Failed to read image for OCR: %v\n", err)
		return ""
	}

	mimeType := "image/jpeg"
	ext := strings.ToLower(filepath.Ext(imagePath))
	if ext == ".png" {
		mimeType = "image/png"
	}

	detectedAmount := callGeminiVisionForAmount(imgData, mimeType, apiKey)
	if detectedAmount <= 0 {
		return ""
	}

	if detectedAmount != expectedAmount {
		return fmt.Sprintf(
			"\n\n🚨 <b>PERINGATAN BUKTI TRANSFER</b> 🚨\n"+
				"⚠️ <b>Hasil Deteksi Foto:</b> Terdeteksi <b>Rp %s</b> (Form DP diisi: Rp %s)\n"+
				"📌 <b>Keterangan:</b> Nominal transfer pada foto bukti <b>TIDAK SESUAI</b> dengan nominal DP yang diisi klien! Silakan periksa foto secara manual.",
			formatRupiah(detectedAmount),
			formatRupiah(expectedAmount),
		)
	}

	return fmt.Sprintf(
		"\n\n✅ <b>Hasil Deteksi Foto:</b> Nominal terdeteksi <b>Rp %s</b> (SESUAI dengan input DP).",
		formatRupiah(detectedAmount),
	)
}

func callGeminiVisionForAmount(imgBytes []byte, mimeType string, apiKey string) int64 {
	encodedImg := base64.StdEncoding.EncodeToString(imgBytes)

	promptText := "Analisis foto bukti transfer / struk pembayaran ini. Cari dan ekstrak nominal angka total yang di-transfer (jumlah uang dalam Rupiah). Jawab HANYA angka integer saja tanpa titik, koma, huruf, atau simbol lain (contoh: 50000 atau 250000). Jika tidak yakin atau tidak ada angka nominal transfer, jawab 0."

	requestBody := map[string]interface{}{
		"contents": []interface{}{
			map[string]interface{}{
				"parts": []interface{}{
					map[string]interface{}{
						"text": promptText,
					},
					map[string]interface{}{
						"inline_data": map[string]interface{}{
							"mime_type": mimeType,
							"data":      encodedImg,
						},
					},
				},
			},
		},
	}

	jsonPayload, err := json.Marshal(requestBody)
	if err != nil {
		return 0
	}

	url := "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return 0
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 15 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return 0
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&geminiResp); err != nil {
		return 0
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return 0
	}

	rawText := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
	re := regexp.MustCompile(`\d+`)
	matches := re.FindAllString(rawText, -1)
	if len(matches) == 0 {
		return 0
	}

	val, err := strconv.ParseInt(matches[0], 10, 64)
	if err != nil {
		return 0
	}
	return val
}
