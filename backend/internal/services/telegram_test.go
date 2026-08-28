package services

import (
	"fmt"
	"strings"
	"testing"

	"kleiora-backend/internal/models"
)

func TestBuildGallerySelectionMessagesAddsNaturallySortedDriveDownloadLinks(t *testing.T) {
	gallery := models.Gallery{
		Title: "Wisuda & Keluarga", ClientName: "Ayu <Admin>", DriveFolderID: "folder-123",
		Photos: []models.Photo{
			{FileName: "photo-10.jpg", DriveFileID: "drive-10"},
			{FileName: "photo-2.jpg", DriveFileID: "drive-2"},
			{FileName: "photo-1.jpg", DriveFileID: "drive-1"},
		},
	}
	selection := models.Selection{TotalSelected: 3, ClientNotes: "Pilih & edit natural"}
	messages := buildGallerySelectionMessages(gallery, selection, []string{"photo-10.jpg", "photo-1.jpg", "photo-2.jpg"}, "081234567890")

	if len(messages) != 2 {
		t.Fatalf("expected summary and download list, got %d messages", len(messages))
	}
	if !strings.Contains(messages[0], "Ayu &lt;Admin&gt;") || !strings.Contains(messages[0], "folder-123") {
		t.Fatalf("summary was not safely formatted: %s", messages[0])
	}
	list := messages[1]
	one, two, ten := strings.Index(list, "photo-1.jpg"), strings.Index(list, "photo-2.jpg"), strings.Index(list, "photo-10.jpg")
	if one < 0 || two <= one || ten <= two {
		t.Fatalf("download list is not naturally ascending: %s", list)
	}
	for _, id := range []string{"drive-1", "drive-2", "drive-10"} {
		if !strings.Contains(list, "export=download&amp;id="+id) {
			t.Fatalf("missing direct download link for %s: %s", id, list)
		}
	}
}

func TestBuildGallerySelectionMessagesStaysBelowTelegramLimit(t *testing.T) {
	gallery := models.Gallery{Title: "Large gallery", ClientName: "Client", DriveFolderID: "folder"}
	files := make([]string, 0, 100)
	for index := 1; index <= 100; index++ {
		name := fmt.Sprintf("graduation-photo-with-a-descriptive-name-%03d.jpg", index)
		files = append(files, name)
		gallery.Photos = append(gallery.Photos, models.Photo{FileName: name, DriveFileID: fmt.Sprintf("drive-file-id-%03d", index)})
	}
	messages := buildGallerySelectionMessages(gallery, models.Selection{TotalSelected: len(files)}, files, "-")
	if len(messages) < 3 {
		t.Fatalf("expected the long file list to be split, got %d messages", len(messages))
	}
	for _, message := range messages {
		if len(message) > 3800 {
			t.Fatalf("message exceeded safe Telegram size: %d", len(message))
		}
	}
}
