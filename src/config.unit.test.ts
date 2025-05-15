import path from "path";
import os from "os";

describe("Config module", () => {
  // Store original env and argv
  const originalEnv = process.env;
  const originalArgv = process.argv;
  const originalCwd = process.cwd;

  beforeEach(() => {
    // Clear cache to force module reload
    jest.resetModules();
    // Clone the original environment
    process.env = { ...originalEnv };
    // Reset process.argv to default (remove any test-specific args)
    process.argv = [...originalArgv];
    // Delete specific environment variables we'll be testing
    delete process.env.MCP_DOWNLOAD_DIR;
    delete process.env.MCP_HOST;
  });

  afterAll(() => {
    // Restore original env and argv
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  it("should default to fetch_downloads in home directory when no args or env vars are set", () => {
    // Import the config module to test default behavior
    const { downloadDir } = require("./config");

    // Should use home directory as base
    expect(downloadDir).toEqual(path.join(os.homedir(), "fetch_downloads"));
  });

  it("should use MCP_DOWNLOAD_DIR environment variable when set", () => {
    // Set the environment variable
    process.env.MCP_DOWNLOAD_DIR = "/tmp/custom_downloads";

    // Import the config module to test with custom path
    const { downloadDir } = require("./config");

    expect(downloadDir).toEqual("/tmp/custom_downloads");
  });

  it("should resolve relative paths in MCP_DOWNLOAD_DIR environment variable", () => {
    // Set the environment variable with a relative path
    process.env.MCP_DOWNLOAD_DIR = "./custom_downloads";

    // Import the config module to test relative path resolution
    const { downloadDir } = require("./config");

    expect(downloadDir).toEqual(path.resolve("./custom_downloads"));
  });

  it("should still use home directory with relative paths in MCP environment", () => {
    // Set up MCP environment and relative path
    process.env.MCP_HOST = "true";
    process.env.MCP_DOWNLOAD_DIR = "./mcp_custom_downloads";

    // Import the config module
    const { downloadDir } = require("./config");

    // Should now use home directory instead of temp
    expect(downloadDir).toEqual(
      path.join(os.homedir(), "mcp_custom_downloads")
    );
  });

  it("should still use home directory for /fetch_downloads in MCP environment", () => {
    // Set up MCP environment with problematic path
    process.env.MCP_HOST = "true";
    process.env.MCP_DOWNLOAD_DIR = "/fetch_downloads";

    // Import the config module
    const { downloadDir } = require("./config");

    // Should now use home directory instead of temp
    expect(downloadDir).toEqual(path.join(os.homedir(), "fetch_downloads"));
  });

  it("should prioritize command line args over environment variables", () => {
    // Set both command line arg and environment variable
    process.argv = [...originalArgv, "--download-dir=/tmp/arg_downloads"];
    process.env.MCP_DOWNLOAD_DIR = "/tmp/env_downloads";

    // Import the config module
    const { downloadDir } = require("./config");

    // Should use the command line arg, not the env var
    expect(downloadDir).toEqual("/tmp/arg_downloads");
  });

  it("should accept downloadDir as an argument", () => {
    // Test the camelCase version of the arg
    process.argv = [...originalArgv, "--downloadDir=/tmp/camel_case_downloads"];

    // Import the config module
    const { downloadDir } = require("./config");

    expect(downloadDir).toEqual("/tmp/camel_case_downloads");
  });
});
