const SCENE_WORD_PATTERN =
  "(?:\\u0441\\u0446\\u0435\\u043d[\\u0430-\\u044f\\u0451]*|\\u043d\\u043e\\u0434[\\u0430-\\u044f\\u0451]*|scenes?|nodes?)";

export function extractRequestedSceneCount(prompt: string): number | null {
  const latestInstruction = prompt
    .split(/\n\n(?=(?:PERSISTENT STORY MEMORY|RECENT STORY DISCUSSION)\b)/i)[0]
    .trim();
  const latestCounts = collectSceneCounts(latestInstruction);
  if (latestCounts.length > 0) {
    return latestCounts[0];
  }

  const markedInstructions = [...prompt.matchAll(/LATEST BUILD INSTRUCTION:\s*/gi)];
  for (const marker of markedInstructions.reverse()) {
    const markerEnd = (marker.index ?? 0) + marker[0].length;
    const instruction = prompt
      .slice(markerEnd)
      .split(/\n\n(?=(?:PERSISTENT STORY MEMORY|RECENT STORY DISCUSSION|IMPORTANT:)\b)/i)[0];
    const markedCounts = collectSceneCounts(instruction);
    if (markedCounts.length > 0) return markedCounts[0];
  }

  const allCounts = collectSceneCounts(prompt);
  return allCounts.length > 0 ? allCounts[0] : null;
}

function collectSceneCounts(value: string): number[] {
  const matches: Array<{ count: number; index: number }> = [];
  const rangeBeforeWord = new RegExp(
    `(\\d{1,4})\\s*(?:-|\\u2013|\\u2014|\\u0434\\u043e)\\s*(\\d{1,4})\\s*${SCENE_WORD_PATTERN}`,
    "giu"
  );
  const countBeforeWord = new RegExp(
    `(\\d{1,4})\\s*(?:-|\\u2013|\\u2014)?\\s*${SCENE_WORD_PATTERN}`,
    "giu"
  );
  const wordBeforeCount = new RegExp(
    `${SCENE_WORD_PATTERN}\\s*(?:count|total|number|\\u043a\\u043e\\u043b\\u0438\\u0447\\u0435\\u0441\\u0442\\u0432\\u043e)?\\s*(?::|=|-)?\\s*(\\d{1,4})`,
    "giu"
  );

  for (const match of value.toLowerCase().matchAll(rangeBeforeWord)) {
    matches.push({ count: Number(match[2]), index: match.index ?? 0 });
  }
  for (const match of value.toLowerCase().matchAll(countBeforeWord)) {
    matches.push({ count: Number(match[1]), index: match.index ?? 0 });
  }
  for (const match of value.toLowerCase().matchAll(wordBeforeCount)) {
    matches.push({ count: Number(match[1]), index: match.index ?? 0 });
  }

  return matches
    .filter(({ count }) => Number.isInteger(count) && count >= 1 && count <= 2000)
    .sort((left, right) => left.index - right.index)
    .map(({ count }) => count);
}
