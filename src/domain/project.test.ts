import { describe, expect, it } from "vitest";
import {
  activateSceneImageVariant,
  applySceneVisual,
  applyChoiceEffects,
  choiceConditionsPass,
  createFlag,
  createFlagCondition,
  createFlagEffect,
  createChoice,
  createDefaultProject,
  createParameter,
  createParameterCondition,
  createParameterEffect,
  createRuntimeState,
  createScene,
  getActiveSceneImageVariant,
  migrateProject,
  removeSceneImageVariant,
  resolveChoiceTarget
} from "./project";

describe("project domain", () => {
  it("migrates version 1 projects", () => {
    const project = createDefaultProject();

    expect(migrateProject(project)).toEqual(project);
  });

  it("adds v0.2 defaults to old v0.1 projects", () => {
    const oldProject = {
      version: 1,
      projectName: "Old project",
      startSceneId: "scene_old",
      scenes: [
        {
          id: "scene_old",
          title: "Old scene",
          text: "Old text",
          position: { x: 0, y: 0 },
          choices: [
            {
              id: "choice_old",
              text: "Continue",
              targetNodeId: "scene_old"
            }
          ]
        }
      ]
    };

    const migratedProject = migrateProject(oldProject);

    expect(migratedProject.parameters).toEqual([]);
    expect(migratedProject.flags).toEqual([]);
    expect(migratedProject.audio.backgroundMusicPath).toBe("");
    expect(migratedProject.audio.musicFadeInSeconds).toBe(0.8);
    expect(migratedProject.theme.backgroundColor).toBe("#eee8dc");
    expect(migratedProject.theme.sceneTransition).toBe("fade");
    expect(migratedProject.theme.sceneTransitionSpeed).toBe(1);
    expect(migratedProject.mediaLibrary.folders).toEqual([]);
    expect(migratedProject.storyBible.premise).toBe("");
    expect(migratedProject.storyBible.chapterPlan).toEqual([]);
    expect(migratedProject.scenes[0].imagePath).toBe("");
    expect(migratedProject.scenes[0].visualMediaType).toBe("image");
    expect(migratedProject.scenes[0].videoLoop).toBe(true);
    expect(migratedProject.scenes[0].soundPath).toBe("");
    expect(migratedProject.scenes[0].soundVolume).toBe(1);
    expect(migratedProject.scenes[0].layoutType).toBe("imageTop");
    expect(migratedProject.scenes[0].nodeColor).toBe("slate");
    expect(migratedProject.scenes[0].style.textScale).toBe(1);
    expect(migratedProject.scenes[0].style.showSceneTitle).toBe(true);
    expect(migratedProject.scenes[0].style.sceneTransition).toBe("project");
    expect(migratedProject.scenes[0].style.sceneTransitionSpeed).toBe(0);
    expect(migratedProject.scenes[0].style.ornamentStyle).toBe("none");
    expect(migratedProject.scenes[0].choices[0].effects).toEqual([]);
    expect(migratedProject.scenes[0].choices[0].conditions).toEqual([]);
    expect(migratedProject.scenes[0].choices[0].conditionFailBehavior).toBe(
      "disabled"
    );
    expect(migratedProject.scenes[0].choices[0].useMultipleOutcomes).toBe(false);
    expect(migratedProject.scenes[0].choices[0].outcomes).toEqual([
      {
        id: "outcome_choice_old",
        targetSceneId: "scene_old",
        percent: 100
      }
    ]);
  });

  it("infers video media for older projects that already contain a video path", () => {
    const project = createDefaultProject();
    const rawProject = JSON.parse(JSON.stringify(project));
    delete rawProject.scenes[0].visualMediaType;
    delete rawProject.scenes[0].videoLoop;
    rawProject.scenes[0].imagePath = "assets/intro.webm";

    const migratedProject = migrateProject(rawProject);

    expect(migratedProject.scenes[0].visualMediaType).toBe("video");
    expect(migratedProject.scenes[0].videoLoop).toBe(true);
  });

  it("creates a new choice without placeholder text", () => {
    const choice = createChoice("scene_2", "choice_1");

    expect(choice.text).toBe("");
    expect(choice.targetNodeId).toBe("scene_2");
  });

  it("keeps story bible memory when loading a saved project", () => {
    const project = createDefaultProject();
    project.storyBible = {
      ...project.storyBible,
      premise: "A pilot uncovers a conspiracy in deep space.",
      protagonist: "Captain Mira",
      openMysteries: ["Who sabotaged Orion?"],
      chapterPlan: [
        {
          id: "chapter_1",
          title: "Signal",
          summary: "Mira hears the impossible distress call.",
          targetSceneRange: "1-20",
          status: "inProgress"
        }
      ]
    };

    const migratedProject = migrateProject(JSON.parse(JSON.stringify(project)));

    expect(migratedProject.storyBible.premise).toBe(
      "A pilot uncovers a conspiracy in deep space."
    );
    expect(migratedProject.storyBible.openMysteries).toEqual([
      "Who sabotaged Orion?"
    ]);
    expect(migratedProject.storyBible.chapterPlan[0].title).toBe("Signal");
  });

  it("creates simple scene and choice ids", () => {
    const sceneA = createScene(1);
    const sceneB = createScene(2);
    const choice = createChoice(sceneA.id, "choice_7");

    expect(sceneA.id).toBe("scene_1");
    expect(sceneB.id).toBe("scene_2");
    expect(choice.id).toBe("choice_7");
  });

  it("keeps choices connected by targetNodeId", () => {
    const sceneA = createScene(1);
    const sceneB = createScene(2);
    sceneA.choices = [createChoice(sceneB.id)];
    sceneB.title = "Renamed target";

    expect(sceneA.choices[0].targetNodeId).toBe(sceneB.id);
  });

  it("chooses probability outcomes by percent", () => {
    const project = createDefaultProject();
    project.scenes = [createScene(1), createScene(2), createScene(3), createScene(4)];
    project.startSceneId = "scene_1";
    const choice = createChoice("scene_2");
    choice.useMultipleOutcomes = true;
    choice.outcomes = [
      { id: "outcome_1", targetSceneId: "scene_2", percent: 70 },
      { id: "outcome_2", targetSceneId: "scene_3", percent: 20 },
      { id: "outcome_3", targetSceneId: "scene_4", percent: 10 }
    ];

    const originalRandom = Math.random;
    Math.random = () => 0.75;
    try {
      expect(resolveChoiceTarget(choice, createRuntimeState(project))).toBe("scene_3");
    } finally {
      Math.random = originalRandom;
    }
  });

  it("keeps scene layout positions when loading a saved project", () => {
    const project = createDefaultProject();
    project.scenes[0].style = {
      ...project.scenes[0].style,
      imageOffsetX: -420,
      imageOffsetY: 690,
      titleOffsetX: 360,
      titleOffsetY: -510,
      titleScale: 1.6,
      textOffsetX: -330,
      textOffsetY: 840,
      textScale: 1.72,
      choicesOffsetX: 270,
      choicesOffsetY: 930,
      titleTextOffsetX: 45,
      titleTextOffsetY: -30,
      sceneTextOffsetX: -75,
      sceneTextOffsetY: 60,
      choiceTextOffsetX: 90,
      choiceTextOffsetY: 30,
      choicesScale: 1.25
    };

    const migratedProject = migrateProject(JSON.parse(JSON.stringify(project)));

    expect(migratedProject.scenes[0].style.imageOffsetY).toBe(690);
    expect(migratedProject.scenes[0].style.titleOffsetX).toBe(360);
    expect(migratedProject.scenes[0].style.titleOffsetY).toBe(-510);
    expect(migratedProject.scenes[0].style.textOffsetY).toBe(840);
    expect(migratedProject.scenes[0].style.textScale).toBe(1.72);
    expect(migratedProject.scenes[0].style.choicesOffsetY).toBe(930);
    expect(migratedProject.scenes[0].style.titleTextOffsetX).toBe(45);
    expect(migratedProject.scenes[0].style.sceneTextOffsetY).toBe(60);
    expect(migratedProject.scenes[0].style.choiceTextOffsetX).toBe(90);
  });

  it("keeps project and per-scene transitions when loading a saved project", () => {
    const project = createDefaultProject();
    project.theme.sceneTransition = "crossfade";
    project.theme.sceneTransitionSpeed = 1.7;
    project.scenes[0].style.sceneTransition = "pageTurn";
    project.scenes[0].style.sceneTransitionSpeed = 0.6;
    project.scenes[0].style.ornamentStyle = "celestial";

    const migratedProject = migrateProject(JSON.parse(JSON.stringify(project)));

    expect(migratedProject.theme.sceneTransition).toBe("crossfade");
    expect(migratedProject.theme.sceneTransitionSpeed).toBe(1.7);
    expect(migratedProject.scenes[0].style.sceneTransition).toBe("pageTurn");
    expect(migratedProject.scenes[0].style.sceneTransitionSpeed).toBe(0.6);
    expect(migratedProject.scenes[0].style.ornamentStyle).toBe("celestial");
  });

  it("keeps the polished transition presets and retires legacy push transitions", () => {
    const transitions = [
      "flipHorizontal",
      "flipVertical",
      "softSpiral",
      "gentleSwing",
      "depthDissolve",
      "dreamTilt"
    ] as const;

    for (const transition of transitions) {
      const project = createDefaultProject();
      project.theme.sceneTransition = transition;
      project.scenes[0].style.sceneTransition = transition;
      const migratedProject = migrateProject(JSON.parse(JSON.stringify(project)));

      expect(migratedProject.theme.sceneTransition).toBe(transition);
      expect(migratedProject.scenes[0].style.sceneTransition).toBe(transition);
    }

    const legacyProject = createDefaultProject();
    const rawLegacyProject = JSON.parse(JSON.stringify(legacyProject));
    rawLegacyProject.theme.sceneTransition = "pushLeft";
    rawLegacyProject.scenes[0].style.sceneTransition = "pushDown";
    const migratedLegacyProject = migrateProject(rawLegacyProject);

    expect(migratedLegacyProject.theme.sceneTransition).toBe("fade");
    expect(migratedLegacyProject.scenes[0].style.sceneTransition).toBe("fade");
  });

  it("keeps scene border visibility and choice frame settings", () => {
    const project = createDefaultProject();
    project.scenes[0].style = {
      ...project.scenes[0].style,
      titleBorderEnabled: false,
      textBorderEnabled: false,
      choicesBorderEnabled: false,
      choicesFrameStyle: "ornate_30",
      textPanelColor: "linear-gradient(135deg, #112233 0%, #aabbcc 100%)"
    };

    const migratedProject = migrateProject(JSON.parse(JSON.stringify(project)));
    const style = migratedProject.scenes[0].style;

    expect(style.titleBorderEnabled).toBe(false);
    expect(style.textBorderEnabled).toBe(false);
    expect(style.choicesBorderEnabled).toBe(false);
    expect(style.choicesFrameStyle).toBe("crafted_10");
    expect(style.textPanelColor).toBe(
      "linear-gradient(135deg, #112233 0%, #aabbcc 100%)"
    );
  });

  it("repairs duplicate choice ids while keeping targetNodeId links", () => {
    const rawProject = createDefaultProject();
    rawProject.scenes = [createScene(1), createScene(2)];
    rawProject.startSceneId = rawProject.scenes[0].id;
    rawProject.scenes[0].choices = [createChoice(rawProject.scenes[1].id, "choice_1")];
    rawProject.scenes[1].choices = [createChoice(rawProject.scenes[0].id, "choice_1")];

    const migratedProject = migrateProject(rawProject);
    const choiceIds = migratedProject.scenes.flatMap((scene) =>
      scene.choices.map((choice) => choice.id)
    );

    expect(new Set(choiceIds).size).toBe(choiceIds.length);
    expect(migratedProject.scenes[0].choices[0].targetNodeId).toBe("scene_2");
    expect(migratedProject.scenes[1].choices[0].targetNodeId).toBe("scene_1");
  });

  it("keeps generated image variants selectable instead of replacing them", () => {
    let scene = createScene(1);
    scene = applySceneVisual(scene, "C:\\images\\first.jpg", "image", {
      name: "First"
    });
    const firstVariantId = scene.activeImageVariantId;
    scene = applySceneVisual(scene, "C:\\images\\second.jpg", "image", {
      name: "Second"
    });

    expect(scene.imageVariants).toHaveLength(2);
    expect(scene.imagePath).toContain("second.jpg");

    scene = activateSceneImageVariant(scene, firstVariantId);
    expect(scene.imagePath).toContain("first.jpg");
    expect(getActiveSceneImageVariant(scene)?.name).toBe("First");
  });

  it("removes image variants and selects the nearest remaining image", () => {
    let scene = createScene(1);
    scene = applySceneVisual(scene, "C:\\images\\first.jpg", "image", {
      name: "First",
      prompt: "First prompt"
    });
    scene = applySceneVisual(scene, "C:\\images\\second.jpg", "image", {
      name: "Second",
      prompt: "Second prompt"
    });
    const secondVariantId = scene.activeImageVariantId;

    scene = removeSceneImageVariant(scene, secondVariantId);
    expect(scene.imageVariants).toHaveLength(1);
    expect(scene.imagePath).toContain("first.jpg");
    expect(scene.imageGenerationPrompt).toBe("First prompt");

    scene = removeSceneImageVariant(scene, scene.activeImageVariantId);
    expect(scene.imageVariants).toHaveLength(0);
    expect(scene.imagePath).toBe("");
    expect(scene.activeImageVariantId).toBe("");
  });

  it("keeps image prompts, generation settings, and character references in the project", () => {
    const project = createDefaultProject();
    project.scenes[0] = applySceneVisual(
      {
        ...project.scenes[0],
        imageGenerationPrompt: "A hero under warm lantern light",
        imageGenerationReferenceIds: ["hero", "friend"],
        imageGenerationUseReferences: true
      },
      "C:\\images\\generated.jpg",
      "image",
      {
        name: "Generated 1",
        prompt: "A hero under warm lantern light",
        referenceIds: ["hero", "friend"],
        useReferences: true,
        imageStyle: "cinematicRealism",
        aspectRatio: "16:9",
        imageModel: "gpt-image-2",
        imageQuality: "high"
      }
    );

    const restored = migrateProject(JSON.parse(JSON.stringify(project)));
    const scene = restored.scenes[0];
    const variant = getActiveSceneImageVariant(scene);

    expect(scene.imageGenerationPrompt).toBe("A hero under warm lantern light");
    expect(scene.imageGenerationReferenceIds).toEqual(["hero", "friend"]);
    expect(variant).toMatchObject({
      prompt: "A hero under warm lantern light",
      referenceIds: ["hero", "friend"],
      useReferences: true,
      imageStyle: "cinematicRealism",
      aspectRatio: "16:9",
      imageModel: "gpt-image-2",
      imageQuality: "high"
    });
  });

  it("keeps book themes and extended choice frames during migration", () => {
    const project = createDefaultProject();
    project.scenes[0].style.ornamentStyle = "book-antique";
    project.scenes[0].style.choicesFrameStyle = "crafted_35";

    const restored = migrateProject(JSON.parse(JSON.stringify(project)));

    expect(restored.scenes[0].style.ornamentStyle).toBe("book-antique");
    expect(restored.scenes[0].style.choicesFrameStyle).toBe("crafted_35");
  });

  it("checks parameter and flag conditions", () => {
    const project = createDefaultProject();
    const parameter = createParameter(1);
    const flag = createFlag(1);
    project.parameters = [{ ...parameter, initialValue: 100 }];
    project.flags = [{ ...flag, defaultValue: true }];

    const choice = createChoice(project.startSceneId);
    choice.conditions = [
      { ...createParameterCondition(parameter.id), operator: ">=", value: 100 },
      { ...createFlagCondition(flag.id), expectedValue: true }
    ];

    expect(choiceConditionsPass(choice, createRuntimeState(project))).toBe(true);
  });

  it("applies parameter and flag effects", () => {
    const project = createDefaultProject();
    const parameter = createParameter(1);
    const flag = createFlag(1);
    project.parameters = [{ ...parameter, initialValue: 50 }];
    project.flags = [{ ...flag, defaultValue: false }];

    const choice = createChoice(project.startSceneId);
    choice.effects = [
      { ...createParameterEffect(parameter.id), operation: "add", value: 100 },
      { ...createFlagEffect(flag.id), value: true }
    ];

    const nextState = applyChoiceEffects(
      project,
      createRuntimeState(project),
      choice
    );

    expect(nextState.parameters[parameter.id]).toBe(150);
    expect(nextState.flags[flag.id]).toBe(true);
  });
});
