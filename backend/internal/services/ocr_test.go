package services

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDetectNominalFromReceiptFallbackWhenNoAPIKey(t *testing.T) {
	tmpDir := t.TempDir()
	imgPath := filepath.Join(tmpDir, "test_receipt.jpg")
	if err := os.WriteFile(imgPath, []byte("fake image content"), 0644); err != nil {
		t.Fatalf("failed to create dummy file: %v", err)
	}

	t.Setenv("GEMINI_API_KEY", "")
	t.Setenv("GOOGLE_VISION_API_KEY", "")
	t.Setenv("GOOGLE_DRIVE_API_KEY", "")

	result := DetectNominalFromReceipt(imgPath, 50000)
	if result != "" {
		t.Fatalf("expected empty notice when no API key set, got %q", result)
	}
}
