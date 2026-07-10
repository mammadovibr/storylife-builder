import { describe, expect, it } from "vitest";
import { createDefaultProject } from "../domain/project";
import { StoryBlueprint } from "../utils/storyBlueprint";
import { finalizeProjectFromBlueprint } from "./AIAssistantModal";

const blueprint: StoryBlueprint = {
  title: "Compiled quest",
  premise: "A traveler chooses a route.",
  tone: "Tense",
  scenes: [
    {
      id: "scene_1",
      title: "Crossroads",
      purpose: "Open two routes",
      arrivalReason: "The story begins",
      beat: "Two roads split",
      text: "The traveler reaches a crossroads and must choose a road.",
      sceneType: "normal",
      choices: [
        {
          text: "Take the bridge",
          targetSceneId: "scene_2",
          immediateConsequence: "The bridge shakes."
        },
        {
          text: "Enter the tunnel",
          targetSceneId: "scene_3",
          immediateConsequence: "The tunnel grows dark."
        }
      ]
    },
    {
      id: "scene_2",
      title: "Bridge",
      purpose: "Resolve the bridge route",
      arrivalReason: "The bridge was chosen",
      beat: "The traveler crosses",
      text: "The traveler crosses the shaking bridge and reaches safety.",
      sceneType: "ending",
      choices: []
    },
    {
      id: "scene_3",
      title: "Tunnel",
      purpose: "Resolve the tunnel route",
      arrivalReason: "The tunnel was chosen",
      beat: "The traveler finds an exit",
      text: "A hidden door leads the traveler safely out of the tunnel.",
      sceneType: "ending",
      choices: []
    }
  ]
};

describe("finalizeProjectFromBlueprint", () => {
  it("compiles choices and keeps every scene reachable from scene_1", () => {
    const project = finalizeProjectFromBlueprint(
      { ...createDefaultProject(), scenes: [] },
      blueprint
    );

    expect(project.scenes[0].choices.map((choice) => choice.targetNodeId)).toEqual([
      "scene_2",
      "scene_3"
    ]);

    const reachable = new Set<string>();
    const queue = [project.startSceneId];
    while (queue.length > 0) {
      const sceneId = queue.shift();
      if (!sceneId || reachable.has(sceneId)) continue;
      reachable.add(sceneId);
      const scene = project.scenes.find((item) => item.id === sceneId);
      queue.push(...(scene?.choices.map((choice) => choice.targetNodeId) ?? []));
    }

    expect([...reachable].sort()).toEqual(["scene_1", "scene_2", "scene_3"]);
    expect(project.flags).toEqual([]);
    expect(project.parameters).toEqual([]);
  });
});
