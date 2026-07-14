import { describe, expect, it } from "vitest";
import { fitStoryArchitectureToSceneCount } from "./storyArchitecture";

function createArchitecture(sceneCount: number) {
  return {
    title: "Test story",
    premise: "A branching test",
    tone: "playful",
    scenePlan: Array.from({ length: sceneCount }, (_, index) => ({
      key: index >= sceneCount - 3 ? `ending_route_${index}` : `story_event_${index}`,
      branchId: index % 2 === 0 ? "route_a" : "route_b",
      purpose: `Purpose ${index}`,
      sceneType: index >= sceneCount - 3 ? "ending" : "normal",
      outgoingTargets: []
    }))
  };
}

describe("fitStoryArchitectureToSceneCount", () => {
  it("fits an oversized AI map to exactly twenty scenes", () => {
    const result = fitStoryArchitectureToSceneCount(createArchitecture(24), 20);
    const plan = result.architecture.scenePlan as Array<Record<string, unknown>>;

    expect(result.originalSceneCount).toBe(24);
    expect(result.changed).toBe(true);
    expect(plan).toHaveLength(20);
    expect(plan.filter((scene) => scene.sceneType === "ending")).toHaveLength(2);
    expect(plan.slice(-2).every((scene) => scene.sceneType === "ending")).toBe(true);
  });

  it("builds a reachable branching funnel with two endings", () => {
    const result = fitStoryArchitectureToSceneCount(createArchitecture(20), 20);
    const plan = result.architecture.scenePlan as Array<Record<string, unknown>>;
    const byKey = new Map(plan.map((scene) => [String(scene.key), scene]));
    const reachable = new Set<string>();
    const queue = [String(plan[0].key)];
    while (queue.length > 0) {
      const key = queue.shift();
      if (!key || reachable.has(key)) continue;
      reachable.add(key);
      queue.push(...((byKey.get(key)?.outgoingTargets as string[]) ?? []));
    }

    expect(reachable.size).toBe(20);
    expect(plan.slice(0, -2).every((scene) =>
      ((scene.outgoingTargets as string[]) ?? []).length === 2
    )).toBe(true);
    expect(plan.slice(-2).every((scene) =>
      ((scene.outgoingTargets as string[]) ?? []).length === 0
    )).toBe(true);
    const endingKeys = plan.slice(-2).map((scene) => scene.key);
    const resolutionScenes = plan.slice(-5, -2);
    expect(resolutionScenes[0].outgoingTargets).toEqual([
      endingKeys[0],
      resolutionScenes[1].key
    ]);
    expect(resolutionScenes[1].outgoingTargets).toEqual([
      endingKeys[1],
      resolutionScenes[2].key
    ]);
    expect(resolutionScenes[2].outgoingTargets).toEqual(endingKeys);
    expect(resolutionScenes.filter((scene) =>
      JSON.stringify(scene.outgoingTargets) === JSON.stringify(endingKeys)
    )).toHaveLength(1);
    expect(plan.slice(1).every((scene) => Array.isArray(scene.incomingSources))).toBe(true);
    expect(plan.every((scene) => scene.branchId === "shared")).toBe(true);
  });
});
