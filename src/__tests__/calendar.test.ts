import { describe, it, expect } from "vitest";
import { formatCalDate } from "../dateUtils";

describe("formatCalDate", () => {
  it("formats a date with correct day name, month, ordinal, and year", () => {
    // 2026-01-15 is a Thursday
    expect(formatCalDate(20260115)).toBe("Thursday January 15th, 2026");
  });

  it("uses 'st' for 1st", () => {
    expect(formatCalDate(20260601)).toContain("1st");
  });

  it("uses 'nd' for 2nd", () => {
    expect(formatCalDate(20260602)).toContain("2nd");
  });

  it("uses 'rd' for 3rd", () => {
    expect(formatCalDate(20260603)).toContain("3rd");
  });

  it("uses 'th' for 11th (teens exception)", () => {
    expect(formatCalDate(20260611)).toContain("11th");
  });

  it("uses 'th' for 12th (teens exception)", () => {
    expect(formatCalDate(20260612)).toContain("12th");
  });

  it("uses 'th' for 13th (teens exception)", () => {
    expect(formatCalDate(20260613)).toContain("13th");
  });

  it("uses 'st' for 21st (not teens)", () => {
    expect(formatCalDate(20260621)).toContain("21st");
  });

  it("includes the year", () => {
    expect(formatCalDate(20260115)).toContain("2026");
  });
});
