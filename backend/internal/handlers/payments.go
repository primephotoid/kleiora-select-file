package handlers

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"kleiora-backend/internal/models"
	"kleiora-backend/internal/services"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Proof submission and booking creation share the lock so a slot cannot be
// reassigned while a timely manual proof is being committed near its deadline.
func (h *Handler) withBookingYearLock(date string, persist func(*gorm.DB) error) error {
	bookingCreateMu.Lock()
	defer bookingCreateMu.Unlock()
	if h.db.Dialector.Name() != "mysql" {
		return persist(h.db)
	}
	lockName := "kleiora-booking-year-" + strings.SplitN(date, "-", 2)[0]
	return h.db.Connection(func(conn *gorm.DB) error {
		var acquired int
		if err := conn.Raw("SELECT GET_LOCK(?, 10)", lockName).Scan(&acquired).Error; err != nil {
			return err
		}
		if acquired != 1 {
			return errSlotBusy
		}
		defer func() {
			var released int
			if err := conn.Raw("SELECT RELEASE_LOCK(?)", lockName).Scan(&released).Error; err != nil || released != 1 {
				log.Printf("failed to release annual booking-sequence lock %s: %v", lockName, err)
			}
		}()
		return persist(conn)
	})
}

func occupiedBookings(db *gorm.DB, date, hour string) *gorm.DB {
	return db.Model(&models.Booking{}).Where("session_date = ? AND session_hour = ?", date, hour).
		Where("status NOT IN ?", []string{"cancelled", "expired", "payment_review"}).
		Where("status <> ? OR payment_status <> ? OR payment_expires_at IS NULL OR payment_expires_at > ?", "pending_payment", "pending", time.Now())
}

func (h *Handler) paymentBooking(c *fiber.Ctx) (*models.Booking, error) {
	c.Set("Cache-Control", "no-store")
	var b models.Booking
	if err := h.db.Preload("Package").Where("code = ?", c.Params("code")).First(&b).Error; err != nil {
		return nil, fiber.NewError(404, "Booking tidak ditemukan")
	}
	if !authorizeBookingAccess(c, &b) {
		return nil, fiber.NewError(401, "Invalid booking access token")
	}
	if b.PaymentOrderID == nil {
		return nil, fiber.NewError(409, "Booking lama tidak menggunakan QRIS")
	}
	return &b, nil
}

func paymentResponse(b models.Booking) fiber.Map {
	return fiber.Map{"booking": b, "qr_available": b.PaymentQRURL != "" && b.PaymentStatus == "pending" && b.PaymentExpiresAt != nil && b.PaymentExpiresAt.After(time.Now())}
}

func (h *Handler) CreateQRIS(c *fiber.Ctx) error {
	b, err := h.paymentBooking(c)
	if err != nil {
		return err
	}
	if b.AmountDue < 1 || b.AmountDue > services.MaxQRISAmount {
		return apiError(c, fiber.StatusBadRequest, "Nominal QRIS harus Rp1 sampai Rp10.000.000 per transaksi. Hubungi admin untuk booking ini")
	}
	if h.midtrans.ServerKey == "" {
		return apiError(c, 503, "Pembayaran QRIS belum dikonfigurasi")
	}
	// Row locking serializes retries across containers. The persisted order ID is
	// reused after timeouts; a new charge is never created with a new order ID.
	err = h.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(b, b.ID).Error; err != nil {
			return err
		}
		if b.PaymentStatus != "pending" || b.PaymentExpiresAt == nil || !b.PaymentExpiresAt.After(time.Now().Add(20*time.Second)) {
			return fiber.NewError(409, "Reservasi berakhir atau pembayaran sudah diproses")
		}
		if b.PaymentQRURL != "" {
			return nil
		}
		p, err := h.midtrans.Status(*b.PaymentOrderID)
		if errors.Is(err, services.ErrMidtransNotFound) {
			p, err = h.midtrans.Charge(*b)
		}
		if err != nil {
			return err
		}
		if !p.Matches(*b) {
			return errors.New("Midtrans order mismatch")
		}
		if p.Status != "pending" {
			return h.applyPayment(tx, b, *p)
		}
		qrURL := h.midtrans.QRURL(*p)
		if qrURL == "" {
			return errors.New("Midtrans did not return a valid QRIS URL")
		}
		b.PaymentQRURL, b.PaymentTransactionID = qrURL, p.TransactionID
		return tx.Model(b).Updates(map[string]any{"payment_qr_url": qrURL, "payment_transaction_id": p.TransactionID}).Error
	})
	if err != nil {
		var httpError *fiber.Error
		if errors.As(err, &httpError) {
			return httpError
		}
		log.Printf("QRIS creation failed for booking %s: %v", b.Code, err)
		return apiError(c, 502, "QRIS belum tersedia. Coba lagi pada booking yang sama; jangan membayar dua kali")
	}
	h.db.Preload("Package").First(b, b.ID)
	return c.JSON(paymentResponse(*b))
}

