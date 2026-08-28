package services

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"

	"kleiora-backend/internal/models"

	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"
)

type DriveService struct {
	apiKey     string
	endpoint   string
	httpClient *http.Client
}

const maxDrivePhotos = 1000

func NewDriveService(apiKey string) *DriveService {
	return &DriveService{apiKey: apiKey}
}

// ExtractFolderID extracts the Google Drive folder ID from various URL formats
func (s *DriveService) ExtractFolderID(inputURL string) (string, error) {
	inputURL = strings.TrimSpace(inputURL)

	// Direct ID check (alphanumeric with hyphens/underscores, len > 20)
	if match, _ := regexp.MatchString(`^[a-zA-Z0-9_-]{20,}$`, inputURL); match {
		return inputURL, nil
	}

	parsed, err := url.Parse(inputURL)
	if err != nil || (parsed.Hostname() != "drive.google.com" && parsed.Hostname() != "docs.google.com") {
		return "", fmt.Errorf("invalid Google Drive host")
	}

	// Format 1: drive.google.com/drive/folders/FOLDER_ID
	reFolders := regexp.MustCompile(`/folders/([a-zA-Z0-9_-]{20,})`)
	if matches := reFolders.FindStringSubmatch(inputURL); len(matches) > 1 {
		return matches[1], nil
	}

	// Format 2: drive.google.com/open?id=FOLDER_ID or ?id=FOLDER_ID
	reIDParam := regexp.MustCompile(`[?&]id=([a-zA-Z0-9_-]{20,})`)
	if matches := reIDParam.FindStringSubmatch(inputURL); len(matches) > 1 {
		return matches[1], nil
	}

	return "", fmt.Errorf("invalid Google Drive folder URL format")
}

// FetchPhotosFromFolder fetches images inside a public Google Drive folder
func (s *DriveService) FetchPhotosFromFolder(ctx context.Context, folderID string) ([]models.Photo, error) {
	if s.apiKey == "" {
		return nil, fmt.Errorf("GOOGLE_DRIVE_API_KEY is not configured")
	}
	var photos []models.Photo
	clientOptions := []option.ClientOption{option.WithAPIKey(s.apiKey)}
	if s.endpoint != "" {
		clientOptions = append(clientOptions, option.WithEndpoint(s.endpoint))
	}
	if s.httpClient != nil {
		clientOptions = append(clientOptions, option.WithHTTPClient(s.httpClient))
	}
	driveService, err := drive.NewService(ctx, clientOptions...)
	if err != nil {
		return nil, fmt.Errorf("initialize Google Drive client: %w", err)
	}
	query := fmt.Sprintf("'%s' in parents and mimeType contains 'image/' and trashed = false", folderID)
	pageToken := ""
	for len(photos) < maxDrivePhotos {
		remaining := int64(maxDrivePhotos - len(photos))
		call := driveService.Files.List().
			Q(query).
			OrderBy("name_natural").
			Fields("nextPageToken, files(id, name, mimeType, thumbnailLink, webContentLink, imageMediaMetadata)").
			PageSize(remaining)
		if pageToken != "" {
			call = call.PageToken(pageToken)
		}
		res, err := call.Do()
		if err != nil {
			return nil, fmt.Errorf("list Google Drive folder: %w", err)
		}
		for _, f := range res.Files {
			if len(photos) >= maxDrivePhotos {
				break
			}
			// thumbnailLink dari Drive bersifat sementara. URL berbasis file ID
			// tetap stabil selama file dapat diakses secara publik.
			thumbURL := fmt.Sprintf("https://lh3.googleusercontent.com/d/%s=w600", f.Id)
			viewURL := fmt.Sprintf("https://lh3.googleusercontent.com/d/%s=w1600", f.Id)

			width, height := 0, 0
			if f.ImageMediaMetadata != nil {
				width = int(f.ImageMediaMetadata.Width)
				height = int(f.ImageMediaMetadata.Height)
			}

			photos = append(photos, models.Photo{
				DriveFileID:  f.Id,
				FileName:     f.Name,
				MimeType:     f.MimeType,
				ThumbnailURL: thumbURL,
				ViewURL:      viewURL,
				Width:        width,
				Height:       height,
			})
		}
		if res.NextPageToken == "" {
			break
		}
		pageToken = res.NextPageToken
	}
	return photos, nil
}
