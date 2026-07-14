import { describe, expect, it } from "vitest";
import { createDefaultProject } from "../domain/project";
import {
  createStoryLifeProjectArchive,
  createStoryLifeProjectFileName,
  loadStoryLifeProjectArchive
} from "./projectFiles";

describe("StoryLife project files", () => {
  it("creates a recognizable custom file name", () => {
    expect(createStoryLifeProjectFileName("My Story")).toBe("My Story.storylife");
  });

  it("removes unsafe file-name characters and duplicate extensions", () => {
    expect(createStoryLifeProjectFileName('Bad:/Name?.storylife.json')).toBe(
      "Bad Name.storylife"
    );
  });

  it("uses a stable fallback for an empty project name", () => {
    expect(createStoryLifeProjectFileName("   ")).toBe("StoryLife Project.storylife");
  });

  it("round-trips embedded images and audio through the ZIP container", async () => {
    const project = createDefaultProject();
    project.scenes[0].imagePath = "data:image/png;base64,AQIDBA==";
    project.scenes[0].soundPath = "data:audio/mpeg;base64,BQYHCA==";

    const archive = await createStoryLifeProjectArchive(project);
    const restored = await loadStoryLifeProjectArchive(await archive.arrayBuffer());

    expect(restored.scenes[0].imagePath).toBe(project.scenes[0].imagePath);
    expect(restored.scenes[0].soundPath).toBe(project.scenes[0].soundPath);
  });

  it("round-trips embedded scene video and its loop setting", async () => {
    const project = createDefaultProject();
    project.scenes[0].imagePath = "data:video/mp4;base64,AQIDBA==";
    project.scenes[0].visualMediaType = "video";
    project.scenes[0].videoLoop = false;

    const archive = await createStoryLifeProjectArchive(project);
    const restored = await loadStoryLifeProjectArchive(await archive.arrayBuffer());

    expect(restored.scenes[0].imagePath).toBe(project.scenes[0].imagePath);
    expect(restored.scenes[0].visualMediaType).toBe("video");
    expect(restored.scenes[0].videoLoop).toBe(false);
  });

  it("round-trips image variants and disabled AI animation frames", async () => {
    const project = createDefaultProject();
    const scene = project.scenes[0];
    scene.imagePath = "data:image/jpeg;base64,AQIDBA==";
    scene.visualMediaType = "image";
    scene.activeImageVariantId = "variant_current";
    scene.imageVariants = [
      {
        id: "variant_current",
        imagePath: scene.imagePath,
        name: "Current",
        prompt: "first prompt",
        createdAt: 1,
        animation: {
          type: "aiFrames",
          enabled: false,
          sourceImagePath: scene.imagePath,
          mode: "blink",
          fps: 6,
          loop: true,
          pingPong: false,
          movementIntensity: 0.25,
          customInstruction: "",
          frames: [
            { id: "f1", source: "original", imagePath: "", instruction: "Original" },
            {
              id: "f2",
              source: "generated",
              imagePath: "data:image/jpeg;base64,BQYHCA==",
              instruction: "Eyes closed"
            }
          ]
        }
      },
      {
        id: "variant_old",
        imagePath: "data:image/png;base64,CQoLDA==",
        name: "Old",
        prompt: "older prompt",
        createdAt: 0,
        animation: null
      }
    ];

    const archive = await createStoryLifeProjectArchive(project);
    const restored = await loadStoryLifeProjectArchive(await archive.arrayBuffer());

    expect(restored.scenes[0].imageVariants).toHaveLength(2);
    expect(restored.scenes[0].imageVariants[0].animation?.enabled).toBe(false);
    expect(restored.scenes[0].imageVariants[0].animation?.type).toBe("aiFrames");
    const animation = restored.scenes[0].imageVariants[0].animation;
    expect(animation?.type === "aiFrames" ? animation.frames[1].imagePath : "").toBe(
      "data:image/jpeg;base64,BQYHCA=="
    );
    expect(restored.scenes[0].imageVariants[1].imagePath).toBe(
      "data:image/png;base64,CQoLDA=="
    );
  });
});