func (h *Handler) GetPayment(c *fiber.Ctx) error {
	b, err := h.paymentBooking(c)
	if err != nil {
		return err
	}
	// Do not replace the saved booking when provider status is temporarily unavailable.
	if b.PaymentStatus == "pending" && (b.PaymentCheckedAt == nil || time.Since(*b.PaymentCheckedAt) >= 10*time.Second) {
		if err := h.reconcilePayment(b.ID); err != nil && !errors.Is(err, services.ErrMidtransNotFound) {
			return apiError(c, 503, "Status pembayaran belum dapat diperiksa; coba lagi. Jangan membayar ulang")
		}
	}
	if err := h.db.Preload("Package").First(b, b.ID).Error; err != nil {
		return apiError(c, 500, "Failed to load payment")
	}
	return c.JSON(paymentResponse(*b))
}

func (h *Handler) QRISImage(c *fiber.Ctx) error {
	b, err := h.paymentBooking(c)
	if err != nil {
		return err
	}
	if b.PaymentStatus != "pending" || b.PaymentExpiresAt == nil || !b.PaymentExpiresAt.After(time.Now()) || b.PaymentQRURL == "" {
		return apiError(c, 409, "QRIS tidak tersedia atau telah kedaluwarsa")
	}
	data, err := h.midtrans.QRImage(b.PaymentQRURL)
	if err != nil {
		return apiError(c, 502, "Gambar QRIS belum dapat dimuat; coba lagi")
	}
	c.Set("Cache-Control", "no-store")
	c.Set("Content-Type", "image/png")
	if c.Query("download") == "1" {
		c.Set("Content-Disposition", fmt.Sprintf(`attachment; filename="QRIS-%s.png"`, b.Code))
	}
	return c.Send(data)
}

func (h *Handler) MidtransNotification(c *fiber.Ctx) error {
	if len(c.Body()) > 64<<10 {
		return apiError(c, 413, "Notification too large")
	}
	var notification services.MidtransPayment
	if err := json.Unmarshal(c.Body(), &notification); err != nil {
		return apiError(c, 400, "Invalid notification")
	}
	if !h.midtrans.ValidSignature(notification) {
		return apiError(c, 401, "Invalid payment signature")
	}
	var b models.Booking
	if err := h.db.Where("payment_order_id = ?", notification.OrderID).First(&b).Error; err != nil {
		return apiError(c, 404, "Unknown payment order")
	}
	// The signature does not cover transaction_status. Never trust that field:
	// obtain authoritative status directly from the provider for this known order.
	if err := h.reconcilePayment(b.ID); err != nil {
		log.Printf("Midtrans reconciliation failed for %s: %v", b.Code, err)
		return apiError(c, 503, "Payment confirmation could not be persisted; retry notification")
	}
	return c.JSON(fiber.Map{"status": "ok"})
}

func (h *Handler) reconcilePayment(id uint) error {
	err := h.db.Transaction(func(tx *gorm.DB) error {
		var b models.Booking
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Package").First(&b, id).Error; err != nil {
			return err
		}
		if b.PaymentOrderID == nil {
			return nil
		}
		p, err := h.midtrans.Status(*b.PaymentOrderID)
		if err != nil {
			return err
		}
		return h.applyPayment(tx, &b, *p)
	})
	if err == nil {
		h.events.Broadcast("booking_updated")
	}
	return err
}

