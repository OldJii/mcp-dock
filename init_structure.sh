#!/bin/bash
# ============================================================================
# MCP Dock 社区贡献目录结构初始化脚本
# ============================================================================
# 功能：创建社区贡献所需的目录结构和模板文件
# 用法：./init_structure.sh
# ============================================================================

set -e

echo "🚀 MCP Dock Community Registry Initialization"
echo "=============================================="
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 创建社区贡献目录
echo "📁 Creating community registry directories..."
mkdir -p community-registry/servers
mkdir -p community-registry/skills

# 创建 Server 模板
echo "📝 Creating server template..."
cat > community-registry/servers/_template.json << 'EOF'
{
  "name": "io.github.your-username/your-mcp-server",
  "displayName": "Your MCP Server Name",
  "description": "A brief description of what your MCP Server does",
  "version": "1.0.0",
  "iconUrl": null,
  "tags": ["category1", "category2"],
  "author": "your-username",
  "repository": {
    "url": "https://github.com/your-username/your-mcp-server",
    "source": "github"
  },
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@your-scope/your-mcp-server",
      "version": "1.0.0",
      "runtimeHint": "npx",
      "transport": {
        "type": "stdio"
      },
      "environmentVariables": [
        {
          "name": "API_KEY",
          "description": "Your API key for authentication",
          "isRequired": true,
          "isSecret": true,
          "format": "string",
          "placeholder": "sk-xxxx..."
        }
      ],
      "packageArguments": [],
      "runtimeArguments": []
    }
  ],
  "remotes": []
}
EOF

# 创建 Skill 模板
echo "📝 Creating skill template..."
cat > community-registry/skills/_template.json << 'EOF'
{
  "name": "your-skill-name",
  "description": "Describe when this skill should be used and what it does. Be specific about triggers (e.g., 'Use when user asks to create a PR' or 'Use when working with database migrations').",
  "author": "your-username",
  "repoUrl": "https://github.com/your-username/your-repo",
  "skillPath": ".claude/skills/your-skill-name",
  "branch": "main",
  "iconUrl": null,
  "tags": ["coding", "automation"],
  "category": "Coding",
  "allowedTools": ["Read", "Write", "Shell", "Grep"],
  "files": []
}
EOF

# 创建 README
echo "📝 Creating community registry README..."
cat > community-registry/README.md << 'EOF'
# MCP Dock Community Registry

Welcome to the MCP Dock Community Registry! This directory contains community-contributed MCP Servers and AI Agent Skills.

## How to Contribute

### Contributing an MCP Server

1. **Generate server.json** using the official tool:
   ```bash
   npx mcp-publisher init
   ```

2. **Copy and customize** the template:
   ```bash
   cp _template.json servers/your-server-name.json
   ```

3. **Fill in the details**:
   - `name`: Unique identifier (format: `io.github.username/project-name`)
   - `displayName`: Human-readable name
   - `description`: Clear description of functionality
   - `packages`: Installation configuration
   - `environmentVariables`: Required configuration variables

4. **Submit a Pull Request** to this repository.

### Contributing a Skill

1. **Copy the template**:
   ```bash
   cp _template.json skills/your-skill-name.json
   ```

2. **Fill in the details**:
   - `name`: Skill identifier (alphanumeric with dashes/underscores)
   - `description`: When and how to use the skill
   - `repoUrl`: GitHub repository URL
   - `skillPath`: Path to SKILL.md in the repository
   - `category`: One of: Coding, Testing, DevOps, Data & Analytics, Security, Content & Writing, Productivity, Design

3. **Submit a Pull Request** to this repository.

## Schema Validation

All submissions are automatically validated against:
- **Servers**: `schemas/server.schema.json`
- **Skills**: `schemas/skill.schema.json`

Your PR will fail if the JSON doesn't conform to the schema.

## Guidelines

1. **Quality**: Ensure your contribution is well-documented and maintained
2. **Security**: Don't include any secrets or sensitive information
3. **Accuracy**: Test your configuration before submitting
4. **Naming**: Use clear, descriptive names
5. **Description**: Write helpful descriptions for users

## Need Help?

- Check the [MCP Documentation](https://modelcontextprotocol.io/)
- Review existing entries for examples
- Open an issue if you have questions

Thank you for contributing to MCP Dock! 🎉
EOF

# 创建 .gitkeep 保持空目录
touch community-registry/servers/.gitkeep
touch community-registry/skills/.gitkeep

echo ""
echo "✅ Initialization complete!"
echo ""
echo "Directory structure created:"
echo "  community-registry/"
echo "  ├── servers/"
echo "  │   ├── _template.json"
echo "  │   └── .gitkeep"
echo "  ├── skills/"
echo "  │   ├── _template.json"
echo "  │   └── .gitkeep"
echo "  └── README.md"
echo ""
echo "Next steps:"
echo "  1. Review the template files"
echo "  2. Add your own MCP Server or Skill definitions"
echo "  3. Submit a Pull Request"
echo ""
