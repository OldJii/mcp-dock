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

---

[中文版](./README_CN.md)
