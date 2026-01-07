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
	"os"
	"os/signal"
	"syscall"

	"golang.org/x/crypto/curve25519"

	"golang.zx2c4.com/wireguard/conn"
	"golang.zx2c4.com/wireguard/device"
	"golang.zx2c4.com/wireguard/tun/netstack"
)

func main() {
	apiKey := flag.String("key", "", "API Key for authentication")
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("API Key is required. Use --key <your_key>")
	}

	interfaceName := "wg0"
	fmt.Printf("Starting Zero ZTA Agent on interface %s...\n", interfaceName)

	// Generate Ephemeral Private Key
	privKey, pubKey := generateKeyPair()
	log.Printf("Agent Public Key: %s", pubKey)

	// Connect to control server to get VPN config
	vpnConfig, err := connectToServer("http://127.0.0.1:3000", *apiKey, pubKey)
	if err != nil {
		log.Fatalf("Failed to authenticate/connect: %v", err)
	}

	log.Printf("Received VPN Config: Endpoint=%s, PeerPubKey=%s, AssignedIP=%s",
		vpnConfig.Endpoint, vpnConfig.ServerPubKey, vpnConfig.AssignedIP)

	// create userspace TUN device via netstack
	// Setup IP addresses for the virtual interface
	// Protocol usually sends CIDR or just IP. Our server sends IP/32. netip.ParseAddr is strict.
	// Let's parse prefix if needed or assume format.
	// Actually netip.ParseAddr expects just IP.
	// We need to strip CIDR if present.

	// Better: Use ParsePrefix then Addr()
	prefix, err := netip.ParsePrefix(vpnConfig.AssignedIP)
	if err != nil {
		// Try parsing as Addr
		// log.Panicf("failed to parse IP: %v", err)
	}

	// Let's simplify and just handle what server sends.
	// Server sends "10.0.0.x/32".

	tunAddr := prefix.Addr()

	tun, tnet, err := netstack.CreateNetTUN(
		[]netip.Addr{tunAddr},
		[]netip.Addr{netip.MustParseAddr("8.8.8.8")},
		device.DefaultMTU,
	)
	if err != nil {
		log.Panicf("failed to create netstack TUN: %v", err)
	}

	// open logging
	logger := device.NewLogger(
		device.LogLevelVerbose,
		fmt.Sprintf("(%s) ", interfaceName),
	)

	// Start Internal Service on Agent VPN Interface
	go func() {
		tcpAddr, err := net.ResolveTCPAddr("tcp", ":80")
		if err != nil {
			logger.Errorf("Failed to resolve address: %v", err)
			return
		}

		listener, err := tnet.ListenTCP(tcpAddr)
		if err != nil {
			logger.Errorf("Failed to listen on VPN port 80: %v", err)
			return
		}

		mux := http.NewServeMux()
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			fmt.Fprintf(w, `{"message": "Hello from Agent", "ip": "%s"}`, vpnConfig.AssignedIP)
		})

		logger.Verbosef("Internal service started on VPN port 80")
		if err := http.Serve(listener, mux); err != nil {
			logger.Errorf("Internal service error: %v", err)
		}
	}()

	// Construct UAPI config
	uapiConfig := fmt.Sprintf(`private_key=%s
public_key=%s
allowed_ip=%s
endpoint=%s
persistent_keepalive_interval=25
`,
		hexKey(privKey),
		hexKey(vpnConfig.ServerPubKey),
		vpnConfig.AllowedIPs,
		vpnConfig.Endpoint,
	)

	// open logging (Moved up)

	// Create device (using default bind for agent to start ephemeral port)
	// Actually, netstack.CreateNetTUN returns a tun device that we pass to NewDevice.
	// But NewDevice ALSO needs a Bind.
	// For netstack, we usually use a bind that works with usage.
	// conn.NewDefaultBind() works for standard UDP sockets.
	dev := device.NewDevice(tun, conn.NewDefaultBind(), logger)

	// Configure device
	if err := dev.IpcSet(uapiConfig); err != nil {
		log.Panicf("Failed to configure agent device: %v", err)
	}

	// Bring up
	if err := dev.Up(); err != nil {
		log.Panicf("Failed to bring up agent device: %v", err)
	}

	// listen to uapi (user api) for configuration
	// Note: We use a local socket file to avoid permission issues with /var/run/wireguard
	// This allows the agent to be configured via UAPI if needed, but requires pointing tools to this socket.
	socketPath := "wg0.sock"
	os.Remove(socketPath) // clean up old socket

	uapiListener, err := net.Listen("unix", socketPath)
	if err != nil {
		log.Printf("Failed to create UAPI listener on %s: %v", socketPath, err)
	} else {
		logger.Verbosef("UAPI listener started on %s", socketPath)
		// accept connections
		go func() {
			for {
				conn, err := uapiListener.Accept()
				if err != nil {
					logger.Errorf("uapi accept failed: %v", err)
					continue
				}
				go dev.IpcHandle(conn)
			}
		}()
	}

	logger.Verbosef("Device started")

	// Connect to control server (Handled at startup now)
	/*
		go func() {
			// simple retry loop or just one attempt for now
			if err := connectToServer("http://127.0.0.1:3000"); err != nil {
				logger.Errorf("Failed to connect to server: %v", err)
			} else {
				logger.Verbosef("Connected to control server")
			}
		}()
	*/ // Removed old connect loop logic as we connect BEFORE starting device now

	// Wait for interrupt signal to cleanup
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

	logger.Verbosef("Shutting down")
	dev.Close()
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

	resp, err := http.Post(baseURL+"/api/v1/agent/connect", "application/json", bytes.NewBuffer(jsonBody))
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
		log.Panicf("Invalid key %s: %v", b64, err)
	}
	return hex.EncodeToString(k)
}
