# MCP Dock

<p align="center">
  <img src="https://raw.githubusercontent.com/today-fo/mcp-dock/main/assets/icon.png" width="128" height="128" alt="MCP Dock">
</p>

<p align="center">
  <strong>MCP Server & Config Manager for 14 AI Clients</strong>
</p>

<p align="center">
  Manage MCP server configurations across Cursor, VS Code, Claude Code, Gemini CLI, Codex CLI, Windsurf, Zed, TRAE, Kiro, JetBrains, and more — all from one app.
</p>

<p align="center">
  <a href="https://mcp.folay.top">Website</a> |
  <a href="#features">Features</a> |
  <a href="#download">Download</a> |
  <a href="#supported-clients">Supported Clients</a> |
  <a href="#faq">FAQ</a> |
  <a href="./README_CN.md">中文</a>
</p>

---

## Features

- **MCP Store** - Browse and search MCP Servers from the Official Registry and Smithery (full version)
- **Skills Store** - Discover AI Skills for Cursor, Claude Code, Gemini CLI, Codex CLI, and Opencode (full version)
- **One-Click Install** - Auto-configure to Cursor, VS Code, Claude Code, Gemini CLI, Codex CLI, Windsurf, Zed, TRAE, TRAE CN, Kiro, Opencode, JetBrains, Antigravity, OpenClaw
- **Agent Skills Standard** - Support for `~/.agents/skills/` unified standard ([skills.sh](https://skills.sh/))
- **MCP Inspector** - Interactive debugging tool for testing MCP Server tools
- **Config Management** - Unified management of MCP configurations across all clients
- **Multi-Client Sync** - Sync MCP configurations to multiple clients
- **History & Rollback** - Auto-backup configurations with one-click rollback
- **Multi-Language** - English and Simplified Chinese

## Download

**No installers are published yet**, so there is currently nothing to download and no Homebrew command to run. Builds will be listed on the [official website](https://mcp.folay.top) when they are released; this README will not list links to files that do not exist. macOS builds use ad-hoc signing without Apple notarization, and Windows builds are unsigned; first launch may show a system prompt.

- Already using an older MCP Dock? Its built-in updater cannot reach new versions yet. Once downloads open, reinstall from the website; your configuration is kept.
- The open-source Community Edition in this repository can be [built from source](#development) in the meantime. It has fewer features than the full application (see the comparison below).

## Supported Clients

### MCP Clients

| Client | Status |
|--------|--------|
| Cursor | Supported |
| VS Code | Supported |
| Claude Code | Supported |
| Gemini CLI | Supported |
| Codex CLI | Supported |
| Windsurf | Supported |
| Zed | Supported |
| TRAE | Supported |
| TRAE CN | Supported |
| Kiro | Supported |
| Opencode | Supported |
| JetBrains (IntelliJ, WebStorm, PyCharm, etc.) | Supported |
| Antigravity | Supported |
| OpenClaw | Supported |

### Skills Clients

| Client | Status |
|--------|--------|
| Cursor | Supported |
| Claude Code | Supported |
| Gemini CLI | Supported |
| Codex CLI | Supported |
| Opencode | Supported |
| Agent Skills (.agents) | Supported |

## Data Sources

MCP Dock supports two data sources:

- **Official** - MCP Official Registry with verified servers
- **Smithery** - Smithery.ai community with community-contributed servers

Data syncs automatically every 3 days.

## Community Contributions

We welcome community contributions! You can submit your own MCP Server or Skill configurations.

### How to Contribute

1. Fork this repository
2. Copy the template file:
   - For MCP Servers: `community-registry/servers/_template.json`
   - For Skills: `community-registry/skills/_template.json`
3. Fill in your configuration
4. Submit a Pull Request

Your PR will be automatically validated against our JSON Schema. Once merged, your contribution will be included in the next data sync.

See [Community Registry README](./community-registry/README.md) for detailed instructions.

## FAQ

### Where is data stored?

All configurations and data are stored locally:
- macOS: `~/.mcp-dock/`
- Windows: `%USERPROFILE%\.mcp-dock\`
- Linux: `~/.mcp-dock/`

### Does it require internet?

Internet is required for loading the MCP list. Installed MCP configurations are stored locally and work offline.

### How to uninstall?

1. Delete the application
2. Delete the config directory `~/.mcp-dock/`
3. MCP configurations remain in each client's config file. Remove manually if needed.

## Source Code

This repository includes the full source code of MCP Dock (Community Edition). You can build, modify, and contribute to the project.

### Tech Stack

- **Framework**: Electron + React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Build**: Vite + electron-builder
- **Protocol**: MCP JSON-RPC over stdio

### Development

```bash
# Install dependencies
npm install

# Start development mode
npm run electron:dev

# Build for production
npm run package
```

### Project Structure

```
src/
├── renderer/           # Frontend (React + Vite + Tailwind)
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── pages/      # App pages (Store, Library, Inspector, etc.)
│   │   ├── api/        # Registry API layer
│   │   ├── store/      # Zustand state management
│   │   ├── lib/        # Utilities and Electron bridge
│   │   └── locales/    # i18n (English + Chinese)
│   └── assets/         # Icons and static assets
├── main/               # Electron main process
│   ├── config-manager  # Multi-client config read/write (14 clients)
│   ├── mcp-client      # MCP JSON-RPC client for Inspector
│   ├── skills-manager  # Skills installation and management
│   ├── history-manager # Config backup and rollback
│   ├── env-manager     # Runtime environment detection
│   └── cache-manager   # Local data caching
├── preload/            # Electron preload (secure IPC bridge)
└── __tests__/          # Unit tests
```

### Community Edition vs Full Version

| Feature | Community | Full |
|---------|-----------|------|
| Manual server install to 14 clients | ✅ | ✅ |
| MCP Inspector | ✅ | ✅ |
| Config history & rollback | ✅ | ✅ |
| Multi-client sync | ✅ | ✅ |
| Skills management | ✅ | ✅ |
| Browse the MCP server catalog | ❌ | ✅ |
| Browse the AI Skills catalog | ❌ | ✅ |
| One-click install from registry | ❌ | ✅ |

The full version with registry browsing is distributed as installers from the [official website](https://mcp.folay.top) once they are published (see [Download](#download)).

## License

MIT License - See [LICENSE](./LICENSE) for details.

## Credits

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Smithery.ai](https://smithery.ai/)
