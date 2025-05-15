import { JSDOM } from "jsdom";
import TurndownService from "turndown";
import isIpPrivate from "private-ip";
import { RequestPayload } from "./types.js";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { downloadDir } from "./config.js";

export class Fetcher {
  private static applyLengthLimits(
    text: string,
    maxLength: number,
    startIndex: number
  ): string {
    if (startIndex >= text.length) {
      return "";
    }

    const end = Math.min(startIndex + maxLength, text.length);
    return text.substring(startIndex, end);
  }

  private static async ensureDownloadDirExists(): Promise<void> {
    try {
      await fs.mkdir(downloadDir, { recursive: true });
    } catch (error) {
      throw new Error(
        `Failed to create download directory: ${(error as Error).message}`
      );
    }
  }

  private static generateUniqueFilename(
    url: string,
    extension: string
  ): string {
    const timestamp =
      new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
    const randomString = crypto.randomBytes(4).toString("hex");

    // Extract a sanitized filename from the URL
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    let baseName =
      pathParts.length > 0 ? pathParts[pathParts.length - 1] : urlObj.hostname;

    // Sanitize the base name
    baseName = baseName.replace(/[^a-zA-Z0-9_\-]/g, "_").substring(0, 50);

    return `${timestamp}-${randomString}-${baseName}.${extension}`;
  }

  private static async _fetchAndSave({
    url,
    headers,
    outputFormat,
  }: RequestPayload & {
    outputFormat: "html" | "json" | "txt" | "markdown";
  }): Promise<{ filePath: string; contentType: string }> {
    try {
      await this.ensureDownloadDirExists();

      if (isIpPrivate(url)) {
        throw new Error(
          `Fetcher blocked an attempt to fetch a private IP ${url}. This is to prevent a security vulnerability where a local MCP could fetch privileged local IPs and exfiltrate data.`
        );
      }

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          ...headers,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      let content: string;
      let contentType: string;
      let fileExtension: string;

      // Process the content according to the outputFormat
      switch (outputFormat) {
        case "html":
          content = await response.text();
          contentType = "text/html";
          fileExtension = "html";
          break;

        case "json":
          const jsonData = await response.json();
          content = JSON.stringify(jsonData, null, 2);
          contentType = "application/json";
          fileExtension = "json";
          break;

        case "txt":
          const htmlForText = await response.text();
          const dom = new JSDOM(htmlForText);
          const document = dom.window.document;

          const scripts = document.getElementsByTagName("script");
          const styles = document.getElementsByTagName("style");
          Array.from(scripts).forEach((script) => script.remove());
          Array.from(styles).forEach((style) => style.remove());

          content = document.body.textContent || "";
          content = content.replace(/\s+/g, " ").trim();
          contentType = "text/plain";
          fileExtension = "txt";
          break;

        case "markdown":
          const htmlForMarkdown = await response.text();
          const turndownService = new TurndownService();
          content = turndownService.turndown(htmlForMarkdown);
          contentType = "text/markdown";
          fileExtension = "md";
          break;

        default:
          throw new Error(`Unsupported output format: ${outputFormat}`);
      }

      // Generate a unique filename and write the content to the file
      const filename = this.generateUniqueFilename(url, fileExtension);
      const filePath = path.join(downloadDir, filename);

      await fs.writeFile(filePath, content, "utf8");

      return { filePath, contentType };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch ${url}: ${error.message}`);
      } else {
        throw new Error(`Failed to fetch ${url}: Unknown error`);
      }
    }
  }

  static async html(requestPayload: RequestPayload) {
    try {
      const { filePath, contentType } = await this._fetchAndSave({
        ...requestPayload,
        outputFormat: "html",
      });

      return {
        content: [
          { type: "text", text: `File saved to: ${filePath}` },
          { type: "text", text: `Content-Type: ${contentType}` },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: (error as Error).message }],
        isError: true,
      };
    }
  }

  static async json(requestPayload: RequestPayload) {
    try {
      const { filePath, contentType } = await this._fetchAndSave({
        ...requestPayload,
        outputFormat: "json",
      });

      return {
        content: [
          { type: "text", text: `File saved to: ${filePath}` },
          { type: "text", text: `Content-Type: ${contentType}` },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: (error as Error).message }],
        isError: true,
      };
    }
  }

  static async txt(requestPayload: RequestPayload) {
    try {
      const { filePath, contentType } = await this._fetchAndSave({
        ...requestPayload,
        outputFormat: "txt",
      });

      return {
        content: [
          { type: "text", text: `File saved to: ${filePath}` },
          { type: "text", text: `Content-Type: ${contentType}` },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: (error as Error).message }],
        isError: true,
      };
    }
  }

  static async markdown(requestPayload: RequestPayload) {
    try {
      const { filePath, contentType } = await this._fetchAndSave({
        ...requestPayload,
        outputFormat: "markdown",
      });

      return {
        content: [
          { type: "text", text: `File saved to: ${filePath}` },
          { type: "text", text: `Content-Type: ${contentType}` },
        ],
        isError: false,
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: (error as Error).message }],
        isError: true,
      };
    }
  }
}
