package main

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"log"
	"math/big"
	"net"
	"os"
	"time"
)

// GenerateSelfSignedCert checks for existing cert/key files and generates them if missing.
// It returns the paths to the cert and key files.
func GenerateSelfSignedCert() (string, string) {
	certPath := "server.crt"
	keyPath := "server.key"

	if _, err := os.Stat(certPath); err == nil {
		if _, err := os.Stat(keyPath); err == nil {
			log.Println("Using existing TLS certificate and key")
			return certPath, keyPath
		}
	}

	log.Println("Generating self-signed TLS certificate...")

	priv, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		log.Fatalf("Failed to generate private key: %v", err)
	}

	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			Organization: []string{"Zero ZTA"},
		},
		NotBefore: time.Now(),
		NotAfter:  time.Now().Add(365 * 24 * time.Hour),

		KeyUsage:              x509.KeyUsageKeyEncipherment | x509.KeyUsageDigitalSignature,
		ExtKeyUsage:           []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
	}

	// Add IP SANs
	template.IPAddresses = append(template.IPAddresses, net.ParseIP("127.0.0.1"))
	template.IPAddresses = append(template.IPAddresses, net.ParseIP("::1"))

	// Add DNS SANs for localhost
	template.DNSNames = append(template.DNSNames, "localhost")

	derBytes, err := x509.CreateCertificate(rand.Reader, &template, &template, &priv.PublicKey, priv)
	if err != nil {
		log.Fatalf("Failed to create certificate: %v", err)
	}

	// Save Certificate
	certOut, err := os.Create(certPath)
	if err != nil {
		log.Fatalf("Failed to open %s for writing: %v", certPath, err)
	}
	if err := pem.Encode(certOut, &pem.Block{Type: "CERTIFICATE", Bytes: derBytes}); err != nil {
		log.Fatalf("Failed to write data to %s: %v", certPath, err)
	}
	if err := certOut.Close(); err != nil {
		log.Fatalf("Error closing %s: %v", certPath, err)
	}

	// Save Private Key
	keyOut, err := os.Create(keyPath)
	if err != nil {
		log.Fatalf("Failed to open %s for writing: %v", keyPath, err)
	}
	if err := pem.Encode(keyOut, &pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(priv)}); err != nil {
		log.Fatalf("Failed to write data to %s: %v", keyPath, err)
	}
	if err := keyOut.Close(); err != nil {
		log.Fatalf("Error closing %s: %v", keyPath, err)
	}

	log.Println("Generated server.crt and server.key")
	return certPath, keyPath
}
