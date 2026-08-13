package models

import (
	"time"
)

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Email        string    `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"not null" json:"-"`
	FullName     string    `json:"full_name"`
	StudioName   string    `json:"studio_name"`
	Role         string    `gorm:"default:'photographer'" json:"role"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type Gallery struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	Slug            string         `gorm:"uniqueIndex;not null" json:"slug"`
	PhotographerID  uint           `gorm:"not null" json:"photographer_id"`
	DriveFolderID   string         `gorm:"not null" json:"drive_folder_id"`
	Title           string         `gorm:"not null" json:"title"`
	ClientName      string         `json:"client_name"`
	ClientEmail     string         `json:"client_email"`
	MaxSelection    int            `gorm:"default:0" json:"max_selection"` // 0 = unlimited
	Status          string         `gorm:"default:'active'" json:"status"` // active, submitted, archived
	Photos          []Photo        `gorm:"foreignKey:GalleryID" json:"photos,omitempty"`
	Selection       *Selection     `gorm:"foreignKey:GalleryID" json:"selection,omitempty"`
	CreatedAt       time.Time      `json:"created_at"`
	ExpiresAt       *time.Time     `json:"expires_at,omitempty"`
}

type Photo struct {
	ID           uint   `gorm:"primaryKey" json:"id"`
	GalleryID    uint   `gorm:"index" json:"gallery_id"`
	DriveFileID  string `gorm:"not null" json:"drive_file_id"`
	FileName     string `gorm:"not null" json:"file_name"`
	MimeType     string `json:"mime_type"`
	ThumbnailURL string `json:"thumbnail_url"`
	ViewURL      string `json:"view_url"`
	Width        int    `json:"width,omitempty"`
	Height       int    `json:"height,omitempty"`
}

type Selection struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	GalleryID      uint      `gorm:"uniqueIndex;not null" json:"gallery_id"`
	SelectedFiles  string    `gorm:"type:text" json:"selected_files"` // JSON string array of file names or Drive IDs
	TotalSelected  int       `json:"total_selected"`
	ClientNotes    string    `json:"client_notes"`
	SubmittedAt    time.Time `json:"submitted_at"`
}

type DriveFolderParseRequest struct {
	DriveURL string `json:"drive_url" binding:"required"`
}

type CreateGalleryRequest struct {
	Title         string `json:"title" binding:"required"`
	DriveURL      string `json:"drive_url" binding:"required"`
	ClientName    string `json:"client_name"`
	ClientEmail   string `json:"client_email"`
	MaxSelection  int    `json:"max_selection"`
}

type SubmitSelectionRequest struct {
	SelectedFiles []string `json:"selected_files" binding:"required"`
	ClientNotes   string   `json:"client_notes"`
}
