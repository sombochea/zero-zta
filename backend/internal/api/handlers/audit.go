package handlers

import (
	"strconv"

	"github.com/cubetiq/zero-zta/backend/internal/db"
	"github.com/cubetiq/zero-zta/backend/internal/models"
	"github.com/gofiber/fiber/v3"
)

// ListAuditLogs returns audit logs, optionally filtered by agent
func ListAuditLogs(c fiber.Ctx) error {
	agentID := c.Query("agent_id")
	action := c.Query("action")
	limitStr := c.Query("limit", "100")
	limit, _ := strconv.Atoi(limitStr)

	query := db.DB.Preload("Agent").Order("created_at DESC").Limit(limit)

	if agentID != "" {
		query = query.Where("agent_id = ?", agentID)
	}

	if action != "" {
		query = query.Where("action = ?", action)
	}

	var logs []models.AuditLog
	if err := query.Find(&logs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(logs)
}

// GetAgentAuditLogs returns audit logs for a specific agent
func GetAgentAuditLogs(c fiber.Ctx) error {
	agentID := c.Params("id")
	limitStr := c.Query("limit", "50")
	limit, _ := strconv.Atoi(limitStr)

	var logs []models.AuditLog
	if err := db.DB.Where("agent_id = ?", agentID).Order("created_at DESC").Limit(limit).Find(&logs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(logs)
}
