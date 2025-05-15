import fs from "fs/promises";
import path from "path";
import os from "os";
import { Fetcher } from "./fetcher";
import { downloadDir } from "./config";

// Test directories
const testDownloadDir = path.join(os.tmpdir(), "fetch_test_downloads");
const simpleNameDir = "simple_fetch_dir"; // Directory with no path prefix
const originalEnv = process.env;

describe("Fetch Integration Tests", () => {
  beforeAll(async () => {
    // Create test directory if needed
    await fs.mkdir(testDownloadDir, { recursive: true }).catch(() => {});

    // Create a simple name directory in cwd if it doesn't exist
    const cwdSimpleDir = path.join(process.cwd(), simpleNameDir);
    await fs.mkdir(cwdSimpleDir, { recursive: true }).catch(() => {});
  });

  afterAll(async () => {
    // Clean up test directories after all tests
    await fs
      .rm(testDownloadDir, { recursive: true, force: true })
      .catch((error: any) => {
        console.log("Cleanup warning:", error.message);
      });

    // Clean up the simple name directory
    const cwdSimpleDir = path.join(process.cwd(), simpleNameDir);
    await fs
      .rm(cwdSimpleDir, { recursive: true, force: true })
      .catch((error: any) => {
        console.log("Cleanup warning:", error.message);
      });

    // Restore original env
    process.env = originalEnv;
  });

  // Test MCP environment specific path handling
  it("should handle MCP environment by using home directory", async () => {
    // Force a module reload to ensure we pick up the latest config
    jest.resetModules();

    // Simulate MCP environment
    process.env = { ...originalEnv };
    process.env.MCP_HOST = "true"; // Indicate we're in MCP environment
    process.env.MCP_DOWNLOAD_DIR = "./fetch_downloads"; // This would previously cause issues in MCP

    // Reimport the config and fetcher
    const { downloadDir } = require("./config");
    console.log("MCP test download dir:", downloadDir);

    // Should now use home directory in MCP environment (not temp)
    expect(downloadDir).toContain(os.homedir());
    expect(downloadDir).toContain("fetch_downloads");

    // Test with the actual fetcher
    const { Fetcher } = require("./fetcher");

    // Create request payload
    const requestPayload = {
      url: "https://jsonplaceholder.typicode.com/todos/1",
    };

    // Call the Fetcher.json method
    const result = await Fetcher.json(requestPayload);

    // Log the result for debugging
    console.log("MCP env test result:", JSON.stringify(result, null, 2));

    // Should succeed
    expect(result).toHaveProperty("isError", false);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("File saved to:");

    // Path should be in home directory (not temp)
    const filePath = result.content[0].text.replace("File saved to: ", "");
    expect(filePath).toContain(os.homedir());
  }, 10000);

  // Test absolute path that points to root
  it("should handle problematic /fetch_downloads absolute path", async () => {
    // Force a module reload to ensure we pick up the latest config
    jest.resetModules();

    // Set path to exactly what's failing in production
    process.env = { ...originalEnv };
    process.env.MCP_DOWNLOAD_DIR = "/fetch_downloads";

    // Reimport the config
    const { downloadDir } = require("./config");
    console.log("Absolute path test download dir:", downloadDir);

    // Should NOT be trying to use /fetch_downloads
    expect(downloadDir).not.toBe("/fetch_downloads");

    // Should now use home directory with fetch_downloads
    expect(downloadDir).toBe(path.join(os.homedir(), "fetch_downloads"));

    // Reimport the fetcher
    const { Fetcher } = require("./fetcher");

    // Create request payload
    const requestPayload = {
      url: "https://jsonplaceholder.typicode.com/todos/1",
    };

    // Call the Fetcher.json method
    const result = await Fetcher.json(requestPayload);

    // Log the result for debugging
    console.log("Absolute path test result:", JSON.stringify(result, null, 2));

    // Should succeed
    expect(result).toHaveProperty("isError", false);
  }, 10000);

  // Test simple directory name handling (without ./ prefix)
  it("should handle simple directory names without path prefixes", async () => {
    // Force a module reload to ensure we pick up the latest config
    jest.resetModules();

    // Clean and recreate our test environment
    process.env = { ...originalEnv }; // Create fresh environment
    process.env.MCP_DOWNLOAD_DIR = simpleNameDir;

    // Directly set the download path variable and reimport the fetcher
    const { Fetcher } = require("./fetcher");

    // Create request payload
    const requestPayload = {
      url: "https://jsonplaceholder.typicode.com/todos/1",
    };

    // Call the Fetcher.json method
    const result = await Fetcher.json(requestPayload);

    // Log the result for debugging
    console.log("Simple dir result:", JSON.stringify(result, null, 2));

    // Should succeed
    expect(result).toHaveProperty("isError", false);
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("File saved to:");

    // Check that the file was actually saved to the simple_fetch_dir
    // Extract the file path
    const filePath = result.content[0].text.replace("File saved to: ", "");
    console.log("Path from simple dir test:", filePath);
    console.log("Expected in:", path.join(process.cwd(), simpleNameDir));

    // Check that the file exists
    const fileExists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);
    expect(fileExists).toBe(true);

    // Check that the file is in the expected directory
    // We just verify that the file can be listed in the expected directory
    const dirContents = await fs.readdir(
      path.join(process.cwd(), simpleNameDir)
    );
    console.log("Directory contents:", dirContents);
    expect(dirContents.length).toBeGreaterThan(0);
  }, 10000);

  // Test successful HTML fetching
  it("should fetch HTML and save to a file", async () => {
    // Set env var for this test
    process.env.MCP_DOWNLOAD_DIR = testDownloadDir;

    // Create request payload
    const requestPayload = {
      url: "https://www.bbc.co.uk/sport/football/scores-fixtures",
    };

    // Call the Fetcher.html method
    const result = await Fetcher.html(requestPayload);

    // If there's an error, log it
    if (result.isError) {
      console.log("Unexpected error:", JSON.stringify(result, null, 2));
    }

    // Verify the result structure
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("isError", false);
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBe(2);

    // The first content item should contain the file path
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("File saved to:");

    // Extract the file path
    const filePath = result.content[0].text.replace("File saved to: ", "");
    console.log("File path:", filePath);

    // Verify the file exists
    const fileExists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    expect(fileExists).toBe(true);

    // Verify file contents (basic check)
    const fileContent = await fs.readFile(filePath, "utf8");
    expect(fileContent).toContain("<!DOCTYPE html>");
  }, 30000); // Increase timeout to 30 seconds for this test

  // Test successful JSON fetching
  it("should fetch JSON data and save to a file", async () => {
    // Set env var for this test
    process.env.MCP_DOWNLOAD_DIR = testDownloadDir;

    // Create request payload
    const requestPayload = {
      url: "https://jsonplaceholder.typicode.com/todos/1",
    };

    // Call the Fetcher.json method
    const result = await Fetcher.json(requestPayload);

    // If there's an error, log it
    if (result.isError) {
      console.log("Unexpected error:", JSON.stringify(result, null, 2));
    }

    // Verify the result structure
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("isError", false);
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBe(2);

    // The first content item should contain the file path
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("File saved to:");

    // Extract the file path
    const filePath = result.content[0].text.replace("File saved to: ", "");
    console.log("JSON file path:", filePath);

    // Verify the file exists
    const fileExists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    expect(fileExists).toBe(true);

    // Verify file contents (basic check)
    const fileContent = await fs.readFile(filePath, "utf8");
    const jsonData = JSON.parse(fileContent);

    expect(jsonData).toHaveProperty("userId");
    expect(jsonData).toHaveProperty("id");
    expect(jsonData).toHaveProperty("title");
    expect(jsonData).toHaveProperty("completed");
  }, 30000); // Increase timeout to 30 seconds for this test

  // Test invalid URL handling
  it("should handle invalid URLs gracefully", async () => {
    // Create an invalid request payload
    const requestPayload = {
      url: "not-a-valid-url",
    };

    // Call the Fetcher.html method
    const result = await Fetcher.html(requestPayload);

    // Log the result for debugging
    console.log(
      "Error response from invalid URL:",
      JSON.stringify(result, null, 2)
    );

    // Verify the result structure
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("isError", true);
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);

    // Error should mention URL format issue
    const errorText = result.content[0].text;
    expect(errorText).toContain("Invalid URL format");
  }, 10000);
});
