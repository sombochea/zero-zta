package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"strconv"
	"time"

	"github.com/cubetiq/zero-zta/backend/internal/db"
	"github.com/cubetiq/zero-zta/backend/internal/models"
	"github.com/gofiber/fiber/v3"
)

// ListAgents returns all agents
func ListAgents(c fiber.Ctx) error {
	var agents []models.Agent
	if err := db.DB.Preload("Group").Preload("Services").Find(&agents).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(agents)
}

// CreateAgent creates a new agent with generated API key
func CreateAgent(c fiber.Ctx) error {
	type CreateRequest struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		GroupID     *uint  `json:"group_id"`
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
		Name:        req.Name,
		Description: req.Description,
		APIKey:      apiKey,
		IP:          ip,
		Status:      "offline",
		GroupID:     req.GroupID,
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
	if err := db.DB.Preload("Group").Preload("Services").First(&agent, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
	}
	return c.JSON(agent)
}

// UpdateAgent updates agent details
func UpdateAgent(c fiber.Ctx) error {
	id := c.Params("id")
	var agent models.Agent
	if err := db.DB.First(&agent, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
	}

	type UpdateRequest struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
		GroupID     *uint   `json:"group_id"`
	}

	var req UpdateRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Name != nil {
		agent.Name = *req.Name
	}
	if req.Description != nil {
		agent.Description = *req.Description
	}
	if req.GroupID != nil {
		agent.GroupID = req.GroupID
	}

	if err := db.DB.Save(&agent).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Load group for response
	db.DB.Preload("Group").First(&agent, id)

	return c.JSON(agent)
}

// AssignGroup assigns an agent to a group
func AssignGroup(c fiber.Ctx) error {
	id := c.Params("id")
	var agent models.Agent
	if err := db.DB.First(&agent, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
	}

	type AssignRequest struct {
		GroupID *uint `json:"group_id"`
	}

	var req AssignRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	agent.GroupID = req.GroupID
	if err := db.DB.Save(&agent).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Reload with group
	db.DB.Preload("Group").First(&agent, id)

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
	type PostureData struct {
		OSName            string `json:"os_name"`
		OSVersion         string `json:"os_version"`
		Hostname          string `json:"hostname"`
		AntivirusEnabled  bool   `json:"antivirus_enabled"`
		AntivirusName     string `json:"antivirus_name"`
		FirewallEnabled   bool   `json:"firewall_enabled"`
		DiskEncrypted     bool   `json:"disk_encrypted"`
		ScreenLockEnabled bool   `json:"screen_lock_enabled"`
		PostureScore      int    `json:"posture_score"`
	}

	type StatusRequest struct {
		APIKey            string       `json:"api_key"`
		HeartbeatLatency  int          `json:"heartbeat_latency_ms"`
		BytesSent         int64        `json:"bytes_sent"`
		BytesReceived     int64        `json:"bytes_received"`
		ActiveConnections int          `json:"active_connections"`
		CPUUsage          float64      `json:"cpu_usage"`
		MemoryUsage       float64      `json:"memory_usage"`
		Posture           *PostureData `json:"posture,omitempty"`
	}

	var req StatusRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	now := time.Now()

	// Find agent
	var agent models.Agent
	if err := db.DB.Where("api_key = ?", req.APIKey).First(&agent).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
	}

	// Update agent status
	db.DB.Model(&agent).Updates(map[string]interface{}{
		"status":    "online",
		"last_seen": now,
	})

	// Store metrics
	metrics := models.AgentMetrics{
		AgentID:           agent.ID,
		HeartbeatLatency:  req.HeartbeatLatency,
		BytesSent:         req.BytesSent,
		BytesReceived:     req.BytesReceived,
		ActiveConnections: req.ActiveConnections,
		CPUUsage:          req.CPUUsage,
		MemoryUsage:       req.MemoryUsage,
	}
	db.DB.Create(&metrics)

	// Store device posture if provided (Zero Trust)
	if req.Posture != nil {
		posture := models.DevicePosture{
			AgentID:           agent.ID,
			OSName:            req.Posture.OSName,
			OSVersion:         req.Posture.OSVersion,
			Hostname:          req.Posture.Hostname,
			AntivirusEnabled:  req.Posture.AntivirusEnabled,
			AntivirusName:     req.Posture.AntivirusName,
			FirewallEnabled:   req.Posture.FirewallEnabled,
			DiskEncrypted:     req.Posture.DiskEncrypted,
			ScreenLockEnabled: req.Posture.ScreenLockEnabled,
			PostureScore:      req.Posture.PostureScore,
			LastChecked:       &now,
		}

		// Upsert posture (update if exists, create if not)
		db.DB.Where("agent_id = ?", agent.ID).Assign(posture).FirstOrCreate(&posture)
	}

	return c.JSON(fiber.Map{"status": "ok"})
}

// GetAgentMetrics returns metrics for an agent
func GetAgentMetrics(c fiber.Ctx) error {
	id := c.Params("id")
	limitStr := c.Query("limit", "100")
	limit, _ := strconv.Atoi(limitStr)

	var metrics []models.AgentMetrics
	if err := db.DB.Where("agent_id = ?", id).Order("created_at DESC").Limit(limit).Find(&metrics).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(metrics)
}

// GetAccessLogs returns access logs for an agent
func GetAccessLogs(c fiber.Ctx) error {
	id := c.Params("id")
	limitStr := c.Query("limit", "100")
	limit, _ := strconv.Atoi(limitStr)

	var logs []models.AccessLog
	query := db.DB.Preload("SourceAgent").Preload("DestAgent").Preload("Service").
		Where("source_agent_id = ? OR dest_agent_id = ?", id, id).
		Order("created_at DESC").Limit(limit)

	if err := query.Find(&logs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(logs)
}
