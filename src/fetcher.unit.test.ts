import { Fetcher } from "./fetcher";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

// Mock the config module - needs to be before other imports
jest.mock("./config", () => {
  return {
    downloadDir: "/mock/.downloaded_files",
  };
});

// Mock the private-ip module
jest.mock("private-ip");

// Mock the fs/promises module
jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

// Mock the crypto module
jest.mock("crypto", () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue("a1b2c3d4"),
  }),
}));

// Mock the global fetch function
global.fetch = jest.fn();

// Mock JSDOM
jest.mock("jsdom");

// Mock Turndown
jest.mock("turndown");

describe("Fetcher", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Date.toISOString to return a fixed timestamp
    const mockDate = new Date("2023-10-27T10:30:00Z");
    jest.spyOn(global, "Date").mockImplementation(() => mockDate as any);
    mockDate.toISOString = jest
      .fn()
      .mockReturnValue("2023-10-27T10:30:00.000Z");
  });

  const mockRequest = {
    url: "https://example.com",
    headers: { "Custom-Header": "Value" },
  };

  const mockHtml = `
    <html>
      <head>
        <title>Test Page</title>
        <script>console.log('This should be removed');</script>
        <style>body { color: red; }</style>
      </head>
      <body>
        <h1>Hello World</h1>
        <p>This is a test paragraph.</p>
      </body>
    </html>
  `;

  describe("ensureDownloadDirExists", () => {
    it("should create the download directory if it doesn't exist", async () => {
      // Access private method using reflection
      const ensureDownloadDirExists = (Fetcher as any).ensureDownloadDirExists;
      await ensureDownloadDirExists.call(Fetcher);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(".downloaded_files"),
        { recursive: true }
      );
    });

    it("should handle errors when creating the directory", async () => {
      (fs.mkdir as jest.Mock).mockRejectedValueOnce(
        new Error("Permission denied")
      );

      const ensureDownloadDirExists = (Fetcher as any).ensureDownloadDirExists;
      await expect(ensureDownloadDirExists.call(Fetcher)).rejects.toThrow(
        "Failed to create download directory"
      );
    });
  });

  describe("generateUniqueFilename", () => {
    it("should generate a correctly formatted filename", () => {
      const generateUniqueFilename = (Fetcher as any).generateUniqueFilename;
      const result = generateUniqueFilename.call(
        Fetcher,
        "https://example.com/path/to/page",
        "html"
      );

      expect(result).toEqual("20231027T103000Z-a1b2c3d4-page.html");
    });

    it("should handle URLs without a path", () => {
      const generateUniqueFilename = (Fetcher as any).generateUniqueFilename;
      const result = generateUniqueFilename.call(
        Fetcher,
        "https://example.com",
        "json"
      );

      expect(result).toEqual("20231027T103000Z-a1b2c3d4-example_com.json");
    });

    it("should sanitize filenames", () => {
      const generateUniqueFilename = (Fetcher as any).generateUniqueFilename;
      const result = generateUniqueFilename.call(
        Fetcher,
        "https://example.com/file with spaces & special: chars!",
        "txt"
      );

      expect(result).toEqual(
        "20231027T103000Z-a1b2c3d4-file_20with_20spaces_20__20special__20chars_.txt"
      );
    });
  });

  describe("html", () => {
    it("should save HTML content to a file and return the file path", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(mockHtml),
      });

      const result = await Fetcher.html(mockRequest);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(
          ".downloaded_files/20231027T103000Z-a1b2c3d4-example_com.html"
        ),
        mockHtml,
        "utf8"
      );

      expect(result).toEqual({
        content: [
          { type: "text", text: expect.stringContaining("File saved to:") },
          { type: "text", text: "Content-Type: text/html" },
        ],
        isError: false,
      });
    });

    it("should handle errors", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

      const result = await Fetcher.html(mockRequest);
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "Failed to fetch https://example.com: Network error",
          },
        ],
        isError: true,
      });
    });
  });

  describe("json", () => {
    it("should save JSON content to a file and return the file path", async () => {
      const mockJson = { key: "value" };
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockJson),
      });

      const result = await Fetcher.json(mockRequest);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(
          ".downloaded_files/20231027T103000Z-a1b2c3d4-example_com.json"
        ),
        JSON.stringify(mockJson, null, 2),
        "utf8"
      );

      expect(result).toEqual({
        content: [
          { type: "text", text: expect.stringContaining("File saved to:") },
          { type: "text", text: "Content-Type: application/json" },
        ],
        isError: false,
      });
    });

    it("should handle errors", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Invalid JSON"));

      const result = await Fetcher.json(mockRequest);
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "Failed to fetch https://example.com: Invalid JSON",
          },
        ],
        isError: true,
      });
    });
  });

  describe("txt", () => {
    it("should save plain text content to a file and return the file path", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(mockHtml),
      });

      const mockTextContent = "Hello World This is a test paragraph.";
      // @ts-expect-error Mocking JSDOM
      (JSDOM as jest.Mock).mockImplementationOnce(() => ({
        window: {
          document: {
            body: {
              textContent: mockTextContent,
            },
            getElementsByTagName: jest.fn().mockReturnValue([]),
          },
        },
      }));

      const result = await Fetcher.txt(mockRequest);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(
          ".downloaded_files/20231027T103000Z-a1b2c3d4-example_com.txt"
        ),
        mockTextContent,
        "utf8"
      );

      expect(result).toEqual({
        content: [
          { type: "text", text: expect.stringContaining("File saved to:") },
          { type: "text", text: "Content-Type: text/plain" },
        ],
        isError: false,
      });
    });

    it("should handle errors", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Parsing error"));

      const result = await Fetcher.txt(mockRequest);
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "Failed to fetch https://example.com: Parsing error",
          },
        ],
        isError: true,
      });
    });
  });

  describe("markdown", () => {
    it("should save markdown content to a file and return the file path", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(mockHtml),
      });

      const mockMarkdown = "# Hello World\n\nThis is a test paragraph.";
      (TurndownService as jest.Mock).mockImplementationOnce(() => ({
        turndown: jest.fn().mockReturnValueOnce(mockMarkdown),
      }));

      const result = await Fetcher.markdown(mockRequest);

      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(
          ".downloaded_files/20231027T103000Z-a1b2c3d4-example_com.md"
        ),
        mockMarkdown,
        "utf8"
      );

      expect(result).toEqual({
        content: [
          { type: "text", text: expect.stringContaining("File saved to:") },
          { type: "text", text: "Content-Type: text/markdown" },
        ],
        isError: false,
      });
    });

    it("should handle errors", async () => {
      (fetch as jest.Mock).mockRejectedValueOnce(new Error("Conversion error"));

      const result = await Fetcher.markdown(mockRequest);
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "Failed to fetch https://example.com: Conversion error",
          },
        ],
        isError: true,
      });
    });
  });

  describe("error handling", () => {
    it("should handle non-OK responses", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await Fetcher.html(mockRequest);
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: "Failed to fetch https://example.com: HTTP error: 404",
          },
        ],
        isError: true,
      });
    });

    it("should handle file system errors", async () => {
      (fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(mockHtml),
      });

      (fs.writeFile as jest.Mock).mockRejectedValueOnce(new Error("Disk full"));

      const result = await Fetcher.html(mockRequest);
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: expect.stringContaining(
              "Failed to fetch https://example.com: Disk full"
            ),
          },
        ],
        isError: true,
      });
    });

    it("should handle private IP addresses", async () => {
      const isIpPrivate = jest.requireMock("private-ip");
      isIpPrivate.mockReturnValueOnce(true);

      const result = await Fetcher.html(mockRequest);
      expect(result).toEqual({
        content: [
          {
            type: "text",
            text: expect.stringContaining(
              "Fetcher blocked an attempt to fetch a private IP"
            ),
          },
        ],
        isError: true,
      });
    });
  });
});
