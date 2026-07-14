import { useRef, useState } from "react";
import {
  ProjectAudioSettings,
  ProjectTheme,
  SCENE_TRANSITION_OPTIONS,
  SceneTransition
} from "../domain/project";

interface ProjectSettingsModalProps {
  audio: ProjectAudioSettings;
  theme: ProjectTheme;
  onUpdateAudio: (patch: Partial<ProjectAudioSettings>) => void;
  onUpdateTheme: (patch: Partial<ProjectTheme>) => void;
  onClose: () => void;
}

export function ProjectSettingsModal({
  audio,
  theme,
  onUpdateAudio,
  onUpdateTheme,
  onClose
}: ProjectSettingsModalProps) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="project-settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-settings-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <h2 id="project-settings-title">Project Settings</h2>
            <p>Global game look and audio.</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="project-settings-content">
          <ProjectThemePreview theme={theme} />
          <div className="project-settings-controls">
            <ProjectThemeSettings theme={theme} onUpdateTheme={onUpdateTheme} />
            <ProjectAudioSettingsPanel audio={audio} onUpdateAudio={onUpdateAudio} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ProjectThemePreview({ theme }: { theme: ProjectTheme }) {
  return (
    <div className="project-settings-phone">
      <article
        className="project-settings-phone-screen"
        style={{
          background: theme.backgroundColor,
          color: theme.textColor
        }}
      >
        <div className="scene-image-frame project-settings-image-frame">
          <div className="project-settings-image-placeholder" />
        </div>
        <section className="play-content project-settings-copy-preview">
          <h1>Scene title</h1>
          <p>
            This preview shows the global project colors before scene-specific
            styling is applied.
          </p>
        </section>
        <div className="play-choices project-settings-choice-preview">
          <button type="button">Choice button</button>
          <button type="button">Another choice</button>
        </div>
      </article>
    </div>
  );
}

interface ProjectThemeSettingsProps {
  theme: ProjectTheme;
  onUpdateTheme: (patch: Partial<ProjectTheme>) => void;
}

function ProjectThemeSettings({
  theme,
  onUpdateTheme
}: ProjectThemeSettingsProps) {
  return (
    <section className="settings-section">
      <h3>Project Colors</h3>
      <div className="color-field-grid">
        <label className="field-label">
          Background
          <input
            type="color"
            value={theme.backgroundColor}
            onChange={(event) =>
              onUpdateTheme({ backgroundColor: event.target.value })
            }
          />
        </label>
        <label className="field-label">
          Text
          <input
            type="color"
            value={theme.textColor}
            onChange={(event) => onUpdateTheme({ textColor: event.target.value })}
          />
        </label>
      </div>
      <label className="field-label">
        Default scene transition
        <select
          value={theme.sceneTransition}
          onChange={(event) =>
            onUpdateTheme({ sceneTransition: event.target.value as SceneTransition })
          }
        >
          {SCENE_TRANSITION_OPTIONS.map((transition) => (
            <option key={transition.value} value={transition.value}>
              {transition.label}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}

interface ProjectAudioSettingsPanelProps {
  audio: ProjectAudioSettings;
  onUpdateAudio: (patch: Partial<ProjectAudioSettings>) => void;
}

function ProjectAudioSettingsPanel({
  audio,
  onUpdateAudio
}: ProjectAudioSettingsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const hasMusic = audio.backgroundMusicPath.trim() !== "";

  async function selectMusic() {
    setMessage("");

    if (!window.storyLife?.selectAudio) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const result = await window.storyLife.selectAudio();
      if (!result.canceled) {
        onUpdateAudio({ backgroundMusicPath: result.filePath });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Audio picker failed.");
    }
  }

  return (
    <section className="settings-section">
      <h3>Project Audio</h3>
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        accept=".mp3,.wav,.ogg,.m4a,.webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) {
            return;
          }

          const reader = new FileReader();
          reader.addEventListener("load", () => {
            if (typeof reader.result === "string") {
              onUpdateAudio({ backgroundMusicPath: reader.result });
              setMessage("Music embedded into this project for web/iPad testing.");
            }
          });
          reader.readAsDataURL(file);
        }}
      />
      <label className="field-label">
        Background music
        <input
          value={audio.backgroundMusicPath}
          placeholder="No music selected"
          onChange={(event) =>
            onUpdateAudio({ backgroundMusicPath: event.target.value })
          }
        />
      </label>
      <div className="image-actions">
        <button type="button" onClick={selectMusic}>
          {hasMusic ? "Change Music" : "Select Music"}
        </button>
        <button
          type="button"
          className="danger-button"
          disabled={!hasMusic}
          onClick={() => onUpdateAudio({ backgroundMusicPath: "" })}
        >
          Remove Music
        </button>
      </div>
      <label className="field-label">
        Music volume
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={audio.musicVolume}
          onChange={(event) =>
            onUpdateAudio({ musicVolume: readNumberInput(event.target.value) })
          }
        />
      </label>
      <div className="two-column-fields">
        <label className="field-label">
          Fade in
          <input
            type="range"
            min="0"
            max="15"
            step="0.1"
            value={audio.musicFadeInSeconds}
            onChange={(event) =>
              onUpdateAudio({
                musicFadeInSeconds: readNumberInput(event.target.value)
              })
            }
          />
        </label>
        <label className="field-label">
          Fade out
          <input
            type="range"
            min="0"
            max="15"
            step="0.1"
            value={audio.musicFadeOutSeconds}
            onChange={(event) =>
              onUpdateAudio({
                musicFadeOutSeconds: readNumberInput(event.target.value)
              })
            }
          />
        </label>
      </div>
      <label className="field-label">
        Music volume during scene sound
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={audio.sceneSoundDuckVolume}
          onChange={(event) =>
            onUpdateAudio({
              sceneSoundDuckVolume: readNumberInput(event.target.value)
            })
          }
        />
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={audio.fadeMusicOnSceneSound}
          onChange={(event) =>
            onUpdateAudio({ fadeMusicOnSceneSound: event.target.checked })
          }
        />
        Fade music when scene sounds play
      </label>
      {message && <p className="helper-text">{message}</p>}
    </section>
  );
}

function readNumberInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
