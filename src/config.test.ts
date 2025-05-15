import path from "path";
import os from "os";

describe("Config module", () => {
  // Store original env and argv
  const originalEnv = process.env;
  const originalArgv = process.argv;

  beforeEach(() => {
    // Clear cache to force module reload
    jest.resetModules();
    // Clone the original environment
    process.env = { ...originalEnv };
    // Reset process.argv to default (remove any test-specific args)
    process.argv = [...originalArgv];
    // Delete specific environment variables we'll be testing
    delete process.env.MCP_DOWNLOAD_DIR;
  });

  afterAll(() => {
    // Restore original env and argv
    process.env = originalEnv;
    process.argv = originalArgv;
  });

  it("should default to user's home directory with fetch_downloads when no args or env vars are set", () => {
    // Import the config module to test default behavior
    const { downloadDir } = require("./config");

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
