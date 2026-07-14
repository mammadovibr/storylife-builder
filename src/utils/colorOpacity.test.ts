import { describe, expect, it } from "vitest";
import { applyColorOpacity } from "./colorOpacity";

describe("applyColorOpacity", () => {
  it("applies opacity to a solid hex color", () => {
    expect(applyColorOpacity("#336699", 0.4)).toBe("rgba(51, 102, 153, 0.4)");
  });

  it("applies opacity to every color stop in a gradient", () => {
    expect(
      applyColorOpacity("linear-gradient(135deg, #112233 0%, #aabbcc 100%)", 0.25)
    ).toBe(
      "linear-gradient(135deg, rgba(17, 34, 51, 0.25) 0%, rgba(170, 187, 204, 0.25) 100%)"
    );
  });

  it("multiplies existing rgba alpha inside a gradient", () => {
    expect(
      applyColorOpacity(
        "linear-gradient(90deg, rgba(10, 20, 30, 0.5), rgb(40, 50, 60))",
        0.4
      )
    ).toBe(
      "linear-gradient(90deg, rgba(10, 20, 30, 0.2), rgba(40, 50, 60, 0.4))"
    );
  });
});
