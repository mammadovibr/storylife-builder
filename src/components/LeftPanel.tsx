import { useMemo, useState } from "react";
import { Scene, SceneId, StoryFlag } from "../domain/project";

interface LeftPanelProps {
  scenes: Scene[];
  flags: StoryFlag[];
  selectedSceneId: SceneId | null;
  startSceneId: SceneId;
  onAddScene: () => void;
  onSelectScene: (sceneId: SceneId) => void;
  onSetStartScene: (sceneId: SceneId) => void;
}

export function LeftPanel({
  scenes,
  flags,
  selectedSceneId,
  startSceneId,
  onAddScene,
  onSelectScene,
  onSetStartScene
}: LeftPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAnalyzer, setShowAnalyzer] = useState(false);
  const searchResults = useMemo(
    () => searchProject(searchQuery, scenes, flags),
    [searchQuery, scenes, flags]
  );
  const analyzerResults = useMemo(
    () => analyzeProject(scenes, flags, startSceneId),
    [scenes, flags, startSceneId]
  );
  const stats = useMemo(
    () => ({
      scenes: scenes.length,
      choices: scenes.reduce((total, scene) => total + scene.choices.length, 0),
      flags: flags.length,
      endings: scenes.filter((scene) => scene.sceneType === "ending").length
    }),
    [scenes, flags]
  );

  return (
    <aside className="left-panel">
      <div className="project-stats">
        <span>Scenes {stats.scenes}</span>
        <span>Choices {stats.choices}</span>
        <span>Flags {stats.flags}</span>
        <span>Endings {stats.endings}</span>
      </div>
      <label className="field-label">
        Search project
        <input
          value={searchQuery}
          placeholder="Title, text, choice, flag, image, target..."
          onChange={(event) => setSearchQuery(event.target.value)}
        />
      </label>
      {searchQuery.trim() !== "" && (
        <div className="search-results">
          {searchResults.length === 0 && (
            <p className="empty-state">No results.</p>
          )}
          {searchResults.map((result) => (
            <button
              type="button"
              key={`${result.sceneId}-${result.label}`}
              onClick={() => result.sceneId && onSelectScene(result.sceneId)}
            >
              <strong>{result.label}</strong>
              <span>{result.detail}</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="full-width-button"
        onClick={() => setShowAnalyzer((current) => !current)}
      >
        Analyze Story
      </button>
      {showAnalyzer && (
        <div className="analyzer-results">
          {analyzerResults.map((result) => (
            <button
              type="button"
              key={`${result.level}-${result.message}-${result.sceneId ?? ""}`}
              className={`analyzer-result analyzer-${result.level}`}
              onClick={() => result.sceneId && onSelectScene(result.sceneId)}
            >
              <strong>{result.level}</strong>
              <span>{result.message}</span>
            </button>
          ))}
        </div>
      )}
      <div className="panel-heading">
        <h2>Scenes</h2>
        <button type="button" onClick={onAddScene}>
          Add Scene
        </button>
      </div>
      <div className="scene-list">
        {scenes.map((scene) => (
          <button
            type="button"
            key={scene.id}
            className={`scene-list-item ${
              scene.id === selectedSceneId ? "selected" : ""
            }`}
            onClick={() => onSelectScene(scene.id)}
          >
            <span>{scene.title || "Untitled scene"}</span>
            {scene.id === startSceneId && <small>Start</small>}
          </button>
        ))}
      </div>
      <label className="field-label">
        Start scene
        <select
          value={startSceneId}
          onChange={(event) => onSetStartScene(event.target.value)}
        >
          {scenes.map((scene) => (
            <option key={scene.id} value={scene.id}>
              {scene.title || scene.id}
            </option>
          ))}
        </select>
      </label>
    </aside>
  );
}

interface SearchResult {
  label: string;
  detail: string;
  sceneId?: SceneId;
}

interface AnalyzerResult {
  level: "error" | "warning" | "info";
  message: string;
  sceneId?: SceneId;
}

function searchProject(
  query: string,
  scenes: Scene[],
  flags: StoryFlag[]
): SearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  const results: SearchResult[] = [];
  for (const scene of scenes) {
    const sceneText = [
      scene.title,
      scene.text,
      scene.imagePath,
      scene.id,
      ...scene.choices.flatMap((choice) => [
        choice.text,
        choice.targetNodeId,
        ...choice.outcomes.map((outcome) => outcome.targetSceneId),
        ...choice.conditionalTargets.map((target) => target.targetSceneId)
      ])
    ]
      .join(" ")
      .toLowerCase();

    if (sceneText.includes(normalizedQuery)) {
      results.push({
        sceneId: scene.id,
        label: scene.title || scene.id,
        detail: scene.id
      });
    }
  }

  for (const flag of flags) {
    if (`${flag.id} ${flag.key}`.toLowerCase().includes(normalizedQuery)) {
      results.push({
        label: flag.key || flag.id,
        detail: "Flag"
      });
    }
  }

  return results.slice(0, 30);
}

function analyzeProject(
  scenes: Scene[],
  flags: StoryFlag[],
  startSceneId: SceneId
): AnalyzerResult[] {
  const results: AnalyzerResult[] = [];
  const sceneIds = new Set(scenes.map((scene) => scene.id));
  const duplicateIds = scenes
    .map((scene) => scene.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);

  if (!sceneIds.has(startSceneId)) {
    results.push({ level: "error", message: "Start scene is missing." });
  }
  for (const id of duplicateIds) {
    results.push({ level: "error", message: `Duplicate scene id: ${id}` });
  }

  for (const scene of scenes) {
    for (const choice of scene.choices) {
      if (!sceneIds.has(choice.targetNodeId)) {
        results.push({
          level: "error",
          sceneId: scene.id,
          message: `Choice target is missing: ${choice.targetNodeId}`
        });
      }
      for (const outcome of choice.outcomes) {
        if (!sceneIds.has(outcome.targetSceneId)) {
          results.push({
            level: "error",
            sceneId: scene.id,
            message: `Outcome target is missing: ${outcome.targetSceneId}`
          });
        }
      }
      for (const target of choice.conditionalTargets) {
        if (!sceneIds.has(target.targetSceneId)) {
          results.push({
            level: "error",
            sceneId: scene.id,
            message: `Conditional target is missing: ${target.targetSceneId}`
          });
        }
      }
    }
    if (scene.choices.length === 0 && scene.sceneType !== "ending") {
      results.push({
        level: "warning",
        sceneId: scene.id,
        message: `${scene.title || scene.id} has no choices and is not ending.`
      });
    }
  }

  const reachableSceneIds = collectReachableSceneIds(scenes, startSceneId);
  for (const scene of scenes) {
    if (!reachableSceneIds.has(scene.id)) {
      results.push({
        level: "warning",
        sceneId: scene.id,
        message: `${scene.title || scene.id} is unreachable from start.`
      });
    }
  }

  const flagUsage = flags.map((flag) => ({
    flag,
    setCount: countFlagSets(scenes, flag.id),
    checkCount: countFlagChecks(scenes, flag.id)
  }));
  for (const item of flagUsage) {
    if (item.setCount + item.checkCount === 0) {
      results.push({
        level: "warning",
        message: `Flag is unused: ${item.flag.key || item.flag.id}`
      });
    } else if (item.setCount === 0 && item.checkCount > 0) {
      results.push({
        level: "warning",
        message: `Flag is checked but never set: ${item.flag.key || item.flag.id}`
      });
    }
  }

  results.push({
    level: "info",
    message: `Ending scenes: ${
      scenes.filter((scene) => scene.sceneType === "ending").length
    }`
  });

  return results;
}

function collectReachableSceneIds(scenes: Scene[], startSceneId: SceneId): Set<SceneId> {
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));
  const reachableIds = new Set<SceneId>();
  const queue = [startSceneId];

  while (queue.length > 0) {
    const sceneId = queue.shift();
    if (!sceneId || reachableIds.has(sceneId)) {
      continue;
    }
    reachableIds.add(sceneId);
    const scene = sceneMap.get(sceneId);
    if (!scene) {
      continue;
    }
    for (const choice of scene.choices) {
      queue.push(choice.targetNodeId);
      for (const outcome of choice.outcomes) {
        queue.push(outcome.targetSceneId);
      }
      for (const target of choice.conditionalTargets) {
        queue.push(target.targetSceneId);
      }
    }
  }

  return reachableIds;
}

function countFlagSets(scenes: Scene[], flagId: string): number {
  return scenes.reduce(
    (total, scene) =>
      total +
      scene.choices.reduce(
        (choiceTotal, choice) =>
          choiceTotal +
          choice.effects.filter(
            (effect) => effect.type === "flag" && effect.flagId === flagId
          ).length,
        0
      ),
    0
  );
}

function countFlagChecks(scenes: Scene[], flagId: string): number {
  return scenes.reduce(
    (total, scene) =>
      total +
      scene.choices.reduce(
        (choiceTotal, choice) =>
          choiceTotal +
          choice.conditions.filter(
            (condition) =>
              condition.type === "flag" && condition.flagId === flagId
          ).length +
          choice.conditionalTargets.reduce(
            (targetTotal, target) =>
              targetTotal +
              target.conditions.filter(
                (condition) =>
                  condition.type === "flag" && condition.flagId === flagId
              ).length,
            0
          ),
        0
      ),
    0
  );
}
