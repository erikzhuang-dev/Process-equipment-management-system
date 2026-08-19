// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageProvider, useLanguage } from "./LanguageContext";

function PaginationFixture() {
  const { setLanguage } = useLanguage();
  return <><button onClick={() => setLanguage("en")}>English</button><p><span>第</span> 1 / 2 <span>页</span></p></>;
}

function CoreModulesFixture() {
  const { setLanguage } = useLanguage();
  return <><button onClick={() => setLanguage("en")}>English</button><section><p>关键运营说明</p><p>设备详情</p><p>预防性维护</p><p>故障闭环</p><p>备件出入库流水</p><p>用户权限与操作日志</p><p>资产类别</p><p>设备、生产与生命周期参数</p><p>投资与折旧</p><p>治理信息</p></section></>;
}

describe("LanguageProvider DOM translations", () => {
  it("removes the trailing Chinese pagination token when its English mapping is empty", async () => {
    localStorage.setItem("equipment-management-language", "zh");
    const { container, unmount } = render(<LanguageProvider><PaginationFixture /></LanguageProvider>);
    try {
      fireEvent.click(screen.getByRole("button", { name: "English" }));
      await waitFor(() => expect(container.querySelector("p")?.textContent).toBe("Page 1 / 2 "));
    } finally {
      unmount();
    }
  });

  it("translates key dashboard and lifecycle module labels in English mode", async () => {
    localStorage.setItem("equipment-management-language", "zh");
    const { container, unmount } = render(<LanguageProvider><CoreModulesFixture /></LanguageProvider>);
    try {
      fireEvent.click(screen.getByRole("button", { name: "English" }));
      await waitFor(() => expect(container.textContent).toContain("Key Operating Notes"));
      expect(container.textContent).toContain("Equipment Detail");
      expect(container.textContent).toContain("Preventive Maintenance");
      expect(container.textContent).toContain("Fault Resolution");
      expect(container.textContent).toContain("Parts Inventory Transactions");
      expect(container.textContent).toContain("User Permissions & Audit Log");
      expect(container.textContent).toContain("Asset Category");
      expect(container.textContent).toContain("Equipment, Production & Lifecycle");
      expect(container.textContent).toContain("Investment & Depreciation");
      expect(container.textContent).toContain("Governance Information");
    } finally {
      unmount();
    }
  });
});
