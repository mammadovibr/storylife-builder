export interface StoryBlueprintChoice {
  text: string;
  targetSceneId: string;
  immediateConsequence: string;
}

export interface StoryBlueprintScene {
  id: string;
  semanticKey?: string;
  branchId?: string;
  characters?: string[];
  location?: string;
  title: string;
  purpose: string;
  arrivalReason: string;
  beat: string;
  text: string;
  sceneType: "normal" | "ending";
  choices: StoryBlueprintChoice[];
}

export interface StoryBlueprint {
  title: string;
  premise: string;
  tone: string;
  scenes: StoryBlueprintScene[];
}

export interface SemanticStoryChoice {
  text: string;
  targetKey: string;
  immediateConsequence: string;
}

export interface SemanticStoryScene {
  key: string;
  branchId: string;
  characters: string[];
  location: string;
  title: string;
  purpose: string;
  arrivalReason: string;
  beat: string;
  text: string;
  sceneType: "normal" | "ending";
  choices: SemanticStoryChoice[];
}

export interface SemanticStoryBlueprint {
  title: string;
  premise: string;
  tone: string;
  scenes: SemanticStoryScene[];
}

export function validateSemanticStoryBlueprintChunk(
  approvedBlueprint: SemanticStoryBlueprint,
  rawChunk: unknown,
  requiredSceneKeys: string[],
  completeSceneOrder: string[]
): { scenes: SemanticStoryScene[]; problems: string[] } {
  if (!isRecord(rawChunk) || !Array.isArray(rawChunk.scenes)) {
    return { scenes: [], problems: ["Story chunk must be a JSON object with a scenes array."] };
  }

  const scenes = rawChunk.scenes.filter(isRecord).map(normalizeSemanticScene);
  const problems: string[] = [];
  const returnedKeys = scenes.map((scene) => scene.key);
  if (
    returnedKeys.length !== requiredSceneKeys.length ||
    returnedKeys.some((key, index) => key !== requiredSceneKeys[index])
  ) {
    problems.push(
      `Chunk must contain exactly these semantic scene keys in order: ${requiredSceneKeys.join(", ")}.`
    );
  }

  const approvedKeys = new Set(approvedBlueprint.scenes.map((scene) => scene.key));
  const completeKeySet = new Set(completeSceneOrder);
  const orderByKey = new Map(completeSceneOrder.map((key, index) => [key, index]));
  for (const scene of scenes) {
    if (approvedKeys.has(scene.key)) {
      problems.push(`${scene.key}: chunk tried to rewrite an approved scene.`);
    }
    validateSemanticSceneFields(scene, problems);
    const sourceIndex = orderByKey.get(scene.key);
    const targetKeys = new Set(scene.choices.map((choice) => choice.targetKey));
    if (scene.choices.length > 1 && targetKeys.size !== scene.choices.length) {
      problems.push(`${scene.key}: every choice must have a different immediate target.`);
    }
    for (const choice of scene.choices) {
      const targetIndex = orderByKey.get(choice.targetKey);
      if (!completeKeySet.has(choice.targetKey)) {
        problems.push(`${scene.key}: choice points to unknown semantic key ${choice.targetKey || "(empty)"}.`);
      } else if (
        sourceIndex !== undefined &&
        targetIndex !== undefined &&
        targetIndex <= sourceIndex
      ) {
        problems.push(`${scene.key}: choice target ${choice.targetKey} goes backward.`);
      }
    }
  }

  const combinedScenes = [...approvedBlueprint.scenes, ...scenes];
  const reachableKeys = walkSemantic(combinedScenes, completeSceneOrder[0] ?? "");
  for (const scene of scenes) {
    if (!reachableKeys.has(scene.key)) {
      problems.push(`${scene.key}: scene is not reachable from the opening scene in the accumulated story.`);
    }
  }

  const lastRequiredKey = requiredSceneKeys.at(-1);
  const lastRequiredIndex = lastRequiredKey ? orderByKey.get(lastRequiredKey) : undefined;
  if (lastRequiredIndex !== undefined && lastRequiredIndex < completeSceneOrder.length - 1) {
    const nextBlockKeys = new Set(
      completeSceneOrder.slice(lastRequiredIndex + 1, lastRequiredIndex + 1 + requiredSceneKeys.length)
    );
    const opensNextBlock = combinedScenes.some((scene) =>
      scene.choices.some((choice) => nextBlockKeys.has(choice.targetKey))
    );
    if (!opensNextBlock) {
      problems.push("Chunk must open the next story block with at least one choice target.");
    }
  }

  return { scenes, problems: [...new Set(problems)].slice(0, 40) };
}

