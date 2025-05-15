import path from "path";
import dotenv from "dotenv";
import minimist from "minimist";
import os from "os";
import fs from "fs";

// Load .env, .env.local etc.
dotenv.config();

// Parse command line arguments
const argv = minimist(process.argv.slice(2));

// Debug mode can be enabled via DEBUG env var
export const isDebugMode =
  process.env.DEBUG === "true" || argv.debug === true || argv.d === true;

// =========================================================================
// STEP 1: Detect MCP Environment using multiple signals
// =========================================================================
export const isMcpEnvironment = (): boolean => {
  // Direct MCP environment signals
  const directSignals = [
    !!process.env.MCP_HOST,
    process.env.NODE_ENV === "mcp",
    // Root directory is usually a sign of running in a restricted environment like MCP
    process.cwd() === "/",
    // These paths typically indicate an MCP setting
    process.env.MCP_DOWNLOAD_DIR === "/fetch_downloads",
    process.env.MCP_DOWNLOAD_DIR === "./fetch_downloads" &&
      process.cwd() === "/",
  ];

  // If any direct signal is present, we're in an MCP environment
  if (directSignals.some((signal) => signal)) {
    return true;
  }

  // Additional filesystem checks for restrictive environments
  try {
    // If root directory isn't writable, we're likely in a container/MCP
    if (process.cwd() === "/") {
      try {
        fs.accessSync("/", fs.constants.W_OK);
        // If we can write to root, probably not MCP
        return false;
      } catch (e) {
        // If we can't write to root, probably MCP
        return true;
      }
    }

    return false;
  } catch (e) {
    // If we can't determine, assume not MCP
    return false;
  }
};

const IS_MCP = isMcpEnvironment();
if (IS_MCP && isDebugMode) {
  console.log("Running in MCP environment");
}

// =========================================================================
// STEP 2: Define safe path creation strategies
// =========================================================================

/**
 * Identifies the most secure download directory based on current environment
 */
const getSafestBaseDir = (): string => {
  // Always prefer home directory regardless of environment
  try {
    const homeDir = os.homedir();
    // Check if home directory exists and is writable
    if (fs.existsSync(homeDir)) {
      try {
        fs.accessSync(homeDir, fs.constants.W_OK);
        return homeDir;
      } catch (e) {
        // Home directory not writable, create a more specific error message
        if (isDebugMode) {
          console.warn(
            `Home directory ${homeDir} isn't writable, please check permissions`
          );
        }
        // Still return home directory but the caller should handle permission issues
        return homeDir;
      }
    }
    // Home directory doesn't exist, unusual but handle gracefully
    if (isDebugMode) {
      console.warn(
        `Home directory ${homeDir} doesn't exist, please check your system configuration`
      );
    }
    // Still return the home path - the calling code will handle directory creation
    return homeDir;
  } catch (e) {
    // Any error with home directory, log but still try to use it
    if (isDebugMode) {
      console.warn(`Error accessing home directory: ${e}`);
    }
    // Return home directory anyway - if we truly can't access it,
    // the file operations will fail with clear permissions errors
    return os.homedir();
  }
};

/**
 * Ensures the path is normalized and absolutely safe to use
 */
const createSafePath = (
  basePath: string,
  dirName: string = "fetch_downloads"
): string => {
  // Create full path
  const fullPath = path.join(basePath, dirName);

  try {
    // Verify parent directory exists and is writable
    const parentDir = path.dirname(fullPath);

    // Check parent exists
    if (!fs.existsSync(parentDir)) {
      if (isDebugMode) {
        console.warn(
          `Parent directory ${parentDir} doesn't exist, using home directory`
        );
      }
      // Use home directory instead of temp
      return path.join(os.homedir(), dirName);
    }

    // Check parent is writable
    try {
      fs.accessSync(parentDir, fs.constants.W_OK);
    } catch (e) {
      if (isDebugMode) {
        console.warn(
          `Parent directory ${parentDir} isn't writable, using home directory`
        );
      }
      // Use home directory instead of temp
      return path.join(os.homedir(), dirName);
    }

    return fullPath;
  } catch (e) {
    // Safety fallback
    if (isDebugMode) {
      console.warn(
        `Error validating path ${fullPath}, using home directory fallback: ${e}`
      );
    }
    return path.join(os.homedir(), dirName);
  }
};

// =========================================================================
// STEP 3: Process and normalize configured paths
// =========================================================================

/**
 * Normalizes a user-provided path into a safe absolute path
 */
