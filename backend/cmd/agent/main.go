package main

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"golang.org/x/crypto/curve25519"

	"golang.zx2c4.com/wireguard/conn"
	"golang.zx2c4.com/wireguard/device"
	"golang.zx2c4.com/wireguard/tun/netstack"
)

func main() {
	apiKey := flag.String("key", "", "API Key for authentication")
	serverURL := flag.String("server", "http://127.0.0.1:3000", "Control Server URL")
	tunnelMode := flag.String("tunnel", "", "Tunnel mode: 'ws' for WebSocket (firewall bypass)")
	tunnelURL := flag.String("tunnel-url", "", "WebSocket tunnel URL (default: derives from server URL but uses port 443)")
	insecureFlag := flag.Bool("insecure", false, "Skip TLS verification (dev only)")
	flag.Parse()

	interfaceName := "wg0"
	fmt.Printf("Starting Zero ZTA Agent on interface %s...\n", interfaceName)

	// Generate Ephemeral Private Key (once per session, or rotate on reconnect? let's keep it for now)
	privKey, pubKey := generateKeyPair()
	log.Printf("Agent Public Key: %s", pubKey)

	// Check if API Key is provided, if not, start interactive claiming flow
	if *apiKey == "" {
		fmt.Println("No API Key provided. Starting Device Claiming Workflow...")
		key, err := performDeviceClaim(*serverURL, "", pubKey)
		if err != nil {
			log.Fatalf("Device claiming failed: %v", err)
		}
		*apiKey = key
		fmt.Println("Got API Key! Connecting...")
	}

	// Wait for interrupt signal to cleanup
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)

	// Main Agent Loop
	for {
		log.Printf("Connecting to %s...", *serverURL)
		err := runAgent(*serverURL, *tunnelURL, *apiKey, privKey, pubKey, interfaceName, *tunnelMode, *insecureFlag, c)
		if err != nil {
			log.Printf("Agent disconnected or failed: %v", err)
		}

		select {
		case <-c:
			log.Println("Shutting down agent...")
			return
		case <-time.After(5 * time.Second):
			log.Println("Reconnecting in 5 seconds...")
			continue
		}
	}
}

func runAgent(serverURL, tunnelURL, apiKey, privKey, pubKey, interfaceName, tunnelMode string, insecure bool, sigChan chan os.Signal) error {
	// Connect to control server to get VPN config
	vpnConfig, err := connectToServer(serverURL, apiKey, pubKey)
	if err != nil {
		return fmt.Errorf("connect failed: %v", err)
	}

	log.Printf("Received VPN Config: Endpoint=%s, AssignedIP=%s", vpnConfig.Endpoint, vpnConfig.AssignedIP)

	// Parse IP
	prefix, err := netip.ParsePrefix(vpnConfig.AssignedIP)
	if err != nil {
		return fmt.Errorf("failed to parse IP %s: %v", vpnConfig.AssignedIP, err)
	}
	tunAddr := prefix.Addr()

	// Create userspace TUN
	tun, tnet, err := netstack.CreateNetTUN(
		[]netip.Addr{tunAddr},
		[]netip.Addr{netip.MustParseAddr("8.8.8.8")},
		device.DefaultMTU,
	)
	if err != nil {
		return fmt.Errorf("failed to create TUN: %v", err)
	}

	// Logging
	logger := device.NewLogger(device.LogLevelError, fmt.Sprintf("(%s) ", interfaceName))

	// Start Internal Service
	// We need a done channel to stop this goroutine if runAgent returns
	// But netstack ListenTCP listeners are closed when tnet is gone?
	// Actually tnet isn't closed explicitly, but the device close might help.
	go func() {
		tcpAddr, _ := net.ResolveTCPAddr("tcp", ":80")
		listener, err := tnet.ListenTCP(tcpAddr)
		if err != nil {
			log.Printf("Failed to listen on internal port 80: %v", err)
			return
		}
		defer listener.Close()

		mux := http.NewServeMux()
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintf(w, `{"message": "Hello from Agent", "ip": "%s", "time": "%s"}`, vpnConfig.AssignedIP, time.Now().Format(time.RFC3339))
		})

		http.Serve(listener, mux)
	}()

	// WireGuard Device
	dev := device.NewDevice(tun, conn.NewDefaultBind(), logger)

	// Determine WireGuard endpoint
	wgEndpoint := vpnConfig.Endpoint

	// If using WebSocket tunnel, start tunnel and override endpoint
	var wsTunnel *WSTunnelClient
	if tunnelMode == "ws" {
		log.Println("WebSocket tunnel mode enabled - bypassing firewall...")

		// Determine Tunnel URL
		effectiveTunnelURL := tunnelURL
		if effectiveTunnelURL == "" {
			// Default to deriving from server URL but change port to 443 for localhost dev
			// In a real env, we might expect identical hostname/port or explicit config
			u, _ := url.Parse(serverURL)
			if u.Port() == "3000" {
				// Dev mode assumption: If API is 3000, Tunnel might be 443
				effectiveTunnelURL = fmt.Sprintf("wss://%s:443/ws/tunnel", u.Hostname())
			} else {
				// Otherwise assume same host/port
				scheme := "wss"
				if u.Scheme == "http" {
					scheme = "ws"
				}
				effectiveTunnelURL = fmt.Sprintf("%s://%s/ws/tunnel", scheme, u.Host)
			}
		}

		// For WS tunnel, we connect via HTTPS (typically port 443)
		// and route WireGuard through the WebSocket
		wsTunnel = NewWSTunnelClient(effectiveTunnelURL, apiKey, insecure)
		if err := wsTunnel.Connect(); err != nil {
			return fmt.Errorf("WebSocket tunnel failed: %v", err)
		}

		// Start local UDP proxy for WireGuard to connect to
		localAddr, err := wsTunnel.StartLocalUDPProxy(0) // Random port
		if err != nil {
			wsTunnel.Close()
			return fmt.Errorf("failed to start local proxy: %v", err)
		}

		// Override WireGuard endpoint to use local proxy
		wgEndpoint = localAddr.String()
		log.Printf("WireGuard routed through WebSocket tunnel via %s", wgEndpoint)

		// Start tunnel forwarding in background
		go func() {
			if err := wsTunnel.Run(); err != nil {
				log.Printf("WebSocket tunnel error: %v", err)
			}
		}()
	}

	uapiConfig := fmt.Sprintf(`private_key=%s
public_key=%s
allowed_ip=%s
endpoint=%s
persistent_keepalive_interval=25
`,
		hexKey(privKey),
		hexKey(vpnConfig.ServerPubKey),
		vpnConfig.AllowedIPs,
		wgEndpoint,
	)

	if err := dev.IpcSet(uapiConfig); err != nil {
		dev.Close()
		return fmt.Errorf("failed to configure device: %v", err)
	}

	if err := dev.Up(); err != nil {
		dev.Close()
		return fmt.Errorf("failed to bring up device: %v", err)
	}

	log.Printf("VPN Tunnel Established. IP: %s", vpnConfig.AssignedIP)

	// Heartbeat Loop
	heartbeatTicker := time.NewTicker(5 * time.Second)
	defer heartbeatTicker.Stop()

	// Error channel to prompt reconnection if heartbeat fails continuously
	errChan := make(chan error, 1)

	go func() {
		failedCount := 0
		for range heartbeatTicker.C {
			if err := sendHeartbeat(serverURL, apiKey); err != nil {
				log.Printf("Heartbeat failed: %v", err)
				failedCount++
				if failedCount > 5 {
					errChan <- fmt.Errorf("too many heartbeat failures")
					return
				}
			} else {
				failedCount = 0
			}
		}
	}()

	select {
	case <-sigChan:
		dev.Close()
		return nil // User requested exit, handled in main
	case err := <-errChan:
		dev.Close()
		return err
	}
}

