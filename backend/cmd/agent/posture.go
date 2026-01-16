package main

import (
	"os"
	"os/exec"
	"runtime"
	"strings"
)

// DevicePostureInfo contains device security posture information
type DevicePostureInfo struct {
	OSName            string `json:"os_name"`
	OSVersion         string `json:"os_version"`
	Hostname          string `json:"hostname"`
	AntivirusEnabled  bool   `json:"antivirus_enabled"`
	AntivirusName     string `json:"antivirus_name,omitempty"`
	FirewallEnabled   bool   `json:"firewall_enabled"`
	DiskEncrypted     bool   `json:"disk_encrypted"`
	ScreenLockEnabled bool   `json:"screen_lock_enabled"`
	PostureScore      int    `json:"posture_score"`
}

// CollectDevicePosture gathers security posture information from the local device
func CollectDevicePosture() DevicePostureInfo {
	posture := DevicePostureInfo{
		OSName:    runtime.GOOS,
		OSVersion: getOSVersion(),
		Hostname:  getHostname(),
	}

	// Platform-specific checks
	switch runtime.GOOS {
	case "darwin":
		posture.FirewallEnabled = checkMacFirewall()
		posture.DiskEncrypted = checkMacFileVault()
		posture.ScreenLockEnabled = true // Assume enabled on macOS
		posture.AntivirusEnabled = checkMacXProtect()
		if posture.AntivirusEnabled {
			posture.AntivirusName = "XProtect"
		}
	case "windows":
		posture.FirewallEnabled = checkWindowsFirewall()
		posture.DiskEncrypted = checkWindowsBitLocker()
		posture.AntivirusEnabled = checkWindowsDefender()
		if posture.AntivirusEnabled {
			posture.AntivirusName = "Windows Defender"
		}
	case "linux":
		posture.FirewallEnabled = checkLinuxFirewall()
		posture.DiskEncrypted = false // Would need specific checks
		posture.AntivirusEnabled = false
	}

	// Calculate posture score (0-100)
	posture.PostureScore = calculatePostureScore(posture)

	return posture
}

func getHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return hostname
}

func getOSVersion() string {
	switch runtime.GOOS {
	case "darwin":
		out, err := exec.Command("sw_vers", "-productVersion").Output()
		if err == nil {
			return strings.TrimSpace(string(out))
		}
	case "linux":
		out, err := exec.Command("uname", "-r").Output()
		if err == nil {
			return strings.TrimSpace(string(out))
		}
	case "windows":
		out, err := exec.Command("cmd", "/c", "ver").Output()
		if err == nil {
			return strings.TrimSpace(string(out))
		}
	}
	return runtime.GOARCH
}

// macOS checks
func checkMacFirewall() bool {
	out, err := exec.Command("/usr/libexec/ApplicationFirewall/socketfilterfw", "--getglobalstate").Output()
	if err != nil {
		return false
	}
	return strings.Contains(string(out), "enabled")
}

func checkMacFileVault() bool {
	out, err := exec.Command("fdesetup", "status").Output()
	if err != nil {
		return false
	}
	return strings.Contains(string(out), "FileVault is On")
}

func checkMacXProtect() bool {
	// XProtect is always enabled on modern macOS
	_, err := os.Stat("/Library/Apple/System/Library/CoreServices/XProtect.bundle")
	return err == nil
}

// Windows checks
func checkWindowsFirewall() bool {
	out, err := exec.Command("netsh", "advfirewall", "show", "currentprofile").Output()
	if err != nil {
		return false
	}
	return strings.Contains(string(out), "State                                 ON")
}

func checkWindowsBitLocker() bool {
	out, err := exec.Command("manage-bde", "-status", "C:").Output()
	if err != nil {
		return false
	}
	return strings.Contains(string(out), "Fully Encrypted")
}

func checkWindowsDefender() bool {
	out, err := exec.Command("powershell", "-Command", "Get-MpComputerStatus | Select-Object -ExpandProperty RealTimeProtectionEnabled").Output()
	if err != nil {
		return false
	}
	return strings.Contains(strings.ToLower(string(out)), "true")
}

// Linux checks
func checkLinuxFirewall() bool {
	// Check for iptables or ufw
	out, err := exec.Command("ufw", "status").Output()
	if err == nil && strings.Contains(string(out), "active") {
		return true
	}

	out, err = exec.Command("iptables", "-L", "-n").Output()
	if err == nil && len(out) > 100 {
		return true
	}

	return false
}

// Calculate a security posture score (0-100)
func calculatePostureScore(p DevicePostureInfo) int {
	score := 0

	// Base points for having an OS (validated connection)
	score += 20

	// Firewall enabled: +25 points
	if p.FirewallEnabled {
		score += 25
	}

	// Disk encryption: +25 points
	if p.DiskEncrypted {
		score += 25
	}

	// Antivirus enabled: +20 points
	if p.AntivirusEnabled {
		score += 20
	}

	// Screen lock: +10 points
	if p.ScreenLockEnabled {
		score += 10
	}

	return score
}
