import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import {
  applyChoiceEffects,
  choiceConditionsPass,
  createRuntimeState,
  migrateProject,
  resolveChoiceTarget,
  Choice,
  RuntimeState,
  SceneId,
  StoryProject
} from "./domain/project";
import { TransitionedScenePhone, toMediaSrc } from "./components/ScenePhone";
import "./styles/app.css";
import "./styles/player.css";

const STORY_PATH = "assets/data/story.json";

function ExportedGame() {
  const [project, setProject] = useState<StoryProject | null>(null);
  const [runtimeState, setRuntimeState] = useState<RuntimeState | null>(null);
  const [currentSceneId, setCurrentSceneId] = useState<SceneId | null>(null);
  const [error, setError] = useState("");
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const sceneAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch(STORY_PATH)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Could not load ${STORY_PATH}`);
        }
        return response.json();
      })
      .then((rawProject) => {
        const loadedProject = migrateProject(rawProject);
        setProject(loadedProject);
        setRuntimeState(createRuntimeState(loadedProject));
        setCurrentSceneId(loadedProject.startSceneId);
        document.title = loadedProject.projectName || "StoryLife Game";
      })
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Could not load game.");
      });
  }, []);

  const currentScene = useMemo(() => {
    if (!project || !currentSceneId) {
      return null;
    }
    return (
      project.scenes.find((scene) => scene.id === currentSceneId) ??
      project.scenes.find((scene) => scene.id === project.startSceneId) ??
      null
    );
  }, [currentSceneId, project]);

  useEffect(() => {
    const backgroundAudio = backgroundAudioRef.current;
    if (!backgroundAudio || !project?.audio.backgroundMusicPath.trim()) {
      return;
    }

    backgroundAudio.volume = project.audio.musicVolume;
    backgroundAudio.loop = true;
    const play = () => void backgroundAudio.play().catch(() => {});
    play();
    document.addEventListener("click", play, { once: true });
    return () => document.removeEventListener("click", play);
  }, [project]);

  useEffect(() => {
    const sceneAudio = sceneAudioRef.current;
    if (!sceneAudio || !currentScene?.soundPath.trim()) {
      return;
    }

    sceneAudio.pause();
    sceneAudio.currentTime = 0;
    sceneAudio.volume = currentScene.soundVolume;
    void sceneAudio.play().catch(() => {});
  }, [currentScene?.id, currentScene?.soundPath, currentScene?.soundVolume]);

  if (error) {
    return <main className="export-error">{error}</main>;
  }

  if (!project || !runtimeState || !currentScene) {
    return <main className="export-error">Loading...</main>;
  }

  const visibleChoices = currentScene.choices
    .map((choice) => ({
      choice,
      isAvailable: choiceConditionsPass(choice, runtimeState)
    }))
    .filter(
      ({ choice, isAvailable }) =>
        isAvailable || choice.conditionFailBehavior !== "hidden"
    );

  function handleChoice(choice: Choice) {
    if (!project || !runtimeState) {
      return;
    }

    setRuntimeState(applyChoiceEffects(project, runtimeState, choice));
    setCurrentSceneId(resolveChoiceTarget(choice, runtimeState));
  }

  return (
    <main className="export-player-shell">
      {project.audio.backgroundMusicPath.trim() !== "" && (
        <audio
          ref={backgroundAudioRef}
          src={toMediaSrc(project.audio.backgroundMusicPath)}
        />
      )}
      {currentScene.soundPath.trim() !== "" && (
        <audio ref={sceneAudioRef} src={toMediaSrc(currentScene.soundPath)} />
      )}
      <div className="export-game-viewport">
        <TransitionedScenePhone
          project={project}
          scene={currentScene}
          visibleChoices={visibleChoices}
          onChoice={handleChoice}
          displayMode="export"
        />
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ExportedGame />
  </React.StrictMode>
);
