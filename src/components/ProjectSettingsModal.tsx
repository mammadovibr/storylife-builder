import { useRef, useState } from "react";
import {
  ProjectAudioSettings,
  ProjectTheme,
  SCENE_TRANSITION_OPTIONS,
  SceneStyle,
  SceneTransition,
  createDefaultSceneStyle
} from "../domain/project";
import { getChoiceButtonFrameStyle } from "../utils/choiceButtonFrames";
import {
  BOOK_COLOR_SCHEME_PRESETS,
  ORNATE_COLOR_SCHEME_PRESETS
} from "../utils/sceneColorSchemes";

interface ProjectSettingsModalProps {
  audio: ProjectAudioSettings;
  theme: ProjectTheme;
  sceneStyle?: SceneStyle;
  onUpdateAudio: (patch: Partial<ProjectAudioSettings>) => void;
  onUpdateTheme: (patch: Partial<ProjectTheme>) => void;
  onApplySceneStyle: (patch: Partial<SceneStyle>) => void;
  onClose: () => void;
}

export function ProjectSettingsModal({
  audio,
  theme,
  sceneStyle = createDefaultSceneStyle(),
  onUpdateAudio,
  onUpdateTheme,
  onApplySceneStyle,
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
          <ProjectThemePreview theme={theme} sceneStyle={sceneStyle} />
          <div className="project-settings-controls">
            <ProjectThemeSettings theme={theme} onUpdateTheme={onUpdateTheme} />
            <ProjectOrnateStyles
              sceneStyle={sceneStyle}
              onApplySceneStyle={onApplySceneStyle}
            />
            <ProjectAudioSettingsPanel audio={audio} onUpdateAudio={onUpdateAudio} />
          </div>
        </div>
      </section>
    </div>
  );
}

function ProjectThemePreview({
  theme,
  sceneStyle
}: {
  theme: ProjectTheme;
  sceneStyle: SceneStyle;
}) {
  const hasOrnament = sceneStyle.ornamentStyle !== "none";
  const choiceUsesFrame = sceneStyle.choicesFrameStyle !== "none";
  return (
    <div className="project-settings-phone">
      <article
        className={`project-settings-phone-screen scene-ornament-${sceneStyle.ornamentStyle}`}
        style={{
          background: sceneStyle.backgroundColor || theme.backgroundColor,
          color: sceneStyle.textColor || theme.textColor
        }}
      >
        <div className="scene-image-frame project-settings-image-frame">
          <div className="project-settings-image-placeholder" />
        </div>
        <section
          className={`project-settings-title-preview ${
            hasOrnament && sceneStyle.titleBorderEnabled ? "scene-ornament-panel" : ""
          }`}
          style={{
            background: sceneStyle.titlePanelColor || "rgba(255, 253, 248, 0.78)",
            color: sceneStyle.titleTextColor || sceneStyle.textColor || theme.textColor,
            borderColor: sceneStyle.titleBorderColor || undefined
          }}
        >
          <h1>Scene title</h1>
        </section>
        <section
          className={`play-content project-settings-copy-preview ${
            hasOrnament && sceneStyle.textBorderEnabled ? "scene-ornament-panel" : ""
          }`}
          style={{
            background: sceneStyle.textPanelColor || "rgba(255, 253, 248, 0.78)",
            color: sceneStyle.textColor || theme.textColor,
            borderColor: sceneStyle.textBorderColor || undefined
          }}
        >
          <p>
            This compact preview shows the style that will be applied to every scene.
          </p>
        </section>
        <div className="play-choices project-settings-choice-preview">
          <button
            type="button"
            className={
              hasOrnament && sceneStyle.choicesBorderEnabled && !choiceUsesFrame
                ? "scene-ornament-panel"
                : ""
            }
            style={{
              background: sceneStyle.choicesPanelColor || undefined,
              color: sceneStyle.choicesTextColor || undefined,
              borderColor: sceneStyle.choicesBorderColor || undefined,
              ...getChoiceButtonFrameStyle(
                sceneStyle.choicesFrameStyle,
                sceneStyle.choicesPanelOpacity
              )
            }}
          >
            Choice button
          </button>
          <button
            type="button"
            className={
              hasOrnament && sceneStyle.choicesBorderEnabled && !choiceUsesFrame
                ? "scene-ornament-panel"
                : ""
            }
            style={{
              background: sceneStyle.choicesPanelColor || undefined,
              color: sceneStyle.choicesTextColor || undefined,
              borderColor: sceneStyle.choicesBorderColor || undefined,
              ...getChoiceButtonFrameStyle(
                sceneStyle.choicesFrameStyle,
                sceneStyle.choicesPanelOpacity
              )
            }}
          >
            Another choice
          </button>
        </div>
      </article>
    </div>
  );
}

function ProjectOrnateStyles({
  sceneStyle,
  onApplySceneStyle
}: {
  sceneStyle: SceneStyle;
  onApplySceneStyle: (patch: Partial<SceneStyle>) => void;
}) {
  return (
    <section className="settings-section project-ornate-settings">
      <div className="settings-section-heading">
        <h3>Project Style Templates</h3>
        <button
          type="button"
          onClick={() => onApplySceneStyle({ ornamentStyle: "none" })}
        >
          No ornament
        </button>
      </div>
      <h4 className="project-style-group-title">Ornate</h4>
      <div className="project-ornate-grid">
        {ORNATE_COLOR_SCHEME_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.name}
            className={
              sceneStyle.ornamentStyle === preset.colors.ornamentStyle ? "active" : ""
            }
            aria-pressed={sceneStyle.ornamentStyle === preset.colors.ornamentStyle}
            onClick={() => onApplySceneStyle(preset.colors)}
          >
            <span
              className="project-ornate-swatch"
              style={{
                background: preset.colors.backgroundColor,
                borderColor: preset.colors.titleBorderColor
              }}
              aria-hidden="true"
            />
            <span>{preset.name}</span>
          </button>
        ))}
      </div>
      <h4 className="project-style-group-title">Book Styles</h4>
      <div className="project-ornate-grid">
        {BOOK_COLOR_SCHEME_PRESETS.map((preset) => (
          <button
            type="button"
            key={preset.name}
            className={
              sceneStyle.ornamentStyle === preset.colors.ornamentStyle ? "active" : ""
            }
            aria-pressed={sceneStyle.ornamentStyle === preset.colors.ornamentStyle}
            onClick={() => onApplySceneStyle(preset.colors)}
          >
            <span
              className={`project-ornate-swatch scene-book-swatch scene-ornament-${preset.colors.ornamentStyle}`}
              style={{
                background: preset.colors.backgroundColor,
                borderColor: preset.colors.titleBorderColor
              }}
              aria-hidden="true"
            />
            <span>{preset.name}</span>
          </button>
        ))}
      </div>
    </section>
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
      <label className="field-label project-transition-speed">
        <span>
          Transition speed <strong>{theme.sceneTransitionSpeed.toFixed(1)}x</strong>
        </span>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={theme.sceneTransitionSpeed}
          aria-label={`Transition speed ${theme.sceneTransitionSpeed.toFixed(1)}x`}
          onChange={(event) =>
            onUpdateTheme({ sceneTransitionSpeed: Number(event.target.value) })
          }
        />
        <small>0.5x is slower and softer; 2x is faster.</small>
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
