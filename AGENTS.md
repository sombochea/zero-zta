# AGENTS.md

## Setup commands
- Working directory: `cd backend`
- Install deps: `go mod tidy`
- Start server: `go run cmd/server/main.go`
- Start agent: `go run cmd/agent/main.go`
- Run tests: `go test ./...`
- Update deps: `go get -u ./...`
- Build: `go build -o bin/server cmd/server/main.go`
- Build agent: `go build -o bin/agent cmd/agent/main.go`

## Code style
- Go fmt and goimports
- Effective Go
- Use functional patterns where possible
- Use go 1.25 features

## Testing
- Use table driven tests
- Use testify for assertions
- Use go 1.25 features

## Dependencies
- Use zap for logging
- Use viper for configuration
- Use cobra for cli
- Use gofiber (v3+) for api and websocket server
- Use wireguard-go for zero-trust (both for server and agent with user-space)
- Always keep latest dependencies

## DO NOT FOLLOW
- Do not write any code that is not related to the project
- Do not write any documentation or comments that are not related to the project
