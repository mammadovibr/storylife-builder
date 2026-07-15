export type SceneId = string;
export type ChoiceId = string;
export type ParameterId = string;
export type FlagId = string;

export type ParameterOperation = "add" | "subtract" | "set";
export type ParameterConditionOperator = ">=" | ">" | "<" | "<=" | "==" | "!=";
export type ConditionFailBehavior = "hidden" | "disabled";
export type SceneType = "normal" | "ending" | "important" | "flagLogic";
export type SceneNodeColor =
  | "slate"
  | "green"
  | "blue"
  | "purple"
  | "amber"
  | "red";
export type SceneVisualMediaType = "image" | "video";
export type ProceduralImageAnimationPreset =
  | "slowZoomIn"
  | "slowZoomOut"
  | "panLeft"
  | "panRight"
  | "panUp"
  | "panDown"
  | "floating"
  | "breathing"
  | "gentleSway"
  | "nervousShake"
  | "impactShake"
  | "drunkSway"
  | "comicIdle"
  | "pulse"
  | "fadePulse";
export type ImageAnimationDirection = "auto" | "left" | "right" | "up" | "down";
export type AIImageAnimationMode =
  | "idle"
  | "blink"
  | "talking"
  | "headMovement"
  | "breathing"
  | "nervous"
  | "angry"
  | "comicReaction"
  | "hitReaction"
  | "custom";

export interface SceneAnimationFrame {
  id: string;
  source: "original" | "generated";
  imagePath: string;
  instruction: string;
}

export interface ProceduralSceneImageAnimation {
  type: "procedural";
  enabled: boolean;
  sourceImagePath: string;
  preset: ProceduralImageAnimationPreset;
  intensity: number;
  speed: number;
  durationSeconds: number;
  direction: ImageAnimationDirection;
  loop: boolean;
}

export interface AIFramesSceneImageAnimation {
  type: "aiFrames";
  enabled: boolean;
  sourceImagePath: string;
  mode: AIImageAnimationMode;
  fps: number;
  loop: boolean;
  pingPong: boolean;
  movementIntensity: number;
  customInstruction: string;
  frames: SceneAnimationFrame[];
}

export type SceneImageAnimation =
  | ProceduralSceneImageAnimation
  | AIFramesSceneImageAnimation;

export interface SceneImageVariant {
  id: string;
  imagePath: string;
  name: string;
  prompt: string;
  referenceIds: string[];
  useReferences: boolean;
  imageStyle: string;
  aspectRatio: string;
  imageModel: string;
  imageQuality: "low" | "medium" | "high";
  createdAt: number;
  animation: SceneImageAnimation | null;
}
export type SceneLayoutType =
  | "imageTop"
  | "imageBackground"
  | "textFirst"
  | "splitLayout"
  | "fullImageMoment"
  | "dialogueStyle"
  | "noImage";

export const SCENE_LAYOUT_OPTIONS: Array<{
  value: SceneLayoutType;
  label: string;
}> = [
  { value: "imageTop", label: "Image Top" },
  { value: "imageBackground", label: "Image Background" },
  { value: "textFirst", label: "Text First" },
  { value: "splitLayout", label: "Split Layout" },
  { value: "fullImageMoment", label: "Full Image Moment" },
  { value: "dialogueStyle", label: "Dialogue Style" },
  { value: "noImage", label: "No Image" }
];

export type SceneTransition =
  | "fade"
  | "crossfade"
  | "zoomIn"
  | "zoomOut"
  | "flipHorizontal"
  | "flipVertical"
  | "softSpiral"
  | "gentleSwing"
  | "depthDissolve"
  | "dreamTilt"
  | "pageTurn";

export type SceneTransitionOverride = SceneTransition | "project";

export type SceneOrnamentStyle =
  | "none"
  | "gilded"
  | "gothic"
  | "forest"
  | "crimson"
  | "ocean"
  | "celestial"
  | "noir"
  | "sakura"
  | "desert"
  | "frost"
  | "cyber"
  | "fairytale";

export const SCENE_TRANSITION_OPTIONS: Array<{
  value: SceneTransition;
  label: string;
}> = [
  { value: "fade", label: "Soft fade" },
  { value: "crossfade", label: "Smooth crossfade" },
  { value: "zoomIn", label: "Smooth zoom in" },
  { value: "zoomOut", label: "Smooth zoom out" },
  { value: "flipHorizontal", label: "Cinematic horizontal flip" },
  { value: "flipVertical", label: "Gallery vertical flip" },
  { value: "softSpiral", label: "Soft spiral dissolve" },
  { value: "gentleSwing", label: "Gentle hanging swing" },
  { value: "depthDissolve", label: "Depth dissolve" },
  { value: "dreamTilt", label: "Dream tilt" },
  { value: "pageTurn", label: "Realistic page turn" }
];

export interface Position {
  x: number;
  y: number;
}

export interface Choice {
  id: ChoiceId;
  text: string;
  targetNodeId: SceneId;
  useMultipleOutcomes: boolean;
  outcomes: ChoiceOutcome[];
  conditionalTargets: ConditionalTarget[];
  effects: ChoiceEffect[];
  conditions: ChoiceCondition[];
  conditionFailBehavior: ConditionFailBehavior;
}

export interface ChoiceOutcome {
  id: string;
  targetSceneId: SceneId;
  percent: number;
}

export interface Scene {
  id: SceneId;
  title: string;
  text: string;
  imagePath: string;
  visualMediaType: SceneVisualMediaType;
  videoLoop: boolean;
  imageVariants: SceneImageVariant[];
  activeImageVariantId: string;
  imageGenerationPrompt: string;
  imageGenerationReferenceIds: string[];
  imageGenerationUseReferences: boolean;
  soundPath: string;
  soundVolume: number;
  soundFadeInSeconds: number;
  soundFadeOutSeconds: number;
  layoutType: SceneLayoutType;
  fadeMusicOnSceneSound: boolean;
  sceneType: SceneType;
  nodeColor: SceneNodeColor;
  style: SceneStyle;
  authorNotes: string;
  position: Position;
  choices: Choice[];
}

export interface ProjectAudioSettings {
  backgroundMusicPath: string;
  musicVolume: number;
  musicFadeInSeconds: number;
  musicFadeOutSeconds: number;
  fadeMusicOnSceneSound: boolean;
  sceneSoundDuckVolume: number;
}

export interface ProjectTheme {
  backgroundColor: string;
  textColor: string;
  sceneTransition: SceneTransition;
  sceneTransitionSpeed: number;
}

export interface SceneStyle {
  sceneTransition: SceneTransitionOverride;
  sceneTransitionSpeed: number;
  ornamentStyle: SceneOrnamentStyle;
  backgroundColor: string;
  textColor: string;
  titlePanelColor: string;
  titleBorderColor: string;
  titleTextColor: string;
  showSceneTitle: boolean;
  titleBorderEnabled: boolean;
  titlePanelTransparent: boolean;
  titlePanelOpacity: number;
  titlePanelWidth: number;
  titlePanelHeight: number;
  titlePaddingTop: number;
  titlePaddingSide: number;
  textPanelColor: string;
  textBorderColor: string;
  textBorderEnabled: boolean;
  textPanelTransparent: boolean;
  textPanelOpacity: number;
  textPanelWidth: number;
  textPanelHeight: number;
  textPaddingTop: number;
  textPaddingSide: number;
  titleFontSize: number;
  textFontSize: number;
  textFontFamily: string;
  textAlign: "left" | "center";
  imageOffsetX: number;
  imageOffsetY: number;
  imageScale: number;
  imageOpacity: number;
  imageBrightness: number;
  imageCropTop: number;
  imageCropRight: number;
  imageCropBottom: number;
  imageCropLeft: number;
  titleOffsetX: number;
  titleOffsetY: number;
  titleTextOffsetX: number;
  titleTextOffsetY: number;
  titleScale: number;
  textOffsetX: number;
  textOffsetY: number;
  sceneTextOffsetX: number;
  sceneTextOffsetY: number;
  textScale: number;
  choicesOffsetX: number;
  choicesOffsetY: number;
  choiceTextOffsetX: number;
  choiceTextOffsetY: number;
  choicesPanelColor: string;
  choicesBorderColor: string;
  choicesTextColor: string;
  choicesBorderEnabled: boolean;
  choicesFrameStyle: string;
  choicesPanelTransparent: boolean;
  choicesPanelOpacity: number;
  choicesPaddingTop: number;
  choicesPaddingSide: number;
  choicesFontSize: number;
  choicesFontFamily: string;
  choicesPanelWidth: number;
  choicesPanelHeight: number;
  choicesScale: number;
}

