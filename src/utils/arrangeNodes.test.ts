import { describe, expect, it } from "vitest";
import { createChoice, createScene } from "../domain/project";
import { arrangeScenesAsTree } from "./arrangeNodes";

describe("arrangeScenesAsTree", () => {
  it("places the start scene above its branching descendants", () => {
    const start = createScene(1, "scene_1");
    const left = createScene(2, "scene_2");
    const right = createScene(3, "scene_3");
    const ending = createScene(4, "scene_4");
    start.choices = [createChoice(left.id), createChoice(right.id, "choice_2")];
    left.choices = [createChoice(ending.id, "choice_3")];

    const arranged = arrangeScenesAsTree([start, left, right, ending], start.id);
    const byId = new Map(arranged.map((scene) => [scene.id, scene]));

    expect(byId.get(start.id)!.position.y).toBeLessThan(byId.get(left.id)!.position.y);
    expect(byId.get(start.id)!.position.y).toBeLessThan(byId.get(right.id)!.position.y);
    expect(byId.get(left.id)!.position.y).toBeLessThan(byId.get(ending.id)!.position.y);
    expect(byId.get(left.id)!.position.x).not.toBe(byId.get(right.id)!.position.x);
  });

  it("ignores restart links back to the start scene", () => {
    const start = createScene(1, "scene_1");
    const loss = createScene(2, "scene_loss");
    start.choices = [createChoice(loss.id)];
    loss.choices = [createChoice(start.id, "choice_restart")];

    const arranged = arrangeScenesAsTree([loss, start], start.id);
    const arrangedStart = arranged.find((scene) => scene.id === start.id)!;
    const arrangedLoss = arranged.find((scene) => scene.id === loss.id)!;

    expect(arrangedStart.position.y).toBe(80);
    expect(arrangedLoss.position.y).toBeGreaterThan(arrangedStart.position.y);
  });

  it("handles non-start cycles and disconnected scenes without looping", () => {
    const start = createScene(1, "scene_1");
    const second = createScene(2, "scene_2");
    const third = createScene(3, "scene_3");
    const disconnected = createScene(4, "scene_4");
    start.choices = [createChoice(second.id)];
    second.choices = [createChoice(third.id)];
    third.choices = [createChoice(second.id)];

    const arranged = arrangeScenesAsTree([start, second, third, disconnected], start.id);

    expect(arranged).toHaveLength(4);
    expect(new Set(arranged.map((scene) => `${scene.position.x}:${scene.position.y}`)).size).toBe(4);
    expect(arranged.find((scene) => scene.id === disconnected.id)!.position.y).toBeGreaterThan(
      arranged.find((scene) => scene.id === start.id)!.position.y
    );
  });

  it("keeps each parent centered over its own branch", () => {
    const start = createScene(1, "scene_1");
    const left = createScene(2, "scene_2");
    const right = createScene(3, "scene_3");
    const leaves = [4, 5, 6, 7].map((index) => createScene(index, `scene_${index}`));
    start.choices = [createChoice(left.id), createChoice(right.id, "choice_2")];
    left.choices = leaves.slice(0, 3).map((scene, index) =>
      createChoice(scene.id, `choice_left_${index}`)
    );
    right.choices = [createChoice(leaves[3].id, "choice_right")];

    const arranged = arrangeScenesAsTree([start, left, right, ...leaves], start.id);
    const byId = new Map(arranged.map((scene) => [scene.id, scene]));
    const leftLeafPositions = leaves.slice(0, 3).map((scene) => byId.get(scene.id)!.position.x);
    const expectedLeftCenter =
      (leftLeafPositions[0] + leftLeafPositions[leftLeafPositions.length - 1]) / 2;

    expect(byId.get(left.id)!.position.x).toBe(expectedLeftCenter);
    expect(byId.get(start.id)!.position.x).toBeGreaterThan(byId.get(left.id)!.position.x);
    expect(byId.get(start.id)!.position.x).toBeLessThan(byId.get(right.id)!.position.x);
  });
});
