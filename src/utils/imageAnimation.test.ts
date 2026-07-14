import { describe, expect, it } from "vitest";
import {
  buildAIFramePlan,
  createStrictAnimationFramePrompt,
  getAnimationOutputSize,
  getAIPlaybackOrder,
  getProceduralAnimationFrames
} from "./imageAnimation";

describe("image animation helpers", () => {
  it("caps AI animation plans at twelve playback frames", () => {
    expect(buildAIFramePlan("idle", 30, 0.5, "", true)).toHaveLength(12);
    expect(buildAIFramePlan("blink", 1, 0.5, "", true)).toHaveLength(2);
  });

  it("uses the original picture at most once and generates every other frame", () => {
    const frames = buildAIFramePlan("blink", 8, 0.3, "", true);
    expect(frames.filter((frame) => frame.source === "original")).toHaveLength(1);
    expect(frames.filter((frame) => frame.source === "generated")).toHaveLength(7);
    expect(frames[2].instruction).toContain("distinct animation frame");
  });

  it("generates all requested frames when the original frame is disabled", () => {
    const frames = buildAIFramePlan("idle", 8, 0.3, "", false);
    expect(frames.every((frame) => frame.source === "generated")).toBe(true);
  });

  it("creates a ping-pong order without duplicating endpoints", () => {
    expect(getAIPlaybackOrder(4, true)).toEqual([0, 1, 2, 3, 2, 1]);
  });

  it("builds procedural keyframes and a strict reference prompt", () => {
    expect(getProceduralAnimationFrames("floating", 0.4, "auto").length).toBeGreaterThan(2);
    const prompt = createStrictAnimationFramePrompt("Eyes closed.");
    expect(prompt).toContain("LOCKED CANVAS");
    expect(prompt).toContain("Eyes closed.");
    expect(prompt).toContain("Do not redraw");
    expect(prompt).toContain("Never add a face");
    expect(prompt).toContain("crop boundaries");
  });

  it("keeps the source aspect ratio for GPT Image 2 animation frames", () => {
    expect(getAnimationOutputSize("gpt-image-2", 1080, 1920)).toBe("720x1280");
    expect(getAnimationOutputSize("gpt-image-2", 1920, 1080)).toBe("1280x720");
    expect(getAnimationOutputSize("gpt-image-2", 1024, 1024)).toBe("1024x1024");
    expect(getAnimationOutputSize("gpt-image-2", undefined, undefined)).toBe("auto");
  });
});
