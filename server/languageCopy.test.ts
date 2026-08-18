import { describe, expect, it } from "vitest";
import { languageCopy } from "../client/src/contexts/languageCopy";

describe("权限受限页双语文案", () => {
  it("在英文模式下提供完整的英文标题和说明", () => {
    expect(languageCopy.accessDenied.en).toEqual({
      title: "Access Denied",
      description: "User permissions and audit logs are available to administrators only. Contact a system administrator to update your role.",
    });
  });
});
