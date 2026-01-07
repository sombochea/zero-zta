package handlers

import (
	"github.com/cubetiq/zero-zta/backend/internal/db"
	"github.com/cubetiq/zero-zta/backend/internal/models"
	"github.com/gofiber/fiber/v3"
)

// ListGroups returns all groups
func ListGroups(c fiber.Ctx) error {
	var groups []models.Group
	if err := db.DB.Preload("Agents").Find(&groups).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.JSON(groups)
}

// CreateGroup creates a new group
func CreateGroup(c fiber.Ctx) error {
	var group models.Group
	if err := c.Bind().Body(&group); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if group.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}

	if err := db.DB.Create(&group).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(group)
}

// GetGroup returns group by ID with agents
func GetGroup(c fiber.Ctx) error {
	id := c.Params("id")
	var group models.Group
	if err := db.DB.Preload("Agents").First(&group, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Group not found"})
	}
	return c.JSON(group)
}

// UpdateGroup updates a group
func UpdateGroup(c fiber.Ctx) error {
	id := c.Params("id")
	var group models.Group
	if err := db.DB.First(&group, id).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Group not found"})
	}

	var updates models.Group
	if err := c.Bind().Body(&updates); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	db.DB.Model(&group).Updates(updates)
	return c.JSON(group)
}

// DeleteGroup soft deletes a group
func DeleteGroup(c fiber.Ctx) error {
	id := c.Params("id")
	if err := db.DB.Delete(&models.Group{}, id).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	return c.SendStatus(204)
}
