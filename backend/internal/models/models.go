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
	ID             uint       `gorm:"primaryKey" json:"id"`
	Slug           string     `gorm:"uniqueIndex;not null" json:"slug"`
	PhotographerID uint       `gorm:"not null" json:"photographer_id"`
	BookingID      *uint      `gorm:"index" json:"booking_id,omitempty"`
	DriveFolderID  string     `gorm:"not null" json:"drive_folder_id"`
	Title          string     `gorm:"not null" json:"title"`
	ClientName     string     `json:"client_name"`
	ClientEmail    string     `json:"client_email"`
	MaxSelection   int        `gorm:"default:0" json:"max_selection"` // 0 = unlimited
	Status         string     `gorm:"default:'active'" json:"status"` // active, submitted, archived
	Photos         []Photo    `gorm:"foreignKey:GalleryID" json:"photos,omitempty"`
	Selection      *Selection `gorm:"foreignKey:GalleryID" json:"selection,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
}

type Package struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	Code           string    `gorm:"uniqueIndex;not null" json:"code"`
	Name           string    `gorm:"not null" json:"name"`
	Description    string    `json:"description"`
	Price          int64     `gorm:"not null" json:"price"`
	DurationHours  int       `gorm:"not null;default:1" json:"duration_hours"`
	DurationLabel  string    `json:"duration_label,omitempty"`
	LocationCount  int       `gorm:"not null;default:1" json:"location_count"`
	EditedPhotos   int       `gorm:"not null;default:20" json:"edited_photos"`
	IncludesPrint  string    `json:"includes_print,omitempty"`
	IncludesTeaser bool      `json:"includes_teaser"`
	ImagePath      string    `json:"image_path"`
	IsActive       bool      `gorm:"not null;default:true" json:"is_active"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type Portfolio struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Title     string    `json:"title"`
	ImagePath string    `gorm:"not null" json:"image_path"`
	IsActive  bool      `gorm:"not null;default:true" json:"is_active"`
	SortOrder int       `gorm:"not null;default:0" json:"sort_order"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Review struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	ClientName string    `gorm:"not null" json:"client_name"`
	Rating     int       `gorm:"not null" json:"rating"` // 1-5
	Comment    string    `gorm:"type:text;not null" json:"comment"`
	IsApproved bool      `gorm:"not null;default:false" json:"is_approved"`
	CreatedAt  time.Time `json:"created_at"`
}

type Booking struct {
	ID               uint       `gorm:"primaryKey" json:"id"`
	Code             string     `gorm:"uniqueIndex;not null" json:"code"`
	PackageID        uint       `gorm:"not null;index" json:"package_id"`
	Package          Package    `json:"package"`
	FullName         string     `gorm:"not null" json:"full_name"`
	CampusName       string     `gorm:"not null" json:"campus_name"`
	WhatsApp         string     `gorm:"not null" json:"whatsapp"`
	SessionDate      string     `gorm:"not null;index:idx_booking_slot" json:"session_date"`
	SessionHour      string     `gorm:"not null;index:idx_booking_slot" json:"session_hour"`
	SessionLocation  string     `gorm:"not null" json:"session_location"`
	PaymentType      string     `gorm:"not null;default:'full'" json:"payment_type"`
	AmountDue        int64      `gorm:"not null" json:"amount_due"`
	PaymentMethod    string     `json:"payment_method,omitempty"`
	PaymentProofPath string     `json:"-"`
	PaymentStatus    string     `gorm:"not null;default:'pending'" json:"payment_status"`
	Status           string     `gorm:"not null;default:'pending_payment';index" json:"status"`
	Notes            string     `json:"notes,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	VerifiedAt       *time.Time `json:"verified_at,omitempty"`
	Gallery          *Gallery   `gorm:"foreignKey:BookingID" json:"gallery,omitempty"`
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
	ID            uint      `gorm:"primaryKey" json:"id"`
	GalleryID     uint      `gorm:"uniqueIndex;not null" json:"gallery_id"`
	SelectedFiles string    `gorm:"type:text" json:"selected_files"` // JSON string array of file names or Drive IDs
	TotalSelected int       `json:"total_selected"`
	ClientNotes   string    `json:"client_notes"`
	SubmittedAt   time.Time `json:"submitted_at"`
}

type DriveFolderParseRequest struct {
	DriveURL string `json:"drive_url" binding:"required"`
}

type CreateGalleryRequest struct {
	Title        string `json:"title" binding:"required"`
	DriveURL     string `json:"drive_url" binding:"required"`
	ClientName   string `json:"client_name"`
	ClientEmail  string `json:"client_email"`
	MaxSelection int    `json:"max_selection"`
	BookingID    *uint  `json:"booking_id"`
}

type SubmitSelectionRequest struct {
	SelectedFiles []string `json:"selected_files" binding:"required"`
	ClientNotes   string   `json:"client_notes"`
}

type CreateBookingRequest struct {
	PackageCode     string `json:"package_code"`
	FullName        string `json:"full_name"`
	CampusName      string `json:"campus_name"`
	WhatsApp        string `json:"whatsapp"`
	SessionDate     string `json:"session_date"`
	SessionHour     string `json:"session_hour"`
	SessionLocation string `json:"session_location"`
	PaymentType     string `json:"payment_type"`
	CustomDPAmount  int64  `json:"custom_dp_amount"`
	Notes           string `json:"notes"`
}
