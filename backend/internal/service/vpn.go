package service

import (
	"log"

	"golang.zx2c4.com/wireguard/tun/netstack"
)

var VPNNet *netstack.Net

func SetVPNNet(tnet *netstack.Net) {
	VPNNet = tnet
	log.Println("VPN Network Stack initialized globally")
}
