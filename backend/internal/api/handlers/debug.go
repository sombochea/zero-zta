package handlers

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"time"

	"github.com/cubetiq/zero-zta/backend/internal/db"
	"github.com/cubetiq/zero-zta/backend/internal/models"
	"github.com/cubetiq/zero-zta/backend/internal/service"
	"github.com/gofiber/fiber/v3"
)

// PingAgent performs a ping test (Server -> Agent)
// Since we don't have C2 to trigger Agent -> Agent ping yet, we verify connectivity from Server
func PingAgent(c fiber.Ctx) error {
	type PingRequest struct {
		DestAgentID uint `json:"dest_agent_id"`
		Count       int  `json:"count"`
	}

	var req PingRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Count == 0 {
		req.Count = 4
	}

	var destAgent models.Agent
	if err := db.DB.First(&destAgent, req.DestAgentID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Destination agent not found"})
	}

	if service.VPNNet == nil {
		return c.Status(503).JSON(fiber.Map{"error": "VPN network not initialized"})
	}

	results := make([]map[string]interface{}, req.Count)
	var totalLatency int64
	successCount := 0

	// We use TCP Connect as a "Ping" because ICMP is hard with netstack userspace without root/raw sockets sometimes
	// or netstack might not expose Ping easily.
	// Actually, netstack doesn't easily expose ICMP Ping. We will simulate "Ping" via TCP Handshake to port 80 or similar known port
	// Or we can just try to dial anything. If we get "Connection Refused" (RST), it means the host is UP.
	// If we get "Timeout", host is DOWN.

	target := fmt.Sprintf("%s:80", destAgent.IP) // Default to port 80 check

	for i := 0; i < req.Count; i++ {
		start := time.Now()
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		conn, err := service.VPNNet.DialContext(ctx, "tcp", target)
		cancel()
		latency := time.Since(start).Milliseconds()

		success := false
		if err == nil {
			conn.Close()
			success = true
		} else {
			// If error is "connection refused", the host is actually UP but port is closed.
			// This counts as a successful "Ping" (Reachability).
			// If "timeout", it's Down.
			// Currently simplified to success only on connect.
			// Ideally we should check error type.
			netErr, ok := err.(net.Error)
			if ok && netErr.Timeout() {
				success = false
			} else {
				// Connection refused or other error means route exists and host responded with RST
				// logic: ping succeeds if host acts alive
				// But for now let's be strict: strict TCP connect
				// success = true // Uncomment if you want "refused" to count as UP
			}
		}

		results[i] = map[string]interface{}{
			"seq":     i + 1,
			"success": success,
			"latency": latency,
		}

		if success {
			totalLatency += latency
			successCount++
		}
		time.Sleep(200 * time.Millisecond)
	}

	avgLatency := float64(0)
	if successCount > 0 {
		avgLatency = float64(totalLatency) / float64(successCount)
	}

	return c.JSON(fiber.Map{
		"source":       "Server (VPN Gateway)",
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
		DestAgentID uint   `json:"dest_agent_id"` // Simplified: Server checks dest
		Port        int    `json:"port"`
		Protocol    string `json:"protocol"`
	}

	var req PortCheckRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Protocol == "" {
		req.Protocol = "tcp"
	}

	var destAgent models.Agent
	if err := db.DB.First(&destAgent, req.DestAgentID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Destination agent not found"})
	}

	if service.VPNNet == nil {
		return c.Status(503).JSON(fiber.Map{"error": "VPN network not initialized"})
	}

	target := fmt.Sprintf("%s:%d", destAgent.IP, req.Port)
	start := time.Now()
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	conn, err := service.VPNNet.DialContext(ctx, req.Protocol, target)
	cancel()
	latency := time.Since(start).Milliseconds()

	status := "closed"
	if err == nil {
		status = "open"
		conn.Close()
	}

	return c.JSON(fiber.Map{
		"source":      "Server",
		"destination": target,
		"port":        req.Port,
		"protocol":    req.Protocol,
		"status":      status,
		"latency_ms":  latency,
	})
}

// HTTPCheck performs a REAL HTTP request through the VPN
func HTTPCheck(c fiber.Ctx) error {
	type HTTPRequest struct {
		SourceAgentID uint   `json:"source_agent_id"` // Ignored, always Server
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

	if service.VPNNet == nil {
		return c.Status(503).JSON(fiber.Map{"error": "VPN network not initialized"})
	}

	// Determine if target is a VPN IP
	host, _, err := net.SplitHostPort(req.URL)
	if err != nil {
		// Attempt to parse as just host if URL parsing fails or no port (URL might be "http://google.com")
		if u, err := url.Parse(req.URL); err == nil && u.Host != "" {
			host = u.Hostname()
		} else {
			host = req.URL
		}
	}

	// Resolve to IP to check if it's internal
	var useSystemDialer bool = true
	ips, err := net.LookupHost(host)
	if err == nil {
		for _, ip := range ips {
			// Check if 10.0.0.x (Simple check for now)
			if net.ParseIP(ip).To4() != nil && ip[:4] == "10.0" {
				useSystemDialer = false
				break
			}
		}
	} else {
		// If resolution fails, let the client try, but assume system if it looks like a domain not in our VPN
		// For simplicity, if service.VPNNet is nil, we always use system
	}

	// Create client
	var client *http.Client

	if !useSystemDialer && service.VPNNet != nil {
		client = &http.Client{
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					return service.VPNNet.DialContext(ctx, network, addr)
				},
			},
			Timeout: 10 * time.Second,
		}
	} else {
		client = &http.Client{
			Timeout: 10 * time.Second,
		}
	}

	httpReq, err := http.NewRequest(req.Method, req.URL, nil)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{
			"error":  "Invalid URL",
			"detail": err.Error(),
		})
	}

	httpReq.Header.Set("User-Agent", "ZeroZTA-Diagnostics/1.0")

	start := time.Now()
	resp, err := client.Do(httpReq)
	duration := time.Since(start).Milliseconds()

	if err != nil {
		return c.JSON(fiber.Map{
			"url":         req.URL,
			"method":      req.Method,
			"status_code": 0,
			"status_text": "Error: " + err.Error(),
			"duration_ms": duration,
		})
	}
	defer resp.Body.Close()

	// Capture headers
	headers := make(map[string]string)
	for k, v := range resp.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}

	return c.JSON(fiber.Map{
		"url":         req.URL,
		"method":      req.Method,
		"status_code": resp.StatusCode,
		"status_text": resp.Status,
		"duration_ms": duration,
		"headers":     headers,
		"used_vpn":    !useSystemDialer,
	})
}