func (h *Handler) applyPayment(tx *gorm.DB, b *models.Booking, p services.MidtransPayment) error {
	if !p.Matches(*b) {
		return errors.New("payment order, amount, currency, method or transaction mismatch")
	}
	now := time.Now()
	updates := map[string]any{"payment_checked_at": now, "payment_transaction_id": p.TransactionID}
	// Paid states cannot regress when Midtrans retries an older notification.
	switch p.Status {
	case "settlement":
		if p.FraudStatus != "" && p.FraudStatus != "accept" {
			return errors.New("payment fraud status is not accepted")
		}
		if b.PaidAmount > 0 {
			return tx.Model(b).Updates(updates).Error
		}
		status := "confirmed"
		paymentStatus := "verified"
		if b.Status != "pending_payment" || b.PaymentExpiresAt == nil || !b.PaymentExpiresAt.After(now) {
			status, paymentStatus = "payment_review", "payment_review"
		}
		updates["status"], updates["payment_status"], updates["paid_amount"], updates["verified_at"] = status, paymentStatus, b.AmountDue, now
		if err := tx.Model(b).Updates(updates).Error; err != nil {
			return err
		}
		kind := "Pembayaran penuh diterima"
		if b.PaymentType != "full" {
			kind = "DP diterima (bukan pelunasan)"
		}
		if paymentStatus == "payment_review" {
			kind = "Pembayaran terverifikasi; booking belum terkonfirmasi — PERIKSA JADWAL / REFUND"
		}
		// Use provider settlement time, not webhook arrival time. A timely
		// payment must still be reviewed if its slot has already been released.
		wib := time.FixedZone("WIB", 7*3600)
		settledAt, timeErr := time.ParseInLocation("2006-01-02 15:04:05", p.SettlementTime, wib)
		if timeErr == nil && !settledAt.After(now) {
			kind += "\nWaktu pembayaran menurut Midtrans: " + settledAt.Format("2006-01-02 15:04:05") + " WIB"
			if paymentStatus == "payment_review" && b.PaymentExpiresAt != nil {
				if settledAt.Before(*b.PaymentExpiresAt) {
					kind += "\nPembayaran tercatat sebelum batas reservasi; konfirmasi diproses ketika reservasi tidak lagi aktif"
				} else {
					kind += "\nPembayaran tercatat pada/setelah batas reservasi"
				}
			}
		} else if paymentStatus == "payment_review" {
			kind += "\nWaktu pembayaran belum diketahui; tidak dapat menyimpulkan pelanggan terlambat membayar"
		}
		message := fmt.Sprintf("Pembayaran QRIS terkonfirmasi otomatis\n%s\nKode: %s\nKlien: %s\nWhatsApp: %s\nNominal diterima: Rp %s\nSesi: %s %s.00 WITA\nLokasi: %s\nOrder: %s", kind, b.Code, b.FullName, b.WhatsApp, services.FormatPaymentAmount(b.AmountDue), b.SessionDate, b.SessionHour, b.SessionLocation, *b.PaymentOrderID)
		return tx.Create(&models.PaymentNotice{BookingID: b.ID, Message: message}).Error
	case "expire", "deny", "cancel", "failure":
		if b.PaidAmount == 0 {
			updates["payment_status"], updates["status"] = "expired", "expired"
		}
	case "refund", "partial_refund":
		updates["payment_status"] = "refunded"
		if b.Status != "completed" {
			updates["status"] = "payment_review"
		}
	case "pending":
		// Keep the original deadline even if provider responses arrive late.
	default:
		return fmt.Errorf("unsupported QRIS transaction status %q", p.Status)
	}
	return tx.Model(b).Updates(updates).Error
}

func (h *Handler) StartPaymentWorker() {
	go func() {
		for {
			h.ProcessPayments()
			time.Sleep(time.Minute)
		}
	}()
}

func (h *Handler) ProcessPayments() {
	now := time.Now()
	h.db.Model(&models.Booking{}).Where("payment_status = ? AND status = ? AND payment_expires_at <= ?", "pending", "pending_payment", now).Updates(map[string]any{"status": "expired"})
	// Reconcile interrupted requests and delayed webhooks. Older paid/expired
	// orders remain in the database and can still receive signed webhooks.
	var bookings []models.Booking
	h.db.Where("payment_order_id IS NOT NULL AND payment_status = ? AND payment_expires_at > ? AND (payment_checked_at IS NULL OR payment_checked_at < ?)", "pending", now.Add(-time.Hour), now.Add(-time.Minute)).Order("payment_checked_at asc").Limit(20).Find(&bookings)
	for _, b := range bookings {
		if err := h.reconcilePayment(b.ID); err != nil {
			h.db.Model(&models.Booking{}).Where("id = ?", b.ID).Update("payment_checked_at", now)
			if !errors.Is(err, services.ErrMidtransNotFound) {
				log.Printf("QRIS status unavailable for %s", b.Code)
			}
		}
	}
	for i := 0; i < 20; i++ {
		err := h.db.Transaction(func(tx *gorm.DB) error {
			var notice models.PaymentNotice
			result := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("sent_at IS NULL").Order("id asc").Limit(1).Find(&notice)
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return gorm.ErrRecordNotFound
			}
			if err := services.SendPaymentNotice(notice.Message); err != nil {
				return err
			}
			return tx.Model(&notice).Update("sent_at", time.Now()).Error
		})
		if err != nil {
			break
		}
	}
}
