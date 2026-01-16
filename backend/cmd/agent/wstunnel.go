package main

import (
	"crypto/tls"
	"encoding/binary"
	"fmt"
	"io"
	"log"
	"net"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// WSTunnelClient manages WebSocket tunnel connection to server
type WSTunnelClient struct {
	serverURL  string
	apiKey     string
	insecure   bool
	conn       *websocket.Conn
	udpConn    *net.UDPConn // Local UDP listener for WireGuard
	writeMu    sync.Mutex
	done       chan struct{}
	clientAddr *net.UDPAddr // Last known WireGuard client address
}

// NewWSTunnelClient creates a new WebSocket tunnel client
func NewWSTunnelClient(tunnelURL, apiKey string, insecure bool) *WSTunnelClient {
	return &WSTunnelClient{
		serverURL: tunnelURL,
		apiKey:    apiKey,
		insecure:  insecure,
		done:      make(chan struct{}),
	}
}

// Connect establishes the WebSocket tunnel
func (c *WSTunnelClient) Connect() error {
	// Parse tunnel URL
	u, err := url.Parse(c.serverURL)
	if err != nil {
		return fmt.Errorf("invalid tunnel URL: %w", err)
	}

	// Ensure scheme is valid for WebSocket
	if u.Scheme == "https" {
		u.Scheme = "wss"
	} else if u.Scheme == "http" {
		u.Scheme = "ws"
	}

	// Add path if missing
	if u.Path == "" || u.Path == "/" {
		u.Path = "/ws/tunnel"
	}

	// Add API key query param
	q := u.Query()
	q.Set("key", c.apiKey)
	u.RawQuery = q.Encode()

	wsURL := u.String()

	// Configure dialer
	dialer := websocket.Dialer{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: c.insecure,
		},
		HandshakeTimeout: 10 * time.Second,
	}

	log.Printf("Connecting to WebSocket tunnel: %s...", u.Host)
	conn, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		return fmt.Errorf("WebSocket dial failed: %w", err)
	}

	c.conn = conn
	log.Printf("WebSocket tunnel established")
	return nil
}

// StartLocalUDPProxy starts a local UDP listener that the WireGuard device can connect to
func (c *WSTunnelClient) StartLocalUDPProxy(localPort int) (*net.UDPAddr, error) {
	addr := &net.UDPAddr{IP: net.ParseIP("127.0.0.1"), Port: localPort}
	udpConn, err := net.ListenUDP("udp", addr)
	if err != nil {
		return nil, fmt.Errorf("failed to start UDP proxy: %w", err)
	}

	c.udpConn = udpConn
	actualAddr := udpConn.LocalAddr().(*net.UDPAddr)
	log.Printf("Local UDP proxy listening on %s", actualAddr)

	return actualAddr, nil
}

// Run starts bidirectional forwarding between local UDP and WebSocket
func (c *WSTunnelClient) Run() error {
	if c.conn == nil {
		return fmt.Errorf("not connected")
	}
	if c.udpConn == nil {
		return fmt.Errorf("UDP proxy not started")
	}

	var wg sync.WaitGroup
	errChan := make(chan error, 2)

	// Forward UDP to WebSocket
	wg.Add(1)
	go func() {
		defer wg.Done()
		buf := make([]byte, 65535)

		for {
			select {
			case <-c.done:
				return
			default:
			}

			c.udpConn.SetReadDeadline(time.Now().Add(30 * time.Second))
			n, addr, err := c.udpConn.ReadFromUDP(buf)
			if err != nil {
				if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
					continue
				}
				if err != io.EOF {
					errChan <- fmt.Errorf("UDP read error: %w", err)
				}
				return
			}

			// Store client address for response routing
			c.writeMu.Lock()
			c.clientAddr = addr
			c.writeMu.Unlock()

			// Write to WebSocket
			// Note: We use c.conn.WriteMessage directly which is not thread safe if multiple writers
			// But here we have one writer goroutine (this one)?
			// Wait, c.conn.WriteMessage IS thread safe for concurrent WriteMessage/ReadMessage,
			// but we need to ensure one write at a time if we had multiple sources.
			// Ideally we protect the socket write.
			// Let's assume gorilla/websocket allows one concurrent write.
			// We already had c.writeMu in struct but we used it for c.clientAddr now.
			// Let's split locks or just use a separate lock for address.
			// Actually, gorilla/websocket WriteMessage is NOT thread safe.
			// The original code used c.writeMu for WriteMessage. Correct.

			c.writeMu.Lock()
			err = c.conn.WriteMessage(websocket.BinaryMessage, buf[:n])
			c.writeMu.Unlock()

			if err != nil {
				errChan <- fmt.Errorf("WebSocket write error: %w", err)
				return
			}
		}
	}()

	// Forward WebSocket to UDP
	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-c.done:
				return
			default:
			}

			messageType, data, err := c.conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					errChan <- fmt.Errorf("WebSocket read error: %w", err)
				}
				return
			}

			if messageType != websocket.BinaryMessage {
				continue
			}

			// Send to WireGuard (respond to last known client)
			c.writeMu.Lock()
			destAddr := c.clientAddr
			c.writeMu.Unlock()

			if destAddr != nil {
				_, err = c.udpConn.WriteToUDP(data, destAddr)
				if err != nil {
					log.Printf("UDP write error: %v", err)
				}
			} else {
				// Drop packet if we haven't seen a client yet (shouldn't happen as Agent initiates)
				// log.Printf("Warning: Dropping packet, no client address known")
			}
		}
	}()

	// Wait for error or done signal
	select {
	case err := <-errChan:
		close(c.done)
		return err
	case <-c.done:
		return nil
	}
}

// Close closes the tunnel
func (c *WSTunnelClient) Close() {
	close(c.done)
	if c.conn != nil {
		c.conn.Close()
	}
	if c.udpConn != nil {
		c.udpConn.Close()
	}
}

// EncodePacket adds length header for framing
func EncodePacket(data []byte) []byte {
	result := make([]byte, 2+len(data))
	binary.BigEndian.PutUint16(result[:2], uint16(len(data)))
	copy(result[2:], data)
	return result
}
