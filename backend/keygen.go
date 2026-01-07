package main

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"

	"golang.org/x/crypto/curve25519"
)

func main() {
	genKey := func(name string) {
		var privateKey [32]byte
		_, err := rand.Read(privateKey[:])
		if err != nil {
			panic(err)
		}

		// Clamp the private key (WireGuard requirement)
		privateKey[0] &= 248
		privateKey[31] &= 127
		privateKey[31] |= 64

		var publicKey [32]byte
		curve25519.ScalarBaseMult(&publicKey, &privateKey)

		privStr := base64.StdEncoding.EncodeToString(privateKey[:])
		pubStr := base64.StdEncoding.EncodeToString(publicKey[:])

		fmt.Printf("%s Private: %s\n", name, privStr)
		fmt.Printf("%s Public:  %s\n", name, pubStr)
	}

	genKey("Server")
	genKey("Agent")
}
