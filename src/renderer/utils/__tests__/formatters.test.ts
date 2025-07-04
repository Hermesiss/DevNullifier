import { describe, it, expect } from "vitest";
import { formatSize, formatDate } from "../formatters";

describe("formatters", () => {
  describe("formatSize", () => {
    it("should format bytes to human readable size", () => {
      expect(formatSize(1024)).toBe("1 KB");
      expect(formatSize(1024 * 1024)).toBe("1 MB");
      expect(formatSize(1024 * 1024 * 1024)).toBe("1 GB");
      expect(formatSize(500)).toBe("500 B");
    });
  });

  describe("formatDate", () => {
    it("should format date string to localized date and time", () => {
      const testDate = "2024-03-15T14:30:00Z";
      const result = formatDate(testDate);

      // Since the exact format depends on the locale, we'll check for basic components
      expect(result).toContain("2024");
      expect(result).toContain("3/15");
    });

    it('should return "Unknown" for empty date string', () => {
      expect(formatDate("")).toBe("Unknown");
    });

    it("should handle invalid date strings", () => {
      const result = formatDate("invalid-date");
      expect(result).toContain("Invalid");
    });
  });
});
