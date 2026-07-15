import { describe, expect, it } from "vitest";
import {
  CHOICE_BUTTON_FRAMES,
  getChoiceButtonFrameStyle
} from "./choiceButtonFrames";

describe("choice button frames", () => {
  it("exposes all 35 native frame styles", () => {
    expect(CHOICE_BUTTON_FRAMES).toHaveLength(35);
    expect(CHOICE_BUTTON_FRAMES[0].id).toBe("crafted_01");
    expect(CHOICE_BUTTON_FRAMES[34].id).toBe("crafted_35");
  });

  it("uses native CSS without image assets", () => {
    const style = getChoiceButtonFrameStyle("crafted_01", 0.5);
    expect(style.backgroundImage).toBeUndefined();
    expect(style.background).toContain("rgba(");
    expect(String(style.background)).not.toContain("url(");
    expect(getChoiceButtonFrameStyle("none")).toEqual({});
  });

  it("keeps patterned frames opacity-aware", () => {
    const style = getChoiceButtonFrameStyle("crafted_22", 0.4);
    expect(String(style.background)).toContain("rgba(");
    expect(String(style.background)).toContain("repeating-linear-gradient");
  });
});
