package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"testing"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (fn roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return fn(request)
}

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

func TestFetchPhotosPaginatesAndStopsAtOneThousand(t *testing.T) {
	requestCount := 0
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		requestCount++
		pageToken := r.URL.Query().Get("pageToken")
		expectedPageSize := "1000"
		start := 0
		nextToken := "page-2"
		if pageToken == "page-2" {
			expectedPageSize = "400"
			start = 600
			nextToken = "page-3"
		} else if pageToken != "" {
			t.Errorf("unexpected page token %q", pageToken)
		}
		if got := r.URL.Query().Get("pageSize"); got != expectedPageSize {
			t.Errorf("expected pageSize %s, got %s", expectedPageSize, got)
		}
		files := make([]map[string]string, 600)
		for i := range files {
			id := start + i
			files[i] = map[string]string{"id": fmt.Sprintf("file-%04d", id), "name": fmt.Sprintf("photo-%04d.jpg", id), "mimeType": "image/jpeg"}
		}
		var body bytes.Buffer
		if err := json.NewEncoder(&body).Encode(map[string]any{"files": files, "nextPageToken": nextToken}); err != nil {
			return nil, err
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Status:     "200 OK",
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(bytes.NewReader(body.Bytes())),
			Request:    r,
		}, nil
	})}

	service := NewDriveService("test-api-key")
	service.endpoint = "https://drive.test/drive/v3/"
	service.httpClient = client
	photos, err := service.FetchPhotosFromFolder(context.Background(), "folder-12345678901234567890")
	if err != nil {
		t.Fatal(err)
	}
	if len(photos) != maxDrivePhotos {
		t.Fatalf("expected %d photos, got %d", maxDrivePhotos, len(photos))
	}
	if requestCount != 2 {
		t.Fatalf("expected 2 Drive pages, got %d", requestCount)
	}
	if photos[999].DriveFileID != "file-0999" {
		t.Fatalf("unexpected last photo id %s", photos[999].DriveFileID)
	}
}
