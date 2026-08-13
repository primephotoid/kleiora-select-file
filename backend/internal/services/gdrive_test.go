package services

import "testing"

func TestExtractFolderID(t *testing.T) {
	service := NewDriveService("")
	id := "1AbCdEfGhIjKlMnOpQrStUvWxYz"
	tests := []string{
		id,
		"https://drive.google.com/drive/folders/" + id + "?usp=sharing",
		"https://drive.google.com/open?id=" + id,
	}
	for _, input := range tests {
		got, err := service.ExtractFolderID(input)
		if err != nil || got != id {
			t.Fatalf("ExtractFolderID(%q) = %q, %v", input, got, err)
		}
	}
}

func TestExtractFolderIDRejectsInvalidHostAndShortID(t *testing.T) {
	service := NewDriveService("")
	for _, input := range []string{"https://example.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz", "https://drive.google.com/drive/folders/short"} {
		if _, err := service.ExtractFolderID(input); err == nil {
			t.Fatalf("expected %q to be rejected", input)
		}
	}
}
