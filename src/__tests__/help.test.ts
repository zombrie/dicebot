import { describe, it, expect } from "vitest";
import { renderHelp } from "../help";

describe("renderHelp", () => {
  it("returns general help when no topic given", () => {
    const out = renderHelp();
    expect(out).toContain("!r");
    expect(out).toContain("!check");
    expect(out).toContain("!char");
    expect(out).toContain("!sheet");
  });

  it.each(["r", "roll", "dice"])("returns roll help for topic '%s'", (topic) => {
    const out = renderHelp(topic);
    expect(out).toContain("Roll Help");
    expect(out).toContain("!r");
  });

  it.each(["check", "checks"])("returns check help for topic '%s'", (topic) => {
    const out = renderHelp(topic);
    expect(out).toContain("Check Help");
    expect(out).toContain("!check");
  });

  it.each(["char", "character", "sheet", "stats"])("returns char help for topic '%s'", (topic) => {
    const out = renderHelp(topic);
    expect(out).toContain("Character Help");
    expect(out).toContain("!char");
  });

  it.each(["dm", "dungeon master"])("returns dm help for topic '%s'", (topic) => {
    const out = renderHelp(topic);
    expect(out).toContain("DM Help");
    expect(out).toContain("!dm");
  });

  it.each(["inv", "inventory"])("returns inventory help for topic '%s'", (topic) => {
    const out = renderHelp(topic);
    expect(out).toContain("Inventory Help");
    expect(out).toContain("!inv");
  });

  it("returns error message for unknown topic", () => {
    const out = renderHelp("banana");
    expect(out).toContain("don't recognize");
    expect(out).toContain("banana");
  });

  it("is case-insensitive for topics", () => {
    expect(renderHelp("ROLL")).toContain("Roll Help");
    expect(renderHelp("Check")).toContain("Check Help");
  });

  it("general help uses irl/ingame not a/b", () => {
    const out = renderHelp();
    expect(out).toContain("irl");
    expect(out).toContain("ingame");
    // make sure old a/b syntax isn't present
    expect(out).not.toMatch(/char use [ab]\b/);
    expect(out).not.toMatch(/ability str [ab] /);
  });

  it("char help uses irl/ingame not a/b", () => {
    const out = renderHelp("char");
    expect(out).toContain("irl");
    expect(out).toContain("ingame");
    expect(out).not.toMatch(/use [ab]\b/);
  });

  it("check help uses irl/ingame not a/b", () => {
    const out = renderHelp("check");
    expect(out).toContain("irl");
    expect(out).not.toMatch(/insight [ab]\b/);
  });
});
