export interface StoryArchitectureFitResult {
  architecture: Record<string, unknown>;
  originalSceneCount: number;
  targetSceneCount: number;
  changed: boolean;
}

type ArchitectureContract = Record<string, unknown>;

export function fitStoryArchitectureToSceneCount(
  rawArchitecture: Record<string, unknown>,
  targetSceneCount: number
): StoryArchitectureFitResult {
  const safeTarget = Math.max(3, Math.floor(targetSceneCount));
  const rawPlan = Array.isArray(rawArchitecture.scenePlan)
    ? rawArchitecture.scenePlan.filter(isRecord).map((item) => ({ ...item }))
    : [];
  if (rawPlan.length === 0) {
    throw new Error("The story map contains no readable scene beats.");
  }
  const originalSceneCount = rawPlan.length;
  const endingCount = safeTarget >= 8 ? 2 : 1;
  const normalCount = safeTarget - endingCount;

  const normalContracts = rawPlan.filter((contract) => contract.sceneType !== "ending");
  const endingContracts = rawPlan.filter((contract) => contract.sceneType === "ending");
  const selectedNormals = normalContracts.slice(0, normalCount);
  const selectedEndings = endingContracts.slice(-endingCount);

  while (selectedNormals.length < normalCount) {
    selectedNormals.push(createFallbackContract("story_development", selectedNormals.length + 1));
  }
  while (selectedEndings.length < endingCount) {
    selectedEndings.push(createFallbackContract("story_ending", selectedEndings.length + 1));
  }

  const selected = [...selectedNormals, ...selectedEndings];
  const usedKeys = new Set<string>();
  const normalized = selected.map((contract, index) => {
    const fallbackPrefix = index < normalCount ? "story_beat" : "story_ending";
    const key = createUniqueKey(contract.key, fallbackPrefix, index + 1, usedKeys);
    usedKeys.add(key);
    return {
      ...contract,
      key,
      branchId: "shared",
      sceneType: index < normalCount ? "normal" : "ending",
      structuralRole: index === 0
        ? "opening-decision"
        : index < normalCount
          ? "developed-route-consequence"
          : "main-ending-payoff",
      outgoingTargets: []
    } satisfies ArchitectureContract;
  });

  const normalLayers = createNormalLayers(normalized.slice(0, normalCount));
  const endingKeys = normalized.slice(normalCount).map((contract) => String(contract.key));
  for (let layerIndex = 0; layerIndex < normalLayers.length; layerIndex += 1) {
    const currentLayer = normalLayers[layerIndex];
    const isFinalDecisionLayer = layerIndex === normalLayers.length - 1;
    const nextKeys = isFinalDecisionLayer
      ? endingKeys
      : normalLayers[layerIndex + 1].map((contract) => String(contract.key));
    currentLayer.forEach((contract, contractIndex) => {
      contract.outgoingTargets = isFinalDecisionLayer
        ? chooseResolutionTargets(
            currentLayer,
            contractIndex,
            endingKeys
          )
        : chooseDistributedTargets(nextKeys, contractIndex, currentLayer.length);
      contract.structuralRole = isFinalDecisionLayer
        ? "resolution-path"
        : layerIndex === 0
          ? "opening-decision"
          : layerIndex === 1
            ? "immediate-route-consequence"
            : "developed-route-consequence";
    });
  }

  const incomingSources = new Map<string, string[]>();
  for (const contract of normalized) {
    for (const targetKey of readStringArray(contract.outgoingTargets)) {
      incomingSources.set(targetKey, [
        ...(incomingSources.get(targetKey) ?? []),
        String(contract.key)
      ]);
    }
  }
  for (const contract of normalized) {
    contract.incomingSources = incomingSources.get(String(contract.key)) ?? [];
    contract.causalConstraint = contract.sceneType === "ending"
      ? "Pay off the concrete route and action that reaches this ending; do not invent a last-second moral reversal."
      : "This scene must visibly begin with the consequence promised by its incoming choice. Its outgoing buttons must truthfully describe actions that cause their exact targets.";
  }

  return {
    architecture: {
      ...rawArchitecture,
      scenePlan: normalized,
      continuityRules: [
        ...readStringArray(rawArchitecture.continuityRules),
        "The graph shape is binding: every choice must produce its own immediate consequence scene.",
        "Routes may converge only after their different consequences have been shown.",
        "Earlier route decisions must remain visible in later scene setup; do not postpone all meaningful consequence to the last choice.",
        "An innocent or neutral button may never secretly cause cheating, betrayal, punishment, or another moral reversal.",
        "The final two contracts are the only main endings and have no outgoing choices."
      ]
    },
    originalSceneCount,
    targetSceneCount: safeTarget,
    changed: originalSceneCount !== safeTarget
  };
}

