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
	if err := db.AutoMigrate(&models.Agent{}, &models.Group{}, &models.Policy{}); err != nil {
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
	v1.Delete("/agents/:id", handlers.DeleteAgent)
	v1.Post("/agents/heartbeat", handlers.UpdateAgentStatus)

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
	// Usage: curl "http://127.0.0.1:3000/api/v1/debug/proxy?target=10.0.0.x"
	v1.Get("/debug/proxy", func(c fiber.Ctx) error {
		target := c.Query("target")
		if target == "" {
			return c.Status(400).JSON(fiber.Map{"error": "target query param required"})
		}

		if serverTNet == nil {
			return c.Status(503).JSON(fiber.Map{"error": "VPN not initialized"})
		}

		// Dial the target on port 80 inside the VPN
		conn, err := serverTNet.Dial("tcp", target+":80")
		if err != nil {
			return c.Status(502).JSON(fiber.Map{"error": fmt.Sprintf("Failed to dial %s: %v", target, err)})
		}
		defer conn.Close()

		// Send simple HTTP GET
		fmt.Fprintf(conn, "GET / HTTP/1.0\r\n\r\n")

		// Read response
		buf := make([]byte, 1024)
		n, err := conn.Read(buf)
		if err != nil {
			return c.Status(502).JSON(fiber.Map{"error": fmt.Sprintf("Failed to read from %s: %v", target, err)})
		}

		return c.SendString(string(buf[:n]))
	})

	log.Fatal(app.Listen(":3000"))
}

var serverDev *device.Device
var serverTNet *netstack.Net // Global netstack instance

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
	serverTNet = tnet

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
