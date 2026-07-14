import { describe, expect, it } from "vitest";
import {
  compileSemanticStoryBlueprint,
  StoryBlueprint,
  validateSemanticStoryBlueprint,
  validateStoryBlueprint,
  validateStoryBlueprintChunk
} from "./storyBlueprint";

const validBlueprint = {
  title: "Test",
  premise: "A branching test.",
  tone: "Clear",
  scenes: [
    {
      id: "scene_1",
      title: "Start",
      purpose: "Choose route",
      arrivalReason: "Story starts here",
      beat: "Two doors open",
      text: "Two doors open before the traveler, and a decision cannot be delayed.",
      sceneType: "normal",
      choices: [
        { text: "Left", targetSceneId: "scene_2", immediateConsequence: "Enter left room" },
        { text: "Right", targetSceneId: "scene_3", immediateConsequence: "Enter right room" }
      ]
    },
    {
      id: "scene_2",
      title: "Left",
      purpose: "Show left result",
      arrivalReason: "Player chose left",
      beat: "Find a key",
      text: "The left room contains a brass key beneath a dusty lamp.",
      sceneType: "normal",
      choices: [{ text: "Continue", targetSceneId: "scene_4", immediateConsequence: "Reach exit" }]
    },
    {
      id: "scene_3",
      title: "Right",
      purpose: "Show right result",
      arrivalReason: "Player chose right",
      beat: "Find a map",
      text: "The right room hides a marked map inside an old cabinet.",
      sceneType: "normal",
      choices: [{ text: "Continue", targetSceneId: "scene_4", immediateConsequence: "Reach exit" }]
    },
    {
      id: "scene_4",
      title: "End",
      purpose: "Resolve story",
      arrivalReason: "Both developed routes converge",
      beat: "The quest ends",
      text: "The traveler reaches the exit with the result of the chosen route.",
      sceneType: "ending",
      choices: []
    }
  ]
};

describe("validateStoryBlueprint", () => {
  it("accepts a connected branching blueprint", () => {
    expect(validateStoryBlueprint(validBlueprint, 4).problems).toEqual([]);
  });

  it("rejects fake choices with the same target", () => {
    const broken = structuredClone(validBlueprint);
    broken.scenes[0].choices[1].targetSceneId = "scene_2";
    expect(validateStoryBlueprint(broken, 4).problems).toContain(
      "scene_1: every choice must have a different immediate target."
    );
  });

  it("rejects unreachable scenes and the wrong requested count", () => {
    const broken = structuredClone(validBlueprint);
    broken.scenes[0].choices = [broken.scenes[0].choices[0]];
    const result = validateStoryBlueprint(broken, 5);
    expect(result.problems).toContain("Blueprint has 4 scenes; exactly 5 are required.");
    expect(result.problems).toContain("scene_3: scene is unreachable from scene_1.");
  });

  it("rejects backward filler loops", () => {
    const broken = structuredClone(validBlueprint);
    broken.scenes[2].choices[0].targetSceneId = "scene_2";
    expect(validateStoryBlueprint(broken, 4).problems).toContain(
      "scene_3: choice target scene_2 goes backward. Blueprint choices must move forward to prevent filler loops."
    );
  });

  it("rejects a large story with too few decisions and only one ending", () => {
    const scenes = Array.from({ length: 8 }, (_, index) => {
      const sceneNumber = index + 1;
      const nextSceneNumber = sceneNumber + 1;
      return {
        id: `scene_${sceneNumber}`,
        title: `Story beat ${sceneNumber}`,
        purpose: `Advance route ${sceneNumber}`,
        arrivalReason: `The previous action leads to beat ${sceneNumber}`,
        beat: `Consequence ${sceneNumber}`,
        text: `The route develops through a distinct consequence in story beat ${sceneNumber}.`,
        sceneType: sceneNumber === 8 ? "ending" : "normal",
        choices: sceneNumber === 8
          ? []
          : [{
              text: "Continue",
              targetSceneId: `scene_${nextSceneNumber}`,
              immediateConsequence: `Move to beat ${nextSceneNumber}`
            }]
      };
    });
    scenes[0].choices = [
      {
        text: "Take the first route",
        targetSceneId: "scene_2",
        immediateConsequence: "The first route opens"
      },
      {
        text: "Take the second route",
        targetSceneId: "scene_3",
        immediateConsequence: "The second route opens"
      }
    ];
    scenes[1].choices[0].targetSceneId = "scene_4";

    const result = validateStoryBlueprint(
      { title: "Thin graph", premise: "A fake large story", tone: "Clear", scenes },
      8
    );

    expect(result.problems).toContain("Blueprint needs at least 2 main ending scenes.");
    expect(result.problems).toContain(
      "Blueprint needs at least 2 real branching decisions; only 1 were found."
    );
  });
});

