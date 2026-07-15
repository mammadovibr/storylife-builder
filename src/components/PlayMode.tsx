import { useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import {
  applyChoiceEffects,
  choiceConditionsPass,
  createRuntimeState,
  resolveChoiceTarget,
  Choice,
  SceneId,
  StoryProject
} from "../domain/project";
import { TransitionedScenePhone, toMediaSrc } from "./ScenePhone";

interface PlayModeProps {
  project: StoryProject;
  currentSceneId: SceneId;
  onExit: () => void;
}

export function PlayMode({
  project,
  currentSceneId,
  onExit
}: PlayModeProps) {
  const [activeSceneId, setActiveSceneId] = useState(currentSceneId);
  const [runtimeState, setRuntimeState] = useState(() =>
    createRuntimeState(project)
  );
  const backgroundAudioRef = useRef<HTMLAudioElement | null>(null);
  const sceneAudioRef = useRef<HTMLAudioElement | null>(null);
  const backgroundFadeTimerRef = useRef<number | null>(null);
  const sceneFadeTimerRef = useRef<number | null>(null);
  const isBackgroundRestartingRef = useRef(false);

  const currentScene =
    project.scenes.find((scene) => scene.id === activeSceneId) ??
    project.scenes.find((scene) => scene.id === project.startSceneId);

  useEffect(() => {
    const backgroundAudio = backgroundAudioRef.current;
    if (!backgroundAudio) {
      return;
    }

    if (project.audio.backgroundMusicPath.trim() === "") {
      backgroundAudio.pause();
      return;
    }

    backgroundAudio.volume = 0;
    void backgroundAudio.play().catch(() => {
      // Browsers can block autoplay until the author clicks in the preview.
    });
    fadeAudio(
      backgroundAudio,
      project.audio.musicVolume,
      project.audio.musicFadeInSeconds,
      backgroundFadeTimerRef
    );
  }, [project.audio.backgroundMusicPath, project.audio.musicVolume]);

  useEffect(() => {
    const backgroundAudio = backgroundAudioRef.current;
    if (!backgroundAudio) {
      return;
    }

    const handleTimeUpdate = () => {
      const fadeOutSeconds = Math.max(project.audio.musicFadeOutSeconds, 0.35);
      if (
        !Number.isFinite(backgroundAudio.duration) ||
        backgroundAudio.duration <= fadeOutSeconds + 0.15 ||
        isBackgroundRestartingRef.current
      ) {
        return;
      }

      if (backgroundAudio.duration - backgroundAudio.currentTime <= fadeOutSeconds) {
        isBackgroundRestartingRef.current = true;
        fadeAudio(backgroundAudio, 0, fadeOutSeconds, backgroundFadeTimerRef, () => {
          backgroundAudio.currentTime = 0;
          void backgroundAudio.play().catch(() => {});
          fadeAudio(
            backgroundAudio,
            project.audio.musicVolume,
            project.audio.musicFadeInSeconds,
            backgroundFadeTimerRef,
            () => {
              isBackgroundRestartingRef.current = false;
            }
          );
        });
      }
    };

    backgroundAudio.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      backgroundAudio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [
    project.audio.musicFadeInSeconds,
    project.audio.musicFadeOutSeconds,
    project.audio.musicVolume,
    project.audio.backgroundMusicPath
  ]);

  useEffect(() => {
    if (!currentScene) {
      return;
    }

    const sceneAudio = sceneAudioRef.current;
    const backgroundAudio = backgroundAudioRef.current;
    if (!sceneAudio) {
      return;
    }

    sceneAudio.pause();
    sceneAudio.currentTime = 0;
    if (currentScene.soundPath.trim() === "") {
      return;
    }

    sceneAudio.volume = 0;
    const shouldFadeMusic =
      project.audio.fadeMusicOnSceneSound && currentScene.fadeMusicOnSceneSound;

    if (backgroundAudio && shouldFadeMusic) {
      fadeAudio(
        backgroundAudio,
        project.audio.sceneSoundDuckVolume,
        project.audio.musicFadeOutSeconds,
        backgroundFadeTimerRef
      );
    }

    const restoreVolume = () => {
      if (backgroundAudio) {
        fadeAudio(
          backgroundAudio,
          project.audio.musicVolume,
          project.audio.musicFadeInSeconds,
          backgroundFadeTimerRef
        );
      }
    };

    sceneAudio.addEventListener("ended", restoreVolume, { once: true });
    void sceneAudio.play().catch(restoreVolume);
    fadeAudio(
      sceneAudio,
      currentScene.soundVolume,
      currentScene.soundFadeInSeconds,
      sceneFadeTimerRef
    );

    return () => {
      sceneAudio.removeEventListener("ended", restoreVolume);
      restoreVolume();
    };
  }, [
    currentScene?.id,
    currentScene?.soundPath,
    currentScene?.fadeMusicOnSceneSound,
    project.audio
  ]);

  if (!currentScene) {
    return (
      <main className="play-mode">
        <button type="button" onClick={onExit}>
          Exit Play Mode
        </button>
        <p>Start scene is missing.</p>
      </main>
    );
  }

  const activeScene = currentScene;
  const visibleChoices = activeScene.choices
    .map((choice) => ({
      choice,
      isAvailable: choiceConditionsPass(choice, runtimeState)
    }))
    .filter(
      ({ choice, isAvailable }) =>
        isAvailable || choice.conditionFailBehavior !== "hidden"
    );
  const effectiveLayout =
    activeScene.layoutType === "noImage" || activeScene.imagePath.trim() === ""
      ? "noImage"
      : activeScene.layoutType;

  return (
    <main className="play-mode">
      <div className="play-topbar">
        <span>{project.projectName}</span>
        <button type="button" onClick={onExit}>
          Exit Play Mode
        </button>
      </div>
      <div className="play-layout">
        {project.audio.backgroundMusicPath.trim() !== "" && (
          <audio
            ref={backgroundAudioRef}
            src={toMediaSrc(project.audio.backgroundMusicPath)}
          />
        )}
        {activeScene.soundPath.trim() !== "" && (
          <audio ref={sceneAudioRef} src={toMediaSrc(activeScene.soundPath)} />
        )}
        <div className="phone-preview">
          <TransitionedScenePhone
            project={project}
            scene={activeScene}
            visibleChoices={visibleChoices}
            onChoice={handleChoice}
          />
        </div>
        <aside className="debug-panel">
          <h2>Debug State</h2>
          <h3>Parameters</h3>
          {project.parameters.length === 0 && (
            <p className="empty-state">No parameters.</p>
          )}
          {project.parameters.map((parameter) => (
            <div className="debug-row" key={parameter.id}>
              <span>{parameter.key}</span>
              <strong>{runtimeState.parameters[parameter.id] ?? 0}</strong>
            </div>
          ))}
          <h3>Flags</h3>
          {project.flags.length === 0 && (
            <p className="empty-state">No flags.</p>
          )}
          {project.flags.map((flag) => (
            <div className="debug-row" key={flag.id}>
              <span>{flag.key}</span>
              <strong>{String(runtimeState.flags[flag.id] ?? false)}</strong>
            </div>
          ))}
        </aside>
      </div>
    </main>
  );

  function handleChoice(choice: Choice) {
    const nextState = applyChoiceEffects(project, runtimeState, choice);
    setRuntimeState(nextState);
    setActiveSceneId(resolveChoiceTarget(choice, runtimeState));
  }
}

function fadeAudio(
  audio: HTMLAudioElement,
  targetVolume: number,
  durationSeconds: number,
  timerRef: MutableRefObject<number | null>,
  onComplete?: () => void
) {
  if (timerRef.current !== null) {
    window.clearInterval(timerRef.current);
  }

  const startVolume = audio.volume;
  const durationMs = Math.max(0, durationSeconds * 1000);
  if (durationMs === 0) {
    audio.volume = targetVolume;
    onComplete?.();
    return;
  }

  const startTime = performance.now();
  timerRef.current = window.setInterval(() => {
    const progress = Math.min((performance.now() - startTime) / durationMs, 1);
    audio.volume = startVolume + (targetVolume - startVolume) * progress;
    if (progress >= 1 && timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
      onComplete?.();
    }
  }, 40);
}