export type MediaAssetType = "image" | "video" | "audio";

export interface MediaAsset {
  id: string;
  name: string;
  path: string;
  type: MediaAssetType;
}

export interface MediaFolder {
  id: string;
  name: string;
  path: string;
  assets: MediaAsset[];
}

export interface MediaLibrary {
  folders: MediaFolder[];
}

export interface CharacterReference {
  id: string;
  name: string;
  imagePath: string;
  notes: string;
}

export interface ConditionalTarget {
  id: string;
  conditions: ChoiceCondition[];
  targetSceneId: SceneId;
}

export interface StoryParameter {
  id: ParameterId;
  key: string;
  initialValue: number;
  minValue: number | null;
  maxValue: number | null;
}

export interface StoryFlag {
  id: FlagId;
  key: string;
  defaultValue: boolean;
}

export type ChoiceEffect = ParameterEffect | FlagEffect;

export interface ParameterEffect {
  id: string;
  type: "parameter";
  parameterId: ParameterId;
  operation: ParameterOperation;
  value: number;
}

export interface FlagEffect {
  id: string;
  type: "flag";
  flagId: FlagId;
  value: boolean;
}

export type ChoiceCondition = ParameterCondition | FlagCondition;

export interface ParameterCondition {
  id: string;
  type: "parameter";
  parameterId: ParameterId;
  operator: ParameterConditionOperator;
  value: number;
}

export interface FlagCondition {
  id: string;
  type: "flag";
  flagId: FlagId;
  expectedValue: boolean;
}

export interface RuntimeState {
  parameters: Record<ParameterId, number>;
  flags: Record<FlagId, boolean>;
}

export interface StoryChapterPlanItem {
  id: string;
  title: string;
  summary: string;
  targetSceneRange: string;
  status: "planned" | "inProgress" | "complete";
}

export interface StoryBible {
  premise: string;
  genre: string;
  tone: string;
  protagonist: string;
  coreConflict: string;
  currentArcSummary: string;
  keyCharacters: string[];
  worldRules: string[];
  openMysteries: string[];
  resolvedMysteries: string[];
  promisesToPayOff: string[];
  importantPastEvents: string[];
  continuityNotes: string[];
  endingPlan: string[];
  chapterPlan: StoryChapterPlanItem[];
}

export interface StoryProjectV1 {
  version: 1;
  projectName: string;
  startSceneId: SceneId;
  storyStyles: string[];
  parameters: StoryParameter[];
  flags: StoryFlag[];
  audio: ProjectAudioSettings;
  theme: ProjectTheme;
  mediaLibrary: MediaLibrary;
  characterReferences: CharacterReference[];
  storyBible: StoryBible;
  scenes: Scene[];
}

export type StoryProject = StoryProjectV1;

export function createScene(index: number, id = `scene_${index}`): Scene {
  return {
    id,
    title: `Scene ${index}`,
    text: "",
    imagePath: "",
    visualMediaType: "image",
    videoLoop: true,
    imageVariants: [],
    activeImageVariantId: "",
    imageGenerationPrompt: "",
    imageGenerationReferenceIds: [],
    imageGenerationUseReferences: true,
    soundPath: "",
    soundVolume: 1,
    soundFadeInSeconds: 0,
    soundFadeOutSeconds: 0,
    layoutType: "imageTop",
    fadeMusicOnSceneSound: true,
    sceneType: "normal",
    nodeColor: "slate",
    style: createDefaultSceneStyle(),
    authorNotes: "",
    position: {
      x: 120 + ((index - 1) % 4) * 260,
      y: 120 + Math.floor((index - 1) / 4) * 180
    },
    choices: []
  };
}