describe("validateStoryBlueprintChunk", () => {
  const emptyBlueprint: StoryBlueprint = {
    title: "Chunked story",
    premise: "A branching test",
    tone: "Tense",
    scenes: []
  };

  it("accepts an exact reachable chunk with links to future scenes", () => {
    const result = validateStoryBlueprintChunk(
      emptyBlueprint,
      { scenes: validBlueprint.scenes.slice(0, 2) },
      ["scene_1", "scene_2"],
      4
    );
    expect(result.problems).toEqual([]);
  });

  it("rejects backward targets inside a chunk", () => {
    const scenes = structuredClone(validBlueprint.scenes.slice(0, 3));
    scenes[2].choices[0].targetSceneId = "scene_2";
    const result = validateStoryBlueprintChunk(
      emptyBlueprint,
      { scenes },
      ["scene_1", "scene_2", "scene_3"],
      4
    );
    expect(result.problems).toContain(
      "scene_3: choice target scene_2 goes backward. Chunk choices must move forward."
    );
  });

  it("rejects a new scene that the accumulated graph cannot reach", () => {
    const scenes = structuredClone(validBlueprint.scenes.slice(0, 3));
    scenes[0].choices = [scenes[0].choices[0]];
    scenes[1].choices = [{
      text: "Skip farther ahead",
      targetSceneId: "scene_4",
      immediateConsequence: "The third scene is bypassed."
    }];
    const result = validateStoryBlueprintChunk(
      emptyBlueprint,
      { scenes },
      ["scene_1", "scene_2", "scene_3"],
      4
    );
    expect(result.problems).toContain(
      "scene_3: new scene is not reachable from scene_1 in the accumulated plan."
    );
  });
});

describe("semantic story compilation", () => {
  const semanticBlueprint = {
    title: "Semantic quest",
    premise: "A choice creates two visible consequences.",
    tone: "Clear",
    scenes: [
      {
        key: "opening_crossroads",
        branchId: "shared",
        characters: ["traveler"],
        location: "crossroads",
        title: "Crossroads",
        purpose: "Choose a route",
        arrivalReason: "The story begins here",
        beat: "Two roads open",
        text: "The traveler reaches two roads and must choose one.",
        sceneType: "normal",
        choices: [
          { text: "Take the bridge", targetKey: "bridge_shakes", immediateConsequence: "The bridge shakes" },
          { text: "Enter the tunnel", targetKey: "tunnel_darkens", immediateConsequence: "The tunnel darkens" }
        ]
      },
      {
        key: "bridge_shakes",
        branchId: "bridge",
        characters: ["traveler"],
        location: "bridge",
        title: "Shaking bridge",
        purpose: "Show the bridge consequence",
        arrivalReason: "The bridge route was chosen",
        beat: "The traveler crosses",
        text: "The bridge shakes under every step, but the traveler reaches safety.",
        sceneType: "ending",
        choices: []
      },
      {
        key: "tunnel_darkens",
        branchId: "tunnel",
        characters: ["traveler"],
        location: "tunnel",
        title: "Dark tunnel",
        purpose: "Show the tunnel consequence",
        arrivalReason: "The tunnel route was chosen",
        beat: "The traveler finds an exit",
        text: "Darkness closes in before a hidden exit leads outside.",
        sceneType: "ending",
        choices: []
      }
    ]
  };

  it("lets code assign technical scene ids after semantic validation", () => {
    const validation = validateSemanticStoryBlueprint(semanticBlueprint, 3);
    expect(validation.problems).toEqual([]);
    const compiled = compileSemanticStoryBlueprint(validation.blueprint!);
    expect(compiled.scenes.map((scene) => scene.id)).toEqual([
      "scene_1",
      "scene_2",
      "scene_3"
    ]);
    expect(compiled.scenes[0].choices.map((choice) => choice.targetSceneId)).toEqual([
      "scene_2",
      "scene_3"
    ]);
    expect(compiled.scenes[1].semanticKey).toBe("bridge_shakes");
  });

  it("rejects contamination between two incompatible branches", () => {
    const broken = structuredClone(semanticBlueprint);
    broken.scenes[1].sceneType = "normal";
    broken.scenes[1].choices = [{
      text: "Jump branches",
      targetKey: "tunnel_darkens",
      immediateConsequence: "The unrelated tunnel suddenly appears"
    }];
    expect(validateSemanticStoryBlueprint(broken, 3).problems).toContain(
      "bridge_shakes: choice crosses incompatible branch bridge -> tunnel without a shared convergence scene."
    );
  });
});
