package handlers

import (
	"strings"

	"kleiora-backend/internal/models"

	"github.com/gofiber/fiber/v2"
)

type TrackEventRequest struct {
	SessionID string `json:"session_id"`
	Path      string `json:"path"`
	Action    string `json:"action"`
}

func (h *Handler) TrackEvent(c *fiber.Ctx) error {
	var req TrackEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if strings.HasPrefix(req.Path, "/g") || strings.HasPrefix(req.Path, "/dashboard") || strings.HasPrefix(req.Path, "/login") || strings.HasPrefix(req.Path, "/studio") {
		return c.JSON(fiber.Map{"status": "ignored"})
	}

	if req.Action == "" {
		req.Action = "page_view"
	}

	log := models.VisitorLog{
		SessionID: req.SessionID,
		Path:      req.Path,
		Action:    req.Action,
	}

	if err := h.db.Create(&log).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to track event"})
	}

	return c.JSON(fiber.Map{"status": "ok"})
}

type AnalyticsSummaryResponse struct {
	TotalViews    int64               `json:"total_views"`
	UniqueVisits  int64               `json:"unique_visits"`
	ViewsByPath   []PathCount         `json:"views_by_path"`
	DailyTraffic  []DailyTraffic      `json:"daily_traffic"`
	RecentHistory []models.VisitorLog `json:"recent_history"`
}

type PathCount struct {
	Path  string `json:"path"`
	Count int64  `json:"count"`
}

type DailyTraffic struct {
	Date         string `json:"date"`
	TotalViews   int64  `json:"total_views"`
	UniqueVisits int64  `json:"unique_visits"`
}

func (h *Handler) GetAnalyticsSummary(c *fiber.Ctx) error {
	var totalViews int64
	var uniqueVisits int64

	filterQuery := "path NOT LIKE '/g%' AND path NOT LIKE '/dashboard%' AND path NOT LIKE '/studio%' AND path NOT LIKE '/login%'"

	h.db.Model(&models.VisitorLog{}).Where(filterQuery).Count(&totalViews)
	h.db.Model(&models.VisitorLog{}).Where(filterQuery).Distinct("session_id").Count(&uniqueVisits)

	var viewsByPath []PathCount
	h.db.Model(&models.VisitorLog{}).
		Where(filterQuery).
		Select("path, count(id) as count").
		Group("path").
		Order("count desc").
		Find(&viewsByPath)

	var dailyTraffic []DailyTraffic
	h.db.Model(&models.VisitorLog{}).
		Where(filterQuery).
		Select("DATE(created_at) as date, count(id) as total_views, count(distinct session_id) as unique_visits").
		Group("DATE(created_at)").
		Order("date asc").
		Limit(30).
		Find(&dailyTraffic)

	var recentHistory []models.VisitorLog
	h.db.Where(filterQuery).Order("created_at desc").Limit(50).Find(&recentHistory)

	return c.JSON(AnalyticsSummaryResponse{
		TotalViews:    totalViews,
		UniqueVisits:  uniqueVisits,
		ViewsByPath:   viewsByPath,
		DailyTraffic:  dailyTraffic,
		RecentHistory: recentHistory,
	})
}
