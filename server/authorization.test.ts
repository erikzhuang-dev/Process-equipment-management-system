import { describe, expect, it } from "vitest";
import { assertAdminRole } from "./authorization";

describe("角色访问控制", () => {
  it("允许管理员执行受控操作", () => {
    expect(() => assertAdminRole("admin")).not.toThrow();
  });

  it("拒绝普通用户执行管理员操作", () => {
    expect(() => assertAdminRole("user")).toThrow("仅管理员");
  });
});
