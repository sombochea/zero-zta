package handlers

import (
	"github.com/cubetiq/zero-zta/backend/internal/db"
	"github.com/cubetiq/zero-zta/backend/internal/models"
	"github.com/gofiber/fiber/v3"
)

// ListPolicies returns all policies
func ListPolicies(c fiber.Ctx) error {
	var policies []models.Policy
	if err := db.DB.Preload("SourceGroup").Preload("DestGroup").Find(&policies).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(policies)
}

// CreatePolicy creates a new policy
func CreatePolicy(c fiber.Ctx) error {
	var policy models.Policy
	if err := c.Bind().Body(&policy); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if policy.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}

	if err := db.DB.Create(&policy).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(policy)
}

// GetPolicy returns policy by ID
func GetPolicy(c fiber.Ctx) error {
	id := c.Params("id")
	var policy models.Policy
	if err := db.DB.Preload("SourceGroup").Preload("DestGroup").First(&policy, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Policy not found"})
	}
	return c.JSON(policy)
}

// UpdatePolicy updates a policy
func UpdatePolicy(c fiber.Ctx) error {
	id := c.Params("id")
	var policy models.Policy
	if err := db.DB.First(&policy, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Policy not found"})
	}

	var updates models.Policy
	if err := c.Bind().Body(&updates); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	db.DB.Model(&policy).Updates(updates)
	return c.JSON(policy)
}

// DeletePolicy soft deletes a policy
func DeletePolicy(c fiber.Ctx) error {
	id := c.Params("id")
	if err := db.DB.Delete(&models.Policy{}, id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
