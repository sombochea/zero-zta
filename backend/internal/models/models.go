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

	Name        string     `gorm:"size:255" json:"name"`
	Description string     `gorm:"size:1024" json:"description,omitempty"`
	APIKey      string     `gorm:"uniqueIndex;size:64" json:"api_key,omitempty"`
	PublicKey   string     `gorm:"size:64" json:"public_key,omitempty"`
	IP          string     `gorm:"size:32" json:"ip"`
	Status      string     `gorm:"size:32;default:'offline'" json:"status"` // online, offline
	LastSeen    *time.Time `json:"last_seen,omitempty"`
	GroupID     *uint      `json:"group_id,omitempty"`
	Group       *Group     `gorm:"foreignKey:GroupID" json:"group,omitempty"`

	// Enhanced fields
	Routes   string    `gorm:"size:1024" json:"routes,omitempty"` // JSON array of local subnets
	Services []Service `gorm:"foreignKey:AgentID" json:"services,omitempty"`
	UserID   *uint     `json:"user_id,omitempty"`
	User     *User     `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type User struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	Email    string  `gorm:"uniqueIndex;size:255" json:"email"`
	Provider string  `gorm:"size:64" json:"provider"`            // google, github, local
	Role     string  `gorm:"size:32;default:'user'" json:"role"` // admin, user
	Agents   []Agent `gorm:"foreignKey:UserID" json:"agents,omitempty"`
}

type DeviceClaim struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	Token     string `gorm:"uniqueIndex;size:64" json:"token"`
	PublicKey string `gorm:"size:64" json:"public_key"`
	Status    string `gorm:"size:32;default:'pending'" json:"status"` // pending, approved, rejected
	IP        string `gorm:"size:64" json:"ip"`
	Hostname  string `gorm:"size:64" json:"hostname"`
	UserID    *uint  `json:"user_id,omitempty"`
}

type Service struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	AgentID     uint   `gorm:"index" json:"agent_id"`
	Agent       *Agent `gorm:"foreignKey:AgentID" json:"-"`
	Name        string `gorm:"size:255" json:"name"`
	Description string `gorm:"size:512" json:"description"`
	Port        int    `json:"port"`
	Protocol    string `gorm:"size:16;default:'tcp'" json:"protocol"`
	LocalAddr   string `gorm:"size:128" json:"local_addr,omitempty"`
	Enabled     bool   `gorm:"default:true" json:"enabled"`
}

type AuditLog struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	AgentID   *uint  `gorm:"index" json:"agent_id,omitempty"`
	Agent     *Agent `gorm:"foreignKey:AgentID" json:"agent,omitempty"`
	Action    string `gorm:"size:64;index" json:"action"`
	Details   string `gorm:"type:text" json:"details"`
	IPAddress string `gorm:"size:64" json:"ip_address,omitempty"`
	UserAgent string `gorm:"size:256" json:"user_agent,omitempty"`
}

// AccessLog tracks inter-agent connections
type AccessLog struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	SourceAgentID uint     `gorm:"index" json:"source_agent_id"`
	SourceAgent   *Agent   `gorm:"foreignKey:SourceAgentID" json:"source_agent,omitempty"`
	DestAgentID   uint     `gorm:"index" json:"dest_agent_id"`
	DestAgent     *Agent   `gorm:"foreignKey:DestAgentID" json:"dest_agent,omitempty"`
	ServiceID     *uint    `json:"service_id,omitempty"`
	Service       *Service `gorm:"foreignKey:ServiceID" json:"service,omitempty"`
	Action        string   `gorm:"size:32" json:"action"` // allowed, denied
	Port          int      `json:"port"`
	Protocol      string   `gorm:"size:16" json:"protocol"`
	BytesSent     int64    `json:"bytes_sent"`
	BytesReceived int64    `json:"bytes_received"`
	Duration      int64    `json:"duration_ms"` // milliseconds
}

// AgentMetrics stores health and traffic metrics
type AgentMetrics struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`

	AgentID           uint    `gorm:"index" json:"agent_id"`
	Agent             *Agent  `gorm:"foreignKey:AgentID" json:"-"`
	HeartbeatLatency  int     `json:"heartbeat_latency_ms"` // ms
	BytesSent         int64   `json:"bytes_sent"`
	BytesReceived     int64   `json:"bytes_received"`
	ActiveConnections int     `json:"active_connections"`
	FailedConnections int     `json:"failed_connections"`
	CPUUsage          float64 `json:"cpu_usage,omitempty"`
	MemoryUsage       float64 `json:"memory_usage,omitempty"`
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
	AllowedPorts  string `gorm:"size:512" json:"allowed_ports"`
	Action        string `gorm:"size:32;default:'allow'" json:"action"`
	Enabled       bool   `gorm:"default:true" json:"enabled"`

	// Zero Trust: Time-based access control
	ValidFrom  *time.Time `json:"valid_from,omitempty"`
	ValidUntil *time.Time `json:"valid_until,omitempty"`

	// Zero Trust: Geo-restriction (comma-separated country codes)
	AllowedRegions string `gorm:"size:256" json:"allowed_regions,omitempty"`

	// Zero Trust: Require minimum posture score
	MinPostureScore int `gorm:"default:0" json:"min_posture_score"`
}

// DevicePosture stores security posture information for an agent
type DevicePosture struct {
	ID        uint      `gorm:"primarykey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	AgentID uint   `gorm:"uniqueIndex" json:"agent_id"`
	Agent   *Agent `gorm:"foreignKey:AgentID" json:"-"`

	// Operating System Info
	OSName    string `gorm:"size:64" json:"os_name"`
	OSVersion string `gorm:"size:64" json:"os_version"`
	Hostname  string `gorm:"size:128" json:"hostname"`

	// Security Status
	AntivirusEnabled  bool   `json:"antivirus_enabled"`
	AntivirusName     string `gorm:"size:128" json:"antivirus_name,omitempty"`
	FirewallEnabled   bool   `json:"firewall_enabled"`
	DiskEncrypted     bool   `json:"disk_encrypted"`
	ScreenLockEnabled bool   `json:"screen_lock_enabled"`

	// Patch Status
	LastPatchDate  *time.Time `json:"last_patch_date,omitempty"`
	PendingPatches int        `json:"pending_patches"`

	// Computed posture score (0-100)
	PostureScore int `json:"posture_score"`

	// Last check timestamp
	LastChecked *time.Time `json:"last_checked,omitempty"`
}
