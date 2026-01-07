package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"

	"github.com/cubetiq/zero-zta/backend/internal/db"
	"github.com/cubetiq/zero-zta/backend/internal/models"
	"github.com/gofiber/fiber/v3"
)

// ListServices returns all services for an agent
func ListServices(c fiber.Ctx) error {
	agentID := c.Params("id")
	var services []models.Service
	if err := db.DB.Where("agent_id = ?", agentID).Find(&services).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(services)
}

// CreateService creates a new service for an agent
func CreateService(c fiber.Ctx) error {
	agentID := c.Params("id")

	var service models.Service
	if err := c.Bind().Body(&service); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Parse agent ID
	var agent models.Agent
	if err := db.DB.First(&agent, agentID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
	}

	service.AgentID = agent.ID

	if service.Name == "" || service.Port == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Name and port are required"})
	}

	if err := db.DB.Create(&service).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Log audit
	LogAudit(&agent.ID, "service_added", map[string]interface{}{
		"service_name": service.Name,
		"port":         service.Port,
	}, c)

	return c.Status(201).JSON(service)
}

// DeleteService removes a service
func DeleteService(c fiber.Ctx) error {
	serviceID := c.Params("serviceId")
	agentID := c.Params("id")

	var service models.Service
	if err := db.DB.Where("id = ? AND agent_id = ?", serviceID, agentID).First(&service).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Service not found"})
	}

	// Log audit before delete
	var agentIDUint uint
	fmt.Sscanf(agentID, "%d", &agentIDUint)
	LogAudit(&agentIDUint, "service_removed", map[string]interface{}{
		"service_name": service.Name,
		"port":         service.Port,
	}, c)

	if err := db.DB.Delete(&service).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.SendStatus(204)
}

// RegenerateAgentKey revokes old key and generates new one
func RegenerateAgentKey(c fiber.Ctx) error {
	agentID := c.Params("id")

	var agent models.Agent
	if err := db.DB.First(&agent, agentID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
	}

	oldKey := agent.APIKey

	// Generate new key
	keyBytes := make([]byte, 16)
	rand.Read(keyBytes)
	newKey := fmt.Sprintf("sk_live_%s", hex.EncodeToString(keyBytes))

	agent.APIKey = newKey
	agent.PublicKey = "" // Clear public key to force re-auth

	if err := db.DB.Save(&agent).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Log audit
	LogAudit(&agent.ID, "key_regenerated", map[string]interface{}{
		"old_key_prefix": oldKey[:20] + "...",
	}, c)

	return c.JSON(fiber.Map{
		"message": "Key regenerated successfully",
		"api_key": newKey,
	})
}

// UpdateAgentRoutes updates agent's local network routes
func UpdateAgentRoutes(c fiber.Ctx) error {
	agentID := c.Params("id")

	var agent models.Agent
	if err := db.DB.First(&agent, agentID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Agent not found"})
	}

	type RoutesRequest struct {
		Routes []string `json:"routes"`
	}

	var req RoutesRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Store as JSON string
	routesJSON, _ := json.Marshal(req.Routes)
	agent.Routes = string(routesJSON)

	if err := db.DB.Save(&agent).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// Log audit
	LogAudit(&agent.ID, "routes_updated", map[string]interface{}{
		"routes": req.Routes,
	}, c)

	return c.JSON(agent)
}

// Helper to log audit events
func LogAudit(agentID *uint, action string, details map[string]interface{}, c fiber.Ctx) {
	detailsJSON, _ := json.Marshal(details)

	log := models.AuditLog{
		AgentID:   agentID,
		Action:    action,
		Details:   string(detailsJSON),
		IPAddress: c.IP(),
		UserAgent: c.Get("User-Agent"),
	}

	db.DB.Create(&log)
}
