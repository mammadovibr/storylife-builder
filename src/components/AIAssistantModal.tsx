import { PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  activateSceneImageVariant,
  applySceneVisual,
  createChoice,
  createChoiceOutcome,
  createDefaultProject,
  createScene,
  getActiveSceneImageVariant,
  migrateProject,
  serializeProject,
  SceneImageAnimation,
  StoryProject
} from "../domain/project";
import { extractRequestedSceneCount } from "../utils/storyRequest";
import { fitStoryArchitectureToSceneCount } from "../utils/storyArchitecture";
import { savePicture } from "../utils/savePicture";
import { AnimatedSceneImage } from "./AnimatedSceneImage";
import { ImageAnimationModal } from "./ImageAnimationModal";
import {
  compileSemanticStoryBlueprint,
  SemanticStoryBlueprint,
  SemanticStoryScene,
  StoryBlueprint,
  StoryBlueprintScene,
  validateSemanticStoryBlueprint,
  validateSemanticStoryBlueprintChunk
} from "../utils/storyBlueprint";

interface AIAssistantModalProps {
  project: StoryProject;
  selectedSceneId: string | null;
  onApplyProject: (project: StoryProject) => void;
  onClose: () => void;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  text: string;
}

interface AIProjectPatch {
  flags?: StoryProject["flags"];
  parameters?: StoryProject["parameters"];
  storyBible?: StoryProject["storyBible"];
  storyStyles?: StoryProject["storyStyles"];
  updatedScenes?: StoryProject["scenes"];
  newScenes?: StoryProject["scenes"];
}

interface SimpleSceneChoice {
  text: string;
  targetHint: string;
  setFlagKey: string;
  setFlagValue: boolean;
  conditionFlagKey: string;
  conditionFlagValue: boolean;
}

interface SimpleFlagDefinition {
  id: string;
  key: string;
}

