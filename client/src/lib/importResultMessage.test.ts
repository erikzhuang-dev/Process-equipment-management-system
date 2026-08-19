import { describe, expect, it } from "vitest";
import { importResultMessage } from "./importResultMessage";

describe("importResultMessage", () => {
  it("在中文模式下描述三类导入的处理条数", () => {
    expect(importResultMessage("equipment", 10, "zh")).toBe("已导入 10 条设备台账");
    expect(importResultMessage("maintenance", 1, "zh")).toBe("已导入 1 条保养记录");
    expect(importResultMessage("repair", 1, "zh")).toBe("已导入 1 条维修记录");
  });

  it("在英文模式下使用对应业务对象名称", () => {
    expect(importResultMessage("equipment", 10, "en")).toBe("Imported 10 equipment records");
    expect(importResultMessage("maintenance", 1, "en")).toBe("Imported 1 maintenance records");
    expect(importResultMessage("repair", 1, "en")).toBe("Imported 1 repair records");
  });
});
