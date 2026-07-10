const SCENE_WORD_PATTERN =
  "(?:\\u0441\\u0446\\u0435\\u043d[\\u0430-\\u044f\\u0451]*|\\u043d\\u043e\\u0434[\\u0430-\\u044f\\u0451]*|scenes?|nodes?)";

export function extractRequestedSceneCount(prompt: string): number | null {
  const latestInstruction = prompt
    .split(/\n\n(?=(?:PERSISTENT STORY MEMORY|RECENT STORY DISCUSSION)\b)/i)[0]
    .trim();
  const latestCounts = collectSceneCounts(latestInstruction);
  if (latestCounts.length > 0) {
    return Math.max(...latestCounts);
  }

  const allCounts = collectSceneCounts(prompt);
  return allCounts.length > 0 ? Math.max(...allCounts) : null;
}

function collectSceneCounts(value: string): number[] {
  const counts: number[] = [];
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
    counts.push(Number(match[1]), Number(match[2]));
  }
  for (const match of value.toLowerCase().matchAll(countBeforeWord)) {
    counts.push(Number(match[1]));
  }
  for (const match of value.toLowerCase().matchAll(wordBeforeCount)) {
    counts.push(Number(match[1]));
  }

  return counts.filter((count) => Number.isInteger(count) && count >= 1 && count <= 2000);
}