const normalizePath = (inputPath: string | undefined): string => {
  // Handle empty input
  if (!inputPath) {
    return createSafePath(os.homedir());
  }

  // Special case: handle /fetch_downloads which is known to be problematic
  if (inputPath === "/fetch_downloads") {
    if (isDebugMode) {
      console.warn(
        "Detected problematic /fetch_downloads path, redirecting to home directory"
      );
    }
    // When redirecting /fetch_downloads, preserve the directory name "fetch_downloads"
    return createSafePath(os.homedir(), "fetch_downloads");
  }

  // Extract the directory name if this is a simple path
  let dirName: string | undefined;
  // Simple directory name without path separators - add ./ prefix for safety
  if (!inputPath.includes("/") && !inputPath.includes("\\")) {
    dirName = inputPath;
    inputPath = `./${inputPath}`;
  }

  // When in MCP mode, handle relative paths safely
  if (IS_MCP && (inputPath.startsWith("./") || inputPath.startsWith("../"))) {
    if (isDebugMode) {
      console.warn(
        `MCP environment detected with relative path ${inputPath}, using home directory`
      );
    }
    // If we have a simple dir name, preserve it in the fallback
    // Extract the directory name from the relative path for better preservation
    const relativeDirName = path.basename(inputPath);
    return dirName || relativeDirName !== "."
      ? createSafePath(os.homedir(), dirName || relativeDirName)
      : createSafePath(os.homedir());
  }

  // Handle absolute paths carefully
  if (path.isAbsolute(inputPath)) {
    try {
      // Check if this path would be valid
      return createSafePath(path.dirname(inputPath), path.basename(inputPath));
    } catch (e) {
      if (isDebugMode) {
        console.warn(`Invalid absolute path ${inputPath}, using fallback`);
      }
      // Preserve the basename when falling back
      const basename = path.basename(inputPath);
      return createSafePath(os.homedir(), basename);
    }
  }

  // For relative paths
  try {
    // If we're at root, relative paths can be problematic
    if (process.cwd() === "/") {
      if (isDebugMode) {
        console.warn(
          `Working directory is at root with relative path ${inputPath}, using home directory`
        );
      }
      // Preserve the path's basename if possible
      return dirName
        ? createSafePath(os.homedir(), dirName)
        : createSafePath(os.homedir());
    }

    // Try to resolve the relative path against CWD
    const resolvedPath = path.resolve(process.cwd(), inputPath);

    // Verify this path is safe
    return createSafePath(
      path.dirname(resolvedPath),
      path.basename(resolvedPath)
    );
  } catch (e) {
    if (isDebugMode) {
      console.warn(
        `Error resolving relative path ${inputPath}, using fallback: ${e}`
      );
    }
    // Preserve the directory name when falling back
    return dirName
      ? createSafePath(os.homedir(), dirName)
      : createSafePath(os.homedir());
  }
};

// =========================================================================
// STEP 4: Resolve the final download directory
// =========================================================================

// Priority: command line args > env vars > default safe location
// First check command line args
let downloadDirSource = argv["download-dir"] || argv.downloadDir;

// If not in command line, check environment variables
if (!downloadDirSource) {
  downloadDirSource = process.env.MCP_DOWNLOAD_DIR;
}

// Apply path resolution logic
let resolvedPath: string;
try {
  resolvedPath = downloadDirSource
    ? normalizePath(downloadDirSource)
    : createSafePath(os.homedir());
} catch (error) {
  if (isDebugMode) {
    console.warn(`Path resolution error: ${error}. Using home directory.`);
  }
  resolvedPath = createSafePath(os.homedir());
}

// Final safety check
if (!resolvedPath || typeof resolvedPath !== "string") {
  resolvedPath = createSafePath(os.homedir());
}

// Export the final path
export const downloadDir = resolvedPath;

// =========================================================================
// STEP 5: Debug information gathering
// =========================================================================

/**
 * Gather system and filesystem information for debugging
 */
export function gatherDebugInfo(attemptedPath?: string): Record<string, any> {
  if (!isDebugMode) return {};

  const info: Record<string, any> = {
    environment: {
      cwd: process.cwd(),
      homeDir: os.homedir(),
      platform: process.platform,
      uid: process.getuid?.() || "not available",
      gid: process.getgid?.() || "not available",
      isMcpEnvironment: IS_MCP,
      env: {
        NODE_ENV: process.env.NODE_ENV,
        MCP_HOST: process.env.MCP_HOST,
        MCP_DOWNLOAD_DIR: process.env.MCP_DOWNLOAD_DIR,
      },
    },
    filesystem: {
      configuredDownloadDir: downloadDirSource,
      finalDownloadDir: downloadDir,
      downloadDirExists: false,
      downloadDirWritable: false,
      parentDirExists: false,
      parentDirWritable: false,
    },
  };

  // Add attempted path if provided
  if (attemptedPath) {
    info.filesystem.attemptedPath = attemptedPath;
  }

  // Check download directory status
  try {
    info.filesystem.downloadDirExists = fs.existsSync(downloadDir);

    // Check if directory is writable by trying to access it with write permissions
    try {
      fs.accessSync(downloadDir, fs.constants.W_OK);
      info.filesystem.downloadDirWritable = true;
    } catch (e) {
      info.filesystem.downloadDirWritable = false;
      info.filesystem.writeAccessError = (e as Error).message;
    }

    // Check parent directory
    const parentDir = path.dirname(downloadDir);
    info.filesystem.parentDir = parentDir;
    info.filesystem.parentDirExists = fs.existsSync(parentDir);

    try {
      fs.accessSync(parentDir, fs.constants.W_OK);
      info.filesystem.parentDirWritable = true;
    } catch (e) {
      info.filesystem.parentDirWritable = false;
      info.filesystem.parentWriteAccessError = (e as Error).message;
    }
  } catch (e) {
    info.filesystem.checkError = (e as Error).message;
  }

  return info;
}
