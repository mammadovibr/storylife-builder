import type {
  AIImageAnimationMode,
  ImageAnimationDirection,
  ProceduralImageAnimationPreset,
  ProceduralSceneImageAnimation,
  SceneAnimationFrame
} from "../domain/project";

export const PROCEDURAL_ANIMATION_PRESETS: Array<{
  value: ProceduralImageAnimationPreset;
  label: string;
  durationSeconds: number;
}> = [
  { value: "slowZoomIn", label: "Slow Zoom In", durationSeconds: 8 },
  { value: "slowZoomOut", label: "Slow Zoom Out", durationSeconds: 8 },
  { value: "panLeft", label: "Pan Left", durationSeconds: 8 },
  { value: "panRight", label: "Pan Right", durationSeconds: 8 },
  { value: "panUp", label: "Pan Up", durationSeconds: 8 },
  { value: "panDown", label: "Pan Down", durationSeconds: 8 },
  { value: "floating", label: "Floating", durationSeconds: 4 },
  { value: "breathing", label: "Breathing", durationSeconds: 4 },
  { value: "gentleSway", label: "Gentle Sway", durationSeconds: 4 },
  { value: "nervousShake", label: "Nervous Shake", durationSeconds: 1.1 },
  { value: "impactShake", label: "Impact Shake", durationSeconds: 0.55 },
  { value: "drunkSway", label: "Drunk Sway", durationSeconds: 4.5 },
  { value: "comicIdle", label: "Comic Idle", durationSeconds: 2.2 },
  { value: "pulse", label: "Pulse", durationSeconds: 2 },
  { value: "fadePulse", label: "Fade Pulse", durationSeconds: 2.4 }
];

export const AI_ANIMATION_MODES: Array<{ value: AIImageAnimationMode; label: string }> = [
  { value: "idle", label: "Idle" },
  { value: "blink", label: "Blink" },
  { value: "talking", label: "Talking" },
  { value: "headMovement", label: "Head Movement" },
  { value: "breathing", label: "Breathing" },
  { value: "nervous", label: "Nervous" },
  { value: "angry", label: "Angry" },
  { value: "comicReaction", label: "Comic Reaction" },
  { value: "hitReaction", label: "Hit Reaction" },
  { value: "custom", label: "Custom" }
];

export function createDefaultProceduralAnimation(
  imagePath: string,
  preset: ProceduralImageAnimationPreset = "slowZoomIn"
): ProceduralSceneImageAnimation {
  return {
    type: "procedural",
    enabled: true,
    sourceImagePath: imagePath,
    preset,
    intensity: 0.35,
    speed: 1,
    durationSeconds:
      PROCEDURAL_ANIMATION_PRESETS.find((candidate) => candidate.value === preset)
        ?.durationSeconds ?? 4,
    direction: "auto",
    loop: true
  };
}

