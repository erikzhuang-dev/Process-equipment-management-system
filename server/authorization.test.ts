import { describe, expect, it } from "vitest";
import { assertAdminRole, assertOwnerRoleIsRetained } from "./authorization";

describe("角色访问控制", () => {
  it("允许管理员执行受控操作", () => {
    expect(() => assertAdminRole("admin")).not.toThrow();
  });

  it("拒绝普通用户执行管理员操作", () => {
    expect(() => assertAdminRole("user")).toThrow("仅管理员");
  });
});

describe("所有者角色保护", () => {
  it("拒绝将项目所有者降级为普通用户", () => {
    expect(() => assertOwnerRoleIsRetained({ targetOpenId: "owner", ownerOpenId: "owner", nextRole: "user" })).toThrow("必须保留管理员");
  });

  it("允许变更非所有者角色及保持所有者为管理员", () => {
    expect(() => assertOwnerRoleIsRetained({ targetOpenId: "member", ownerOpenId: "owner", nextRole: "user" })).not.toThrow();
    expect(() => assertOwnerRoleIsRetained({ targetOpenId: "owner", ownerOpenId: "owner", nextRole: "admin" })).not.toThrow();
  });
});