export function validateSemanticStoryBlueprint(
  rawBlueprint: unknown,
  targetSceneCount: number | null
): { blueprint: SemanticStoryBlueprint | null; problems: string[] } {
  if (!isRecord(rawBlueprint) || !Array.isArray(rawBlueprint.scenes)) {
    return { blueprint: null, problems: ["Story blueprint must contain a scenes array."] };
  }

  const scenes = rawBlueprint.scenes.filter(isRecord).map(normalizeSemanticScene);
  const blueprint: SemanticStoryBlueprint = {
    title: readText(rawBlueprint.title),
    premise: readText(rawBlueprint.premise),
    tone: readText(rawBlueprint.tone),
    scenes
  };
  const problems: string[] = [];
  if (!blueprint.title) problems.push("Blueprint title is missing.");
  if (!blueprint.premise) problems.push("Blueprint premise is missing.");
  if (targetSceneCount !== null && scenes.length !== targetSceneCount) {
    problems.push(`Blueprint has ${scenes.length} scenes; exactly ${targetSceneCount} are required.`);
  }
  if (scenes.length === 0) return { blueprint, problems: [...new Set(problems)] };

  const keySet = new Set(scenes.map((scene) => scene.key));
  const indexByKey = new Map(scenes.map((scene, index) => [scene.key, index]));
  const sceneByKey = new Map(scenes.map((scene) => [scene.key, scene]));
  if (keySet.size !== scenes.length) problems.push("Blueprint contains duplicate semantic scene keys.");

  for (const [index, scene] of scenes.entries()) {
    validateSemanticSceneFields(scene, problems);
    const targetKeys = new Set(scene.choices.map((choice) => choice.targetKey));
    if (scene.choices.length > 1 && targetKeys.size !== scene.choices.length) {
      problems.push(`${scene.key}: every choice must have a different immediate target.`);
    }
    for (const choice of scene.choices) {
      const target = sceneByKey.get(choice.targetKey);
      const targetIndex = indexByKey.get(choice.targetKey);
      if (!target) {
        problems.push(`${scene.key}: choice points to missing ${choice.targetKey || "(empty)"}.`);
        continue;
      }
      if (targetIndex !== undefined && targetIndex <= index) {
        problems.push(`${scene.key}: choice target ${choice.targetKey} goes backward.`);
      }
      if (
        scene.branchId !== target.branchId &&
        scene.branchId !== "shared" &&
        target.branchId !== "shared"
      ) {
        problems.push(
          `${scene.key}: choice crosses incompatible branch ${scene.branchId} -> ${target.branchId} without a shared convergence scene.`
        );
      }
    }
  }

  const endingKeys = new Set(
    scenes.filter((scene) => scene.sceneType === "ending").map((scene) => scene.key)
  );
  if (endingKeys.size === 0) problems.push("Blueprint has no ending scenes.");
  const reachableKeys = walkSemantic(scenes, scenes[0].key);
  for (const scene of scenes) {
    if (!reachableKeys.has(scene.key)) problems.push(`${scene.key}: scene is unreachable from the opening scene.`);
  }

  const canReachEnding = new Set(endingKeys);
  let changed = true;
  while (changed) {
    changed = false;
    for (const scene of scenes) {
      if (
        !canReachEnding.has(scene.key) &&
        scene.choices.some((choice) => canReachEnding.has(choice.targetKey))
      ) {
        canReachEnding.add(scene.key);
        changed = true;
      }
    }
  }
  for (const scene of scenes) {
    if (reachableKeys.has(scene.key) && !canReachEnding.has(scene.key)) {
      problems.push(`${scene.key}: no route from this scene reaches an ending.`);
    }
  }

  return { blueprint, problems: [...new Set(problems)].slice(0, 50) };
}

