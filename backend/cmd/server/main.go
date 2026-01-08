package main

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"net/netip"
	"time"

	"github.com/cubetiq/zero-zta/backend/internal/api/handlers"
	"github.com/cubetiq/zero-zta/backend/internal/db"
	"github.com/cubetiq/zero-zta/backend/internal/models"
	"github.com/cubetiq/zero-zta/backend/internal/service"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
	"golang.zx2c4.com/wireguard/conn"
	"golang.zx2c4.com/wireguard/device"
	"golang.zx2c4.com/wireguard/tun/netstack"
)

// Hardcoded keys for demonstration
const (
	ServerPrivateKey = "OIfjl8wL+duLGyDoV8jS+/EFmzGWpa0tKBo+ThwKE2E="
	ServerPublicKey  = "8Jxz+AhkWA1ul56CSK5E2UtBMsBuLFARuTAiovNTOg4="
)

func main() {
	// Initialize Database
	if err := db.Init("zero-zta.db"); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Auto migrate models
	if err := db.AutoMigrate(&models.Agent{}, &models.Group{}, &models.Policy{}, &models.Service{}, &models.AuditLog{}, &models.AccessLog{}, &models.AgentMetrics{}); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	// Initialize Fiber app
	app := fiber.New(fiber.Config{
		AppName: "Zero ZTA Server",
	})

	// CORS middleware
	app.Use(cors.New())

	// Health Check
	app.Get("/health", func(c fiber.Ctx) error {
		return c.SendString("OK")
	})

	// API Group
	api := app.Group("/api")
	v1 := api.Group("/v1")

	// Start Wireguard Server
	go startWireguardServer()

	// =====================
	// Agent CRUD Routes
	// =====================
	v1.Get("/agents", handlers.ListAgents)
	v1.Post("/agents", handlers.CreateAgent)
	v1.Get("/agents/:id", handlers.GetAgent)
	v1.Put("/agents/:id", handlers.UpdateAgent)
	v1.Delete("/agents/:id", handlers.DeleteAgent)
	v1.Post("/agents/heartbeat", handlers.UpdateAgentStatus)
	v1.Put("/agents/:id/group", handlers.AssignGroup)
	v1.Get("/agents/:id/metrics", handlers.GetAgentMetrics)
	v1.Get("/agents/:id/access-logs", handlers.GetAccessLogs)

	// =====================
	// Group CRUD Routes
	// =====================
	v1.Get("/groups", handlers.ListGroups)
	v1.Post("/groups", handlers.CreateGroup)
	v1.Get("/groups/:id", handlers.GetGroup)
	v1.Put("/groups/:id", handlers.UpdateGroup)
	v1.Delete("/groups/:id", handlers.DeleteGroup)

	// =====================
	// Policy CRUD Routes
	// =====================
	v1.Get("/policies", handlers.ListPolicies)
	v1.Post("/policies", handlers.CreatePolicy)
	v1.Get("/policies/:id", handlers.GetPolicy)
	v1.Put("/policies/:id", handlers.UpdatePolicy)
	v1.Delete("/policies/:id", handlers.DeletePolicy)

	// =====================
	// Service Routes
	// =====================
	v1.Get("/agents/:id/services", handlers.ListServices)
	v1.Post("/agents/:id/services", handlers.CreateService)
	v1.Delete("/agents/:id/services/:serviceId", handlers.DeleteService)

	// =====================
	// Agent Management Routes
	// =====================
	v1.Post("/agents/:id/regenerate-key", handlers.RegenerateAgentKey)
	v1.Put("/agents/:id/routes", handlers.UpdateAgentRoutes)
	v1.Get("/agents/:id/audit-logs", handlers.GetAgentAuditLogs)

	// =====================
	// Audit & Access Log Routes
	// =====================
	v1.Get("/audit-logs", handlers.ListAuditLogs)
	v1.Get("/access-logs", handlers.GetAllAccessLogs)

	// =====================
	// Debug Tools
	// =====================
	v1.Post("/debug/ping", handlers.PingAgent)
	v1.Post("/debug/port-check", handlers.CheckPort)
	v1.Post("/debug/traceroute", handlers.Traceroute)
	v1.Post("/debug/dns", handlers.DNSLookup)
	v1.Post("/debug/http", handlers.HTTPCheck)

	// Agent Connect (for Wireguard handshake)
	v1.Post("/agent/connect", func(c fiber.Ctx) error {
		type ConnectRequest struct {
			Key       string `json:"key"`
			PublicKey string `json:"public_key"`
		}

		var req ConnectRequest
		if err := c.Bind().Body(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
		}

		// Find agent by API key
		var agent models.Agent
		if err := db.DB.Where("api_key = ?", req.Key).First(&agent).Error; err != nil {
			return c.Status(401).JSON(fiber.Map{"error": "invalid key"})
		}

		// Update agent with public key
		now := time.Now()
		if agent.PublicKey != req.PublicKey {
			if agent.PublicKey != "" {
				// Key rotation - remove old peer
				removePeerFromWireguard(agent.PublicKey)
			}
			agent.PublicKey = req.PublicKey
			addPeerToWireguard(req.PublicKey, agent.IP)
		}
		agent.Status = "online"
		agent.LastSeen = &now
		db.DB.Save(&agent)

		return c.JSON(fiber.Map{
			"status": "connected",
			"vpn": fiber.Map{
				"endpoint":       "127.0.0.1:51820",
				"server_pub_key": ServerPublicKey,
				"allowed_ips":    "10.0.0.0/24",
				"assigned_ip":    agent.IP + "/32",
			},
		})
	})

	// Debug Proxy Endpoint
	v1.Get("/debug/proxy", handlers.ProxyToAgent)

	log.Fatal(app.Listen(":3000"))
}

