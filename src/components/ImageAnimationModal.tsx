import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AIFramesSceneImageAnimation,
  AIImageAnimationMode,
  ProceduralImageAnimationPreset,
  ProceduralSceneImageAnimation,
  SceneAnimationFrame,
  SceneImageAnimation,
  SceneImageVariant
} from "../domain/project";
import {
  AI_ANIMATION_MODES,
  buildAIFramePlan,
  createDefaultProceduralAnimation,
  createStrictAnimationFramePrompt,
  getAnimationOutputSize,
  PROCEDURAL_ANIMATION_PRESETS
} from "../utils/imageAnimation";
import { AnimatedSceneImage, toAnimationMediaSrc } from "./AnimatedSceneImage";

interface ImageAnimationModalProps {
  initialType: "procedural" | "aiFrames";
  sceneTitle: string;
  variant: SceneImageVariant;
  imageModel: string;
  imageSize: string;
  onApply: (animation: SceneImageAnimation) => void;
  onClose: () => void;
  onStatus: (message: string) => void;
}

type FrameGenerationStatus =
  | "original"
  | "queued"
  | "generating"
  | "ready"
  | "error"
  | "cancelled";

interface FrameGenerationProgress {
  status: FrameGenerationStatus;
  message?: string;
}

export function ImageAnimationModal({
  initialType,
  sceneTitle,
  variant,
  imageModel,
  imageSize,
  onApply,
  onClose,
  onStatus
}: ImageAnimationModalProps) {
  const [type, setType] = useState<"procedural" | "aiFrames">(initialType);
  const existingProcedural = variant.animation?.type === "procedural"
    ? variant.animation
    : createDefaultProceduralAnimation(variant.imagePath);
  const existingAI = variant.animation?.type === "aiFrames" ? variant.animation : null;
  const [procedural, setProcedural] = useState<ProceduralSceneImageAnimation>({
    ...existingProcedural,
    enabled: true,
    sourceImagePath: variant.imagePath
  });
  const [aiMode, setAIMode] = useState<AIImageAnimationMode>(existingAI?.mode ?? "idle");
  const [frameCount, setFrameCount] = useState(
    Math.max(2, Math.min(12, existingAI?.frames.length || 4))
  );
  const [fps, setFps] = useState(existingAI?.fps ?? 6);
  const [loop, setLoop] = useState(existingAI?.loop ?? true);
  const [pingPong, setPingPong] = useState(existingAI?.pingPong ?? false);
  const [movementIntensity, setMovementIntensity] = useState(
    existingAI?.movementIntensity ?? 0.35
  );
  const [customInstruction, setCustomInstruction] = useState(
    existingAI?.customInstruction ?? ""
  );
  const [includeOriginal, setIncludeOriginal] = useState(true);
  const [frames, setFrames] = useState<SceneAnimationFrame[]>(existingAI?.frames ?? []);
  const framesRef = useRef(frames);
  const [frameErrors, setFrameErrors] = useState<Record<string, string>>({});
  const [frameProgress, setFrameProgress] = useState<Record<string, FrameGenerationProgress>>(
    () => Object.fromEntries((existingAI?.frames ?? []).map((frame) => [
      frame.id,
      {
        status: frame.source === "original"
          ? "original"
          : frame.imagePath.trim()
            ? "ready"
            : "queued"
      }
    ]))
  );
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const activeRequestIdRef = useRef<string | null>(null);
  const [generationRunning, setGenerationRunning] = useState(false);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const stoppedRef = useRef(false);
  const [sourceDimensions, setSourceDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const sourceImage = new Image();
    sourceImage.onload = () => {
      if (!isCurrent || sourceImage.naturalWidth <= 0 || sourceImage.naturalHeight <= 0) return;
      setSourceDimensions({
        width: sourceImage.naturalWidth,
        height: sourceImage.naturalHeight
      });
    };
    sourceImage.onerror = () => {
      if (isCurrent) setSourceDimensions(null);
    };
    sourceImage.src = toAnimationMediaSrc(variant.imagePath);
    return () => {
      isCurrent = false;
      sourceImage.src = "";
    };
  }, [variant.imagePath]);

  function updateFrames(nextFrames: SceneAnimationFrame[]) {
    framesRef.current = nextFrames;
    setFrames(nextFrames);
  }

  const previewAnimation = useMemo<SceneImageAnimation>(() => {
    if (type === "procedural") return { ...procedural, enabled: true };
    return createAIAnimation(frames, aiMode, fps, loop, pingPong, movementIntensity, customInstruction, variant.imagePath);
  }, [aiMode, customInstruction, fps, frames, loop, movementIntensity, pingPong, procedural, type, variant.imagePath]);
  const selectedFrame = frames.find((frame) => frame.id === selectedFrameId) ?? null;
  const selectedFramePath = selectedFrame
    ? selectedFrame.source === "original"
      ? variant.imagePath
      : selectedFrame.imagePath
    : "";
  const animationImageSize = useMemo(() => getAnimationOutputSize(
    imageModel,
    sourceDimensions?.width,
    sourceDimensions?.height,
    imageSize
  ), [imageModel, imageSize, sourceDimensions]);

  async function generateAllFrames() {
    if (!window.storyLife?.aiGenerateSceneImage || activeRequestId || generationRunning) return;
    stoppedRef.current = false;
    const plan = buildAIFramePlan(
      aiMode,
      frameCount,
      movementIntensity,
      customInstruction,
      includeOriginal
    );
    updateFrames(plan);
    setFrameErrors({});
    setFrameProgress(Object.fromEntries(plan.map((frame) => [
      frame.id,
      { status: frame.source === "original" ? "original" : "queued" }
    ])));
    setPreviewPlaying(false);
    setGenerationRunning(true);
    const framesToGenerate = plan.filter((frame) => frame.source === "generated");
    let readyCount = 0;
    let errorCount = 0;
    onStatus(`Generating ${framesToGenerate.length} real AI frame(s); the original is used no more than once.`);

    for (const plannedFrame of framesToGenerate) {
      if (stoppedRef.current) break;
      const generated = await generateOneFrame(plannedFrame.id, plannedFrame.instruction);
      if (generated) readyCount += 1;
      else if (!stoppedRef.current) errorCount += 1;
    }
    setActiveRequestId(null);
    activeRequestIdRef.current = null;
    setGenerationRunning(false);
    if (stoppedRef.current) {
      setFrameProgress((current) => Object.fromEntries(
        Object.entries(current).map(([frameId, progress]) => [
          frameId,
          progress.status === "queued" || progress.status === "generating"
            ? { status: "cancelled" }
            : progress
        ])
      ));
      return;
    }
    if (errorCount > 0) {
      onStatus(`${readyCount}/${framesToGenerate.length} AI frames generated. ${errorCount} failed; use Regenerate on the red frames.`);
    } else {
      onStatus(`All ${readyCount} AI frames generated. Review them, then click Apply.`);
      setPreviewPlaying(true);
    }
  }

  async function generateOneFrame(frameId: string, instruction: string): Promise<boolean> {
    if (!window.storyLife?.aiGenerateSceneImage) return false;
    const requestId = `animation_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    activeRequestIdRef.current = requestId;
    setActiveRequestId(requestId);
    setFrameErrors((current) => ({ ...current, [frameId]: "" }));
    setFrameProgress((current) => ({
      ...current,
      [frameId]: { status: "generating" }
    }));
    try {
      const result = await window.storyLife.aiGenerateSceneImage({
        prompt: createStrictAnimationFramePrompt(
          instruction,
          sourceDimensions
            ? sourceDimensions.width / sourceDimensions.height
            : undefined
        ),
        referenceImagePaths: [variant.imagePath],
        preserveReferenceCanvas: true,
        imageModel,
        imageSize: animationImageSize,
        imageQuality: "low",
        requestId
      });
      const nextFrames = framesRef.current.map((frame) =>
        frame.id === frameId
          ? { ...frame, source: "generated" as const, imagePath: result.filePath }
          : frame
      );
      updateFrames(nextFrames);
      setFrameProgress((current) => ({
        ...current,
        [frameId]: { status: "ready" }
      }));
      return true;
    } catch (error) {
      if (stoppedRef.current) {
        setFrameProgress((current) => ({
          ...current,
          [frameId]: { status: "cancelled" }
        }));
      } else {
        const message = error instanceof Error ? error.message : "Frame generation failed.";
        setFrameErrors((current) => ({
          ...current,
          [frameId]: message
        }));
        setFrameProgress((current) => ({
          ...current,
          [frameId]: { status: "error", message }
        }));
      }
      return false;
    } finally {
      if (activeRequestIdRef.current === requestId) activeRequestIdRef.current = null;
      setActiveRequestId((current) => current === requestId ? null : current);
    }
  }

  async function stopGeneration() {
    stoppedRef.current = true;
    const requestId = activeRequestIdRef.current;
    if (requestId) await window.storyLife?.aiCancel(requestId);
    activeRequestIdRef.current = null;
    setActiveRequestId(null);
    onStatus("AI animation generation stopped. Completed frames were kept.");
  }

  function closeEditor() {
    stoppedRef.current = true;
    if (activeRequestIdRef.current) void window.storyLife?.aiCancel(activeRequestIdRef.current);
    activeRequestIdRef.current = null;
    onClose();
  }

  function applyAnimation() {
    if (type === "procedural") {
      onApply({ ...procedural, enabled: true, sourceImagePath: variant.imagePath });
      return;
    }
    const validFrames = frames.filter(
      (frame) => frame.source === "original" || frame.imagePath.trim() !== ""
    );
    if (validFrames.length < 2) {
      onStatus("AI animation needs at least two valid frames.");
      return;
    }
    onApply(createAIAnimation(
      validFrames.slice(0, 12),
      aiMode,
      fps,
      loop,
      pingPong,
      movementIntensity,
      customInstruction,
      variant.imagePath
    ));
  }

  function moveFrame(frameId: string, delta: number) {
    const index = frames.findIndex((frame) => frame.id === frameId);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= frames.length) return;
    const next = [...frames];
    [next[index], next[target]] = [next[target], next[index]];
    updateFrames(next);
  }

  const generatedFrameProgress = frames
    .filter((frame) => frame.source === "generated")
    .map((frame) => resolveFrameProgress(frame, frameProgress[frame.id]));
  const settledFrameCount = generatedFrameProgress.filter((progress) =>
    progress.status === "ready" || progress.status === "error" || progress.status === "cancelled"
  ).length;
  const readyFrameCount = generatedFrameProgress.filter((progress) => progress.status === "ready").length;
  const failedFrameCount = generatedFrameProgress.filter((progress) => progress.status === "error").length;
  const generatingFrameIndex = frames.findIndex((frame) => frameProgress[frame.id]?.status === "generating");
  const generationPercent = generatedFrameProgress.length === 0
    ? 0
    : Math.round((settledFrameCount / generatedFrameProgress.length) * 100);

  return (
    <div className="modal-backdrop image-animation-backdrop" role="presentation" onMouseDown={closeEditor}>
      <section
        className={`image-animation-modal ${
          type === "aiFrames" && frames.length > 0 ? "has-ai-frame-workspace" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Image animation editor"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <h2>{type === "procedural" ? "Animate" : "Animate with AI"}</h2>
            <p>{sceneTitle} · {variant.name}</p>
          </div>
          <button type="button" onClick={closeEditor}>Close</button>
        </div>

        <div className="image-animation-type-tabs">
          <button type="button" className={type === "procedural" ? "active" : ""} onClick={() => setType("procedural")}>Local animation</button>
          <button type="button" className={type === "aiFrames" ? "active" : ""} onClick={() => setType("aiFrames")}>AI frames</button>
        </div>

        <div className="image-animation-body">
          <div className="image-animation-preview">
            <div className="image-animation-preview-stage">
              {previewPlaying ? (
                <AnimatedSceneImage
                  imagePath={variant.imagePath}
                  animation={previewAnimation}
                  playing
                  alt="Animation preview"
                />
              ) : (
                <img
                  className="image-animation-static-preview"
                  src={toAnimationMediaSrc(
                    type === "aiFrames" && selectedFramePath
                      ? selectedFramePath
                      : variant.imagePath
                  )}
                  alt="Full source preview"
                />
              )}
            </div>
          </div>

          <div className="image-animation-controls">
            {type === "procedural" ? (
              <>
                <label className="field-label">Preset
                  <select
                    value={procedural.preset}
                    onChange={(event) => {
                      const preset = event.target.value as ProceduralImageAnimationPreset;
                      const duration = PROCEDURAL_ANIMATION_PRESETS.find((item) => item.value === preset)?.durationSeconds ?? procedural.durationSeconds;
                      setProcedural((current) => ({ ...current, preset, durationSeconds: duration }));
                    }}
                  >
                    {PROCEDURAL_ANIMATION_PRESETS.map((preset) => <option value={preset.value} key={preset.value}>{preset.label}</option>)}
                  </select>
                </label>
                <RangeField label="Intensity" value={procedural.intensity * 100} min={0} max={100} step={1} onChange={(value) => setProcedural((current) => ({ ...current, intensity: value / 100 }))} suffix="%" />
                <RangeField label="Speed" value={procedural.speed} min={0.25} max={3} step={0.05} onChange={(value) => setProcedural((current) => ({ ...current, speed: value }))} suffix="×" />
                <RangeField label="Duration" value={procedural.durationSeconds} min={0.4} max={30} step={0.1} onChange={(value) => setProcedural((current) => ({ ...current, durationSeconds: value }))} suffix="s" />
                <label className="field-label">Direction
                  <select value={procedural.direction} onChange={(event) => setProcedural((current) => ({ ...current, direction: event.target.value as ProceduralSceneImageAnimation["direction"] }))}>
                    <option value="auto">Auto</option><option value="left">Left</option><option value="right">Right</option><option value="up">Up</option><option value="down">Down</option>
                  </select>
                </label>
                <CheckField label="Loop" checked={procedural.loop} onChange={(loopValue) => setProcedural((current) => ({ ...current, loop: loopValue }))} />
              </>
            ) : (
              <>
                <label className="field-label">Animation Mode
                  <select value={aiMode} onChange={(event) => setAIMode(event.target.value as AIImageAnimationMode)}>
                    {AI_ANIMATION_MODES.map((mode) => <option value={mode.value} key={mode.value}>{mode.label}</option>)}
                  </select>
                </label>
                <RangeField label="Number of Frames" value={frameCount} min={2} max={12} step={1} onChange={setFrameCount} />
                <RangeField label="FPS" value={fps} min={1} max={24} step={1} onChange={setFps} />
                <label className="field-label">Frame Duration
                  <input type="number" min={42} max={1000} value={Math.round(1000 / fps)} onChange={(event) => setFps(Math.max(1, Math.min(24, Math.round(1000 / Math.max(42, Number(event.target.value) || 167)))))} />
                </label>
                <RangeField label="Movement Intensity" value={movementIntensity * 100} min={0} max={100} step={1} onChange={(value) => setMovementIntensity(value / 100)} suffix="%" />
                <div className="animation-source-format">
                  <strong>Frame format</strong>
                  <span>
                    {sourceDimensions
                      ? `${sourceDimensions.width}×${sourceDimensions.height} source → ${animationImageSize}`
                      : `Detecting source proportions… → ${animationImageSize}`}
                  </span>
                </div>
                <CheckField label="Include original image as frame" checked={includeOriginal} onChange={setIncludeOriginal} />
                <CheckField label="Loop" checked={loop} onChange={setLoop} />
                <CheckField label="Ping-Pong Playback" checked={pingPong} onChange={setPingPong} />
                {aiMode === "custom" && <label className="field-label">Custom Instruction<textarea rows={4} value={customInstruction} onChange={(event) => setCustomInstruction(event.target.value)} /></label>}
                <div className="ai-project-actions">
                  <button type="button" className="primary-button" disabled={Boolean(activeRequestId) || generationRunning} onClick={() => void generateAllFrames()}>Generate Frames</button>
                  <button type="button" className="danger-button" disabled={!activeRequestId && !generationRunning} onClick={() => void stopGeneration()}>Stop</button>
                  <button type="button" disabled={frames.length < 2 || generationRunning} onClick={() => updateFrames([...frames].reverse())}>Reverse Order</button>
                </div>
              </>
            )}
          </div>
        </div>

        {type === "aiFrames" && frames.length > 0 && (
          <>
            <section className="animation-generation-progress" aria-live="polite">
              <div className="animation-generation-progress-heading">
                <strong>
                  {generationRunning && generatingFrameIndex >= 0
                    ? `Generating frame ${generatingFrameIndex + 1} of ${frames.length}`
                    : generationRunning
                      ? "Preparing AI frames..."
                      : `AI frames: ${readyFrameCount}/${generatedFrameProgress.length} ready`}
                </strong>
                <span>{generationPercent}%{failedFrameCount > 0 ? ` · ${failedFrameCount} failed` : ""}</span>
              </div>
              <progress value={settledFrameCount} max={Math.max(1, generatedFrameProgress.length)} />
            </section>
            <div className="animation-frame-strip">
              {frames.map((frame, index) => {
                const progress = resolveFrameProgress(frame, frameProgress[frame.id]);
                const previewPath = frame.source === "original" ? variant.imagePath : frame.imagePath;
                return (
                  <article className={`animation-frame-card ${selectedFrameId === frame.id ? "selected" : ""}`} key={frame.id}>
                    <button type="button" className="animation-frame-thumb" onClick={() => setSelectedFrameId(frame.id)}>
                      <span className="animation-frame-thumb-visual">
                        {previewPath.trim() ? (
                          <img src={toAnimationMediaSrc(previewPath)} alt={`Frame ${index + 1}`} />
                        ) : (
                          <span className="animation-frame-placeholder">
                            {progress.status === "generating" ? "Generating..." : "Waiting"}
                          </span>
                        )}
                        <span className={`animation-frame-status animation-frame-status-${progress.status}`}>
                          {frameProgressLabel(progress.status)}
                        </span>
                      </span>
                      <span>Frame {index + 1}{frame.source === "original" ? " · original" : ""}</span>
                    </button>
                    {frameErrors[frame.id] && <small className="animation-frame-error">{frameErrors[frame.id]}</small>}
                    <div className="animation-frame-actions">
                      <button type="button" disabled={index === 0 || generationRunning} onClick={() => moveFrame(frame.id, -1)}>←</button>
                      <button type="button" disabled={index === frames.length - 1 || generationRunning} onClick={() => moveFrame(frame.id, 1)}>→</button>
                      <button type="button" disabled={frames.length >= 12 || generationRunning} onClick={() => updateFrames(frames.flatMap((candidate) => candidate.id === frame.id ? [candidate, { ...candidate, id: `${candidate.id}_copy_${Date.now()}` }] : [candidate]))}>Duplicate</button>
                      <button type="button" disabled={generationRunning} onClick={() => {
                        updateFrames(frames.map((candidate) => candidate.id === frame.id ? { ...candidate, source: "original", imagePath: "" } : candidate));
                        setFrameProgress((current) => ({ ...current, [frame.id]: { status: "original" } }));
                      }}>Use Original</button>
                      <button type="button" disabled={Boolean(activeRequestId) || generationRunning} onClick={() => {
                        stoppedRef.current = false;
                        void generateOneFrame(frame.id, frame.instruction);
                      }}>Regenerate</button>
                      <button type="button" className="danger-button" disabled={generationRunning} onClick={() => updateFrames(frames.filter((candidate) => candidate.id !== frame.id))}>Delete</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}

        <div className="image-animation-footer">
          <button type="button" onClick={() => setPreviewPlaying(true)}>Preview Animation</button>
          <button type="button" onClick={() => setPreviewPlaying((playing) => !playing)}>
            {previewPlaying ? "Pause" : "Play"}
          </button>
          <button type="button" onClick={() => setPreviewPlaying(false)}>Stop Preview</button>
          <span className="spacer" />
          <button type="button" className="primary-button" disabled={Boolean(activeRequestId) || generationRunning} onClick={applyAnimation}>Apply</button>
          <button type="button" onClick={closeEditor}>Cancel</button>
        </div>
      </section>
    </div>
  );
}

function createAIAnimation(
  frames: SceneAnimationFrame[],
  mode: AIImageAnimationMode,
  fps: number,
  loop: boolean,
  pingPong: boolean,
  movementIntensity: number,
  customInstruction: string,
  sourceImagePath: string
): AIFramesSceneImageAnimation {
  return { type: "aiFrames", enabled: true, sourceImagePath, mode, fps, loop, pingPong, movementIntensity, customInstruction, frames };
}

function resolveFrameProgress(
  frame: SceneAnimationFrame,
  progress: FrameGenerationProgress | undefined
): FrameGenerationProgress {
  if (progress) return progress;
  if (frame.source === "original") return { status: "original" };
  return { status: frame.imagePath.trim() ? "ready" : "queued" };
}

function frameProgressLabel(status: FrameGenerationStatus): string {
  switch (status) {
    case "original": return "Original";
    case "queued": return "Queued";
    case "generating": return "Generating";
    case "ready": return "Ready";
    case "error": return "Failed";
    case "cancelled": return "Stopped";
  }
}

function RangeField({ label, value, min, max, step, onChange, suffix = "" }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void; suffix?: string }) {
  return <label className="field-label animation-range-field"><span>{label}: {value}{suffix}</span><input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>;
}

function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="checkbox-control"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>;
}
