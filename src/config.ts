import path from "path";
import dotenv from "dotenv";
import minimist from "minimist";

// Load .env, .env.local etc.
dotenv.config();

// Parse command line arguments
const argv = minimist(process.argv.slice(2));

// Determine download directory with priority: command line args > env vars > default
// First check command line args
let downloadDirSource = argv["download-dir"] || argv.downloadDir;

// If not in command line, check environment variables
if (!downloadDirSource) {
  downloadDirSource = process.env.MCP_DOWNLOAD_DIR;
}

// Resolve the path or use default
export const downloadDir = downloadDirSource
  ? path.resolve(downloadDirSource)
  : path.resolve(process.cwd(), ".downloaded_files");
