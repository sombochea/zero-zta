package tunnel

import (
	"encoding/binary"
	"io"
	"log"
	"net"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// WSClient represents a connected WebSocket client for tunneling
type WSClient struct {
	Conn      *websocket.Conn
	AgentID   uint
	PublicKey string
	UDPConn   *net.UDPConn // Connection to local WireGuard
	writeMu   sync.Mutex
	done      chan struct{}
}

// WSTunnelServer manages WebSocket tunnels for WireGuard traffic
type WSTunnelServer struct {
	clients   map[string]*WSClient // keyed by public key
	clientsMu sync.RWMutex
	wgAddr    *net.UDPAddr // WireGuard server address
}

// NewWSTunnelServer creates a new WebSocket tunnel server
func NewWSTunnelServer(wgHost string, wgPort int) (*WSTunnelServer, error) {
	addr, err := net.ResolveUDPAddr("udp", net.JoinHostPort(wgHost, string(rune(wgPort))))
	if err != nil {
		// Use simple format
		addr = &net.UDPAddr{IP: net.ParseIP(wgHost), Port: wgPort}
	}

	return &WSTunnelServer{
		clients: make(map[string]*WSClient),
		wgAddr:  addr,
	}, nil
}

// HandleConnection handles a new WebSocket connection for tunneling
func (s *WSTunnelServer) HandleConnection(wsConn *websocket.Conn, agentID uint, publicKey string) {
	// Create UDP connection to WireGuard
	udpConn, err := net.DialUDP("udp", nil, s.wgAddr)
	if err != nil {
		log.Printf("Failed to connect to WireGuard: %v", err)
		wsConn.Close()
		return
	}

	client := &WSClient{
		Conn:      wsConn,
		AgentID:   agentID,
		PublicKey: publicKey,
		UDPConn:   udpConn,
		done:      make(chan struct{}),
	}

	s.clientsMu.Lock()
	s.clients[publicKey] = client
	s.clientsMu.Unlock()

	log.Printf("WebSocket tunnel established for agent %d (key: %s...)", agentID, publicKey[:8])

	// Start bidirectional forwarding
	go s.forwardWSToUDP(client)
	go s.forwardUDPToWS(client)

	// Wait for connection to close
	<-client.done

	s.clientsMu.Lock()
	delete(s.clients, publicKey)
	s.clientsMu.Unlock()

	udpConn.Close()
	log.Printf("WebSocket tunnel closed for agent %d", agentID)
}

// forwardWSToUDP forwards WebSocket messages to WireGuard UDP
func (s *WSTunnelServer) forwardWSToUDP(client *WSClient) {
	defer close(client.done)

	for {
		messageType, data, err := client.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			return
		}

		if messageType != websocket.BinaryMessage {
			continue
		}

		// Forward to WireGuard
		_, err = client.UDPConn.Write(data)
		if err != nil {
			log.Printf("UDP write error: %v", err)
			return
		}
	}
}

// forwardUDPToWS forwards WireGuard UDP packets to WebSocket
func (s *WSTunnelServer) forwardUDPToWS(client *WSClient) {
	buf := make([]byte, 65535)

	for {
		select {
		case <-client.done:
			return
		default:
		}

		client.UDPConn.SetReadDeadline(time.Now().Add(30 * time.Second))
		n, err := client.UDPConn.Read(buf)
		if err != nil {
			if netErr, ok := err.(net.Error); ok && netErr.Timeout() {
				continue
			}
			if err != io.EOF {
				log.Printf("UDP read error: %v", err)
			}
			return
		}

		client.writeMu.Lock()
		err = client.Conn.WriteMessage(websocket.BinaryMessage, buf[:n])
		client.writeMu.Unlock()

		if err != nil {
			log.Printf("WebSocket write error: %v", err)
			return
		}
	}
}

// EncodePacket wraps a UDP packet with a length header for framing
func EncodePacket(data []byte) []byte {
	result := make([]byte, 2+len(data))
	binary.BigEndian.PutUint16(result[:2], uint16(len(data)))
	copy(result[2:], data)
	return result
}

// GetClientCount returns the number of active tunnel clients
func (s *WSTunnelServer) GetClientCount() int {
	s.clientsMu.RLock()
	defer s.clientsMu.RUnlock()
	return len(s.clients)
}
