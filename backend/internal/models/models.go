package models

import (
	"time"

	"gorm.io/gorm"
)

type Agent struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Name      string     `gorm:"size:255" json:"name"`
	APIKey    string     `gorm:"uniqueIndex;size:64" json:"api_key,omitempty"`
	PublicKey string     `gorm:"size:64" json:"public_key,omitempty"`
	IP        string     `gorm:"size:32" json:"ip"`
	Status    string     `gorm:"size:32;default:'offline'" json:"status"` // online, offline
	LastSeen  *time.Time `json:"last_seen,omitempty"`
	GroupID   *uint      `json:"group_id,omitempty"`
	Group     *Group     `gorm:"foreignKey:GroupID" json:"group,omitempty"`

	// Enhanced fields
	Routes   string    `gorm:"size:1024" json:"routes,omitempty"` // JSON array of local subnets e.g., ["192.168.1.0/24"]
	Services []Service `gorm:"foreignKey:AgentID" json:"services,omitempty"`
}

type Service struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	AgentID     uint   `gorm:"index" json:"agent_id"`
	Agent       *Agent `gorm:"foreignKey:AgentID" json:"-"`
	Name        string `gorm:"size:255" json:"name"` // e.g., "MySQL", "Redis"
	Description string `gorm:"size:512" json:"description"`
	Port        int    `json:"port"`                                  // e.g., 3306
	Protocol    string `gorm:"size:16;default:'tcp'" json:"protocol"` // tcp, udp
	LocalAddr   string `gorm:"size:128" json:"local_addr,omitempty"`  // optional: 127.0.0.1:3306
	Enabled     bool   `gorm:"default:true" json:"enabled"`
}

type AuditLog struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	AgentID   *uint  `gorm:"index" json:"agent_id,omitempty"`
	Agent     *Agent `gorm:"foreignKey:AgentID" json:"agent,omitempty"`
	Action    string `gorm:"size:64;index" json:"action"` // connected, disconnected, key_rotated, service_added, etc.
	Details   string `gorm:"type:text" json:"details"`    // JSON metadata
	IPAddress string `gorm:"size:64" json:"ip_address,omitempty"`
	UserAgent string `gorm:"size:256" json:"user_agent,omitempty"`
}

type Group struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Name        string  `gorm:"size:255;uniqueIndex" json:"name"`
	Description string  `gorm:"size:1024" json:"description"`
	Agents      []Agent `gorm:"foreignKey:GroupID" json:"agents,omitempty"`
}

type Policy struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Name          string `gorm:"size:255" json:"name"`
	Description   string `gorm:"size:1024" json:"description"`
	SourceGroupID uint   `json:"source_group_id"`
	SourceGroup   Group  `gorm:"foreignKey:SourceGroupID" json:"source_group,omitempty"`
	DestGroupID   uint   `json:"dest_group_id"`
	DestGroup     Group  `gorm:"foreignKey:DestGroupID" json:"dest_group,omitempty"`
	AllowedPorts  string `gorm:"size:512" json:"allowed_ports"`         // e.g., "80,443,22" or "*"
	Action        string `gorm:"size:32;default:'allow'" json:"action"` // allow, deny
	Enabled       bool   `gorm:"default:true" json:"enabled"`
}
