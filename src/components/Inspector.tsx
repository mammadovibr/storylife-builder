import {
  CSSProperties,
  ReactNode,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  useEffect,
  useRef,
  useState
} from "react";
import {
  applySceneVisual,
  Choice,
  ChoiceCondition,
  ChoiceEffect,
  ChoiceOutcome,
  ConditionalTarget,
  createConditionalTarget,
  createDefaultSceneStyle,
  createFlagCondition,
  createFlagEffect,
  createChoiceOutcome,
  createParameterCondition,
  createParameterEffect,
  getActiveSceneImageVariant,
  ParameterConditionOperator,
  Scene,
  SceneStyle,
  SCENE_LAYOUT_OPTIONS,
  SCENE_TRANSITION_OPTIONS,
  SceneLayoutType,
  SceneTransitionOverride,
  SceneType,
  SceneId,
  SceneVisualMediaType,
  StoryFlag,
  StoryParameter,
  ProjectTheme
} from "../domain/project";
import {
  CHOICE_BUTTON_FRAMES,
  getChoiceButtonFrameStyle
} from "../utils/choiceButtonFrames";
import { savePicture } from "../utils/savePicture";
import { applyColorOpacity } from "../utils/colorOpacity";
import { AnimatedSceneImage } from "./AnimatedSceneImage";
import { ORNATE_COLOR_SCHEME_PRESETS } from "../utils/sceneColorSchemes";

interface InspectorProps {
  selectedScene: Scene | null;
  scenes: Scene[];
  parameters: StoryParameter[];
  flags: StoryFlag[];
  projectTheme: ProjectTheme;
  onUpdateScene: (
    sceneId: SceneId,
    updater: (scene: Scene) => Scene,
    trackHistory?: boolean
  ) => void;
  onAddChoice: (sceneId: SceneId) => void;
  onAddChoiceWithScene: (sceneId: SceneId) => void;
  onDeleteScene: (sceneId: SceneId) => void;
  onPickChoiceTarget: (sceneId: SceneId, choiceId: string) => void;
  onSelectScene: (sceneId: SceneId) => void;
  onSceneLayoutClose: () => void;
  onApplySceneLayoutToAll: (scene: Scene) => void;
  pickingChoiceId: string | null;
  focusChoiceId: string | null;
  onChoiceFocusHandled: () => void;
}

