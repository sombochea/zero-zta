package handlers

import (
	"fmt"
	"net"
	"time"

	"github.com/cubetiq/zero-zta/backend/internal/db"
	"github.com/cubetiq/zero-zta/backend/internal/models"
	"github.com/gofiber/fiber/v3"
)

// PingAgent performs a ping test between agents
func PingAgent(c fiber.Ctx) error {
	type PingRequest struct {
		SourceAgentID uint `json:"source_agent_id"`
		DestAgentID   uint `json:"dest_agent_id"`
		Count         int  `json:"count"`
	}

	var req PingRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Count == 0 {
		req.Count = 4
	}

	// Get source and dest agents
	var sourceAgent, destAgent models.Agent
	if err := db.DB.First(&sourceAgent, req.SourceAgentID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Source agent not found"})
	}
	if err := db.DB.First(&destAgent, req.DestAgentID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Destination agent not found"})
	}

	// Simulate ping results (in real implementation, this would go through VPN)
	results := make([]map[string]interface{}, req.Count)
	var totalLatency int64
	successCount := 0

	for i := 0; i < req.Count; i++ {
		// Simulate ping latency (5-50ms)
		latency := 5 + (i * 10) // simulated
		success := sourceAgent.Status == "online" && destAgent.Status == "online"

		results[i] = map[string]interface{}{
			"seq":     i + 1,
			"success": success,
			"latency": latency,
		}

		if success {
			totalLatency += int64(latency)
			successCount++
		}
	}

	avgLatency := float64(0)
	if successCount > 0 {
		avgLatency = float64(totalLatency) / float64(successCount)
	}

	return c.JSON(fiber.Map{
		"source":       sourceAgent.IP,
		"destination":  destAgent.IP,
		"packets_sent": req.Count,
		"packets_recv": successCount,
		"packet_loss":  float64(req.Count-successCount) / float64(req.Count) * 100,
		"avg_latency":  avgLatency,
		"results":      results,
	})
}

// CheckPort checks if a port is accessible on an agent
func CheckPort(c fiber.Ctx) error {
	type PortCheckRequest struct {
		SourceAgentID uint   `json:"source_agent_id"`
		DestAgentID   uint   `json:"dest_agent_id"`
		Port          int    `json:"port"`
		Protocol      string `json:"protocol"`
	}

	var req PortCheckRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Protocol == "" {
		req.Protocol = "tcp"
	}

	// Get agents
	var sourceAgent, destAgent models.Agent
	if err := db.DB.First(&sourceAgent, req.SourceAgentID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Source agent not found"})
	}
	if err := db.DB.Preload("Services").First(&destAgent, req.DestAgentID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Destination agent not found"})
	}

	// Check if service is exposed
	serviceFound := false
	var serviceName string
	for _, svc := range destAgent.Services {
		if svc.Port == req.Port && svc.Enabled {
			serviceFound = true
			serviceName = svc.Name
			break
		}
	}

	// Simulate connection test
	start := time.Now()
	success := destAgent.Status == "online" && (serviceFound || req.Port == 80) // Port 80 is always available for internal service
	latency := time.Since(start).Milliseconds()
	if success {
		latency = 10 + latency // add simulated network latency
	}

	status := "closed"
	if success {
		status = "open"
	}

	result := fiber.Map{
		"source":      sourceAgent.IP,
		"destination": fmt.Sprintf("%s:%d", destAgent.IP, req.Port),
		"port":        req.Port,
		"protocol":    req.Protocol,
		"status":      status,
		"latency_ms":  latency,
	}

	if serviceName != "" {
		result["service"] = serviceName
	}

	return c.JSON(result)
}

// Traceroute performs a traceroute between agents
func Traceroute(c fiber.Ctx) error {
	type TracerouteRequest struct {
		SourceAgentID uint `json:"source_agent_id"`
		DestAgentID   uint `json:"dest_agent_id"`
		MaxHops       int  `json:"max_hops"`
	}

	var req TracerouteRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.MaxHops == 0 {
		req.MaxHops = 30
	}

	// Get agents
	var sourceAgent, destAgent models.Agent
	if err := db.DB.First(&sourceAgent, req.SourceAgentID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Source agent not found"})
	}
	if err := db.DB.First(&destAgent, req.DestAgentID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Destination agent not found"})
	}

	// Simulate traceroute (in VPN, typically direct connection)
	hops := []map[string]interface{}{
		{
			"hop":     1,
			"ip":      "10.0.0.1",
			"host":    "vpn-gateway",
			"latency": 5,
		},
		{
			"hop":     2,
			"ip":      destAgent.IP,
			"host":    destAgent.Name,
			"latency": 12,
		},
	}

	return c.JSON(fiber.Map{
		"source":      sourceAgent.IP,
		"destination": destAgent.IP,
		"hops":        hops,
		"total_hops":  len(hops),
	})
}

// GetAllAccessLogs returns all access logs
func GetAllAccessLogs(c fiber.Ctx) error {
	limitStr := c.Query("limit", "100")
	var limit int
	fmt.Sscanf(limitStr, "%d", &limit)

	var logs []models.AccessLog
	if err := db.DB.Preload("SourceAgent").Preload("DestAgent").Preload("Service").
		Order("created_at DESC").Limit(limit).Find(&logs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(logs)
}

// DNSLookup performs a DNS lookup
func DNSLookup(c fiber.Ctx) error {
	type DNSRequest struct {
		SourceAgentID uint   `json:"source_agent_id"`
		Domain        string `json:"domain"`
		RecordType    string `json:"record_type"` // A, AAAA, MX, TXT, etc.
	}

	var req DNSRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.RecordType == "" {
		req.RecordType = "A"
	}

	// Simulated DNS resolution
	// In real world, this would execute `dig` or similar on the agent via VPN control channel
	records := []string{}
	if req.Domain == "localhost" {
		records = []string{"127.0.0.1"}
	} else if req.Domain == "internal.service" {
		records = []string{"10.0.0.5", "10.0.0.6"}
	} else {
		// Random simulated IP
		records = []string{fmt.Sprintf("10.0.0.%d", time.Now().UnixNano()%250+2)}
	}

	return c.JSON(fiber.Map{
		"domain":      req.Domain,
		"record_type": req.RecordType,
		"records":     records,
		"server":      "10.0.0.1 (VPN DNS)",
		"latency_ms":  15,
	})
}

// HTTPCheck performs an HTTP request check
func HTTPCheck(c fiber.Ctx) error {
	type HTTPRequest struct {
		SourceAgentID uint   `json:"source_agent_id"`
		URL           string `json:"url"`
		Method        string `json:"method"`
	}

	var req HTTPRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Method == "" {
		req.Method = "GET"
	}

	// Simulated HTTP check
	statusCode := 200
	statusText := "OK"
	duration := 45 // ms

	return c.JSON(fiber.Map{
		"url":         req.URL,
		"method":      req.Method,
		"status_code": statusCode,
		"status_text": statusText,
		"duration_ms": duration,
		"headers": map[string]string{
			"Content-Type": "application/json",
			"Server":       "ZeroZTA-Agent/1.0",
		},
	})
}

// Helper to check TCP port (for real implementation)
func checkTCPPort(host string, port int, timeout time.Duration) bool {
	addr := fmt.Sprintf("%s:%d", host, port)
	conn, err := net.DialTimeout("tcp", addr, timeout)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}