export function compileSemanticStoryBlueprint(
  blueprint: SemanticStoryBlueprint
): StoryBlueprint {
  const idByKey = new Map(
    blueprint.scenes.map((scene, index) => [scene.key, `scene_${index + 1}`])
  );
  return {
    title: blueprint.title,
    premise: blueprint.premise,
    tone: blueprint.tone,
    scenes: blueprint.scenes.map((scene, index) => ({
      id: `scene_${index + 1}`,
      semanticKey: scene.key,
      branchId: scene.branchId,
      characters: [...scene.characters],
      location: scene.location,
      title: scene.title,
      purpose: scene.purpose,
      arrivalReason: scene.arrivalReason,
      beat: scene.beat,
      text: scene.text,
      sceneType: scene.sceneType,
      choices: scene.choices.map((choice) => ({
        text: choice.text,
        targetSceneId: idByKey.get(choice.targetKey) ?? "",
        immediateConsequence: choice.immediateConsequence
      }))
    }))
  };
}

export function validateStoryBlueprintChunk(
  approvedBlueprint: StoryBlueprint,
  rawChunk: unknown,
  requiredSceneIds: string[],
  targetSceneCount: number
): { scenes: StoryBlueprintScene[]; problems: string[] } {
  if (!isRecord(rawChunk) || !Array.isArray(rawChunk.scenes)) {
    return { scenes: [], problems: ["Blueprint chunk must be a JSON object with a scenes array."] };
  }

  const scenes = rawChunk.scenes.filter(isRecord).map(normalizeBlueprintScene);
  const problems: string[] = [];
  const returnedIds = scenes.map((scene) => scene.id);
  if (
    returnedIds.length !== requiredSceneIds.length ||
    returnedIds.some((sceneId, index) => sceneId !== requiredSceneIds[index])
  ) {
    problems.push(
      `Chunk must contain exactly these scenes in order: ${requiredSceneIds.join(", ")}.`
    );
  }

  const approvedIds = new Set(approvedBlueprint.scenes.map((scene) => scene.id));
  for (const scene of scenes) {
    if (approvedIds.has(scene.id)) {
      problems.push(`${scene.id}: chunk tried to rewrite an already approved scene.`);
    }
    if (!scene.title || !scene.purpose || !scene.arrivalReason || !scene.beat || !scene.text) {
      problems.push(`${scene.id || "(missing id)"}: all scene fields are required.`);
    }
    if (scene.sceneType === "ending" && scene.choices.length > 0) {
      problems.push(`${scene.id}: ending scene must have no choices.`);
    }
    if (scene.sceneType === "normal" && scene.choices.length === 0) {
      problems.push(`${scene.id}: normal scene must have at least one choice.`);
    }

    const targetIds = new Set(scene.choices.map((choice) => choice.targetSceneId));
    if (scene.choices.length > 1 && targetIds.size !== scene.choices.length) {
      problems.push(`${scene.id}: every choice must have a different immediate target.`);
    }
    const sourceNumber = readSceneNumber(scene.id);
    for (const choice of scene.choices) {
      const targetNumber = readSceneNumber(choice.targetSceneId);
      if (!choice.text || !choice.immediateConsequence) {
        problems.push(`${scene.id}: every choice needs text and an immediateConsequence.`);
      }
      if (
        targetNumber === null ||
        targetNumber < 1 ||
        targetNumber > targetSceneCount
      ) {
        problems.push(
          `${scene.id}: choice target ${choice.targetSceneId || "(empty)"} is outside scene_1 through scene_${targetSceneCount}.`
        );
      } else if (sourceNumber !== null && targetNumber <= sourceNumber) {
        problems.push(
          `${scene.id}: choice target ${choice.targetSceneId} goes backward. Chunk choices must move forward.`
        );
      }
    }
  }

  const combinedScenes = [...approvedBlueprint.scenes, ...scenes];
  const reachableIds = walkForward(combinedScenes, combinedScenes[0]?.id ?? "");
  for (const scene of scenes) {
    if (!reachableIds.has(scene.id)) {
      problems.push(`${scene.id}: new scene is not reachable from scene_1 in the accumulated plan.`);
    }
  }

  const lastRequiredNumber = readSceneNumber(requiredSceneIds.at(-1) ?? "");
  if (lastRequiredNumber !== null && lastRequiredNumber < targetSceneCount) {
    const nextBlockEntryId = `scene_${lastRequiredNumber + 1}`;
    const opensNextBlock = combinedScenes.some((scene) =>
      scene.choices.some((choice) => choice.targetSceneId === nextBlockEntryId)
    );
    if (!opensNextBlock) {
      problems.push(
        `Chunk must open the next block by linking at least one choice to ${nextBlockEntryId}.`
      );
    }
  }

  return { scenes, problems: [...new Set(problems)].slice(0, 40) };
}