export function createSceneImageVariant(
  imagePath: string,
  options: {
    id?: string;
    name?: string;
    prompt?: string;
    referenceIds?: string[];
    useReferences?: boolean;
    imageStyle?: string;
    aspectRatio?: string;
    imageModel?: string;
    imageQuality?: "low" | "medium" | "high";
    createdAt?: number;
    animation?: SceneImageAnimation | null;
  } = {}
): SceneImageVariant {
  return {
    id: options.id ?? `image_variant_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    imagePath,
    name: options.name ?? "Image variant",
    prompt: options.prompt ?? "",
    referenceIds: [...new Set(options.referenceIds ?? [])].slice(0, 3),
    useReferences: options.useReferences ?? (options.referenceIds?.length ?? 0) > 0,
    imageStyle: options.imageStyle ?? "",
    aspectRatio: options.aspectRatio ?? "",
    imageModel: options.imageModel ?? "",
    imageQuality: options.imageQuality ?? "low",
    createdAt: options.createdAt ?? Date.now(),
    animation: options.animation ?? null
  };
}

export function applySceneVisual(
  scene: Scene,
  imagePath: string,
  visualMediaType: SceneVisualMediaType,
  variantDetails?: {
    name?: string;
    prompt?: string;
    referenceIds?: string[];
    useReferences?: boolean;
    imageStyle?: string;
    aspectRatio?: string;
    imageModel?: string;
    imageQuality?: "low" | "medium" | "high";
  }
): Scene {
  if (!imagePath.trim() || visualMediaType === "video") {
    return {
      ...scene,
      imagePath,
      visualMediaType,
      activeImageVariantId: ""
    };
  }

  const existingVariant = scene.imageVariants.find(
    (variant) => variant.imagePath === imagePath
  );
  const variant = existingVariant ?? createSceneImageVariant(imagePath, variantDetails);
  return {
    ...scene,
    imagePath,
    visualMediaType: "image",
    imageVariants: existingVariant
      ? scene.imageVariants
      : [...scene.imageVariants, variant],
    activeImageVariantId: variant.id
  };
}

export function activateSceneImageVariant(scene: Scene, variantId: string): Scene {
  const variant = scene.imageVariants.find((candidate) => candidate.id === variantId);
  return variant
    ? {
        ...scene,
        imagePath: variant.imagePath,
        visualMediaType: "image",
        activeImageVariantId: variant.id
      }
    : scene;
}

export function getActiveSceneImageVariant(scene: Scene): SceneImageVariant | null {
  return (
    scene.imageVariants.find((variant) => variant.id === scene.activeImageVariantId) ??
    scene.imageVariants.find((variant) => variant.imagePath === scene.imagePath) ??
    null
  );
}

export function createChoice(
  targetNodeId: SceneId,
  id = "choice_1"
): Choice {
  return {
    id,
    text: "",
    targetNodeId,
    useMultipleOutcomes: false,
    outcomes: [createChoiceOutcome(targetNodeId, 100, `outcome_${id}`)],
    conditionalTargets: [],
    effects: [],
    conditions: [],
    conditionFailBehavior: "disabled"
  };
}

export function createChoiceOutcome(
  targetSceneId: SceneId,
  percent = 100,
  id = "outcome_1"
): ChoiceOutcome {
  return {
    id,
    targetSceneId,
    percent
  };
}

export function createParameter(
  index: number,
  id = `parameter_${index}`
): StoryParameter {
  return {
    id,
    key: `parameter_${index}`,
    initialValue: 0,
    minValue: null,
    maxValue: null
  };
}

export function createFlag(index: number, id = `flag_${index}`): StoryFlag {
  return {
    id,
    key: `flag_${index}`,
    defaultValue: false
  };
}

export function createParameterEffect(
  parameterId: ParameterId,
  id = "effect_1"
): ParameterEffect {
  return {
    id,
    type: "parameter",
    parameterId,
    operation: "add",
    value: 0
  };
}

export function createFlagEffect(flagId: FlagId, id = "effect_1"): FlagEffect {
  return {
    id,
    type: "flag",
    flagId,
    value: true
  };
}

export function createParameterCondition(
  parameterId: ParameterId,
  id = "condition_1"
): ParameterCondition {
  return {
    id,
    type: "parameter",
    parameterId,
    operator: ">=",
    value: 0
  };
}

export function createFlagCondition(
  flagId: FlagId,
  id = "condition_1"
): FlagCondition {
  return {
    id,
    type: "flag",
    flagId,
    expectedValue: true
  };
}

export function createConditionalTarget(
  flagId: FlagId,
  targetSceneId: SceneId,
  id = "conditional_target_1"
): ConditionalTarget {
  return {
    id,
    targetSceneId,
    conditions: [createFlagCondition(flagId, `condition_${id}`)]
  };
}

export function createDefaultProject(): StoryProject {
  const firstScene = createScene(1);

  return {
    version: 1,
    projectName: "Untitled StoryLife Project",
    startSceneId: firstScene.id,
    storyStyles: createDefaultStoryStyles(),
    parameters: [],
    flags: [],
    audio: createDefaultAudioSettings(),
    theme: createDefaultProjectTheme(),
    mediaLibrary: createDefaultMediaLibrary(),
    characterReferences: [],
    storyBible: createDefaultStoryBible(),
    scenes: [firstScene]
  };
}

export function createDefaultStoryStyles(): string[] {
  return ["adventure", "cinematic"];
}

export function createDefaultAudioSettings(): ProjectAudioSettings {
  return {
    backgroundMusicPath: "",
    musicVolume: 0.55,
    musicFadeInSeconds: 0.8,
    musicFadeOutSeconds: 0.8,
    fadeMusicOnSceneSound: true,
    sceneSoundDuckVolume: 0.18
  };
}

export function createDefaultProjectTheme(): ProjectTheme {
  return {
    backgroundColor: "#eee8dc",
    textColor: "#26231f",
    sceneTransition: "fade",
    sceneTransitionSpeed: 1
  };
}

export function createDefaultSceneStyle(): SceneStyle {
  return {
    sceneTransition: "project",
    sceneTransitionSpeed: 0,
    ornamentStyle: "none",
    backgroundColor: "",
    textColor: "",
    titlePanelColor: "",
    titleBorderColor: "",
    titleTextColor: "",
    showSceneTitle: true,
    titleBorderEnabled: true,
    titlePanelTransparent: false,
    titlePanelOpacity: 0.82,
    titlePanelWidth: 0,
    titlePanelHeight: 0,
    titlePaddingTop: 4,
    titlePaddingSide: 10,
    textPanelColor: "",
    textBorderColor: "",
    textBorderEnabled: true,
    textPanelTransparent: false,
    textPanelOpacity: 0.82,
    textPanelWidth: 0,
    textPanelHeight: 0,
    textPaddingTop: 10,
    textPaddingSide: 14,
    titleFontSize: 22,
    textFontSize: 16,
    textFontFamily: "system",
    textAlign: "left",
    imageOffsetX: 0,
    imageOffsetY: 0,
    imageScale: 1,
    imageOpacity: 1,
    imageBrightness: 1,
    imageCropTop: 0,
    imageCropRight: 0,
    imageCropBottom: 0,
    imageCropLeft: 0,
    titleOffsetX: 0,
    titleOffsetY: 0,
    titleTextOffsetX: 0,
    titleTextOffsetY: 0,
    titleScale: 1,
    textOffsetX: 0,
    textOffsetY: 0,
    sceneTextOffsetX: 0,
    sceneTextOffsetY: 0,
    textScale: 1,
    choicesOffsetX: 0,
    choicesOffsetY: 0,
    choiceTextOffsetX: 0,
    choiceTextOffsetY: 0,
    choicesPanelColor: "",
    choicesBorderColor: "",
    choicesTextColor: "",
    choicesBorderEnabled: true,
    choicesFrameStyle: "none",
    choicesPanelTransparent: false,
    choicesPanelOpacity: 0.92,
    choicesPaddingTop: 9,
    choicesPaddingSide: 10,
    choicesFontSize: 16,
    choicesFontFamily: "system",
    choicesPanelWidth: 0,
    choicesPanelHeight: 0,
    choicesScale: 1
  };
}

export function createDefaultMediaLibrary(): MediaLibrary {
  return {
    folders: []
  };
}

export function createDefaultStoryBible(): StoryBible {
  return {
    premise: "",
    genre: "",
    tone: "",
    protagonist: "",
    coreConflict: "",
    currentArcSummary: "",
    keyCharacters: [],
    worldRules: [],
    openMysteries: [],
    resolvedMysteries: [],
    promisesToPayOff: [],
    importantPastEvents: [],
    continuityNotes: [],
    endingPlan: [],
    chapterPlan: []
  };
}

export function createRuntimeState(project: StoryProject): RuntimeState {
  return {
    parameters: Object.fromEntries(
      project.parameters.map((parameter) => [
        parameter.id,
        clampParameterValue(parameter.initialValue, parameter)
      ])
    ),
    flags: Object.fromEntries(
      project.flags.map((flag) => [flag.id, flag.defaultValue])
    )
  };
}

export function choiceConditionsPass(
  choice: Choice,
  runtimeState: RuntimeState
): boolean {
  return choice.conditions.every((condition) => {
    if (condition.type === "parameter") {
      const currentValue = runtimeState.parameters[condition.parameterId] ?? 0;
      return compareNumber(currentValue, condition.operator, condition.value);
    }

    return (
      (runtimeState.flags[condition.flagId] ?? false) === condition.expectedValue
    );
  });
}

export function resolveChoiceTarget(
  choice: Choice,
  runtimeState: RuntimeState
): SceneId {
  for (const conditionalTarget of choice.conditionalTargets) {
    if (
      conditionalTarget.conditions.every((condition) =>
        conditionPasses(condition, runtimeState)
      )
    ) {
      return conditionalTarget.targetSceneId;
    }
  }

  if (choice.useMultipleOutcomes && choice.outcomes.length > 0) {
    return resolveProbableChoiceOutcome(choice);
  }

  return choice.targetNodeId;
}

export function resolveProbableChoiceOutcome(choice: Choice): SceneId {
  if (choice.outcomes.length === 0) {
    return choice.targetNodeId;
  }

  if (choice.outcomes.length === 1) {
    return choice.outcomes[0].targetSceneId || choice.targetNodeId;
  }

  const total = choice.outcomes.reduce(
    (sum, outcome) => sum + Math.max(0, outcome.percent),
    0
  );

  if (total <= 0) {
    return choice.outcomes[0].targetSceneId || choice.targetNodeId;
  }

  let roll = Math.random() * total;
  for (const outcome of choice.outcomes) {
    roll -= Math.max(0, outcome.percent);
    if (roll <= 0) {
      return outcome.targetSceneId || choice.targetNodeId;
    }
  }

  return choice.outcomes[choice.outcomes.length - 1].targetSceneId || choice.targetNodeId;
}

export function applyChoiceEffects(
  project: StoryProject,
  runtimeState: RuntimeState,
  choice: Choice
): RuntimeState {
  const parameters = { ...runtimeState.parameters };
  const flags = { ...runtimeState.flags };

  for (const effect of choice.effects) {
    if (effect.type === "parameter") {
      const parameter = project.parameters.find(
        (item) => item.id === effect.parameterId
      );
      const currentValue = parameters[effect.parameterId] ?? 0;
      const nextValue =
        effect.operation === "add"
          ? currentValue + effect.value
          : effect.operation === "subtract"
            ? currentValue - effect.value
            : effect.value;

      parameters[effect.parameterId] = parameter
        ? clampParameterValue(nextValue, parameter)
        : nextValue;
    } else {
      flags[effect.flagId] = effect.value;
    }
  }

  return { parameters, flags };
}

function conditionPasses(
  condition: ChoiceCondition,
  runtimeState: RuntimeState
): boolean {
  if (condition.type === "parameter") {
    const currentValue = runtimeState.parameters[condition.parameterId] ?? 0;
    return compareNumber(currentValue, condition.operator, condition.value);
  }

  return (
    (runtimeState.flags[condition.flagId] ?? false) === condition.expectedValue
  );
}

export function serializeProject(project: StoryProject): string {
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function migrateProject(rawProject: unknown): StoryProject {
  if (!isRecord(rawProject)) {
    throw new Error("Project file is not a valid JSON object.");
  }

  if (rawProject.version === 1) {
    return validateProjectV1(rawProject);
  }

  throw new Error(`Unsupported project version: ${String(rawProject.version)}`);
}

export function validateProjectV1(rawProject: unknown): StoryProjectV1 {
  if (!isRecord(rawProject)) {
    throw new Error("Project must be an object.");
  }

  if (rawProject.version !== 1) {
    throw new Error("Project version must be 1.");
  }

  if (typeof rawProject.projectName !== "string") {
    throw new Error("Project name is missing.");
  }

  if (typeof rawProject.startSceneId !== "string") {
    throw new Error("Start scene id is missing.");
  }

  if (!Array.isArray(rawProject.scenes)) {
    throw new Error("Project scenes must be an array.");
  }

  const scenes = ensureUniqueChoiceIds(rawProject.scenes.map(validateScene));
  const parameters = Array.isArray(rawProject.parameters)
    ? rawProject.parameters.map(validateParameter)
    : [];
  const flags = Array.isArray(rawProject.flags)
    ? rawProject.flags.map(validateFlag)
    : [];
  const sceneIds = new Set(scenes.map((scene) => scene.id));

  if (!sceneIds.has(rawProject.startSceneId)) {
    throw new Error("Start scene points to a missing scene.");
  }

  for (const scene of scenes) {
    for (const choice of scene.choices) {
      if (!sceneIds.has(choice.targetNodeId)) {
        throw new Error(`Choice "${choice.text}" points to a missing scene.`);
      }
      for (const outcome of choice.outcomes) {
        if (!sceneIds.has(outcome.targetSceneId)) {
          throw new Error(
            `Choice "${choice.text}" probability outcome points to a missing scene.`
          );
        }
      }
      for (const conditionalTarget of choice.conditionalTargets) {
        if (!sceneIds.has(conditionalTarget.targetSceneId)) {
          throw new Error(
            `Choice "${choice.text}" conditional target points to a missing scene.`
          );
        }
      }
    }
  }

  return {
    version: 1,
    projectName: rawProject.projectName,
    startSceneId: rawProject.startSceneId,
    storyStyles: validateStoryStyles(rawProject.storyStyles),
    parameters,
    flags,
    audio: validateAudioSettings(rawProject.audio),
    theme: validateProjectTheme(rawProject.theme),
    mediaLibrary: validateMediaLibrary(rawProject.mediaLibrary),
    characterReferences: validateCharacterReferences(rawProject.characterReferences),
    storyBible: validateStoryBible(rawProject.storyBible),
    scenes
  };
}

function validateStoryStyles(rawStoryStyles: unknown): string[] {
  if (!Array.isArray(rawStoryStyles)) {
    return createDefaultStoryStyles();
  }

  const styles = rawStoryStyles
    .filter((style): style is string => typeof style === "string")
    .slice(0, 3);

  return styles.length > 0 ? styles : createDefaultStoryStyles();
}

function validateStoryBible(rawStoryBible: unknown): StoryBible {
  if (!isRecord(rawStoryBible)) {
    return createDefaultStoryBible();
  }

  return {
    premise: readString(rawStoryBible.premise),
    genre: readString(rawStoryBible.genre),
    tone: readString(rawStoryBible.tone),
    protagonist: readString(rawStoryBible.protagonist),
    coreConflict: readString(rawStoryBible.coreConflict),
    currentArcSummary: readString(rawStoryBible.currentArcSummary),
    keyCharacters: readStringArray(rawStoryBible.keyCharacters),
    worldRules: readStringArray(rawStoryBible.worldRules),
    openMysteries: readStringArray(rawStoryBible.openMysteries),
    resolvedMysteries: readStringArray(rawStoryBible.resolvedMysteries),
    promisesToPayOff: readStringArray(rawStoryBible.promisesToPayOff),
    importantPastEvents: readStringArray(rawStoryBible.importantPastEvents),
    continuityNotes: readStringArray(rawStoryBible.continuityNotes),
    endingPlan: readStringArray(rawStoryBible.endingPlan),
    chapterPlan: Array.isArray(rawStoryBible.chapterPlan)
      ? rawStoryBible.chapterPlan.map(validateChapterPlanItem)
      : []
  };
}

function validateChapterPlanItem(rawItem: unknown): StoryChapterPlanItem {
  if (!isRecord(rawItem)) {
    return {
      id: createId("chapter"),
      title: "Chapter",
      summary: "",
      targetSceneRange: "",
      status: "planned"
    };
  }

  return {
    id: readString(rawItem.id) || createId("chapter"),
    title: readString(rawItem.title) || "Chapter",
    summary: readString(rawItem.summary),
    targetSceneRange: readString(rawItem.targetSceneRange),
    status:
      rawItem.status === "inProgress" || rawItem.status === "complete"
        ? rawItem.status
        : "planned"
  };
}

function validateAudioSettings(rawAudio: unknown): ProjectAudioSettings {
  if (!isRecord(rawAudio)) {
    return createDefaultAudioSettings();
  }

  return {
    backgroundMusicPath:
      typeof rawAudio.backgroundMusicPath === "string"
        ? rawAudio.backgroundMusicPath
        : "",
    musicVolume: clampNumber(readNumber(rawAudio.musicVolume, 0.55), 0, 1),
    musicFadeInSeconds: clampNumber(
      readNumber(rawAudio.musicFadeInSeconds, 0.8),
      0,
      15
    ),
    musicFadeOutSeconds: clampNumber(
      readNumber(rawAudio.musicFadeOutSeconds, 0.8),
      0,
      15
    ),
    fadeMusicOnSceneSound:
      typeof rawAudio.fadeMusicOnSceneSound === "boolean"
        ? rawAudio.fadeMusicOnSceneSound
        : true,
    sceneSoundDuckVolume: clampNumber(
      readNumber(rawAudio.sceneSoundDuckVolume, 0.18),
      0,
      1
    )
  };
}

function validateProjectTheme(rawTheme: unknown): ProjectTheme {
  if (!isRecord(rawTheme)) {
    return createDefaultProjectTheme();
  }

  return {
    backgroundColor: readColor(rawTheme.backgroundColor, "#eee8dc"),
    textColor: readColor(rawTheme.textColor, "#26231f"),
    sceneTransition: readSceneTransition(rawTheme.sceneTransition),
    sceneTransitionSpeed: clampNumber(
      readNumber(rawTheme.sceneTransitionSpeed, 1),
      0.5,
      2
    )
  };
}

function validateMediaLibrary(rawMediaLibrary: unknown): MediaLibrary {
  if (!isRecord(rawMediaLibrary) || !Array.isArray(rawMediaLibrary.folders)) {
    return createDefaultMediaLibrary();
  }

  return {
    folders: rawMediaLibrary.folders.map(validateMediaFolder)
  };
}

function validateMediaFolder(rawFolder: unknown): MediaFolder {
  if (!isRecord(rawFolder)) {
    return {
      id: createId("media_folder"),
      name: "Media folder",
      path: "",
      assets: []
    };
  }

  return {
    id: typeof rawFolder.id === "string" ? rawFolder.id : createId("media_folder"),
    name: typeof rawFolder.name === "string" ? rawFolder.name : "Media folder",
    path: typeof rawFolder.path === "string" ? rawFolder.path : "",
    assets: Array.isArray(rawFolder.assets)
      ? rawFolder.assets.map(validateMediaAsset)
      : []
  };
}

function validateMediaAsset(rawAsset: unknown): MediaAsset {
  if (!isRecord(rawAsset)) {
    return {
      id: createId("media_asset"),
      name: "Media",
      path: "",
      type: "image"
    };
  }

  return {
    id: typeof rawAsset.id === "string" ? rawAsset.id : createId("media_asset"),
    name: typeof rawAsset.name === "string" ? rawAsset.name : "Media",
    path: typeof rawAsset.path === "string" ? rawAsset.path : "",
    type: rawAsset.type === "audio" ? "audio" : "image"
  };
}

function validateCharacterReferences(rawReferences: unknown): CharacterReference[] {
  if (!Array.isArray(rawReferences)) {
    return [];
  }

  return rawReferences
    .filter(isRecord)
    .map((reference, index) => ({
      id:
        typeof reference.id === "string" && reference.id.trim() !== ""
          ? reference.id
          : `character_ref_${index + 1}`,
      name:
        typeof reference.name === "string" && reference.name.trim() !== ""
          ? reference.name
          : `Character ${index + 1}`,
      imagePath: typeof reference.imagePath === "string" ? reference.imagePath : "",
      notes: typeof reference.notes === "string" ? reference.notes : ""
    }))
    .filter((reference) => reference.imagePath.trim() !== "");
}

function validateParameter(rawParameter: unknown): StoryParameter {
  if (!isRecord(rawParameter)) {
    throw new Error("Parameter must be an object.");
  }

  if (typeof rawParameter.id !== "string") {
    throw new Error("Parameter id is missing.");
  }

  if (typeof rawParameter.key !== "string") {
    throw new Error(`Parameter "${rawParameter.id}" key is missing.`);
  }

  return {
    id: rawParameter.id,
    key: rawParameter.key,
    initialValue: readNumber(rawParameter.initialValue, 0),
    minValue: readOptionalNumber(rawParameter.minValue),
    maxValue: readOptionalNumber(rawParameter.maxValue)
  };
}

function validateFlag(rawFlag: unknown): StoryFlag {
  if (!isRecord(rawFlag)) {
    throw new Error("Flag must be an object.");
  }

  if (typeof rawFlag.id !== "string") {
    throw new Error("Flag id is missing.");
  }

  if (typeof rawFlag.key !== "string") {
    throw new Error(`Flag "${rawFlag.id}" key is missing.`);
  }

  return {
    id: rawFlag.id,
    key: rawFlag.key,
    defaultValue:
      typeof rawFlag.defaultValue === "boolean" ? rawFlag.defaultValue : false
  };
}

function validateScene(rawScene: unknown): Scene {
  if (!isRecord(rawScene)) {
    throw new Error("Scene must be an object.");
  }

  if (typeof rawScene.id !== "string") {
    throw new Error("Scene id is missing.");
  }

  if (typeof rawScene.title !== "string") {
    throw new Error(`Scene "${rawScene.id}" title is missing.`);
  }

  if (typeof rawScene.text !== "string") {
    throw new Error(`Scene "${rawScene.id}" text is missing.`);
  }

  if (!isRecord(rawScene.position)) {
    throw new Error(`Scene "${rawScene.id}" position is missing.`);
  }

  if (
    typeof rawScene.position.x !== "number" ||
    typeof rawScene.position.y !== "number"
  ) {
    throw new Error(`Scene "${rawScene.id}" position is invalid.`);
  }

  if (!Array.isArray(rawScene.choices)) {
    throw new Error(`Scene "${rawScene.id}" choices must be an array.`);
  }

  return {
    id: rawScene.id,
    title: rawScene.title,
    text: rawScene.text,
    imagePath:
      typeof rawScene.imagePath === "string" ? rawScene.imagePath : "",
    visualMediaType: readSceneVisualMediaType(
      rawScene.visualMediaType,
      typeof rawScene.imagePath === "string" ? rawScene.imagePath : ""
    ),
    videoLoop:
      typeof rawScene.videoLoop === "boolean" ? rawScene.videoLoop : true,
    imageVariants: readSceneImageVariants(rawScene, rawScene.id),
    activeImageVariantId: readActiveImageVariantId(rawScene, rawScene.id),
    imageGenerationPrompt: readString(rawScene.imageGenerationPrompt),
    imageGenerationReferenceIds: readStringArray(
      rawScene.imageGenerationReferenceIds
    ).slice(0, 3),
    imageGenerationUseReferences:
      typeof rawScene.imageGenerationUseReferences === "boolean"
        ? rawScene.imageGenerationUseReferences
        : true,
    soundPath:
      typeof rawScene.soundPath === "string" ? rawScene.soundPath : "",
    soundVolume: clampNumber(readNumber(rawScene.soundVolume, 1), 0, 1),
    soundFadeInSeconds: clampNumber(
      readNumber(rawScene.soundFadeInSeconds, 0),
      0,
      15
    ),
    soundFadeOutSeconds: clampNumber(
      readNumber(rawScene.soundFadeOutSeconds, 0),
      0,
      15
    ),
    layoutType: readSceneLayoutType(rawScene.layoutType),
    fadeMusicOnSceneSound:
      typeof rawScene.fadeMusicOnSceneSound === "boolean"
        ? rawScene.fadeMusicOnSceneSound
        : true,
    sceneType: readSceneType(rawScene.sceneType),
    nodeColor: readSceneNodeColor(rawScene.nodeColor),
    style: validateSceneStyle(rawScene.style),
    authorNotes:
      typeof rawScene.authorNotes === "string" ? rawScene.authorNotes : "",
    position: {
      x: rawScene.position.x,
      y: rawScene.position.y
    },
    choices: rawScene.choices.map(validateChoice)
  };
}

function readSceneImageVariants(rawScene: Record<string, unknown>, sceneId: string): SceneImageVariant[] {
  const variants = Array.isArray(rawScene.imageVariants)
    ? rawScene.imageVariants
        .map((rawVariant, index) => readSceneImageVariant(rawVariant, sceneId, index))
        .filter((variant): variant is SceneImageVariant => variant !== null)
    : [];
  const imagePath = typeof rawScene.imagePath === "string" ? rawScene.imagePath : "";
  const isImage = readSceneVisualMediaType(rawScene.visualMediaType, imagePath) === "image";
  if (imagePath.trim() && isImage && !variants.some((variant) => variant.imagePath === imagePath)) {
    variants.push(createSceneImageVariant(imagePath, {
      id: `image_variant_${sceneId}_legacy`,
      name: "Original image",
      createdAt: 0,
      animation: readSceneImageAnimation(rawScene.imageAnimation)
    }));
  }
  return variants;
}

function readActiveImageVariantId(rawScene: Record<string, unknown>, sceneId: string): string {
  const variants = readSceneImageVariants(rawScene, sceneId);
  const requestedId = typeof rawScene.activeImageVariantId === "string"
    ? rawScene.activeImageVariantId
    : "";
  if (variants.some((variant) => variant.id === requestedId)) return requestedId;
  const imagePath = typeof rawScene.imagePath === "string" ? rawScene.imagePath : "";
  return variants.find((variant) => variant.imagePath === imagePath)?.id ?? "";
}

function readSceneImageVariant(
  rawVariant: unknown,
  sceneId: string,
  index: number
): SceneImageVariant | null {
  if (!isRecord(rawVariant) || typeof rawVariant.imagePath !== "string" || !rawVariant.imagePath.trim()) {
    return null;
  }
  return createSceneImageVariant(rawVariant.imagePath, {
    id: typeof rawVariant.id === "string" && rawVariant.id.trim()
      ? rawVariant.id
      : `image_variant_${sceneId}_${index + 1}`,
    name: typeof rawVariant.name === "string" ? rawVariant.name : `Image ${index + 1}`,
    prompt: typeof rawVariant.prompt === "string" ? rawVariant.prompt : "",
    referenceIds: readStringArray(rawVariant.referenceIds).slice(0, 3),
    useReferences:
      typeof rawVariant.useReferences === "boolean"
        ? rawVariant.useReferences
        : readStringArray(rawVariant.referenceIds).length > 0,
    imageStyle: readString(rawVariant.imageStyle),
    aspectRatio: readString(rawVariant.aspectRatio),
    imageModel: readString(rawVariant.imageModel),
    imageQuality:
      rawVariant.imageQuality === "medium" || rawVariant.imageQuality === "high"
        ? rawVariant.imageQuality
        : "low",
    createdAt: readNumber(rawVariant.createdAt, 0),
    animation: readSceneImageAnimation(rawVariant.animation)
  });
}

function readSceneImageAnimation(rawAnimation: unknown): SceneImageAnimation | null {
  if (!isRecord(rawAnimation)) return null;
  const enabled = typeof rawAnimation.enabled === "boolean" ? rawAnimation.enabled : true;
  const sourceImagePath = typeof rawAnimation.sourceImagePath === "string"
    ? rawAnimation.sourceImagePath
    : "";
  if (rawAnimation.type === "procedural") {
    const presets: ProceduralImageAnimationPreset[] = [
      "slowZoomIn", "slowZoomOut", "panLeft", "panRight", "panUp", "panDown",
      "floating", "breathing", "gentleSway", "nervousShake", "impactShake",
      "drunkSway", "comicIdle", "pulse", "fadePulse"
    ];
    const directions: ImageAnimationDirection[] = ["auto", "left", "right", "up", "down"];
    return {
      type: "procedural",
      enabled,
      sourceImagePath,
      preset: presets.includes(rawAnimation.preset as ProceduralImageAnimationPreset)
        ? rawAnimation.preset as ProceduralImageAnimationPreset
        : "slowZoomIn",
      intensity: clampNumber(readNumber(rawAnimation.intensity, 0.35), 0, 1),
      speed: clampNumber(readNumber(rawAnimation.speed, 1), 0.25, 3),
      durationSeconds: clampNumber(readNumber(rawAnimation.durationSeconds, 6), 0.4, 30),
      direction: directions.includes(rawAnimation.direction as ImageAnimationDirection)
        ? rawAnimation.direction as ImageAnimationDirection
        : "auto",
      loop: typeof rawAnimation.loop === "boolean" ? rawAnimation.loop : true
    };
  }
  if (rawAnimation.type !== "aiFrames") return null;
  const modes: AIImageAnimationMode[] = [
    "idle", "blink", "talking", "headMovement", "breathing", "nervous",
    "angry", "comicReaction", "hitReaction", "custom"
  ];
  const frames = Array.isArray(rawAnimation.frames)
    ? rawAnimation.frames.map(readSceneAnimationFrame).filter(
        (frame): frame is SceneAnimationFrame => frame !== null
      ).slice(0, 12)
    : [];
  return {
    type: "aiFrames",
    enabled,
    sourceImagePath,
    mode: modes.includes(rawAnimation.mode as AIImageAnimationMode)
      ? rawAnimation.mode as AIImageAnimationMode
      : "idle",
    fps: clampNumber(readNumber(rawAnimation.fps, 6), 1, 24),
    loop: typeof rawAnimation.loop === "boolean" ? rawAnimation.loop : true,
    pingPong: typeof rawAnimation.pingPong === "boolean" ? rawAnimation.pingPong : false,
    movementIntensity: clampNumber(readNumber(rawAnimation.movementIntensity, 0.35), 0, 1),
    customInstruction: typeof rawAnimation.customInstruction === "string"
      ? rawAnimation.customInstruction.slice(0, 1000)
      : "",
    frames
  };
}

function readSceneAnimationFrame(rawFrame: unknown, index: number): SceneAnimationFrame | null {
  if (!isRecord(rawFrame)) return null;
  const source = rawFrame.source === "original" ? "original" : "generated";
  const imagePath = typeof rawFrame.imagePath === "string" ? rawFrame.imagePath : "";
  if (source === "generated" && !imagePath.trim()) return null;
  return {
    id: typeof rawFrame.id === "string" && rawFrame.id.trim()
      ? rawFrame.id
      : `animation_frame_${index + 1}`,
    source,
    imagePath,
    instruction: typeof rawFrame.instruction === "string" ? rawFrame.instruction : ""
  };
}

function ensureUniqueChoiceIds(scenes: Scene[]): Scene[] {
  const usedChoiceIds = new Set<string>();
  let nextChoiceNumber = getNextChoiceNumber(scenes);

  return scenes.map((scene) => ({
    ...scene,
    choices: scene.choices.map((choice) => {
      if (!usedChoiceIds.has(choice.id)) {
        usedChoiceIds.add(choice.id);
        return choice;
      }

      let repairedId = `choice_${nextChoiceNumber}`;
      nextChoiceNumber += 1;
      while (usedChoiceIds.has(repairedId)) {
        repairedId = `choice_${nextChoiceNumber}`;
        nextChoiceNumber += 1;
      }
      usedChoiceIds.add(repairedId);
      return {
        ...choice,
        id: repairedId
      };
    })
  }));
}

function getNextChoiceNumber(scenes: Scene[]): number {
  const usedNumbers = scenes
    .flatMap((scene) => scene.choices)
    .map((choice) => {
      const match = choice.id.match(/^choice_(\d+)$/);
      return match ? Number(match[1]) : 0;
    })
    .filter((value) => Number.isFinite(value));

  return Math.max(0, ...usedNumbers) + 1;
}

function validateSceneStyle(rawStyle: unknown): SceneStyle {
  const fallback = createDefaultSceneStyle();
  if (!isRecord(rawStyle)) {
    return fallback;
  }

  const readLayoutOffset = (value: unknown, fallbackValue = 0) =>
    clampNumber(readNumber(value, fallbackValue), -2400, 2400);
  const rawTransitionSpeed = readNumber(rawStyle.sceneTransitionSpeed, 0);

  return {
    sceneTransition: readSceneTransitionOverride(rawStyle.sceneTransition),
    sceneTransitionSpeed:
      rawTransitionSpeed <= 0
        ? 0
        : clampNumber(rawTransitionSpeed, 0.5, 2),
    ornamentStyle: readSceneOrnamentStyle(rawStyle.ornamentStyle),
    backgroundColor: readColor(rawStyle.backgroundColor, ""),
    textColor: readColor(rawStyle.textColor, ""),
    titlePanelColor: readColor(rawStyle.titlePanelColor, ""),
    titleBorderColor: readColor(rawStyle.titleBorderColor, ""),
    titleTextColor: readColor(rawStyle.titleTextColor, ""),
    showSceneTitle: rawStyle.showSceneTitle !== false,
    titleBorderEnabled: rawStyle.titleBorderEnabled !== false,
    titlePanelTransparent: Boolean(rawStyle.titlePanelTransparent),
    titlePanelOpacity: clampNumber(readNumber(rawStyle.titlePanelOpacity, 0.82), 0, 1),
    titlePanelWidth: clampNumber(readNumber(rawStyle.titlePanelWidth, 0), 0, 390),
    titlePanelHeight: clampNumber(readNumber(rawStyle.titlePanelHeight, 0), 0, 240),
    titlePaddingTop: clampNumber(readNumber(rawStyle.titlePaddingTop, 4), 0, 80),
    titlePaddingSide: clampNumber(readNumber(rawStyle.titlePaddingSide, 10), 0, 80),
    textPanelColor: readColor(rawStyle.textPanelColor, ""),
    textBorderColor: readColor(rawStyle.textBorderColor, ""),
    textBorderEnabled: rawStyle.textBorderEnabled !== false,
    textPanelTransparent: Boolean(rawStyle.textPanelTransparent),
    textPanelOpacity: clampNumber(readNumber(rawStyle.textPanelOpacity, 0.82), 0, 1),
    textPanelWidth: clampNumber(readNumber(rawStyle.textPanelWidth, 0), 0, 390),
    textPanelHeight: clampNumber(readNumber(rawStyle.textPanelHeight, 0), 0, 420),
    textPaddingTop: clampNumber(readNumber(rawStyle.textPaddingTop, 10), 0, 100),
    textPaddingSide: clampNumber(readNumber(rawStyle.textPaddingSide, 14), 0, 100),
    titleFontSize: clampNumber(readNumber(rawStyle.titleFontSize, 22), 14, 38),
    textFontSize: clampNumber(readNumber(rawStyle.textFontSize, 16), 12, 28),
    textFontFamily: readTextFontFamily(rawStyle.textFontFamily),
    textAlign: readTextAlign(rawStyle.textAlign),
    imageOffsetX: readLayoutOffset(rawStyle.imageOffsetX),
    imageOffsetY: readLayoutOffset(rawStyle.imageOffsetY),
    imageScale: clampNumber(readNumber(rawStyle.imageScale, 1), 0.1, 4),
    imageOpacity: clampNumber(readNumber(rawStyle.imageOpacity, 1), 0, 1),
    imageBrightness: clampNumber(readNumber(rawStyle.imageBrightness, 1), 0, 2),
    imageCropTop: clampNumber(readNumber(rawStyle.imageCropTop, 0), 0, 90),
    imageCropRight: clampNumber(readNumber(rawStyle.imageCropRight, 0), 0, 90),
    imageCropBottom: clampNumber(readNumber(rawStyle.imageCropBottom, 0), 0, 90),
    imageCropLeft: clampNumber(readNumber(rawStyle.imageCropLeft, 0), 0, 90),
    titleOffsetX: readLayoutOffset(rawStyle.titleOffsetX),
    titleOffsetY: readLayoutOffset(rawStyle.titleOffsetY),
    titleTextOffsetX: readLayoutOffset(rawStyle.titleTextOffsetX),
    titleTextOffsetY: readLayoutOffset(rawStyle.titleTextOffsetY),
    titleScale: clampNumber(readNumber(rawStyle.titleScale, 1), 0.75, 1.8),
    textOffsetX: readLayoutOffset(rawStyle.textOffsetX),
    textOffsetY: readLayoutOffset(rawStyle.textOffsetY),
    sceneTextOffsetX: readLayoutOffset(rawStyle.sceneTextOffsetX),
    sceneTextOffsetY: readLayoutOffset(rawStyle.sceneTextOffsetY),
    textScale: clampNumber(readNumber(rawStyle.textScale, 1), 0.75, 1.8),
    choicesOffsetX: readLayoutOffset(rawStyle.choicesOffsetX),
    choicesOffsetY: readLayoutOffset(rawStyle.choicesOffsetY),
    choiceTextOffsetX: readLayoutOffset(rawStyle.choiceTextOffsetX),
    choiceTextOffsetY: readLayoutOffset(rawStyle.choiceTextOffsetY),
    choicesPanelColor: readColor(rawStyle.choicesPanelColor, ""),
    choicesBorderColor: readColor(rawStyle.choicesBorderColor, ""),
    choicesTextColor: readColor(rawStyle.choicesTextColor, ""),
    choicesBorderEnabled: rawStyle.choicesBorderEnabled !== false,
    choicesFrameStyle: readChoiceFrameStyle(rawStyle.choicesFrameStyle),
    choicesPanelTransparent: Boolean(rawStyle.choicesPanelTransparent),
    choicesPanelOpacity: clampNumber(readNumber(rawStyle.choicesPanelOpacity, 0.92), 0, 1),
    choicesPaddingTop: clampNumber(readNumber(rawStyle.choicesPaddingTop, 9), 0, 80),
    choicesPaddingSide: clampNumber(readNumber(rawStyle.choicesPaddingSide, 10), 0, 80),
    choicesFontSize: clampNumber(readNumber(rawStyle.choicesFontSize, 16), 11, 26),
    choicesFontFamily: readTextFontFamily(
      rawStyle.choicesFontFamily ?? rawStyle.textFontFamily
    ),
    choicesPanelWidth: clampNumber(readNumber(rawStyle.choicesPanelWidth, 0), 0, 390),
    choicesPanelHeight: clampNumber(readNumber(rawStyle.choicesPanelHeight, 0), 0, 420),
    choicesScale: clampNumber(readNumber(rawStyle.choicesScale, 1), 0.75, 1.35)
  };
}

function validateChoice(rawChoice: unknown): Choice {
  if (!isRecord(rawChoice)) {
    throw new Error("Choice must be an object.");
  }

  if (typeof rawChoice.id !== "string") {
    throw new Error("Choice id is missing.");
  }

  if (typeof rawChoice.text !== "string") {
    throw new Error(`Choice "${rawChoice.id}" text is missing.`);
  }

  if (typeof rawChoice.targetNodeId !== "string") {
    throw new Error(`Choice "${rawChoice.id}" targetNodeId is missing.`);
  }
  const targetNodeId = rawChoice.targetNodeId;

  const outcomes = Array.isArray(rawChoice.outcomes)
    ? rawChoice.outcomes.map((outcome, index) =>
        validateChoiceOutcome(outcome, targetNodeId, index + 1)
      )
    : [createChoiceOutcome(targetNodeId, 100, `outcome_${rawChoice.id}`)];

  return {
    id: rawChoice.id,
    text: rawChoice.text,
    targetNodeId,
    useMultipleOutcomes:
      typeof rawChoice.useMultipleOutcomes === "boolean"
        ? rawChoice.useMultipleOutcomes
        : outcomes.length > 1,
    outcomes,
    conditionalTargets: Array.isArray(rawChoice.conditionalTargets)
      ? rawChoice.conditionalTargets.map(validateConditionalTarget)
      : [],
    effects: Array.isArray(rawChoice.effects)
      ? rawChoice.effects.map(validateEffect)
      : [],
    conditions: Array.isArray(rawChoice.conditions)
      ? rawChoice.conditions.map(validateCondition)
      : [],
    conditionFailBehavior:
      rawChoice.conditionFailBehavior === "hidden" ? "hidden" : "disabled"
  };
}

function validateChoiceOutcome(
  rawOutcome: unknown,
  fallbackTargetSceneId: SceneId,
  index: number
): ChoiceOutcome {
  if (!isRecord(rawOutcome)) {
    return createChoiceOutcome(
      fallbackTargetSceneId,
      index === 1 ? 100 : 0,
      `outcome_${index}`
    );
  }

  return {
    id: typeof rawOutcome.id === "string" ? rawOutcome.id : createId("outcome"),
    targetSceneId:
      typeof rawOutcome.targetSceneId === "string"
        ? rawOutcome.targetSceneId
        : fallbackTargetSceneId,
    percent: clampNumber(readNumber(rawOutcome.percent, index === 1 ? 100 : 0), 0, 100)
  };
}

function validateConditionalTarget(
  rawConditionalTarget: unknown
): ConditionalTarget {
  if (!isRecord(rawConditionalTarget)) {
    throw new Error("Conditional target must be an object.");
  }

  return {
    id:
      typeof rawConditionalTarget.id === "string"
        ? rawConditionalTarget.id
        : createId("conditional_target"),
    targetSceneId:
      typeof rawConditionalTarget.targetSceneId === "string"
        ? rawConditionalTarget.targetSceneId
        : "",
    conditions: Array.isArray(rawConditionalTarget.conditions)
      ? rawConditionalTarget.conditions.map(validateCondition)
      : []
  };
}

function validateEffect(rawEffect: unknown): ChoiceEffect {
  if (!isRecord(rawEffect)) {
    throw new Error("Effect must be an object.");
  }

  if (rawEffect.type === "flag") {
    return {
      id: typeof rawEffect.id === "string" ? rawEffect.id : createId("effect"),
      type: "flag",
      flagId: typeof rawEffect.flagId === "string" ? rawEffect.flagId : "",
      value: typeof rawEffect.value === "boolean" ? rawEffect.value : true
    };
  }

  return {
    id: typeof rawEffect.id === "string" ? rawEffect.id : createId("effect"),
    type: "parameter",
    parameterId:
      typeof rawEffect.parameterId === "string" ? rawEffect.parameterId : "",
    operation:
      rawEffect.operation === "subtract" || rawEffect.operation === "set"
        ? rawEffect.operation
        : "add",
    value: readNumber(rawEffect.value, 0)
  };
}

function validateCondition(rawCondition: unknown): ChoiceCondition {
  if (!isRecord(rawCondition)) {
    throw new Error("Condition must be an object.");
  }

  if (rawCondition.type === "flag") {
    return {
      id:
        typeof rawCondition.id === "string"
          ? rawCondition.id
          : createId("condition"),
      type: "flag",
      flagId: typeof rawCondition.flagId === "string" ? rawCondition.flagId : "",
      expectedValue:
        typeof rawCondition.expectedValue === "boolean"
          ? rawCondition.expectedValue
          : true
    };
  }

  return {
    id:
      typeof rawCondition.id === "string"
        ? rawCondition.id
        : createId("condition"),
    type: "parameter",
    parameterId:
      typeof rawCondition.parameterId === "string"
        ? rawCondition.parameterId
        : "",
    operator: readOperator(rawCondition.operator),
    value: readNumber(rawCondition.value, 0)
  };
}

function compareNumber(
  currentValue: number,
  operator: ParameterConditionOperator,
  expectedValue: number
): boolean {
  switch (operator) {
    case ">=":
      return currentValue >= expectedValue;
    case ">":
      return currentValue > expectedValue;
    case "<":
      return currentValue < expectedValue;
    case "<=":
      return currentValue <= expectedValue;
    case "==":
      return currentValue === expectedValue;
    case "!=":
      return currentValue !== expectedValue;
  }
}

function clampParameterValue(value: number, parameter: StoryParameter): number {
  const minApplied =
    parameter.minValue === null ? value : Math.max(value, parameter.minValue);
  return parameter.maxValue === null
    ? minApplied
    : Math.min(minApplied, parameter.maxValue);
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readOptionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function readOperator(value: unknown): ParameterConditionOperator {
  return value === ">" ||
    value === "<" ||
    value === "<=" ||
    value === "==" ||
    value === "!="
    ? value
    : ">=";
}

function readSceneType(value: unknown): SceneType {
  return value === "ending" ||
    value === "important" ||
    value === "flagLogic"
    ? value
    : "normal";
}

function readSceneTransition(value: unknown): SceneTransition {
  return value === "crossfade" ||
    value === "zoomIn" ||
    value === "zoomOut" ||
    value === "flipHorizontal" ||
    value === "flipVertical" ||
    value === "softSpiral" ||
    value === "gentleSwing" ||
    value === "depthDissolve" ||
    value === "dreamTilt" ||
    value === "pageTurn"
    ? value
    : "fade";
}

function readSceneTransitionOverride(value: unknown): SceneTransitionOverride {
  return value === "project" ? "project" : readSceneTransition(value);
}

function readSceneOrnamentStyle(value: unknown): SceneOrnamentStyle {
  return value === "gilded" ||
    value === "gothic" ||
    value === "forest" ||
    value === "crimson" ||
    value === "ocean" ||
    value === "celestial" ||
    value === "noir" ||
    value === "sakura" ||
    value === "desert" ||
    value === "frost" ||
    value === "cyber" ||
    value === "fairytale"
    ? value
    : "none";
}

function readSceneNodeColor(value: unknown): SceneNodeColor {
  return value === "green" ||
    value === "blue" ||
    value === "purple" ||
    value === "amber" ||
    value === "red"
    ? value
    : "slate";
}

function readSceneVisualMediaType(
  value: unknown,
  mediaPath: string
): SceneVisualMediaType {
  if (value === "video") {
    return "video";
  }
  if (value === "image") {
    return "image";
  }
  return /^(?:data:video\/)|\.(?:mp4|webm|mov|m4v)(?:[?#].*)?$/i.test(mediaPath.trim())
    ? "video"
    : "image";
}

function readSceneLayoutType(value: unknown): SceneLayoutType {
  return value === "imageBackground" ||
    value === "textFirst" ||
    value === "splitLayout" ||
    value === "fullImageMoment" ||
    value === "dialogueStyle" ||
    value === "noImage"
    ? value
    : "imageTop";
}

function readTextFontFamily(value: unknown): string {
  return value === "serif" || value === "mono" ? value : "system";
}

function readChoiceFrameStyle(value: unknown): string {
  if (typeof value !== "string") return "none";
  if (/^crafted_(0[1-9]|1[0-9]|20)$/.test(value)) return value;
  const legacyMatch = value.match(/^ornate_(0[1-9]|[12][0-9]|30)$/);
  if (!legacyMatch) return "none";
  const legacyNumber = Number(legacyMatch[1]);
  const craftedNumber = ((legacyNumber - 1) % 20) + 1;
  return `crafted_${String(craftedNumber).padStart(2, "0")}`;
}

function readTextAlign(value: unknown): "left" | "center" {
  return value === "center" ? "center" : "left";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function readColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return (
    /^#[0-9a-fA-F]{6}$/.test(normalized) ||
    normalized === "" ||
    /^linear-gradient\(\s*(?:-?\d+(?:\.\d+)?deg|to\s+(?:top|right|bottom|left)(?:\s+(?:top|right|bottom|left))?)\s*,\s*#[0-9a-fA-F]{6}(?:\s+\d+(?:\.\d+)?%)?\s*,\s*#[0-9a-fA-F]{6}(?:\s+\d+(?:\.\d+)?%)?\s*\)$/i.test(normalized)
  ) ? normalized : fallback;
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