export function getProceduralAnimationFrames(
  preset: ProceduralImageAnimationPreset,
  intensity: number,
  direction: ImageAnimationDirection
): Keyframe[] {
  const amount = Math.max(0, Math.min(1, intensity));
  const translate = 3 + amount * 9;
  const rotate = 0.4 + amount * 2.4;
  const scale = 1 + amount * 0.09;
  const panDirection = resolveDirection(preset, direction);
  const axisTransform = (distance: number) => {
    if (panDirection === "left") return `translateX(${distance}px)`;
    if (panDirection === "right") return `translateX(${-distance}px)`;
    if (panDirection === "up") return `translateY(${distance}px)`;
    return `translateY(${-distance}px)`;
  };

  switch (preset) {
    case "slowZoomIn":
      return [{ transform: "scale(1)" }, { transform: `scale(${scale})` }];
    case "slowZoomOut":
      return [{ transform: `scale(${scale})` }, { transform: "scale(1)" }];
    case "panLeft":
    case "panRight":
    case "panUp":
    case "panDown":
      return [
        { transform: `${axisTransform(-translate)} scale(${1 + amount * 0.04})` },
        { transform: `${axisTransform(translate)} scale(${1 + amount * 0.04})` }
      ];
    case "floating":
      return [
        { transform: `translateY(${translate * 0.45}px) rotate(${-rotate * 0.25}deg)` },
        { transform: `translateY(${-translate * 0.45}px) rotate(${rotate * 0.25}deg)` },
        { transform: `translateY(${translate * 0.45}px) rotate(${-rotate * 0.25}deg)` }
      ];
    case "breathing":
      return [{ transform: "scale(1)" }, { transform: `scale(${1 + amount * 0.025})` }, { transform: "scale(1)" }];
    case "gentleSway":
      return [{ transform: `rotate(${-rotate}deg)` }, { transform: `rotate(${rotate}deg)` }, { transform: `rotate(${-rotate}deg)` }];
    case "nervousShake":
      return shakeFrames(translate * 0.45, rotate * 0.55, false);
    case "impactShake":
      return shakeFrames(translate * 1.25, rotate, true);
    case "drunkSway":
      return [
        { transform: `translate(${-translate}px, ${translate * 0.25}px) rotate(${-rotate}deg)`, filter: "blur(0px) brightness(1)" },
        { transform: `translate(${translate}px, ${-translate * 0.3}px) rotate(${rotate}deg)`, filter: `blur(${amount * 0.8}px) brightness(${1 + amount * 0.05})` },
        { transform: `translate(${-translate}px, ${translate * 0.25}px) rotate(${-rotate}deg)`, filter: "blur(0px) brightness(1)" }
      ];
    case "comicIdle":
      return [
        { transform: "scale(1) rotate(0deg)" },
        { transform: `scale(${1 + amount * 0.045}) rotate(${-rotate * 0.6}deg)`, offset: 0.45 },
        { transform: `scale(${1 + amount * 0.015}) rotate(${rotate * 0.35}deg)`, offset: 0.68 },
        { transform: "scale(1) rotate(0deg)" }
      ];
    case "pulse":
      return [{ transform: "scale(1)" }, { transform: `scale(${1 + amount * 0.07})` }, { transform: "scale(1)" }];
    case "fadePulse":
      return [{ opacity: 1 }, { opacity: Math.max(0.35, 1 - amount * 0.55) }, { opacity: 1 }];
  }
}

export function getProceduralAnimationOptions(animation: ProceduralSceneImageAnimation): KeyframeAnimationOptions {
  return {
    duration: Math.round(animation.durationSeconds * 1000 / animation.speed),
    iterations: animation.loop ? Infinity : 1,
    fill: "both",
    easing: animation.preset === "impactShake" ? "ease-out" : "ease-in-out"
  };
}

