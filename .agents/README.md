# MCP Configuration (`.agents/mcp_config.json`)

This directory contains configuration for Model Context Protocol (MCP) servers used by agents in this project (e.g. Linear MCP server).

## Security & Secrets

**NEVER commit API keys or secrets to version control.**

- The committed `.agents/mcp_config.json` leaves secret keys empty (`"LINEAR_API_KEY": ""`).
- `.agents/mcp_config.example.json` provides a template showing the expected structure.
- `LINEAR_API_KEY` must be provided via the local environment or CI/CD secrets manager (e.g. `export LINEAR_API_KEY="lin_api_..."`).
- If your MCP client supports environment variable expansion or passes inherited process environment variables, the server will read `LINEAR_API_KEY` directly from the process environment.
