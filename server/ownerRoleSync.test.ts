import { describe, expect, it } from "vitest";
import { resolvePersistedUserRole } from "./db";

describe("项目所有者角色同步", () => {
  it("在 OAuth 登录输入普通用户角色时仍保留项目所有者的管理员角色", () => {
    expect(resolvePersistedUserRole("owner-open-id", "user", "owner-open-id")).toBe("admin");
  });

  it("保留非所有者传入的角色，并为未指定角色的普通用户使用默认角色", () => {
    expect(resolvePersistedUserRole("standard-open-id", "admin", "owner-open-id")).toBe("admin");
    expect(resolvePersistedUserRole("standard-open-id", undefined, "owner-open-id")).toBe("user");
  });

  it("在 OAuth 登录未显式提供角色时保留已有管理员角色", () => {
    expect(resolvePersistedUserRole("existing-admin", undefined, "owner-open-id", "admin")).toBe("admin");
    expect(resolvePersistedUserRole("existing-user", undefined, "owner-open-id", "user")).toBe("user");
  });
});
