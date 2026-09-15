import { describe, expect, it } from "vitest";
import {
  APPROVAL_NODES,
  buildChangeChain,
  buildPurchaseChain,
  isQuotationComplete,
  slaHours,
} from "./applyEngine";
import { DEFAULT_THRESHOLDS } from "../shared/apply";

const T = DEFAULT_THRESHOLDS;

describe("buildChangeChain 金额分链", () => {
  it("小额维修走轻量链（初审 + 设备主管）", () => {
    expect(buildChangeChain({ changeType: "repair", estimatedFee: 3000, thresholds: T })).toEqual([
      "admin_review",
      "manager_lite",
    ]);
  });

  it("中额维修进入工程师评审 + 设备经理", () => {
    expect(buildChangeChain({ changeType: "repair", estimatedFee: 12000, thresholds: T })).toEqual([
      "admin_review",
      "engineer_review",
      "manager",
    ]);
  });

  it("大额改造需 BU 负责人加签", () => {
    expect(buildChangeChain({ changeType: "retrofit", estimatedFee: 60000, thresholds: T })).toEqual([
      "admin_review",
      "engineer_review",
      "manager",
      "bu_owner",
    ]);
  });

  it("报废单必加总经理，与金额无关", () => {
    expect(buildChangeChain({ changeType: "scrap", estimatedFee: 800, thresholds: T })).toEqual([
      "admin_review",
      "engineer_review",
      "manager",
      "bu_owner",
      "gm",
    ]);
  });

  it("金额达到 CHG_GM 加签总经理", () => {
    expect(buildChangeChain({ changeType: "repair", estimatedFee: 150000, thresholds: T }).at(-1)).toBe("gm");
  });

  it("链内每个节点的角色映射存在", () => {
    const chain = buildChangeChain({ changeType: "transfer", estimatedFee: 200000, thresholds: T });
    for (const node of chain) {
      expect(APPROVAL_NODES[node].roleKey).toBeTruthy();
    }
  });
});

describe("buildPurchaseChain", () => {
  it("固定一级审批链（不分金额）", () => {
    expect(buildPurchaseChain()).toEqual(["bu_owner", "engineer_review", "purchaser"]);
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
