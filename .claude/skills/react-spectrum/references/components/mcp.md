<!-- Source: https://github.com/adobe/react-spectrum/tree/main/packages/dev/mcp/s2/README.md -->
<!-- Last fetched: 2026-04-05 -->

# MCP Server

`@react-spectrum/mcp` provides a Model Context Protocol (MCP) server for React Spectrum (S2) documentation. It enables MCP clients to discover and invoke tools for browsing documentation, searching icons and illustrations, and more.

```bash
npx @react-spectrum/mcp@latest
```

## Installation

### Standard MCP Client Configuration

```json
{
  "mcpServers": {
    "React Spectrum (S2)": {
      "command": "npx",
      "args": ["@react-spectrum/mcp@latest"]
    }
  }
}
```

### Client-Specific Setup

**Cursor**: Use the provided deep link or follow the MCP installation guide with the standard config above.

**VS Code**:

```bash
code --add-mcp '{"name":"React Spectrum (S2)","command":"npx","args":["@react-spectrum/mcp@latest"]}'
```

**Claude Code**:

```bash
claude mcp add react-spectrum-s2 npx @react-spectrum/mcp@latest
```

**Codex** (`~/.codex/config.toml`):

```toml
[mcp_servers.react-spectrum-s2]
command = "npx"
args = ["@react-spectrum/mcp@latest"]
```

**Gemini CLI**:

```bash
gemini mcp add react-spectrum-s2 npx @react-spectrum/mcp@latest
```

**Windsurf**: Follow their MCP documentation using the standard config.

## Available Tools

| Tool                      | Input Parameters                               | Purpose                                          |
| ------------------------- | ---------------------------------------------- | ------------------------------------------------ |
| `list_s2_pages`           | `{ includeDescription?: boolean }`             | Enumerate available S2 documentation pages       |
| `get_s2_page_info`        | `{ page_name: string }`                        | Retrieve page description and section headings   |
| `get_s2_page`             | `{ page_name: string, section_name?: string }` | Fetch complete page markdown or specific section |
| `search_s2_icons`         | `{ terms: string \| string[] }`                | Find S2 workflow icon names by search terms      |
| `search_s2_illustrations` | `{ terms: string \| string[] }`                | Locate S2 illustration names by search terms     |

## Local Development

### Build and Test Locally

```bash
yarn workspace @react-spectrum/s2-docs generate:md
yarn workspace @react-spectrum/mcp build
yarn start:s2-docs
```

### Local MCP Client Configuration

```json
{
  "mcpServers": {
    "React Spectrum (S2)": {
      "command": "node",
      "args": [
        "{your path here}/react-spectrum/packages/dev/mcp/s2/dist/s2/src/index.js"
      ],
      "env": {
        "DOCS_CDN_BASE": "http://localhost:1234"
      }
    }
  }
}
```

## Package Info

- **Package**: `@react-spectrum/mcp`
- **Version**: 1.0.0
- **Main**: `dist/main.js`
- **Node.js**: >= 18
