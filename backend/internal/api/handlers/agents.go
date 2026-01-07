package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/cubetiq/zero-zta/backend/internal/db"
	"github.com/cubetiq/zero-zta/backend/internal/models"
	"github.com/gofiber/fiber/v3"
)

// ListAgents returns all agents
func ListAgents(c fiber.Ctx) error {
	var agents []models.Agent
	if err := db.DB.Preload("Group").Find(&agents).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(agents)
}

// CreateAgent creates a new agent with generated API key
func CreateAgent(c fiber.Ctx) error {
	type CreateRequest struct {
		Name    string `json:"name"`
		GroupID *uint  `json:"group_id"`
	}

	var req CreateRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}

	// Generate API key
	keyBytes := make([]byte, 16)
	rand.Read(keyBytes)
	apiKey := fmt.Sprintf("sk_live_%s", hex.EncodeToString(keyBytes))

	// Get next IP
	var count int64
	db.DB.Model(&models.Agent{}).Count(&count)
	ip := fmt.Sprintf("10.0.0.%d", count+2)

	agent := models.Agent{
		Name:    req.Name,
		APIKey:  apiKey,
		IP:      ip,
		Status:  "offline",
		GroupID: req.GroupID,
	}

	if err := db.DB.Create(&agent).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(agent)
}

// GetAgent returns agent by ID
func GetAgent(c fiber.Ctx) error {
	id := c.Params("id")
	var agent models.Agent
	if err := db.DB.Preload("Group").First(&agent, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
	}
	return c.JSON(agent)
}

// DeleteAgent soft deletes an agent
func DeleteAgent(c fiber.Ctx) error {
	id := c.Params("id")
	if err := db.DB.Delete(&models.Agent{}, id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}

// UpdateAgentStatus updates agent online status (called by heartbeat)
func UpdateAgentStatus(c fiber.Ctx) error {
	type StatusRequest struct {
		APIKey string `json:"api_key"`
	}

	var req StatusRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	now := time.Now()
	result := db.DB.Model(&models.Agent{}).Where("api_key = ?", req.APIKey).Updates(map[string]interface{}{
		"status":    "online",
		"last_seen": now,
	})

	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
	}

	return c.JSON(fiber.Map{"status": "ok"})
}
