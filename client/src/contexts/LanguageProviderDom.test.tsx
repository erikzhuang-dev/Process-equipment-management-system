// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LanguageProvider, useLanguage } from "./LanguageContext";

function PaginationFixture() {
  const { setLanguage } = useLanguage();
  return <><button onClick={() => setLanguage("en")}>English</button><p><span>第</span> 1 / 2 <span>页</span></p></>;
}

describe("LanguageProvider DOM translations", () => {
  it("removes the trailing Chinese pagination token when its English mapping is empty", async () => {
    const { container, unmount } = render(<LanguageProvider><PaginationFixture /></LanguageProvider>);
    try {
      fireEvent.click(screen.getByRole("button", { name: "English" }));
      await waitFor(() => expect(container.querySelector("p")?.textContent).toBe("Page 1 / 2 "));
    } finally {
      unmount();
    }
  });
});
