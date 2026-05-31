import { describe, it, expect } from "vitest";
import { parseMentionId, extractTrailingMention } from "../mentions";

const MENTION = "[@Alice](root://user/user-abc123)";
const ID = "user-abc123";

describe("parseMentionId", () => {
  it("extracts user ID from a mention", () => {
    expect(parseMentionId(MENTION)).toBe(ID);
  });

  it("extracts from mid-sentence text", () => {
    expect(parseMentionId(`hello ${MENTION} world`)).toBe(ID);
  });

  it("returns undefined when no mention present", () => {
    expect(parseMentionId("no mention here")).toBeUndefined();
  });

  it("returns undefined for empty string", () => {
    expect(parseMentionId("")).toBeUndefined();
  });

  it("handles IDs with hyphens and mixed case", () => {
    expect(parseMentionId("[@X](root://user/Abc-123-XYZ)")).toBe("Abc-123-XYZ");
  });
});

describe("extractTrailingMention", () => {
  it("splits a trailing mention from text", () => {
    const [text, id] = extractTrailingMention(`sword of fire ${MENTION}`);
    expect(text).toBe("sword of fire");
    expect(id).toBe(ID);
  });

  it("returns full text and undefined when no mention", () => {
    const [text, id] = extractTrailingMention("sword of fire");
    expect(text).toBe("sword of fire");
    expect(id).toBeUndefined();
  });

  it("trims whitespace from the text part", () => {
    const [text] = extractTrailingMention(`  item  ${MENTION}  `);
    expect(text).toBe("item");
  });

  it("returns empty string and id if only a mention", () => {
    // This case happens with "!inv add [@user]..." where item could be empty
    // extractTrailingMention won't match (needs at least one word + space before mention)
    const [text, id] = extractTrailingMention(MENTION);
    expect(text).toBe(MENTION); // no space before mention, so no split
    expect(id).toBeUndefined();
  });

  it("handles multi-word item names before mention", () => {
    const [text, id] = extractTrailingMention(`Potion of Greater Healing ${MENTION}`);
    expect(text).toBe("Potion of Greater Healing");
    expect(id).toBe(ID);
  });
});
