import { describe, expect, it } from "vitest";
import {
  APPROVAL_NODES,
  buildChangeChain,
  buildPurchaseChain,
  isQuotationComplete,
  slaHours,
} from "./applyEngine";

describe("buildChangeChain 两类权限统一审批", () => {
  it("修改申请统一单节点（管理员审批），与金额/类型无关", () => {
    expect(buildChangeChain()).toEqual(["admin_approve"]);
  });

  it("链内每个节点的角色映射存在", () => {
    for (const node of buildChangeChain()) {
      expect(APPROVAL_NODES[node].roleKey).toBeTruthy();
    }
  });
});

describe("buildPurchaseChain", () => {
  it("购买申请统一单节点（管理员审批）", () => {
    expect(buildPurchaseChain()).toEqual(["admin_approve"]);
  });
});

describe("比价硬拦截", () => {
  it("少于 3 家报价不完整", () => {
    expect(isQuotationComplete(0)).toBe(false);
    expect(isQuotationComplete(2)).toBe(false);
  });

  it("3 家及以上视为完整", () => {
    expect(isQuotationComplete(3)).toBe(true);
    expect(isQuotationComplete(5)).toBe(true);
  });
});

describe("紧急度 SLA", () => {
  it("停机风险 2 小时预警 / 4 小时升级", () => {
    expect(slaHours("shutdown")).toEqual({ warn: 2, escalate: 4 });
  });

  it("常规申请 24 / 48 小时", () => {
    expect(slaHours("normal")).toEqual({ warn: 24, escalate: 48 });
    expect(slaHours("production")).toEqual({ warn: 24, escalate: 48 });
  });
});
