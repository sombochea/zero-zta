package main

import (
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log"
	"net/netip"

	"github.com/gofiber/fiber/v3"
	"golang.zx2c4.com/wireguard/conn"
	"golang.zx2c4.com/wireguard/device"
	"golang.zx2c4.com/wireguard/tun/netstack"
)

// Hardcoded keys for demonstration
const (
	ServerPrivateKey = "OIfjl8wL+duLGyDoV8jS+/EFmzGWpa0tKBo+ThwKE2E="
	// ServerPublicKey = "8Jxz+AhkWA1ul56CSK5E2UtBMsBuLFARuTAiovNTOg4="

	// AgentPublicKey = "+UO34739AnKDZbBu/aCQX0l5zCbHzy21Apy/AF9lXiw=" // Removed hardcoded agent key
)

// Simple in-memory store
type AgentData struct {
	IP        string
	PublicKey string
}

var (
	// Map API Key -> Agent Data (if registered)
	// validKeys just stores valid API keys.
	validKeys = map[string]*AgentData{}

	// Next IP allocator (very simple)
	nextIP = 2
)

func main() {
	// Initialize Fiber app
	app := fiber.New()

	// Health Check
	app.Get("/health", func(c fiber.Ctx) error {
		return c.SendString("OK")
	})

	// API Group for Agents
	api := app.Group("/api")
	v1 := api.Group("/v1")

	// Start Wireguard Server
	go startWireguardServer()

	// Create Credential Endpoint
	v1.Post("/credentials", func(c fiber.Ctx) error {
		// Generate simple key
		key := fmt.Sprintf("sk_live_%x", nextIP) // simple unique key generation
		validKeys[key] = nil                     // authorize key, no agent data yet

		return c.JSON(fiber.Map{
			"key": key,
		})
	})

	// Handle agent connection, auth, and config distribution
	v1.Post("/agent/connect", func(c fiber.Ctx) error {
		type ConnectRequest struct {
			Key       string `json:"key"`
			PublicKey string `json:"public_key"`
		}

		var req ConnectRequest
		if err := c.Bind().Body(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "invalid request"})
		}

		// Authenticate
		data, ok := validKeys[req.Key]
		if !ok {
			return c.Status(401).JSON(fiber.Map{"error": "invalid key"})
		}

		// Register if first time
		if data == nil {
			ip := fmt.Sprintf("10.0.0.%d", nextIP)
			nextIP++

			data = &AgentData{
				IP:        ip,
				PublicKey: req.PublicKey,
			}
			validKeys[req.Key] = data

			// Add peer to Wireguard
			addPeerToWireguard(req.PublicKey, ip)
		} else {
			// If already registered
			if data.PublicKey != req.PublicKey {
				// Handle Key Rotation:
				// 1. Remove old peer from Wireguard
				removePeerFromWireguard(data.PublicKey)

				// 2. Update data
				log.Printf("Key rotation for agent %s: %s -> %s", req.Key, data.PublicKey, req.PublicKey)
				data.PublicKey = req.PublicKey

				// 3. Add new peer
				addPeerToWireguard(req.PublicKey, data.IP)
			}
		}

		return c.JSON(fiber.Map{
			"status": "connected",
			"vpn": fiber.Map{
				"endpoint":       "127.0.0.1:51820",                              // In real world this would be public IP
				"server_pub_key": "8Jxz+AhkWA1ul56CSK5E2UtBMsBuLFARuTAiovNTOg4=", // derived from server priv key
				"allowed_ips":    "10.0.0.0/24",
				"assigned_ip":    data.IP + "/32",
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