export function Inspector({
  selectedScene,
  scenes,
  parameters,
  flags,
  projectTheme,
  onUpdateScene,
  onAddChoice,
  onAddChoiceWithScene,
  onDeleteScene,
  onPickChoiceTarget,
  onSelectScene,
  onSceneLayoutClose,
  onApplySceneLayoutToAll,
  pickingChoiceId,
  focusChoiceId,
  onChoiceFocusHandled
}: InspectorProps) {
  const [expandedChoiceIds, setExpandedChoiceIds] = useState<Set<string>>(
    () => new Set()
  );
  const knownChoiceIdsRef = useRef(
    new Set(selectedScene?.choices.map((choice) => choice.id) ?? [])
  );
  const choiceTextAreaRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const [isMediaExpanded, setMediaExpanded] = useState(false);
  const [isSoundExpanded, setSoundExpanded] = useState(false);
  const [isNotesExpanded, setNotesExpanded] = useState(false);
  const [isScenePreviewOpen, setScenePreviewOpen] = useState(false);
  const [draftSceneId, setDraftSceneId] = useState(selectedScene?.id ?? "");
  const [draftTitle, setDraftTitle] = useState(selectedScene?.title ?? "");
  const [draftText, setDraftText] = useState(selectedScene?.text ?? "");
  const [draftAuthorNotes, setDraftAuthorNotes] = useState(
    selectedScene?.authorNotes ?? ""
  );
  const [draftChoiceTexts, setDraftChoiceTexts] = useState<Record<string, string>>(
    () =>
      Object.fromEntries(
        selectedScene?.choices.map((choice) => [choice.id, choice.text]) ?? []
      )
  );

  useEffect(() => {
    if (!selectedScene || selectedScene.id === draftSceneId) {
      return;
    }

    setDraftSceneId(selectedScene.id);
    setDraftTitle(selectedScene.title);
    setDraftText(selectedScene.text);
    setDraftAuthorNotes(selectedScene.authorNotes);
    setDraftChoiceTexts(
      Object.fromEntries(selectedScene.choices.map((choice) => [choice.id, choice.text]))
    );
  }, [draftSceneId, selectedScene]);

  useEffect(() => {
    if (!selectedScene) {
      setDraftChoiceTexts({});
      return;
    }

    setDraftChoiceTexts((currentDrafts) => {
      const nextDrafts: Record<string, string> = {};
      for (const choice of selectedScene.choices) {
        nextDrafts[choice.id] = currentDrafts[choice.id] ?? choice.text;
      }
      return nextDrafts;
    });
  }, [selectedScene?.choices.map((choice) => choice.id).join("|")]);

  useEffect(() => {
    const currentChoiceIds = new Set(
      selectedScene?.choices.map((choice) => choice.id) ?? []
    );
    const newChoiceIds = [...currentChoiceIds].filter(
      (choiceId) => !knownChoiceIdsRef.current.has(choiceId)
    );

    setExpandedChoiceIds((currentIds) => {
      const nextIds = new Set(currentIds);
      for (const choiceId of nextIds) {
        if (!currentChoiceIds.has(choiceId)) {
          nextIds.delete(choiceId);
        }
      }
      for (const choiceId of newChoiceIds) nextIds.add(choiceId);
      return nextIds;
    });
    knownChoiceIdsRef.current = currentChoiceIds;
  }, [selectedScene?.choices]);

  useEffect(() => {
    setExpandedChoiceIds(new Set());
    setMediaExpanded(false);
    setSoundExpanded(false);
    setNotesExpanded(false);
    knownChoiceIdsRef.current = new Set(
      selectedScene?.choices.map((choice) => choice.id) ?? []
    );
  }, [selectedScene?.id]);

  useEffect(() => {
    if (!focusChoiceId || !selectedScene?.choices.some((choice) => choice.id === focusChoiceId)) {
      return;
    }
    setExpandedChoiceIds((currentIds) => new Set([...currentIds, focusChoiceId]));
  }, [focusChoiceId, selectedScene?.choices]);

  useEffect(() => {
    if (!focusChoiceId || !expandedChoiceIds.has(focusChoiceId)) {
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      const textArea = choiceTextAreaRefs.current.get(focusChoiceId);
      textArea?.focus();
      if (textArea) textArea.setSelectionRange(textArea.value.length, textArea.value.length);
      if (textArea) onChoiceFocusHandled();
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [expandedChoiceIds, focusChoiceId]);

  if (!selectedScene) {
    return (
      <aside className="inspector-panel">
        <h2>Inspector</h2>
        <p className="empty-state">Select a scene.</p>
      </aside>
    );
  }

  function updateChoice(
    choiceId: string,
    patch: Partial<Choice>,
    trackHistory = true
  ) {
    if (!selectedScene) {
      return;
    }

    onUpdateScene(selectedScene.id, (scene) => ({
      ...scene,
      choices: scene.choices.map((choice) =>
        choice.id === choiceId ? { ...choice, ...patch } : choice
      )
    }), trackHistory);
  }

  function updateChoiceEffect(
    choiceId: string,
    effectId: string,
    patch: Partial<ChoiceEffect>
  ) {
    updateChoice(choiceId, {
      effects:
        selectedScene?.choices
          .find((choice) => choice.id === choiceId)
          ?.effects.map((effect) =>
            effect.id === effectId ? ({ ...effect, ...patch } as ChoiceEffect) : effect
          ) ?? []
    });
  }

  function updateChoiceCondition(
    choiceId: string,
    conditionId: string,
    patch: Partial<ChoiceCondition>
  ) {
    updateChoice(choiceId, {
      conditions:
        selectedScene?.choices
          .find((choice) => choice.id === choiceId)
          ?.conditions.map((condition) =>
            condition.id === conditionId
              ? ({ ...condition, ...patch } as ChoiceCondition)
              : condition
          ) ?? []
    });
  }

  function updateChoiceOutcome(
    choiceId: string,
    outcomeId: string,
    patch: Partial<ChoiceOutcome>
  ) {
    const choice = selectedScene?.choices.find((item) => item.id === choiceId);
    if (!choice) {
      return;
    }

    updateChoice(choiceId, {
      outcomes: choice.outcomes.map((outcome) =>
        outcome.id === outcomeId ? { ...outcome, ...patch } : outcome
      )
    });
  }

  function deleteChoice(choiceId: string) {
    if (!selectedScene) {
      return;
    }

    onUpdateScene(selectedScene.id, (scene) => ({
      ...scene,
      choices: scene.choices.filter((choice) => choice.id !== choiceId)
    }));
  }

  function toggleChoice(choiceId: string) {
    setExpandedChoiceIds((currentIds) => toggleSetValue(currentIds, choiceId));
  }

  function closeScenePreview() {
    setScenePreviewOpen(false);
    onSceneLayoutClose();
  }

  return (
    <aside
      className="inspector-panel"
      onKeyDownCapture={stopEditableEventPropagation}
      onMouseDownCapture={stopEditableEventPropagation}
    >
      <h2>Inspector</h2>
      <button
        type="button"
        className="danger-button full-width-button"
        onClick={() => onDeleteScene(selectedScene.id)}
      >
        Delete Scene
      </button>
      <label className="field-label">
        Scene ID
        <input value={selectedScene.id} readOnly />
      </label>
      <label className="field-label">
        Title
        <input
          value={draftTitle}
          onChange={(event) => {
            const title = event.target.value;
            setDraftTitle(title);
            onUpdateScene(selectedScene.id, (scene) => ({
              ...scene,
              title
            }), false);
          }}
        />
      </label>
      <label className="field-label">
        Text
        <textarea
          value={draftText}
          onChange={(event) => {
            const text = event.target.value;
            setDraftText(text);
            onUpdateScene(selectedScene.id, (scene) => ({
              ...scene,
              text
            }), false);
          }}
        />
      </label>
      <button
        type="button"
        className="full-width-button scene-layout-open-button"
        onClick={() => setScenePreviewOpen(true)}
      >
        Scene Layout
      </button>
      <div className="choices-header">
        <h3>Choices</h3>
        <div className="choice-add-actions">
          <button type="button" onClick={() => onAddChoice(selectedScene.id)}>
            Choice only
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => onAddChoiceWithScene(selectedScene.id)}
          >
            Choice + Scene
          </button>
        </div>
      </div>
      <div className="choices-list">
        {selectedScene.choices.length === 0 && (
          <p className="empty-state">No choices yet.</p>
        )}
        {selectedScene.choices.map((choice, choiceIndex) => (
          <div
            className={`choice-editor collapsible-item ${
              expandedChoiceIds.has(choice.id) ? "is-expanded" : ""
            }`}
            key={choice.id}
            data-full-text={
              draftChoiceTexts[choice.id] ||
              choice.text ||
              `Choice ${choiceIndex + 1}`
            }
          >
            <button
              type="button"
              className="collapse-header"
              onClick={() => toggleChoice(choice.id)}
            >
              <span>
                Choice {choiceIndex + 1}
                {draftChoiceTexts[choice.id] ? `: ${draftChoiceTexts[choice.id]}` : ""}
              </span>
              <small>{expandedChoiceIds.has(choice.id) ? "Hide" : "Edit"}</small>
            </button>
            {expandedChoiceIds.has(choice.id) && (
              <div className="collapse-body">
                <label className="field-label">
                  Choice text
                  <textarea
                    ref={(element) => {
                      if (element) choiceTextAreaRefs.current.set(choice.id, element);
                      else choiceTextAreaRefs.current.delete(choice.id);
                    }}
                    value={draftChoiceTexts[choice.id] ?? choice.text}
                    rows={getChoiceTextRows(draftChoiceTexts[choice.id] ?? choice.text)}
                    onChange={(event) => {
                      const text = event.target.value;
                      setDraftChoiceTexts((currentDrafts) => ({
                        ...currentDrafts,
                        [choice.id]: text
                      }));
                      updateChoice(choice.id, { text }, false);
                    }}
                  />
                </label>
                <div className="choice-target-row">
                  <label className="field-label">
                    Target scene
                    <select
                      value={choice.targetNodeId}
                      onChange={(event) => {
                        const targetNodeId = event.target.value;
                        updateChoice(choice.id, {
                          targetNodeId,
                          outcomes:
                            choice.useMultipleOutcomes
                              ? choice.outcomes
                              : choice.outcomes.length === 1
                                ? [
                                  {
                                    ...choice.outcomes[0],
                                    targetSceneId: targetNodeId,
                                    percent: 100
                                  }
                                  ]
                                : [
                                    createChoiceOutcome(
                                      targetNodeId,
                                      100,
                                      `outcome_${choice.id}`
                                    )
                                  ]
                        });
                      }}
                    >
                      <option value="">Not connected</option>
                      {scenes.map((scene) => (
                        <option key={scene.id} value={scene.id}>
                          {scene.title || scene.id}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    onClick={() => onPickChoiceTarget(selectedScene.id, choice.id)}
                    className={`choice-target-picker-button ${
                      pickingChoiceId === choice.id ? "is-active" : ""
                    }`}
                    aria-label="Pick target scene on canvas"
                    title="Pick target scene on canvas"
                  >
                    <span aria-hidden="true">&#9678;</span>
                  </button>
                </div>
                <label className="checkbox-label choice-multiple-toggle">
                  <input
                    type="checkbox"
                    checked={choice.useMultipleOutcomes}
                    onChange={(event) => {
                      const outcomes =
                        choice.outcomes.length > 0
                          ? choice.outcomes
                          : [
                              createChoiceOutcome(
                                choice.targetNodeId,
                                100,
                                `outcome_${choice.id}`
                              )
                            ];
                      updateChoice(choice.id, {
                        useMultipleOutcomes: event.target.checked,
                        outcomes
                      });
                    }}
                  />
                  <span>Multiple outcomes by percent</span>
                </label>
                {choice.useMultipleOutcomes && (
                  <ChoiceOutcomesEditor
                    choice={choice}
                    scenes={scenes}
                    onAddOutcome={() => {
                      const total = getChoiceOutcomeTotal(choice);
                      const targetSceneId = choice.targetNodeId || scenes[0]?.id;
                      if (!targetSceneId) {
                        return;
                      }
                      updateChoice(choice.id, {
                        outcomes: [
                          ...choice.outcomes,
                          createChoiceOutcome(
                            targetSceneId,
                            Math.max(0, 100 - total),
                            `outcome_${getNextNumericId("outcome", choice.outcomes)}`
                          )
                        ]
                      });
                    }}
                    onUpdateOutcome={(outcomeId, patch) =>
                      updateChoiceOutcome(choice.id, outcomeId, patch)
                    }
                    onDeleteOutcome={(outcomeId) =>
                      updateChoice(choice.id, {
                        outcomes: choice.outcomes.filter(
                          (outcome) => outcome.id !== outcomeId
                        )
                      })
                    }
                  />
                )}
                <label className="field-label">
                  If conditions fail
                  <select
                    value={choice.conditionFailBehavior}
                    onChange={(event) =>
                      updateChoice(choice.id, {
                        conditionFailBehavior:
                          event.target.value === "hidden" ? "hidden" : "disabled"
                      })
                    }
                  >
                    <option value="disabled">Show locked</option>
                    <option value="hidden">Hide choice</option>
                  </select>
                </label>

                <ChoiceEffectsEditor
                  choice={choice}
                  parameters={parameters}
                  flags={flags}
                  onAddParameterEffect={() => {
                    const parameterId = parameters[0]?.id;
                    if (!parameterId) {
                      return;
                    }
                    updateChoice(choice.id, {
                      effects: [
                        ...choice.effects,
                        createParameterEffect(
                          parameterId,
                          `effect_${getNextNumericId("effect", choice.effects)}`
                        )
                      ]
                    });
                  }}
                  onAddFlagEffect={() => {
                    const flagId = flags[0]?.id;
                    if (!flagId) {
                      return;
                    }
                    updateChoice(choice.id, {
                      effects: [
                        ...choice.effects,
                        createFlagEffect(
                          flagId,
                          `effect_${getNextNumericId("effect", choice.effects)}`
                        )
                      ]
                    });
                  }}
                  onUpdateEffect={(effectId, patch) =>
                    updateChoiceEffect(choice.id, effectId, patch)
                  }
                  onDeleteEffect={(effectId) =>
                    updateChoice(choice.id, {
                      effects: choice.effects.filter((effect) => effect.id !== effectId)
                    })
                  }
                />

                <ChoiceConditionsEditor
                  choice={choice}
                  parameters={parameters}
                  flags={flags}
                  onAddParameterCondition={() => {
                    const parameterId = parameters[0]?.id;
                    if (!parameterId) {
                      return;
                    }
                    updateChoice(choice.id, {
                      conditions: [
                        ...choice.conditions,
                        createParameterCondition(
                          parameterId,
                          `condition_${getNextNumericId(
                            "condition",
                            choice.conditions
                          )}`
                        )
                      ]
                    });
                  }}
                  onAddFlagCondition={() => {
                    const flagId = flags[0]?.id;
                    if (!flagId) {
                      return;
                    }
                    updateChoice(choice.id, {
                      conditions: [
                        ...choice.conditions,
                        createFlagCondition(
                          flagId,
                          `condition_${getNextNumericId(
                            "condition",
                            choice.conditions
                          )}`
                        )
                      ]
                    });
                  }}
                  onUpdateCondition={(conditionId, patch) =>
                    updateChoiceCondition(choice.id, conditionId, patch)
                  }
                  onDeleteCondition={(conditionId) =>
                    updateChoice(choice.id, {
                      conditions: choice.conditions.filter(
                        (condition) => condition.id !== conditionId
                      )
                    })
                  }
                />

                <ConditionalTargetsEditor
                  choice={choice}
                  scenes={scenes}
                  flags={flags}
                  onAddConditionalTarget={() => {
                    const flagId = flags[0]?.id;
                    const targetSceneId = scenes[0]?.id;
                    if (!flagId || !targetSceneId) {
                      return;
                    }
                    updateChoice(choice.id, {
                      conditionalTargets: [
                        ...choice.conditionalTargets,
                        createConditionalTarget(
                          flagId,
                          targetSceneId,
                          `conditional_target_${getNextNumericId(
                            "conditional_target",
                            choice.conditionalTargets
                          )}`
                        )
                      ]
                    });
                  }}
                  onUpdateConditionalTarget={(conditionalTargetId, patch) =>
                    updateChoice(choice.id, {
                      conditionalTargets: choice.conditionalTargets.map(
                        (conditionalTarget) =>
                          conditionalTarget.id === conditionalTargetId
                            ? { ...conditionalTarget, ...patch }
                            : conditionalTarget
                      )
                    })
                  }
                  onDeleteConditionalTarget={(conditionalTargetId) =>
                    updateChoice(choice.id, {
                      conditionalTargets: choice.conditionalTargets.filter(
                        (conditionalTarget) =>
                          conditionalTarget.id !== conditionalTargetId
                      )
                    })
                  }
                  onMoveConditionalTarget={(conditionalTargetId, direction) =>
                    updateChoice(choice.id, {
                      conditionalTargets: moveItem(
                        choice.conditionalTargets,
                        conditionalTargetId,
                        direction
                      )
                    })
                  }
                />

                <button
                  type="button"
                  className="danger-button"
                  onClick={() => deleteChoice(choice.id)}
                >
                  Delete Choice
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <label className="field-label">
        Scene Type
        <select
          value={selectedScene.sceneType}
          onChange={(event) =>
            onUpdateScene(selectedScene.id, (scene) => ({
              ...scene,
              sceneType: event.target.value as SceneType
            }))
          }
        >
          <option value="normal">Normal scene</option>
          <option value="ending">Ending scene</option>
          <option value="important">Important / key scene</option>
          <option value="flagLogic">Flag logic scene</option>
        </select>
      </label>
      <CollapsibleSection
        title="Scene Picture / Video"
        expanded={isMediaExpanded}
        onToggle={() => setMediaExpanded((current) => !current)}
      >
        <SceneImageSection
          key={selectedScene.id}
          imagePath={selectedScene.imagePath}
          mediaType={selectedScene.visualMediaType}
          videoLoop={selectedScene.videoLoop}
          sceneName={selectedScene.title || selectedScene.id}
          onMediaChange={(imagePath, visualMediaType) =>
            onUpdateScene(selectedScene.id, (scene) =>
              applySceneVisual(scene, imagePath, visualMediaType, {
                name: imagePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "Imported image"
              })
            )
          }
          onVideoLoopChange={(videoLoop) =>
            onUpdateScene(selectedScene.id, (scene) => ({ ...scene, videoLoop }))
          }
        />
      </CollapsibleSection>
      <CollapsibleSection
        title="Scene Sound"
        expanded={isSoundExpanded}
        onToggle={() => setSoundExpanded((current) => !current)}
      >
        <MediaPickerSection
          mediaPath={selectedScene.soundPath}
          emptyLabel="No scene sound selected"
          selectLabel="Select Sound"
          changeLabel="Change Sound"
          removeLabel="Remove Sound"
          accept=".mp3,.wav,.ogg,.m4a,.webm,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm"
          selectNative={window.storyLife?.selectAudio}
          onMediaPathChange={(soundPath) =>
            onUpdateScene(selectedScene.id, (scene) => ({
              ...scene,
              soundPath
            }))
          }
        />
        <AudioSceneControls
          scene={selectedScene}
          onUpdateScene={(updater) =>
            onUpdateScene(selectedScene.id, updater, false)
          }
        />
      </CollapsibleSection>
      <CollapsibleSection
        title="Author Notes"
        expanded={isNotesExpanded}
        onToggle={() => setNotesExpanded((current) => !current)}
      >
        <label className="field-label">
          Notes
          <textarea
            value={draftAuthorNotes}
            onChange={(event) => {
              const authorNotes = event.target.value;
              setDraftAuthorNotes(authorNotes);
              onUpdateScene(selectedScene.id, (scene) => ({
                ...scene,
                authorNotes
              }), false);
            }}
            placeholder="Only visible in the editor. Not exported to game."
          />
        </label>
      </CollapsibleSection>
      {isScenePreviewOpen && (
        <ScenePreviewModal
          scene={selectedScene}
          scenes={scenes}
          projectTheme={projectTheme}
          onUpdateScene={(updater) =>
            onUpdateScene(selectedScene.id, updater, false)
          }
          onSelectScene={onSelectScene}
          onApplySceneLayoutToAll={onApplySceneLayoutToAll}
          onClose={closeScenePreview}
        />
      )}
    </aside>
  );
}

interface SceneImageSectionProps {
  imagePath: string;
  mediaType: SceneVisualMediaType;
  videoLoop: boolean;
  sceneName: string;
  onMediaChange: (imagePath: string, mediaType: SceneVisualMediaType) => void;
  onVideoLoopChange: (videoLoop: boolean) => void;
}

interface CollapsibleSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  children
}: CollapsibleSectionProps) {
  return (
    <section className="choice-editor collapsible-item inspector-collapsible">
      <button type="button" className="collapse-header" onClick={onToggle}>
        <span>{title}</span>
        <small>{expanded ? "Hide" : "Edit"}</small>
      </button>
      {expanded && <div className="collapse-body">{children}</div>}
    </section>
  );
}

interface AudioSceneControlsProps {
  scene: Scene;
  onUpdateScene: (updater: (scene: Scene) => Scene) => void;
}

function AudioSceneControls({ scene, onUpdateScene }: AudioSceneControlsProps) {
  return (
    <>
      <label className="field-label">
        Scene sound volume
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={scene.soundVolume}
          onChange={(event) =>
            onUpdateScene((currentScene) => ({
              ...currentScene,
              soundVolume: readNumberInput(event.target.value)
            }))
          }
        />
      </label>
      <div className="two-column-fields">
        <label className="field-label">
          Sound fade in
          <input
            type="range"
            min="0"
            max="15"
            step="0.1"
            value={scene.soundFadeInSeconds}
            onChange={(event) =>
              onUpdateScene((currentScene) => ({
                ...currentScene,
                soundFadeInSeconds: readNumberInput(event.target.value)
              }))
            }
          />
        </label>
        <label className="field-label">
          Sound fade out
          <input
            type="range"
            min="0"
            max="15"
            step="0.1"
            value={scene.soundFadeOutSeconds}
            onChange={(event) =>
              onUpdateScene((currentScene) => ({
                ...currentScene,
                soundFadeOutSeconds: readNumberInput(event.target.value)
              }))
            }
          />
        </label>
      </div>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={scene.fadeMusicOnSceneSound}
          onChange={(event) =>
            onUpdateScene((currentScene) => ({
              ...currentScene,
              fadeMusicOnSceneSound: event.target.checked
            }))
          }
        />
        Fade background music while this sound plays
      </label>
    </>
  );
}

interface SceneVisualControlsProps {
  scene: Scene;
  projectTheme: ProjectTheme;
  onUpdateScene: (updater: (scene: Scene) => Scene) => void;
  fullSize?: boolean;
}

type PreviewTarget = "image" | "title" | "text" | "choices";
type PreviewDragMode =
  | "move"
  | "resizeLeft"
  | "resizeRight"
  | "resizeTop"
  | "resizeBottom"
  | "resizeTopLeft"
  | "resizeTopRight"
  | "resizeBottomLeft"
  | "resizeBottomRight";
interface UserLayoutTemplate {
  name: string;
  layoutType: SceneLayoutType;
  style: SceneStyle;
}

const USER_LAYOUT_TEMPLATE_KEY = "storylife-user-layout-templates-v1";
const USER_LAYOUT_TEMPLATE_COUNT = 10;
const MIN_CHOICES_PANEL_HEIGHT = 24;
const FONT_FAMILY_OPTIONS = [
  { value: "system", label: "Clean UI" },
  { value: "serif", label: "Book Serif" },
  { value: "mono", label: "Mono" }
];

const COLOR_SCHEME_PRESETS: Array<{
  name: string;
  colors: Partial<SceneStyle>;
}> = [
  { name: "Ink & Ivory", colors: { backgroundColor: "#f5f1e8", textColor: "#20242a", titlePanelColor: "#fffdf8", titleBorderColor: "#69727d", titleTextColor: "#20242a", textPanelColor: "#fffdf8", textBorderColor: "#a6adb4", choicesPanelColor: "#e5edf2", choicesBorderColor: "#536b7a", choicesTextColor: "#18252d" } },
  { name: "Graphite Gold", colors: { backgroundColor: "#17191c", textColor: "#f2eee5", titlePanelColor: "#23262b", titleBorderColor: "#d3a84f", titleTextColor: "#f4cf7a", textPanelColor: "#23262b", textBorderColor: "#77633f", choicesPanelColor: "#2b2e33", choicesBorderColor: "#d3a84f", choicesTextColor: "#fff7e4" } },
  { name: "Ocean Coral", colors: { backgroundColor: "#0e3440", textColor: "#f4fbfc", titlePanelColor: "#164b59", titleBorderColor: "#ff8f70", titleTextColor: "#fff4ed", textPanelColor: "#164b59", textBorderColor: "#69a9b7", choicesPanelColor: "#f06f52", choicesBorderColor: "#ffd2c5", choicesTextColor: "#241512" } },
  { name: "Forest Paper", colors: { backgroundColor: "#163c32", textColor: "#f7f3e8", titlePanelColor: "#245446", titleBorderColor: "#d7c58c", titleTextColor: "#fff7d8", textPanelColor: "#f2ead7", textBorderColor: "#9e8d5f", choicesPanelColor: "#d8e5d8", choicesBorderColor: "#416f5c", choicesTextColor: "#17352c" } },
  { name: "Cherry Snow", colors: { backgroundColor: "#f7f8fa", textColor: "#25262b", titlePanelColor: "#ffffff", titleBorderColor: "#c83f55", titleTextColor: "#9f2136", textPanelColor: "#ffffff", textBorderColor: "#c8cbd1", choicesPanelColor: "#f7dce1", choicesBorderColor: "#b93249", choicesTextColor: "#41151e" } },
  { name: "Midnight Cyan", colors: { backgroundColor: "#0b1720", textColor: "#e8f7fa", titlePanelColor: "#122633", titleBorderColor: "#49bfd1", titleTextColor: "#8fe7f2", textPanelColor: "#122633", textBorderColor: "#356878", choicesPanelColor: "#123d49", choicesBorderColor: "#49bfd1", choicesTextColor: "#e9fcff" } },
  { name: "Slate Apricot", colors: { backgroundColor: "#2d3742", textColor: "#f7f3ed", titlePanelColor: "#3b4753", titleBorderColor: "#f2a66f", titleTextColor: "#ffd0ad", textPanelColor: "#3b4753", textBorderColor: "#72808c", choicesPanelColor: "#f2a66f", choicesBorderColor: "#ffe0c9", choicesTextColor: "#312017" } },
  { name: "Sage Charcoal", colors: { backgroundColor: "#e7eee8", textColor: "#222925", titlePanelColor: "#f8faf8", titleBorderColor: "#5b7565", titleTextColor: "#284536", textPanelColor: "#f8faf8", textBorderColor: "#9aad9f", choicesPanelColor: "#3f584a", choicesBorderColor: "#23392e", choicesTextColor: "#f5fff8" } },
  { name: "Royal Lemon", colors: { backgroundColor: "#22283e", textColor: "#f6f7fb", titlePanelColor: "#303853", titleBorderColor: "#f0d95b", titleTextColor: "#fff19a", textPanelColor: "#303853", textBorderColor: "#77809d", choicesPanelColor: "#f0d95b", choicesBorderColor: "#fff4a6", choicesTextColor: "#252818" } },
  { name: "Brick Mist", colors: { backgroundColor: "#f1f3f4", textColor: "#282829", titlePanelColor: "#ffffff", titleBorderColor: "#a84438", titleTextColor: "#87352d", textPanelColor: "#ffffff", textBorderColor: "#b8bdc0", choicesPanelColor: "#a84438", choicesBorderColor: "#722a23", choicesTextColor: "#fff8f5" } },
  { name: "Teal Sand", colors: { backgroundColor: "#dfeceb", textColor: "#173230", titlePanelColor: "#f7fbfa", titleBorderColor: "#28736c", titleTextColor: "#17544f", textPanelColor: "#f7fbfa", textBorderColor: "#85aaa6", choicesPanelColor: "#28736c", choicesBorderColor: "#174c47", choicesTextColor: "#f5fffd" } },
  { name: "Plum Mint", colors: { backgroundColor: "#302535", textColor: "#f7f3f8", titlePanelColor: "#443349", titleBorderColor: "#7fd6b2", titleTextColor: "#b9f3d8", textPanelColor: "#443349", textBorderColor: "#806b85", choicesPanelColor: "#7fd6b2", choicesBorderColor: "#c4f7df", choicesTextColor: "#18352a" } },
  { name: "Blue Paper", colors: { backgroundColor: "#e9f0f6", textColor: "#1d2c38", titlePanelColor: "#ffffff", titleBorderColor: "#3f6f91", titleTextColor: "#264f6d", textPanelColor: "#ffffff", textBorderColor: "#9fb5c4", choicesPanelColor: "#335f7d", choicesBorderColor: "#24465d", choicesTextColor: "#f4fbff" } },
  { name: "Copper Night", colors: { backgroundColor: "#181d22", textColor: "#f3eee9", titlePanelColor: "#252c32", titleBorderColor: "#c77c4d", titleTextColor: "#f1b187", textPanelColor: "#252c32", textBorderColor: "#695344", choicesPanelColor: "#8f4f2d", choicesBorderColor: "#e0a27d", choicesTextColor: "#fff7f1" } },
  { name: "Rose Graphite", colors: { backgroundColor: "#29292d", textColor: "#f7f4f5", titlePanelColor: "#38383e", titleBorderColor: "#e08ca2", titleTextColor: "#ffc0d0", textPanelColor: "#38383e", textBorderColor: "#77727a", choicesPanelColor: "#b95e77", choicesBorderColor: "#f1a7ba", choicesTextColor: "#fff8fa" } },
  { name: "Moss Sky", colors: { backgroundColor: "#dce9e5", textColor: "#21312a", titlePanelColor: "#f6faf8", titleBorderColor: "#55735f", titleTextColor: "#345442", textPanelColor: "#f6faf8", textBorderColor: "#9daf9f", choicesPanelColor: "#547c91", choicesBorderColor: "#36596b", choicesTextColor: "#f7fcff" } },
  { name: "Black Ice", colors: { backgroundColor: "#0f1215", textColor: "#f2f7f8", titlePanelColor: "#1b2025", titleBorderColor: "#a9c7cf", titleTextColor: "#d8f3f7", textPanelColor: "#1b2025", textBorderColor: "#506068", choicesPanelColor: "#d6e5e8", choicesBorderColor: "#ffffff", choicesTextColor: "#172126" } },
  { name: "Amber Cloud", colors: { backgroundColor: "#f2f0ec", textColor: "#2f2b25", titlePanelColor: "#ffffff", titleBorderColor: "#b87924", titleTextColor: "#855413", textPanelColor: "#ffffff", textBorderColor: "#c6b89f", choicesPanelColor: "#e8c47f", choicesBorderColor: "#a86a18", choicesTextColor: "#33240e" } },
  { name: "Crimson Navy", colors: { backgroundColor: "#111d32", textColor: "#f7f8fb", titlePanelColor: "#1c2c49", titleBorderColor: "#dd5964", titleTextColor: "#ffadb4", textPanelColor: "#1c2c49", textBorderColor: "#63718a", choicesPanelColor: "#b83e49", choicesBorderColor: "#f07c85", choicesTextColor: "#fff7f8" } },
  { name: "Clean Contrast", colors: { backgroundColor: "#ffffff", textColor: "#151719", titlePanelColor: "#ffffff", titleBorderColor: "#151719", titleTextColor: "#151719", textPanelColor: "#ffffff", textBorderColor: "#70757a", choicesPanelColor: "#151719", choicesBorderColor: "#151719", choicesTextColor: "#ffffff" } }
];

function createGradientScheme(
  name: string,
  backgroundFrom: string,
  backgroundTo: string,
  panelFrom: string,
  panelTo: string,
  accent: string,
  textColor = "#ffffff"
): { name: string; colors: Partial<SceneStyle> } {
  return {
    name,
    colors: {
      backgroundColor: `linear-gradient(145deg, ${backgroundFrom} 0%, ${backgroundTo} 100%)`,
      textColor,
      titlePanelColor: `linear-gradient(135deg, ${panelFrom} 0%, ${panelTo} 100%)`,
      titleBorderColor: accent,
      titleTextColor: textColor,
      textPanelColor: `linear-gradient(135deg, ${panelFrom} 0%, ${panelTo} 100%)`,
      textBorderColor: accent,
      choicesPanelColor: `linear-gradient(135deg, ${panelTo} 0%, ${panelFrom} 100%)`,
      choicesBorderColor: accent,
      choicesTextColor: textColor
    }
  };
}

const GRADIENT_COLOR_SCHEME_PRESETS = [
  createGradientScheme("Aurora Night", "#071c2c", "#174f52", "#102c3a", "#246b68", "#7de3c3"),
  createGradientScheme("Crimson Dusk", "#240d18", "#6d2439", "#35121f", "#7f2f48", "#e5a06f"),
  createGradientScheme("Royal Horizon", "#14172d", "#364f83", "#202443", "#4a6395", "#e1c56f"),
  createGradientScheme("Emerald Smoke", "#0d211b", "#315b47", "#17352a", "#426d58", "#c9b56b"),
  createGradientScheme("Copper Ember", "#1c1411", "#74402a", "#2c1d17", "#875039", "#e7ad73"),
  createGradientScheme("Ocean Glass", "#082032", "#176b83", "#123448", "#23839a", "#8eddeb"),
  createGradientScheme("Plum Moon", "#211226", "#603f68", "#321a38", "#75517d", "#d3a0d8"),
  createGradientScheme("Graphite Ice", "#111418", "#3e4c54", "#1d2228", "#52636c", "#b8d6dd"),
  createGradientScheme("Sunset Coral", "#4b1824", "#d26c55", "#642334", "#b84f45", "#ffd49d"),
  createGradientScheme("Blue Gold", "#0b1830", "#2e5481", "#15284a", "#3f6591", "#d8b85f"),
  createGradientScheme("Forest Dawn", "#142b25", "#67805d", "#234239", "#78906d", "#e3d08a"),
  createGradientScheme("Black Cherry", "#110d12", "#5a1f35", "#21131b", "#6d2c43", "#d98c9f"),
  createGradientScheme("Storm Silver", "#1b2028", "#687382", "#2a303a", "#7c8794", "#d2dae0"),
  createGradientScheme("Teal Flame", "#07272a", "#b75d3f", "#10383a", "#8c4d3d", "#f4bd75"),
  createGradientScheme("Indigo Rose", "#191735", "#8c4163", "#29234c", "#75405c", "#efabc0"),
  createGradientScheme("Moss Bronze", "#18241c", "#735a32", "#29382b", "#806843", "#d9c080"),
  createGradientScheme("Arctic Pine", "#0b2630", "#3c7968", "#153943", "#4b8c79", "#a9e4d3"),
  createGradientScheme("Wine Velvet", "#250c15", "#7c3043", "#38131f", "#914157", "#e0b578"),
  createGradientScheme("Midnight Amber", "#0d111a", "#5b431d", "#1b202a", "#6c5228", "#e6c36b"),
  createGradientScheme("Deep Spectrum", "#101936", "#542b5f", "#1d2c53", "#683970", "#73d5c6")
];

function SceneVisualControls({
  scene,
  projectTheme,
  onUpdateScene,
  fullSize = false
}: SceneVisualControlsProps) {
  const style = scene.style;
  const [activeTarget, setActiveTarget] = useState<PreviewTarget>(
    scene.imagePath.trim() !== "" ? "image" : "text"
  );
  const [colorSchemeTab, setColorSchemeTab] = useState<
    "solid" | "gradient" | "ornate"
  >("solid");
  const [userTemplates, setUserTemplates] = useState<Array<UserLayoutTemplate | null>>(
    readUserLayoutTemplates
  );
  const [templateNameDrafts, setTemplateNameDrafts] = useState<string[]>(() =>
    readUserLayoutTemplates().map((template, index) => template?.name ?? `Slot ${index + 1}`)
  );
  const activeDragRef = useRef<{
    target: PreviewTarget;
    mode: PreviewDragMode;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    startScale: number;
    startPanelWidth: number;
    startPanelHeight: number;
    textOnly: boolean;
    startTextOffsetX: number;
    startTextOffsetY: number;
  } | null>(null);

  useEffect(() => {
    if (
      activeTarget === "image" &&
      (scene.layoutType === "noImage" || scene.imagePath.trim() === "")
    ) {
      setActiveTarget("text");
    }
  }, [activeTarget, scene.imagePath, scene.layoutType]);

  function patchStyle(patch: Partial<Scene["style"]>) {
    onUpdateScene((currentScene) => ({
      ...currentScene,
      style: {
        ...currentScene.style,
        ...patch
      }
    }));
  }

  useEffect(() => {
    function handleMove(event: MouseEvent) {
      const activeDrag = activeDragRef.current;
      if (!activeDrag) {
        return;
      }

      event.preventDefault();
      const deltaX = event.clientX - activeDrag.startX;
      const deltaY = event.clientY - activeDrag.startY;

      if (activeDrag.mode === "move") {
        if (activeDrag.textOnly && activeDrag.target !== "image") {
          patchStyle(
            activeDrag.target === "title"
              ? {
                  titleTextOffsetX: activeDrag.startTextOffsetX + deltaX * 3,
                  titleTextOffsetY: activeDrag.startTextOffsetY + deltaY * 3
                }
              : activeDrag.target === "text"
                ? {
                    sceneTextOffsetX: activeDrag.startTextOffsetX + deltaX * 3,
                    sceneTextOffsetY: activeDrag.startTextOffsetY + deltaY * 3
                  }
                : {
                    choiceTextOffsetX: activeDrag.startTextOffsetX + deltaX * 3,
                    choiceTextOffsetY: activeDrag.startTextOffsetY + deltaY * 3
                  }
          );
          return;
        }
        patchStyle(
          prefixPatch(activeDrag.target, {
            offsetX: activeDrag.startOffsetX + deltaX * 3,
            offsetY: activeDrag.startOffsetY + deltaY * 3
          })
        );
        return;
      }

      if (activeDrag.mode !== "move" && activeDrag.target === "image") {
        const scaleDelta = getResizeScaleDelta(activeDrag.mode, deltaX, deltaY);
        patchStyle({
          imageScale: clampNumber(activeDrag.startScale + scaleDelta, 0.1, 4),
          imageOffsetX:
            activeDrag.startOffsetX +
            getResizeOffsetDeltaX(activeDrag.mode, deltaX) * 3,
          imageOffsetY:
            activeDrag.startOffsetY +
            getResizeOffsetDeltaY(activeDrag.mode, deltaY) * 3
        });
        return;
      }

      if (activeDrag.mode !== "move") {
        const nextWidth = getResizeWidth(activeDrag, deltaX);
        const nextHeight = getResizeHeight(activeDrag, deltaY);

        if (activeDrag.target === "title") {
          const resizedWidth =
            nextWidth !== null ? clampNumber(nextWidth, 80, 390) : null;
          const resizedHeight =
            nextHeight !== null ? clampNumber(nextHeight, 0, 260) : null;
          patchStyle({
            ...(resizedWidth !== null
              ? { titlePanelWidth: resizedWidth }
              : {}),
            ...(resizedHeight !== null
              ? { titlePanelHeight: resizedHeight }
              : {}),
            titleOffsetX:
              activeDrag.startOffsetX +
              (resizedWidth !== null
                ? getPanelResizeOffsetForWidth(
                    activeDrag.mode,
                    activeDrag.startPanelWidth,
                    resizedWidth
                  ) * 3
                : 0),
            titleOffsetY:
              activeDrag.startOffsetY +
              (resizedHeight !== null
                ? getPanelResizeOffsetForHeight(
                    activeDrag.mode,
                    activeDrag.startPanelHeight,
                    resizedHeight
                  ) * 3
                : 0)
          });
          return;
        }

        if (activeDrag.target === "text") {
          const resizedWidth =
            nextWidth !== null ? clampNumber(nextWidth, 80, 390) : null;
          const resizedHeight =
            nextHeight !== null ? clampNumber(nextHeight, 0, 620) : null;
          patchStyle({
            ...(resizedWidth !== null
              ? { textPanelWidth: resizedWidth }
              : {}),
            ...(resizedHeight !== null
              ? { textPanelHeight: resizedHeight }
              : {}),
            textOffsetX:
              activeDrag.startOffsetX +
              (resizedWidth !== null
                ? getPanelResizeOffsetForWidth(
                    activeDrag.mode,
                    activeDrag.startPanelWidth,
                    resizedWidth
                  ) * 3
                : 0),
            textOffsetY:
              activeDrag.startOffsetY +
              (resizedHeight !== null
                ? getPanelResizeOffsetForHeight(
                    activeDrag.mode,
                    activeDrag.startPanelHeight,
                    resizedHeight
                  ) * 3
                : 0)
          });
          return;
        }

        if (activeDrag.target === "choices") {
          const resizedWidth =
            nextWidth !== null ? clampNumber(nextWidth, 80, 390) : null;
          const resizedHeight =
            nextHeight !== null
              ? clampNumber(nextHeight, MIN_CHOICES_PANEL_HEIGHT, 620)
              : null;
          patchStyle({
            ...(resizedWidth !== null
              ? { choicesPanelWidth: resizedWidth }
              : {}),
            ...(resizedHeight !== null
              ? { choicesPanelHeight: resizedHeight }
              : {}),
            choicesOffsetX:
              activeDrag.startOffsetX +
              (resizedWidth !== null
                ? getPanelResizeOffsetForWidth(
                    activeDrag.mode,
                    activeDrag.startPanelWidth,
                    resizedWidth
                  ) * 3
                : 0),
            choicesOffsetY:
              activeDrag.startOffsetY +
              (resizedHeight !== null
                ? getPanelResizeOffsetForHeight(
                    activeDrag.mode,
                    activeDrag.startPanelHeight,
                    resizedHeight
                  ) * 3
                : 0)
          });
          return;
        }
      }
    }

    function handleUp() {
      activeDragRef.current = null;
    }

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  });

  function startPreviewDrag(
    target: PreviewTarget,
    mode: PreviewDragMode,
    event: ReactMouseEvent
  ) {
    setActiveTarget(target);
    if (!fullSize) {
      return;
    }

    const isTextControl =
      event.target instanceof HTMLElement &&
      event.target.closest("input, textarea, select, button");
    const textOnly = mode === "move" && target !== "image" && event.ctrlKey;
    const isChoiceTextDrag = target === "choices" && mode === "move";

    if (mode === "move" && isTextControl && !isChoiceTextDrag && !textOnly) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const panelElement =
      event.currentTarget instanceof HTMLElement
        ? event.currentTarget.closest(".scene-preview-editable")
        : null;
    activeDragRef.current = {
      target,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX:
        target === "image"
          ? style.imageOffsetX
          : target === "title"
            ? style.titleOffsetX
          : target === "text"
            ? style.textOffsetX
            : style.choicesOffsetX,
      startOffsetY:
        target === "image"
          ? style.imageOffsetY
          : target === "title"
            ? style.titleOffsetY
          : target === "text"
            ? style.textOffsetY
            : style.choicesOffsetY,
      startScale:
        target === "image"
          ? style.imageScale
          : target === "title"
            ? style.titleScale
          : target === "text"
            ? style.textScale
            : style.choicesScale,
      startPanelWidth:
        target === "title"
          ? style.titlePanelWidth || panelElement?.offsetWidth || 0
          : target === "text"
          ? style.textPanelWidth || panelElement?.offsetWidth || 0
          : target === "choices"
            ? style.choicesPanelWidth || panelElement?.offsetWidth || 0
            : 0,
      startPanelHeight:
        target === "title"
          ? style.titlePanelHeight || panelElement?.offsetHeight || 0
          : target === "text"
          ? style.textPanelHeight || panelElement?.offsetHeight || 0
          : target === "choices"
            ? style.choicesPanelHeight || panelElement?.offsetHeight || 0
            : 0,
      textOnly,
      startTextOffsetX:
        target === "title"
          ? style.titleTextOffsetX
          : target === "text"
            ? style.sceneTextOffsetX
            : target === "choices"
              ? style.choiceTextOffsetX
              : 0,
      startTextOffsetY:
        target === "title"
          ? style.titleTextOffsetY
          : target === "text"
            ? style.sceneTextOffsetY
            : target === "choices"
              ? style.choiceTextOffsetY
              : 0
    };
  }

  const imageFrameStyle: CSSProperties = {
    transform: `translate(${style.imageOffsetX / 3}px, ${
      style.imageOffsetY / 3
    }px) scale(${style.imageScale})`
  };
  const imageVisualStyle: CSSProperties = {
    clipPath: `inset(${style.imageCropTop}% ${style.imageCropRight}% ${style.imageCropBottom}% ${style.imageCropLeft}%)`,
    filter: `brightness(${style.imageBrightness})`,
    opacity: style.imageOpacity
  };
  const textTransform = `translate(${style.textOffsetX / 3}px, ${
    style.textOffsetY / 3
  }px) scale(${style.textScale})`;
  const titleTransform = `translate(-50%, 0) translate(${style.titleOffsetX / 3}px, ${
    style.titleOffsetY / 3
  }px) scale(${style.titleScale})`;
  const textLayerTransform = `translate(-50%, 0) translate(${style.textOffsetX / 3}px, ${
    style.textOffsetY / 3
  }px) scale(${style.textScale})`;
  const choicesTransform = `translate(-50%, 0) translate(${style.choicesOffsetX / 3}px, ${
    style.choicesOffsetY / 3
  }px) scale(${style.choicesScale})`;
  const effectivePreviewLayout =
    scene.layoutType === "noImage" || scene.imagePath.trim() === ""
      ? "noImage"
      : scene.layoutType;
  const titlePanelVisual = getPanelVisualStyle({
    transparent: style.titlePanelTransparent || style.titlePanelOpacity <= 0,
    color: style.titlePanelColor || "#fffdfa",
    borderColor: style.titleBorderColor || "#a48d69",
    borderEnabled: style.titleBorderEnabled,
    opacity: style.titlePanelOpacity
  });
  const textPanelVisual = getPanelVisualStyle({
    transparent: style.textPanelTransparent || style.textPanelOpacity <= 0,
    color: style.textPanelColor || "#fffdfa",
    borderColor: style.textBorderColor || "#a48d69",
    borderEnabled: style.textBorderEnabled,
    opacity: style.textPanelOpacity
  });
  const choicesPanelVisual = getPanelVisualStyle({
    transparent: style.choicesPanelTransparent || style.choicesPanelOpacity <= 0,
    color: style.choicesPanelColor || "#fffaf1",
    borderColor: style.choicesBorderColor || "#807058",
    borderEnabled: style.choicesBorderEnabled,
    opacity: style.choicesPanelOpacity
  });
  const choicesAreTransparent = style.choicesPanelTransparent || style.choicesPanelOpacity <= 0;

  return (
    <div className={`scene-visual-controls ${fullSize ? "scene-visual-controls-full" : ""}`}>
      <div
        className={`${
          fullSize ? "scene-live-preview-phone" : "scene-mini-preview"
        } scene-preview-layout-${effectivePreviewLayout} scene-ornament-${style.ornamentStyle}`}
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        style={{
          background: style.backgroundColor || projectTheme.backgroundColor,
          color: style.textColor || projectTheme.textColor
        }}
      >
        {scene.imagePath.trim() !== "" && effectivePreviewLayout !== "noImage" && (
          <div
            className={`scene-preview-editable scene-preview-image-editable ${
              fullSize ? "is-editable" : ""
            } ${activeTarget === "image" ? "is-active" : ""}`}
            style={imageFrameStyle}
            onMouseDown={(event) => startPreviewDrag("image", "move", event)}
          >
            {scene.visualMediaType === "image" ? (
              <AnimatedSceneImage
                imagePath={scene.imagePath}
                animation={getActiveSceneImageVariant(scene)?.animation ?? null}
                className="scene-preview-image"
                style={imageVisualStyle}
              />
            ) : (
              <InspectorVisualPreview
                mediaPath={scene.imagePath}
                mediaType={scene.visualMediaType}
                videoLoop={scene.videoLoop}
                className="scene-preview-image"
                style={imageVisualStyle}
                fallback={null}
              />
            )}
            {fullSize && (
              <>
                {renderMoveHandle("image")}
                {renderResizeHandles("image")}
              </>
            )}
          </div>
        )}
        {style.showSceneTitle && <section
          className={`scene-preview-title-panel scene-preview-editable ${
            fullSize ? "is-editable" : ""
          } ${activeTarget === "title" ? "is-active" : ""} ${
            style.titlePanelTransparent || style.titlePanelOpacity <= 0
              ? "is-transparent-panel"
              : ""
          } ${
            style.titleBorderEnabled && style.ornamentStyle !== "none"
              ? "scene-ornament-panel"
              : ""
          }`}
          onMouseDown={(event) => startPreviewDrag("title", "move", event)}
          style={{
            ...titlePanelVisual,
            color: style.titleTextColor || style.textColor || projectTheme.textColor,
            fontFamily: getPreviewFontFamily(style.textFontFamily),
            width:
              style.titlePanelWidth > 0 ? `${style.titlePanelWidth}px` : undefined,
            height:
              style.titlePanelHeight > 0 ? `${style.titlePanelHeight}px` : undefined,
            padding: `${style.titlePaddingTop}px ${style.titlePaddingSide}px`,
            transform: titleTransform
          }}
        >
          {fullSize && renderMoveHandle("title")}
          {fullSize ? (
            <textarea
              className="scene-preview-title-input"
              value={scene.title}
              placeholder=""
              rows={getTitleTextRows(scene.title)}
              style={{
                fontSize: `${style.titleFontSize}px`,
                textAlign: style.textAlign,
                height: style.titlePanelHeight > 0 ? "100%" : undefined,
                transform: `translate(${style.titleTextOffsetX / 3}px, ${style.titleTextOffsetY / 3}px)`
              }}
              onChange={(event) =>
                onUpdateScene((currentScene) => ({
                  ...currentScene,
                  title: event.target.value
                }))
              }
              onFocus={() => setActiveTarget("title")}
            />
          ) : (
            <strong style={{ fontSize: `${style.titleFontSize}px`, textAlign: style.textAlign }}>
              {scene.title}
            </strong>
          )}
          {fullSize && (
            <>
              {renderResizeHandles("title")}
            </>
          )}
        </section>}
        <section
          className={`scene-preview-text-panel scene-preview-editable ${
            fullSize ? "is-editable" : ""
          } ${activeTarget === "text" ? "is-active" : ""} ${
            style.textPanelTransparent || style.textPanelOpacity <= 0
              ? "is-transparent-panel"
              : ""
          } ${
            style.textBorderEnabled && style.ornamentStyle !== "none"
              ? "scene-ornament-panel"
              : ""
          }`}
          onMouseDown={(event) => startPreviewDrag("text", "move", event)}
          style={{
            ...textPanelVisual,
            color: style.textColor || projectTheme.textColor,
            fontFamily: getPreviewFontFamily(style.textFontFamily),
            fontSize: `${style.textFontSize}px`,
            width: style.textPanelWidth > 0 ? `${style.textPanelWidth}px` : undefined,
            height: style.textPanelHeight > 0 ? `${style.textPanelHeight}px` : undefined,
            padding: `${style.textPaddingTop}px ${style.textPaddingSide}px`,
            transform: textLayerTransform
          }}
        >
          {fullSize && renderMoveHandle("text")}
          {fullSize ? (
              <textarea
                className="scene-preview-text-input"
                value={scene.text}
                placeholder=""
                rows={getSceneTextRows(scene.text)}
                style={{
                  textAlign: style.textAlign,
                  height: style.textPanelHeight > 0 ? "100%" : undefined,
                  transform: `translate(${style.sceneTextOffsetX / 3}px, ${style.sceneTextOffsetY / 3}px)`
                }}
                onChange={(event) =>
                  onUpdateScene((currentScene) => ({
                    ...currentScene,
                    text: event.target.value
                  }))
                }
                onFocus={() => setActiveTarget("text")}
              />
          ) : (
              <p style={{ textAlign: style.textAlign }}>
                {scene.text}
              </p>
          )}
          {fullSize && (
            <>
              {renderResizeHandles("text")}
            </>
          )}
        </section>
        <div
          className={`scene-mini-choice scene-preview-editable ${
            fullSize ? "is-editable" : ""
          } ${activeTarget === "choices" ? "is-active" : ""} ${
            choicesAreTransparent ? "choices-transparent" : ""
          } ${choicesAreTransparent ? "is-transparent-panel" : ""} ${
            style.choicesPanelHeight > 0 ? "has-fixed-height" : ""
          }`}
          style={{
            width: style.choicesPanelWidth > 0 ? `${style.choicesPanelWidth}px` : undefined,
            minHeight:
              style.choicesPanelHeight > 0 ? `${style.choicesPanelHeight}px` : undefined,
            color: style.choicesTextColor || undefined,
            fontSize: `${style.choicesFontSize}px`,
            fontFamily: getPreviewFontFamily(style.choicesFontFamily),
            transform: choicesTransform
          }}
          onMouseDown={(event) => startPreviewDrag("choices", "move", event)}
        >
          {fullSize && renderMoveHandle("choices")}
          <div className="scene-preview-choice-list">
            {scene.choices.length > 0 && (
              scene.choices.map((choice, choiceIndex) =>
                fullSize ? (
                  <div
                    key={choice.id}
                    className={`choice-preview-frame ${
                      style.choicesBorderEnabled && style.ornamentStyle !== "none"
                        ? "scene-ornament-panel"
                        : ""
                    }`}
                    style={{
                      ...choicesPanelVisual,
                      ...(choicesAreTransparent
                        ? {
                            background: "transparent",
                            borderColor: "transparent",
                            boxShadow: "none"
                          }
                        : {}),
                      ...getChoiceButtonFrameStyle(
                        style.choicesFrameStyle,
                        style.choicesPanelTransparent ? 0 : style.choicesPanelOpacity
                      ),
                      padding: `${style.choicesPaddingTop}px ${style.choicesPaddingSide}px`
                    }}
                  >
                    <textarea
                      className="choice-preview-input choice-preview-text-layer"
                      value={choice.text}
                      placeholder=""
                      rows={getChoicePreviewRows(choice.text)}
                      style={{
                        color: style.choicesTextColor || undefined,
                        fontSize: `${style.choicesFontSize}px`,
                        fontFamily: getPreviewFontFamily(style.choicesFontFamily),
                        transform: `translate(${style.choiceTextOffsetX / 3}px, ${style.choiceTextOffsetY / 3}px)`
                      }}
                      onChange={(event) =>
                        onUpdateScene((currentScene) => ({
                          ...currentScene,
                          choices: currentScene.choices.map((currentChoice) =>
                            currentChoice.id === choice.id
                              ? { ...currentChoice, text: event.target.value }
                              : currentChoice
                          )
                        }))
                      }
                      onFocus={() => setActiveTarget("choices")}
                      onMouseDown={(event) => startPreviewDrag("choices", "move", event)}
                    />
                  </div>
                ) : (
                  <span
                    key={choice.id}
                    style={{
                      transform: `translate(${style.choiceTextOffsetX / 3}px, ${style.choiceTextOffsetY / 3}px)`
                    }}
                  >
                    {choice.text}
                  </span>
                )
              )
            )}
          </div>
          {fullSize && (
            <>
              {renderResizeHandles("choices")}
            </>
          )}
        </div>
      </div>
      <div className="scene-preview-settings">
      {fullSize && (
        <div className="scene-layout-template-tools">
          <label className="field-label">
            Layout Type
            <select
              value={scene.layoutType}
              onChange={(event) =>
                onUpdateScene((currentScene) => ({
                  ...currentScene,
                  layoutType: event.target.value as SceneLayoutType
                }))
              }
            >
              {SCENE_LAYOUT_OPTIONS.map((layout) => (
                <option key={layout.value} value={layout.value}>
                  {layout.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Scene transition
            <select
              value={style.sceneTransition}
              onChange={(event) =>
                patchStyle({
                  sceneTransition: event.target.value as SceneTransitionOverride
                })
              }
            >
              <option value="project">Use Project Settings default</option>
              {SCENE_TRANSITION_OPTIONS.map((transition) => (
                <option key={transition.value} value={transition.value}>
                  {transition.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label scene-transition-speed-override">
            <span>
              Transition speed
              <strong>
                {style.sceneTransitionSpeed > 0
                  ? `${style.sceneTransitionSpeed.toFixed(1)}x`
                  : "Project default"}
              </strong>
            </span>
            <select
              value={style.sceneTransitionSpeed > 0 ? "scene" : "project"}
              onChange={(event) =>
                patchStyle({
                  sceneTransitionSpeed:
                    event.target.value === "scene" ? 1 : 0
                })
              }
            >
              <option value="project">Use Project Settings speed</option>
              <option value="scene">Set speed for this scene</option>
            </select>
            {style.sceneTransitionSpeed > 0 && (
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={style.sceneTransitionSpeed}
                onChange={(event) =>
                  patchStyle({ sceneTransitionSpeed: Number(event.target.value) })
                }
                aria-label="Transition speed for this scene"
              />
            )}
          </label>
          <details className="scene-layout-details color-scheme-details">
            <summary>Color schemes</summary>
            <div className="color-scheme-tabs" role="tablist" aria-label="Color scheme type">
              <button
                type="button"
                role="tab"
                aria-selected={colorSchemeTab === "solid"}
                className={colorSchemeTab === "solid" ? "active" : ""}
                onClick={() => setColorSchemeTab("solid")}
              >
                Solid
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={colorSchemeTab === "gradient"}
                className={colorSchemeTab === "gradient" ? "active" : ""}
                onClick={() => setColorSchemeTab("gradient")}
              >
                Gradients
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={colorSchemeTab === "ornate"}
                className={colorSchemeTab === "ornate" ? "active" : ""}
                onClick={() => setColorSchemeTab("ornate")}
              >
                Ornate
              </button>
            </div>
            <div className="color-scheme-grid">
              {(colorSchemeTab === "solid"
                ? COLOR_SCHEME_PRESETS
                : colorSchemeTab === "gradient"
                  ? GRADIENT_COLOR_SCHEME_PRESETS
                  : ORNATE_COLOR_SCHEME_PRESETS
              ).map((preset) => (
                <button
                  type="button"
                  key={preset.name}
                  className="color-scheme-button"
                  onClick={() =>
                    patchStyle({
                      ...preset.colors,
                      ornamentStyle:
                        colorSchemeTab === "ornate"
                          ? preset.colors.ornamentStyle ?? "none"
                          : "none"
                    })
                  }
                  title={`Apply ${preset.name}`}
                >
                  <span
                    className="color-scheme-swatch"
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
          </details>
          <details className="scene-layout-details user-template-details">
            <summary>User templates</summary>
            <div className="user-template-grid">
              {userTemplates.map((template, index) => (
                <div className="user-template-slot" key={`template_${index + 1}`}>
                  {template ? (
                    <input
                      value={templateNameDrafts[index] ?? template.name}
                      aria-label={`Template ${index + 1} name`}
                      onChange={(event) =>
                        renameUserTemplate(index, event.target.value)
                      }
                    />
                  ) : (
                    <strong>{`Slot ${index + 1}`}</strong>
                  )}
                  <div>
                    <button
                      type="button"
                      onClick={() => saveUserTemplate(index)}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      disabled={!template}
                      onClick={() => applyUserTemplate(index)}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      disabled={!template}
                      onClick={() => clearUserTemplate(index)}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
      {fullSize && (
        <div className="scene-layout-target-tabs" aria-label="Selected layout element">
          {(["image", "title", "text", "choices"] as PreviewTarget[]).map((target) => (
            <button
              type="button"
              key={target}
              className={activeTarget === target ? "active" : ""}
              onClick={() => setActiveTarget(target)}
              disabled={
                target === "image" &&
                (scene.imagePath.trim() === "" || effectivePreviewLayout === "noImage")
              }
            >
              {target === "image"
                ? "Image"
                : target === "title"
                  ? "Title"
                  : target === "text"
                    ? "Scene text"
                    : "Choices"}
            </button>
          ))}
        </div>
      )}
      <details className="scene-layout-details scene-layout-colors">
        <summary>Scene colors</summary>
        <div className="color-field-grid">
          <ColorControl
            label="Scene background"
            value={style.backgroundColor}
            fallback={projectTheme.backgroundColor}
            onChange={(backgroundColor) => patchStyle({ backgroundColor })}
          />
          <ColorControl
            label="Scene text"
            value={style.textColor}
            fallback={projectTheme.textColor}
            onChange={(textColor) => patchStyle({ textColor })}
          />
          <ColorControl
            label="Text panel"
            value={style.textPanelColor}
            fallback="#fffdfa"
            onChange={(textPanelColor) => patchStyle({ textPanelColor })}
          />
          <ColorControl
            label="Text border"
            value={style.textBorderColor}
            fallback="#a48d69"
            onChange={(textBorderColor) => patchStyle({ textBorderColor })}
          />
        </div>
      </details>
      {activeTarget === "image" && (
        <details className="transform-controls scene-layout-details is-active-control" open>
          <summary>Image crop and position</summary>
          <p className="panel-help">
            Drag the image in the phone. Use the handles or scale slider to crop manually.
          </p>
          <TransformControls
            title="Image"
            x={style.imageOffsetX}
            y={style.imageOffsetY}
            scale={style.imageScale}
            onChange={(patch) => patchStyle(prefixPatch("image", patch))}
            minScale={0.1}
            maxScale={4}
          />
          <label className="field-label">
            Image opacity
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={style.imageOpacity}
              onChange={(event) =>
                patchStyle({ imageOpacity: readNumberInput(event.target.value) })
              }
            />
            <small>{Math.round(style.imageOpacity * 100)}%</small>
          </label>
          <label className="field-label">
            Image brightness
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={style.imageBrightness}
              onChange={(event) =>
                patchStyle({ imageBrightness: readNumberInput(event.target.value) })
              }
            />
            <small>{Math.round(style.imageBrightness * 100)}%</small>
          </label>
          <div className="transform-controls scene-layout-transform-group">
            <h4>Crop</h4>
            <CropSlider
              label="Top"
              value={style.imageCropTop}
              onChange={(imageCropTop) => patchStyle({ imageCropTop })}
            />
            <CropSlider
              label="Right"
              value={style.imageCropRight}
              onChange={(imageCropRight) => patchStyle({ imageCropRight })}
            />
            <CropSlider
              label="Bottom"
              value={style.imageCropBottom}
              onChange={(imageCropBottom) => patchStyle({ imageCropBottom })}
            />
            <CropSlider
              label="Left"
              value={style.imageCropLeft}
              onChange={(imageCropLeft) => patchStyle({ imageCropLeft })}
            />
          </div>
        </details>
      )}
      {activeTarget === "title" && (
      <details className="transform-controls scene-layout-details is-active-control" open>
        <summary>Title style</summary>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={style.showSceneTitle}
            onChange={(event) => patchStyle({ showSceneTitle: event.target.checked })}
          />
          Show scene title
        </label>
        <label className="field-label">
          Font
          <select
            value={style.textFontFamily}
            onChange={(event) => patchStyle({ textFontFamily: event.target.value })}
          >
            <option value="system">Clean UI</option>
            <option value="serif">Book Serif</option>
            <option value="mono">Mono</option>
          </select>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={style.titleBorderEnabled}
            onChange={(event) => patchStyle({ titleBorderEnabled: event.target.checked })}
          />
          Show title border
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={style.titlePanelTransparent}
            onChange={(event) =>
              patchStyle({ titlePanelTransparent: event.target.checked })
            }
          />
          Transparent title cell
        </label>
        <label className="field-label">
          Title cell opacity
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={style.titlePanelTransparent ? 0 : style.titlePanelOpacity}
            onChange={(event) =>
              patchStyle({
                titlePanelOpacity: readNumberInput(event.target.value),
                titlePanelTransparent: readNumberInput(event.target.value) <= 0
              })
            }
          />
          <small>{Math.round((style.titlePanelTransparent ? 0 : style.titlePanelOpacity) * 100)}%</small>
        </label>
        <div className="color-field-grid">
          <ColorControl
            label="Title panel"
            value={style.titlePanelColor}
            fallback="#fffdfa"
            onChange={(titlePanelColor) => patchStyle({ titlePanelColor })}
          />
          <ColorControl
            label="Title border"
            value={style.titleBorderColor}
            fallback="#a48d69"
            onChange={(titleBorderColor) => patchStyle({ titleBorderColor })}
          />
          <ColorControl
            label="Title text"
            value={style.titleTextColor}
            fallback={style.textColor || projectTheme.textColor}
            onChange={(titleTextColor) => patchStyle({ titleTextColor })}
          />
        </div>
        <label className="field-label">
          Title size
          <input
            type="range"
            min="14"
            max="38"
            step="1"
            value={style.titleFontSize}
            onChange={(event) =>
              patchStyle({ titleFontSize: readNumberInput(event.target.value) })
            }
          />
          <small>{style.titleFontSize}px</small>
        </label>
        <PaddingControls
          label="Title padding"
          top={style.titlePaddingTop}
          side={style.titlePaddingSide}
          onChange={(patch) => patchStyle(patch)}
          topKey="titlePaddingTop"
          sideKey="titlePaddingSide"
        />
        <label className="field-label">
          Title panel width
          <input
            type="range"
            min="0"
            max="390"
            step="1"
            value={style.titlePanelWidth}
            onChange={(event) =>
              patchStyle({ titlePanelWidth: readNumberInput(event.target.value) })
            }
          />
          <small>
            {style.titlePanelWidth === 0 ? "Auto" : `${style.titlePanelWidth}px`}
          </small>
        </label>
        <label className="field-label">
          Title panel height
          <input
            type="range"
            min="0"
            max="240"
            step="1"
            value={style.titlePanelHeight}
            onChange={(event) =>
              patchStyle({ titlePanelHeight: readNumberInput(event.target.value) })
            }
          />
          <small>
            {style.titlePanelHeight === 0 ? "Auto" : `${style.titlePanelHeight}px`}
          </small>
        </label>
        <TransformControls
          title="Title position"
          x={style.titleOffsetX}
          y={style.titleOffsetY}
          scale={style.titleScale}
          width={style.titlePanelWidth}
          height={style.titlePanelHeight}
          onChange={(patch) => patchStyle(prefixPatch("title", patch))}
          onSizeChange={(patch) =>
            patchStyle({
              ...(patch.width !== undefined ? { titlePanelWidth: patch.width } : {}),
              ...(patch.height !== undefined ? { titlePanelHeight: patch.height } : {})
            })
          }
          maxHeight={260}
        />
      </details>
      )}
      {activeTarget === "text" && (
      <details className="transform-controls scene-layout-details is-active-control" open>
        <summary>Text style</summary>
        <label className="field-label">
          Scene text font
          <select
            value={style.textFontFamily}
            onChange={(event) => patchStyle({ textFontFamily: event.target.value })}
          >
            {FONT_FAMILY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={style.textBorderEnabled}
            onChange={(event) => patchStyle({ textBorderEnabled: event.target.checked })}
          />
          Show text border
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={style.textPanelTransparent}
            onChange={(event) =>
              patchStyle({ textPanelTransparent: event.target.checked })
            }
          />
          Transparent text cell
        </label>
        <label className="field-label">
          Text cell opacity
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={style.textPanelTransparent ? 0 : style.textPanelOpacity}
            onChange={(event) =>
              patchStyle({
                textPanelOpacity: readNumberInput(event.target.value),
                textPanelTransparent: readNumberInput(event.target.value) <= 0
              })
            }
          />
          <small>{Math.round((style.textPanelTransparent ? 0 : style.textPanelOpacity) * 100)}%</small>
        </label>
        <div className="color-field-grid">
          <ColorControl
            label="Text panel"
            value={style.textPanelColor}
            fallback="#fffdfa"
            onChange={(textPanelColor) => patchStyle({ textPanelColor })}
          />
          <ColorControl
            label="Text border"
            value={style.textBorderColor}
            fallback="#a48d69"
            onChange={(textBorderColor) => patchStyle({ textBorderColor })}
          />
          <ColorControl
            label="Text"
            value={style.textColor}
            fallback={projectTheme.textColor}
            onChange={(textColor) => patchStyle({ textColor })}
          />
        </div>
        <label className="field-label">
          Body text size
          <input
            type="range"
            min="12"
            max="28"
            step="1"
            value={style.textFontSize}
            onChange={(event) =>
              patchStyle({ textFontSize: readNumberInput(event.target.value) })
            }
          />
          <small>{style.textFontSize}px</small>
        </label>
        <PaddingControls
          label="Text padding"
          top={style.textPaddingTop}
          side={style.textPaddingSide}
          onChange={(patch) => patchStyle(patch)}
          topKey="textPaddingTop"
          sideKey="textPaddingSide"
        />
        <label className="field-label">
          Text panel width
          <input
            type="range"
            min="0"
            max="390"
            step="1"
            value={style.textPanelWidth}
            onChange={(event) =>
              patchStyle({ textPanelWidth: readNumberInput(event.target.value) })
            }
          />
          <small>{style.textPanelWidth === 0 ? "Auto" : `${style.textPanelWidth}px`}</small>
        </label>
        <label className="field-label">
          Text panel height
          <input
            type="range"
            min="0"
            max="420"
            step="1"
            value={style.textPanelHeight}
            onChange={(event) =>
              patchStyle({ textPanelHeight: readNumberInput(event.target.value) })
            }
          />
          <small>{style.textPanelHeight === 0 ? "Auto" : `${style.textPanelHeight}px`}</small>
        </label>
        <div className="segmented-control">
          <button
            type="button"
            className={style.textAlign === "left" ? "active" : ""}
            onClick={() => patchStyle({ textAlign: "left" })}
          >
            Left
          </button>
          <button
            type="button"
            className={style.textAlign === "center" ? "active" : ""}
            onClick={() => patchStyle({ textAlign: "center" })}
          >
            Center
          </button>
        </div>
        <TransformControls
          title="Text position"
          x={style.textOffsetX}
          y={style.textOffsetY}
          scale={style.textScale}
          width={style.textPanelWidth}
          height={style.textPanelHeight}
          onChange={(patch) => patchStyle(prefixPatch("text", patch))}
          onSizeChange={(patch) =>
            patchStyle({
              ...(patch.width !== undefined ? { textPanelWidth: patch.width } : {}),
              ...(patch.height !== undefined ? { textPanelHeight: patch.height } : {})
            })
          }
          maxHeight={620}
        />
      </details>
      )}
      {activeTarget === "choices" && (
      <details className="transform-controls scene-layout-details is-active-control" open>
        <summary>Choice style</summary>
        <label className="field-label">
          Choice text font
          <select
            value={style.choicesFontFamily}
            onChange={(event) => patchStyle({ choicesFontFamily: event.target.value })}
          >
            {FONT_FAMILY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={style.choicesBorderEnabled}
            onChange={(event) => patchStyle({ choicesBorderEnabled: event.target.checked })}
          />
          Show choice border
        </label>
        <details className="choice-frame-details">
          <summary>Choice button styles</summary>
          <div className="choice-frame-grid">
            <button
              type="button"
              className={`choice-frame-option choice-frame-none ${
                style.choicesFrameStyle === "none" ? "active" : ""
              }`}
              onClick={() => patchStyle({ choicesFrameStyle: "none" })}
            >
              No frame
            </button>
            {CHOICE_BUTTON_FRAMES.map((frame, index) => (
              <button
                type="button"
                key={frame.id}
                className={`choice-frame-option ${
                  style.choicesFrameStyle === frame.id ? "active" : ""
                }`}
                style={getChoiceButtonFrameStyle(frame.id)}
                onClick={() => patchStyle({ choicesFrameStyle: frame.id })}
                aria-label={frame.label}
                title={frame.label}
              >
                <span>{index + 1}</span>
              </button>
            ))}
          </div>
        </details>
        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={style.choicesPanelTransparent}
            onChange={(event) =>
              patchStyle({ choicesPanelTransparent: event.target.checked })
            }
          />
          Transparent choice cell
        </label>
        <label className="field-label">
          Choice cell opacity
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={style.choicesPanelTransparent ? 0 : style.choicesPanelOpacity}
            onChange={(event) =>
              patchStyle({
                choicesPanelOpacity: readNumberInput(event.target.value),
                choicesPanelTransparent: readNumberInput(event.target.value) <= 0
              })
            }
          />
          <small>{Math.round((style.choicesPanelTransparent ? 0 : style.choicesPanelOpacity) * 100)}%</small>
        </label>
        <div className="color-field-grid">
          <ColorControl
            label="Choice panel"
            value={style.choicesPanelColor}
            fallback="#fffaf1"
            onChange={(choicesPanelColor) => patchStyle({ choicesPanelColor })}
          />
          <ColorControl
            label="Choice border"
            value={style.choicesBorderColor}
            fallback="#807058"
            onChange={(choicesBorderColor) => patchStyle({ choicesBorderColor })}
          />
          <ColorControl
            label="Choice text"
            value={style.choicesTextColor}
            fallback="#24231f"
            onChange={(choicesTextColor) => patchStyle({ choicesTextColor })}
          />
        </div>
        <label className="field-label">
          Choice text size
          <input
            type="range"
            min="11"
            max="26"
            step="1"
            value={style.choicesFontSize}
            onChange={(event) =>
              patchStyle({ choicesFontSize: readNumberInput(event.target.value) })
            }
          />
          <small>{style.choicesFontSize}px</small>
        </label>
        <PaddingControls
          label="Choice padding"
          top={style.choicesPaddingTop}
          side={style.choicesPaddingSide}
          onChange={(patch) => patchStyle(patch)}
          topKey="choicesPaddingTop"
          sideKey="choicesPaddingSide"
        />
        <label className="field-label">
          Choice panel width
          <input
            type="range"
            min="0"
            max="390"
            step="1"
            value={style.choicesPanelWidth}
            onChange={(event) =>
              patchStyle({ choicesPanelWidth: readNumberInput(event.target.value) })
            }
          />
          <small>
            {style.choicesPanelWidth === 0 ? "Auto" : `${style.choicesPanelWidth}px`}
          </small>
        </label>
        <label className="field-label">
          Choice panel height
          <input
            type="range"
            min={MIN_CHOICES_PANEL_HEIGHT}
            max="420"
            step="1"
            value={style.choicesPanelHeight}
            onChange={(event) =>
              patchStyle({ choicesPanelHeight: readNumberInput(event.target.value) })
            }
          />
          <small>
            {style.choicesPanelHeight === 0
              ? "Auto"
              : `${style.choicesPanelHeight}px`}
          </small>
        </label>
        <TransformControls
          title="Choices position"
          x={style.choicesOffsetX}
          y={style.choicesOffsetY}
          scale={style.choicesScale}
          width={style.choicesPanelWidth}
          height={style.choicesPanelHeight}
          onChange={(patch) => patchStyle(prefixPatch("choices", patch))}
          onSizeChange={(patch) =>
            patchStyle({
              ...(patch.width !== undefined ? { choicesPanelWidth: patch.width } : {}),
              ...(patch.height !== undefined ? { choicesPanelHeight: patch.height } : {})
            })
          }
          minHeight={MIN_CHOICES_PANEL_HEIGHT}
          maxHeight={620}
        />
      </details>
      )}
      </div>
    </div>
  );

  function renderResizeHandles(target: PreviewTarget) {
    return (
      <>
        <span
          className="preview-resize-handle preview-resize-top"
          onMouseDown={(event) => startPreviewDrag(target, "resizeTop", event)}
        />
        <span
          className="preview-resize-handle preview-resize-right"
          onMouseDown={(event) => startPreviewDrag(target, "resizeRight", event)}
        />
        <span
          className="preview-resize-handle preview-resize-bottom"
          onMouseDown={(event) => startPreviewDrag(target, "resizeBottom", event)}
        />
        <span
          className="preview-resize-handle preview-resize-left"
          onMouseDown={(event) => startPreviewDrag(target, "resizeLeft", event)}
        />
        <span
          className="preview-resize-handle preview-resize-top-left"
          onMouseDown={(event) => startPreviewDrag(target, "resizeTopLeft", event)}
        />
        <span
          className="preview-resize-handle preview-resize-top-right"
          onMouseDown={(event) => startPreviewDrag(target, "resizeTopRight", event)}
        />
        <span
          className="preview-resize-handle preview-resize-bottom-left"
          onMouseDown={(event) => startPreviewDrag(target, "resizeBottomLeft", event)}
        />
        <span
          className="preview-resize-handle preview-resize-bottom-right"
          onMouseDown={(event) => startPreviewDrag(target, "resizeBottomRight", event)}
        />
      </>
    );
  }

  function renderMoveHandle(target: PreviewTarget) {
    return (
      <span
        className="preview-move-handle"
        title="Move"
        aria-hidden="true"
        onMouseDown={(event) => startPreviewDrag(target, "move", event)}
      >
        +
      </span>
    );
  }

  function saveUserTemplate(index: number) {
    const nextTemplates = [...userTemplates];
    const existingName = templateNameDrafts[index]?.trim();
    nextTemplates[index] = {
      name:
        existingName && existingName !== `Slot ${index + 1}`
          ? existingName
          : `Slot ${index + 1}: ${getLayoutLabel(scene.layoutType)}`,
      layoutType: scene.layoutType,
      style: { ...scene.style }
    };
    setUserTemplates(nextTemplates);
    setTemplateNameDrafts((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) =>
        draftIndex === index ? nextTemplates[index]?.name ?? draft : draft
      )
    );
    writeUserLayoutTemplates(nextTemplates);
  }

  function applyUserTemplate(index: number) {
    const template = userTemplates[index];
    if (!template) {
      return;
    }

    onUpdateScene((currentScene) => ({
      ...currentScene,
      layoutType: template.layoutType,
      style: { ...template.style }
    }));
  }

  function clearUserTemplate(index: number) {
    const nextTemplates = [...userTemplates];
    nextTemplates[index] = null;
    setUserTemplates(nextTemplates);
    setTemplateNameDrafts((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) =>
        draftIndex === index ? `Slot ${index + 1}` : draft
      )
    );
    writeUserLayoutTemplates(nextTemplates);
  }

  function renameUserTemplate(index: number, name: string) {
    const template = userTemplates[index];
    setTemplateNameDrafts((currentDrafts) =>
      currentDrafts.map((draft, draftIndex) =>
        draftIndex === index ? name : draft
      )
    );

    if (!template) {
      return;
    }

    const nextTemplates = [...userTemplates];
    nextTemplates[index] = {
      ...template,
      name
    };
    setUserTemplates(nextTemplates);
    writeUserLayoutTemplates(nextTemplates);
  }
}

function createLayoutSceneStyle(layoutType: SceneLayoutType): SceneStyle {
  const base = createDefaultSceneStyle();
  const storyBase: SceneStyle = {
    ...base,
    backgroundColor: "#11100d",
    textColor: "#f7ead2",
    titlePanelColor: "#11100d",
    titleBorderColor: "#c99b48",
    titleTextColor: "#f0c77b",
    textPanelColor: "#11100d",
    textBorderColor: "#c99b48",
    choicesPanelColor: "#11100d",
    choicesBorderColor: "#d6a84f",
    choicesTextColor: "#f7ead2",
    titlePanelWidth: 330,
    textPanelWidth: 330,
    choicesPanelWidth: 318,
    titlePanelHeight: 0,
    textPanelHeight: 0,
    choicesPanelHeight: 0,
    titleFontSize: 22,
    textFontSize: 15,
    choicesFontSize: 15,
    textFontFamily: "serif",
    textAlign: "left",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    titleOffsetX: 0,
    titleOffsetY: 0,
    titleScale: 1,
    textOffsetX: 0,
    textOffsetY: 0,
    textScale: 1,
    choicesOffsetX: 0,
    choicesOffsetY: 0,
    choicesScale: 1,
    titlePanelOpacity: 0,
    textPanelOpacity: 0.72,
    choicesPanelOpacity: 0.5
  };

  if (layoutType === "imageBackground") {
    return {
      ...storyBase,
      imageScale: 1.06,
      titleOffsetY: -8,
      textPanelOpacity: 0.76,
      choicesPanelOpacity: 0.56
    };
  }

  if (layoutType === "dialogueStyle") {
    return {
      ...storyBase,
      backgroundColor: "#100e0b",
      titleTextColor: "#d9ad62",
      imageScale: 1.03,
      titlePanelOpacity: 0,
      textPanelOpacity: 0.82,
      textPanelColor: "#130f0b",
      choicesPanelOpacity: 0.52,
      textOffsetY: 12
    };
  }

  if (layoutType === "textFirst") {
    return {
      ...storyBase,
      backgroundColor: "#171714",
      imageScale: 0.96,
      titlePanelOpacity: 0,
      textPanelOpacity: 0.72,
      choicesPanelOpacity: 0.5,
      textOffsetY: -8
    };
  }

  if (layoutType === "splitLayout") {
    return {
      ...storyBase,
      backgroundColor: "#1a140d",
      textColor: "#2a2116",
      titleTextColor: "#d19a45",
      imageOffsetY: -72,
      imageScale: 0.68,
      titlePanelOpacity: 0,
      textPanelOpacity: 0.9,
      choicesPanelOpacity: 0.68,
      textPanelColor: "#ead6ad",
      textBorderColor: "#7f5720",
      choicesPanelColor: "#ead6ad",
      choicesBorderColor: "#7f5720",
      choicesTextColor: "#2a2116",
      textOffsetY: 18
    };
  }

  if (layoutType === "fullImageMoment") {
    return {
      ...storyBase,
      imageScale: 1.1,
      titlePanelOpacity: 0,
      textPanelOpacity: 0,
      choicesPanelOpacity: 0.42,
      choicesBorderColor: "#f1d18a",
      textAlign: "center",
      textOffsetY: -30,
      choicesOffsetY: 12
    };
  }

  if (layoutType === "noImage") {
    return {
      ...storyBase,
      backgroundColor: "linear-gradient(180deg, #11100d 0%, #2a2116 100%)",
      titlePanelOpacity: 0,
      textPanelOpacity: 0,
      choicesPanelOpacity: 0.36,
      choicesBorderColor: "#f1d18a",
      textAlign: "center",
      textOffsetY: -18
    };
  }

  return {
    ...storyBase,
    imageOffsetY: -92,
    imageScale: 0.74,
    textOffsetY: 10,
    choicesOffsetY: 6
  };
}

function readUserLayoutTemplates(): Array<UserLayoutTemplate | null> {
  const emptyTemplates = Array.from<UserLayoutTemplate | null>(
    { length: USER_LAYOUT_TEMPLATE_COUNT },
    () => null
  );

  try {
    const rawTemplates = localStorage.getItem(USER_LAYOUT_TEMPLATE_KEY);
    if (!rawTemplates) {
      return emptyTemplates;
    }

    const parsed = JSON.parse(rawTemplates) as Array<UserLayoutTemplate | null>;
    return emptyTemplates.map((_, index) => {
      const template = parsed[index];
      if (!template || !isSceneLayoutType(template.layoutType)) {
        return null;
      }

      return {
        name:
          typeof template.name === "string" && template.name.trim() !== ""
            ? template.name
            : `Slot ${index + 1}: ${getLayoutLabel(template.layoutType)}`,
        layoutType: template.layoutType,
        style: {
          ...createLayoutSceneStyle(template.layoutType),
          ...template.style
        }
      };
    });
  } catch {
    return emptyTemplates;
  }
}

function writeUserLayoutTemplates(templates: Array<UserLayoutTemplate | null>) {
  localStorage.setItem(
    USER_LAYOUT_TEMPLATE_KEY,
    JSON.stringify(templates.slice(0, USER_LAYOUT_TEMPLATE_COUNT))
  );
}

function isSceneLayoutType(value: unknown): value is SceneLayoutType {
  return (
    typeof value === "string" &&
    SCENE_LAYOUT_OPTIONS.some((layout) => layout.value === value)
  );
}

function getLayoutLabel(layoutType: SceneLayoutType): string {
  return (
    SCENE_LAYOUT_OPTIONS.find((layout) => layout.value === layoutType)?.label ??
    layoutType
  );
}

interface ScenePreviewModalProps {
  scene: Scene;
  scenes: Scene[];
  projectTheme: ProjectTheme;
  onUpdateScene: (updater: (scene: Scene) => Scene) => void;
  onSelectScene: (sceneId: SceneId) => void;
  onApplySceneLayoutToAll: (scene: Scene) => void;
  onClose: () => void;
}

function ScenePreviewModal({
  scene,
  scenes,
  projectTheme,
  onUpdateScene,
  onSelectScene,
  onApplySceneLayoutToAll,
  onClose
}: ScenePreviewModalProps) {
  const [draftScene, setDraftScene] = useState(scene);
  const [saveMessage, setSaveMessage] = useState("");
  const draftSceneRef = useRef(scene);
  const sceneIndex = scenes.findIndex((item) => item.id === scene.id);
  const previousScene = sceneIndex > 0 ? scenes[sceneIndex - 1] : null;
  const nextScene = sceneIndex >= 0 && sceneIndex < scenes.length - 1
    ? scenes[sceneIndex + 1]
    : null;

  useEffect(() => {
    draftSceneRef.current = scene;
    setDraftScene(scene);
  }, [scene.id]);

  function updateDraftScene(updater: (scene: Scene) => Scene) {
    const nextScene = updater(draftSceneRef.current);
    draftSceneRef.current = nextScene;
    setDraftScene(nextScene);
    onUpdateScene(() => nextScene);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="scene-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Scene preview"
        onKeyDownCapture={stopEditableEventPropagation}
        onMouseDownCapture={stopEditableEventPropagation}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading scene-layout-modal-heading">
          <div className="scene-layout-heading-copy">
            <h2>Scene Layout</h2>
            <p>{draftScene.title || draftScene.id}</p>
            {saveMessage && <p className="helper-text">{saveMessage}</p>}
          </div>
          <div className="scene-layout-scene-navigation" role="group" aria-label="Scene navigation">
            <button
              type="button"
              className="scene-layout-scene-nav-button"
              aria-label="Previous scene"
              title="Previous scene"
              disabled={!previousScene}
              onClick={() => previousScene && onSelectScene(previousScene.id)}
            >
              <span aria-hidden="true">&lsaquo;</span>
            </button>
            <span className="scene-layout-scene-position" aria-live="polite">
              {sceneIndex >= 0 ? sceneIndex + 1 : 1} / {scenes.length}
            </span>
            <button
              type="button"
              className="scene-layout-scene-nav-button"
              aria-label="Next scene"
              title="Next scene"
              disabled={!nextScene}
              onClick={() => nextScene && onSelectScene(nextScene.id)}
            >
              <span aria-hidden="true">&rsaquo;</span>
            </button>
          </div>
          <div className="modal-heading-actions">
            <button
              type="button"
              disabled={
                draftScene.imagePath.trim() === "" ||
                draftScene.visualMediaType !== "image"
              }
              onClick={() => {
                setSaveMessage("");
                void savePicture(
                  draftScene.imagePath,
                  draftScene.title || draftScene.id
                )
                  .then((result) => {
                    if (result === "saved") setSaveMessage("Picture saved.");
                  })
                  .catch((error) =>
                    setSaveMessage(
                      error instanceof Error ? error.message : "Could not save picture."
                    )
                  );
              }}
            >
              Save Picture
            </button>
            <button
              type="button"
              onClick={() =>
                updateDraftScene((currentScene) => ({
                  ...currentScene,
                  style: createDefaultSceneStyle()
                }))
              }
            >
              Reset
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => onApplySceneLayoutToAll(draftSceneRef.current)}
            >
              Apply to all scenes
            </button>
            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <SceneVisualControls
          scene={draftScene}
          projectTheme={projectTheme}
          onUpdateScene={updateDraftScene}
          fullSize
        />
      </section>
    </div>
  );
}

function getPanelVisualStyle({
  transparent,
  color,
  borderColor,
  borderEnabled,
  opacity
}: {
  transparent: boolean;
  color: string;
  borderColor: string;
  borderEnabled: boolean;
  opacity: number;
}): CSSProperties {
  if (transparent || opacity <= 0) {
    return {
      background: "transparent",
      border: 0,
      boxShadow: "none",
      backdropFilter: "none"
    };
  }

  return {
    background: colorToRgba(color, opacity),
    ...(borderEnabled
      ? { borderColor: colorToRgba(borderColor, Math.min(1, Math.max(0.12, opacity))) }
      : { border: 0 }),
    boxShadow: opacity < 0.08 ? "none" : undefined,
    backdropFilter: "none"
  };
}

function colorToRgba(color: string, opacity: number): string {
  return applyColorOpacity(color, opacity);
}

function ColorControl({
  label,
  value,
  fallback,
  onChange
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const currentValue = value || fallback;
  const colorInputValue = isHexColor(currentValue) ? currentValue : fallback;
  const gradientParts = parseGradientValue(currentValue);
  const gradientValue =
    isGradientValue(currentValue) && GRADIENT_PRESETS.some((preset) => preset.value === currentValue)
      ? currentValue
      : "";
  const customGradient = gradientParts ?? {
    angle: "180deg",
    from: isHexColor(fallback) ? fallback : "#11100d",
    to: "#2a2116"
  };

  return (
    <label className="field-label">
      {label}
      <span
        className="color-swatch-preview"
        style={{ background: currentValue }}
        aria-hidden="true"
      />
      <input
        type="color"
        value={colorInputValue}
        onChange={(event) => onChange(event.target.value)}
      />
      <select
        className="gradient-select"
        value={gradientValue}
        onChange={(event) => {
          if (event.target.value === "") {
            onChange(fallback);
            return;
          }
          onChange(event.target.value);
        }}
      >
        <option value="">Solid color</option>
        {GRADIENT_PRESETS.map((preset) => (
          <option key={preset.label} value={preset.value}>
            {preset.label}
          </option>
        ))}
      </select>
      <div className="custom-gradient-control">
        <span>Custom gradient</span>
        <select
          value={customGradient.angle}
          onChange={(event) =>
            onChange(
              buildGradientValue({
                ...customGradient,
                angle: event.target.value
              })
            )
          }
        >
          <option value="180deg">Top to bottom</option>
          <option value="90deg">Left to right</option>
          <option value="135deg">Diagonal</option>
          <option value="45deg">Diagonal reverse</option>
        </select>
        <div className="custom-gradient-colors">
          <input
            type="color"
            value={customGradient.from}
            aria-label={`${label} gradient start`}
            onChange={(event) =>
              onChange(
                buildGradientValue({
                  ...customGradient,
                  from: event.target.value
                })
              )
            }
          />
          <input
            type="color"
            value={customGradient.to}
            aria-label={`${label} gradient end`}
            onChange={(event) =>
              onChange(
                buildGradientValue({
                  ...customGradient,
                  to: event.target.value
                })
              )
            }
          />
        </div>
      </div>
    </label>
  );
}

const GRADIENT_PRESETS = [
  {
    label: "Dark gold",
    value: "linear-gradient(180deg, #11100d 0%, #2a2116 100%)"
  },
  {
    label: "Parchment",
    value: "linear-gradient(180deg, #fff7ed 0%, #ead6ad 100%)"
  },
  {
    label: "Night blue",
    value: "linear-gradient(180deg, #0c1420 0%, #183247 100%)"
  },
  {
    label: "Warm shadow",
    value: "linear-gradient(180deg, #1f130f 0%, #59301f 100%)"
  },
  {
    label: "Soft green",
    value: "linear-gradient(180deg, #eef7f2 0%, #d9e9df 100%)"
  }
];

function parseGradientValue(value: string): { angle: string; from: string; to: string } | null {
  const match = value
    .trim()
    .match(/^linear-gradient\(([^,]+),\s*(#[0-9a-fA-F]{6})(?:\s+\d+%)?,\s*(#[0-9a-fA-F]{6})(?:\s+\d+%)?\)$/);

  if (!match) {
    return null;
  }

  return {
    angle: match[1].trim(),
    from: match[2],
    to: match[3]
  };
}

function buildGradientValue({
  angle,
  from,
  to
}: {
  angle: string;
  from: string;
  to: string;
}): string {
  return `linear-gradient(${angle}, ${from} 0%, ${to} 100%)`;
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim());
}

function isGradientValue(value: string): boolean {
  return value.trim().startsWith("linear-gradient(");
}

function CropSlider({
  label,
  value,
  onChange
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field-label">
      {label}
      <input
        type="range"
        min="0"
        max="90"
        step="1"
        value={value}
        onChange={(event) => onChange(readNumberInput(event.target.value))}
      />
      <small>{value}%</small>
    </label>
  );
}

function TransformControls({
  title,
  x,
  y,
  scale,
  width,
  height,
  onChange,
  onSizeChange,
  minScale = 0.45,
  maxScale = 2.8,
  minHeight = 0,
  maxHeight = 420
}: {
  title: string;
  x: number;
  y: number;
  scale: number;
  width?: number;
  height?: number;
  onChange: (patch: { offsetX?: number; offsetY?: number; scale?: number }) => void;
  onSizeChange?: (patch: { width?: number; height?: number }) => void;
  minScale?: number;
  maxScale?: number;
  minHeight?: number;
  maxHeight?: number;
}) {
  return (
    <div className="transform-controls scene-layout-transform-group">
      <h4>{title}</h4>
      <label className="field-label">
        X
        <input
          type="range"
          min="-420"
          max="420"
          step="1"
          value={x}
          onChange={(event) => onChange({ offsetX: readNumberInput(event.target.value) })}
        />
      </label>
      <label className="field-label">
        Y
        <input
          type="range"
          min="-520"
          max="520"
          step="1"
          value={y}
          onChange={(event) => onChange({ offsetY: readNumberInput(event.target.value) })}
        />
      </label>
      <label className="field-label">
        Scale
        <input
          type="range"
          min={minScale}
          max={maxScale}
          step="0.05"
          value={scale}
          onChange={(event) => onChange({ scale: readNumberInput(event.target.value) })}
        />
      </label>
      {onSizeChange && width !== undefined && (
        <label className="field-label">
          Width
          <input
            type="range"
            min="0"
            max="390"
            step="1"
            value={width}
            onChange={(event) =>
              onSizeChange({ width: readNumberInput(event.target.value) })
            }
          />
          <small>{width === 0 ? "Auto" : `${width}px`}</small>
        </label>
      )}
      {onSizeChange && height !== undefined && (
        <label className="field-label">
          Height
          <input
            type="range"
            min={minHeight}
            max={maxHeight}
            step="1"
            value={height}
            onChange={(event) =>
              onSizeChange({ height: readNumberInput(event.target.value) })
            }
          />
          <small>{height === 0 ? "Auto" : `${height}px`}</small>
        </label>
      )}
    </div>
  );
}

function PaddingControls({
  label,
  top,
  side,
  topKey,
  sideKey,
  onChange
}: {
  label: string;
  top: number;
  side: number;
  topKey: keyof SceneStyle;
  sideKey: keyof SceneStyle;
  onChange: (patch: Partial<SceneStyle>) => void;
}) {
  return (
    <div className="transform-controls scene-layout-transform-group">
      <h4>{label}</h4>
      <label className="field-label">
        Top
        <input
          type="range"
          min="0"
          max="80"
          step="1"
          value={top}
          onChange={(event) =>
            onChange({ [topKey]: readNumberInput(event.target.value) } as Partial<SceneStyle>)
          }
        />
        <small>{top}px</small>
      </label>
      <label className="field-label">
        Sides
        <input
          type="range"
          min="0"
          max="80"
          step="1"
          value={side}
          onChange={(event) =>
            onChange({ [sideKey]: readNumberInput(event.target.value) } as Partial<SceneStyle>)
          }
        />
        <small>{side}px</small>
      </label>
    </div>
  );
}

function prefixPatch(
  prefix: "image" | "title" | "text" | "choices",
  patch: { offsetX?: number; offsetY?: number; scale?: number }
): Partial<Scene["style"]> {
  const nextPatch: Record<string, number> = {};
  if (patch.offsetX !== undefined) {
    nextPatch[`${prefix}OffsetX`] = patch.offsetX;
  }
  if (patch.offsetY !== undefined) {
    nextPatch[`${prefix}OffsetY`] = patch.offsetY;
  }
  if (patch.scale !== undefined) {
    nextPatch[`${prefix}Scale`] = patch.scale;
  }
  return nextPatch as Partial<Scene["style"]>;
}

function getResizeWidth(
  drag: {
    mode: PreviewDragMode;
    startPanelWidth: number;
  },
  deltaX: number
): number | null {
  if (drag.mode.includes("Left")) {
    return drag.startPanelWidth - deltaX;
  }
  if (drag.mode.includes("Right")) {
    return drag.startPanelWidth + deltaX;
  }
  return null;
}

function getResizeHeight(
  drag: {
    mode: PreviewDragMode;
    startPanelHeight: number;
  },
  deltaY: number
): number | null {
  if (drag.mode.includes("Top")) {
    return drag.startPanelHeight - deltaY;
  }
  if (drag.mode.includes("Bottom")) {
    return drag.startPanelHeight + deltaY;
  }
  return null;
}

function getPanelResizeOffsetForWidth(
  mode: PreviewDragMode,
  startWidth: number,
  nextWidth: number
): number {
  return mode.includes("Left") ? (startWidth - nextWidth) / 2 : 0;
}

function getPanelResizeOffsetForHeight(
  mode: PreviewDragMode,
  startHeight: number,
  nextHeight: number
): number {
  return mode.includes("Top") ? (startHeight - nextHeight) / 2 : 0;
}

function getResizeOffsetDeltaX(mode: PreviewDragMode, deltaX: number): number {
  if (mode.includes("Left")) {
    return deltaX / 2;
  }
  if (mode.includes("Right")) {
    return deltaX / 2;
  }
  return 0;
}

function getResizeOffsetDeltaY(mode: PreviewDragMode, deltaY: number): number {
  if (mode.includes("Top")) {
    return deltaY / 2;
  }
  if (mode.includes("Bottom")) {
    return deltaY / 2;
  }
  return 0;
}

function getResizeScaleDelta(
  mode: PreviewDragMode,
  deltaX: number,
  deltaY: number
): number {
  const horizontalDelta = mode.includes("Left") ? -deltaX : deltaX;
  const verticalDelta = mode.includes("Top") ? -deltaY : deltaY;
  const strongestDelta =
    Math.abs(horizontalDelta) > Math.abs(verticalDelta)
      ? horizontalDelta
      : verticalDelta;
  return strongestDelta / 170;
}

function getPreviewFontFamily(fontFamily: string): string {
  if (fontFamily === "serif") {
    return 'Georgia, "Times New Roman", serif';
  }
  if (fontFamily === "mono") {
    return '"Cascadia Mono", "Consolas", monospace';
  }
  return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
}

function stopEditableEventPropagation(
  event: ReactKeyboardEvent | ReactMouseEvent
) {
  if (isEditableElement(event.target)) {
    event.stopPropagation();
  }
}

function isEditableElement(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}

function getSceneTextRows(text: string): number {
  const lineRows = text.split("\n").length;
  const lengthRows = Math.ceil(text.length / 36);
  return clampNumber(Math.max(2, lineRows, lengthRows), 2, 12);
}

function getTitleTextRows(text: string): number {
  const lineRows = text.split("\n").length;
  const lengthRows = Math.ceil(text.length / 20);
  return clampNumber(Math.max(1, lineRows, lengthRows), 1, 4);
}

function getChoiceTextRows(text: string): number {
  const lineRows = text.split("\n").length;
  const lengthRows = Math.ceil(text.length / 32);
  return clampNumber(Math.max(2, lineRows, lengthRows), 2, 6);
}

function getChoicePreviewRows(text: string): number {
  const lineRows = text.split("\n").length;
  const lengthRows = Math.ceil(text.length / 32);
  return clampNumber(Math.max(1, lineRows, lengthRows), 1, 6);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function SceneImageSection({
  imagePath,
  mediaType,
  videoLoop,
  sceneName,
  onMediaChange,
  onVideoLoopChange
}: SceneImageSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const hasMedia = imagePath.trim() !== "";

  async function selectImage() {
    setMessage("");

    if (!window.storyLife?.selectImage) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const result = await window.storyLife.selectImage();
      if (!result.canceled) {
        onMediaChange(result.filePath, result.mediaType);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Media picker failed.");
    }
  }

  return (
    <section className="scene-image-section">
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.gif,.mp4,.webm,.mov,.m4v,image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) {
            return;
          }
          const reader = new FileReader();
          reader.addEventListener("load", () => {
            if (typeof reader.result === "string") {
              onMediaChange(
                reader.result,
                file.type.startsWith("video/") ? "video" : "image"
              );
              setMessage("Media embedded into this project.");
            }
          });
          reader.readAsDataURL(file);
        }}
      />
      <div className="inspector-image-preview-frame">
        {hasMedia ? (
          <InspectorVisualPreview
            key={`${mediaType}:${imagePath}`}
            mediaPath={imagePath}
            mediaType={mediaType}
            videoLoop={videoLoop}
          />
        ) : (
          <span>No picture or video selected</span>
        )}
      </div>
      {isEmbeddedMediaPath(imagePath) ? (
        <div className="embedded-media-label">
          Embedded {mediaType === "video" ? "video" : "image"}
        </div>
      ) : (
        <input
          value={imagePath}
          placeholder="No picture or video selected"
          onChange={(event) => {
            const nextPath = event.target.value;
            onMediaChange(nextPath, inferVisualMediaType(nextPath));
          }}
        />
      )}
      {mediaType === "video" && hasMedia && (
        <label className="checkbox-label scene-video-loop-toggle">
          <input
            type="checkbox"
            checked={videoLoop}
            onChange={(event) => onVideoLoopChange(event.target.checked)}
          />
          <span>Loop video</span>
        </label>
      )}
      <div className="image-actions">
        <button
          type="button"
          onClick={selectImage}
        >
          {hasMedia ? "Change Media" : "Select Media"}
        </button>
        <button
          type="button"
          disabled={!hasMedia || mediaType !== "image"}
          onClick={() => {
            setMessage("");
            void savePicture(imagePath, sceneName)
              .then((result) => {
                if (result === "saved") setMessage("Picture saved.");
              })
              .catch((error) =>
                setMessage(error instanceof Error ? error.message : "Could not save picture.")
              );
          }}
        >
          Save Picture
        </button>
        <button
          type="button"
          className="danger-button"
          onClick={() => onMediaChange("", "image")}
          disabled={!hasMedia}
        >
          Remove Media
        </button>
      </div>
      {message && <p className="helper-text">{message}</p>}
    </section>
  );
}

function InspectorVisualPreview({
  mediaPath,
  mediaType,
  videoLoop,
  className = "inspector-image-preview",
  style,
  fallback = <span>Media file is missing</span>
}: {
  mediaPath: string;
  mediaType: SceneVisualMediaType;
  videoLoop: boolean;
  className?: string;
  style?: CSSProperties;
  fallback?: ReactNode;
}) {
  if (mediaType === "video") {
    return (
      <ResolvedVideoPreview
        mediaPath={mediaPath}
        loop={videoLoop}
        className={className}
        style={style}
        fallback={fallback}
      />
    );
  }
  return (
    <InspectorImagePreview
      imagePath={mediaPath}
      className={className}
      style={style}
      fallback={fallback}
    />
  );
}

function InspectorImagePreview({
  imagePath,
  className = "inspector-image-preview",
  style,
  fallback = <span>Image file is missing</span>
}: {
  imagePath: string;
  className?: string;
  style?: CSSProperties;
  fallback?: ReactNode;
}) {
  const [previewSrc, setPreviewSrc] = useState(() => getInitialPreviewSrc(imagePath));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    setHasError(false);
    setPreviewSrc(getInitialPreviewSrc(imagePath));

    if (
      !isLocalPath(imagePath) ||
      window.storyLife?.getMediaUrl ||
      !window.storyLife?.readImagePreview
    ) {
      return () => {
        isCurrent = false;
      };
    }

    window.storyLife
      .readImagePreview(imagePath)
      .then((result) => {
        if (!isCurrent) {
          return;
        }
        if (result.ok) {
          setPreviewSrc(result.dataUrl);
          setHasError(false);
        } else if (isLocalPath(imagePath)) {
          setHasError(true);
        }
      })
      .catch(() => {
        if (isCurrent && isLocalPath(imagePath)) {
          setHasError(true);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [imagePath]);

  if (hasError) {
    return <>{fallback}</>;
  }

  if (!previewSrc) {
    return <span>Loading preview...</span>;
  }

  return (
    <img
      className={className}
      style={style}
      src={previewSrc}
      alt=""
      draggable={false}
      decoding="async"
      onError={(event) => {
        if (event.currentTarget.currentSrc === previewSrc) setHasError(true);
      }}
    />
  );
}

function ResolvedVideoPreview({
  mediaPath,
  loop,
  className,
  style,
  fallback
}: {
  mediaPath: string;
  loop: boolean;
  className: string;
  style?: CSSProperties;
  fallback: ReactNode;
}) {
  const [previewSrc, setPreviewSrc] = useState(() => getInitialPreviewSrc(mediaPath));
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    setHasError(false);
    setPreviewSrc(getInitialPreviewSrc(mediaPath));
    if (
      !isLocalPath(mediaPath) ||
      window.storyLife?.getMediaUrl ||
      !window.storyLife?.readImagePreview
    ) return () => { isCurrent = false; };
    window.storyLife.readImagePreview(mediaPath).then((result) => {
      if (!isCurrent) return;
      if (result.ok) setPreviewSrc(result.dataUrl);
      else if (isLocalPath(mediaPath)) setHasError(true);
    }).catch(() => {
      if (isCurrent && isLocalPath(mediaPath)) setHasError(true);
    });
    return () => { isCurrent = false; };
  }, [mediaPath]);

  if (hasError) return <>{fallback}</>;
  if (!previewSrc) return <span>Loading preview...</span>;
  return (
    <video
      className={className}
      style={style}
      src={previewSrc}
      autoPlay
      muted
      playsInline
      loop={loop}
      preload="metadata"
      onError={() => setHasError(true)}
    />
  );
}

function getInitialPreviewSrc(mediaPath: string): string {
  if (isLocalPath(mediaPath)) {
    if (window.storyLife?.getMediaUrl) {
      return window.storyLife.getMediaUrl(mediaPath);
    }
    if (window.storyLife?.readImagePreview) {
      return "";
    }
  }
  return toImageSrc(mediaPath);
}

function inferVisualMediaType(mediaPath: string): SceneVisualMediaType {
  return /^(?:data:video\/)|\.(?:mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(mediaPath.trim())
    ? "video"
    : "image";
}

function isEmbeddedMediaPath(mediaPath: string): boolean {
  return mediaPath.trim().startsWith("data:");
}

interface MediaPickerSectionProps {
  mediaPath: string;
  emptyLabel: string;
  selectLabel: string;
  changeLabel: string;
  removeLabel: string;
  accept: string;
  selectNative?: () => Promise<{ canceled: true } | { canceled: false; filePath: string }>;
  onMediaPathChange: (mediaPath: string) => void;
}

function MediaPickerSection({
  mediaPath,
  emptyLabel,
  selectLabel,
  changeLabel,
  removeLabel,
  accept,
  selectNative,
  onMediaPathChange
}: MediaPickerSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const hasMedia = mediaPath.trim() !== "";

  async function selectMedia() {
    setMessage("");

    if (!selectNative) {
      fileInputRef.current?.click();
      return;
    }

    try {
      const result = await selectNative();
      if (!result.canceled) {
        onMediaPathChange(result.filePath);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "File picker failed.");
    }
  }

  return (
    <section className="scene-image-section">
      <input
        ref={fileInputRef}
        className="hidden-file-input"
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) {
            return;
          }

          const reader = new FileReader();
          reader.addEventListener("load", () => {
            if (typeof reader.result === "string") {
              onMediaPathChange(reader.result);
              setMessage("File embedded into this project for web/iPad testing.");
            }
          });
          reader.readAsDataURL(file);
        }}
      />
      <input
        value={mediaPath}
        placeholder={emptyLabel}
        onChange={(event) => onMediaPathChange(event.target.value)}
      />
      <div className="image-actions">
        <button type="button" onClick={selectMedia}>
          {hasMedia ? changeLabel : selectLabel}
        </button>
        <button
          type="button"
          className="danger-button"
          onClick={() => onMediaPathChange("")}
          disabled={!hasMedia}
        >
          {removeLabel}
        </button>
      </div>
      {message && <p className="helper-text">{message}</p>}
    </section>
  );
}

function toImageSrc(imagePath: string): string {
  const trimmedPath = imagePath.trim();

  if (
    trimmedPath.startsWith("file://") ||
    trimmedPath.startsWith("http://") ||
    trimmedPath.startsWith("https://")
  ) {
    return trimmedPath;
  }

  if (/^[a-zA-Z]:\\/.test(trimmedPath)) {
    return `file:///${trimmedPath.replace(/\\/g, "/")}`;
  }

  return trimmedPath;
}

function isLocalPath(imagePath: string): boolean {
  const trimmedPath = imagePath.trim();
  return trimmedPath.startsWith("file://") || /^[a-zA-Z]:\\/.test(trimmedPath);
}

interface ChoiceLogicEditorProps {
  choice: Choice;
  parameters: StoryParameter[];
  flags: StoryFlag[];
}

interface ChoiceOutcomesEditorProps {
  choice: Choice;
  scenes: Scene[];
  onAddOutcome: () => void;
  onUpdateOutcome: (outcomeId: string, patch: Partial<ChoiceOutcome>) => void;
  onDeleteOutcome: (outcomeId: string) => void;
}

function ChoiceOutcomesEditor({
  choice,
  scenes,
  onAddOutcome,
  onUpdateOutcome,
  onDeleteOutcome
}: ChoiceOutcomesEditorProps) {
  const total = getChoiceOutcomeTotal(choice);
  const isSingleOutcome = choice.outcomes.length <= 1;
  const isValidTotal = isSingleOutcome || total === 100;

  return (
    <details className="choice-outcomes-section">
      <summary>
        <span>Probability outcomes</span>
        <strong className={isValidTotal ? "valid-total" : "invalid-total"}>
          Total {isSingleOutcome ? 100 : total}%
        </strong>
      </summary>
      <div className="choice-outcomes-body">
        <button type="button" onClick={onAddOutcome}>
          Add Outcome
        </button>
        {choice.outcomes.length === 0 && (
          <p className="empty-state">No outcomes. Add one target scene.</p>
        )}
        {choice.outcomes.map((outcome, index) => (
          <div className="choice-outcome-row" key={outcome.id}>
            <strong>Outcome {index + 1}</strong>
            <label className="field-label">
              Target scene
              <select
                value={outcome.targetSceneId}
                onChange={(event) =>
                  onUpdateOutcome(outcome.id, {
                    targetSceneId: event.target.value
                  })
                }
              >
                {scenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>
                    {scene.title || scene.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Percent
              <input
                type="number"
                min={0}
                max={100}
                value={isSingleOutcome ? 100 : outcome.percent}
                disabled={isSingleOutcome}
                onChange={(event) =>
                  onUpdateOutcome(outcome.id, {
                    percent: clampNumber(readNumberInput(event.target.value), 0, 100)
                  })
                }
              />
            </label>
            <button
              type="button"
              className="danger-button"
              onClick={() => onDeleteOutcome(outcome.id)}
              disabled={choice.outcomes.length <= 1}
            >
              Delete Outcome
            </button>
          </div>
        ))}
        <p className={isValidTotal ? "choice-outcome-total valid" : "choice-outcome-total invalid"}>
          {isValidTotal
            ? "Percent total is valid."
            : "Warning: percent total must be exactly 100%."}
        </p>
      </div>
    </details>
  );
}

interface ChoiceEffectsEditorProps extends ChoiceLogicEditorProps {
  onAddParameterEffect: () => void;
  onAddFlagEffect: () => void;
  onUpdateEffect: (effectId: string, patch: Partial<ChoiceEffect>) => void;
  onDeleteEffect: (effectId: string) => void;
}

function ChoiceEffectsEditor({
  choice,
  parameters,
  flags,
  onAddParameterEffect,
  onAddFlagEffect,
  onUpdateEffect,
  onDeleteEffect
}: ChoiceEffectsEditorProps) {
  return (
    <section className="choice-logic-section">
      <div className="choice-logic-heading">
        <h4>Effects</h4>
        <div>
          <button
            type="button"
            onClick={onAddParameterEffect}
            disabled={parameters.length === 0}
          >
            + Parameter
          </button>
          <button type="button" onClick={onAddFlagEffect} disabled={flags.length === 0}>
            + Flag
          </button>
        </div>
      </div>
      {choice.effects.length === 0 && (
        <p className="empty-state">No effects.</p>
      )}
      {choice.effects.map((effect) => (
        <div className="logic-row" key={effect.id}>
          {effect.type === "parameter" ? (
            <>
              <select
                value={effect.parameterId}
                onChange={(event) =>
                  onUpdateEffect(effect.id, { parameterId: event.target.value })
                }
              >
                {parameters.map((parameter) => (
                  <option key={parameter.id} value={parameter.id}>
                    {parameter.key}
                  </option>
                ))}
              </select>
              <select
                value={effect.operation}
                onChange={(event) =>
                  onUpdateEffect(effect.id, {
                    operation:
                      event.target.value === "subtract"
                        ? "subtract"
                        : event.target.value === "set"
                          ? "set"
                          : "add"
                  })
                }
              >
                <option value="add">add</option>
                <option value="subtract">subtract</option>
                <option value="set">set</option>
              </select>
              <input
                type="number"
                value={effect.value}
                onChange={(event) =>
                  onUpdateEffect(effect.id, { value: readNumberInput(event.target.value) })
                }
              />
            </>
          ) : (
            <>
              <select
                value={effect.flagId}
                onChange={(event) =>
                  onUpdateEffect(effect.id, { flagId: event.target.value })
                }
              >
                {flags.map((flag) => (
                  <option key={flag.id} value={flag.id}>
                    {flag.key}
                  </option>
                ))}
              </select>
              <select
                value={String(effect.value)}
                onChange={(event) =>
                  onUpdateEffect(effect.id, { value: event.target.value === "true" })
                }
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </>
          )}
          <button type="button" onClick={() => onDeleteEffect(effect.id)}>
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}

interface ChoiceConditionsEditorProps extends ChoiceLogicEditorProps {
  onAddParameterCondition: () => void;
  onAddFlagCondition: () => void;
  onUpdateCondition: (
    conditionId: string,
    patch: Partial<ChoiceCondition>
  ) => void;
  onDeleteCondition: (conditionId: string) => void;
}

function ChoiceConditionsEditor({
  choice,
  parameters,
  flags,
  onAddParameterCondition,
  onAddFlagCondition,
  onUpdateCondition,
  onDeleteCondition
}: ChoiceConditionsEditorProps) {
  return (
    <section className="choice-logic-section">
      <div className="choice-logic-heading">
        <h4>Conditions</h4>
        <div>
          <button
            type="button"
            onClick={onAddParameterCondition}
            disabled={parameters.length === 0}
          >
            + Parameter
          </button>
          <button
            type="button"
            onClick={onAddFlagCondition}
            disabled={flags.length === 0}
          >
            + Flag
          </button>
        </div>
      </div>
      {choice.conditions.length === 0 && (
        <p className="empty-state">Always available.</p>
      )}
      {choice.conditions.map((condition) => (
        <div className="logic-row" key={condition.id}>
          {condition.type === "parameter" ? (
            <>
              <select
                value={condition.parameterId}
                onChange={(event) =>
                  onUpdateCondition(condition.id, {
                    parameterId: event.target.value
                  })
                }
              >
                {parameters.map((parameter) => (
                  <option key={parameter.id} value={parameter.id}>
                    {parameter.key}
                  </option>
                ))}
              </select>
              <select
                value={condition.operator}
                onChange={(event) =>
                  onUpdateCondition(condition.id, {
                    operator: event.target.value as ParameterConditionOperator
                  })
                }
              >
                <option value=">=">&gt;=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value="<=">&lt;=</option>
                <option value="==">==</option>
                <option value="!=">!=</option>
              </select>
              <input
                type="number"
                value={condition.value}
                onChange={(event) =>
                  onUpdateCondition(condition.id, {
                    value: readNumberInput(event.target.value)
                  })
                }
              />
            </>
          ) : (
            <>
              <select
                value={condition.flagId}
                onChange={(event) =>
                  onUpdateCondition(condition.id, { flagId: event.target.value })
                }
              >
                {flags.map((flag) => (
                  <option key={flag.id} value={flag.id}>
                    {flag.key}
                  </option>
                ))}
              </select>
              <select
                value={String(condition.expectedValue)}
                onChange={(event) =>
                  onUpdateCondition(condition.id, {
                    expectedValue: event.target.value === "true"
                  })
                }
              >
                <option value="true">is true</option>
                <option value="false">is false</option>
              </select>
            </>
          )}
          <button type="button" onClick={() => onDeleteCondition(condition.id)}>
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}

interface ConditionalTargetsEditorProps {
  choice: Choice;
  scenes: Scene[];
  flags: StoryFlag[];
  onAddConditionalTarget: () => void;
  onUpdateConditionalTarget: (
    conditionalTargetId: string,
    patch: Partial<ConditionalTarget>
  ) => void;
  onDeleteConditionalTarget: (conditionalTargetId: string) => void;
  onMoveConditionalTarget: (
    conditionalTargetId: string,
    direction: "up" | "down"
  ) => void;
}

function ConditionalTargetsEditor({
  choice,
  scenes,
  flags,
  onAddConditionalTarget,
  onUpdateConditionalTarget,
  onDeleteConditionalTarget,
  onMoveConditionalTarget
}: ConditionalTargetsEditorProps) {
  return (
    <section className="choice-logic-section">
      <div className="choice-logic-heading">
        <h4>Conditional targets</h4>
        <button
          type="button"
          onClick={onAddConditionalTarget}
          disabled={flags.length === 0 || scenes.length === 0}
        >
          Add rule
        </button>
      </div>
      <p className="helper-text">
        Rules are checked from top to bottom. If none match, the default target
        scene is used.
      </p>
      {choice.conditionalTargets.length === 0 && (
        <p className="empty-state">No conditional targets.</p>
      )}
      {choice.conditionalTargets.map((conditionalTarget, index) => {
        const firstCondition = conditionalTarget.conditions.find(
          (condition) => condition.type === "flag"
        );
        const selectedFlagId =
          firstCondition?.type === "flag" ? firstCondition.flagId : flags[0]?.id ?? "";
        const expectedValue =
          firstCondition?.type === "flag" ? firstCondition.expectedValue : true;

        return (
          <div className="conditional-target-row" key={conditionalTarget.id}>
            <strong>Rule {index + 1}</strong>
            <select
              value={selectedFlagId}
              onChange={(event) =>
                onUpdateConditionalTarget(conditionalTarget.id, {
                  conditions: [
                    createFlagCondition(
                      event.target.value,
                      firstCondition?.id ?? `condition_${conditionalTarget.id}`
                    )
                  ]
                })
              }
            >
              {flags.map((flag) => (
                <option key={flag.id} value={flag.id}>
                  {flag.key}
                </option>
              ))}
            </select>
            <select
              value={String(expectedValue)}
              onChange={(event) =>
                onUpdateConditionalTarget(conditionalTarget.id, {
                  conditions: [
                    {
                      id: firstCondition?.id ?? `condition_${conditionalTarget.id}`,
                      type: "flag",
                      flagId: selectedFlagId,
                      expectedValue: event.target.value === "true"
                    }
                  ]
                })
              }
            >
              <option value="true">is true</option>
              <option value="false">is false</option>
            </select>
            <select
              value={conditionalTarget.targetSceneId}
              onChange={(event) =>
                onUpdateConditionalTarget(conditionalTarget.id, {
                  targetSceneId: event.target.value
                })
              }
            >
              {scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>
                  {scene.title || scene.id}
                </option>
              ))}
            </select>
            <div className="conditional-target-actions">
              <button
                type="button"
                onClick={() => onMoveConditionalTarget(conditionalTarget.id, "up")}
                disabled={index === 0}
              >
                Up
              </button>
              <button
                type="button"
                onClick={() =>
                  onMoveConditionalTarget(conditionalTarget.id, "down")
                }
                disabled={index === choice.conditionalTargets.length - 1}
              >
                Down
              </button>
              <button
                type="button"
                onClick={() => onDeleteConditionalTarget(conditionalTarget.id)}
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}

function readNumberInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getChoiceOutcomeTotal(choice: Choice): number {
  if (choice.outcomes.length <= 1) {
    return 100;
  }

  return choice.outcomes.reduce(
    (total, outcome) => total + Math.max(0, Number(outcome.percent) || 0),
    0
  );
}

function moveItem<T extends { id: string }>(
  items: T[],
  itemId: string,
  direction: "up" | "down"
): T[] {
  const index = items.findIndex((item) => item.id === itemId);
  if (index === -1) {
    return items;
  }

  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [item] = nextItems.splice(index, 1);
  nextItems.splice(targetIndex, 0, item);
  return nextItems;
}

function toggleSetValue(currentIds: Set<string>, itemId: string): Set<string> {
  const nextIds = new Set(currentIds);
  if (nextIds.has(itemId)) {
    nextIds.delete(itemId);
  } else {
    nextIds.add(itemId);
  }
  return nextIds;
}

function getNextNumericId(prefix: string, items: Array<{ id: string }>): number {
  const usedNumbers = items
    .map((item) => {
      const match = item.id.match(new RegExp(`^${prefix}_(\\d+)$`));
      return match ? Number(match[1]) : 0;
    })
    .filter((value) => Number.isFinite(value));

  return Math.max(0, ...usedNumbers) + 1;
}
