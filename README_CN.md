# MCP Dock

<p align="center">
  <img src="https://raw.githubusercontent.com/OldJii/mcp-dock/main/assets/icon.png" width="128" height="128" alt="MCP Dock">
</p>

<p align="center">
  <strong>一站式 MCP Server 管理工具</strong>
</p>

<p align="center">
  <a href="http://mcp.folay.top/">官方网站</a> |
  <a href="#功能特性">功能特性</a> |
  <a href="#下载安装">下载安装</a> |
  <a href="#支持的客户端">支持的客户端</a> |
  <a href="#常见问题">常见问题</a> |
  <a href="./README.md">English</a>
</p>

---

## 功能特性

- **MCP 商店** - 浏览和搜索来自 Official Registry 和 Smithery 的 300+ MCP Server
- **Skills 商店** - 发现 8000+ AI Skills，适用于 Cursor、Claude Code、Gemini CLI、Codex CLI
- **一键安装** - 自动配置到 Cursor、Claude Code、Gemini CLI、Codex CLI、Windsurf、Zed、TRAE
- **MCP Inspector** - 交互式调试工具，测试 MCP Server 的 Tools
- **配置管理** - 统一管理所有客户端的 MCP 配置
- **多端同步** - 将 MCP 配置同步到多个客户端
- **历史记录** - 自动备份配置，支持一键回滚
- **多语言** - 支持中文和英文界面

## 下载安装

### macOS (推荐: Homebrew)

```bash
# 安装
brew install --cask OldJii/tap/mcp-dock

# 更新
brew upgrade --cask mcp-dock
```

### macOS (手动下载)

- [Apple Silicon (M1/M2/M3)](https://github.com/OldJii/mcp-dock/releases/latest/download/MCP.Dock-1.0.1-arm64.dmg)
- [Intel](https://github.com/OldJii/mcp-dock/releases/latest/download/MCP.Dock-1.0.1-x64.dmg)

> 注意: 应用未签名，如果提示"文件已损坏"或"无法打开"，请执行: `xattr -cr /Applications/MCP\ Dock.app`

### Windows

- [安装版](https://github.com/OldJii/mcp-dock/releases/latest/download/MCP.Dock.Setup.1.0.1.exe)
- [便携版](https://github.com/OldJii/mcp-dock/releases/latest/download/MCP.Dock.1.0.1.exe)

### Linux

- [AppImage (x64)](https://github.com/OldJii/mcp-dock/releases/latest/download/MCP.Dock-1.0.1.AppImage)
- [AppImage (arm64)](https://github.com/OldJii/mcp-dock/releases/latest/download/MCP.Dock-1.0.1-arm64.AppImage)
- [Debian/Ubuntu (x64)](https://github.com/OldJii/mcp-dock/releases/latest/download/mcp-dock_1.0.1_amd64.deb)
- [Debian/Ubuntu (arm64)](https://github.com/OldJii/mcp-dock/releases/latest/download/mcp-dock_1.0.1_arm64.deb)

## 支持的客户端

### MCP 客户端

| 客户端 | 状态 |
|--------|------|
| Cursor | 支持 |
| Claude Code | 支持 |
| Gemini CLI | 支持 |
| Codex CLI | 支持 |
| Windsurf | 支持 |
| Zed | 支持 |
| TRAE | 支持 |

### Skills 客户端

| 客户端 | 状态 |
|--------|------|
| Cursor | 支持 |
| Claude Code | 支持 |
| Gemini CLI | 支持 |
| Codex CLI | 支持 |

## 数据源

MCP Dock 支持两个数据源：

- **Official** - MCP 官方注册表，包含经过验证的 MCP Server
- **Smithery** - Smithery.ai 社区，包含社区贡献的 MCP Server

数据每 3 天自动同步一次。

## 社区贡献

我们欢迎社区贡献！你可以提交自己的 MCP Server 或 Skill 配置。

### 如何贡献

1. Fork 本仓库
2. 复制模板文件：
   - MCP Server：`community-registry/servers/_template.json`
   - Skill：`community-registry/skills/_template.json`
3. 填写配置信息
4. 提交 Pull Request

你的 PR 会根据 JSON Schema 自动校验。合并后，下次数据同步时会包含你的贡献。

详细说明请参阅 [社区注册表 README](./community-registry/README_CN.md)。

## 常见问题

### 数据存储在哪里？

所有配置和数据都存储在本地：
- macOS: `~/.mcp-dock/`
- Windows: `%USERPROFILE%\.mcp-dock\`
- Linux: `~/.mcp-dock/`

### 需要联网吗？

首次加载 MCP 列表需要联网。安装后的 MCP 配置存储在本地，无需联网即可使用。

### 如何卸载？

1. 删除应用程序
2. 删除配置目录 `~/.mcp-dock/`
3. MCP 配置会保留在各客户端的配置文件中，如需清理请手动删除

## 许可证

- **软件**（安装包、可执行文件）：专有软件 - 保留所有权利

详见 [LICENSE](./LICENSE)。

## 致谢

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Smithery.ai](https://smithery.ai/)