// Traceroute (mocked for now as netstack doesn't easy expose TTL for true traceroute)
func Traceroute(c fiber.Ctx) error {
	// ... (Keep existing mock or remove if confusing. Let's keep existing mock but label it)
	type TracerouteRequest struct {
		SourceAgentID uint `json:"source_agent_id"`
		DestAgentID   uint `json:"dest_agent_id"`
		MaxHops       int  `json:"max_hops"`
	}
	// ... minimal implementation or just return "Not Supported in Userspace Networking yet"
	// Returning the old mock for UI stability
	return c.JSON(fiber.Map{
		"source":      "Server",
		"destination": "Target",
		"hops": []map[string]interface{}{
			{"hop": 1, "ip": "10.0.0.1", "host": "gateway", "latency": 1},
			{"hop": 2, "ip": "10.0.0.x", "host": "target", "latency": 5},
		},
		"total_hops": 2,
		"status":     "simulated",
	})
}

// DNSLookup performs a DNS lookup (Server Perspective)
func DNSLookup(c fiber.Ctx) error {
	type DNSRequest struct {
		Domain     string `json:"domain"`
		RecordType string `json:"record_type"`
	}

	var req DNSRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Use system resolver for now (server's perspective)
	// Or use VPN resolver if configured?
	// Let's use standard net.LookupHost which uses the container/host DNS.

	start := time.Now()
	ips, err := net.LookupHost(req.Domain)
	latency := time.Since(start).Milliseconds()

	if err != nil {
		return c.JSON(fiber.Map{
			"domain":      req.Domain,
			"record_type": req.RecordType,
			"error":       err.Error(),
			"latency_ms":  latency,
		})
	}

	return c.JSON(fiber.Map{
		"domain":      req.Domain,
		"record_type": "A", // LookupHost returns IPs (A/AAAA)
		"records":     ips,
		"server":      "System Resolver",
		"latency_ms":  latency,
	})
}

// Stub for access logs
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

// ProxyToAgent proxies HTTP requests to an agent via the VPN
func ProxyToAgent(c fiber.Ctx) error {
	targetIP := c.Query("ip")
	port := c.Query("port", "80")
	path := c.Query("path", "/")

	if targetIP == "" {
		return c.Status(400).SendString("Missing 'ip' query parameter")
	}

	if service.VPNNet == nil {
		return c.Status(503).SendString("VPN network not initialized")
	}

	targetAddr := fmt.Sprintf("%s:%s", targetIP, port)

	// Dial the target via VPN
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn, err := service.VPNNet.DialContext(ctx, "tcp", targetAddr)
	if err != nil {
		return c.Status(502).SendString(fmt.Sprintf("Failed to connect to agent %s: %v", targetAddr, err))
	}
	defer conn.Close()

	// Construct request
	// Note: basic implementation. For full proxying, we'd use httputil.ReverseProxy with a custom Transport.
	// But for "debug/test", a simple write/read works or a custom client.

	// Let's use http.Client with custom transport to handle valid HTTP framing
	bgTransport := &http.Transport{
		DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
			// Ignore addr, dial our target
			return service.VPNNet.DialContext(ctx, "tcp", targetAddr)
		},
	}
	client := &http.Client{
		Transport: bgTransport,
		Timeout:   10 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse // Don't follow redirects automatically
		},
	}

	// targetURL is dummy because DialContext overrides it
	reqURL := fmt.Sprintf("http://dummy%s", path)
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return c.Status(500).SendString(err.Error())
	}

	resp, err := client.Do(req)
	if err != nil {
		return c.Status(502).SendString(fmt.Sprintf("Proxy request failed: %v", err))
	}
	defer resp.Body.Close()

	// Copy headers
	for k, v := range resp.Header {
		c.Set(k, v[0])
	}
	c.Status(resp.StatusCode)

	// Stream body
	body, _ := io.ReadAll(resp.Body)
	return c.Send(body)
}
