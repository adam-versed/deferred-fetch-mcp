import fs from "fs/promises";
import { Fetcher } from "./fetcher";

describe("Fetch Integration Tests", () => {
  // Test HTML fetching
  it("should fetch HTML from BBC Sport and save to a file", async () => {
    // Create request payload
    const requestPayload = {
      url: "https://www.bbc.co.uk/sport/football/scores-fixtures",
    };

    // Call the Fetcher.html method directly
    const result = await Fetcher.html(requestPayload);

    // Verify the result structure
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("isError", false);
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBe(2);

    // The first content item should contain the file path
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("File saved to:");

    // The second content item should contain the content type
    expect(result.content[1].type).toBe("text");
    expect(result.content[1].text).toBe("Content-Type: text/html");

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
    expect(fileContent).toContain("BBC");
    expect(fileContent).toContain("Sport");
  }, 30000); // Increase timeout to 30 seconds for this test

  // Test JSON fetching
  it("should fetch JSON data and save to a file", async () => {
    // Create request payload
    const requestPayload = {
      url: "https://jsonplaceholder.typicode.com/todos/1",
    };

    // Call the Fetcher.json method directly
    const result = await Fetcher.json(requestPayload);

    // Verify the result structure
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("isError", false);
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content.length).toBe(2);

    // The first content item should contain the file path
    expect(result.content[0].type).toBe("text");
    expect(result.content[0].text).toContain("File saved to:");

    // The second content item should contain the content type
    expect(result.content[1].type).toBe("text");
    expect(result.content[1].text).toBe("Content-Type: application/json");

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
});
