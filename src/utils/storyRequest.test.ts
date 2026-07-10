import { describe, expect, it } from "vitest";
import { extractRequestedSceneCount } from "./storyRequest";

describe("extractRequestedSceneCount", () => {
  it("uses the upper bound of a Russian scene range", () => {
    expect(extractRequestedSceneCount("Напиши историю на 30-35 сцен")).toBe(35);
    expect(extractRequestedSceneCount("Нужно от 30 до 35 сцен")).toBe(35);
  });

  it("recognizes single Russian and English scene counts below 40", () => {
    expect(extractRequestedSceneCount("Сделай 33 сцены")).toBe(33);
    expect(extractRequestedSceneCount("Create a 24-scene story")).toBe(24);
  });

  it("does not mistake scene ids for a requested total", () => {
    expect(extractRequestedSceneCount("Переход ведет в scene_18")).toBeNull();
  });

  it("prefers the latest instruction over older memory", () => {
    const prompt = [
      "LATEST BUILD INSTRUCTION:\nСделай 30 сцен.",
      "PERSISTENT STORY MEMORY TO FOLLOW STRICTLY:\nРаньше обсуждали 80 сцен."
    ].join("\n\n");
    expect(extractRequestedSceneCount(prompt)).toBe(30);
  });
});