interface ImageQueueItem {
  id: string;
  sceneId: string;
  prompt: string;
  referenceIds: string[];
  imageModel: string;
  imageSize: string;
  imageQuality: "low" | "medium" | "high";
  status: "queued" | "running" | "done" | "error";
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

interface DraftValidationState {
  status: "unchecked" | "checking" | "valid" | "invalid";
  problems: string[];
  warnings: string[];
  sceneCount: number;
  checkedAt: string;
  aiScore: number | null;
}

type AIStage =
  | "idle"
  | "sending"
  | "thinking"
  | "writing"
  | "building"
  | "drawing"
  | "done"
  | "stopped"
  | "error";

const AI_MESSAGES_KEY = "storylife-ai-assistant-messages-v2";
const AI_DRAFT_KEY = "storylife-ai-assistant-draft-v2";
const AI_STORY_MEMORY_KEY = "storylife-ai-assistant-story-memory-v2";
const AI_STORY_PLAN_KEY = "storylife-ai-assistant-story-plan-v2";
const AI_STORY_REPORT_KEY = "storylife-ai-assistant-story-report-v2";
const AI_PROJECT_JSON_DRAFT_KEY = "storylife-ai-project-json-draft-v4";
const AI_PROJECT_WORKING_DRAFT_KEY = "storylife-ai-project-working-draft-v4";
const AI_PROJECT_MEMORY_LIBRARY_KEY = "storylife-ai-project-memory-library-v2";
const ONE_SHOT_PROJECT_SCENE_LIMIT = 8;
const LARGE_PROJECT_CHUNK_SIZE = 5;
const LARGE_PROJECT_CHUNK_PAUSE_MS = 900;
const STORY_BLUEPRINT_ATTEMPTS = 3;
const STORY_MAP_ATTEMPTS = 2;
const STORY_BLUEPRINT_CHUNK_ATTEMPTS = 3;
const DEFAULT_STORY_STYLE_IDS = ["adventure", "cinematic"];
const STORY_STYLE_OPTIONS = [
  {
    id: "adventure",
    label: "Приключенческий",
    prompt:
      "Adventure style: keep scenes active, concrete, event-driven, and exploratory. Choices should move the hero through places, obstacles, discoveries, and risks."
  },
  {
    id: "comedy",
    label: "Комедийный",
    prompt:
      "Comedy style: use lively, situational humor, funny complications, and clear physical actions. Do not turn simple problems into tragedy."
  },
  {
    id: "detective",
    label: "Детективный",
    prompt:
      "Detective style: focus on clues, suspects, contradictions, observation, interviews, evidence, and logical deductions. Choices should investigate or test hypotheses."
  },
  {
    id: "thriller",
    label: "Триллер",
    prompt:
      "Thriller style: keep tension, danger, suspicion, pursuit, deadlines, and tactical choices. Escalate pressure through concrete events, not vague anxiety."
  },
  {
    id: "drama",
    label: "Драма",
    prompt:
      "Drama style: use emotional stakes and relationships, but keep scenes grounded in visible actions and decisions. Avoid philosophical filler."
  },
  {
    id: "familyLight",
    label: "Лёгкая семейная история",
    prompt:
      "Light family story style: warm, clear, kind, accessible, and cozy. Conflicts should be understandable and not overly dark."
  },
  {
    id: "absurdComedy",
    label: "Абсурдная комедия",
    prompt:
      "Absurd comedy style: allow ridiculous situations and playful logic, while keeping cause-and-effect clear from choice to target scene."
  },
  {
    id: "realistic",
    label: "Реалистичный",
    prompt:
      "Realistic style: events, dialogue, locations, and reactions should feel plausible. Avoid melodrama, random coincidences, and unexplained jumps."
  },
  {
    id: "cinematic",
    label: "Кинематографичный",
    prompt:
      "Cinematic style: use vivid visual staging, scene momentum, atmosphere, and strong set-pieces. Keep descriptions specific and playable."
  },
  {
    id: "dark",
    label: "Мрачный",
    prompt:
      "Dark style: use heavier mood, danger, shadows, uncertainty, and moral pressure only when the premise supports it. Do not make every scene tragic by default."
  },
  {
    id: "fairyTale",
    label: "Сказочный",
    prompt:
      "Fairy tale style: use wonder, simple symbolic conflicts, magical-feeling situations, and clear moral/action choices."
  },
  {
    id: "childrens",
    label: "Детский",
    prompt:
      "Children's style: write simply, visually, kindly, and safely. Choices should be concrete actions children can understand."
  },
  {
    id: "ironic",
    label: "Ироничный",
    prompt:
      "Ironic style: use light wit, playful commentary, and smart reversals, but do not let irony replace plot logic."
  },
  {
    id: "epic",
    label: "Эпический",
    prompt:
      "Epic style: use scale, stakes, quests, factions, and dramatic milestones, while keeping each scene's physical action clear."
  },
  {
    id: "sliceOfLife",
    label: "Повседневный",
    prompt:
      "Slice-of-life style: focus on ordinary actions, small conflicts, natural humor, daily details, and believable consequences."
  }
];
const GLOBAL_STORY_STYLE_RULES = [
  "Universal style rule: do not artificially dramatize every scene.",
  "If the story is simple, funny, domestic, absurd, or everyday, write it simply, vividly, and naturally.",
  "Do not turn every scene into tragedy, crisis, trauma, or philosophical drama.",
  "Tone, humor, pacing, description, and atmosphere must follow the selected styles, but style must never break plot logic."
].join("\n");
const OPENAI_MODEL_OPTIONS = [
  {
    value: "gpt-5.4",
    label: "GPT-5.4 - stronger for big projects"
  },
  {
    value: "gpt-5.5",
    label: "GPT-5.5 - strongest if your account has access"
  },
  {
    value: "gpt-5.4-mini",
    label: "GPT-5.4 mini - cheaper/faster"
  },
  {
    value: "gpt-4.1-mini",
    label: "GPT-4.1 mini - legacy fallback"
  }
];
const IMAGE_MODEL_OPTIONS = [
  { value: "gpt-image-2", label: "GPT Image 2 - best/newest" },
  { value: "gpt-image-1.5", label: "GPT Image 1.5 - strong" },
  { value: "gpt-image-1", label: "GPT Image 1 - reliable" },
  { value: "gpt-image-1-mini", label: "GPT Image 1 Mini - cheaper/faster" }
];
const IMAGE_STYLE_OPTIONS = [
  {
    value: "cinematicRealism",
    label: "Cinematic Realism",
    prompt:
      "cinematic realistic style, ultra detailed, movie still, dramatic lighting, realistic characters, natural skin texture, depth of field, anamorphic lens, high budget film look, emotional atmosphere"
  },
  {
    value: "pixar3d",
    label: "Pixar / 3D Animation",
    prompt:
      "high quality 3D animated movie style, expressive characters, soft rounded shapes, colorful lighting, detailed fur and materials, emotional faces, family friendly, cinematic composition"
  },
  {
    value: "disney2dClassic",
    label: "Disney 2D Classic",
    prompt:
      "classic hand drawn 2D animation style, expressive characters, clean outlines, beautiful backgrounds, warm colors, traditional animation look, magical atmosphere"
  },
  {
    value: "animeCinematic",
    label: "Anime Cinematic",
    prompt:
      "cinematic anime style, highly detailed backgrounds, expressive eyes, beautiful lighting, emotional scene, hand painted look, dramatic atmosphere, japanese animation quality"
  },
  {
    value: "ghibliInspired",
    label: "Studio Ghibli Inspired",
    prompt:
      "soft hand painted animation style, cozy atmosphere, nature details, warm colors, gentle characters, dreamy lighting, emotional storytelling illustration"
  },
  {
    value: "comicBookMarvel",
    label: "Comic Book / Marvel Style",
    prompt:
      "modern comic book art style, dynamic poses, bold outlines, dramatic shadows, highly detailed characters, action scene, vibrant colors, graphic novel illustration"
  },
  {
    value: "darkFantasy",
    label: "Dark Fantasy",
    prompt:
      "dark fantasy illustration, epic atmosphere, medieval world, dramatic lighting, detailed armor and clothing, mysterious mood, realistic fantasy art"
  },
  {
    value: "cyberpunkSciFi",
    label: "Cyberpunk / Sci-Fi",
    prompt:
      "cyberpunk sci fi style, neon lights, futuristic city, high tech details, cinematic atmosphere, glowing elements, rainy streets, advanced technology"
  },
  {
    value: "watercolorStorybook",
    label: "Watercolor Storybook",
    prompt:
      "beautiful watercolor illustration, soft brush strokes, paper texture, gentle colors, children's book style, charming characters, warm atmosphere"
  },
  {
    value: "minimalFlatVector",
    label: "Minimal Flat Vector",
    prompt:
      "modern flat vector illustration, clean shapes, minimal design, simple colors, smooth geometry, professional app illustration style"
  },
  {
    value: "pixelArt",
    label: "Pixel Art",
    prompt:
      "high quality pixel art style, retro game graphics, detailed pixel characters, limited color palette, 16-bit style, nostalgic video game look"
  },
  {
    value: "oilPaintingRenaissance",
    label: "Oil Painting / Renaissance",
    prompt:
      "classical oil painting style, renaissance inspired, realistic brush strokes, dramatic lighting, rich details, museum quality artwork, historical atmosphere"
  },
  {
    value: "noirDetective",
    label: "Noir Detective",
    prompt:
      "film noir style, black and white cinematic lighting, strong shadows, detective atmosphere, vintage movie look, mysterious mood"
  },
  {
    value: "cuteKawaiiCartoon",
    label: "Cute Kawaii Cartoon",
    prompt:
      "cute kawaii cartoon style, adorable character design, soft colors, expressive face, simple clean shapes, charming children's animation look"
  },
  {
    value: "lowPoly3dGame",
    label: "Low Poly 3D Game Style",
    prompt:
      "stylized low poly 3D game art, simple geometric shapes, colorful environment, clean materials, mobile game style, charming stylized world"
  }
];
const IMAGE_SIZE_OPTIONS = [
  { value: "1024x1024", label: "1:1 Square", prompt: "square composition" },
  { value: "1024x1536", label: "2:3 Vertical", prompt: "vertical 2:3 composition" },
  { value: "1536x1024", label: "3:2 Horizontal", prompt: "horizontal 3:2 composition" },
  { value: "1024x1536", label: "3:4 Vertical", prompt: "vertical 3:4 composition" },
  { value: "1536x1024", label: "4:3 Horizontal", prompt: "horizontal 4:3 composition" },
  { value: "1536x1024", label: "16:9 Widescreen", prompt: "wide 16:9 composition" },
  { value: "1024x1536", label: "9:16 Phone Vertical", prompt: "tall 9:16 phone composition" }
];
const INITIAL_MESSAGES: ChatMessage[] = [
  {
    role: "assistant",
    text:
      "AI Assistant is ready. Tell me what story/game/project to build. I will plan it, write a hidden JSON draft, check it, and load it only after you approve."
  }
];
const SHOW_STORY_AI = false;
const SHOW_IMAGE_STUDIO_SIDEBAR = false;

export function AIAssistantModal({
  project,
  selectedSceneId,
  onApplyProject,
  onClose
}: AIAssistantModalProps) {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [model, setModel] = useState("gpt-5.4");
  const [hasApiKey, setHasApiKey] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState("Loading AI settings...");
  const [chatInput, setChatInput] = useState("");
  const [storyText, setStoryText] = useState(() => readStoredText(AI_DRAFT_KEY));
  const [storyMemory, setStoryMemory] = useState(() => readStoredText(AI_STORY_MEMORY_KEY));
  const [imagePrompt, setImagePrompt] = useState("");
  const [isImageStudioOpen, setImageStudioOpen] = useState(true);
  const [imageStudioSceneIndex, setImageStudioSceneIndex] = useState(() =>
    Math.max(0, project.scenes.findIndex((scene) => scene.id === selectedSceneId))
  );
  const [imageStudioPrompts, setImageStudioPrompts] = useState<Record<string, string>>({});
  const [imageStudioSelectedRefs, setImageStudioSelectedRefs] = useState<Record<string, string[]>>({});
  const [imageStudioUseReferences, setImageStudioUseReferences] = useState<Record<string, boolean>>({});
  const [imageModel, setImageModel] = useState("gpt-image-2");
  const [imageStyle, setImageStyle] = useState(IMAGE_STYLE_OPTIONS[0].value);
  const [imageSize, setImageSize] = useState(IMAGE_SIZE_OPTIONS[1].value);
  const [imageQuality, setImageQuality] = useState<"low" | "medium" | "high">("low");
  const [imageQueue, setImageQueue] = useState<ImageQueueItem[]>([]);
  const [fullPreviewImagePath, setFullPreviewImagePath] = useState<string | null>(null);
  const [animationEditorType, setAnimationEditorType] = useState<
    "procedural" | "aiFrames" | null
  >(null);
  const [storyPlan, setStoryPlan] = useState(() => readStoredText(AI_STORY_PLAN_KEY));
  const [storyLogicReport, setStoryLogicReport] = useState(() =>
    readStoredText(AI_STORY_REPORT_KEY)
  );
  const [generatedProjectJson, setGeneratedProjectJson] = useState(() =>
    readStoredText(AI_PROJECT_JSON_DRAFT_KEY)
  );
  const [projectMemoryLibrary, setProjectMemoryLibrary] = useState(() =>
    readStoredText(AI_PROJECT_MEMORY_LIBRARY_KEY)
  );
  const [draftValidation, setDraftValidation] = useState<DraftValidationState>({
    status: "unchecked",
    problems: [],
    warnings: [],
    sceneCount: 0,
    checkedAt: "",
    aiScore: null
  });
  const [messages, setMessages] = useState<ChatMessage[]>(readStoredMessages);
  const [liveProjectDraft, setLiveProjectDraft] = useState("");
  const [liveProjectStatus, setLiveProjectStatus] = useState("No active AI request.");
  const [liveProjectEventCount, setLiveProjectEventCount] = useState(0);
  const [liveProjectReceivedChars, setLiveProjectReceivedChars] = useState(0);
  const [liveProjectEvents, setLiveProjectEvents] = useState<string[]>([]);
  const [isWorking, setWorking] = useState(false);
  const [stage, setStage] = useState<AIStage>("idle");
  const [workingSeconds, setWorkingSeconds] = useState(0);
  const [imageProgressTick, setImageProgressTick] = useState(0);
  const [drawnScenes, setDrawnScenes] = useState(0);
  const [targetScenes, setTargetScenes] = useState(0);
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const chatLogRef = useRef<HTMLDivElement | null>(null);
  const liveProjectDraftRef = useRef("");
  const stopRequestedRef = useRef(false);
  const imageQueueRunningRef = useRef(false);
  const imageQueueRef = useRef<ImageQueueItem[]>([]);
  const activeImageRequestIdRef = useRef<string | null>(null);
  const latestProjectRef = useRef(project);
  const approvedStoryBlueprintRef = useRef<StoryBlueprint | null>(null);
  const projectGenerationStartedRef = useRef(false);

  const canChat = Boolean(window.storyLife?.aiChat);
  const canGenerateProject = Boolean(window.storyLife?.aiGenerateProject);
  const canEditProject = Boolean(window.storyLife?.aiEditProject);
  const canAnalyzeStory = Boolean(window.storyLife?.aiAnalyzeStoryLogic);
  const canGenerateSceneImage = Boolean(window.storyLife?.aiGenerateSceneImage);
  const canUseAI = canChat || canGenerateProject;
  const hasBuildContext =
    chatInput.trim() !== "" || messages.some((message) => message.role === "user");
  const hasEditContext =
    chatInput.trim() !== "" ||
    storyMemory.trim() !== "" ||
    messages.some((message) => message.role === "user");
  const currentProjectJson = useMemo(() => serializeProject(project), [project]);
  const selectedScene = useMemo(
    () => project.scenes.find((scene) => scene.id === selectedSceneId) ?? null,
    [project.scenes, selectedSceneId]
  );
  const selectedStoryStyles = normalizeStoryStyleIds(project.storyStyles);
  const activeStoryStylePrompt = createStoryStylePrompt(selectedStoryStyles);

  useEffect(() => {
    latestProjectRef.current = project;
  }, [project]);

  useEffect(() => {
    const scene = project.scenes[imageStudioSceneIndex];
    if (!scene || project.characterReferences.length === 0) {
      return;
    }
    setImageStudioSelectedRefs((current) => {
      if (Object.prototype.hasOwnProperty.call(current, scene.id)) {
        return current;
      }
      return {
        ...current,
        [scene.id]: project.characterReferences
          .slice(0, 3)
          .map((reference) => reference.id)
      };
    });
  }, [imageStudioSceneIndex, project.characterReferences, project.scenes]);

  useEffect(() => {
    imageQueueRef.current = imageQueue;
  }, [imageQueue]);

  useEffect(() => {
    if (!imageQueue.some((item) => item.status === "running")) {
      return;
    }

    const timerId = window.setInterval(() => {
      setImageProgressTick((currentTick) => currentTick + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [imageQueue]);

  useEffect(() => {
    if (
      imageQueue.some((item) => item.status === "queued") &&
      !imageQueueRunningRef.current
    ) {
      window.setTimeout(() => void processImageQueue(), 0);
    }
  }, [imageQueue]);

  useEffect(() => {
    localStorage.setItem(AI_MESSAGES_KEY, JSON.stringify(messages.slice(-80)));
    window.requestAnimationFrame(() => {
      if (chatLogRef.current) {
        chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
      }
    });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem(AI_DRAFT_KEY, storyText);
  }, [storyText]);

  useEffect(() => {
    localStorage.setItem(AI_STORY_MEMORY_KEY, storyMemory);
  }, [storyMemory]);

  useEffect(() => {
    localStorage.setItem(AI_STORY_PLAN_KEY, storyPlan);
  }, [storyPlan]);

  useEffect(() => {
    localStorage.setItem(AI_STORY_REPORT_KEY, storyLogicReport);
  }, [storyLogicReport]);

  useEffect(() => {
    if (generatedProjectJson.trim() === "") {
      localStorage.removeItem(AI_PROJECT_JSON_DRAFT_KEY);
      return;
    }
    localStorage.setItem(AI_PROJECT_JSON_DRAFT_KEY, generatedProjectJson);
  }, [generatedProjectJson]);

  useEffect(() => {
    if (projectMemoryLibrary.trim() === "") {
      localStorage.removeItem(AI_PROJECT_MEMORY_LIBRARY_KEY);
      return;
    }
    localStorage.setItem(AI_PROJECT_MEMORY_LIBRARY_KEY, projectMemoryLibrary);
  }, [projectMemoryLibrary]);

  useEffect(() => {
    if (!isWorking) {
      setWorkingSeconds(0);
      return;
    }

    const timerId = window.setInterval(() => {
      setWorkingSeconds((current) => current + 1);
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [isWorking]);

  useEffect(() => {
    if (!isWorking || stage !== "thinking") {
      return;
    }

    if (workingSeconds === 30) {
      appendMessage({
        role: "system",
        text: "Still waiting for OpenAI. For a big project this can take 1-4 minutes."
      });
    }

    if (workingSeconds === 90) {
      appendMessage({
        role: "system",
        text: "Still working. The current JSON draft is being assembled in the background; the editor project is unchanged."
      });
    }

    if (workingSeconds === 180) {
      appendMessage({
        role: "system",
        text: "This is taking longer than normal. You can wait a little more or press Stop and try fewer scenes first."
      });
    }
  }, [isWorking, stage, workingSeconds]);

  useEffect(() => {
    window.focus();
    const firstFocusTimer = window.setTimeout(() => chatInputRef.current?.focus(), 50);
    const secondFocusTimer = window.setTimeout(() => chatInputRef.current?.focus(), 250);

    return () => {
      window.clearTimeout(firstFocusTimer);
      window.clearTimeout(secondFocusTimer);
    };
  }, []);

  useEffect(() => {
    if (!window.storyLife?.getAISettings) {
      setSettingsStatus("AI Assistant works only in the desktop Electron window.");
      return;
    }

    window.storyLife
      .getAISettings()
      .then((settings) => {
        setModel(settings.model || "gpt-5.4");
        setHasApiKey(settings.hasApiKey);
        setSettingsStatus(
          settings.hasApiKey
            ? "API key is connected."
            : "Paste an OpenAI API key so AI Assistant can answer and build projects."
        );
      })
      .catch((error: unknown) => {
        setSettingsStatus(getErrorMessage(error));
      });
  }, []);

  async function saveSettings() {
    if (!window.storyLife?.saveAISettings) {
      setSettingsStatus("AI settings work only in the desktop Electron window.");
      return;
    }

    const requestId = createRequestId();
    stopRequestedRef.current = false;
    activeImageRequestIdRef.current = requestId;
    setWorking(true);
    setStage("sending");
    try {
      const result = await window.storyLife.saveAISettings({
        apiKey: apiKeyInput,
        model
      });
      setHasApiKey(result.hasApiKey);
      setModel(result.model);
      setApiKeyInput("");
      setSettingsStatus("AI settings saved.");
      setStage("done");
    } catch (error) {
      setStage("error");
      setSettingsStatus(getErrorMessage(error));
    } finally {
      setWorking(false);
    }
  }

  async function testConnection() {
    if (!window.storyLife?.aiChat || isWorking) {
      return;
    }

    const requestId = createRequestId();
    setActiveRequestId(requestId);
    stopRequestedRef.current = false;
    setWorking(true);
    setStage("thinking");
    appendMessage({ role: "system", text: "Testing OpenAI connection..." });

    try {
      const result = await window.storyLife.aiChat({
        message: "Reply with exactly: Connection OK",
        projectJson: currentProjectJson,
        selectedSceneId,
        requestId
      });
      if (!stopRequestedRef.current) {
        setStage("done");
        appendMessage({
          role: "assistant",
          text: `Connection test response: ${result.answer}`
        });
      }
    } catch (error) {
      setStage(stopRequestedRef.current ? "stopped" : "error");
      appendMessage({ role: "assistant", text: getErrorMessage(error) });
    } finally {
      setActiveRequestId(null);
      setWorking(false);
    }
  }

  async function sendChatMessage() {
    const message = chatInput.trim();
    if (!message || !canUseAI || isWorking) {
      return;
    }

    setChatInput("");
    appendMessage({ role: "user", text: message });

    if (!isDiscussionOnlyRequest(message) && isProjectEditRequest(message)) {
      appendMessage({
        role: "system",
        text: "Edit action detected: applying changes to the current project instead of creating a new story."
      });
      await editCurrentProject(message);
      return;
    }

    if (!window.storyLife?.aiChat) {
      appendMessage({
        role: "assistant",
        text: "Chat works only in the desktop Electron window."
      });
      return;
    }

    const requestId = createRequestId();
    setActiveRequestId(requestId);
    stopRequestedRef.current = false;
    setWorking(true);
    setStage("thinking");
    try {
      const result = await window.storyLife.aiChat({
        message,
        projectJson: currentProjectJson,
        selectedSceneId,
        storyMemory,
        chatHistory: messages.slice(-16),
        requestId
      });
      if (!stopRequestedRef.current) {
        appendMessage({ role: "assistant", text: result.answer });
        void updateStoryMemoryFromExchange(message, result.answer);
        setStage("done");
      }
    } catch (error) {
      setStage(stopRequestedRef.current ? "stopped" : "error");
      appendMessage({ role: "assistant", text: getErrorMessage(error) });
    } finally {
      setActiveRequestId(null);
      setWorking(false);
    }
  }

  async function generateProject() {
    const prompt = createStoryBuildPrompt(storyText.trim(), messages, storyMemory);
    if (!prompt || isWorking) {
      appendMessage({
        role: "assistant",
        text: prompt
          ? "I am already working. Stop the current task first."
          : "Paste the story request into the project generation field first."
      });
      return;
    }

    appendMessage({ role: "user", text: prompt });
    await generateAndApplyProject(prompt);
  }

  function toggleStoryStyle(styleId: string) {
    const currentStyles = normalizeStoryStyleIds(project.storyStyles);
    const nextStyles = currentStyles.includes(styleId)
      ? currentStyles.filter((currentStyleId) => currentStyleId !== styleId)
      : currentStyles.length >= 3
        ? currentStyles
        : [...currentStyles, styleId];

    onApplyProject({
      ...project,
      storyStyles: nextStyles
    });
  }

  async function buildProjectFromChatInput() {
    const prompt = chatInput.trim();
    const buildPrompt = createStoryBuildPrompt(prompt, messages, storyMemory);
    if (!buildPrompt || isWorking) {
      return;
    }

    setChatInput("");
    if (prompt) {
      appendMessage({ role: "user", text: prompt });
    }
    if (!isDiscussionOnlyRequest(prompt) && isProjectEditRequest(prompt)) {
      appendMessage({
        role: "system",
        text: "Manual action: editing the current project now."
      });
      await editCurrentProject(prompt);
      return;
    }

    appendMessage({
      role: "system",
      text: "Writing a hidden JSON project draft. The canvas will stay unchanged until validation passes and you load it."
    });
    await generateAndApplyProject(buildPrompt);
  }

  async function editProjectFromChatInput() {
    const prompt = chatInput.trim();
    const editPrompt = createProjectEditPrompt(prompt, messages, storyMemory);
    if (!editPrompt || isWorking) {
      return;
    }

    setChatInput("");
    if (prompt) {
      appendMessage({ role: "user", text: prompt });
    }

    appendMessage({
      role: "system",
      text: "Manual action: editing the current project using the chat context now."
    });
    await editCurrentProject(editPrompt);
  }

  async function updateStoryMemoryFromExchange(userMessage: string, assistantAnswer: string) {
    if (!window.storyLife?.aiUpdateStoryMemory) {
      return;
    }

    try {
      const result = await window.storyLife.aiUpdateStoryMemory({
        currentMemory: storyMemory,
        userMessage,
        assistantAnswer,
        chatHistory: messages.slice(-12)
      });
      if (result.memoryText.trim() !== "") {
        setStoryMemory(result.memoryText);
      }
    } catch {
      // Story memory is helpful, but chat should not fail if the summary update fails.
    }
  }

  async function editCurrentProject(instruction: string) {
    if (!window.storyLife?.aiEditProject) {
      appendMessage({
        role: "assistant",
        text: "Project editing works only in the desktop Electron window."
      });
      return;
    }

    const requestId = createRequestId();
    const unsubscribeProgress = window.storyLife?.onAIProjectProgress?.(
      requestId,
      ({ delta, status, eventCount, receivedChars }) => {
        if (status) {
          setLiveProjectStatus(status);
          setLiveProjectEvents((currentEvents) => [...currentEvents.slice(-11), status]);
        }
        if (typeof eventCount === "number") {
          setLiveProjectEventCount(eventCount);
        }
        if (typeof receivedChars === "number") {
          setLiveProjectReceivedChars(receivedChars);
        }
        if (delta) {
          setStage("writing");
          liveProjectDraftRef.current = `${liveProjectDraftRef.current}${delta}`;
          setLiveProjectDraft(liveProjectDraftRef.current.slice(-16000));
          setLiveProjectReceivedChars((currentChars) => currentChars + delta.length);
        }
      }
    );

    setActiveRequestId(requestId);
    stopRequestedRef.current = false;
    setWorking(true);
    setStage("thinking");
    liveProjectDraftRef.current = "";
    setLiveProjectDraft("");
    setLiveProjectStatus("Editing current project...");
    setLiveProjectEventCount(0);
    setLiveProjectReceivedChars(0);
    setLiveProjectEvents(["Editing current project..."]);

    try {
      const result = await window.storyLife.aiEditProject({
        instruction,
        projectJson: currentProjectJson,
        storyMemory,
        requestId
      });
      if (stopRequestedRef.current) {
        setStage("stopped");
        return;
      }

      setStage("building");
      const patch = JSON.parse(result.patchJson) as AIProjectPatch;
      const nextProject = mergeProjectPatch(project, patch);
      setStage("drawing");
      await animateProjectDrawing(nextProject);
      setStage("done");
      appendMessage({
        role: "assistant",
        text: `Done. Edited the current project. Scenes: ${nextProject.scenes.length}, flags: ${nextProject.flags.length}.`
      });
    } catch (error) {
      setStage(stopRequestedRef.current ? "stopped" : "error");
      appendMessage({ role: "assistant", text: getErrorMessage(error) });
    } finally {
      unsubscribeProgress?.();
      setActiveRequestId(null);
      setWorking(false);
    }
  }

  async function analyzeStoryLogic() {
    if (!window.storyLife?.aiAnalyzeStoryLogic || isWorking) {
      appendMessage({
        role: "assistant",
        text: window.storyLife?.aiAnalyzeStoryLogic
          ? "I am already working. Stop the current task first."
          : "Story logic analysis works only in the desktop Electron window."
      });
      return;
    }

    const requestId = createRequestId();
    const unsubscribeProgress = window.storyLife?.onAIProjectProgress?.(
      requestId,
      ({ delta, status, eventCount, receivedChars }) => {
        if (status) {
          setLiveProjectStatus(status);
          setLiveProjectEvents((currentEvents) => [...currentEvents.slice(-11), status]);
        }
        if (typeof eventCount === "number") {
          setLiveProjectEventCount(eventCount);
        }
        if (typeof receivedChars === "number") {
          setLiveProjectReceivedChars(receivedChars);
        }
        if (delta) {
          setStage("writing");
          liveProjectDraftRef.current = `${liveProjectDraftRef.current}${delta}`;
          setLiveProjectDraft(liveProjectDraftRef.current.slice(-16000));
          setLiveProjectReceivedChars((currentChars) => currentChars + delta.length);
        }
      }
    );

    setActiveRequestId(requestId);
    stopRequestedRef.current = false;
    setWorking(true);
    setStage("thinking");
    liveProjectDraftRef.current = "";
    setLiveProjectDraft("");
    setLiveProjectStatus("Analyzing story logic...");
    setLiveProjectEventCount(0);
    setLiveProjectReceivedChars(0);
    setLiveProjectEvents(["Analyzing story logic..."]);
    appendMessage({
      role: "system",
      text: "Story editor mode: checking continuity, real choices, branches, and literary logic."
    });

    try {
      const result = await window.storyLife.aiAnalyzeStoryLogic({
        projectJson: currentProjectJson,
        requestId
      });
      if (!stopRequestedRef.current) {
        setStoryLogicReport(result.reportText);
        setLiveProjectDraft(result.reportText);
        setStage("done");
        appendMessage({
          role: "assistant",
          text: "Story logic report is ready. Open the report under Generate project from story."
        });
      }
    } catch (error) {
      setStage(stopRequestedRef.current ? "stopped" : "error");
      appendMessage({ role: "assistant", text: getErrorMessage(error) });
    } finally {
      unsubscribeProgress?.();
      setActiveRequestId(null);
      setWorking(false);
    }
  }

  async function generateAndApplyProject(prompt: string) {
    if (!window.storyLife?.aiGenerateProject) {
      appendMessage({
        role: "assistant",
        text: "Project generation works only in the desktop Electron window."
      });
      return;
    }

    const requestId = createRequestId();
    const unsubscribeProgress = window.storyLife?.onAIProjectProgress?.(
      requestId,
      ({ delta, status, eventCount, receivedChars }) => {
        if (status) {
          setLiveProjectStatus(status);
          setLiveProjectEvents((currentEvents) => [...currentEvents.slice(-11), status]);
        }
        if (typeof eventCount === "number") {
          setLiveProjectEventCount(eventCount);
        }
        if (typeof receivedChars === "number") {
          setLiveProjectReceivedChars(receivedChars);
        }
        if (delta) {
          setStage("writing");
          liveProjectDraftRef.current = `${liveProjectDraftRef.current}${delta}`;
          setLiveProjectDraft(liveProjectDraftRef.current.slice(-16000));
          setLiveProjectReceivedChars((currentChars) => currentChars + delta.length);
        }
      }
    );
    setActiveRequestId(requestId);
    setDraftValidation((current) => ({ ...current, status: "unchecked", checkedAt: "" }));
    liveProjectDraftRef.current = "";
    setLiveProjectDraft("");
    setLiveProjectStatus("Preparing request...");
    setLiveProjectEventCount(0);
    setLiveProjectReceivedChars(0);
    setLiveProjectEvents(["Preparing request..."]);
    setDrawnScenes(0);
    setTargetScenes(0);
    setGeneratedProjectJson("");
    localStorage.removeItem(AI_PROJECT_WORKING_DRAFT_KEY);
    approvedStoryBlueprintRef.current = null;
    projectGenerationStartedRef.current = false;
    stopRequestedRef.current = false;
    setWorking(true);
    setStage("sending");
    appendMessage({
      role: "system",
      text: "Started: planning the story and writing a hidden JSON draft."
    });

    let requestedSceneCount: number | null = null;
    let plannedPromptForRecovery = prompt;
    try {
      requestedSceneCount = extractRequestedSceneCount(prompt);
      const plannedPrompt = await planStoryBeforeBuild(
        prompt,
        requestedSceneCount,
        requestId,
        activeStoryStylePrompt
      );
      plannedPromptForRecovery = plannedPrompt;
      if (approvedStoryBlueprintRef.current) {
        setStage("building");
        setLiveProjectStatus("Compiling the approved story directly into project JSON...");
        const compiledProject = finalizeProjectFromBlueprint(
          {
            ...createDefaultProject(),
            projectName: approvedStoryBlueprintRef.current.title,
            storyStyles: selectedStoryStyles,
            flags: [],
            parameters: [],
            scenes: []
          },
          approvedStoryBlueprintRef.current
        );
        setTargetScenes(compiledProject.scenes.length);
        saveHiddenProjectDraft(compiledProject, plannedPrompt, prompt);
        setStage("done");
        appendMessage({
          role: "assistant",
          text: `JSON draft ready: ${compiledProject.scenes.length} scenes were compiled directly from the approved story blocks, with all choices and links included.`
        });
        return;
      }
      const initialPrompt =
        requestedSceneCount && requestedSceneCount > ONE_SHOT_PROJECT_SCENE_LIMIT
          ? [
              plannedPrompt,
              "",
              `IMPORTANT FOR STORYLIFE BUILDER: This is a large project request for ${requestedSceneCount} scenes.`,
              `For the first response create EXACTLY ${LARGE_PROJECT_CHUNK_SIZE} scenes as a playable opening block.`,
              `The scenes array must contain exactly ${LARGE_PROJECT_CHUNK_SIZE} complete scene objects.`,
              `Render exactly these blueprint scenes: ${approvedStoryBlueprintRef.current?.scenes
                .slice(0, LARGE_PROJECT_CHUNK_SIZE)
                .map((scene) => scene.id)
                .join(", ") || "scene_1 through scene_8"}.`,
              "This temporary block is only writing scene titles and prose. Set choices:[]; the app restores every approved choice after all chunks are present.",
              "The app will ask you for the next blocks later."
            ].join("\n")
          : plannedPrompt;
      if (requestedSceneCount && requestedSceneCount > ONE_SHOT_PROJECT_SCENE_LIMIT) {
        appendMessage({
          role: "system",
          text: `Large project detected: first response limited to ${LARGE_PROJECT_CHUNK_SIZE} scenes, then chunks continue automatically.`
        });
      }
      setStage("thinking");
      projectGenerationStartedRef.current = true;
      const result = await window.storyLife.aiGenerateProject({
        storyText: initialPrompt,
        currentProjectJson,
        storyMemory,
        chatHistory: messages.slice(-16),
        stylePrompt: activeStoryStylePrompt,
        requestId
      });
      if (stopRequestedRef.current) {
        setStage("stopped");
        return;
      }

      setStage("building");
      let nextProject: StoryProject;
      try {
        const rawInitialProject = JSON.parse(result.projectJson) as unknown;
        if (requestedSceneCount && requestedSceneCount > ONE_SHOT_PROJECT_SCENE_LIMIT) {
          nextProject = migrateProject(normalizeProjectBeforeMigration(rawInitialProject));
          if (nextProject.scenes.length === 0) {
            throw new Error("AI did not return any usable opening scenes.");
          }
        } else {
          nextProject = migrateProject(rawInitialProject);
        }
      } catch (error) {
        if (!approvedStoryBlueprintRef.current) {
          throw error;
        }
        const fallbackSceneCount = Math.min(
          requestedSceneCount ?? approvedStoryBlueprintRef.current.scenes.length,
          requestedSceneCount && requestedSceneCount > ONE_SHOT_PROJECT_SCENE_LIMIT
            ? LARGE_PROJECT_CHUNK_SIZE
            : approvedStoryBlueprintRef.current.scenes.length
        );
        nextProject = alignProjectScenesToBlueprint(
          { ...createDefaultProject(), scenes: [] },
          approvedStoryBlueprintRef.current.scenes.slice(0, fallbackSceneCount)
        );
        appendMessage({
          role: "system",
          text: `The opening JSON response was unusable (${getErrorMessage(error)}). The app recovered the opening scenes from the approved blueprint and continued automatically.`
        });
      }
      nextProject = ensureGeneratedChoiceOutcomes(
        stripAIParametersFromGeneratedProject(nextProject)
      );
      if (approvedStoryBlueprintRef.current) {
        const openingSceneCount = Math.min(
          requestedSceneCount ?? approvedStoryBlueprintRef.current.scenes.length,
          requestedSceneCount && requestedSceneCount > ONE_SHOT_PROJECT_SCENE_LIMIT
            ? LARGE_PROJECT_CHUNK_SIZE
            : approvedStoryBlueprintRef.current.scenes.length
        );
        nextProject = alignProjectScenesToBlueprint(
          nextProject,
          approvedStoryBlueprintRef.current.scenes.slice(0, openingSceneCount)
        );
      }
      nextProject = {
        ...nextProject,
        storyStyles: selectedStoryStyles
      };
      const finalTargetSceneCount =
        requestedSceneCount && requestedSceneCount > nextProject.scenes.length
          ? requestedSceneCount
          : nextProject.scenes.length;
      setTargetScenes(finalTargetSceneCount);
      appendMessage({
        role: "system",
        text: `AI returned ${nextProject.scenes.length} scenes. Saving the first hidden JSON draft block...`
      });
      saveWorkingProjectDraft(nextProject, plannedPrompt, prompt);

      nextProject = await continueLargeProjectIfNeeded(
        plannedPrompt,
        nextProject,
        requestedSceneCount,
        requestId,
        activeStoryStylePrompt
      );

      if (approvedStoryBlueprintRef.current) {
        nextProject = finalizeProjectFromBlueprint(
          nextProject,
          approvedStoryBlueprintRef.current
        );
      } else {
        nextProject = await repairFakeChoicesBeforeSaving(
          nextProject,
          nextProject.scenes.map((scene) => scene.id),
          plannedPrompt,
          requestId
        );
        nextProject = await repairConnectivityBeforeSaving(
          nextProject,
          [],
          plannedPrompt,
          requestId,
          true
        );
      }

      if (
        !stopRequestedRef.current &&
        requestedSceneCount &&
        nextProject.scenes.length < requestedSceneCount
      ) {
        throw new Error(
          `JSON generation stopped early at ${nextProject.scenes.length}/${requestedSceneCount} scenes.`
        );
      }

      saveHiddenProjectDraft(nextProject, plannedPrompt, prompt);

      if (!stopRequestedRef.current) {
        setStage("done");
        appendMessage({
          role: "assistant",
          text: `JSON draft ready: ${nextProject.scenes.length} scenes. Check it before loading into the Builder.`
        });
      }
    } catch (error) {
      const approvedBlueprint = approvedStoryBlueprintRef.current;
      if (
        approvedBlueprint &&
        (!requestedSceneCount || approvedBlueprint.scenes.length >= requestedSceneCount)
      ) {
        try {
          const recoveredSource = readWorkingProjectDraft() ?? {
            ...createDefaultProject(),
            projectName: approvedBlueprint.title,
            storyStyles: selectedStoryStyles,
            scenes: []
          };
          const compiledProject = finalizeProjectFromBlueprint(
            recoveredSource,
            approvedBlueprint
          );
          saveHiddenProjectDraft(compiledProject, plannedPromptForRecovery, prompt);
          setStage("done");
          appendMessage({
            role: "assistant",
            text: `JSON draft recovered directly from the approved story plan: ${compiledProject.scenes.length} scenes, with every choice and link restored.`
          });
          return;
        } catch (compileError) {
          appendMessage({
            role: "system",
            text: `Direct blueprint recovery failed: ${getErrorMessage(compileError)}`
          });
        }
      }

      const recoveredProject = projectGenerationStartedRef.current
        ? recoverProjectFromLiveDraft() ?? readWorkingProjectDraft()
        : readWorkingProjectDraft();
      if (recoveredProject) {
        const alignedRecoveredProject = approvedStoryBlueprintRef.current
          ? alignProjectScenesToBlueprint(
              recoveredProject,
              approvedStoryBlueprintRef.current.scenes.slice(
                0,
                Math.min(recoveredProject.scenes.length, requestedSceneCount ?? recoveredProject.scenes.length)
              )
            )
          : recoveredProject;
        if (
          requestedSceneCount &&
          alignedRecoveredProject.scenes.length < requestedSceneCount &&
          window.storyLife?.aiExpandProjectChunk
        ) {
          appendMessage({
            role: "system",
            text: `Recovered only ${alignedRecoveredProject.scenes.length}/${requestedSceneCount} scenes. This is not a finished draft; continuing automatically.`
          });
          try {
            let continuedProject = await continueLargeProjectIfNeeded(
              plannedPromptForRecovery,
              alignedRecoveredProject,
              requestedSceneCount,
              requestId,
              activeStoryStylePrompt
            );
            if (continuedProject.scenes.length >= requestedSceneCount) {
              if (approvedStoryBlueprintRef.current) {
                continuedProject = finalizeProjectFromBlueprint(
                  continuedProject,
                  approvedStoryBlueprintRef.current
                );
              }
              saveHiddenProjectDraft(continuedProject, plannedPromptForRecovery, prompt);
              setStage("done");
              appendMessage({
                role: "assistant",
                text: `JSON draft recovered and completed: ${continuedProject.scenes.length} scenes. Check it before loading.`
              });
              return;
            }
          } catch (continuationError) {
            appendMessage({
              role: "system",
              text: `Automatic continuation also failed: ${getErrorMessage(continuationError)}`
            });
          }
        }
        const finalRecoveredProject =
          approvedStoryBlueprintRef.current &&
          alignedRecoveredProject.scenes.length >= approvedStoryBlueprintRef.current.scenes.length
            ? finalizeProjectFromBlueprint(
                alignedRecoveredProject,
                approvedStoryBlueprintRef.current
              )
            : alignedRecoveredProject;
        if (
          requestedSceneCount &&
          finalRecoveredProject.scenes.length >= requestedSceneCount
        ) {
          saveHiddenProjectDraft(finalRecoveredProject, plannedPromptForRecovery, prompt);
          setStage("done");
          appendMessage({
            role: "assistant",
            text: `JSON draft recovered and completed: ${finalRecoveredProject.scenes.length} scenes. Check it before loading.`
          });
          return;
        }
        saveWorkingProjectDraft(finalRecoveredProject, plannedPromptForRecovery, prompt);
        setStage("error");
        appendMessage({
          role: "assistant",
          text: `Only ${finalRecoveredProject.scenes.length}${requestedSceneCount ? `/${requestedSceneCount}` : ""} scenes were recovered. The incomplete working file was kept privately and was not exposed as a checkable JSON Draft.`
        });
        return;
      }
      setStage(stopRequestedRef.current ? "stopped" : "error");
      appendMessage({
        role: "assistant",
        text: stopRequestedRef.current ? "Stopped." : getErrorMessage(error)
      });
    } finally {
      unsubscribeProgress?.();
      setActiveRequestId(null);
      setWorking(false);
    }
  }

  async function planStoryBeforeBuild(
    prompt: string,
    requestedSceneCount: number | null,
    requestId: string,
    stylePrompt: string
  ): Promise<string> {
    if (!window.storyLife?.aiPlanStory) {
      return prompt;
    }

    setStage("thinking");
    liveProjectDraftRef.current = "";
    setLiveProjectDraft("");
    setLiveProjectStatus("Planning the whole story before building nodes...");
    setLiveProjectEvents((currentEvents) => [
      ...currentEvents.slice(-11),
      "Planning the complete interactive story, branches, consequences, and endings."
    ]);
    appendMessage({
      role: "system",
      text: "Planning first: AI is designing the whole story before creating scenes."
    });

    let approvedBlueprintJson = "";
    let previousProblems: string[] = [];
    if (
      requestedSceneCount &&
      requestedSceneCount >= 3 &&
      window.storyLife.aiPlanStoryArchitecture &&
      window.storyLife.aiPlanStoryChunk
    ) {
      const chunkedBlueprint = await planLargeStoryBlueprintInChunks(
        prompt,
        requestedSceneCount,
        requestId,
        stylePrompt
      );
      approvedBlueprintJson = JSON.stringify(chunkedBlueprint, null, 2);
      approvedStoryBlueprintRef.current = chunkedBlueprint;
    } else {
      for (let attempt = 1; attempt <= STORY_BLUEPRINT_ATTEMPTS; attempt += 1) {
        const result = await window.storyLife.aiPlanStory({
          storyText:
            attempt === 1
              ? prompt
              : [
                  prompt,
                  "",
                  "THE PREVIOUS STORY BLUEPRINT WAS REJECTED BY THE GRAPH OR NARRATIVE CHECK:",
                  ...previousProblems.map((problem) => `- ${problem}`),
                  "Rewrite the complete blueprint from scratch and fix every listed problem."
                ].join("\n"),
          targetSceneCount: requestedSceneCount,
          storyMemory,
          chatHistory: messages.slice(-16),
          stylePrompt,
          requestId
        });

        if (stopRequestedRef.current) {
          return prompt;
        }

        try {
          const blueprintJson = extractJsonObjectFromText(result.planText);
          const semanticValidation = validateSemanticStoryBlueprint(
            JSON.parse(blueprintJson),
            requestedSceneCount
          );
          previousProblems = semanticValidation.problems;
          if (semanticValidation.blueprint && semanticValidation.problems.length === 0) {
            const candidateBlueprint = compileSemanticStoryBlueprint(
              semanticValidation.blueprint
            );
            const candidateBlueprintJson = JSON.stringify(candidateBlueprint, null, 2);
            if (window.storyLife?.aiReviewStoryBlueprint) {
              setLiveProjectStatus("Reviewing the blueprint as an interactive story...");
              const reviewResult = await window.storyLife.aiReviewStoryBlueprint({
                blueprintJson: candidateBlueprintJson,
                storyRequest: prompt,
                requestId
              });
              if (!reviewResult.review.passes) {
                previousProblems = [
                  ...reviewResult.review.problems,
                  reviewResult.review.rewriteInstruction
                    ? `Rewrite instruction: ${reviewResult.review.rewriteInstruction}`
                    : ""
                ].filter(Boolean);
              } else {
                approvedBlueprintJson = candidateBlueprintJson;
                approvedStoryBlueprintRef.current = candidateBlueprint;
                break;
              }
            } else {
              approvedBlueprintJson = candidateBlueprintJson;
              approvedStoryBlueprintRef.current = candidateBlueprint;
              break;
            }
          }
        } catch (error) {
          previousProblems = [`Blueprint planning or review failed: ${getErrorMessage(error)}`];
        }

        appendMessage({
          role: "system",
          text: `Story blueprint attempt ${attempt} was rejected: ${previousProblems.slice(0, 6).join("; ")}`
        });
        setLiveProjectStatus(
          `Rewriting invalid story blueprint (${attempt}/${STORY_BLUEPRINT_ATTEMPTS})...`
        );
      }
    }

    if (!approvedBlueprintJson) {
      throw new Error(
        `AI failed to create a connected story blueprint: ${previousProblems.slice(0, 8).join("; ")}`
      );
    }

    setStoryPlan(approvedBlueprintJson);
    setLiveProjectDraft(approvedBlueprintJson);
    liveProjectDraftRef.current = "";
    appendMessage({
      role: "system",
      text: "The complete story blueprint passed graph and narrative checks. Now converting it to project JSON."
    });

    return [
      prompt,
      "",
      "APPROVED STORY BLUEPRINT JSON TO FOLLOW STRICTLY:",
      approvedBlueprintJson,
      "",
      "SELECTED STORY STYLE RULES:",
      stylePrompt,
      "",
      "Build scenes from this plan. Do not improvise a different plot.",
      "Treat the plan as a literary blueprint: scene beat map, branch promise map, character continuity, and ending plan are binding. Ignore unnecessary state bookkeeping.",
      "For every choice, the target scene must logically continue that exact choice or explicitly explain the transition.",
      "When a scene has multiple choices, every choice must lead to a different immediate target scene. If there is only one next event, create one honest choice.",
      "Do not create random scenes. Every scene must advance the central conflict, reveal information, raise danger, change a relationship, or pay off a previous choice."
    ].join("\n");
  }

  async function planLargeStoryBlueprintInChunks(
    prompt: string,
    targetSceneCount: number,
    requestId: string,
    stylePrompt: string
  ): Promise<StoryBlueprint> {
    let architecture: Record<string, unknown> | null = null;
    let architectureJson = "";
    let mapProblems: string[] = [];

    for (let attempt = 1; attempt <= STORY_MAP_ATTEMPTS; attempt += 1) {
      setLiveProjectStatus(`Writing the story map (${attempt}/${STORY_MAP_ATTEMPTS})...`);
      liveProjectDraftRef.current = "";
      setLiveProjectDraft("");
      try {
        const architectureResult = await window.storyLife!.aiPlanStoryArchitecture({
          storyText: prompt,
          targetSceneCount,
          storyMemory,
          chatHistory: messages.slice(-16),
          stylePrompt,
          correctionProblems: mapProblems,
          requestId
        });
        const rawArchitectureJson = extractJsonObjectFromText(
          architectureResult.architectureText
        );
        const parsedArchitecture = JSON.parse(rawArchitectureJson) as unknown;
        if (!isPlainObject(parsedArchitecture)) {
          throw new Error("The story map is not a JSON object.");
        }
        const fitted = fitStoryArchitectureToSceneCount(
          parsedArchitecture,
          targetSceneCount
        );
        architecture = fitted.architecture;
        architectureJson = JSON.stringify(architecture, null, 2);
        readRequiredArchitectureText(architecture, "title");
        readRequiredArchitectureText(architecture, "premise");
        readRequiredArchitectureText(architecture, "tone");
        readArchitectureSceneKeys(architecture, targetSceneCount);
        if (fitted.changed) {
          appendMessage({
            role: "system",
            text: `AI suggested ${fitted.originalSceneCount} story beats. The Builder fitted them to exactly ${targetSceneCount} connected scenes without restarting the story.`
          });
        }
        break;
      } catch (error) {
        if (stopRequestedRef.current) {
          throw error;
        }
        mapProblems = [getErrorMessage(error)].filter(Boolean);
        appendMessage({
          role: "system",
          text: `Story map attempt ${attempt} could not be read: ${mapProblems.join("; ")}`
        });
      }
    }

    if (!architecture) {
      throw new Error(`AI could not return a readable story map: ${mapProblems.join("; ")}`);
    }

    const title = readRequiredArchitectureText(architecture, "title");
    const premise = readRequiredArchitectureText(architecture, "premise");
    const tone = readRequiredArchitectureText(architecture, "tone");
    const completeSceneOrder = readArchitectureSceneKeys(architecture, targetSceneCount);
    let blueprint: SemanticStoryBlueprint = { title, premise, tone, scenes: [] };
    appendMessage({
      role: "system",
      text: `Story map locked to ${targetSceneCount} scenes. Writing the actual story in blocks of ${LARGE_PROJECT_CHUNK_SIZE}.`
    });

    while (blueprint.scenes.length < targetSceneCount) {
      if (stopRequestedRef.current) throw new Error("Stopped by user.");
      const startNumber = blueprint.scenes.length + 1;
      const remainingSceneCount = targetSceneCount - blueprint.scenes.length;
      const candidateChunkSizes = [
        Math.min(LARGE_PROJECT_CHUNK_SIZE, remainingSceneCount),
        Math.min(3, remainingSceneCount),
        1
      ].filter((size, index, sizes) => size > 0 && sizes.indexOf(size) === index);
      let chunkProblems: string[] = [];
      let acceptedScenes: SemanticStoryScene[] | null = null;

      for (const chunkSize of candidateChunkSizes) {
        const requiredSceneKeys = completeSceneOrder.slice(
          startNumber - 1,
          startNumber - 1 + chunkSize
        );
        for (let attempt = 1; attempt <= STORY_BLUEPRINT_CHUNK_ATTEMPTS; attempt += 1) {
          setLiveProjectStatus(
            `Writing scenes ${startNumber}-${startNumber + chunkSize - 1} (${blueprint.scenes.length}/${targetSceneCount} ready)...`
          );
          liveProjectDraftRef.current = "";
          setLiveProjectDraft("");
          try {
            const chunkResult = await window.storyLife!.aiPlanStoryChunk({
              storyText: prompt,
              targetSceneCount,
              architectureJson,
              approvedBlueprintJson: JSON.stringify(blueprint, null, 2),
              requiredSceneKeys,
              correctionProblems: chunkProblems,
              stylePrompt,
              requestId
            });
            const rawChunk = JSON.parse(
              extractJsonObjectFromText(chunkResult.chunkText)
            ) as unknown;
            const validation = validateSemanticStoryBlueprintChunk(
              blueprint,
              rawChunk,
              requiredSceneKeys,
              completeSceneOrder
            );
            chunkProblems = [
              ...validation.problems,
              ...findArchitectureContractProblems(architecture, validation.scenes)
            ];
            if (chunkProblems.length === 0) {
              if (window.storyLife?.aiReviewStoryChunk) {
                setLiveProjectStatus(
                  `Editing story logic in scenes ${startNumber}-${startNumber + chunkSize - 1}...`
                );
                const reviewResult = await window.storyLife.aiReviewStoryChunk({
                  architectureJson,
                  approvedBlueprintJson: JSON.stringify(blueprint, null, 2),
                  chunkJson: JSON.stringify({ scenes: validation.scenes }, null, 2),
                  storyRequest: prompt,
                  requestId
                });
                if (!reviewResult.review.passes) {
                  chunkProblems = [
                    ...reviewResult.review.problems,
                    reviewResult.review.rewriteInstruction
                      ? `Rewrite instruction: ${reviewResult.review.rewriteInstruction}`
                      : ""
                  ].filter(Boolean);
                  continue;
                }
              }
              acceptedScenes = validation.scenes;
              break;
            }
          } catch (error) {
            chunkProblems = [`Block JSON failed: ${getErrorMessage(error)}`];
          }
          appendMessage({
            role: "system",
            text: `Scenes ${startNumber}-${startNumber + chunkSize - 1}, attempt ${attempt}, need a local rewrite: ${chunkProblems.slice(0, 5).join("; ")}`
          });
        }
        if (acceptedScenes) break;
      }

      if (!acceptedScenes) {
        throw new Error(
          `AI could not write scene ${startNumber} correctly: ${chunkProblems.slice(0, 6).join("; ")}`
        );
      }

      blueprint = { ...blueprint, scenes: [...blueprint.scenes, ...acceptedScenes] };
      const partialBlueprintJson = JSON.stringify(blueprint, null, 2);
      setStoryPlan(partialBlueprintJson);
      setLiveProjectDraft(partialBlueprintJson.slice(-40000));
      setLiveProjectEvents((events) => [
        ...events.slice(-11),
        `Story block saved: ${blueprint.scenes.length}/${targetSceneCount} scenes.`
      ]);
    }

    const fullValidation = validateSemanticStoryBlueprint(blueprint, targetSceneCount);
    if (!fullValidation.blueprint || fullValidation.problems.length > 0) {
      throw new Error(
        `The assembled story has technical link errors: ${fullValidation.problems.slice(0, 8).join("; ")}`
      );
    }
    return compileSemanticStoryBlueprint(fullValidation.blueprint);
  }

  async function reviewAndFixStoryBlock(
    projectToReview: StoryProject,
    sceneIds: string[],
    planText: string,
    requestId: string
  ): Promise<StoryProject> {
    if (
      sceneIds.length === 0 ||
      !window.storyLife?.aiReviewStoryBlock ||
      !window.storyLife?.aiEditProject
    ) {
      return projectToReview;
    }

    try {
      setLiveProjectStatus("Reviewing generated block against the story plan...");
      setLiveProjectEvents((currentEvents) => [
        ...currentEvents.slice(-11),
        `Reviewing block: ${sceneIds.slice(0, 5).join(", ")}${
          sceneIds.length > 5 ? "..." : ""
        }`
      ]);
      const reviewResult = await window.storyLife.aiReviewStoryBlock({
        storyPlan: planText,
        projectJson: serializeProject(projectToReview),
        sceneIds,
        requestId
      });

      if (reviewResult.review.passes) {
        appendMessage({
          role: "system",
          text: `Block review passed: ${sceneIds.length} scene(s) follow the plan.`
        });
        return projectToReview;
      }

      const problems = reviewResult.review.problems.join("; ");
      appendMessage({
        role: "system",
        text: `Block review found issues: ${problems || "continuity problems"}. Fixing this block now.`
      });

      const editResult = await window.storyLife.aiEditProject({
        instruction: [
          "Fix only this generated scene block so it follows the approved story plan.",
          `Scene ids to fix: ${sceneIds.join(", ")}`,
          "Do not replace the whole project. Do not add more than 2 connective scenes unless absolutely necessary.",
          "Keep existing ids, media paths, layout settings, and node positions unless the fix requires a small text/link change.",
          "Reviewer problems:",
          problems || "The block failed continuity review.",
          "Rewrite instruction:",
          reviewResult.review.rewriteInstruction
        ].join("\n"),
        projectJson: serializeProject(projectToReview),
        storyMemory,
        requestId
      });
      const patch = JSON.parse(editResult.patchJson) as AIProjectPatch;
      const fixedProject = mergeProjectPatch(projectToReview, patch);
      appendMessage({
        role: "system",
        text: "Block was corrected after review."
      });
      return fixedProject;
    } catch (error) {
      appendMessage({
        role: "system",
        text: `Block review/fix skipped after error: ${getErrorMessage(error)}`
      });
      return projectToReview;
    }
  }

  async function repairFakeChoicesBeforeSaving(
    projectToRepair: StoryProject,
    sceneIds: string[],
    planText: string,
    requestId: string
  ): Promise<StoryProject> {
    let nextProject = projectToRepair;
    if (!window.storyLife?.aiEditProject) {
      const remainingIssues = findFakeChoiceIssues(nextProject, sceneIds);
      if (remainingIssues.length > 0) {
        throw new Error(`Generated block contains ${remainingIssues.length} fake-choice scene(s).`);
      }
      return nextProject;
    }

    for (let pass = 1; pass <= 2; pass += 1) {
      const issues = findFakeChoiceIssues(nextProject, sceneIds);
      if (issues.length === 0) {
        return nextProject;
      }

      appendMessage({
        role: "system",
        text: `Mechanical choice check rejected ${issues.length} fake-choice scene(s). Rewriting them before the draft can continue.`
      });
      for (const [batchIndex, batch] of chunkItems(issues, 6).entries()) {
        if (stopRequestedRef.current) {
          return nextProject;
        }
        setLiveProjectStatus(
          `Rewriting fake choices: pass ${pass}, batch ${batchIndex + 1}/${Math.ceil(issues.length / 6)}...`
        );
        const editResult = await window.storyLife.aiEditProject({
          instruction: [
            "Rewrite these fake-choice scenes before the JSON block is accepted.",
            "Every scene with multiple choices must send each choice to a different immediate targetNodeId.",
            "Each target scene must logically and directly continue its exact incoming choice.",
            "Branches may converge only later, after distinct consequence scenes. If there is only one next event, keep one honest choice.",
            "Do not add flags or parameters to fake the consequence. Do not replace the story or rename stable scene ids.",
            "SCENES REJECTED BY THE MECHANICAL CHECK:",
            ...batch.map((issue) => `- ${issue}`),
            "APPROVED STORY PLAN:",
            planText.slice(0, 10000)
          ].join("\n"),
          projectJson: serializeProject(nextProject),
          storyMemory,
          requestId
        });
        nextProject = mergeProjectPatch(
          nextProject,
          JSON.parse(editResult.patchJson) as AIProjectPatch
        );
      }
    }

    const remainingIssues = findFakeChoiceIssues(nextProject, sceneIds);
    if (remainingIssues.length > 0) {
      throw new Error(
        `AI failed to repair ${remainingIssues.length} fake-choice scene(s): ${remainingIssues.slice(0, 6).join("; ")}`
      );
    }
    return nextProject;
  }

  async function repairConnectivityBeforeSaving(
    projectToRepair: StoryProject,
    requiredFrontierIds: string[],
    planText: string,
    requestId: string,
    requireCompleteGraph: boolean
  ): Promise<StoryProject> {
    let nextProject = ensureGeneratedChoiceOutcomes(projectToRepair);
    for (let pass = 1; pass <= 2; pass += 1) {
      const issues = findConnectivityIssues(
        nextProject,
        requiredFrontierIds,
        requireCompleteGraph
      );
      if (issues.length === 0) {
        return nextProject;
      }
      if (!window.storyLife?.aiEditProject) {
        throw new Error(`Generated story graph is disconnected: ${issues.slice(0, 8).join("; ")}`);
      }

      appendMessage({
        role: "system",
        text: `Graph check rejected ${issues.length} connection problem(s). Stitching the story before continuing.`
      });
      const maxBatches = Math.min(6, Math.ceil(issues.length / 6));
      for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
        const currentIssues = findConnectivityIssues(
          nextProject,
          requiredFrontierIds,
          requireCompleteGraph
        );
        if (currentIssues.length === 0) {
          break;
        }
        const batch = currentIssues.slice(0, 6);
        setLiveProjectStatus(
          `Stitching story graph: pass ${pass}, batch ${batchIndex + 1}/${maxBatches}...`
        );
        const editResult = await window.storyLife.aiEditProject({
          instruction: [
            "Repair this StoryLife interactive quest graph before the JSON draft is accepted.",
            "Connect unfinished frontier scenes from the previous chunk to logical scenes in the new chunk.",
            "Make every listed unreachable scene reachable from scene_1 through choices that make narrative sense.",
            "Every normal scene in the complete final graph needs at least one choice. Actual ending scenes must use sceneType ending and choices:[].",
            "Multiple choices in one scene need distinct immediate targets. Do not add flags or parameters.",
            "Every choice must include one 100-percent outcome pointing to the same targetNodeId.",
            "Do not create random links merely to satisfy reachability. Preserve the approved story and make the transition text causally coherent.",
            `GRAPH PROBLEM BATCH ${batchIndex + 1}/${maxBatches}:`,
            ...batch.map((issue) => `- ${issue}`),
            "APPROVED FULL STORY PLAN:",
            planText.slice(0, 10000)
          ].join("\n"),
          projectJson: serializeProject(nextProject),
          storyMemory,
          requestId
        });
        nextProject = ensureGeneratedChoiceOutcomes(
          mergeProjectPatch(
            nextProject,
            JSON.parse(editResult.patchJson) as AIProjectPatch
          )
        );
      }
    }

    const remainingIssues = findConnectivityIssues(
      nextProject,
      requiredFrontierIds,
      requireCompleteGraph
    );
    if (remainingIssues.length > 0) {
      throw new Error(
        `AI failed to connect the story graph after two repair passes: ${remainingIssues.slice(0, 8).join("; ")}`
      );
    }
    return nextProject;
  }

  async function continueLargeProjectIfNeeded(
    prompt: string,
    startProject: StoryProject,
    requestedSceneCount: number | null,
    requestId: string,
    stylePrompt: string
  ): Promise<StoryProject> {
    let nextProject = startProject;
    const approvedBlueprint = approvedStoryBlueprintRef.current;
    if (
      approvedBlueprint &&
      (!requestedSceneCount || approvedBlueprint.scenes.length >= requestedSceneCount)
    ) {
      return finalizeProjectFromBlueprint(nextProject, approvedBlueprint);
    }
    if (
      !requestedSceneCount ||
      nextProject.scenes.length >= requestedSceneCount ||
      !window.storyLife?.aiExpandProjectChunk
    ) {
      return nextProject;
    }

    appendMessage({
      role: "system",
      text: `Large project draft: requested ${requestedSceneCount} scenes, received ${nextProject.scenes.length}. Continuing in strict JSON chunks.`
    });

    while (!stopRequestedRef.current && nextProject.scenes.length < requestedSceneCount) {
      const remainingScenes = requestedSceneCount - nextProject.scenes.length;
      const batchSize = Math.min(LARGE_PROJECT_CHUNK_SIZE, remainingScenes);
      setStage("thinking");
      liveProjectDraftRef.current = "";
      setLiveProjectDraft("");
      setLiveProjectStatus(
        `Requesting next chunk: ${nextProject.scenes.length}/${requestedSceneCount} scenes ready.`
      );
      setLiveProjectEvents((currentEvents) => [
        ...currentEvents.slice(-11),
        `Requesting next chunk: ${batchSize} scenes.`
      ]);

      const memoryLibrary = createProjectMemoryLibrary(nextProject, prompt, storyText);
      const retryBatchSizes = [
        batchSize,
        Math.min(5, remainingScenes),
        Math.min(3, remainingScenes)
      ].filter((size, index, sizes) => size > 0 && sizes.indexOf(size) === index);
      let expandedProject: StoryProject | null = null;
      let lastChunkError: unknown = null;

      for (const [attemptIndex, retryBatchSize] of retryBatchSizes.entries()) {
        const blueprintScenes = approvedStoryBlueprintRef.current?.scenes.slice(
          nextProject.scenes.length,
          nextProject.scenes.length + retryBatchSize
        ) ?? [];
        const requiredSceneIds = blueprintScenes.length > 0
          ? blueprintScenes.map((scene) => scene.id)
          : Array.from(
              { length: retryBatchSize },
              (_, index) => `scene_${nextProject.scenes.length + index + 1}`
            );

        try {
          liveProjectDraftRef.current = "";
          setLiveProjectDraft("");
          const chunkResult = await window.storyLife.aiExpandProjectChunk({
            storyText: prompt,
            projectJson: serializeProject(nextProject),
            targetSceneCount: requestedSceneCount,
            batchSize: retryBatchSize,
            requiredSceneIds,
            blueprintChunkJson:
              blueprintScenes.length > 0 ? JSON.stringify(blueprintScenes, null, 2) : undefined,
            stylePrompt,
            memoryLibrary,
            requestId
          });
          const rawPatch = JSON.parse(chunkResult.patchJson) as AIProjectPatch;
          const shapeProblems = findGeneratedChunkShapeProblems(rawPatch, requiredSceneIds);
          if (shapeProblems.length > 0 && attemptIndex < retryBatchSizes.length - 1) {
            throw new Error(shapeProblems.join("; "));
          }
          const safePatch = blueprintScenes.length > 0
            ? createBlueprintSceneTextPatch(rawPatch, blueprintScenes)
            : rawPatch;
          expandedProject = mergeProjectPatch(nextProject, safePatch);
          break;
        } catch (error) {
          lastChunkError = error;
          appendMessage({
            role: "system",
            text: `Scene-text chunk attempt ${attemptIndex + 1} failed: ${getErrorMessage(error)}${
              attemptIndex < retryBatchSizes.length - 1
                ? " Retrying a smaller exact scene list."
                : ""
            }`
          });
        }
      }

      if (!expandedProject && approvedStoryBlueprintRef.current) {
        const fallbackScenes = approvedStoryBlueprintRef.current.scenes.slice(
          nextProject.scenes.length,
          nextProject.scenes.length + Math.min(3, remainingScenes)
        );
        expandedProject = mergeProjectPatch(
          nextProject,
          createBlueprintSceneTextPatch({ newScenes: [] }, fallbackScenes)
        );
        appendMessage({
          role: "system",
          text: `The remote writer failed this small block (${getErrorMessage(lastChunkError)}). The app recovered those scenes from the approved blueprint and continued automatically.`
        });
      }

      if (!expandedProject || expandedProject.scenes.length <= nextProject.scenes.length) {
        throw new Error(
          `AI returned a chunk, but it did not add the required scenes: ${getErrorMessage(lastChunkError)}`
        );
      }

      nextProject = expandedProject;
      saveWorkingProjectDraft(nextProject, prompt, storyText);
      setStage("building");
      appendMessage({
        role: "system",
        text: `Hidden JSON draft updated: ${nextProject.scenes.length}/${requestedSceneCount} scenes.`
      });
      if (nextProject.scenes.length < requestedSceneCount) {
        appendMessage({
          role: "system",
          text: `Pausing briefly, then continuing with the next ${LARGE_PROJECT_CHUNK_SIZE}-scene block.`
        });
        await wait(LARGE_PROJECT_CHUNK_PAUSE_MS);
      }
    }

    return nextProject;
  }

  function createPatchFromSimpleSceneText(
    project: StoryProject,
    simpleText: string
  ): AIProjectPatch {
    const blocks = parseSimpleSceneBlocks(simpleText);
    const firstNewIndex = getNextSceneNumber(project);
    const flags = createSimpleFlags(simpleText, 0, project.flags);
    const flagMap = createSimpleFlagMap([...project.flags, ...flags]);
    const newScenes = blocks.map((block, index) => {
      const sceneNumber = firstNewIndex + index;
      const sceneId = `scene_${sceneNumber}`;
      const scene = createScene(sceneNumber, sceneId);
      const title = readSimpleField(block, "TITLE") || `Scene ${sceneNumber}`;
      const text = readSimpleField(block, "TEXT") || "The story continues.";
      const choices = readSimpleChoices(block);
      const sceneChoices = choices.length > 0 ? choices : [createFallbackSimpleChoice()];

      return {
        ...scene,
        title,
        text,
        position: {
          x: 120 + ((sceneNumber - 1) % 5) * 260,
          y: 120 + Math.floor((sceneNumber - 1) / 5) * 190
        },
        choices: sceneChoices.map((choice, choiceIndex) =>
          createChoiceFromSimple(
            choice,
            resolveSimpleChoiceTarget(choice, sceneNumber, choiceIndex, firstNewIndex, blocks.length),
            `choice_${sceneNumber}_${choiceIndex + 1}`,
            flagMap
          )
        )
      };
    });

    const updatedScenes = newScenes[0]
      ? project.scenes.slice(-3).map((scene) => ({
          ...scene,
          choices: bridgeTailChoicesToNewBlock(scene, newScenes)
        }))
      : [];

    return {
      storyBible: project.storyBible,
      flags,
      parameters: [],
      updatedScenes,
      newScenes
    };
  }

  function recoverProjectFromLiveDraft(): StoryProject | null {
    try {
      const jsonText = extractJsonObjectFromText(liveProjectDraftRef.current);
      return ensureGeneratedChoiceOutcomes(
        stripAIParametersFromGeneratedProject(
          migrateProject(normalizeProjectBeforeMigration(JSON.parse(jsonText)))
        )
      );
    } catch {
      return null;
    }
  }

  function recoverPatchFromLiveDraft(project: StoryProject): AIProjectPatch | null {
    try {
      const jsonText = extractJsonObjectFromText(liveProjectDraftRef.current);
      const parsed = JSON.parse(jsonText) as AIProjectPatch;
      const expanded = mergeProjectPatch(project, parsed);
      return expanded.scenes.length > project.scenes.length ? parsed : null;
    } catch {
      return null;
    }
  }

  function readWorkingProjectDraft(): StoryProject | null {
    try {
      const workingJson = localStorage.getItem(AI_PROJECT_WORKING_DRAFT_KEY);
      return workingJson ? migrateProject(JSON.parse(workingJson)) : null;
    } catch {
      return null;
    }
  }

  async function animateProjectDrawing(nextProject: StoryProject) {
    const totalScenes = nextProject.scenes.length;
    const batchSize = totalScenes > 80 ? 8 : totalScenes > 40 ? 5 : 2;

    for (let visibleCount = 1; visibleCount <= totalScenes; visibleCount += batchSize) {
      if (stopRequestedRef.current) {
        setStage("stopped");
        return;
      }

      const sceneIds = new Set(nextProject.scenes.slice(0, visibleCount).map((scene) => scene.id));
      const visibleScenes = nextProject.scenes.slice(0, visibleCount).map((scene) => ({
        ...scene,
        choices: scene.choices
          .filter((choice) => sceneIds.has(choice.targetNodeId))
          .map((choice) => ({
            ...choice,
            conditionalTargets: choice.conditionalTargets.filter((target) =>
              sceneIds.has(target.targetSceneId)
            )
          }))
      }));

      onApplyProject({
        ...nextProject,
        scenes: visibleScenes,
        startSceneId: visibleScenes[0]?.id ?? nextProject.startSceneId
      });
      setDrawnScenes(Math.min(visibleCount, totalScenes));
      await wait(110);
    }

    if (!stopRequestedRef.current) {
      onApplyProject(nextProject);
      setDrawnScenes(totalScenes);
    }
  }

  async function stopAIWork() {
    stopRequestedRef.current = true;
    setStage("stopped");
    updateImageQueue(
      imageQueueRef.current.map((item) =>
        item.status === "running" || item.status === "queued"
          ? { ...item, status: "error", error: "Stopped by user." }
          : item
      )
    );
    if (activeRequestId && window.storyLife?.aiCancel) {
      await window.storyLife.aiCancel(activeRequestId).catch(() => undefined);
    }
    if (activeImageRequestIdRef.current && window.storyLife?.aiCancel) {
      await window.storyLife
        .aiCancel(activeImageRequestIdRef.current)
        .catch(() => undefined);
    }
    appendMessage({ role: "system", text: "Stopped by user." });
    setWorking(false);
    setActiveRequestId(null);
  }

  function saveHiddenProjectDraft(
    nextProject: StoryProject,
    planText: string,
    originalPrompt: string
  ) {
    const serializedProject = serializeProject(nextProject);
    const localValidation = validateProjectDraftJson(serializedProject);
    if (localValidation.problems.length > 0) {
      throw new Error(
        `The project cannot be exposed as a finished JSON Draft: ${localValidation.problems.slice(0, 8).join("; ")}`
      );
    }
    localStorage.removeItem(AI_PROJECT_WORKING_DRAFT_KEY);
    setGeneratedProjectJson(serializedProject);
    setProjectMemoryLibrary(
      createProjectMemoryLibrary(nextProject, planText, originalPrompt)
    );
    setDraftValidation({
      status: "unchecked",
      problems: [],
      warnings: [],
      sceneCount: nextProject.scenes.length,
      checkedAt: "",
      aiScore: null
    });
    setDrawnScenes(nextProject.scenes.length);
    setTargetScenes((currentTarget) => Math.max(currentTarget, nextProject.scenes.length));
  }

  function saveWorkingProjectDraft(
    nextProject: StoryProject,
    planText: string,
    originalPrompt: string
  ) {
    localStorage.setItem(AI_PROJECT_WORKING_DRAFT_KEY, serializeProject(nextProject));
    setProjectMemoryLibrary(
      createProjectMemoryLibrary(nextProject, planText, originalPrompt)
    );
    setDrawnScenes(nextProject.scenes.length);
    setTargetScenes((currentTarget) => Math.max(currentTarget, nextProject.scenes.length));
  }

  async function validateGeneratedProjectDraft() {
    if (isWorking || generatedProjectJson.trim() === "") {
      return;
    }

    const localResult = validateProjectDraftJson(generatedProjectJson);
    if (localResult.problems.length > 0) {
      setDraftValidation({
        status: "invalid",
        problems: localResult.problems,
        warnings: localResult.warnings,
        sceneCount: localResult.sceneCount,
        checkedAt: new Date().toISOString(),
        aiScore: null
      });
      appendMessage({
        role: "assistant",
        text: `JSON draft failed the structural check: ${localResult.problems.length} problem(s). It was not loaded into the Builder.`
      });
      return;
    }

    if (!window.storyLife?.aiValidateProjectDraft) {
      setDraftValidation({
        status: "valid",
        problems: [],
        warnings: [
          ...localResult.warnings,
          "AI story-logic check is unavailable; only the structural check was completed."
        ],
        sceneCount: localResult.sceneCount,
        checkedAt: new Date().toISOString(),
        aiScore: null
      });
      return;
    }

    const requestId = createRequestId();
    const unsubscribeProgress = window.storyLife?.onAIProjectProgress?.(
      requestId,
      ({ status }) => {
        if (status) {
          setLiveProjectStatus(status);
          setLiveProjectEvents((currentEvents) => [...currentEvents.slice(-11), status]);
        }
      }
    );
    setWorking(true);
    setStage("thinking");
    setLiveProjectStatus("Checking JSON structure and story logic...");
    setActiveRequestId(requestId);
    setDraftValidation((current) => ({ ...current, status: "checking" }));
    try {
      const result = await window.storyLife.aiValidateProjectDraft({
        projectJson: generatedProjectJson,
        storyRequest: storyText,
        storyPlan,
        memoryLibrary: projectMemoryLibrary,
        requestId
      });
      const aiProblems = result.problems.map((problem) => problem.trim()).filter(Boolean);
      const passes = result.passes && aiProblems.length === 0;
      setDraftValidation({
        status: passes ? "valid" : "invalid",
        problems: aiProblems,
        warnings: localResult.warnings,
        sceneCount: localResult.sceneCount,
        checkedAt: new Date().toISOString(),
        aiScore: result.score
      });
      setStage(passes ? "done" : "error");
      appendMessage({
        role: "assistant",
        text: passes
          ? `JSON draft passed structural and story-logic checks. Score: ${result.score}/100. You can load it into the Builder.`
          : `JSON draft failed the story-logic check. Score: ${result.score}/100. Fix the listed problems before loading.`
      });
    } catch (error) {
      setDraftValidation({
        status: "invalid",
        problems: [`AI validation failed: ${getErrorMessage(error)}`],
        warnings: localResult.warnings,
        sceneCount: localResult.sceneCount,
        checkedAt: new Date().toISOString(),
        aiScore: null
      });
      setStage("error");
    } finally {
      unsubscribeProgress?.();
      setWorking(false);
      setActiveRequestId(null);
    }
  }

  async function fixGeneratedProjectDraft() {
    if (
      isWorking ||
      generatedProjectJson.trim() === "" ||
      draftValidation.status !== "invalid" ||
      !window.storyLife?.aiEditProject
    ) {
      return;
    }

    const requestId = createRequestId();
    const unsubscribeProgress = window.storyLife.onAIProjectProgress?.(
      requestId,
      ({ status }) => {
        if (status) {
          setLiveProjectStatus(status);
          setLiveProjectEvents((currentEvents) => [...currentEvents.slice(-11), status]);
        }
      }
    );
    setWorking(true);
    setStage("thinking");
    setActiveRequestId(requestId);
    setLiveProjectStatus("Fixing the rejected JSON draft without touching the Builder...");
    try {
      let fixedDraft = migrateProject(JSON.parse(generatedProjectJson));
      const problemBatches = chunkItems(draftValidation.problems.slice(0, 32), 6);
      for (const [batchIndex, problems] of problemBatches.entries()) {
        setLiveProjectStatus(
          `Fixing JSON problem batch ${batchIndex + 1}/${problemBatches.length}...`
        );
        const result = await window.storyLife.aiEditProject({
          instruction: [
            "Repair the listed narrative and branching problems in existing scenes.",
            "Return updatedScenes only. Do not return newScenes. Do not add, delete, or rename any scene.",
            "Keep sceneType, flags, parameters, and the number of choices unchanged.",
            "You may rewrite titles, scene text, choice button text, and targetNodeId only when a listed problem genuinely requires a different existing forward target.",
            "Any changed targetNodeId must name an existing later scene. Keep its one outcome synchronized to the same target. Choices in one scene must keep different targets.",
            "Distribute consequences through the route instead of making every earlier choice irrelevant until one final moral switch.",
            "Preserve every unrelated scene exactly.",
            `PROBLEM BATCH ${batchIndex + 1}/${problemBatches.length}:`,
            ...problems.map((problem) => `- ${problem}`),
            "APPROVED STORY PLAN:",
            storyPlan.slice(0, 10000)
          ].join("\n"),
          projectJson: serializeProject(fixedDraft),
          storyMemory,
          requestId
        });
        const patch = JSON.parse(result.patchJson) as AIProjectPatch;
        fixedDraft = applyNarrativeRepairPatch(fixedDraft, patch, {
          allowGraphChanges: true
        });
        saveWorkingProjectDraft(fixedDraft, storyPlan, storyText);
      }
      saveHiddenProjectDraft(fixedDraft, storyPlan, storyText);
      setStage("done");
      appendMessage({
        role: "assistant",
        text: `Processed ${problemBatches.length} correction batch(es) in the hidden draft. Run Check JSON again before loading it.`
      });
    } catch (error) {
      setStage("error");
      appendMessage({ role: "assistant", text: getErrorMessage(error) });
    } finally {
      unsubscribeProgress?.();
      setWorking(false);
      setActiveRequestId(null);
    }
  }

  function applyGeneratedProject() {
    if (draftValidation.status !== "valid") {
      appendMessage({
        role: "assistant",
        text: "Check the JSON draft first. Loading is blocked until validation passes."
      });
      return;
    }
    try {
      const finalLocalValidation = validateProjectDraftJson(generatedProjectJson);
      if (finalLocalValidation.problems.length > 0) {
        setDraftValidation({
          status: "invalid",
          problems: finalLocalValidation.problems,
          warnings: finalLocalValidation.warnings,
          sceneCount: finalLocalValidation.sceneCount,
          checkedAt: new Date().toISOString(),
          aiScore: null
        });
        appendMessage({
          role: "assistant",
          text: `Loading blocked: ${finalLocalValidation.problems.slice(0, 6).join("; ")}`
        });
        return;
      }
      const nextProject = migrateProject(JSON.parse(generatedProjectJson));
      onApplyProject(nextProject);
      setDrawnScenes(nextProject.scenes.length);
      setTargetScenes(nextProject.scenes.length);
      appendMessage({
        role: "assistant",
        text: "Done. The checked JSON project has been loaded into the Builder."
      });
    } catch (error) {
      appendMessage({ role: "assistant", text: getErrorMessage(error) });
    }
  }

  async function copyGeneratedProjectJson() {
    if (generatedProjectJson.trim() === "") {
      return;
    }
    await navigator.clipboard.writeText(generatedProjectJson);
    appendMessage({ role: "system", text: "JSON draft copied to the clipboard." });
  }

  async function saveGeneratedProjectJson() {
    if (generatedProjectJson.trim() === "" || !window.storyLife?.saveProject) {
      return;
    }
    const result = await window.storyLife.saveProject(generatedProjectJson);
    if (!result.canceled) {
      appendMessage({
        role: "system",
        text: `JSON draft saved: ${result.filePath}`
      });
    }
  }

  async function generateSelectedSceneImage() {
    if (!selectedScene || !window.storyLife?.aiGenerateSceneImage || isWorking) {
      return;
    }

    const requestId = createRequestId();
    activeImageRequestIdRef.current = requestId;
    setWorking(true);
    setStage("thinking");
    try {
      const result = await window.storyLife.aiGenerateSceneImage({
        prompt: createFinalImagePrompt(imagePrompt, imageStyle, imageSize),
        imageModel,
        imageSize,
        imageQuality,
        requestId
      });
      if (stopRequestedRef.current) {
        return;
      }
      const nextProject: StoryProject = {
        ...project,
        scenes: project.scenes.map((scene) =>
          scene.id === selectedScene.id
            ? applySceneVisual(scene, result.filePath, "image", {
                name: `Generated ${scene.imageVariants.length + 1}`,
                prompt: imagePrompt
              })
            : scene
        )
      };
      onApplyProject(nextProject);
      setStage("done");
      appendMessage({
        role: "assistant",
        text: `Image generated and applied to "${selectedScene.title || selectedScene.id}".`
      });
    } catch (error) {
      if (!stopRequestedRef.current) {
        setStage("error");
        appendMessage({ role: "assistant", text: getErrorMessage(error) });
      }
    } finally {
      if (activeImageRequestIdRef.current === requestId) {
        activeImageRequestIdRef.current = null;
      }
      setWorking(false);
    }
  }

  async function addCharacterReference() {
    if (!window.storyLife?.selectImage) {
      appendMessage({
        role: "assistant",
        text: "Character references work only in the desktop Electron window."
      });
      return;
    }

    const result = await window.storyLife.selectImage();
    if (result.canceled) {
      return;
    }
    if (result.mediaType !== "image") {
      setLiveProjectStatus("Character reference must be a picture, not a video.");
      return;
    }

    const fileName = result.filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "Character";
    const reference = {
      id: createRequestId(),
      name: fileName,
      imagePath: result.filePath,
      notes: ""
    };
    onApplyProject({
      ...project,
      characterReferences: [...project.characterReferences, reference]
    });
  }

  function removeCharacterReference(referenceId: string) {
    onApplyProject({
      ...project,
      characterReferences: project.characterReferences.filter(
        (reference) => reference.id !== referenceId
      )
    });
    setImageStudioSelectedRefs((current) =>
      Object.fromEntries(
        Object.entries(current).map(([sceneId, referenceIds]) => [
          sceneId,
          referenceIds.filter((id) => id !== referenceId)
        ])
      )
    );
  }

  function toggleSceneReference(sceneId: string, referenceId: string) {
    setImageStudioSelectedRefs((current) => {
      const selectedIds = current[sceneId] ?? [];
      const nextIds = selectedIds.includes(referenceId)
        ? selectedIds.filter((id) => id !== referenceId)
        : selectedIds.length >= 3
          ? selectedIds
          : [...selectedIds, referenceId];

      return {
        ...current,
        [sceneId]: nextIds
      };
    });
  }

  function enqueueCurrentImageScene() {
    const scene = project.scenes[imageStudioSceneIndex];
    if (!scene) {
      return;
    }
    if (!window.storyLife?.aiGenerateSceneImage) {
      appendMessage({
        role: "assistant",
        text: "Image Studio works only in the desktop Electron window with image generation enabled."
      });
      return;
    }

    const prompt = createFinalImagePrompt(
      imageStudioPrompts[scene.id] ?? imagePrompt,
      imageStyle,
      imageSize
    );
    const useReferences = imageStudioUseReferences[scene.id] ?? true;
    const referenceIds = useReferences ? imageStudioSelectedRefs[scene.id] ?? [] : [];
    const item: ImageQueueItem = {
      id: createRequestId(),
      sceneId: scene.id,
      prompt,
      referenceIds,
      imageModel,
      imageSize,
      imageQuality,
      status: "queued"
    };

    const nextQueue = [...imageQueueRef.current, item];
    stopRequestedRef.current = false;
    updateImageQueue(nextQueue);
    window.setTimeout(() => void processImageQueue(), 0);
  }

  async function processImageQueue() {
    if (imageQueueRunningRef.current) {
      return;
    }
    if (!window.storyLife?.aiGenerateSceneImage) {
      updateImageQueue(
        imageQueueRef.current.map((item) =>
          item.status === "queued"
            ? { ...item, status: "error", error: "Image generation is unavailable in this window." }
            : item
        )
      );
      return;
    }

    imageQueueRunningRef.current = true;
    stopRequestedRef.current = false;
    setWorking(true);
    setStage("thinking");

    try {
      while (!stopRequestedRef.current) {
        const nextItem = getNextQueuedImageItem();
        if (!nextItem) {
          break;
        }

        updateImageQueue(
          imageQueueRef.current.map((item) =>
            item.id === nextItem.id
              ? {
                  ...item,
                  status: "running",
                  startedAt: Date.now(),
                  finishedAt: undefined,
                  error: undefined
                }
              : item
          )
        );
        const currentProject = latestProjectRef.current;
        const scene = currentProject.scenes.find((candidate) => candidate.id === nextItem.sceneId);
        if (!scene) {
          markImageQueueItem(nextItem.id, "error", "Scene no longer exists.");
          continue;
        }

        const referenceImagePaths = nextItem.referenceIds
          .map((referenceId) =>
            currentProject.characterReferences.find((reference) => reference.id === referenceId)
          )
          .filter(Boolean)
          .map((reference) => reference!.imagePath)
          .slice(0, 3);

        setLiveProjectStatus(`Generating image for ${scene.title || scene.id}...`);
        try {
          activeImageRequestIdRef.current = nextItem.id;
          const result = await window.storyLife.aiGenerateSceneImage({
            prompt: nextItem.prompt,
            referenceImagePaths,
            imageModel: nextItem.imageModel,
            imageSize: nextItem.imageSize,
            imageQuality: nextItem.imageQuality,
            requestId: nextItem.id
          });

          if (stopRequestedRef.current) {
            markImageQueueItem(nextItem.id, "error", "Stopped by user.");
            break;
          }

          const updatedProject: StoryProject = {
            ...latestProjectRef.current,
            scenes: latestProjectRef.current.scenes.map((currentScene) =>
              currentScene.id === scene.id
                ? applySceneVisual(currentScene, result.filePath, "image", {
                    name: `Generated ${currentScene.imageVariants.length + 1}`,
                    prompt: nextItem.prompt
                  })
                : currentScene
            )
          };
          latestProjectRef.current = updatedProject;
          onApplyProject(updatedProject);
          markImageQueueItem(nextItem.id, "done");
          setDrawnScenes(
            imageQueueRef.current.filter((item) => item.status === "done").length
          );
        } catch (error) {
          const message = getErrorMessage(error);
          markImageQueueItem(nextItem.id, "error", message);
          if (!stopRequestedRef.current) {
            appendMessage({
              role: "assistant",
              text: `Image generation failed for "${scene.title || scene.id}": ${message}`
            });
          }
        } finally {
          if (activeImageRequestIdRef.current === nextItem.id) {
            activeImageRequestIdRef.current = null;
          }
        }
      }

      if (!stopRequestedRef.current) {
        setStage("done");
        appendMessage({
          role: "assistant",
          text: "Image queue finished."
        });
      }
    } catch (error) {
      setStage("error");
      appendMessage({ role: "assistant", text: getErrorMessage(error) });
    } finally {
      if (stopRequestedRef.current) {
        updateImageQueue(
          imageQueueRef.current.map((item) =>
            item.status === "running"
              ? { ...item, status: "error", error: "Stopped by user." }
              : item
          )
        );
      }
      imageQueueRunningRef.current = false;
      setWorking(false);
    }
  }

  function getNextQueuedImageItem(): ImageQueueItem | null {
    return imageQueueRef.current.find((item) => item.status === "queued") ?? null;
  }

  function markImageQueueItem(
    itemId: string,
    status: ImageQueueItem["status"],
    error?: string
  ) {
    updateImageQueue(
      imageQueueRef.current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status,
              error,
              finishedAt: status === "done" || status === "error" ? Date.now() : item.finishedAt
            }
          : item
      )
    );
  }

  function updateImageQueue(queue: ImageQueueItem[]) {
    imageQueueRef.current = queue;
    setImageQueue(queue);
  }

  async function stopImageQueue() {
    stopRequestedRef.current = true;
    setStage("stopped");
    const requestId = activeImageRequestIdRef.current;
    updateImageQueue(
      imageQueueRef.current.map((item) =>
        item.status === "running" || item.status === "queued"
          ? {
              ...item,
              status: "error",
              error: "Stopped by user.",
              finishedAt: Date.now()
            }
          : item
      )
    );
    if (requestId && window.storyLife?.aiCancel) {
      await window.storyLife.aiCancel(requestId).catch(() => undefined);
    }
    setLiveProjectStatus("Image generation stopped.");
  }

  async function clearImageQueue() {
    await stopImageQueue();
    updateImageQueue([]);
    setDrawnScenes(0);
    setTargetScenes(0);
    setLiveProjectStatus("Image queue cleared.");
  }

  async function generateImagesForAllScenes() {
    if (!window.storyLife?.aiGenerateSceneImage || isWorking || project.scenes.length === 0) {
      return;
    }

    setTargetScenes(project.scenes.length);
    setDrawnScenes(0);
    stopRequestedRef.current = false;
    setLiveProjectStatus(`Queueing images for ${project.scenes.length} scenes...`);
    setLiveProjectEvents((currentEvents) => [
      ...currentEvents.slice(-11),
      `Queueing ${project.scenes.length} scene image jobs.`
    ]);
    appendMessage({
      role: "system",
      text: `Queued image generation for all scenes: ${project.scenes.length} scenes.`
    });

    const nextItems = project.scenes.map((scene) => ({
      id: createRequestId(),
      sceneId: scene.id,
      prompt: createFinalImagePrompt(
        imageStudioPrompts[scene.id] ?? imagePrompt,
        imageStyle,
        imageSize
      ),
      referenceIds:
        (imageStudioUseReferences[scene.id] ?? true)
          ? imageStudioSelectedRefs[scene.id] ?? []
          : [],
      imageModel,
      imageSize,
      imageQuality,
      status: "queued" as const
    }));

    updateImageQueue(nextItems);
    window.setTimeout(() => void processImageQueue(), 0);
  }

  function appendMessage(message: ChatMessage) {
    setMessages((currentMessages) => [...currentMessages, message]);
  }

  function clearMemory() {
    setMessages(INITIAL_MESSAGES);
    setGeneratedProjectJson("");
    setProjectMemoryLibrary("");
    setDraftValidation({
      status: "unchecked",
      problems: [],
      warnings: [],
      sceneCount: 0,
      checkedAt: "",
      aiScore: null
    });
    setStoryMemory("");
    setStoryPlan("");
    setStoryLogicReport("");
    localStorage.removeItem(AI_MESSAGES_KEY);
    localStorage.removeItem(AI_STORY_MEMORY_KEY);
    localStorage.removeItem(AI_STORY_PLAN_KEY);
    localStorage.removeItem(AI_STORY_REPORT_KEY);
    localStorage.removeItem(AI_PROJECT_JSON_DRAFT_KEY);
    localStorage.removeItem(AI_PROJECT_WORKING_DRAFT_KEY);
    localStorage.removeItem(AI_PROJECT_MEMORY_LIBRARY_KEY);
  }

  function focusEditableTarget(event: ReactPointerEvent<HTMLElement>) {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement
    ) {
      window.focus();
      window.setTimeout(() => target.focus(), 0);
    }
  }

  function updateImageVariantAnimation(
    sceneId: string,
    variantId: string,
    animation: SceneImageAnimation | null
  ) {
    const currentProject = latestProjectRef.current;
    const nextProject: StoryProject = {
      ...currentProject,
      scenes: currentProject.scenes.map((scene) =>
        scene.id === sceneId
          ? {
              ...scene,
              imageVariants: scene.imageVariants.map((variant) =>
                variant.id === variantId ? { ...variant, animation } : variant
              )
            }
          : scene
      )
    };
    latestProjectRef.current = nextProject;
    onApplyProject(nextProject);
  }

  function selectImageVariant(sceneId: string, variantId: string) {
    const currentProject = latestProjectRef.current;
    const nextProject: StoryProject = {
      ...currentProject,
      scenes: currentProject.scenes.map((scene) =>
        scene.id === sceneId ? activateSceneImageVariant(scene, variantId) : scene
      )
    };
    latestProjectRef.current = nextProject;
    onApplyProject(nextProject);
  }

  function setCurrentAnimationEnabled(enabled: boolean) {
    if (!imageStudioScene || !imageStudioActiveVariant?.animation) return;
    const animation = { ...imageStudioActiveVariant.animation, enabled };
    updateImageVariantAnimation(imageStudioScene.id, imageStudioActiveVariant.id, animation);
    if (enabled && imageStudioScene.imagePath !== imageStudioActiveVariant.imagePath) {
      selectImageVariant(imageStudioScene.id, imageStudioActiveVariant.id);
    }
    setLiveProjectStatus(enabled ? "Animation enabled." : "Showing original picture. Animation was kept.");
  }

  const imageStudioScene = project.scenes[imageStudioSceneIndex] ?? project.scenes[0] ?? null;
  const imageStudioActiveVariant = imageStudioScene
    ? getActiveSceneImageVariant(imageStudioScene)
    : null;
  const imageStudioScenePrompt = imageStudioScene
    ? imageStudioPrompts[imageStudioScene.id] ?? imagePrompt
    : "";
  const imageStudioSelectedReferenceIds = imageStudioScene
    ? imageStudioSelectedRefs[imageStudioScene.id] ?? []
    : [];
  const imageStudioReferencesEnabled = imageStudioScene
    ? imageStudioUseReferences[imageStudioScene.id] ?? true
    : true;
  const queuedImageCount = imageQueue.filter((item) => item.status === "queued").length;
  const runningImageCount = imageQueue.filter((item) => item.status === "running").length;

  return createPortal(
    <>
    {SHOW_IMAGE_STUDIO_SIDEBAR && <aside
      className={`ai-drawer ${isImageStudioOpen ? "image-studio-open" : ""}`}
      aria-label="Image Studio panel"
      onPointerDownCapture={focusEditableTarget}
    >
      <div className="ai-drawer-heading">
        <div>
          <h2 id="ai-assistant-title">Image Studio</h2>
          <p>Generate and manage scene artwork.</p>
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <section className={`ai-work-status ai-stage-${stage}`}>
        <div>
          <strong>{getStageLabel(stage)}</strong>
          <span>{isWorking ? `${workingSeconds}s` : "idle"}</span>
        </div>
        <div className="ai-progress-bar">
          <span
            style={{
              width:
                targetScenes > 0
                  ? `${Math.max(4, Math.round((drawnScenes / targetScenes) * 100))}%`
                  : isWorking
                    ? "45%"
                    : "0%"
            }}
          />
        </div>
        <p>
          {draftValidation.status === "checking"
            ? liveProjectStatus || "Checking JSON structure and story logic..."
            : isWorking && targetScenes > 0
              ? `Generating scene images: ${drawnScenes}/${targetScenes}`
            : getStageDescription(stage)}
        </p>
        <div className="ai-project-actions">
          <button type="button" onClick={stopAIWork} disabled={!isWorking}>
            Stop
          </button>
        </div>
      </section>

      {(isWorking || liveProjectDraft.trim() !== "" || liveProjectEvents.length > 0) && (
        <section className="ai-live-output-card">
          <h3>Image generation monitor</h3>
          <p>{liveProjectStatus}</p>
          <div className="ai-live-stats">
            <span>Events: {liveProjectEventCount}</span>
            <span>Chars: {liveProjectReceivedChars}</span>
          </div>
          <ul>
            {liveProjectEvents.map((eventText, index) => (
              <li key={`${eventText}-${index}`}>{eventText}</li>
            ))}
          </ul>
          {liveProjectDraft.trim() !== "" && <pre>{liveProjectDraft}</pre>}
        </section>
      )}

      <section className="ai-settings-card">
        <h3>OpenAI settings</h3>
        <p>{settingsStatus}</p>
        <label>
          API key
          <input
            value={apiKeyInput}
            type="password"
            placeholder={hasApiKey ? "Key saved. Paste a new key to replace." : "sk-..."}
            onChange={(event) => setApiKeyInput(event.target.value)}
          />
        </label>
        <label>
          Model
          <select value={model} onChange={(event) => setModel(event.target.value)}>
            {OPENAI_MODEL_OPTIONS.map((modelOption) => (
              <option value={modelOption.value} key={modelOption.value}>
                {modelOption.label}
              </option>
            ))}
          </select>
        </label>
        <div className="ai-project-actions">
          <button type="button" onClick={saveSettings} disabled={isWorking}>
            Save AI Settings
          </button>
        </div>
      </section>

      {SHOW_STORY_AI && <section className="ai-project-card">
        <details>
          <summary>Story Memory</summary>
          <p className="ai-muted-text">
            Long discussions are compressed here so JSON drafts and edits remember the agreed story.
          </p>
          <textarea
            value={storyMemory}
            rows={8}
            placeholder="Story agreements will appear here after chat. You can edit this memory manually."
            onChange={(event) => setStoryMemory(event.target.value)}
          />
          <div className="ai-project-actions">
            <button type="button" onClick={() => setStoryMemory("")} disabled={isWorking}>
              Clear Memory
            </button>
          </div>
        </details>
      </section>}

      {SHOW_STORY_AI && <section className="ai-chat-card">
        <h3>Chat</h3>
        <div className="ai-chat-log" ref={chatLogRef} aria-live="polite">
          {messages.map((message, index) => (
            <article
              className={`ai-message ai-message-${message.role}`}
              key={`${message.role}-${index}`}
            >
              <strong>{message.role === "user" ? "You" : message.role === "system" ? "Work" : "AI"}</strong>
              <p>{message.text}</p>
            </article>
          ))}
        </div>
            <div className="ai-chat-input-row">
              <textarea
                ref={chatInputRef}
                value={chatInput}
                placeholder="Example: make a 30 scene thriller about a pilot"
                rows={3}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendChatMessage();
                  }
                }}
              />
              <div className="ai-chat-button-stack">
                <button
                  type="button"
                  onClick={sendChatMessage}
                  disabled={!canUseAI || isWorking || chatInput.trim() === ""}
                >
                  Send Chat
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void buildProjectFromChatInput()}
                  disabled={!canGenerateProject || isWorking || !hasBuildContext}
                >
                  Write JSON Draft
                </button>
                <button
                  type="button"
                  onClick={() => void editProjectFromChatInput()}
                  disabled={!canEditProject || isWorking || project.scenes.length === 0 || !hasEditContext}
                >
                  Edit Project
                </button>
              </div>
            </div>
          </section>}

      {SHOW_STORY_AI && <section className="ai-project-card">
        <h3>Write project JSON draft</h3>
        <textarea
          value={storyText}
          placeholder="Paste a story request here. Example: create a 50-scene interactive text quest with developed branches and 4 distinct endings."
          rows={6}
          onChange={(event) => setStoryText(event.target.value)}
        />
        <section className="ai-story-style-panel">
          <div className="ai-story-style-heading">
            <h4>Стиль истории</h4>
            <small>{selectedStoryStyles.length}/3 выбрано</small>
          </div>
          <div className="ai-story-style-grid">
            {STORY_STYLE_OPTIONS.map((option) => {
              const isChecked = selectedStoryStyles.includes(option.id);
              const isDisabled = !isChecked && selectedStoryStyles.length >= 3;
              return (
                <label className="ai-story-style-option" key={option.id}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isDisabled}
                    onChange={() => toggleStoryStyle(option.id)}
                  />
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>
          <p className="ai-muted-text">
            Если ничего не выбрать, AI использует приключенческий и кинематографичный стиль.
          </p>
        </section>
        <div className="ai-project-actions">
          <button
            type="button"
            onClick={generateProject}
            disabled={!canGenerateProject || isWorking}
          >
            Plan And Write JSON
          </button>
          <button
            type="button"
            onClick={() => void validateGeneratedProjectDraft()}
            disabled={generatedProjectJson.trim() === "" || isWorking}
          >
            Check JSON
          </button>
          {draftValidation.status === "invalid" && (
            <button
              type="button"
              onClick={() => void fixGeneratedProjectDraft()}
              disabled={!window.storyLife?.aiEditProject || isWorking}
            >
              Fix Listed Problems
            </button>
          )}
          <button
            type="button"
            className="primary-button"
            onClick={applyGeneratedProject}
            disabled={draftValidation.status !== "valid" || isWorking}
          >
            Load Into Builder
          </button>
          <button
            type="button"
            onClick={analyzeStoryLogic}
            disabled={!canAnalyzeStory || isWorking || project.scenes.length === 0}
          >
            Analyze Story Logic
          </button>
        </div>
        {generatedProjectJson.trim() !== "" && (
          <section className={`ai-draft-status ai-draft-status-${draftValidation.status}`}>
            <strong>
              {draftValidation.status === "valid"
                ? "JSON checked and ready"
                : draftValidation.status === "invalid"
                  ? "JSON has problems"
                  : draftValidation.status === "checking"
                    ? "Checking JSON..."
                    : "JSON draft is waiting for a check"}
            </strong>
            <span>
              {draftValidation.sceneCount > 0
                ? `${draftValidation.sceneCount} scenes`
                : "Hidden draft saved"}
              {draftValidation.aiScore !== null ? ` | logic ${draftValidation.aiScore}/100` : ""}
            </span>
            {draftValidation.problems.length > 0 && (
              <ul>
                {draftValidation.problems.slice(0, 20).map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
            {draftValidation.warnings.length > 0 && (
              <details>
                <summary>Warnings ({draftValidation.warnings.length})</summary>
                <ul>
                  {draftValidation.warnings.slice(0, 20).map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )}
        {generatedProjectJson.trim() !== "" && (
          <details className="ai-plan-details">
            <summary>View JSON draft</summary>
            <div className="ai-project-actions">
              <button type="button" onClick={() => void copyGeneratedProjectJson()}>
                Copy JSON
              </button>
              <button type="button" onClick={() => void saveGeneratedProjectJson()}>
                Save JSON
              </button>
            </div>
            <pre>{generatedProjectJson}</pre>
          </details>
        )}
        {projectMemoryLibrary.trim() !== "" && (
          <details className="ai-plan-details">
            <summary>Project memory library</summary>
            <pre>{projectMemoryLibrary}</pre>
          </details>
        )}
        {storyPlan.trim() !== "" && (
          <details className="ai-plan-details" open>
            <summary>Story plan</summary>
            <pre>{storyPlan}</pre>
          </details>
        )}
        {storyLogicReport.trim() !== "" && (
          <details className="ai-plan-details" open>
            <summary>Story logic report</summary>
            <pre>{storyLogicReport}</pre>
          </details>
        )}
      </section>}

      <section className="ai-project-card">
        <h3>Generate image for selected scene</h3>
        <p className="ai-muted-text">
          {selectedScene
            ? `Selected: ${selectedScene.title || selectedScene.id}`
            : "Select a scene node first."}
        </p>
        <textarea
          value={imagePrompt}
          rows={3}
          placeholder="Example: cozy storybook illustration, warm room, soft light"
          onChange={(event) => setImagePrompt(event.target.value)}
        />
        <div className="ai-image-global-settings">
          <label className="field-label">
            Image model
            <select value={imageModel} onChange={(event) => setImageModel(event.target.value)}>
              {IMAGE_MODEL_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Image style
            <select value={imageStyle} onChange={(event) => setImageStyle(event.target.value)}>
              {IMAGE_STYLE_OPTIONS.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Image format
            <select value={imageSize} onChange={(event) => setImageSize(event.target.value)}>
              {IMAGE_SIZE_OPTIONS.map((option) => (
                <option value={option.value} key={`${option.label}-${option.value}`}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ai-project-actions">
          <button
            type="button"
            className="primary-button"
            onClick={() => setImageStudioOpen(true)}
            disabled={!canGenerateSceneImage || project.scenes.length === 0}
          >
            Open Image Studio
          </button>
          <button
            type="button"
            onClick={generateSelectedSceneImage}
            disabled={!canGenerateSceneImage || isWorking || !selectedScene}
          >
            Generate Image
          </button>
          <button
            type="button"
            onClick={generateImagesForAllScenes}
            disabled={!canGenerateSceneImage || isWorking || project.scenes.length === 0}
          >
            Generate Images For All Scenes
          </button>
        </div>
        {imageQueue.length > 0 && (
          <ImageQueueProgressPanel
            imageQueue={imageQueue}
            scenes={project.scenes}
            imageProgressTick={imageProgressTick}
          />
        )}
      </section>
    </aside>}
    {isImageStudioOpen && imageStudioScene && (
      <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
        <section
          className="ai-image-studio-modal"
          role="dialog"
          aria-modal="true"
          aria-label="AI Image Studio"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="modal-heading">
            <div>
              <h2>AI Image Studio</h2>
              <p>
                Scene {imageStudioSceneIndex + 1}/{project.scenes.length} · Queue: {queuedImageCount} queued, {runningImageCount} running
              </p>
            </div>
            <div className="modal-heading-actions">
              <button
                type="button"
                disabled={
                  imageStudioScene.imagePath.trim() === "" ||
                  imageStudioScene.visualMediaType !== "image"
                }
                onClick={() => {
                  void savePicture(
                    imageStudioScene.imagePath,
                    imageStudioScene.title || imageStudioScene.id
                  )
                    .then((result) => {
                      if (result === "saved") setLiveProjectStatus("Picture saved.");
                    })
                    .catch((error) =>
                      setLiveProjectStatus(
                        error instanceof Error ? error.message : "Could not save picture."
                      )
                    );
                }}
              >
                Save Picture
              </button>
              <button
                type="button"
                disabled={!imageStudioActiveVariant}
                onClick={() => setAnimationEditorType("procedural")}
              >
                Animate
              </button>
              <button
                type="button"
                disabled={!imageStudioActiveVariant || !canGenerateSceneImage}
                onClick={() => setAnimationEditorType("aiFrames")}
              >
                Animate with AI
              </button>
              {imageStudioActiveVariant?.animation && (
                <>
                  <button
                    type="button"
                    onClick={() => setCurrentAnimationEnabled(
                      !imageStudioActiveVariant.animation!.enabled
                    )}
                  >
                    {imageStudioActiveVariant.animation.enabled
                      ? "Show Original"
                      : "Use Animation"}
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => {
                      updateImageVariantAnimation(
                        imageStudioScene.id,
                        imageStudioActiveVariant.id,
                        null
                      );
                      setLiveProjectStatus("Animation deleted. Original picture was kept.");
                    }}
                  >
                    Delete Animation
                  </button>
                </>
              )}
              <button type="button" onClick={onClose}>
                Close
              </button>
            </div>
          </div>

          <div className="ai-image-studio-body">
            <aside className="ai-character-reference-panel">
              <section className="ai-image-scene-context" aria-label="Scene context">
                <h3>Scene context</h3>
                <strong>{imageStudioScene.title || imageStudioScene.id}</strong>
                <div className="ai-image-scene-context-text">
                  {imageStudioScene.text}
                </div>
              </section>
              <div className="ai-image-studio-section-heading">
                <h3>Character References</h3>
                <button type="button" onClick={addCharacterReference}>
                  Add Reference
                </button>
              </div>
              {project.characterReferences.length === 0 && (
                <p className="empty-state">Add character images here, then select up to 3 for each scene.</p>
              )}
              <div className="ai-character-reference-grid">
                {project.characterReferences.map((reference) => {
                  const isSelected = imageStudioSelectedReferenceIds.includes(reference.id);
                  return (
                    <article
                      className={`ai-character-reference-card ${isSelected ? "selected" : ""}`}
                      key={reference.id}
                      title={reference.name}
                    >
                      <button
                        type="button"
                        className="ai-reference-thumb-button"
                        onClick={() => toggleSceneReference(imageStudioScene.id, reference.id)}
                        aria-pressed={isSelected}
                        aria-label={`${isSelected ? "Disable" : "Enable"} reference ${reference.name}`}
                      >
                        <span className="ai-image-thumbnail-frame ai-image-thumbnail-frame-contain">
                          <AIImagePreview imagePath={reference.imagePath} />
                        </span>
                      </button>
                      <button
                        type="button"
                        className="ai-reference-remove-button"
                        onClick={() => removeCharacterReference(reference.id)}
                        aria-label={`Remove reference ${reference.name}`}
                        title={`Remove ${reference.name}`}
                      >
                        &times;
                      </button>
                    </article>
                  );
                })}
              </div>
            </aside>

            <main className="ai-image-scene-workspace">
              <div className="ai-image-scene-nav">
                <button
                  type="button"
                  onClick={() => setImageStudioSceneIndex((index) => Math.max(0, index - 1))}
                  disabled={imageStudioSceneIndex === 0}
                >
                  Previous
                </button>
                <strong>Scene {imageStudioSceneIndex + 1}</strong>
                <button
                  type="button"
                  onClick={() =>
                    setImageStudioSceneIndex((index) =>
                      Math.min(project.scenes.length - 1, index + 1)
                    )
                  }
                  disabled={imageStudioSceneIndex >= project.scenes.length - 1}
                >
                  Next
                </button>
              </div>
              <label className="ai-image-scene-slider">
                <span>
                  Jump to scene
                  <strong>{imageStudioSceneIndex + 1}/{project.scenes.length}</strong>
                </span>
                <input
                  type="range"
                  min={1}
                  max={Math.max(1, project.scenes.length)}
                  step={1}
                  value={imageStudioSceneIndex + 1}
                  aria-label="Jump to scene"
                  onChange={(event) =>
                    setImageStudioSceneIndex(Number(event.target.value) - 1)
                  }
                />
              </label>

              <div className="ai-image-scene-preview">
                {imageStudioScene.visualMediaType === "video" &&
                imageStudioScene.imagePath.trim() !== "" ? (
                  <span>This scene uses video. Generating an image will replace it.</span>
                ) : imageStudioScene.imagePath.trim() !== "" ? (
                  <button
                    type="button"
                    className="ai-image-scene-preview-button"
                    onClick={() => setFullPreviewImagePath(imageStudioScene.imagePath)}
                    aria-label="Open full image preview"
                  >
                    {imageStudioActiveVariant ? (
                      <AnimatedSceneImage
                        imagePath={imageStudioActiveVariant.imagePath}
                        animation={imageStudioActiveVariant.animation}
                        alt="Scene image"
                      />
                    ) : (
                      <AIImagePreview imagePath={imageStudioScene.imagePath} />
                    )}
                  </button>
                ) : (
                  <span>No image generated yet</span>
                )}
              </div>
              {imageStudioScene.imageVariants.length > 0 && (
                <section aria-label="Scene image variants">
                  <div className="ai-image-studio-section-heading">
                    <h3>Image variants</h3>
                    <span>{imageStudioScene.imageVariants.length} saved</span>
                  </div>
                  <div className="ai-image-variant-strip">
                    {imageStudioScene.imageVariants.map((variant, index) => (
                      <button
                        type="button"
                        key={variant.id}
                        className={`ai-image-variant-card ${
                          imageStudioActiveVariant?.id === variant.id ? "active" : ""
                        }`}
                        title={`${variant.name}${variant.animation ? " · animated" : ""}`}
                        onClick={() => selectImageVariant(imageStudioScene.id, variant.id)}
                      >
                        <span className="ai-image-thumbnail-frame ai-image-thumbnail-frame-cover">
                          <AIImagePreview imagePath={variant.imagePath} />
                        </span>
                        <span className="ai-image-variant-label">
                          {variant.name || `Image ${index + 1}`}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              <label className="field-label">
                Image model
                <select value={imageModel} onChange={(event) => setImageModel(event.target.value)}>
                  {IMAGE_MODEL_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Image style
                <select value={imageStyle} onChange={(event) => setImageStyle(event.target.value)}>
                  {IMAGE_STYLE_OPTIONS.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-label">
                Generation quality
                <select
                  value={imageQuality}
                  onChange={(event) => setImageQuality(
                    event.target.value as "low" | "medium" | "high"
                  )}
                >
                  <option value="low">Low · cheaper, best for animation</option>
                  <option value="medium">Medium</option>
                  <option value="high">High · larger and more expensive</option>
                </select>
              </label>
              <label className="field-label">
                Image format
                <select value={imageSize} onChange={(event) => setImageSize(event.target.value)}>
                  {IMAGE_SIZE_OPTIONS.map((option) => (
                    <option value={option.value} key={`${option.label}-${option.value}`}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-label">
                Scene prompt
                <textarea
                  value={imageStudioScenePrompt}
                  rows={7}
                  onChange={(event) =>
                    setImageStudioPrompts((current) => ({
                      ...current,
                      [imageStudioScene.id]: event.target.value
                    }))
                  }
                />
              </label>

              <div className="ai-selected-reference-row">
                <span>
                  Selected references: {imageStudioSelectedReferenceIds.length}/3
                  {!imageStudioReferencesEnabled ? " (not applied)" : ""}
                </span>
                {imageStudioSelectedReferenceIds.map((referenceId) => {
                  const reference = project.characterReferences.find((item) => item.id === referenceId);
                  return reference ? <strong key={reference.id}>{reference.name}</strong> : null;
                })}
              </div>
              <label className="checkbox-control ai-apply-reference-toggle">
                <input
                  type="checkbox"
                  checked={imageStudioReferencesEnabled}
                  onChange={(event) =>
                    setImageStudioUseReferences((current) => ({
                      ...current,
                      [imageStudioScene.id]: event.target.checked
                    }))
                  }
                />
                <span>Apply references</span>
              </label>

              <div className="ai-project-actions">
                <button
                  type="button"
                  className="primary-button"
                  onClick={enqueueCurrentImageScene}
                  disabled={!canGenerateSceneImage}
                >
                  Generate Image For This Scene
                </button>
                <button
                  type="button"
                  disabled={!canGenerateSceneImage}
                  onClick={() => {
                    enqueueCurrentImageScene();
                    setImageStudioSceneIndex((index) =>
                      Math.min(project.scenes.length - 1, index + 1)
                    );
                  }}
                >
                  Queue And Next
                </button>
              </div>

              <section className="ai-image-queue-panel">
                <div className="ai-image-queue-heading">
                  <h3>Queue</h3>
                  <div className="ai-image-queue-actions">
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => void stopImageQueue()}
                      disabled={runningImageCount === 0 && queuedImageCount === 0}
                    >
                      Stop generation
                    </button>
                    <button
                      type="button"
                      onClick={() => void clearImageQueue()}
                      disabled={imageQueue.length === 0}
                    >
                      Clear queue
                    </button>
                  </div>
                </div>
                <ImageQueueProgressPanel
                  imageQueue={imageQueue}
                  scenes={project.scenes}
                  imageProgressTick={imageProgressTick}
                />
              </section>
            </main>
          </div>
        </section>
      </div>
    )}
    {animationEditorType && imageStudioScene && imageStudioActiveVariant && (
      <ImageAnimationModal
        initialType={animationEditorType}
        sceneTitle={imageStudioScene.title || imageStudioScene.id}
        variant={imageStudioActiveVariant}
        imageModel={imageModel}
        imageSize={imageSize}
        onStatus={setLiveProjectStatus}
        onClose={() => setAnimationEditorType(null)}
        onApply={(animation) => {
          updateImageVariantAnimation(
            imageStudioScene.id,
            imageStudioActiveVariant.id,
            animation
          );
          setAnimationEditorType(null);
          setLiveProjectStatus(
            animation.type === "procedural"
              ? "Local animation applied."
              : "AI frame animation applied."
          );
        }}
      />
    )}
    {fullPreviewImagePath && (
      <div className="modal-backdrop" role="presentation" onMouseDown={() => setFullPreviewImagePath(null)}>
        <section
          className="ai-full-image-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Full image preview"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="modal-heading">
            <div>
              <h2>Image Preview</h2>
              <p>Click outside or Close to return to Image Studio.</p>
            </div>
            <button type="button" onClick={() => setFullPreviewImagePath(null)}>
              Close
            </button>
          </div>
          <div className="ai-full-image-preview-frame">
            <AIImagePreview imagePath={fullPreviewImagePath} />
          </div>
        </section>
      </div>
    )}
    </>,
    document.body
  );
}

function extractRequestedSceneCountLegacy(prompt: string): number | null {
  const normalizedPrompt = prompt.toLowerCase();
  const hasSceneWord =
    normalizedPrompt.includes("\u0441\u0446\u0435\u043d") ||
    normalizedPrompt.includes("\u043d\u043e\u0434") ||
    normalizedPrompt.includes("scene") ||
    normalizedPrompt.includes("node");
  if (hasSceneWord) {
    const broadCounts = [...normalizedPrompt.matchAll(/\d{2,5}/g)]
      .map((match) => Number(match[0]))
      .filter((count) => Number.isFinite(count) && count >= 40);
    if (broadCounts.length > 0) {
      return Math.max(...broadCounts);
    }
  }

  const matches = [
    ...normalizedPrompt.matchAll(
      /(\d{2,5})\s*(?:сцен|сцены|сценами|scene|scenes|node|nodes|нод|ноды)/gi
    )
  ];
  const counts = matches
    .map((match) => Number(match[1]))
    .filter((count) => Number.isFinite(count) && count >= 40);

  return counts.length > 0 ? Math.max(...counts) : null;
}

function AIImagePreview({ imagePath }: { imagePath: string }) {
  const [src, setSrc] = useState(() => getAIImagePreviewSrc(imagePath));

  useEffect(() => {
    let isCurrent = true;
    setSrc(getAIImagePreviewSrc(imagePath));

    if (
      !imagePath.trim() ||
      !isLocalAIImagePath(imagePath) ||
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
        if (isCurrent && result.ok) {
          setSrc(result.dataUrl);
        }
      })
      .catch(() => undefined);

    return () => {
      isCurrent = false;
    };
  }, [imagePath]);

  if (!src.trim()) {
    return <span>No image</span>;
  }

  return <img className="ai-image-preview-image" src={toImageSrc(src)} alt="" />;
}

function getAIImagePreviewSrc(imagePath: string): string {
  if (isLocalAIImagePath(imagePath) && window.storyLife?.getMediaUrl) {
    return window.storyLife.getMediaUrl(imagePath);
  }
  return imagePath;
}

function isLocalAIImagePath(imagePath: string): boolean {
  const trimmedPath = imagePath.trim();
  return trimmedPath.startsWith("file://") || /^[a-zA-Z]:\\/.test(trimmedPath);
}

function ImageQueueProgressPanel({
  imageQueue,
  scenes,
  imageProgressTick
}: {
  imageQueue: ImageQueueItem[];
  scenes: StoryProject["scenes"];
  imageProgressTick: number;
}) {
  const doneCount = imageQueue.filter((item) => item.status === "done").length;
  const runningCount = imageQueue.filter((item) => item.status === "running").length;
  const errorCount = imageQueue.filter((item) => item.status === "error").length;
  const overallProgress =
    imageQueue.length === 0 ? 0 : Math.round((doneCount / imageQueue.length) * 100);

  if (imageQueue.length === 0) {
    return <p className="empty-state">No queued images.</p>;
  }

  return (
    <div className="ai-image-queue-progress-panel">
      <div className="ai-image-queue-summary">
        <strong>{overallProgress}%</strong>
        <span>
          Done {doneCount}/{imageQueue.length}
          {runningCount > 0 ? ` · ${runningCount} running` : ""}
          {errorCount > 0 ? ` · ${errorCount} error` : ""}
        </span>
      </div>
      <div className="ai-image-queue-progress" aria-label={`Total image queue ${overallProgress}%`}>
        <span style={{ width: `${overallProgress}%` }} />
      </div>
      {imageQueue.slice(-12).map((item) => {
        const scene = scenes.find((candidate) => candidate.id === item.sceneId);
        const progress = getImageQueueProgress(item, imageProgressTick);
        return (
          <div className={`ai-image-queue-item status-${item.status}`} key={item.id}>
            <div className="ai-image-queue-title">
              <span>{scene?.title || item.sceneId}</span>
              <small>{item.status}</small>
            </div>
            <strong>{progress}%</strong>
            <div className="ai-image-queue-progress" aria-label={`Image generation ${progress}%`}>
              <span style={{ width: `${progress}%` }} />
            </div>
            {item.error && <small className="ai-image-queue-error">{item.error}</small>}
          </div>
        );
      })}
    </div>
  );
}

function getImageQueueProgress(item: ImageQueueItem, tick: number): number {
  void tick;
  if (item.status === "done") {
    return 100;
  }
  if (item.status === "queued") {
    return 0;
  }
  if (item.status === "error") {
    return item.startedAt
      ? Math.max(8, Math.min(100, estimateTimedProgress(item.startedAt)))
      : 100;
  }
  if (!item.startedAt) {
    return 4;
  }

  return estimateTimedProgress(item.startedAt);
}

function estimateTimedProgress(startedAt: number): number {
  const elapsedMs = Date.now() - startedAt;
  const expectedMs = 180000;
  return Math.max(4, Math.min(95, Math.round((elapsedMs / expectedMs) * 95)));
}

function toImageSrc(imagePath: string): string {
  const trimmedPath = imagePath.trim();
  if (
    trimmedPath.startsWith("data:") ||
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

function createProjectFromSimpleSceneText(
  prompt: string,
  simpleText: string,
  targetSceneCount: number,
  storyStyles: string[]
): StoryProject {
  const baseProject = createDefaultProject();
  const blocks = parseSimpleSceneBlocks(simpleText);
  const flags = createSimpleFlags(simpleText, 0, []);
  const flagMap = createSimpleFlagMap(flags);
  const scenes = blocks.map((block, index) => {
    const sceneNumber = index + 1;
    const sceneId = `scene_${sceneNumber}`;
    const scene = createScene(sceneNumber, sceneId);
    const choices = readSimpleChoices(block);
    const sceneChoices = choices.length > 0 ? choices : [createFallbackSimpleChoice()];

    return {
      ...scene,
      id: sceneId,
      title: readSimpleField(block, "TITLE") || `Scene ${sceneNumber}`,
      text: readSimpleField(block, "TEXT") || "The story begins.",
      position: {
        x: 120 + (index % 5) * 260,
        y: 120 + Math.floor(index / 5) * 190
      },
      choices: sceneChoices.map((choice, choiceIndex) =>
        createChoiceFromSimple(
          choice,
          resolveSimpleChoiceTarget(choice, sceneNumber, choiceIndex, 1, blocks.length),
          `choice_${sceneNumber}_${choiceIndex + 1}`,
          flagMap
        )
      )
    };
  });

  const projectName =
    prompt
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "StoryLife Project";

  return pruneUnusedStoryFlags(migrateProject({
    ...baseProject,
    projectName,
    startSceneId: scenes[0]?.id ?? baseProject.startSceneId,
    storyStyles,
    flags,
    parameters: [],
    storyBible: {
      ...baseProject.storyBible,
      premise: prompt,
      currentArcSummary: `Generated first ${scenes.length} scenes out of requested ${targetSceneCount}.`,
      chapterPlan: [
        {
          id: "chapter_1",
          title: "Opening",
          summary: "Opening block generated in safe scene mode.",
          targetSceneRange: `1-${Math.min(targetSceneCount, 50)}`,
          status: "inProgress"
        }
      ]
    },
    scenes: scenes.length > 0 ? scenes : baseProject.scenes
  }));
}

function parseSimpleSceneBlocks(simpleText: string): string[] {
  return simpleText
    .split(/ENDSCENE/i)
    .map((block) => block.trim())
    .filter((block) => block.toUpperCase().includes("SCENE"));
}

function readSimpleField(block: string, fieldName: string): string {
  const escapedName = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(
    new RegExp(`${escapedName}:\\s*([\\s\\S]*?)(?=\\n[A-Z]+:|\\nCHOICE:|$)`, "i")
  );
  return match ? match[1].trim() : "";
}

function readSimpleChoices(block: string): SimpleSceneChoice[] {
  return [...block.matchAll(/^CHOICE:\s*(.+)$/gim)]
    .map((match) => {
      const rawChoice = match[1].trim();
      const segments = rawChoice.split("|").map((segment) => segment.trim()).filter(Boolean);
      const mainParts = (segments[0] ?? "").split(/\s*(?:->|=>)\s*/i);
      const flagEffect = readFlagDirective(segments, "SET_FLAG");
      const flagCondition = readFlagDirective(segments, "IF_FLAG");

      return {
        text: (mainParts[0] ?? "").trim(),
        targetHint: (mainParts[1] ?? "").trim(),
        setFlagKey: flagEffect.key,
        setFlagValue: flagEffect.value,
        conditionFlagKey: flagCondition.key,
        conditionFlagValue: flagCondition.value
      };
    })
    .filter((choice) => choice.text.length > 0);
}

function createFallbackSimpleChoice(): SimpleSceneChoice {
  return {
    text: "Look for another way",
    targetHint: "NEXT",
    setFlagKey: "",
    setFlagValue: true,
    conditionFlagKey: "",
    conditionFlagValue: true
  };
}

function readFlagDirective(
  segments: string[],
  directiveName: "SET_FLAG" | "IF_FLAG"
): { key: string; value: boolean } {
  const segment = segments.find((item) =>
    item.toUpperCase().startsWith(`${directiveName}:`)
  );
  if (!segment) {
    return { key: "", value: true };
  }

  const rawValue = segment.slice(segment.indexOf(":") + 1).trim();
  const [rawKey, rawBoolean] = rawValue.split("=").map((item) => item.trim());

  return {
    key: sanitizeSimpleFlagKey(rawKey ?? ""),
    value: rawBoolean ? rawBoolean.toLowerCase() !== "false" : true
  };
}

function createChoiceFromSimple(
  choice: SimpleSceneChoice,
  targetNodeId: string,
  id: string,
  flagMap: Map<string, StoryProject["flags"][number]>
): StoryProject["scenes"][number]["choices"][number] {
  const baseChoice = createChoice(targetNodeId, id);
  const effectFlag = flagMap.get(choice.setFlagKey);
  const conditionFlag = flagMap.get(choice.conditionFlagKey);

  return {
    ...baseChoice,
    text: choice.text,
    effects: effectFlag
      ? [
          {
            id: `effect_${id}_flag`,
            type: "flag",
            flagId: effectFlag.id,
            value: choice.setFlagValue
          }
        ]
      : [],
    conditions: conditionFlag
      ? [
          {
            id: `condition_${id}_flag`,
            type: "flag",
            flagId: conditionFlag.id,
            expectedValue: choice.conditionFlagValue
          }
        ]
      : []
  };
}

function createSimpleFlags(
  simpleText: string,
  requestedFlagCount: number,
  existingFlags: StoryProject["flags"]
): StoryProject["flags"] {
  const existingKeys = new Set(existingFlags.map((flag) => flag.key));
  const keys = [
    ...[...simpleText.matchAll(/^FLAG:\s*(.+)$/gim)].map((match) => match[1]),
    ...[...simpleText.matchAll(/\b(?:SET_FLAG|IF_FLAG):\s*([^=|\n]+)/gim)].map(
      (match) => match[1]
    )
  ]
    .map((key) => sanitizeSimpleFlagKey(key))
    .filter(Boolean);

  for (let index = keys.length + 1; index <= requestedFlagCount; index += 1) {
    keys.push(`story_flag_${index}`);
  }

  const uniqueKeys = [...new Set(keys)].filter((key) => !existingKeys.has(key));

  return uniqueKeys.map((key, index) => ({
    id: `flag_${sanitizeSimpleFlagKey(key) || index + 1}`,
    key,
    defaultValue: false
  }));
}

function createSimpleFlagMap(flags: StoryProject["flags"]): Map<string, StoryProject["flags"][number]> {
  return new Map(flags.map((flag) => [sanitizeSimpleFlagKey(flag.key), flag]));
}

function sanitizeSimpleFlagKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function extractRequestedFlagCount(prompt: string): number {
  const normalizedPrompt = prompt.toLowerCase();
  const hasFlagWord =
    normalizedPrompt.includes("\u0444\u043b\u0430\u0433") || normalizedPrompt.includes("flag");
  if (!hasFlagWord) {
    return 0;
  }

  const counts = [...normalizedPrompt.matchAll(/\d{1,3}/g)]
    .map((match) => Number(match[0]))
    .filter((count) => Number.isFinite(count) && count > 0 && count <= 50);

  return counts.length > 0 ? Math.max(...counts) : 3;
}

function resolveSimpleChoiceTarget(
  choice: SimpleSceneChoice,
  sceneNumber: number,
  choiceIndex: number,
  firstSceneNumber: number,
  blockSceneCount: number
): string {
  const lastSceneNumber = firstSceneNumber + blockSceneCount - 1;
  const hint = choice.targetHint.trim().toLowerCase();
  const explicitSceneNumber = Number(hint.match(/^scene_(\d+)$/)?.[1] ?? NaN);

  if (
    Number.isFinite(explicitSceneNumber) &&
    explicitSceneNumber >= firstSceneNumber &&
    explicitSceneNumber <= lastSceneNumber
  ) {
    return `scene_${explicitSceneNumber}`;
  }

  if (hint === "ending" || hint === "end" || hint === "deadend") {
    return `scene_${sceneNumber}`;
  }

  const hintedOffset =
    hint === "next" ? 1 : hint === "skip" ? 2 : hint === "later" ? 3 : 1 + choiceIndex;
  const targetNumber = sceneNumber + hintedOffset;

  if (targetNumber <= lastSceneNumber) {
    return `scene_${targetNumber}`;
  }

  return `scene_${sceneNumber}`;
}

function bridgeTailChoicesToNewBlock(
  previousScene: StoryProject["scenes"][number],
  newScenes: StoryProject["scenes"]
): StoryProject["scenes"][number]["choices"] {
  if (newScenes.length === 0) {
    return previousScene.choices;
  }

  if (previousScene.choices.length === 0) {
    return [
      {
        ...createChoice(newScenes[0].id, `choice_${previousScene.id.replace(/\D/g, "") || "last"}_bridge_1`),
        text: "Push forward"
      },
      {
        ...createChoice(
          newScenes[Math.min(1, newScenes.length - 1)].id,
          `choice_${previousScene.id.replace(/\D/g, "") || "last"}_bridge_2`
        ),
        text: "Take another risk"
      }
    ];
  }

  return previousScene.choices.map((choice, index) => {
    if (choice.targetNodeId !== previousScene.id) {
      return choice;
    }

    return {
      ...choice,
      targetNodeId: newScenes[Math.min(index, newScenes.length - 1)].id
    };
  });
}

function getNextSceneNumber(project: StoryProject): number {
  const usedNumbers = project.scenes
    .map((scene) => {
      const match = scene.id.match(/^scene_(\d+)$/);
      return match ? Number(match[1]) : 0;
    })
    .filter((value) => Number.isFinite(value));

  return Math.max(0, ...usedNumbers) + 1;
}

function mergeProjectPatch(project: StoryProject, patch: AIProjectPatch): StoryProject {
  const updatedScenes = Array.isArray(patch.updatedScenes) ? patch.updatedScenes : [];
  const newScenes = Array.isArray(patch.newScenes) ? patch.newScenes : [];
  const sceneMap = new Map(project.scenes.map((scene) => [scene.id, scene]));

  for (const rawScene of updatedScenes) {
    const normalizedScene = normalizePatchScene(rawScene, project, project.scenes.length + 1);
    const existingScene = sceneMap.get(normalizedScene.id);
    const scene = preserveExistingParameterLogic(normalizedScene, existingScene);
    if (!sceneMap.has(scene.id)) {
      throw new Error(`Patch tried to update missing scene ${scene.id}.`);
    }
    sceneMap.set(scene.id, scene);
  }

  const scenes = project.scenes.map((scene) => sceneMap.get(scene.id) ?? scene);
  for (const rawScene of newScenes) {
    const scene = preserveExistingParameterLogic(
      normalizePatchScene(rawScene, project, scenes.length + 1),
      undefined
    );
    if (sceneMap.has(scene.id)) {
      throw new Error(`Patch contains duplicate scene id ${scene.id}.`);
    }
    sceneMap.set(scene.id, scene);
    scenes.push(scene);
  }

  const flagMap = new Map(project.flags.map((flag) => [flag.id, flag]));
  for (const flag of Array.isArray(patch.flags) ? patch.flags : []) {
    flagMap.set(flag.id, flag);
  }

  const validSceneIds = new Set(scenes.map((scene) => scene.id));
  for (const scene of scenes) {
    for (const choice of scene.choices) {
      if (choice.text.trim() === "") {
        throw new Error(`${scene.id}/${choice.id} has empty choice text.`);
      }
      if (!validSceneIds.has(choice.targetNodeId)) {
        throw new Error(
          `${scene.id}/${choice.id} points to missing scene ${choice.targetNodeId || "(empty)"}.`
        );
      }
      for (const outcome of choice.outcomes) {
        if (!validSceneIds.has(outcome.targetSceneId)) {
          throw new Error(
            `${scene.id}/${choice.id} has an outcome pointing to missing scene ${outcome.targetSceneId || "(empty)"}.`
          );
        }
      }
      for (const target of choice.conditionalTargets) {
        if (!validSceneIds.has(target.targetSceneId)) {
          throw new Error(
            `${scene.id}/${choice.id} has a conditional target pointing to missing scene ${target.targetSceneId || "(empty)"}.`
          );
        }
      }
    }
  }

  return migrateProject({
    ...project,
    parameters: project.parameters,
    flags: [...flagMap.values()],
    storyStyles: Array.isArray(patch.storyStyles)
      ? normalizeStoryStyleIds(patch.storyStyles)
      : project.storyStyles,
    storyBible: patch.storyBible ?? project.storyBible,
    scenes
  });
}

export function applyNarrativeRepairPatch(
  project: StoryProject,
  patch: AIProjectPatch,
  options: { allowGraphChanges?: boolean } = {}
): StoryProject {
  const originalSceneMap = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const originalSceneIndex = new Map(project.scenes.map((scene, index) => [scene.id, index]));
  const safeUpdatedScenes = (patch.updatedScenes ?? []).flatMap((candidateScene) => {
    const originalScene = originalSceneMap.get(candidateScene.id);
    if (!originalScene) return [];
    const sourceIndex = originalSceneIndex.get(originalScene.id) ?? -1;
    return [{
      ...candidateScene,
      id: originalScene.id,
      sceneType: originalScene.sceneType,
      choices: originalScene.choices.map((originalChoice, choiceIndex) => {
        const candidateChoice = candidateScene.choices.find(
          (choice) => choice.id === originalChoice.id
        ) ?? candidateScene.choices[choiceIndex];
        const candidateTarget = candidateChoice?.targetNodeId ?? "";
        const targetIndex = originalSceneIndex.get(candidateTarget);
        const canUseCandidateTarget = options.allowGraphChanges === true &&
          targetIndex !== undefined && targetIndex > sourceIndex;
        const targetNodeId = canUseCandidateTarget
          ? candidateTarget
          : originalChoice.targetNodeId;
        return {
          ...originalChoice,
          text: candidateChoice?.text.trim() || originalChoice.text,
          targetNodeId,
          outcomes: originalChoice.outcomes.length > 0
            ? originalChoice.outcomes.map((outcome, outcomeIndex) => ({
                ...outcome,
                targetSceneId: outcomeIndex === 0 ? targetNodeId : outcome.targetSceneId
              }))
            : [createChoiceOutcome(targetNodeId, 100, `outcome_${originalChoice.id}_1`)]
        };
      })
    }];
  });
  const repaired = mergeProjectPatch(project, {
    ...patch,
    flags: undefined,
    parameters: undefined,
    newScenes: [],
    updatedScenes: safeUpdatedScenes
  });
  const repairedSceneMap = new Map(repaired.scenes.map((scene) => [scene.id, scene]));
  const candidateProject = migrateProject({
    ...project,
    projectName: repaired.projectName,
    storyBible: repaired.storyBible,
    scenes: project.scenes.map((originalScene) => {
      const repairedScene = repairedSceneMap.get(originalScene.id) ?? originalScene;
      return {
        ...repairedScene,
        id: originalScene.id,
        sceneType: originalScene.sceneType,
        choices: originalScene.choices.map((originalChoice, choiceIndex) => {
          const repairedChoice = repairedScene.choices.find(
            (choice) => choice.id === originalChoice.id
          ) ?? repairedScene.choices[choiceIndex];
          return {
            ...(options.allowGraphChanges ? repairedChoice : originalChoice),
            id: originalChoice.id,
            text: repairedChoice?.text.trim() || originalChoice.text
          };
        })
      };
    })
  });

  if (options.allowGraphChanges && isSafeNarrativeGraph(candidateProject)) {
    return candidateProject;
  }

  return migrateProject({
    ...candidateProject,
    scenes: candidateProject.scenes.map((scene) => {
      const originalScene = originalSceneMap.get(scene.id)!;
      return {
        ...scene,
        choices: originalScene.choices.map((originalChoice, choiceIndex) => {
          const rewrittenChoice = scene.choices.find(
            (choice) => choice.id === originalChoice.id
          ) ?? scene.choices[choiceIndex];
          return {
            ...originalChoice,
            text: rewrittenChoice?.text.trim() || originalChoice.text
          };
        })
      };
    })
  });
}

function isSafeNarrativeGraph(project: StoryProject): boolean {
  const sceneIndex = new Map(project.scenes.map((scene, index) => [scene.id, index]));
  const sceneMap = new Map(project.scenes.map((scene) => [scene.id, scene]));

  for (const [sourceIndex, scene] of project.scenes.entries()) {
    if (scene.sceneType === "ending" && scene.choices.length > 0) return false;
    if (scene.sceneType !== "ending" && scene.choices.length === 0) return false;
    const targets = scene.choices.map((choice) => choice.targetNodeId);
    if (new Set(targets).size !== targets.length) return false;
    for (const choice of scene.choices) {
      const targetIndex = sceneIndex.get(choice.targetNodeId);
      if (targetIndex === undefined || targetIndex <= sourceIndex) return false;
      if (choice.outcomes[0]?.targetSceneId !== choice.targetNodeId) return false;
    }
  }

  const reachable = new Set<string>();
  const queue = [project.startSceneId];
  while (queue.length > 0) {
    const sceneId = queue.shift();
    if (!sceneId || reachable.has(sceneId)) continue;
    reachable.add(sceneId);
    queue.push(...(sceneMap.get(sceneId)?.choices.map((choice) => choice.targetNodeId) ?? []));
  }
  if (reachable.size !== project.scenes.length) return false;

  const canReachEnding = new Set(
    project.scenes.filter((scene) => scene.sceneType === "ending").map((scene) => scene.id)
  );
  let changed = true;
  while (changed) {
    changed = false;
    for (const scene of project.scenes) {
      if (
        !canReachEnding.has(scene.id) &&
        scene.choices.some((choice) => canReachEnding.has(choice.targetNodeId))
      ) {
        canReachEnding.add(scene.id);
        changed = true;
      }
    }
  }
  return project.scenes.every((scene) => canReachEnding.has(scene.id));
}

function stripAIParametersFromGeneratedProject(project: StoryProject): StoryProject {
  return {
    ...project,
    parameters: [],
    flags: [],
    scenes: project.scenes.map((scene) => ({
      ...scene,
      choices: scene.choices.map((choice) => ({
        ...choice,
        effects: [],
        conditions: [],
        conditionalTargets: []
      }))
    }))
  };
}

function alignProjectScenesToBlueprint(
  project: StoryProject,
  blueprintScenes: StoryBlueprintScene[]
): StoryProject {
  const generatedSceneMap = new Map(project.scenes.map((scene) => [scene.id, scene]));
  return {
    ...stripAIParametersFromGeneratedProject(project),
    startSceneId: blueprintScenes[0]?.id ?? project.startSceneId,
    scenes: blueprintScenes.map((blueprintScene, index) => {
      const generatedScene = generatedSceneMap.get(blueprintScene.id);
      const fallbackScene = createScene(index + 1, blueprintScene.id);
      return {
        ...fallbackScene,
        ...generatedScene,
        id: blueprintScene.id,
        title: hasUsableGeneratedText(generatedScene?.title)
          ? generatedScene!.title
          : createBlueprintFallbackTitle(blueprintScene, index),
        text: hasUsableGeneratedText(generatedScene?.text)
          ? generatedScene!.text
          : createBlueprintFallbackText(blueprintScene),
        sceneType: blueprintScene.sceneType,
        choices: []
      };
    })
  };
}

function createBlueprintSceneTextPatch(
  rawPatch: AIProjectPatch,
  blueprintScenes: StoryBlueprintScene[]
): AIProjectPatch {
  const rawSceneMap = new Map(
    (Array.isArray(rawPatch.newScenes) ? rawPatch.newScenes : []).map((scene) => [scene.id, scene])
  );
  return {
    storyBible: rawPatch.storyBible,
    storyStyles: rawPatch.storyStyles,
    flags: [],
    parameters: [],
    updatedScenes: [],
    newScenes: blueprintScenes.map((blueprintScene, index) => {
      const generatedScene = rawSceneMap.get(blueprintScene.id);
      const fallbackScene = createScene(
        Number(blueprintScene.id.match(/\d+/)?.[0] ?? index + 1),
        blueprintScene.id
      );
      return {
        ...fallbackScene,
        ...generatedScene,
        id: blueprintScene.id,
        title: hasUsableGeneratedText(generatedScene?.title)
          ? generatedScene!.title
          : createBlueprintFallbackTitle(blueprintScene, index),
        text: hasUsableGeneratedText(generatedScene?.text)
          ? generatedScene!.text
          : createBlueprintFallbackText(blueprintScene),
        sceneType: blueprintScene.sceneType,
        choices: []
      };
    })
  };
}

function findGeneratedChunkShapeProblems(
  patch: AIProjectPatch,
  requiredSceneIds: string[]
): string[] {
  const newScenes = Array.isArray(patch.newScenes) ? patch.newScenes : [];
  const returnedIds = newScenes.map((scene) => scene.id);
  const returnedIdSet = new Set(returnedIds);
  const requiredIdSet = new Set(requiredSceneIds);
  const problems: string[] = [];
  const missingIds = requiredSceneIds.filter((sceneId) => !returnedIdSet.has(sceneId));
  const unexpectedIds = returnedIds.filter((sceneId) => !requiredIdSet.has(sceneId));
  if (missingIds.length > 0) {
    problems.push(`missing required scenes ${missingIds.join(", ")}`);
  }
  if (unexpectedIds.length > 0) {
    problems.push(`returned unexpected scenes ${unexpectedIds.join(", ")}`);
  }
  if (returnedIdSet.size !== returnedIds.length) {
    problems.push("returned duplicate scene ids");
  }
  return problems;
}

export function finalizeProjectFromBlueprint(
  project: StoryProject,
  blueprint: StoryBlueprint
): StoryProject {
  const alignedProject = alignProjectScenesToBlueprint(project, blueprint.scenes);
  const scenes = alignedProject.scenes.map((scene, sceneIndex) => {
    const blueprintScene = blueprint.scenes[sceneIndex];
    return {
      ...scene,
      title: hasUsableGeneratedText(scene.title)
        ? scene.title
        : createBlueprintFallbackTitle(blueprintScene, sceneIndex),
      text: hasUsableGeneratedText(scene.text)
        ? scene.text
        : createBlueprintFallbackText(blueprintScene),
      sceneType: blueprintScene.sceneType,
      choices: blueprintScene.choices.map((blueprintChoice, choiceIndex) => {
        const choiceId = `choice_${sceneIndex + 1}_${choiceIndex + 1}`;
        return {
          ...createChoice(blueprintChoice.targetSceneId, choiceId),
          text: blueprintChoice.text,
          outcomes: [
            createChoiceOutcome(
              blueprintChoice.targetSceneId,
              100,
              `outcome_${sceneIndex + 1}_${choiceIndex + 1}`
            )
          ],
          effects: [],
          conditions: [],
          conditionalTargets: [],
          conditionFailBehavior: "hidden" as const
        };
      })
    };
  });
  const finalizedProject = layoutProjectAsStoryTree({
    ...alignedProject,
    projectName: blueprint.title || alignedProject.projectName,
    startSceneId: blueprint.scenes[0]?.id ?? alignedProject.startSceneId,
    flags: [],
    parameters: [],
    scenes
  });
  const graphProblems = findConnectivityIssues(finalizedProject, [], true);
  if (graphProblems.length > 0) {
    throw new Error(
      `Approved blueprint produced an invalid final graph: ${graphProblems.slice(0, 8).join("; ")}`
    );
  }
  return migrateProject(JSON.parse(serializeProject(finalizedProject)));
}

function hasUsableGeneratedText(value: string | undefined): value is string {
  const text = String(value ?? "").trim();
  return (
    text.length > 0 &&
    !/^scene\s+\d+$/i.test(text) &&
    !/^the story (begins|continues)\.?$/i.test(text)
  );
}

function createBlueprintFallbackTitle(
  scene: StoryBlueprintScene,
  sceneIndex: number
): string {
  const source = [scene.title, scene.beat, scene.purpose]
    .find((value) => hasUsableGeneratedText(value));
  if (source) {
    const compactTitle = source.trim().split(/\r?\n|(?<=[.!?])\s+/)[0].trim();
    return compactTitle.slice(0, 120);
  }
  if (scene.semanticKey) {
    return scene.semanticKey
      .split("_")
      .filter(Boolean)
      .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
      .join(" ")
      .slice(0, 120);
  }
  return `Story moment ${sceneIndex + 1}`;
}

function createBlueprintFallbackText(scene: StoryBlueprintScene): string {
  if (hasUsableGeneratedText(scene.text)) {
    return scene.text;
  }
  const fallbackText = [scene.arrivalReason, scene.beat, scene.purpose]
    .filter((value) => hasUsableGeneratedText(value))
    .join("\n\n");
  return fallbackText || "The consequences of the previous choice unfold in this moment.";
}

function ensureGeneratedChoiceOutcomes(project: StoryProject): StoryProject {
  return {
    ...project,
    scenes: project.scenes.map((scene) => ({
      ...scene,
      choices: scene.choices.map((choice) => ({
        ...choice,
        outcomes:
          choice.outcomes.length > 0
            ? choice.outcomes
            : [createChoiceOutcome(choice.targetNodeId, 100, `outcome_${choice.id}`)]
      }))
    }))
  };
}

function preserveExistingParameterLogic(
  patchedScene: StoryProject["scenes"][number],
  existingScene: StoryProject["scenes"][number] | undefined
): StoryProject["scenes"][number] {
  const existingChoiceMap = new Map(
    (existingScene?.choices ?? []).map((choice) => [choice.id, choice])
  );

  return {
    ...patchedScene,
    choices: patchedScene.choices.map((choice) => {
      const existingChoice = existingChoiceMap.get(choice.id);
      const existingTargetMap = new Map(
        (existingChoice?.conditionalTargets ?? []).map((target) => [target.id, target])
      );
      return {
        ...choice,
        effects: [
          ...choice.effects.filter((effect) => effect.type === "flag"),
          ...(existingChoice?.effects.filter((effect) => effect.type === "parameter") ?? [])
        ],
        conditions: [
          ...choice.conditions.filter((condition) => condition.type === "flag"),
          ...(existingChoice?.conditions.filter((condition) => condition.type === "parameter") ?? [])
        ],
        conditionalTargets: choice.conditionalTargets.map((target) => ({
          ...target,
          conditions: [
            ...target.conditions.filter((condition) => condition.type === "flag"),
            ...(existingTargetMap
              .get(target.id)
              ?.conditions.filter((condition) => condition.type === "parameter") ?? [])
          ]
        }))
      };
    })
  };
}

function pruneUnusedStoryFlags(project: StoryProject): StoryProject {
  const projectWithEndings = normalizeGeneratedEndings(layoutProjectAsStoryTree(project));
  const checkedFlagIds = new Set<string>();
  for (const scene of projectWithEndings.scenes) {
    for (const choice of scene.choices) {
      for (const condition of choice.conditions) {
        if (condition.type === "flag") {
          checkedFlagIds.add(condition.flagId);
        }
      }
      for (const conditionalTarget of choice.conditionalTargets) {
        for (const condition of conditionalTarget.conditions) {
          if (condition.type === "flag") {
            checkedFlagIds.add(condition.flagId);
          }
        }
      }
    }
  }

  if (checkedFlagIds.size === 0) {
    return {
      ...projectWithEndings,
      flags: [],
      scenes: projectWithEndings.scenes.map((scene) => ({
        ...scene,
        choices: scene.choices.map((choice) => ({
          ...choice,
          effects: choice.effects.filter((effect) => effect.type !== "flag"),
          conditions: [],
          conditionalTargets: choice.conditionalTargets.map((target) => ({
            ...target,
            conditions: target.conditions.filter((condition) => condition.type !== "flag")
          }))
        }))
      }))
    };
  }

  const usefulFlagIds = new Set(
    projectWithEndings.flags.filter((flag) => checkedFlagIds.has(flag.id)).map((flag) => flag.id)
  );

  return {
    ...projectWithEndings,
    flags: projectWithEndings.flags.filter((flag) => usefulFlagIds.has(flag.id)),
    scenes: projectWithEndings.scenes.map((scene) => ({
      ...scene,
      choices: scene.choices.map((choice) => ({
        ...choice,
        effects: choice.effects.filter(
          (effect) => effect.type !== "flag" || usefulFlagIds.has(effect.flagId)
        ),
        conditions: choice.conditions.filter(
          (condition) => condition.type !== "flag" || usefulFlagIds.has(condition.flagId)
        ),
        conditionalTargets: choice.conditionalTargets.map((target) => ({
          ...target,
          conditions: target.conditions.filter(
            (condition) => condition.type !== "flag" || usefulFlagIds.has(condition.flagId)
          )
        }))
      }))
    }))
  };
}

function normalizeGeneratedEndings(project: StoryProject): StoryProject {
  const hasEndingScene = project.scenes.some((scene) => scene.sceneType === "ending");
  const lastSceneId = project.scenes.at(-1)?.id ?? "";

  return {
    ...project,
    scenes: project.scenes.map((scene) => {
      const shouldForceEnding = !hasEndingScene && scene.id === lastSceneId;
      if (scene.sceneType !== "ending" && !shouldForceEnding) {
        return scene;
      }

      return {
        ...scene,
        sceneType: "ending",
        choices: []
      };
    })
  };
}

function layoutProjectAsStoryTree(project: StoryProject): StoryProject {
  const sceneMap = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const childrenBySceneId = new Map<string, string[]>();
  for (const scene of project.scenes) {
    const childIds = [
      ...scene.choices.map((choice) => choice.targetNodeId),
      ...scene.choices.flatMap((choice) =>
        choice.conditionalTargets.map((target) => target.targetSceneId)
      )
    ].filter((sceneId) => sceneMap.has(sceneId) && sceneId !== scene.id);
    childrenBySceneId.set(scene.id, [...new Set(childIds)]);
  }

  const levels = new Map<string, number>();
  const queue: Array<{ sceneId: string; level: number }> = [
    { sceneId: project.startSceneId, level: 0 }
  ];
  while (queue.length > 0) {
    const item = queue.shift()!;
    const previousLevel = levels.get(item.sceneId);
    if (previousLevel !== undefined && previousLevel <= item.level) {
      continue;
    }

    levels.set(item.sceneId, item.level);
    for (const childId of childrenBySceneId.get(item.sceneId) ?? []) {
      queue.push({ sceneId: childId, level: item.level + 1 });
    }
  }

  let fallbackLevel = Math.max(0, ...levels.values()) + 1;
  for (const scene of project.scenes) {
    if (!levels.has(scene.id)) {
      levels.set(scene.id, fallbackLevel);
      fallbackLevel += 1;
    }
  }

  const orderedScenes = orderScenesForTreeLayout(project.scenes, project.startSceneId);
  const scenesByLevel = new Map<number, StoryProject["scenes"]>();
  for (const scene of orderedScenes) {
    const level = levels.get(scene.id) ?? 0;
    scenesByLevel.set(level, [...(scenesByLevel.get(level) ?? []), scene]);
  }

  const horizontalGap = 300;
  const verticalGap = 230;
  const originX = 120;
  const originY = 90;
  const maxLevelWidth = Math.max(
    1,
    ...[...scenesByLevel.values()].map((levelScenes) => levelScenes.length)
  );
  const centerOffset = ((maxLevelWidth - 1) * horizontalGap) / 2;
  const positionBySceneId = new Map<string, { x: number; y: number }>();

  for (const [level, levelScenes] of [...scenesByLevel.entries()].sort(
    ([leftLevel], [rightLevel]) => leftLevel - rightLevel
  )) {
    const rowWidth = (levelScenes.length - 1) * horizontalGap;
    const rowStartX = originX + centerOffset - rowWidth / 2;
    levelScenes.forEach((scene, index) => {
      positionBySceneId.set(scene.id, {
        x: rowStartX + index * horizontalGap,
        y: originY + level * verticalGap
      });
    });
  }

  return {
    ...project,
    scenes: project.scenes.map((scene) => ({
      ...scene,
      position: positionBySceneId.get(scene.id) ?? scene.position
    }))
  };
}

function orderScenesForTreeLayout(
  scenes: StoryProject["scenes"],
  startSceneId: string
): StoryProject["scenes"] {
  const sceneMap = new Map(scenes.map((scene) => [scene.id, scene]));
  const visitedSceneIds = new Set<string>();
  const orderedScenes: StoryProject["scenes"] = [];

  function visit(sceneId: string) {
    if (visitedSceneIds.has(sceneId)) {
      return;
    }

    const scene = sceneMap.get(sceneId);
    if (!scene) {
      return;
    }

    visitedSceneIds.add(sceneId);
    orderedScenes.push(scene);
    for (const childId of scene.choices.flatMap((choice) => [
      choice.targetNodeId,
      ...choice.conditionalTargets.map((target) => target.targetSceneId)
    ])) {
      visit(childId);
    }
  }

  visit(startSceneId);
  for (const scene of scenes) {
    visit(scene.id);
  }

  return orderedScenes;
}

function normalizePatchScene(
  rawScene: unknown,
  project: StoryProject,
  fallbackIndex: number
): StoryProject["scenes"][number] {
  const rawRecord = isPlainObject(rawScene) ? rawScene : {};
  const rawId = typeof rawRecord.id === "string" ? rawRecord.id : `scene_${fallbackIndex}`;
  const numericId = Number(rawId.match(/\d+/)?.[0] ?? fallbackIndex);
  const baseScene =
    project.scenes.find((scene) => scene.id === rawId) ??
    createScene(Number.isFinite(numericId) ? numericId : fallbackIndex, rawId);
  const rawChoices = Array.isArray(rawRecord.choices) ? rawRecord.choices : [];

  return {
    ...baseScene,
    ...rawRecord,
    id: rawId,
    title: typeof rawRecord.title === "string" ? rawRecord.title : baseScene.title,
    text: typeof rawRecord.text === "string" ? rawRecord.text : baseScene.text,
    position: isPlainObject(rawRecord.position)
      ? {
          x: typeof rawRecord.position.x === "number" ? rawRecord.position.x : baseScene.position.x,
          y: typeof rawRecord.position.y === "number" ? rawRecord.position.y : baseScene.position.y
        }
      : baseScene.position,
    style: isPlainObject(rawRecord.style)
      ? { ...baseScene.style, ...rawRecord.style }
      : baseScene.style,
    choices: rawChoices
      .filter(isPlainObject)
      .map((choice, index) => normalizePatchChoice(choice, project, rawId, index + 1))
  };
}

function normalizePatchChoice(
  rawChoice: Record<string, unknown>,
  project: StoryProject,
  sceneId: string,
  fallbackIndex: number
): StoryProject["scenes"][number]["choices"][number] {
  // Invalid generated choices must remain visibly invalid for the final check.
  // Never repair a missing target by silently jumping back to the first scene.
  const fallbackTarget = sceneId;
  const targetNodeId =
    typeof rawChoice.targetNodeId === "string" ? rawChoice.targetNodeId : fallbackTarget;
  const baseChoice = createChoice(targetNodeId, `choice_${sceneId.replace(/\D/g, "") || "x"}_${fallbackIndex}`);
  const normalizedOutcomes = Array.isArray(rawChoice.outcomes)
    ? rawChoice.outcomes.filter(isPlainObject).map((outcome, index) =>
        createChoiceOutcome(
          typeof outcome.targetSceneId === "string" ? outcome.targetSceneId : targetNodeId,
          typeof outcome.percent === "number"
            ? Math.max(0, Math.min(100, outcome.percent))
            : index === 0
              ? 100
              : 0,
          typeof outcome.id === "string"
            ? outcome.id
            : `outcome_${sceneId}_${fallbackIndex}_${index + 1}`
        )
      )
    : [];

  return {
    ...baseChoice,
    ...rawChoice,
    id: typeof rawChoice.id === "string" ? rawChoice.id : baseChoice.id,
    text: typeof rawChoice.text === "string" ? rawChoice.text : "",
    targetNodeId,
    useMultipleOutcomes:
      typeof rawChoice.useMultipleOutcomes === "boolean"
        ? rawChoice.useMultipleOutcomes
        : Array.isArray(rawChoice.outcomes) && rawChoice.outcomes.length > 1,
    outcomes:
      normalizedOutcomes.length > 0
        ? normalizedOutcomes
        : [createChoiceOutcome(targetNodeId, 100, `outcome_${baseChoice.id}`)],
    conditionalTargets: Array.isArray(rawChoice.conditionalTargets)
      ? rawChoice.conditionalTargets.filter(isPlainObject).map((target, index) => ({
          id:
            typeof target.id === "string"
              ? target.id
              : `conditional_target_${sceneId}_${fallbackIndex}_${index + 1}`,
          targetSceneId:
            typeof target.targetSceneId === "string" ? target.targetSceneId : targetNodeId,
          conditions: Array.isArray(target.conditions) ? target.conditions : []
        }))
      : [],
    effects: Array.isArray(rawChoice.effects)
      ? rawChoice.effects.filter(isPlainObject).map((effect, index) =>
          normalizePatchEffect(effect, sceneId, fallbackIndex, index + 1)
        )
      : [],
    conditions: Array.isArray(rawChoice.conditions)
      ? rawChoice.conditions.filter(isPlainObject).map((condition, index) =>
          normalizePatchCondition(condition, sceneId, fallbackIndex, index + 1)
        )
      : [],
    conditionFailBehavior:
      rawChoice.conditionFailBehavior === "hidden" ? "hidden" : "disabled"
  };
}

function normalizePatchEffect(
  effect: Record<string, unknown>,
  sceneId: string,
  choiceIndex: number,
  effectIndex: number
): StoryProject["scenes"][number]["choices"][number]["effects"][number] {
  const id =
    typeof effect.id === "string"
      ? effect.id
      : `effect_${sceneId}_${choiceIndex}_${effectIndex}`;

  if (effect.type === "flag" || typeof effect.flagId === "string") {
    return {
      id,
      type: "flag",
      flagId: typeof effect.flagId === "string" ? effect.flagId : "",
      value: typeof effect.value === "boolean" ? effect.value : Boolean(effect.value)
    };
  }

  return {
    id,
    type: "parameter",
    parameterId:
      typeof effect.parameterId === "string"
        ? effect.parameterId
        : typeof effect.id === "string"
          ? effect.id
          : "",
    operation:
      effect.operation === "subtract" || effect.operation === "set"
        ? effect.operation
        : "add",
    value: typeof effect.value === "number" ? effect.value : 0
  };
}

function normalizePatchCondition(
  condition: Record<string, unknown>,
  sceneId: string,
  choiceIndex: number,
  conditionIndex: number
): StoryProject["scenes"][number]["choices"][number]["conditions"][number] {
  const id =
    typeof condition.id === "string"
      ? condition.id
      : `condition_${sceneId}_${choiceIndex}_${conditionIndex}`;

  if (condition.type === "flag" || typeof condition.flagId === "string") {
    return {
      id,
      type: "flag",
      flagId: typeof condition.flagId === "string" ? condition.flagId : "",
      expectedValue:
        typeof condition.expectedValue === "boolean"
          ? condition.expectedValue
          : typeof condition.value === "boolean"
            ? condition.value
            : true
    };
  }

  return {
    id,
    type: "parameter",
    parameterId:
      typeof condition.parameterId === "string" ? condition.parameterId : "",
    operator:
      condition.operator === ">" ||
      condition.operator === "<" ||
      condition.operator === "<=" ||
      condition.operator === "==" ||
      condition.operator === "!="
        ? condition.operator
        : ">=",
    value: typeof condition.value === "number" ? condition.value : 0
  };
}

function normalizeProjectBeforeMigration(rawProject: unknown): unknown {
  if (!isPlainObject(rawProject) || !Array.isArray(rawProject.scenes)) {
    return rawProject;
  }

  const fallbackProject = createDefaultProject();
  const normalizedScenes = rawProject.scenes.map((scene, index) =>
    normalizePatchScene(scene, fallbackProject, index + 1)
  );
  const sceneIds = new Set(normalizedScenes.map((scene) => scene.id));

  return {
    ...fallbackProject,
    ...rawProject,
    flags: normalizeProjectFlags(rawProject.flags),
    parameters: normalizeProjectParameters(rawProject.parameters),
    startSceneId:
      typeof rawProject.startSceneId === "string" && sceneIds.has(rawProject.startSceneId)
        ? rawProject.startSceneId
        : normalizedScenes[0]?.id ?? fallbackProject.startSceneId,
    scenes: normalizedScenes.map((scene) => ({
      ...scene,
      choices: scene.choices
        .filter((choice) => sceneIds.has(choice.targetNodeId))
        .map((choice) => ({
          ...choice,
          outcomes: [
            createChoiceOutcome(choice.targetNodeId, 100, `outcome_${choice.id}`)
          ],
          conditionalTargets: choice.conditionalTargets.filter((target) =>
            sceneIds.has(target.targetSceneId)
          )
        }))
    }))
  };
}

function normalizeProjectFlags(rawFlags: unknown): StoryProject["flags"] {
  if (Array.isArray(rawFlags)) {
    return rawFlags.filter(isPlainObject).map((flag, index) => ({
      id: typeof flag.id === "string" ? flag.id : `flag_${index + 1}`,
      key:
        typeof flag.key === "string"
          ? flag.key
          : typeof flag.id === "string"
            ? flag.id
            : `flag_${index + 1}`,
      defaultValue:
        typeof flag.defaultValue === "boolean"
          ? flag.defaultValue
          : typeof flag.value === "boolean"
            ? flag.value
            : false
    }));
  }

  if (isPlainObject(rawFlags)) {
    return Object.entries(rawFlags).map(([key, value]) => ({
      id: key,
      key,
      defaultValue: Boolean(value)
    }));
  }

  return [];
}

function normalizeProjectParameters(rawParameters: unknown): StoryProject["parameters"] {
  if (Array.isArray(rawParameters)) {
    return rawParameters.filter(isPlainObject).map((parameter, index) => ({
      id: typeof parameter.id === "string" ? parameter.id : `parameter_${index + 1}`,
      key:
        typeof parameter.key === "string"
          ? parameter.key
          : typeof parameter.id === "string"
            ? parameter.id
            : `parameter_${index + 1}`,
      initialValue:
        typeof parameter.initialValue === "number"
          ? parameter.initialValue
          : typeof parameter.value === "number"
            ? parameter.value
            : 0,
      minValue: typeof parameter.minValue === "number" ? parameter.minValue : null,
      maxValue: typeof parameter.maxValue === "number" ? parameter.maxValue : null
    }));
  }

  if (isPlainObject(rawParameters)) {
    return Object.entries(rawParameters).map(([key, value]) => ({
      id: key,
      key,
      initialValue: typeof value === "number" ? value : 0,
      minValue: null,
      maxValue: null
    }));
  }

  return [];
}

function extractJsonObjectFromText(value: string): string {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const startIndex = candidate.indexOf("{");
  const endIndex = candidate.lastIndexOf("}");

  if (startIndex === -1 || endIndex <= startIndex) {
    throw new Error("No JSON object found in AI text.");
  }

  const jsonText = candidate.slice(startIndex, endIndex + 1);
  JSON.parse(jsonText);
  return jsonText;
}

function readRequiredArchitectureText(
  architecture: Record<string, unknown>,
  field: "title" | "premise" | "tone"
): string {
  const value = typeof architecture[field] === "string" ? architecture[field].trim() : "";
  if (!value) {
    throw new Error(`Story architecture is missing ${field}.`);
  }
  return value;
}

function readArchitectureSceneKeys(
  architecture: Record<string, unknown>,
  targetSceneCount: number
): string[] {
  const rawScenePlan = architecture.scenePlan;
  if (!Array.isArray(rawScenePlan)) {
    throw new Error("Story architecture is missing its semantic scenePlan.");
  }

  const keys = rawScenePlan.map((item) =>
    isPlainObject(item) && typeof item.key === "string" ? item.key.trim() : ""
  );
  if (keys.length !== targetSceneCount) {
    throw new Error(
      `Story architecture has ${keys.length} scene contracts; exactly ${targetSceneCount} are required.`
    );
  }
  if (new Set(keys).size !== keys.length) {
    throw new Error("Story architecture contains duplicate semantic scene keys.");
  }
  const invalidKey = keys.find(
    (key) => !/^[a-z][a-z0-9_]{2,79}$/.test(key) || /^scene_?\d+$/i.test(key)
  );
  if (invalidKey !== undefined) {
    throw new Error(
      `Story architecture key ${invalidKey || "(empty)"} must describe story meaning, not a scene number.`
    );
  }
  const graphProblems = findArchitectureGraphProblems(architecture, targetSceneCount);
  if (graphProblems.length > 0) {
    throw new Error(`Story architecture graph is invalid: ${graphProblems.slice(0, 8).join("; ")}`);
  }
  return keys;
}

function findArchitectureGraphProblems(
  architecture: Record<string, unknown>,
  targetSceneCount: number
): string[] {
  const rawScenePlan = Array.isArray(architecture.scenePlan) ? architecture.scenePlan : [];
  const contracts = rawScenePlan.filter(isPlainObject).map((item) => ({
    key: typeof item.key === "string" ? item.key.trim() : "",
    branchId: typeof item.branchId === "string" ? item.branchId.trim() : "",
    sceneType: item.sceneType === "ending" ? "ending" as const : "normal" as const,
    outgoingTargets: Array.isArray(item.outgoingTargets)
      ? item.outgoingTargets
          .map((target) => typeof target === "string" ? target.trim() : "")
          .filter(Boolean)
      : []
  }));
  const problems: string[] = [];
  if (contracts.length !== targetSceneCount) {
    return [`scenePlan must contain exactly ${targetSceneCount} complete graph contracts.`];
  }

  const indexByKey = new Map(contracts.map((contract, index) => [contract.key, index]));
  const contractByKey = new Map(contracts.map((contract) => [contract.key, contract]));
  const incomingCount = new Map(contracts.map((contract) => [contract.key, 0]));
  for (const [index, contract] of contracts.entries()) {
    if (!contract.branchId) {
      problems.push(`${contract.key || `contract ${index + 1}`}: branchId is required.`);
    }
    if (contract.sceneType === "normal" && contract.outgoingTargets.length === 0) {
      problems.push(`${contract.key}: every normal scene contract needs at least one outgoing target.`);
    }
    if (contract.sceneType === "ending" && contract.outgoingTargets.length > 0) {
      problems.push(`${contract.key}: an ending contract cannot have outgoing targets.`);
    }
    if (new Set(contract.outgoingTargets).size !== contract.outgoingTargets.length) {
      problems.push(`${contract.key}: outgoing targets must be different choices.`);
    }
    for (const targetKey of contract.outgoingTargets) {
      const targetIndex = indexByKey.get(targetKey);
      if (targetIndex === undefined) {
        problems.push(`${contract.key}: outgoing target ${targetKey} is missing from scenePlan.`);
      } else if (targetIndex <= index) {
        problems.push(`${contract.key}: outgoing target ${targetKey} must occur later in scenePlan.`);
      } else {
        incomingCount.set(targetKey, (incomingCount.get(targetKey) ?? 0) + 1);
      }
    }
  }

  const reachable = new Set<string>();
  const queue = [contracts[0]?.key ?? ""];
  while (queue.length > 0) {
    const key = queue.shift();
    if (!key || reachable.has(key)) continue;
    reachable.add(key);
    queue.push(...(contractByKey.get(key)?.outgoingTargets ?? []));
  }
  for (const contract of contracts) {
    if (!reachable.has(contract.key)) {
      problems.push(`${contract.key}: contract is unreachable from the opening scene.`);
    }
  }

  const endingKeys = contracts
    .filter((contract) => contract.sceneType === "ending")
    .map((contract) => contract.key);
  const minimumEndingCount = targetSceneCount >= 8 ? 2 : 1;
  if (endingKeys.length < minimumEndingCount) {
    problems.push(`The story needs at least ${minimumEndingCount} main ending scenes.`);
  }
  const minimumBranchingCount = targetSceneCount >= 8
    ? Math.max(2, Math.floor(targetSceneCount / 8))
    : 1;
  const branchingCount = contracts.filter(
    (contract) => contract.outgoingTargets.length > 1
  ).length;
  if (branchingCount < minimumBranchingCount) {
    problems.push(
      `The story needs at least ${minimumBranchingCount} real branching decisions; only ${branchingCount} were planned.`
    );
  }
  if (
    targetSceneCount >= 12 &&
    !contracts.some((contract) => (incomingCount.get(contract.key) ?? 0) > 1)
  ) {
    problems.push("The graph never converges after branching; plan at least one compatible later convergence.");
  }

  const canReachEnding = new Set(endingKeys);
  let changed = true;
  while (changed) {
    changed = false;
    for (const contract of contracts) {
      if (
        !canReachEnding.has(contract.key) &&
        contract.outgoingTargets.some((targetKey) => canReachEnding.has(targetKey))
      ) {
        canReachEnding.add(contract.key);
        changed = true;
      }
    }
  }
  for (const contract of contracts) {
    if (reachable.has(contract.key) && !canReachEnding.has(contract.key)) {
      problems.push(`${contract.key}: no route from this contract reaches an ending.`);
    }
  }
  return [...new Set(problems)].slice(0, 40);
}

function findArchitectureContractProblems(
  architecture: Record<string, unknown>,
  scenes: SemanticStoryScene[]
): string[] {
  const rawScenePlan = Array.isArray(architecture.scenePlan) ? architecture.scenePlan : [];
  const contractByKey = new Map(
    rawScenePlan.filter(isPlainObject).map((item) => [
      typeof item.key === "string" ? item.key.trim() : "",
      item
    ])
  );
  const problems: string[] = [];
  for (const scene of scenes) {
    const contract = contractByKey.get(scene.key);
    if (!contract) {
      problems.push(`${scene.key}: no matching master architecture contract.`);
      continue;
    }
    const expectedBranchId = typeof contract.branchId === "string"
      ? contract.branchId.trim()
      : "";
    const expectedSceneType = contract.sceneType === "ending" ? "ending" : "normal";
    const expectedTargets = Array.isArray(contract.outgoingTargets)
      ? contract.outgoingTargets
          .map((target) => typeof target === "string" ? target.trim() : "")
          .filter(Boolean)
      : [];
    const actualTargets = scene.choices.map((choice) => choice.targetKey);
    if (expectedBranchId && scene.branchId !== expectedBranchId) {
      problems.push(
        `${scene.key}: branchId must remain ${expectedBranchId}, not ${scene.branchId || "(empty)"}.`
      );
    }
    if (scene.sceneType !== expectedSceneType) {
      problems.push(`${scene.key}: sceneType must remain ${expectedSceneType}.`);
    }
    if (
      actualTargets.length !== expectedTargets.length ||
      actualTargets.some((targetKey) => !expectedTargets.includes(targetKey))
    ) {
      problems.push(
        `${scene.key}: choices must use exactly the planned targets ${expectedTargets.join(", ") || "none"}.`
      );
    }
  }
  return problems;
}

function createProjectMemoryLibrary(
  project: StoryProject,
  planText: string,
  originalPrompt: string
): string {
  const sceneMap = project.scenes.map((scene) => {
    const choices = scene.choices
      .map((choice) => {
        const effects = choice.effects
          .map((effect) =>
            effect.type === "flag"
              ? `${effect.flagId}=${effect.value}`
              : `${effect.parameterId}:${effect.operation}${effect.value}`
          )
          .join(",");
        return `${choice.text}->${choice.targetNodeId}${effects ? `[${effects}]` : ""}`;
      })
      .join(" | ");
    return `${scene.id} :: ${scene.title} :: ${scene.sceneType} :: ${choices || "ENDING"}`;
  });

  return [
    "STORYLIFE PROJECT MEMORY LIBRARY",
    "This memory is binding for every later JSON chunk.",
    "",
    "ORIGINAL BRIEF:",
    originalPrompt.slice(0, 10000),
    "",
    "APPROVED MASTER PLAN:",
    planText.slice(0, 24000),
    "",
    "STORY BIBLE:",
    JSON.stringify(project.storyBible, null, 2).slice(0, 16000),
    "",
    `FLAGS: ${project.flags.map((flag) => `${flag.id}:${flag.key}`).join(" | ") || "none"}`,
    `PARAMETERS: ${
      project.parameters
        .map((parameter) =>
          `${parameter.id}:${parameter.key}[${parameter.minValue ?? "-inf"},${parameter.maxValue ?? "+inf"}]`
        )
        .join(" | ") || "none"
    }`,
    "",
    "FROZEN SCENE AND CHOICE MAP:",
    sceneMap.join("\n").slice(0, 70000)
  ].join("\n");
}

function validateProjectDraftJson(projectJson: string): {
  problems: string[];
  warnings: string[];
  sceneCount: number;
} {
  const problems: string[] = [];
  const warnings: string[] = [];
  let rawProject: unknown;

  try {
    rawProject = JSON.parse(projectJson);
  } catch (error) {
    return {
      problems: [`JSON syntax error: ${getErrorMessage(error)}`],
      warnings,
      sceneCount: 0
    };
  }

  if (!isPlainObject(rawProject) || !Array.isArray(rawProject.scenes)) {
    return {
      problems: ["The draft must be a project object with a scenes array."],
      warnings,
      sceneCount: 0
    };
  }

  const rawScenes = rawProject.scenes.filter(isPlainObject);
  const rawSceneIds = rawScenes.map((scene) => String(scene.id ?? ""));
  const duplicateSceneIds = rawSceneIds.filter(
    (sceneId, index) => sceneId !== "" && rawSceneIds.indexOf(sceneId) !== index
  );
  for (const duplicateId of [...new Set(duplicateSceneIds)]) {
    problems.push(`Duplicate scene id: ${duplicateId}.`);
  }
  const rawChoiceIds = new Set<string>();
  for (const [sceneIndex, rawScene] of rawScenes.entries()) {
    const rawSceneId =
      typeof rawScene.id === "string" && rawScene.id.trim() !== ""
        ? rawScene.id
        : `scene at index ${sceneIndex}`;
    if (typeof rawScene.id !== "string" || rawScene.id.trim() === "") {
      problems.push(`${rawSceneId}: missing scene id.`);
    }
    if (typeof rawScene.title !== "string" || rawScene.title.trim() === "") {
      problems.push(`${rawSceneId}: missing scene title.`);
    }
    if (typeof rawScene.text !== "string" || rawScene.text.trim() === "") {
      problems.push(`${rawSceneId}: missing scene text.`);
    }
    if (!Array.isArray(rawScene.choices)) {
      problems.push(`${rawSceneId}: choices must be an array.`);
      continue;
    }
    for (const [choiceIndex, rawChoice] of rawScene.choices.entries()) {
      if (!isPlainObject(rawChoice)) {
        problems.push(`${rawSceneId}: choice at index ${choiceIndex} is not an object.`);
        continue;
      }
      const rawChoiceId =
        typeof rawChoice.id === "string" && rawChoice.id.trim() !== ""
          ? rawChoice.id
          : `${rawSceneId}/choice at index ${choiceIndex}`;
      if (typeof rawChoice.id !== "string" || rawChoice.id.trim() === "") {
        problems.push(`${rawChoiceId}: missing choice id.`);
      } else if (rawChoiceIds.has(rawChoice.id)) {
        problems.push(`Duplicate choice id: ${rawChoice.id}.`);
      } else {
        rawChoiceIds.add(rawChoice.id);
      }
      if (typeof rawChoice.text !== "string" || rawChoice.text.trim() === "") {
        problems.push(`${rawChoiceId}: missing choice text.`);
      }
      if (typeof rawChoice.targetNodeId !== "string" || rawChoice.targetNodeId.trim() === "") {
        problems.push(`${rawChoiceId}: missing targetNodeId.`);
      }
    }
  }

  let project: StoryProject;
  try {
    project = migrateProject(rawProject);
  } catch (error) {
    problems.push(`Project schema error: ${getErrorMessage(error)}`);
    return { problems, warnings, sceneCount: rawScenes.length };
  }

  const sceneIds = new Set(project.scenes.map((scene) => scene.id));
  const flagIds = new Set(project.flags.map((flag) => flag.id));
  const parameterIds = new Set(project.parameters.map((parameter) => parameter.id));
  const usedFlagIds = new Set<string>();
  const usedParameterIds = new Set<string>();
  const setFlagIds = new Set<string>();
  const checkedFlagIds = new Set<string>();
  const changedParameterIds = new Set<string>();
  const checkedParameterIds = new Set<string>();
  let meaningfulBranchCount = 0;

  for (const scene of project.scenes) {
    if (scene.title.trim() === "" || /^scene\s+\d+$/i.test(scene.title.trim())) {
      problems.push(`${scene.id}: missing or placeholder scene title.`);
    }
    if (scene.text.trim() === "" || /the story (begins|continues)/i.test(scene.text)) {
      problems.push(`${scene.id}: missing or placeholder scene text.`);
    }
    if (scene.sceneType === "ending" && scene.choices.length > 0) {
      problems.push(`${scene.id}: ending scene has outgoing choices.`);
    }
    if (scene.sceneType !== "ending" && scene.choices.length === 0) {
      problems.push(`${scene.id}: non-ending scene has no choices.`);
    }

    const targetIds = new Set(scene.choices.map((choice) => choice.targetNodeId));
    const hasRememberedEffect = scene.choices.some((choice) => choice.effects.length > 0);
    if (targetIds.size > 1 || hasRememberedEffect) {
      meaningfulBranchCount += 1;
    }
    if (scene.choices.length > 1 && targetIds.size === 1) {
      problems.push(
        `${scene.id}: all ${scene.choices.length} choices lead directly to ${[...targetIds][0]}. Give them distinct logical targets or keep only one honest choice.`
      );
    }

    for (const choice of scene.choices) {
      const choiceText = choice.text.trim();
      if (choiceText === "" || /^new choice$/i.test(choiceText)) {
        problems.push(`${scene.id}/${choice.id}: empty or default choice text.`);
      }
      if (choice.targetNodeId === scene.id) {
        problems.push(`${scene.id}/${choice.id}: accidental self-loop.`);
      }
      if (!sceneIds.has(choice.targetNodeId)) {
        problems.push(
          `${scene.id}/${choice.id}: target points to missing scene ${choice.targetNodeId || "(empty)"}.`
        );
      }
      if (choice.outcomes.length === 0) {
        problems.push(`${scene.id}/${choice.id}: choice has no outcome.`);
      }
      for (const outcome of choice.outcomes) {
        if (!sceneIds.has(outcome.targetSceneId)) {
          problems.push(
            `${scene.id}/${choice.id}: outcome points to missing scene ${outcome.targetSceneId || "(empty)"}.`
          );
        }
      }
      if (
        scene.id !== project.startSceneId &&
        choice.targetNodeId === project.startSceneId &&
        !/(restart|start over|вернут|начать заново)/i.test(choiceText)
      ) {
        problems.push(`${scene.id}/${choice.id}: unexpected jump back to the start scene.`);
      }

      for (const effect of choice.effects) {
        if (effect.type === "flag") {
          usedFlagIds.add(effect.flagId);
          setFlagIds.add(effect.flagId);
          if (!flagIds.has(effect.flagId)) {
            problems.push(`${scene.id}/${choice.id}: effect references missing flag ${effect.flagId}.`);
          }
        } else {
          usedParameterIds.add(effect.parameterId);
          changedParameterIds.add(effect.parameterId);
          if (!parameterIds.has(effect.parameterId)) {
            problems.push(
              `${scene.id}/${choice.id}: effect references missing parameter ${effect.parameterId}.`
            );
          }
        }
      }
      for (const condition of choice.conditions) {
        if (condition.type === "flag") {
          usedFlagIds.add(condition.flagId);
          checkedFlagIds.add(condition.flagId);
          if (!flagIds.has(condition.flagId)) {
            problems.push(`${scene.id}/${choice.id}: condition references missing flag ${condition.flagId}.`);
          }
        } else {
          usedParameterIds.add(condition.parameterId);
          checkedParameterIds.add(condition.parameterId);
          if (!parameterIds.has(condition.parameterId)) {
            problems.push(
              `${scene.id}/${choice.id}: condition references missing parameter ${condition.parameterId}.`
            );
          }
        }
      }
      for (const target of choice.conditionalTargets) {
        if (!sceneIds.has(target.targetSceneId)) {
          problems.push(
            `${scene.id}/${choice.id}: conditional target points to missing ${target.targetSceneId}.`
          );
        }
        for (const condition of target.conditions) {
          if (condition.type === "flag") {
            usedFlagIds.add(condition.flagId);
            checkedFlagIds.add(condition.flagId);
            if (!flagIds.has(condition.flagId)) {
              problems.push(
                `${scene.id}/${choice.id}: conditional target references missing flag ${condition.flagId}.`
              );
            }
          } else {
            usedParameterIds.add(condition.parameterId);
            checkedParameterIds.add(condition.parameterId);
            if (!parameterIds.has(condition.parameterId)) {
              problems.push(
                `${scene.id}/${choice.id}: conditional target references missing parameter ${condition.parameterId}.`
              );
            }
          }
        }
      }
    }
  }

  const reachableIds = new Set<string>();
  const queue = [project.startSceneId];
  while (queue.length > 0) {
    const sceneId = queue.shift();
    if (!sceneId || reachableIds.has(sceneId)) {
      continue;
    }
    reachableIds.add(sceneId);
    const scene = project.scenes.find((item) => item.id === sceneId);
    if (!scene) {
      continue;
    }
    for (const choice of scene.choices) {
      queue.push(choice.targetNodeId);
      for (const target of choice.conditionalTargets) {
        queue.push(target.targetSceneId);
      }
      for (const outcome of choice.outcomes) {
        queue.push(outcome.targetSceneId);
      }
    }
  }

  const unreachableScenes = project.scenes.filter((scene) => !reachableIds.has(scene.id));
  for (const scene of unreachableScenes.slice(0, 20)) {
    problems.push(`${scene.id}: scene is unreachable from ${project.startSceneId}.`);
  }
  if (unreachableScenes.length > 20) {
    problems.push(`${unreachableScenes.length - 20} more scenes are unreachable.`);
  }
  if (project.scenes.length > 3 && meaningfulBranchCount === 0) {
    problems.push("The project contains no meaningful branch or remembered consequence.");
  }

  for (const flag of project.flags) {
    if (!usedFlagIds.has(flag.id)) {
      warnings.push(`Unused flag: ${flag.id}.`);
    } else if (!setFlagIds.has(flag.id)) {
      problems.push(`Flag ${flag.id} is checked but is never set by a choice.`);
    } else if (!checkedFlagIds.has(flag.id)) {
      problems.push(`Flag ${flag.id} is set but never checked or paid off later.`);
    }
  }
  for (const parameter of project.parameters) {
    if (!usedParameterIds.has(parameter.id)) {
      warnings.push(`Unused parameter: ${parameter.id}.`);
    } else if (!changedParameterIds.has(parameter.id)) {
      problems.push(`Parameter ${parameter.id} is checked but never changed by a choice.`);
    } else if (!checkedParameterIds.has(parameter.id)) {
      problems.push(`Parameter ${parameter.id} is changed but never checked later.`);
    }
  }

  return { problems: [...new Set(problems)], warnings, sceneCount: project.scenes.length };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  const safeSize = Math.max(1, Math.floor(size));
  for (let index = 0; index < items.length; index += safeSize) {
    chunks.push(items.slice(index, index + safeSize));
  }
  return chunks;
}

function findFakeChoiceIssues(project: StoryProject, sceneIds: string[]): string[] {
  const sceneIdSet = new Set(sceneIds);
  return project.scenes
    .filter((scene) => sceneIdSet.has(scene.id) && scene.choices.length > 1)
    .filter((scene) => new Set(scene.choices.map((choice) => choice.targetNodeId)).size === 1)
    .map(
      (scene) =>
        `${scene.id}: ${scene.choices.length} choices all point directly to ${scene.choices[0]?.targetNodeId ?? "(empty)"}`
    );
}

function findConnectivityIssues(
  project: StoryProject,
  requiredFrontierIds: string[],
  requireCompleteGraph: boolean
): string[] {
  const issues: string[] = [];
  const requiredChoiceIds = new Set(requiredFrontierIds);
  if (requireCompleteGraph) {
    for (const scene of project.scenes) {
      if (scene.sceneType !== "ending") {
        requiredChoiceIds.add(scene.id);
      }
    }
  }

  for (const sceneId of requiredChoiceIds) {
    const scene = project.scenes.find((item) => item.id === sceneId);
    if (scene && scene.sceneType !== "ending" && scene.choices.length === 0) {
      issues.push(`${scene.id}: non-ending frontier scene has no choices and is not connected forward`);
    }
  }

  const reachableIds = new Set<string>();
  const queue = [project.startSceneId];
  const sceneMap = new Map(project.scenes.map((scene) => [scene.id, scene]));
  while (queue.length > 0) {
    const sceneId = queue.shift();
    if (!sceneId || reachableIds.has(sceneId)) {
      continue;
    }
    reachableIds.add(sceneId);
    const scene = sceneMap.get(sceneId);
    for (const choice of scene?.choices ?? []) {
      queue.push(choice.targetNodeId);
      for (const outcome of choice.outcomes) {
        queue.push(outcome.targetSceneId);
      }
      for (const target of choice.conditionalTargets) {
        queue.push(target.targetSceneId);
      }
    }
  }

  for (const scene of project.scenes) {
    if (!reachableIds.has(scene.id)) {
      issues.push(`${scene.id}: scene is unreachable from ${project.startSceneId}`);
    }
  }
  issues.push(...findFakeChoiceIssues(project, project.scenes.map((scene) => scene.id)));
  return [...new Set(issues)];
}

function readStoredMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(AI_MESSAGES_KEY);
    if (!raw) {
      return INITIAL_MESSAGES;
    }
    const parsed = JSON.parse(raw) as ChatMessage[];
    return parsed.length > 0 ? parsed : INITIAL_MESSAGES;
  } catch {
    return INITIAL_MESSAGES;
  }
}

function readStoredText(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function createStoryBuildPrompt(
  explicitPrompt: string,
  chatHistory: ChatMessage[],
  storyMemory: string
): string {
  const compactMemory = compactStoryMemoryForPrompt(storyMemory);
  const recentDiscussion = chatHistory
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-16)
    .map((message) =>
      `${message.role === "user" ? "User" : "Assistant"}: ${message.text.slice(0, 900)}`
    )
    .join("\n\n")
    .trim();

  return [
    explicitPrompt
      ? `LATEST BUILD INSTRUCTION:\n${explicitPrompt}`
      : "LATEST BUILD INSTRUCTION:\nBuild the project from the story we discussed in the chat.",
    compactMemory
      ? `PERSISTENT STORY MEMORY TO FOLLOW STRICTLY:\n${compactMemory}`
      : "",
    recentDiscussion
      ? `RECENT STORY DISCUSSION TO FOLLOW STRICTLY:\n${recentDiscussion}`
      : "",
    "IMPORTANT: Use the persistent story memory and recent discussion as the creative brief. Do not ignore names, premise, tone, character traits, plot constraints, or decisions agreed in chat."
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function createProjectEditPrompt(
  explicitPrompt: string,
  chatHistory: ChatMessage[],
  storyMemory: string
): string {
  const compactMemory = compactStoryMemoryForPrompt(storyMemory);
  const recentDiscussion = chatHistory
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-16)
    .map((message) =>
      `${message.role === "user" ? "User" : "Assistant"}: ${message.text.slice(0, 900)}`
    )
    .join("\n\n")
    .trim();

  return [
    explicitPrompt
      ? `LATEST EDIT INSTRUCTION:\n${explicitPrompt}`
      : "LATEST EDIT INSTRUCTION:\nEdit the current project using the agreed chat context and Story Memory.",
    compactMemory ? `PERSISTENT STORY MEMORY:\n${compactMemory}` : "",
    recentDiscussion ? `RECENT CHAT CONTEXT:\n${recentDiscussion}` : "",
    "IMPORTANT: Modify the existing StoryLife project. Do not create a new unrelated project. Preserve existing scene ids, media paths, layout work, and node positions unless the requested edit truly requires changing them.",
    "Apply only the requested changes and the necessary continuity fixes."
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

function createFinalImagePrompt(prompt: string, styleValue: string, sizeValue: string): string {
  const stylePrompt =
    IMAGE_STYLE_OPTIONS.find((option) => option.value === styleValue)?.prompt ?? "";
  const sizePrompt =
    IMAGE_SIZE_OPTIONS.find((option) => option.value === sizeValue)?.prompt ?? "";

  return [
    prompt.trim(),
    stylePrompt,
    sizePrompt
  ]
    .filter(Boolean)
    .join("\n\n");
}

function normalizeStoryStyleIds(storyStyles: unknown): string[] {
  const validStyleIds = new Set(STORY_STYLE_OPTIONS.map((option) => option.id));
  const styles = Array.isArray(storyStyles)
    ? storyStyles.filter(
        (styleId): styleId is string =>
          typeof styleId === "string" && validStyleIds.has(styleId)
      )
    : [];
  const uniqueStyles = Array.from(new Set(styles)).slice(0, 3);
  return uniqueStyles.length > 0 ? uniqueStyles : DEFAULT_STORY_STYLE_IDS;
}

function createStoryStylePrompt(storyStyles: string[]): string {
  const selectedOptions = normalizeStoryStyleIds(storyStyles)
    .map((styleId) => STORY_STYLE_OPTIONS.find((option) => option.id === styleId))
    .filter((option): option is (typeof STORY_STYLE_OPTIONS)[number] => Boolean(option));

  return [
    GLOBAL_STORY_STYLE_RULES,
    "Selected story styles:",
    ...selectedOptions.map((option) => `- ${option.label}: ${option.prompt}`),
    "If multiple styles are selected, combine them carefully. Do not let one style erase the others."
  ].join("\n");
}

function compactStoryMemoryForPrompt(storyMemory: string): string {
  const memory = storyMemory.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (looksLikeProjectJsonDump(memory)) {
    return "";
  }
  return memory.length > 6500 ? memory.slice(0, 6500) : memory;
}

function looksLikeProjectJsonDump(value: string): boolean {
  const idMatches = value.match(/"id"\s*:/g)?.length ?? 0;
  const choiceMatches = value.match(/"choices"\s*:/g)?.length ?? 0;
  return (
    value.includes('"scenes"') ||
    value.includes('"targetNodeId"') ||
    idMatches > 8 ||
    choiceMatches > 3
  );
}

function isDiscussionOnlyRequest(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  const discussionMarkers = [
    "обсуд",
    "поговор",
    "давай обсудим",
    "сначала обсуд",
    "сначала поговор",
    "не создавай",
    "не строй",
    "не генерируй",
    "не делай проект",
    "не создавай проект",
    "не создавай пока",
    "пока не создавай",
    "пока без проекта",
    "без проекта",
    "не надо проект",
    "не начинай",
    "не запускай",
    "только обсуд",
    "просто обсуд",
    "давай подумаем",
    "давай сначала",
    "discuss",
    "brainstorm",
    "talk about",
    "do not create",
    "don't create",
    "dont create",
    "do not build",
    "don't build",
    "dont build",
    "do not generate",
    "don't generate",
    "dont generate",
    "no project yet",
    "just discuss",
    "only discuss"
  ];

  return discussionMarkers.some((marker) => normalizedMessage.includes(marker));
}

function isProjectEditRequest(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  if (isDiscussionOnlyRequest(message)) {
    return false;
  }
  const editMarkers = [
    "подредакт",
    "подкоррект",
    "скоррект",
    "исправ",
    "поправ",
    "улучш",
    "доработ",
    "измени",
    "изменить",
    "поменяй",
    "перепиши",
    "переработ",
    "сделай лучше",
    "логичнее",
    "связнее",
    "не с нуля",
    "текущ",
    "эту историю",
    "этот проект",
    "эти сцены",
    "эту сцену",
    "edit",
    "fix",
    "correct",
    "improve",
    "revise",
    "rewrite",
    "update current",
    "current project",
    "this story",
    "existing story"
  ];
  const projectMarkers = [
    "истори",
    "сюжет",
    "проект",
    "сцен",
    "выбор",
    "ветк",
    "флаг",
    "нод",
    "story",
    "plot",
    "project",
    "scene",
    "choice",
    "branch",
    "flag",
    "node"
  ];

  return (
    editMarkers.some((marker) => normalizedMessage.includes(marker)) &&
    projectMarkers.some((marker) => normalizedMessage.includes(marker))
  );
}

function isProjectGenerationRequest(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  if (isDiscussionOnlyRequest(message)) {
    return false;
  }
  if (isProjectEditRequest(message)) {
    return false;
  }
  const actionMarkers = [
    "\u043d\u0430\u043f\u0438\u0448\u0438",
    "\u0441\u0434\u0435\u043b\u0430\u0439",
    "\u0441\u043e\u0437\u0434\u0430\u0439",
    "\u0441\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u0443\u0439",
    "\u043f\u0440\u0438\u0434\u0443\u043c\u0430\u0439",
    "\u043f\u043e\u0441\u0442\u0440\u043e\u0439",
    "\u0441\u043e\u0431\u0435\u0440\u0438",
    "write",
    "make",
    "create",
    "generate",
    "build"
  ];
  const directMarkers = [
    "\u0441\u0434\u0435\u043b\u0430\u0439 \u043f\u0440\u043e\u0435\u043a\u0442",
    "\u0441\u043e\u0437\u0434\u0430\u0439 \u043f\u0440\u043e\u0435\u043a\u0442",
    "\u0441\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u0443\u0439 \u043f\u0440\u043e\u0435\u043a\u0442",
    "\u0441\u0434\u0435\u043b\u0430\u0439 \u0438\u0441\u0442\u043e\u0440\u0438\u044e",
    "\u0441\u043e\u0437\u0434\u0430\u0439 \u0438\u0441\u0442\u043e\u0440\u0438\u044e",
    "\u0441\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u0443\u0439 \u0438\u0441\u0442\u043e\u0440\u0438\u044e",
    "\u043d\u0430\u043f\u0438\u0448\u0438 \u0438\u0441\u0442\u043e\u0440\u0438\u044e",
    "\u0441\u0434\u0435\u043b\u0430\u0439 \u0441\u044e\u0436\u0435\u0442",
    "\u0441\u043e\u0437\u0434\u0430\u0439 \u0441\u044e\u0436\u0435\u0442",
    "\u0441\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u0443\u0439 \u0441\u044e\u0436\u0435\u0442",
    "\u0441\u0434\u0435\u043b\u0430\u0439 \u0438\u0433\u0440\u0443",
    "\u0441\u043e\u0437\u0434\u0430\u0439 \u0438\u0433\u0440\u0443",
    "\u0441\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u0443\u0439 \u0438\u0433\u0440\u0443",
    "\u043f\u043e\u0441\u0442\u0440\u043e\u0439 \u0432\u0435\u0442\u043a\u0443",
    "\u043f\u043e\u0441\u0442\u0440\u043e\u0439 \u0434\u0435\u0440\u0435\u0432\u043e",
    "make project",
    "create project",
    "generate project",
    "make story",
    "create story",
    "generate story",
    "write story",
    "make plot",
    "create plot",
    "make game",
    "create game",
    "generate game"
  ];
  const longRequestMarkers = [
    "\u0438\u0441\u0442\u043e\u0440\u0438",
    "\u0441\u044e\u0436\u0435\u0442",
    "\u0441\u0446\u0435\u043d",
    "\u0432\u044b\u0431\u043e\u0440",
    "\u0432\u0435\u0442\u043a",
    "\u043a\u043e\u043d\u0446\u043e\u0432",
    "\u0444\u043b\u0430\u0433",
    "\u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440",
    "\u043d\u043e\u0434",
    "\u0434\u0435\u0440\u0435\u0432",
    "\u043f\u0438\u043b\u043e\u0442",
    "\u0442\u0440\u0438\u043b\u043b\u0435\u0440",
    "story",
    "plot",
    "scene",
    "choice",
    "ending",
    "flag",
    "node",
    "tree",
    "branch",
    "thriller",
    "pilot"
  ];
  const hasAction = actionMarkers.some((marker) => normalizedMessage.includes(marker));
  const matchedContentMarkers = longRequestMarkers.filter((marker) =>
    normalizedMessage.includes(marker)
  ).length;

  return (
    directMarkers.some((marker) => normalizedMessage.includes(marker)) ||
    (message.length > 25 && hasAction && matchedContentMarkers > 0) ||
    (message.length > 55 && matchedContentMarkers >= 2) ||
    (message.length > 120 &&
      longRequestMarkers.some((marker) => normalizedMessage.includes(marker)))
  );
}

function createRequestId(): string {
  return `ai_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getStageLabel(stage: AIStage): string {
  const labels: Record<AIStage, string> = {
    idle: "Ready",
    sending: "Sending",
    thinking: "AI thinking",
    writing: "AI writing",
    building: "Building project",
    drawing: "Loading project",
    done: "Done",
    stopped: "Stopped",
    error: "Error"
  };
  return labels[stage];
}

function getStageDescription(stage: AIStage): string {
  const descriptions: Record<AIStage, string> = {
    idle: "Waiting for your command.",
    sending: "Sending request to OpenAI.",
    thinking: "Waiting for AI response.",
    writing: "Receiving project JSON from OpenAI.",
    building: "Validating project JSON.",
    drawing: "Adding the checked project to the canvas.",
    done: "Finished.",
    stopped: "Work stopped.",
    error: "Generation stopped before completion. The exact reason is shown in the latest message."
  };
  return descriptions[stage];
}

function getErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown AI error";
  if (message.toLowerCase().includes("something went wrong")) {
    return [
      "The remote AI request ended without a usable response.",
      "The app will retry the current small planning or writing block automatically when possible."
    ].join(" ");
  }
  return message;
}
