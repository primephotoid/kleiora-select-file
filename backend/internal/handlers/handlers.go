package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"log"
	"net/mail"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"kleiora-backend/internal/config"
	"kleiora-backend/internal/models"
	"kleiora-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

const slotCapacity int64 = 2

var (
	hourPattern     = regexp.MustCompile(`^(0[6-9]|1[0-9])$`)
	whatsAppPattern = regexp.MustCompile(`^[0-9+][0-9 -]{7,19}$`)
)

type Handler struct {
	db           *gorm.DB
	cfg          *config.Config
	driveService *services.DriveService
}

func NewHandler(db *gorm.DB, cfg *config.Config, driveService *services.DriveService) *Handler {
	return &Handler{db: db, cfg: cfg, driveService: driveService}
}

func randomToken(bytes int) (string, error) {
	b := make([]byte, bytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func generateBookingCode(db *gorm.DB, sessionDate string, packageCode string) (string, error) {
	parts := strings.Split(sessionDate, "-")
	dateStr := "000000"
	if len(parts) == 3 {
		year := parts[0]
		if len(year) == 4 {
			year = year[2:]
		}
		dateStr = parts[2] + parts[1] + year
	}

	prefix := "PKG"
	lowerCode := strings.ToLower(packageCode)
	if strings.Contains(lowerCode, "personal") {
		prefix = "PRSNL"
	} else if strings.Contains(lowerCode, "couple") {
		prefix = "CPL"
	} else if strings.Contains(lowerCode, "group") {
		prefix = "GRP"
	}

	var lastBooking models.Booking
	var seq int64 = 1

	if err := db.Model(&models.Booking{}).Where("session_date = ?", sessionDate).Order("id DESC").First(&lastBooking).Error; err != nil {
		if err != gorm.ErrRecordNotFound {
			return "", err
		}
	} else {
		// Example Code: KLR-PRSNL-160826-003
		partsCode := strings.Split(lastBooking.Code, "-")
		if len(partsCode) >= 4 {
			if lastSeq, err := strconv.ParseInt(partsCode[3], 10, 64); err == nil {
				seq = lastSeq + 1
			}
		}
	}

	code := fmt.Sprintf("KLR-%s-%s-%03d", prefix, dateStr, seq)
	return code, nil
}

func apiError(c *fiber.Ctx, status int, message string) error {
	return c.Status(status).JSON(fiber.Map{"error": message})
}

func (h *Handler) authenticate(c *fiber.Ctx) error {
	header := c.Get(fiber.HeaderAuthorization)
	rawToken := ""
	if strings.HasPrefix(header, "Bearer ") {
		rawToken = strings.TrimPrefix(header, "Bearer ")
	} else {
		rawToken = c.Cookies("kleiora_token")
	}
	if rawToken == "" {
		return apiError(c, fiber.StatusUnauthorized, "Authentication required")
	}

	token, err := jwt.Parse(rawToken, func(token *jwt.Token) (any, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(h.cfg.JWTSecret), nil
	})
	if err != nil || !token.Valid {
		return apiError(c, fiber.StatusUnauthorized, "Invalid or expired token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return apiError(c, fiber.StatusUnauthorized, "Invalid token claims")
	}
	userID, err := claims.GetSubject()
	if err != nil || userID == "" {
		return apiError(c, fiber.StatusUnauthorized, "Invalid token subject")
	}
	c.Locals("user_id", userID)
	return nil
}

func (h *Handler) AuthRequired(c *fiber.Ctx) error {
	if err := h.authenticate(c); err != nil {
		return err
	}
	return c.Next()
}

func (h *Handler) AdminRequired(c *fiber.Ctx) error {
	if err := h.authenticate(c); err != nil {
		return err
	}
	var user models.User
	if err := h.db.Select("id", "role").First(&user, c.Locals("user_id")).Error; err != nil {
		return apiError(c, fiber.StatusUnauthorized, "Akun tidak ditemukan")
	}
	if user.Role != "admin" {
		return apiError(c, fiber.StatusForbidden, "Akses hanya tersedia untuk admin")
	}
	return c.Next()
}

func (h *Handler) Register(c *fiber.Ctx) error {
	var userCount int64
	if err := h.db.Model(&models.User{}).Count(&userCount).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to check studio setup")
	}
	if userCount > 0 {
		return apiError(c, fiber.StatusForbidden, "Studio account has already been initialized")
	}
	var req struct {
		Email      string `json:"email"`
		Password   string `json:"password"`
		FullName   string `json:"full_name"`
		StudioName string `json:"studio_name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return apiError(c, fiber.StatusBadRequest, "Invalid request body")
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))
	if _, err := mail.ParseAddress(req.Email); err != nil || len(req.Password) < 8 {
		return apiError(c, fiber.StatusBadRequest, "Use a valid email and a password of at least 8 characters")
	}
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to secure password")
	}
	user := models.User{Email: req.Email, PasswordHash: string(hashedPassword), FullName: strings.TrimSpace(req.FullName), StudioName: strings.TrimSpace(req.StudioName), Role: "photographer"}
	if err := h.db.Create(&user).Error; err != nil {
		return apiError(c, fiber.StatusConflict, "Email already registered")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "User registered successfully", "user": user})
}

func (h *Handler) Login(c *fiber.Ctx) error {
	var req struct{ Email, Password string }
	if err := c.BodyParser(&req); err != nil || req.Email == "" || req.Password == "" {
		return apiError(c, fiber.StatusBadRequest, "Email and password are required")
	}
	var user models.User
	if err := h.db.Where("email = ?", strings.ToLower(strings.TrimSpace(req.Email))).First(&user).Error; err != nil || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)) != nil {
		return apiError(c, fiber.StatusUnauthorized, "Invalid email or password")
	}
	now := time.Now()
	claims := jwt.RegisteredClaims{Subject: fmt.Sprint(user.ID), IssuedAt: jwt.NewNumericDate(now), ExpiresAt: jwt.NewNumericDate(now.Add(24 * time.Hour)), Issuer: "kleiora-api"}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(h.cfg.JWTSecret))
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to generate token")
	}
	c.Cookie(&fiber.Cookie{Name: "kleiora_token", Value: token, Path: "/", HTTPOnly: true, Secure: h.cfg.Environment == "production", SameSite: "Lax", Expires: now.Add(24 * time.Hour)})
	return c.JSON(fiber.Map{"token": token, "user": user})
}

func (h *Handler) Logout(c *fiber.Ctx) error {
	c.Cookie(&fiber.Cookie{Name: "kleiora_token", Value: "", Path: "/", HTTPOnly: true, Secure: h.cfg.Environment == "production", SameSite: "Lax", Expires: time.Unix(0, 0)})
	return c.JSON(fiber.Map{"message": "Berhasil keluar"})
}

func (h *Handler) ListPackages(c *fiber.Ctx) error {
	var packages []models.Package
	if err := h.db.Where("is_active = ?", true).Order("price asc").Find(&packages).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to load packages")
	}
	return c.JSON(fiber.Map{"packages": packages})
}

func makassarToday() time.Time {
	loc, err := time.LoadLocation("Asia/Makassar")
	if err != nil {
		loc = time.FixedZone("WITA", 8*60*60)
	}
	now := time.Now().In(loc)
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
}

func validSessionDate(value string) bool {
	date, err := time.Parse("2006-01-02", value)
	if err != nil {
		return false
	}
	today := makassarToday()
	return !date.Before(time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, time.UTC))
}

func (h *Handler) GetAvailability(c *fiber.Ctx) error {
	date := c.Query("date")
	if !validSessionDate(date) {
		return apiError(c, fiber.StatusBadRequest, "Pilih tanggal hari ini atau setelahnya")
	}
	type slot struct {
		Hour      string `json:"hour"`
		Remaining int64  `json:"remaining"`
		Available bool   `json:"available"`
	}
	slots := make([]slot, 0, 14)
	for hour := 6; hour <= 19; hour++ {
		hourValue := fmt.Sprintf("%02d", hour)
		var count int64
		h.db.Model(&models.Booking{}).Where("session_date = ? AND session_hour = ? AND status <> ?", date, hourValue, "cancelled").Count(&count)
		remaining := slotCapacity - count
		if remaining < 0 {
			remaining = 0
		}
		slots = append(slots, slot{Hour: hourValue, Remaining: remaining, Available: remaining > 0})
	}
	return c.JSON(fiber.Map{"date": date, "timezone": "WITA", "capacity_per_slot": slotCapacity, "slots": slots})
}

func (h *Handler) CreateBooking(c *fiber.Ctx) error {
	var req models.CreateBookingRequest
	if err := c.BodyParser(&req); err != nil {
		return apiError(c, fiber.StatusBadRequest, "Data booking tidak dapat dibaca")
	}
	req.PackageCode = strings.ToLower(strings.TrimSpace(req.PackageCode))
	req.FullName = strings.TrimSpace(req.FullName)
	req.CampusName = strings.TrimSpace(req.CampusName)
	req.WhatsApp = strings.TrimSpace(req.WhatsApp)
	req.SessionLocation = strings.TrimSpace(req.SessionLocation)
	if req.PaymentType == "" {
		req.PaymentType = "full"
	}
	if req.FullName == "" || req.CampusName == "" || req.SessionLocation == "" {
		return apiError(c, fiber.StatusBadRequest, "Lengkapi nama, kampus, dan lokasi sesi")
	}
	if !whatsAppPattern.MatchString(req.WhatsApp) {
		return apiError(c, fiber.StatusBadRequest, "Nomor WhatsApp tidak valid; gunakan minimal 8 digit, misalnya 081234567890")
	}
	if !validSessionDate(req.SessionDate) {
		return apiError(c, fiber.StatusBadRequest, "Tanggal sesi tidak valid atau sudah lewat")
	}
	if !hourPattern.MatchString(req.SessionHour) {
		return apiError(c, fiber.StatusBadRequest, "Pilih jam sesi yang valid")
	}
	if req.PaymentType != "full" && req.PaymentType != "dp" && req.PaymentType != "dp_custom" {
		return apiError(c, fiber.StatusBadRequest, "Pilihan pembayaran tidak valid")
	}
	var pkg models.Package
	if err := h.db.Where("code = ? AND is_active = ?", req.PackageCode, true).First(&pkg).Error; err != nil {
		return apiError(c, fiber.StatusBadRequest, "Paket yang dipilih tidak tersedia")
	}
	code, err := generateBookingCode(h.db, req.SessionDate, req.PackageCode)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to generate booking code")
	}
	amount := pkg.Price
	if req.PaymentType == "dp" {
		amount /= 2
	} else if req.PaymentType == "dp_custom" {
		if req.CustomDPAmount < 50000 {
			return apiError(c, fiber.StatusBadRequest, "Nominal DP custom minimal Rp50.000")
		}
		if req.CustomDPAmount > pkg.Price {
			return apiError(c, fiber.StatusBadRequest, "Nominal DP custom tidak boleh melebihi harga paket")
		}
		amount = req.CustomDPAmount
	}
	booking := models.Booking{Code: strings.ToUpper(code), PackageID: pkg.ID, FullName: req.FullName, CampusName: req.CampusName, WhatsApp: req.WhatsApp, SessionDate: req.SessionDate, SessionHour: req.SessionHour, SessionLocation: req.SessionLocation, PaymentType: req.PaymentType, AmountDue: amount, PaymentStatus: "pending", Status: "pending_payment", Notes: strings.TrimSpace(req.Notes)}
	err = h.db.Transaction(func(tx *gorm.DB) error {
		var count int64
		if err := tx.Model(&models.Booking{}).Where("session_date = ? AND session_hour = ? AND status <> ?", req.SessionDate, req.SessionHour, "cancelled").Count(&count).Error; err != nil {
			return err
		}
		if count >= slotCapacity {
			return errors.New("slot_full")
		}
		return tx.Create(&booking).Error
	})
	if err != nil {
		if err.Error() == "slot_full" {
			return apiError(c, fiber.StatusConflict, "Jadwal sesi yang dipilih sudah penuh")
		}
		return apiError(c, fiber.StatusInternalServerError, "Failed to create booking")
	}
	h.db.Preload("Package").First(&booking, booking.ID)
	go services.SendTelegramBookingNotification(booking, booking.Package.Name)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"message": "Booking created; payment verification is pending", "booking": booking})
}

func (h *Handler) GetBooking(c *fiber.Ctx) error {
	var booking models.Booking
	if err := h.db.Preload("Package").Preload("Gallery").Where("code = ?", strings.ToUpper(c.Params("code"))).First(&booking).Error; err != nil {
		return apiError(c, fiber.StatusNotFound, "Booking not found")
	}
	return c.JSON(booking)
}

func (h *Handler) UploadPaymentProof(c *fiber.Ctx) error {
	var booking models.Booking
	if err := h.db.Where("code = ?", strings.ToUpper(c.Params("code"))).First(&booking).Error; err != nil {
		return apiError(c, fiber.StatusNotFound, "Booking not found")
	}
	file, err := c.FormFile("proof")
	if err != nil || file.Size > 5*1024*1024 {
		return apiError(c, fiber.StatusBadRequest, "A JPG or PNG payment proof up to 5 MB is required")
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" {
		return apiError(c, fiber.StatusBadRequest, "Only JPG and PNG payment proofs are accepted")
	}
	opened, err := file.Open()
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "Payment proof cannot be read")
	}
	_, format, decodeErr := image.DecodeConfig(opened)
	_ = opened.Close()
	if decodeErr != nil || (format != "jpeg" && format != "png") {
		return apiError(c, fiber.StatusBadRequest, "Payment proof is not a valid JPG or PNG image")
	}
	name, err := randomToken(16)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to store payment proof")
	}
	if err := os.MkdirAll(h.cfg.UploadDir, 0o750); err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to prepare upload storage")
	}
	path := filepath.Join(h.cfg.UploadDir, name+ext)
	if err := c.SaveFile(file, path); err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to store payment proof")
	}
	method := strings.TrimSpace(c.FormValue("payment_method"))
	if err := h.db.Model(&booking).Updates(map[string]any{"payment_proof_path": path, "payment_method": method, "payment_status": "submitted"}).Error; err != nil {
		_ = os.Remove(path)
		return apiError(c, fiber.StatusInternalServerError, "Failed to update payment status")
	}
	return c.JSON(fiber.Map{"message": "Payment proof submitted for admin verification", "payment_status": "submitted"})
}

func (h *Handler) ListBookings(c *fiber.Ctx) error {
	var bookings []models.Booking
	query := h.db.Preload("Package").Preload("Gallery").Preload("Gallery.Selection").Order("created_at desc")
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if err := query.Find(&bookings).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to load bookings")
	}

	for i := range bookings {
		b := &bookings[i]

		var gal models.Gallery
		if err := h.db.Preload("Selection").Where("booking_id = ? OR (client_name != '' AND (LOWER(client_name) = LOWER(?) OR LOWER(?) LIKE LOWER(CONCAT('%', client_name, '%')))) OR (title != '' AND LOWER(title) LIKE LOWER(CONCAT('%', ?, '%')))", b.ID, b.FullName, b.FullName, b.FullName).Order("created_at desc").First(&gal).Error; err == nil {
			b.Gallery = &gal
			if gal.BookingID == nil {
				h.db.Model(&gal).Update("booking_id", b.ID)
			}
		}

		if (b.Gallery != nil && (b.Gallery.Status == "submitted" || b.Gallery.Selection != nil)) || b.Status == "completed" {
			b.Status = "completed"
			b.PaymentStatus = "verified"
			h.db.Model(&models.Booking{}).Where("id = ?", b.ID).Updates(map[string]any{
				"status":         "completed",
				"payment_status": "verified",
			})
		}
	}

	return c.JSON(fiber.Map{"bookings": bookings})
}

func (h *Handler) CompleteBooking(c *fiber.Ctx) error {
	var booking models.Booking
	if err := h.db.Where("code = ?", strings.ToUpper(c.Params("code"))).First(&booking).Error; err != nil {
		return apiError(c, fiber.StatusNotFound, "Booking tidak ditemukan")
	}
	if err := h.db.Model(&booking).Updates(map[string]any{"status": "completed", "payment_status": "verified"}).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Gagal memperbarui status booking")
	}
	return c.JSON(fiber.Map{"message": "Booking berhasil ditandai selesai", "booking": booking})
}

func (h *Handler) VerifyBookingPayment(c *fiber.Ctx) error {
	var booking models.Booking
	if err := h.db.Where("code = ?", strings.ToUpper(c.Params("code"))).First(&booking).Error; err != nil {
		return apiError(c, fiber.StatusNotFound, "Booking not found")
	}
	now := time.Now()
	if err := h.db.Model(&booking).Updates(map[string]any{"payment_status": "verified", "status": "confirmed", "verified_at": &now}).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to verify payment")
	}
	return c.JSON(fiber.Map{"message": "Payment verified and booking confirmed"})
}

func (h *Handler) ViewPaymentProof(c *fiber.Ctx) error {
	var booking models.Booking
	if err := h.db.Where("code = ?", strings.ToUpper(c.Params("code"))).First(&booking).Error; err != nil {
		return apiError(c, fiber.StatusNotFound, "Booking tidak ditemukan")
	}
	if booking.PaymentProofPath == "" {
		return apiError(c, fiber.StatusNotFound, "Bukti pembayaran belum dikirim")
	}
	absolutePath, err := filepath.Abs(booking.PaymentProofPath)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Bukti pembayaran tidak dapat dibuka")
	}
	if _, err := os.Stat(absolutePath); err != nil {
		return apiError(c, fiber.StatusNotFound, "File bukti pembayaran tidak ditemukan")
	}
	return c.SendFile(absolutePath)
}


func (h *Handler) DemoParseDrive(c *fiber.Ctx) error {
	var req models.DriveFolderParseRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.DriveURL) == "" {
		return apiError(c, fiber.StatusBadRequest, "Drive URL is required")
	}
	folderID, err := h.driveService.ExtractFolderID(req.DriveURL)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "Invalid Google Drive folder link format")
	}
	photos, err := h.driveService.FetchPhotosFromFolder(c.UserContext(), folderID)
	if err != nil {
		return apiError(c, fiber.StatusBadGateway, "Failed to fetch photos from Google Drive")
	}
	return c.JSON(fiber.Map{"folder_id": folderID, "total_photos": len(photos), "photos": photos})
}

func (h *Handler) CreateGallery(c *fiber.Ctx) error {
	var req models.CreateGalleryRequest
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Title) == "" {
		return apiError(c, fiber.StatusBadRequest, "Title and Drive URL are required")
	}
	folderID, err := h.driveService.ExtractFolderID(req.DriveURL)
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "Invalid Drive URL")
	}
	photos, err := h.driveService.FetchPhotosFromFolder(c.UserContext(), folderID)
	if err != nil {
		return apiError(c, fiber.StatusBadGateway, "Failed to load photos from Drive")
	}
	userID := c.Locals("user_id").(string)
	var photographerID uint
	if _, err := fmt.Sscan(userID, &photographerID); err != nil {
		return apiError(c, fiber.StatusUnauthorized, "Invalid user")
	}
	if req.BookingID != nil {
		var booking models.Booking
		if err := h.db.Preload("Package").First(&booking, *req.BookingID).Error; err != nil {
			return apiError(c, fiber.StatusBadRequest, "Booking not found")
		}
		if req.MaxSelection == 0 {
			req.MaxSelection = booking.Package.EditedPhotos
		}
	}
	slug, err := randomToken(12)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to create gallery link")
	}
	gallery := models.Gallery{Slug: slug, PhotographerID: photographerID, BookingID: req.BookingID, DriveFolderID: folderID, Title: strings.TrimSpace(req.Title), ClientName: strings.TrimSpace(req.ClientName), ClientEmail: strings.TrimSpace(req.ClientEmail), MaxSelection: req.MaxSelection, Status: "active", Photos: photos}
	if err := h.db.Create(&gallery).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to save gallery")
	}
	return c.Status(fiber.StatusCreated).JSON(gallery)
}

func (h *Handler) ListGalleries(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	var galleries []models.Gallery
	if err := h.db.Preload("Photos").Preload("Selection").Where("photographer_id = ?", userID).Order("created_at desc").Find(&galleries).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to load galleries")
	}
	return c.JSON(fiber.Map{"galleries": galleries})
}

func (h *Handler) GetGalleryBySlug(c *fiber.Ctx) error {
	var gallery models.Gallery
	if err := h.db.Preload("Photos").Preload("Selection").Where("slug = ?", c.Params("slug")).First(&gallery).Error; err != nil {
		return apiError(c, fiber.StatusNotFound, "Gallery not found")
	}

	// Start 30-day timer if not started yet
	if gallery.ExpiresAt == nil {
		expiresAt := time.Now().Add(30 * 24 * time.Hour)
		gallery.ExpiresAt = &expiresAt
		h.db.Model(&gallery).Update("expires_at", expiresAt)
	}

	return c.JSON(fiber.Map{"slug": gallery.Slug, "title": gallery.Title, "client_name": gallery.ClientName, "max_selection": gallery.MaxSelection, "status": gallery.Status, "expires_at": gallery.ExpiresAt, "photos": gallery.Photos, "selection": gallery.Selection})
}

func (h *Handler) SubmitSelection(c *fiber.Ctx) error {
	var req models.SubmitSelectionRequest
	if err := c.BodyParser(&req); err != nil || len(req.SelectedFiles) == 0 {
		return apiError(c, fiber.StatusBadRequest, "Select at least one photo")
	}
	var gallery models.Gallery
	if err := h.db.Preload("Photos").Where("slug = ?", c.Params("slug")).First(&gallery).Error; err != nil {
		return apiError(c, fiber.StatusNotFound, "Gallery not found")
	}
	if gallery.Status == "archived" || (gallery.ExpiresAt != nil && gallery.ExpiresAt.Before(time.Now())) {
		return apiError(c, fiber.StatusConflict, "Gallery is no longer accepting selections")
	}
	if gallery.MaxSelection > 0 && len(req.SelectedFiles) > gallery.MaxSelection {
		return apiError(c, fiber.StatusBadRequest, fmt.Sprintf("Maximum selection is %d photos", gallery.MaxSelection))
	}
	allowed := make(map[string]string, len(gallery.Photos)*2)
	for _, photo := range gallery.Photos {
		allowed[photo.DriveFileID] = photo.FileName
		allowed[photo.FileName] = photo.FileName
	}
	seen := make(map[string]bool, len(req.SelectedFiles))
	files := make([]string, 0, len(req.SelectedFiles))
	for _, value := range req.SelectedFiles {
		name, ok := allowed[value]
		if !ok {
			return apiError(c, fiber.StatusBadRequest, "Selection contains a photo outside this gallery")
		}
		if !seen[name] {
			seen[name] = true
			files = append(files, name)
		}
	}
	jsonBytes, err := json.Marshal(files)
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to encode selection")
	}
	selection := models.Selection{GalleryID: gallery.ID, SelectedFiles: string(jsonBytes), TotalSelected: len(files), ClientNotes: strings.TrimSpace(req.ClientNotes), SubmittedAt: time.Now()}
	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("gallery_id = ?", gallery.ID).Assign(selection).FirstOrCreate(&selection).Error; err != nil {
			return err
		}
		// Update status galeri menjadi 'submitted'
		if err := tx.Model(&models.Gallery{}).Where("id = ?", gallery.ID).Update("status", "submitted").Error; err != nil {
			return err
		}

		// Otomatis tandai booking terkait sebagai terverifikasi & selesai
		if gallery.BookingID != nil && *gallery.BookingID > 0 {
			tx.Model(&models.Booking{}).Where("id = ?", *gallery.BookingID).Updates(map[string]interface{}{
				"status":         "completed",
				"payment_status": "verified",
			})
		}
		if gallery.ClientName != "" {
			cName := strings.TrimSpace(gallery.ClientName)
			tx.Model(&models.Booking{}).Where("LOWER(full_name) = LOWER(?) OR LOWER(full_name) LIKE LOWER(?)", cName, "%"+cName+"%").Updates(map[string]interface{}{
				"status":         "completed",
				"payment_status": "verified",
			})
		}
		return nil
	})
	if err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to save selection")
	}

	// Ambil nomor WhatsApp klien untuk notifikasi Telegram
	wa := ""
	var booking models.Booking
	if gallery.BookingID != nil {
		if err := h.db.Where("id = ?", *gallery.BookingID).First(&booking).Error; err == nil && booking.WhatsApp != "" {
			wa = booking.WhatsApp
		}
	}
	if wa == "" && gallery.ClientName != "" {
		if err := h.db.Where("LOWER(full_name) = LOWER(?) OR LOWER(?) LIKE LOWER(CONCAT('%', full_name, '%')) OR LOWER(full_name) LIKE LOWER(CONCAT('%', ?, '%'))", gallery.ClientName, gallery.ClientName, gallery.ClientName).Order("created_at desc").First(&booking).Error; err == nil {
			wa = booking.WhatsApp
		}
	}
	if wa == "" && gallery.Title != "" {
		if err := h.db.Where("LOWER(?) LIKE LOWER(CONCAT('%', full_name, '%'))", gallery.Title).Order("created_at desc").First(&booking).Error; err == nil {
			wa = booking.WhatsApp
		}
	}
	go services.SendTelegramGallerySelectionNotification(gallery, selection, files, wa)

	return c.JSON(fiber.Map{"message": "Selection submitted successfully", "selection": selection})
}

func (h *Handler) ExportSelection(c *fiber.Ctx) error {
	userID := c.Locals("user_id").(string)
	var gallery models.Gallery
	if err := h.db.Preload("Selection").Where("slug = ? AND photographer_id = ?", c.Params("slug"), userID).First(&gallery).Error; err != nil {
		return apiError(c, fiber.StatusNotFound, "Gallery not found")
	}
	if gallery.Selection == nil {
		return apiError(c, fiber.StatusBadRequest, "No selection has been submitted")
	}
	var files []string
	if err := json.Unmarshal([]byte(gallery.Selection.SelectedFiles), &files); err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Stored selection is invalid")
	}
	return c.JSON(fiber.Map{"title": gallery.Title, "client_name": gallery.ClientName, "total_selected": gallery.Selection.TotalSelected, "submitted_at": gallery.Selection.SubmittedAt, "comma_separated": strings.Join(files, ", "), "line_separated": strings.Join(files, "\n"), "file_list": files, "client_notes": gallery.Selection.ClientNotes})
}

func (h *Handler) DeleteGallery(c *fiber.Ctx) error {
	id := c.Params("id")
	// Hapus data anak terlebih dahulu untuk menghindari error foreign key constraint
	h.db.Where("gallery_id = ?", id).Delete(&models.Selection{})
	h.db.Where("gallery_id = ?", id).Delete(&models.Photo{})
	if err := h.db.Unscoped().Where("id = ?", id).Delete(&models.Gallery{}).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to delete gallery")
	}
	return c.JSON(fiber.Map{"message": "Gallery deleted successfully"})
}

func (h *Handler) DeleteBooking(c *fiber.Ctx) error {
	code := strings.ToUpper(strings.TrimSpace(c.Params("code")))

	var booking models.Booking
	if err := h.db.Where("code = ?", code).First(&booking).Error; err != nil {
		return apiError(c, fiber.StatusNotFound, "Booking tidak ditemukan")
	}

	// Gunakan transaksi dengan mematikan foreign key checks sementara agar dijamin 100% bisa terhapus
	err := h.db.Transaction(func(tx *gorm.DB) error {
		_ = tx.Exec("SET FOREIGN_KEY_CHECKS=0;").Error

		// Cari semua galeri ID yang berhubungan
		var galleryIDs []uint
		tx.Table("galleries").Where("booking_id = ? OR (client_name != '' AND LOWER(client_name) = LOWER(?)) OR (title != '' AND LOWER(title) LIKE LOWER(CONCAT('%', ?, '%')))", booking.ID, booking.FullName, booking.FullName).Pluck("id", &galleryIDs)

		if len(galleryIDs) > 0 {
			tx.Where("gallery_id IN ?", galleryIDs).Delete(&models.Selection{})
			tx.Where("gallery_id IN ?", galleryIDs).Delete(&models.Photo{})
			tx.Where("id IN ?", galleryIDs).Delete(&models.Gallery{})
		}

		// Putuskan booking_id di tabel galleries jika masih ada
		tx.Exec("UPDATE galleries SET booking_id = NULL WHERE booking_id = ?", booking.ID)

		// Hapus booking
		if err := tx.Unscoped().Where("id = ?", booking.ID).Delete(&models.Booking{}).Error; err != nil {
			return err
		}

		_ = tx.Exec("SET FOREIGN_KEY_CHECKS=1;").Error
		return nil
	})

	if err != nil {
		log.Printf("Gagal menghapus booking %s: %v", code, err)
		return apiError(c, fiber.StatusInternalServerError, fmt.Sprintf("Gagal menghapus booking: %v", err))
	}

	// Hapus file bukti pembayaran dari disk jika ada
	if booking.PaymentProofPath != "" {
		_ = os.Remove(booking.PaymentProofPath)
	}

	return c.JSON(fiber.Map{"message": "Booking berhasil dihapus"})
}

func (h *Handler) ListAllPackages(c *fiber.Ctx) error {
	var packages []models.Package
	if err := h.db.Order("price asc").Find(&packages).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Failed to load packages")
	}
	return c.JSON(fiber.Map{"packages": packages})
}

func (h *Handler) CreatePackage(c *fiber.Ctx) error {
	var pkg models.Package
	if err := c.BodyParser(&pkg); err != nil {
		return apiError(c, fiber.StatusBadRequest, "Data tidak valid")
	}

	if pkg.Code == "" || pkg.Name == "" || pkg.Price == 0 {
		return apiError(c, fiber.StatusBadRequest, "Kode, Nama, dan Harga paket harus diisi")
	}

	if err := h.db.Create(&pkg).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Gagal menyimpan paket: "+err.Error())
	}

	return c.Status(fiber.StatusCreated).JSON(pkg)
}

func (h *Handler) UpdatePackage(c *fiber.Ctx) error {
	id := c.Params("id")
	var pkg models.Package

	if err := h.db.First(&pkg, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return apiError(c, fiber.StatusNotFound, "Paket tidak ditemukan")
		}
		return apiError(c, fiber.StatusInternalServerError, "Gagal mencari paket")
	}

	var input models.Package
	if err := c.BodyParser(&input); err != nil {
		return apiError(c, fiber.StatusBadRequest, "Data tidak valid")
	}

	// Update fields
	pkg.Name = input.Name
	pkg.Code = input.Code
	pkg.Description = input.Description
	pkg.Price = input.Price
	pkg.DurationHours = input.DurationHours
	pkg.DurationLabel = input.DurationLabel
	pkg.LocationCount = input.LocationCount
	pkg.EditedPhotos = input.EditedPhotos
	pkg.IncludesPrint = input.IncludesPrint
	pkg.IncludesTeaser = input.IncludesTeaser
	if input.ImagePath != "" {
		pkg.ImagePath = input.ImagePath
	}
	pkg.IsActive = input.IsActive

	if err := h.db.Save(&pkg).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Gagal memperbarui paket: "+err.Error())
	}

	return c.JSON(pkg)
}

func (h *Handler) DeletePackage(c *fiber.Ctx) error {
	id := c.Params("id")
	var pkg models.Package

	if err := h.db.First(&pkg, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return apiError(c, fiber.StatusNotFound, "Paket tidak ditemukan")
		}
		return apiError(c, fiber.StatusInternalServerError, "Gagal mencari paket")
	}

	// Soft delete or hard delete depending on bookings attached. We'll just hard delete for now if no constraints hit, or deactivate.
	// Actually, if there are bookings, deleting might fail due to FK constraints. Let's just try to delete, if fails, advise deactivation.
	if err := h.db.Delete(&pkg).Error; err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Gagal menghapus paket. Paket mungkin sedang digunakan oleh booking. Coba nonaktifkan (IsActive = false) paket ini.")
	}

	return c.JSON(fiber.Map{"message": "Paket berhasil dihapus"})
}

func (h *Handler) UploadPackageImage(c *fiber.Ctx) error {
	file, err := c.FormFile("image")
	if err != nil {
		return apiError(c, fiber.StatusBadRequest, "File gambar tidak ditemukan")
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" {
		return apiError(c, fiber.StatusBadRequest, "Format file tidak didukung. Gunakan JPG, PNG, atau WEBP")
	}

	// Buat folder uploads jika belum ada
	if err := os.MkdirAll("uploads", 0755); err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Gagal membuat folder upload")
	}

	// Generate filename unik
	randomStr, _ := randomToken(16)
	filename := fmt.Sprintf("pkg_%s%s", randomStr, ext)
	filepath := filepath.Join("uploads", filename)

	if err := c.SaveFile(file, filepath); err != nil {
		return apiError(c, fiber.StatusInternalServerError, "Gagal menyimpan file")
	}

	// Return public path
	return c.JSON(fiber.Map{
		"message": "File berhasil diupload",
		"path":    "/" + filepath, // Asumsikan uploads/ disajikan di root public (e.g. /uploads/...)
	})
}

// --- PORTFOLIO MANAGEMENT ---

func (h *Handler) ListActivePortfolios(c *fiber.Ctx) error {
	var portfolios []models.Portfolio
	if err := h.db.Where("is_active = ?", true).Order("sort_order ASC, created_at DESC").Find(&portfolios).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch portfolios"})
	}
	return c.JSON(fiber.Map{"portfolios": portfolios})
}

func (h *Handler) ListAllPortfolios(c *fiber.Ctx) error {
	var portfolios []models.Portfolio
	if err := h.db.Order("sort_order ASC, created_at DESC").Find(&portfolios).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch portfolios"})
	}
	return c.JSON(fiber.Map{"portfolios": portfolios})
}

func (h *Handler) CreatePortfolio(c *fiber.Ctx) error {
	var req models.Portfolio
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if err := h.db.Create(&req).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create portfolio"})
	}
	return c.Status(201).JSON(req)
}

func (h *Handler) UpdatePortfolio(c *fiber.Ctx) error {
	id := c.Params("id")
	var portfolio models.Portfolio
	if err := h.db.First(&portfolio, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Portfolio not found"})
	}
	var req models.Portfolio
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if err := h.db.Model(&portfolio).Updates(req).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update portfolio"})
	}
	return c.JSON(portfolio)
}

func (h *Handler) DeletePortfolio(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.db.Delete(&models.Portfolio{}, id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete portfolio"})
	}
	return c.SendStatus(204)
}

func (h *Handler) UploadPortfolioImage(c *fiber.Ctx) error {
	file, err := c.FormFile("image")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Image required"})
	}

	if file.Size > 5*1024*1024 {
		return c.Status(400).JSON(fiber.Map{"error": "Ukuran gambar terlalu besar (Maks 5MB)."})
	}

	dir := "./uploads/portfolios"
	if err := os.MkdirAll(dir, os.ModePerm); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create upload directory"})
	}

	ext := filepath.Ext(file.Filename)
	filename := fmt.Sprintf("%d%s", time.Now().UnixNano(), ext)
	path := filepath.Join(dir, filename)

	if err := c.SaveFile(file, path); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save image"})
	}

	return c.JSON(fiber.Map{
		"path":    "/uploads/portfolios/" + filename,
	})
}

// --- REVIEW MANAGEMENT ---

func (h *Handler) ListApprovedReviews(c *fiber.Ctx) error {
	var reviews []models.Review
	if err := h.db.Where("is_approved = ?", true).Order("created_at DESC").Find(&reviews).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch reviews"})
	}
	return c.JSON(fiber.Map{"reviews": reviews})
}

func (h *Handler) CreateReview(c *fiber.Ctx) error {
	var req models.Review
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	req.IsApproved = false // Selalu false saat pertama kali dibuat
	if err := h.db.Create(&req).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create review"})
	}
	return c.Status(201).JSON(req)
}

func (h *Handler) ListAllReviews(c *fiber.Ctx) error {
	var reviews []models.Review
	if err := h.db.Order("created_at DESC").Find(&reviews).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to fetch reviews"})
	}
	return c.JSON(fiber.Map{"reviews": reviews})
}

func (h *Handler) ToggleReviewApproval(c *fiber.Ctx) error {
	id := c.Params("id")
	var review models.Review
	if err := h.db.First(&review, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Review not found"})
	}
	
	// Toggle the is_approved flag
	if err := h.db.Model(&review).Update("is_approved", !review.IsApproved).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update review status"})
	}
	return c.JSON(review)
}

func (h *Handler) DeleteReview(c *fiber.Ctx) error {
	id := c.Params("id")
	if err := h.db.Delete(&models.Review{}, id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete review"})
	}
	return c.SendStatus(204)
}




