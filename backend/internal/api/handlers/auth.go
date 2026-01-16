package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/url"

	"github.com/cubetiq/zero-zta/backend/internal/db"
	"github.com/cubetiq/zero-zta/backend/internal/models"
	"github.com/gofiber/fiber/v3"
)

// StartClaim initiates a device claiming process (Agent -> Server)
func StartClaim(c fiber.Ctx) error {
	type StartClaimRequest struct {
		PublicKey string `json:"public_key"`
		Hostname  string `json:"hostname"`
	}

	var req StartClaimRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Generate random token
	tokenBytes := make([]byte, 32)
	rand.Read(tokenBytes)
	token := hex.EncodeToString(tokenBytes)

	claim := models.DeviceClaim{
		Token:     token,
		PublicKey: req.PublicKey,
		Hostname:  req.Hostname,
		IP:        c.IP(),
		Status:    "pending",
	}

	if err := db.DB.Create(&claim).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create claim"})
	}

	// Construct claim URL (pointing to frontend)
	// Assuming frontend is at referrer or configured origin, but for now hardcoded or derived
	dashboardURL := "http://localhost:3001" // TODO: Make configurable
	claimURL := fmt.Sprintf("%s/claim?token=%s", dashboardURL, token)

	return c.JSON(fiber.Map{
		"token":     token,
		"claim_url": claimURL,
		"status":    "pending",
	})
}

// GetClaimStatus checks the status of a claim (Agent -> Server polling)
func GetClaimStatus(c fiber.Ctx) error {
	token := c.Query("token")
	if token == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Token required"})
	}

	var claim models.DeviceClaim
	if err := db.DB.Where("token = ?", token).First(&claim).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Claim not found"})
	}

	if claim.Status == "approved" {
		// If approved, we need to return the API key.
		// In a real flow, we'd generate a long-lived API Key bound to the user here.
		// For now, let's look up if an agent exists or create one.

		// Check if agent already exists with this public key
		var agent models.Agent
		if err := db.DB.Where("public_key = ?", claim.PublicKey).First(&agent).Error; err != nil {
			// Create new agent
			apiKeyBytes := make([]byte, 32)
			rand.Read(apiKeyBytes)
			apiKey := "sk_live_" + hex.EncodeToString(apiKeyBytes)

			agent = models.Agent{
				Name:      claim.Hostname,
				PublicKey: claim.PublicKey,
				APIKey:    apiKey,
				Status:    "offline", // Will propagate to online on connect
				UserID:    claim.UserID,
				// Assign IP later on connect
			}
			db.DB.Create(&agent)
		} else {
			// Update user binding if needed
			if agent.UserID == nil && claim.UserID != nil {
				agent.UserID = claim.UserID
				db.DB.Save(&agent)
			}
		}

		return c.JSON(fiber.Map{
			"status":  "approved",
			"api_key": agent.APIKey,
		})
	}

	return c.JSON(fiber.Map{
		"status": claim.Status,
	})
}

// GetClaimDetails returns claim info for the user approval page (Frontend -> Server)
func GetClaimDetails(c fiber.Ctx) error {
	token := c.Query("token")
	if token == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Token required"})
	}

	var claim models.DeviceClaim
	if err := db.DB.Where("token = ?", token).First(&claim).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Claim not found"})
	}

	return c.JSON(claim)
}

// ApproveClaim allows a user to approve a device claim (Frontend -> Server)
func ApproveClaim(c fiber.Ctx) error {
	type ApproveRequest struct {
		Token string `json:"token"`
		Email string `json:"email"` // Mock identity for now
	}

	var req ApproveRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// 1. Find or Create User (Mock User Auth)
	// In real OIDC, the user ID would come from the session/token context
	var user models.User
	if err := db.DB.Where("email = ?", req.Email).FirstOrCreate(&user, models.User{
		Email:    req.Email,
		Provider: "mock",
		Role:     "user",
	}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to resolve user"})
	}

	// 2. Update Claim
	result := db.DB.Model(&models.DeviceClaim{}).
		Where("token = ? AND status = 'pending'", req.Token).
		Updates(map[string]interface{}{
			"status":  "approved",
			"user_id": user.ID,
		})

	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Claim invalid or already processed"})
	}

	return c.JSON(fiber.Map{
		"status": "approved",
		"user":   user.Email,
	})
}

// MockLogin performs a dev-mode login (Frontend -> Server)
func MockLogin(c fiber.Ctx) error {
	type LoginRequest struct {
		Email string `json:"email"`
	}
	var req LoginRequest
	if err := c.Bind().Body(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Just return success for dev mode
	return c.JSON(fiber.Map{
		"token": "dev-token-" + url.QueryEscape(req.Email),
		"user": fiber.Map{
			"email": req.Email,
			"role":  "admin",
		},
	})
}
