package service

import (
	"log"
	"time"

	"github.com/cubetiq/zero-zta/backend/internal/db"
	"github.com/cubetiq/zero-zta/backend/internal/models"
)

// StartAgentMonitor starts a background routine to check for stale agents
func StartAgentMonitor() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		checkStaleAgents()
	}
}

func checkStaleAgents() {
	// Threshold: Agents not seen in the last 30 seconds are considered offline
	// Heartbeat interval is 5s, so 30s is generous (6 missed heartbeats)
	threshold := time.Now().Add(-30 * time.Second)

	var agents []models.Agent
	if err := db.DB.Where("status = ? AND last_seen < ?", "online", threshold).Find(&agents).Error; err != nil {
		log.Printf("Error querying stale agents: %v", err)
		return
	}

	for _, agent := range agents {
		log.Printf("Marking agent %s (ID: %d) as offline. Last seen: %v", agent.Name, agent.ID, agent.LastSeen)

		// Update status to offline
		agent.Status = "offline"
		if err := db.DB.Save(&agent).Error; err != nil {
			log.Printf("Failed to update agent status: %v", err)
		}
	}
}
