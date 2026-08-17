import { describe, expect, it } from "vitest";
import { extractInsertId, resolveInsertId } from "./db";

describe("MySQL 新建记录主键解析", () => {
  it("支持 mysql2 返回的 ResultSetHeader 元组", () => {
    expect(extractInsertId([{ insertId: 42 }, []])).toBe(42);
  });

  it("支持直接返回的 ResultSetHeader", () => {
    expect(extractInsertId({ insertId: "7" })).toBe(7);
  });

  it("拒绝缺失或无效的主键", () => {
    expect(() => extractInsertId([{ insertId: 0 }, []])).toThrow("未能获取");
  });

  it("在驱动未暴露主键时采用可信回查主键", () => {
    expect(resolveInsertId({}, 17)).toBe(17);
    expect(() => resolveInsertId({}, undefined)).toThrow("未能获取");
  });
});
