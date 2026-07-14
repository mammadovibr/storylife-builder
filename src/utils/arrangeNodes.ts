import type { Scene, SceneId } from "../domain/project";

const NODE_WIDTH = 184;
const HORIZONTAL_GAP = 70;
const VERTICAL_GAP = 210;
const CANVAS_LEFT = 120;
const CANVAS_TOP = 80;

export function arrangeScenesAsTree(
  scenes: Scene[],
  startSceneId: SceneId
): Scene[] {
  if (scenes.length === 0) return scenes;

  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const startScene = scenes.find((scene) => scene.id === startSceneId) ?? scenes[0];
  const adjacency = new Map(
    scenes.map((scene) => [scene.id, readOutgoingSceneIds(scene, sceneIds, startScene.id)])
  );
  const children = new Map<SceneId, SceneId[]>();
  const depths = new Map<SceneId, number>();
  const visited = new Set<SceneId>();
  const roots: SceneId[] = [];

  buildSpanningTree(startScene.id, 0);
  const reachableMaxDepth = Math.max(0, ...depths.values());

  for (const scene of scenes) {
    if (!visited.has(scene.id)) {
      buildSpanningTree(scene.id, reachableMaxDepth + 1);
    }
  }

  let nextLeafCenter = NODE_WIDTH / 2;
  const centers = new Map<SceneId, number>();
  for (const rootId of roots) placeSubtree(rootId);

  const minimumCenter = Math.min(...centers.values());
  const xShift = CANVAS_LEFT + NODE_WIDTH / 2 - minimumCenter;

  return scenes.map((scene) => ({
    ...scene,
    position: {
      x: Math.round((centers.get(scene.id) ?? NODE_WIDTH / 2) + xShift - NODE_WIDTH / 2),
      y: CANVAS_TOP + (depths.get(scene.id) ?? 0) * VERTICAL_GAP
    }
  }));

  function buildSpanningTree(rootId: SceneId, rootDepth: number) {
    roots.push(rootId);
    visited.add(rootId);
    depths.set(rootId, rootDepth);
    const queue = [rootId];

    for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
      const sourceId = queue[queueIndex];
      const sourceDepth = depths.get(sourceId) ?? rootDepth;
      for (const targetId of adjacency.get(sourceId) ?? []) {
        if (visited.has(targetId)) continue;
        visited.add(targetId);
        depths.set(targetId, sourceDepth + 1);
        children.set(sourceId, [...(children.get(sourceId) ?? []), targetId]);
        queue.push(targetId);
      }
    }
  }

  function placeSubtree(sceneId: SceneId): number {
    const childIds = children.get(sceneId) ?? [];
    if (childIds.length === 0) {
      const center = nextLeafCenter;
      nextLeafCenter += NODE_WIDTH + HORIZONTAL_GAP;
      centers.set(sceneId, center);
      return center;
    }

    const childCenters = childIds.map(placeSubtree);
    const center = (childCenters[0] + childCenters[childCenters.length - 1]) / 2;
    centers.set(sceneId, center);
    return center;
  }
}

function readOutgoingSceneIds(
  scene: Scene,
  sceneIds: Set<SceneId>,
  startSceneId: SceneId
): SceneId[] {
  const targets: SceneId[] = [];
  for (const choice of scene.choices) {
    if (choice.useMultipleOutcomes && choice.outcomes.length > 0) {
      targets.push(...choice.outcomes.map((outcome) => outcome.targetSceneId));
    } else {
      targets.push(choice.targetNodeId);
    }
    targets.push(...choice.conditionalTargets.map((target) => target.targetSceneId));
  }

  return [...new Set(targets)].filter(
    (targetId) => targetId !== startSceneId && sceneIds.has(targetId)
  );
}
