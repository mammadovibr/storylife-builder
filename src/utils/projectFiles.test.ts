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
});
