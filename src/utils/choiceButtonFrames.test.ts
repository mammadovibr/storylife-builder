import { describe, expect, it } from "vitest";
import {
  CHOICE_BUTTON_FRAMES,
  getChoiceButtonFrameStyle
} from "./choiceButtonFrames";

describe("choice button frames", () => {
  it("exposes all 20 native frame styles", () => {
    expect(CHOICE_BUTTON_FRAMES).toHaveLength(20);
    expect(CHOICE_BUTTON_FRAMES[0].id).toBe("crafted_01");
    expect(CHOICE_BUTTON_FRAMES[19].id).toBe("crafted_20");
  });

  it("uses native CSS without image assets", () => {
    const style = getChoiceButtonFrameStyle("crafted_01", 0.5);
    expect(style.backgroundImage).toBeUndefined();
    expect(style.background).toContain("rgba(");
    expect(String(style.background)).not.toContain("url(");
    expect(getChoiceButtonFrameStyle("none")).toEqual({});
  });
});
