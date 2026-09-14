import { describe, expect, it } from "vitest";
import { getSidebarPresentation, SIDEBAR_DEFAULT_OPEN } from "./sidebarPresentation";

describe("sidebar presentation", () => {
  it("defaults to the compact icon rail on first entry", () => {
    expect(SIDEBAR_DEFAULT_OPEN).toBe(false);
  });

  it("maps collapsed and expanded states to explicit label and width behavior", () => {
    expect(getSidebarPresentation("collapsed")).toEqual({ isCollapsed: true, navLabelsHidden: true, widthMode: "icon" });
    expect(getSidebarPresentation("expanded")).toEqual({ isCollapsed: false, navLabelsHidden: false, widthMode: "full" });
  });
});
