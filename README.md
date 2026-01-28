# MCP Dock

<p align="center">
  <img src="https://raw.githubusercontent.com/OldJii/mcp-dock/main/assets/icon.png" width="128" height="128" alt="MCP Dock">
</p>

<p align="center">
  <strong>All-in-one MCP Server Manager</strong>
</p>

<p align="center">
  <a href="http://mcp.folay.top">Website</a> |
  <a href="#features">Features</a> |
  <a href="#download">Download</a> |
  <a href="#supported-clients">Supported Clients</a> |
  <a href="#faq">FAQ</a> |
  <a href="./README_CN.md">中文</a>
</p>

---

## Features

- **MCP Store** - Browse and search MCP Servers from Official Registry and Smithery
- **One-Click Install** - Auto-configure to Cursor, Claude Desktop, Windsurf, Zed, TRAE
- **MCP Inspector** - Interactive debugging tool for testing MCP Server tools
- **Config Management** - Unified management of MCP configurations across all clients
- **Multi-Client Sync** - Sync MCP configurations to multiple clients
- **History & Rollback** - Auto-backup configurations with one-click rollback
- **Multi-Language** - English and Simplified Chinese

## Download

### macOS (Recommended: Homebrew)

```bash
# Install
brew install --cask OldJii/tap/mcp-dock

# Upgrade
brew upgrade --cask mcp-dock
```

### macOS (Manual Download)

- [Apple Silicon (M1/M2/M3)](https://github.com/OldJii/mcp-dock/releases/latest/download/MCP.Dock-1.0.1-arm64.dmg)
- [Intel](https://github.com/OldJii/mcp-dock/releases/latest/download/MCP.Dock-1.0.1-x64.dmg)

> Note: The app is not signed. If you see "damaged" or "can't be opened" message, run: `xattr -cr /Applications/MCP\ Dock.app`

### Windows

- [Installer](https://github.com/OldJii/mcp-dock/releases/latest/download/MCP.Dock.Setup.1.0.1.exe)
- [Portable](https://github.com/OldJii/mcp-dock/releases/latest/download/MCP.Dock.1.0.1.exe)

### Linux

- [AppImage (x64)](https://github.com/OldJii/mcp-dock/releases/latest/download/MCP.Dock-1.0.1.AppImage)
- [AppImage (arm64)](https://github.com/OldJii/mcp-dock/releases/latest/download/MCP.Dock-1.0.1-arm64.AppImage)
- [Debian/Ubuntu (x64)](https://github.com/OldJii/mcp-dock/releases/latest/download/mcp-dock_1.0.1_amd64.deb)
- [Debian/Ubuntu (arm64)](https://github.com/OldJii/mcp-dock/releases/latest/download/mcp-dock_1.0.1_arm64.deb)

## Supported Clients

| Client | Status |
|--------|--------|
| Cursor | Supported |
| Claude Desktop | Supported |
| Windsurf | Supported |
| Zed | Supported |
| TRAE | Supported |

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

## License

This project uses a dual license model:

- **Software** (installers, executables): Proprietary - All rights reserved
- **Data** (`registry/*.json`): [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/)

See [LICENSE](./LICENSE) for details.

## Credits

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Smithery.ai](https://smithery.ai/)