var serverDev *device.Device

// var serverTNet *netstack.Net // Moved to service.VPNNet

func startWireguardServer() {
	var err error
	// Using type inference for simplicity or correct interface if imported
	// netstack.CreateNetTUN returns (tun.Device, *Net, error)

	devTun, tnet, err := netstack.CreateNetTUN(
		[]netip.Addr{netip.MustParseAddr("10.0.0.1")},
		[]netip.Addr{netip.MustParseAddr("8.8.8.8")},
		device.DefaultMTU,
	)
	if err != nil {
		log.Panicf("Failed to create server TUN: %v", err)
	}
	service.SetVPNNet(tnet)

	// Config string (normally generated via ipc/UAPI or wgtypes, but for netstack/device we can use UAPI string format)
	// Format:
	// private_key=<hex>
	// listen_port=51820
	// public_key=<hex>
	// allowed_ip=10.0.0.2/32
	//
	// Wait, wireguard-go device.IpcSetOperation expects TEXT based UAPI commands.

	logger := device.NewLogger(device.LogLevelVerbose, "(SERVER) ")

	// Create device with real UDP bind
	serverDev = device.NewDevice(devTun, conn.NewDefaultBind(), logger)

	// Construct UAPI config
	uapiConfig := fmt.Sprintf("private_key=%s\nlisten_port=51820\n",
		hexKey(ServerPrivateKey),
	)

	// Configure device
	if err := serverDev.IpcSet(uapiConfig); err != nil {
		log.Panicf("Failed to configure server device: %v", err)
	}

	// Bring up
	if err := serverDev.Up(); err != nil {
		log.Panicf("Failed to bring up server device: %v", err)
	}

	logger.Verbosef("Wireguard server started on :51820")
}

func addPeerToWireguard(pubKeyB64, authorizedIP string) {
	// Add peer via UAPI
	// needs hex encoded key
	pubKeyHex := hexKey(pubKeyB64)

	// Config change to add peer
	conf := fmt.Sprintf("public_key=%s\nallowed_ip=%s/32\n", pubKeyHex, authorizedIP)

	if serverDev != nil {
		if err := serverDev.IpcSet(conf); err != nil {
			log.Printf("Failed to add peer: %v", err)
		} else {
			log.Printf("Added peer %s with IP %s", pubKeyB64, authorizedIP)
		}
	}
}

func removePeerFromWireguard(pubKeyB64 string) {
	pubKeyHex := hexKey(pubKeyB64)
	conf := fmt.Sprintf("public_key=%s\nremove=true\n", pubKeyHex)

	if serverDev != nil {
		if err := serverDev.IpcSet(conf); err != nil {
			log.Printf("Failed to remove peer %s: %v", pubKeyB64, err)
		} else {
			log.Printf("Removed peer %s", pubKeyB64)
		}
	}
}

func hexKey(b64 string) string {
	k, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		log.Panicf("Invalid key %s: %v", b64, err)
	}
	return hex.EncodeToString(k)
}