export function buildAIFramePlan(
  mode: AIImageAnimationMode,
  frameCount: number,
  movementIntensity: number,
  customInstruction: string,
  includeOriginal = true
): SceneAnimationFrame[] {
  const count = Math.max(2, Math.min(12, Math.round(frameCount)));
  const intensity = movementIntensity < 0.34 ? "extremely subtle" : movementIntensity < 0.67 ? "subtle" : "small but clearly visible";
  const phases = modePhases(mode, intensity, customInstruction);
  let originalFrameUsed = false;
  return Array.from({ length: count }, (_, index) => {
    const phase = phases[index % phases.length];
    const useOriginal = includeOriginal && !originalFrameUsed && phase === "ORIGINAL";
    if (useOriginal) originalFrameUsed = true;
    const generatedInstruction = phase === "ORIGINAL"
      ? "Return very close to the original pose while keeping a tiny visible transitional movement; render this as a distinct animation frame."
      : phase;
    return {
      id: `animation_frame_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
      source: useOriginal ? "original" : "generated",
      imagePath: "",
      instruction: useOriginal
        ? "Use the original image unchanged."
        : `Frame ${index + 1} of ${count}: ${generatedInstruction}`
    };
  });
}

export function createStrictAnimationFramePrompt(
  instruction: string,
  sourceAspectRatio?: number
): string {
  const aspectRatioLine = Number.isFinite(sourceAspectRatio) && Number(sourceAspectRatio) > 0
    ? `The source canvas aspect ratio is ${Number(sourceAspectRatio).toFixed(4)}. Preserve that canvas shape exactly.`
    : "Preserve the source canvas aspect ratio and orientation exactly.";
  return [
    "Treat the attached image as a LOCKED CANVAS for the next frame of a short frame-by-frame animation, not as a loose character reference.",
    aspectRatioLine,
    "Preserve the exact composition, camera position, field of view, crop boundaries, subject scale, body proportions, background, art style, lighting, and every visible object.",
    "Never crop, stretch, zoom, reframe, rotate the camera, widen the view, or move the canvas boundaries.",
    "Preserve exactly which body parts are visible. If the source shows only legs, feet, torso, hands, clothing, or an object, keep that same partial view only.",
    "Do not infer, complete, or add anything outside the original crop. Never add a face, head, eyes, upper body, extra limb, or duplicated body part unless it is already visible in the source.",
    "Change only the explicitly requested tiny movement. Do not redraw the whole scene, add objects, remove objects, change text, or redesign any element.",
    `FRAME CHANGE: ${instruction.trim() || "Make only an extremely subtle natural idle movement."}`
  ].join("\n");
}

export function getAnimationOutputSize(
  imageModel: string,
  sourceWidth: number | undefined,
  sourceHeight: number | undefined,
  fallbackSize = "1024x1024"
): string {
  if (
    !Number.isFinite(sourceWidth) ||
    !Number.isFinite(sourceHeight) ||
    Number(sourceWidth) <= 0 ||
    Number(sourceHeight) <= 0
  ) {
    return imageModel === "gpt-image-2" ? "auto" : fallbackSize;
  }

  const ratio = Math.max(1 / 3, Math.min(3, Number(sourceWidth) / Number(sourceHeight)));
  if (imageModel !== "gpt-image-2") {
    if (ratio > 1.08) return "1536x1024";
    if (ratio < 0.92) return "1024x1536";
    return "1024x1024";
  }

  const targetPixels = 1024 * 1024;
  const sourceWidthInteger = Math.round(Number(sourceWidth));
  const sourceHeightInteger = Math.round(Number(sourceHeight));
  const sourceDivisor = greatestCommonDivisor(sourceWidthInteger, sourceHeightInteger);
  const reducedWidth = sourceWidthInteger / sourceDivisor;
  const reducedHeight = sourceHeightInteger / sourceDivisor;
  const exactScaleStep = leastCommonMultiple(
    16 / greatestCommonDivisor(16, reducedWidth),
    16 / greatestCommonDivisor(16, reducedHeight)
  );
  const exactBasePixels = reducedWidth * reducedHeight * exactScaleStep * exactScaleStep;
  const exactScaleCount = Math.max(1, Math.round(Math.sqrt(targetPixels / exactBasePixels)));
  const exactWidth = reducedWidth * exactScaleStep * exactScaleCount;
  const exactHeight = reducedHeight * exactScaleStep * exactScaleCount;
  if (isValidGPTImage2Size(exactWidth, exactHeight)) {
    return `${exactWidth}x${exactHeight}`;
  }

  const width = roundToMultipleOf16(Math.sqrt(targetPixels * ratio));
  const height = roundToMultipleOf16(Math.sqrt(targetPixels / ratio));
  return `${width}x${height}`;
}

function roundToMultipleOf16(value: number): number {
  return Math.max(16, Math.round(value / 16) * 16);
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(Math.round(left));
  let b = Math.abs(Math.round(right));
  while (b !== 0) {
    [a, b] = [b, a % b];
  }
  return Math.max(1, a);
}

function leastCommonMultiple(left: number, right: number): number {
  return Math.abs(left * right) / greatestCommonDivisor(left, right);
}

function isValidGPTImage2Size(width: number, height: number): boolean {
  const totalPixels = width * height;
  return (
    width <= 3840 &&
    height <= 3840 &&
    width % 16 === 0 &&
    height % 16 === 0 &&
    Math.max(width / height, height / width) <= 3 &&
    totalPixels >= 655_360 &&
    totalPixels <= 8_294_400
  );
}

export function getAIPlaybackOrder(frameCount: number, pingPong: boolean): number[] {
  const forward = Array.from({ length: frameCount }, (_, index) => index);
  if (!pingPong || frameCount < 3) return forward;
  return [...forward, ...forward.slice(1, -1).reverse()];
}

function resolveDirection(
  preset: ProceduralImageAnimationPreset,
  direction: ImageAnimationDirection
): Exclude<ImageAnimationDirection, "auto"> {
  if (direction !== "auto") return direction;
  if (preset === "panRight") return "right";
  if (preset === "panUp") return "up";
  if (preset === "panDown") return "down";
  return "left";
}

function shakeFrames(amount: number, rotate: number, decay: boolean): Keyframe[] {
  const factors = decay ? [0, 1, -0.72, 0.48, -0.28, 0.12, 0] : [0, 0.65, -0.8, 0.75, -0.55, 0.4, 0];
  return factors.map((factor, index) => ({
    transform: `translate(${amount * factor}px, ${amount * factor * -0.38}px) rotate(${rotate * factor}deg)`,
    offset: index / (factors.length - 1)
  }));
}

function modePhases(mode: AIImageAnimationMode, intensity: string, custom: string): string[] {
  switch (mode) {
    case "blink": return ["ORIGINAL", "The character's eyes are fully closed; everything else is unchanged.", "ORIGINAL"];
    case "talking": return ["ORIGINAL", "The character's mouth is slightly open as if speaking; everything else is unchanged.", "The character's mouth is a little more open in the next speech shape; everything else is unchanged.", "ORIGINAL"];
    case "headMovement": return [`The head is turned ${intensity} to the left; everything else is unchanged.`, "ORIGINAL", `The head is turned ${intensity} to the right; everything else is unchanged.`, "ORIGINAL"];
    case "breathing": return ["ORIGINAL", `The chest and shoulders show an ${intensity} inhale movement; everything else is unchanged.`, "ORIGINAL", `The chest and shoulders show an ${intensity} exhale movement; everything else is unchanged.`];
    case "nervous": return [`The gaze and head move ${intensity} to the left with a nervous expression; everything else is unchanged.`, "ORIGINAL", `The gaze and head move ${intensity} to the right; everything else is unchanged.`, "The character briefly blinks with a tiny tense shoulder movement; everything else is unchanged."];
    case "angry": return ["ORIGINAL", `The facial expression becomes ${intensity} more tense and angry; everything else is unchanged.`, `The head makes an ${intensity} sharp movement; everything else is unchanged.`, "ORIGINAL"];
    case "comicReaction": return ["ORIGINAL", `The character makes an ${intensity} surprised comic expression; everything else is unchanged.`, `The upper body leans ${intensity} backward; everything else is unchanged.`, "ORIGINAL"];
    case "hitReaction": return ["ORIGINAL", `The character makes an ${intensity} quick tilt as a reaction to a hit; everything else is unchanged.`, `The face shows an ${intensity} brief impact reaction; everything else is unchanged.`, "ORIGINAL"];
    case "custom": return ["ORIGINAL", `${custom.trim() || "Make a very small natural movement."} The movement must be ${intensity}; everything not mentioned is unchanged.`, "ORIGINAL"];
    case "idle":
    default: return ["ORIGINAL", `The head and shoulders make an ${intensity} lean to the left; everything else is unchanged.`, "ORIGINAL", `The head and shoulders make an ${intensity} lean to the right; everything else is unchanged.`, "The character briefly blinks; everything else is unchanged."];
  }
}
