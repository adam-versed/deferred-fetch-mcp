# Deferred Fetch MCP Server

![Deferred fetch mcp logo](logo.jpg)

This MCP server provides functionality to fetch web content in various formats, including HTML, JSON, plain text, and Markdown.

## About This Fork

This is a fork of the [original Fetch MCP server](https://github.com/zcaceres/fetch-mcp) that takes a deferred approach to content retrieval. Instead of returning the full content directly to the LLM (which can quickly consume the context window), this version:

1. Downloads the requested content to a configurable directory on disk
2. Returns only the file path to the LLM

This approach solves a critical limitation of the original implementation, where large web pages would consume so much of the context window that the fetched content became effectively unusable. With this deferred approach:

- The LLM's context window remains available for actual conversation
- The LLM can choose how to process the downloaded content (semantically search it, keyword search it, or process it in manageable chunks)
- Files persist between sessions, allowing for reference to previously fetched content

The target download directory is fully configurable (see the [Configuration](#configuration) section below).

Fork maintained by [adam-versed](https://github.com/adam-versed/fetch-mcp).

## Components

### Tools

- **fetch_html**

  - Fetch a website and save the content as HTML to the configured download directory
  - Input:
    - `url` (string, required): URL of the website to fetch
    - `headers` (object, optional): Custom headers to include in the request
  - Returns the file path where the HTML content was saved and the content type

- **fetch_json**

  - Fetch a JSON file from a URL and save it to the configured download directory
  - Input:
    - `url` (string, required): URL of the JSON to fetch
    - `headers` (object, optional): Custom headers to include in the request
  - Returns the file path where the JSON content was saved and the content type

- **fetch_txt**

  - Fetch a website, convert it to plain text (no HTML), and save it to the configured download directory
  - Input:
    - `url` (string, required): URL of the website to fetch
    - `headers` (object, optional): Custom headers to include in the request
  - Returns the file path where the text content was saved and the content type

- **fetch_markdown**
  - Fetch a website, convert it to Markdown, and save it to the configured download directory
  - Input:
    - `url` (string, required): URL of the website to fetch
    - `headers` (object, optional): Custom headers to include in the request
  - Returns the file path where the Markdown content was saved and the content type

## Getting started

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the server: `npm run build`

### Usage

To use the server, you can run it directly:

```bash
npm start
```

This will start the Fetch MCP Server running on stdio.

### Usage with MCP Client App

To integrate this server with a desktop app, add the following to your app's server configuration:

```json
{
  "mcpServers": {
    "fetch": {
      "command": "node",
      "args": ["{ABSOLUTE PATH TO FILE HERE}/dist/index.js"]
    }
  }
}
```

## Features

- Deferred content retrieval that preserves the LLM's context window
- Content saved to configurable download locations (command line args, environment variables, or default)
- Fetches web content using modern fetch API
- Supports custom headers for requests
- Provides content in multiple formats: HTML, JSON, plain text, and Markdown
- Uses JSDOM for HTML parsing and text extraction
- Uses TurndownService for HTML to Markdown conversion
- Prevents information leaks by blocking requests to private IP addresses

## Development

- Run `npm run dev` to start the TypeScript compiler in watch mode
- Use `npm test` to run the test suite

## Configuration

You can specify the download directory in several ways, with the following priority order:

1. **Command line arguments**:

   ```bash
   node dist/index.js --download-dir=/path/to/downloads
   # OR using camelCase
   node dist/index.js --downloadDir=/path/to/downloads
   ```

2. **Environment variables**:

   ```bash
   MCP_DOWNLOAD_DIR=/path/to/downloads node dist/index.js
   ```

   Or via a `.env.local` file:

   ```
   MCP_DOWNLOAD_DIR=~/my-fetch-outputs
   ```

3. **Default value**: If no configuration is provided, files will be saved to `./.downloaded_files` relative to the process's current working directory.

### Using with MCP Client Applications

When integrating with a Claude or Cursor desktop app, you can configure the download location in the MCP server configuration:

```json
{
  "mcpServers": {
    "fetch": {
      "command": "node",
      "args": ["{ABSOLUTE PATH TO FILE HERE}/dist/index.js"],
      "env": {
        "MCP_DOWNLOAD_DIR": "/path/to/downloads"
      }
    }
  }
}
```

Note that the MCP server runs with the permissions of the user launching it, so the specified download directory must be writable by that user.

## License

This project is licensed under the MIT License.