function createNormalLayers(contracts: ArchitectureContract[]): ArchitectureContract[][] {
  if (contracts.length === 0) return [];
  const layers: ArchitectureContract[][] = [[contracts[0]]];
  let cursor = 1;
  while (cursor < contracts.length) {
    const previousWidth = layers[layers.length - 1].length;
    const remaining = contracts.length - cursor;
    let width = Math.min(4, previousWidth * 2, remaining);
    if (remaining - width === 1 && width > 2) width -= 1;
    if (width < 2 && remaining > 1) width = 2;
    layers.push(contracts.slice(cursor, cursor + width));
    cursor += width;
  }
  return layers;
}

function chooseDistributedTargets(
  nextKeys: string[],
  sourceIndex: number,
  sourceCount: number
): string[] {
  if (nextKeys.length <= 1) return nextKeys.slice();
  const start = nextKeys.length >= sourceCount * 2
    ? sourceIndex * 2
    : Math.floor((sourceIndex * nextKeys.length) / Math.max(1, sourceCount));
  const first = nextKeys[start % nextKeys.length];
  const second = nextKeys[(start + 1) % nextKeys.length];
  return first === second ? [first] : [first, second];
}

function chooseResolutionTargets(
  resolutionScenes: ArchitectureContract[],
  sourceIndex: number,
  endingKeys: string[]
): string[] {
  if (endingKeys.length <= 1) return endingKeys.slice();
  const currentKey = String(resolutionScenes[sourceIndex]?.key ?? "");
  const laterResolutionKey = String(resolutionScenes[sourceIndex + 1]?.key ?? "");

  if (laterResolutionKey) {
    const endingKey = endingKeys[sourceIndex % endingKeys.length];
    return [endingKey, laterResolutionKey].filter((key) => key && key !== currentKey);
  }

  return endingKeys.slice(0, 2);
}

function createFallbackContract(prefix: string, number: number): ArchitectureContract {
  return {
    key: `${prefix}_${number}`,
    branchId: "shared",
    purpose: prefix === "story_ending"
      ? "Resolve the central conflict with a distinct final outcome."
      : "Develop an unresolved choice consequence and advance the central conflict.",
    allowedCharacters: [],
    location: "Continue from the previous consequence",
    sceneType: prefix === "story_ending" ? "ending" : "normal",
    outgoingTargets: []
  };
}

function createUniqueKey(
  rawKey: unknown,
  fallbackPrefix: string,
  number: number,
  usedKeys: Set<string>
): string {
  const candidate = typeof rawKey === "string" ? rawKey.trim() : "";
  const validCandidate = /^[a-z][a-z0-9_]{2,79}$/.test(candidate) &&
    !/^scene_?\d+$/i.test(candidate)
    ? candidate
    : `${fallbackPrefix}_${number}`;
  if (!usedKeys.has(validCandidate)) return validCandidate;
  let suffix = 2;
  while (usedKeys.has(`${validCandidate}_${suffix}`)) suffix += 1;
  return `${validCandidate}_${suffix}`;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