export function validateStoryBlueprint(
  rawBlueprint: unknown,
  targetSceneCount: number | null
): { blueprint: StoryBlueprint | null; problems: string[] } {
  if (!isRecord(rawBlueprint) || !Array.isArray(rawBlueprint.scenes)) {
    return { blueprint: null, problems: ["Blueprint must be a JSON object with a scenes array."] };
  }

  const problems: string[] = [];
  const scenes = rawBlueprint.scenes.filter(isRecord).map((scene) => normalizeBlueprintScene(scene));
  const blueprint: StoryBlueprint = {
    title: readText(rawBlueprint.title),
    premise: readText(rawBlueprint.premise),
    tone: readText(rawBlueprint.tone),
    scenes
  };

  if (!blueprint.title) problems.push("Blueprint title is missing.");
  if (!blueprint.premise) problems.push("Blueprint premise is missing.");
  if (targetSceneCount !== null && scenes.length !== targetSceneCount) {
    problems.push(`Blueprint has ${scenes.length} scenes; exactly ${targetSceneCount} are required.`);
  }
  if (scenes.length === 0) {
    problems.push("Blueprint has no scenes.");
    return { blueprint, problems };
  }

  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const sceneIndexById = new Map(scenes.map((scene, index) => [scene.id, index]));
  if (sceneIds.size !== scenes.length) problems.push("Blueprint contains duplicate scene ids.");
  scenes.forEach((scene, index) => {
    const expectedId = `scene_${index + 1}`;
    if (scene.id !== expectedId) {
      problems.push(`Scene at position ${index + 1} must use id ${expectedId}, not ${scene.id || "(empty)"}.`);
    }
    if (!scene.title || !scene.purpose || !scene.arrivalReason || !scene.beat || !scene.text) {
      problems.push(`${scene.id || expectedId}: title, purpose, arrivalReason, beat, and text are required.`);
    }
    if (scene.sceneType === "ending" && scene.choices.length > 0) {
      problems.push(`${scene.id}: ending scene must have no choices.`);
    }
    if (scene.sceneType === "normal" && scene.choices.length === 0) {
      problems.push(`${scene.id}: normal scene must have at least one choice.`);
    }
    const targetIds = new Set(scene.choices.map((choice) => choice.targetSceneId));
    if (scene.choices.length > 1 && targetIds.size !== scene.choices.length) {
      problems.push(`${scene.id}: every choice must have a different immediate target.`);
    }
    for (const choice of scene.choices) {
      if (!choice.text || !choice.immediateConsequence) {
        problems.push(`${scene.id}: every choice needs text and an immediateConsequence.`);
      }
      if (!sceneIds.has(choice.targetSceneId)) {
        problems.push(`${scene.id}: choice points to missing ${choice.targetSceneId || "(empty)"}.`);
      }
      if (choice.targetSceneId === scene.id) {
        problems.push(`${scene.id}: choice creates a self-loop.`);
      }
      const targetIndex = sceneIndexById.get(choice.targetSceneId);
      if (targetIndex !== undefined && targetIndex <= index) {
        problems.push(
          `${scene.id}: choice target ${choice.targetSceneId} goes backward. Blueprint choices must move forward to prevent filler loops.`
        );
      }
    }
  });

  const endingIds = new Set(
    scenes.filter((scene) => scene.sceneType === "ending").map((scene) => scene.id)
  );
  if (endingIds.size === 0) problems.push("Blueprint has no ending scenes.");

  const reachableIds = walkForward(scenes, scenes[0]?.id ?? "");
  for (const scene of scenes) {
    if (!reachableIds.has(scene.id)) problems.push(`${scene.id}: scene is unreachable from scene_1.`);
  }

  const canReachEnding = new Set(endingIds);
  let changed = true;
  while (changed) {
    changed = false;
    for (const scene of scenes) {
      if (
        !canReachEnding.has(scene.id) &&
        scene.choices.some((choice) => canReachEnding.has(choice.targetSceneId))
      ) {
        canReachEnding.add(scene.id);
        changed = true;
      }
    }
  }
  for (const scene of scenes) {
    if (reachableIds.has(scene.id) && !canReachEnding.has(scene.id)) {
      problems.push(`${scene.id}: no route from this scene reaches an ending.`);
    }
  }

  if (scenes.length > 3 && !scenes.some((scene) => scene.choices.length > 1)) {
    problems.push("Blueprint has no branching scene.");
  }
  return { blueprint, problems: [...new Set(problems)].slice(0, 50) };
}