var lastHeartbeatLatency int64

func sendHeartbeat(serverURL, apiKey string) error {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)

	// Collect device posture for Zero Trust verification
	posture := CollectDevicePosture()

	payload := map[string]interface{}{
		"api_key":              apiKey,
		"heartbeat_latency_ms": lastHeartbeatLatency,
		"bytes_sent":           0, // TODO: Get from device stats if possible
		"bytes_received":       0,
		"active_connections":   0,
		"cpu_usage":            float64(runtime.NumGoroutine()), // Proxy for load
		"memory_usage":         float64(m.Alloc) / 1024 / 1024,  // MB
		// Device posture data for Zero Trust
		"posture": map[string]interface{}{
			"os_name":             posture.OSName,
			"os_version":          posture.OSVersion,
			"hostname":            posture.Hostname,
			"antivirus_enabled":   posture.AntivirusEnabled,
			"antivirus_name":      posture.AntivirusName,
			"firewall_enabled":    posture.FirewallEnabled,
			"disk_encrypted":      posture.DiskEncrypted,
			"screen_lock_enabled": posture.ScreenLockEnabled,
			"posture_score":       posture.PostureScore,
		},
	}

	jsonBody, _ := json.Marshal(payload)
	client := &http.Client{Timeout: 3 * time.Second}

	start := time.Now()
	resp, err := client.Post(serverURL+"/api/v1/agents/heartbeat", "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Update latency for next heartbeat
	lastHeartbeatLatency = time.Since(start).Milliseconds()

	if resp.StatusCode != 200 {
		return fmt.Errorf("status %d", resp.StatusCode)
	}
	return nil
}

type VPNConfig struct {
	Endpoint     string `json:"endpoint"`
	ServerPubKey string `json:"server_pub_key"`
	AllowedIPs   string `json:"allowed_ips"`
	AssignedIP   string `json:"assigned_ip"`
}

func connectToServer(baseURL, apiKey, pubKey string) (*VPNConfig, error) {
	reqBody := map[string]string{
		"key":        apiKey,
		"public_key": pubKey,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	client := &http.Client{
		Timeout: 5 * time.Second,
	}

	resp, err := client.Post(baseURL+"/api/v1/agent/connect", "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("server returned status: %d", resp.StatusCode)
	}

	var apiResp struct {
		Status string     `json:"status"`
		VPN    *VPNConfig `json:"vpn"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode response: %v", err)
	}

	if apiResp.VPN == nil {
		return nil, fmt.Errorf("server did not return VPN config")
	}

	return apiResp.VPN, nil
}

func generateKeyPair() (string, string) {
	var privateKey [32]byte
	_, err := rand.Read(privateKey[:])
	if err != nil {
		panic(err)
	}
	privateKey[0] &= 248
	privateKey[31] &= 127
	privateKey[31] |= 64
	var publicKey [32]byte
	curve25519.ScalarBaseMult(&publicKey, &privateKey)
	return base64.StdEncoding.EncodeToString(privateKey[:]), base64.StdEncoding.EncodeToString(publicKey[:])
}

func hexKey(b64 string) string {
	k, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		// Log but don't panic, return empty or handle gracefully?
		// Actually panic is fine for now as it's critical config
		log.Panicf("Invalid key %s: %v", b64, err)
	}
	return hex.EncodeToString(k)
}
