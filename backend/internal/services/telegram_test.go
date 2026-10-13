package services

import (
	"fmt"
	"strings"
	"testing"

	"kleiora-backend/internal/models"
)

func TestBuildGallerySelectionMessagesFormatsProperlyAndNaturallySorts(t *testing.T) {
	gallery := models.Gallery{
		Title: "Wisuda & Keluarga", ClientName: "Ayu <Admin>", DriveFolderID: "folder-123",
	}
	selection := models.Selection{TotalSelected: 3, ClientNotes: "Pilih & edit natural"}
	messages := buildGallerySelectionMessages(gallery, selection, []string{"photo-10.jpg", "photo-1.jpg", "photo-2.jpg"}, "081234567890")

	if len(messages) != 1 {
		t.Fatalf("expected 1 message, got %d messages", len(messages))
	}
	list := messages[0]
	if !strings.Contains(list, "Ayu &lt;Admin&gt;") {
		t.Fatalf("summary was not safely formatted: %s", list)
	}
	if !strings.Contains(list, "🖼️") {
		t.Fatalf("missing emoji: %s", list)
	}
	one, two, ten := strings.Index(list, "photo-1.jpg"), strings.Index(list, "photo-2.jpg"), strings.Index(list, "photo-10.jpg")
	if one < 0 || two <= one || ten <= two {
		t.Fatalf("download list is not naturally ascending: %s", list)
	}
}

func TestBuildGallerySelectionMessagesStaysBelowTelegramLimit(t *testing.T) {
	gallery := models.Gallery{Title: "Large gallery", ClientName: "Client", DriveFolderID: "folder"}
	files := make([]string, 0, 100)
	for index := 1; index <= 100; index++ {
		name := fmt.Sprintf("graduation-photo-with-a-descriptive-name-%03d.jpg", index)
		files = append(files, name)
	}
	messages := buildGallerySelectionMessages(gallery, models.Selection{TotalSelected: len(files)}, files, "-")
	if len(messages) < 2 {
		t.Fatalf("expected the long file list to be split, got %d messages", len(messages))
	}
	for _, message := range messages {
		if len(message) > 3800 {
			t.Fatalf("message exceeded safe Telegram size: %d", len(message))
		}
	}
}

func TestFormatRupiah(t *testing.T) {
	cases := []struct {
		input    int64
		expected string
	}{
		{0, "0"},
		{500, "500"},
		{1000, "1.000"},
		{50000, "50.000"},
		{500000, "500.000"},
		{1250000, "1.250.000"},
		{10000000, "10.000.000"},
		{-50000, "-50.000"},
	}
	for _, c := range cases {
		if got := formatRupiah(c.input); got != c.expected {
			t.Errorf("formatRupiah(%d) = %q; want %q", c.input, got, c.expected)
		}
	}
}
