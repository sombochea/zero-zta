package main

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-resty/resty/v2"
)

// performDeviceClaim handles the interactive device claiming flow
func performDeviceClaim(serverURL, apiKeyPath, pubKey string) (string, error) {
	client := resty.New()
	client.SetBaseURL(serverURL)
	client.SetTimeout(10 * time.Second)

	// 1. Start Claim
	hostname := getAgentHostname()
	fmt.Printf("\n🔑 Authenticating device '%s' with %s\n", hostname, serverURL)

	resp, err := client.R().
		SetBody(map[string]string{
			"public_key": pubKey,
			"hostname":   hostname,
		}).
		Post("/api/v1/start-claim")

	if err != nil {
		return "", fmt.Errorf("failed to start claim: %v", err)
	}

	if resp.IsError() {
		return "", fmt.Errorf("server error: %s", resp.String())
	}

	var startClaimResp struct {
		Token    string `json:"token"`
		ClaimURL string `json:"claim_url"`
	}
	if err := json.Unmarshal(resp.Body(), &startClaimResp); err != nil {
		return "", fmt.Errorf("invalid response: %v", err)
	}

	fmt.Printf("\nAction Required:\n\n👉  Visit this URL to approve this device:\n    %s\n\n", startClaimResp.ClaimURL)
	fmt.Print("Waiting for approval...")

	// 2. Poll for Status
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	timeout := time.After(5 * time.Minute)

	for {
		select {
		case <-timeout:
			return "", fmt.Errorf("timed out waiting for approval")
		case <-ticker.C:
			resp, err := client.R().
				SetQueryParam("token", startClaimResp.Token).
				Get("/api/v1/claim-status")

			if err != nil {
				fmt.Print("!") // Network error, retry
				continue
			}

			var statusResp struct {
				Status string `json:"status"`
				APIKey string `json:"api_key,omitempty"`
			}
			json.Unmarshal(resp.Body(), &statusResp)

			if statusResp.Status == "approved" && statusResp.APIKey != "" {
				fmt.Println("\n✅ Device approved successfully!")
				return statusResp.APIKey, nil
			} else if statusResp.Status == "rejected" {
				return "", fmt.Errorf("device claim rejected by user")
			}

			fmt.Print(".")
		}
	}
}

func getAgentHostname() string {
	// Basic implementation, real one would use os.Hostname()
	// but main package already likely has this or similar imports
	return "agent-device" // Placeholder, caller should pass real hostname
}
