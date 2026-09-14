import { describe, expect, it } from "vitest";
import { translateDynamicText } from "./LanguageContext";

describe("translateDynamicText", () => {
  it("translates split-equivalent pagination text in English mode", () => {
    expect(translateDynamicText("第 1 / 2 页", "en")).toBe("Page 1 / 2");
  });

  it("translates BU-specific empty-state headings in English mode", () => {
    expect(translateDynamicText("BU1 暂无设备", "en")).toBe("BU1 has no equipment");
  });

  it("preserves original text in Chinese mode", () => {
    expect(translateDynamicText("当前 BU 暂无归属设备；可清除筛选查看全部设备。", "zh")).toBe("当前 BU 暂无归属设备；可清除筛选查看全部设备。");
  });
});
