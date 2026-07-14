import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStoryLifeArchive, readStoryLifeArchive } from "./projectArchive.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  );
});

describe("desktop StoryLife archive", () => {
  it("extracts embedded media to local files instead of restoring base64", async () => {
    const extractionDirectory = await mkdtemp(join(tmpdir(), "storylife-archive-test-"));
    temporaryDirectories.push(extractionDirectory);
    const project = {
      scenes: [
        {
          id: "scene_1",
          imagePath: "data:image/png;base64,AQIDBA==",
          visualMediaType: "image" as const,
          soundPath: "data:audio/mpeg;base64,ERITFA==",
          activeImageVariantId: "variant_1",
          imageVariants: [
            {
              id: "variant_1",
              imagePath: "data:image/png;base64,AQIDBA==",
              animation: {
                type: "aiFrames" as const,
                enabled: false,
                sourceImagePath: "data:image/png;base64,AQIDBA==",
                frames: [
                  { source: "original", imagePath: "" },
                  { source: "generated", imagePath: "data:image/jpeg;base64,CQoLDA==" }
                ]
              }
            },
            {
              id: "variant_2",
              imagePath: "data:image/webp;base64,DQ4PEA=="
            }
          ]
        }
      ],
      audio: {
        backgroundMusicPath: "data:audio/ogg;base64,FRYXGA=="
      },
      characterReferences: [
        {
          id: "character_1",
          imagePath: "data:image/jpeg;base64,GRobHA=="
        }
      ],
      mediaLibrary: {
        folders: [
          {
            assets: [
              {
                id: "media_1",
                name: "Library image",
                path: "data:image/webp;base64,HR4fIA==",
                type: "image"
              }
            ]
          }
        ]
      }
    };

    const archive = await createStoryLifeArchive(JSON.stringify(project));
    const restored = JSON.parse(
      await readStoryLifeArchive(archive, extractionDirectory)
    ) as typeof project;

    expect(restored.scenes[0].imagePath.startsWith("data:")).toBe(false);
    expect(restored.scenes[0].imagePath.startsWith(extractionDirectory)).toBe(true);
    expect([...await readFile(restored.scenes[0].imagePath)]).toEqual([1, 2, 3, 4]);
    expect(restored.scenes[0].imageVariants[0].animation?.enabled).toBe(false);
    expect(restored.scenes[0].imageVariants[0].animation?.frames[1].imagePath).toContain(
      extractionDirectory
    );
    expect(restored.scenes[0].imageVariants[1].imagePath).toContain(extractionDirectory);
    expect(restored.scenes[0].soundPath).toContain(extractionDirectory);
    expect(restored.audio.backgroundMusicPath).toContain(extractionDirectory);
    expect(restored.characterReferences[0].imagePath).toContain(extractionDirectory);
    expect(restored.mediaLibrary.folders[0].assets[0].path).toContain(extractionDirectory);

    const resavedArchive = await createStoryLifeArchive(JSON.stringify(restored));
    const portableAgain = JSON.parse(
      await readStoryLifeArchive(resavedArchive)
    ) as typeof project;
    expect(portableAgain.scenes[0].imagePath).toBe("data:image/png;base64,AQIDBA==");
    expect(portableAgain.scenes[0].imageVariants[0].animation?.frames[1].imagePath).toBe(
      "data:image/jpeg;base64,CQoLDA=="
    );
    expect(portableAgain.scenes[0].imageVariants[1].imagePath).toBe(
      "data:image/webp;base64,DQ4PEA=="
    );
    expect(portableAgain.scenes[0].soundPath).toBe(
      "data:audio/mpeg;base64,ERITFA=="
    );
    expect(portableAgain.audio.backgroundMusicPath).toBe(
      "data:audio/ogg;base64,FRYXGA=="
    );
    expect(portableAgain.characterReferences[0].imagePath).toBe(
      "data:image/jpeg;base64,GRobHA=="
    );
    expect(portableAgain.mediaLibrary.folders[0].assets[0].path).toBe(
      "data:image/webp;base64,HR4fIA=="
    );
  });
});