function walkForward(scenes: StoryBlueprintScene[], startSceneId: string): Set<string> {
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));
  const visited = new Set<string>();
  const queue = [startSceneId];
  while (queue.length > 0) {
    const sceneId = queue.shift();
    if (!sceneId || visited.has(sceneId)) continue;
    visited.add(sceneId);
    for (const choice of sceneMap.get(sceneId)?.choices ?? []) queue.push(choice.targetSceneId);
  }
  return visited;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBlueprintScene(scene: Record<string, unknown>): StoryBlueprintScene {
  return {
    id: readText(scene.id),
    title: readText(scene.title),
    purpose: readText(scene.purpose),
    arrivalReason: readText(scene.arrivalReason),
    beat: readText(scene.beat),
    text: readText(scene.text),
    sceneType: scene.sceneType === "ending" ? "ending" : "normal",
    choices: Array.isArray(scene.choices)
      ? scene.choices.filter(isRecord).map((choice) => ({
          text: readText(choice.text),
          targetSceneId: readText(choice.targetSceneId),
          immediateConsequence: readText(choice.immediateConsequence)
        }))
      : []
  };
}

function normalizeSemanticScene(scene: Record<string, unknown>): SemanticStoryScene {
  return {
    key: readText(scene.key),
    branchId: readText(scene.branchId),
    characters: Array.isArray(scene.characters)
      ? scene.characters.map(readText).filter(Boolean)
      : [],
    location: readText(scene.location),
    title: readText(scene.title),
    purpose: readText(scene.purpose),
    arrivalReason: readText(scene.arrivalReason),
    beat: readText(scene.beat),
    text: readText(scene.text),
    sceneType: scene.sceneType === "ending" ? "ending" : "normal",
    choices: Array.isArray(scene.choices)
      ? scene.choices.filter(isRecord).map((choice) => ({
          text: readText(choice.text),
          targetKey: readText(choice.targetKey),
          immediateConsequence: readText(choice.immediateConsequence)
        }))
      : []
  };
}

function validateSemanticSceneFields(
  scene: SemanticStoryScene,
  problems: string[]
) {
  const label = scene.key || "(missing key)";
  if (!/^[a-z][a-z0-9_]{2,79}$/.test(scene.key)) {
    problems.push(`${label}: key must be a short lowercase semantic name, not a scene number.`);
  }
  if (/^scene_?\d+$/i.test(scene.key)) {
    problems.push(`${label}: use a meaning-based key instead of a technical scene number.`);
  }
  if (
    !scene.branchId ||
    !scene.location ||
    !scene.title ||
    !scene.purpose ||
    !scene.arrivalReason ||
    !scene.beat ||
    !scene.text
  ) {
    problems.push(`${label}: branchId, location, title, purpose, arrivalReason, beat, and text are required.`);
  }
  if (scene.characters.length === 0) {
    problems.push(`${label}: characters must name everyone present in the scene.`);
  }
  if (scene.sceneType === "ending" && scene.choices.length > 0) {
    problems.push(`${label}: ending scene must have no choices.`);
  }
  if (scene.sceneType === "normal" && scene.choices.length === 0) {
    problems.push(`${label}: normal scene must have at least one choice.`);
  }
  for (const choice of scene.choices) {
    if (!choice.text || !choice.targetKey || !choice.immediateConsequence) {
      problems.push(`${label}: every choice needs text, targetKey, and immediateConsequence.`);
    }
    if (choice.text.length > 180) {
      problems.push(`${label}: choice text is narration instead of a concise player action.`);
    }
  }
}

function walkSemantic(
  scenes: SemanticStoryScene[],
  startKey: string
): Set<string> {
  const sceneMap = new Map(scenes.map((scene) => [scene.key, scene]));
  const visited = new Set<string>();
  const queue = [startKey];
  while (queue.length > 0) {
    const key = queue.shift();
    if (!key || visited.has(key)) continue;
    visited.add(key);
    for (const choice of sceneMap.get(key)?.choices ?? []) queue.push(choice.targetKey);
  }
  return visited;
}

function readSceneNumber(sceneId: string): number | null {
  const match = sceneId.match(/^scene_(\d+)$/);
  return match ? Number(match[1]) : null;
}
