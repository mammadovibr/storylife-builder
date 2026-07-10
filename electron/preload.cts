import { contextBridge, ipcRenderer } from "electron";

type SaveProjectResult =
  | { canceled: true }
  | { canceled: false; filePath: string };

type LoadProjectResult =
  | { canceled: true }
  | { canceled: false; filePath: string; contents: string };

type SelectImageResult =
  | { canceled: true }
  | { canceled: false; filePath: string };

type SelectAudioResult =
  | { canceled: true }
  | { canceled: false; filePath: string };

type ImagePreviewResult =
  | { ok: true; dataUrl: string }
  | { ok: false };

type SelectMediaFolderResult =
  | { canceled: true }
  | {
      canceled: false;
      folder: {
        id: string;
        name: string;
        path: string;
        assets: Array<{
          id: string;
          name: string;
          path: string;
          type: "image" | "audio";
        }>;
      };
    };

type ExportGameResult =
  | { canceled: true }
  | { canceled: false; exportPath: string };

interface AISettingsResult {
  model: string;
  hasApiKey: boolean;
}

type AITextResult = { ok: true; answer: string };

type AIProjectResult = { ok: true; projectJson: string };

type AIImageResult = { ok: true; filePath: string };

contextBridge.exposeInMainWorld("storyLife", {
  saveProject: (projectJson: string): Promise<SaveProjectResult> =>
    ipcRenderer.invoke("project:save", projectJson),
  loadProject: (): Promise<LoadProjectResult> =>
    ipcRenderer.invoke("project:load"),
  selectImage: (): Promise<SelectImageResult> =>
    ipcRenderer.invoke("image:select"),
  readImagePreview: (imagePath: string): Promise<ImagePreviewResult> =>
    ipcRenderer.invoke("image:preview", imagePath),
  selectAudio: (): Promise<SelectAudioResult> =>
    ipcRenderer.invoke("audio:select"),
  selectMediaFolder: (): Promise<SelectMediaFolderResult> =>
    ipcRenderer.invoke("media:selectFolder"),
  exportGame: (projectJson: string): Promise<ExportGameResult> =>
    ipcRenderer.invoke("game:export", projectJson),
  getAISettings: (): Promise<AISettingsResult> =>
    ipcRenderer.invoke("ai:getSettings"),
  saveAISettings: (settings: {
    apiKey?: string;
    model?: string;
  }): Promise<AISettingsResult & { ok: true }> =>
    ipcRenderer.invoke("ai:saveSettings", settings),
  aiChat: (payload: {
    message: string;
    projectJson: string;
    selectedSceneId: string | null;
    storyMemory?: string;
    chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
    requestId?: string;
  }): Promise<AITextResult> => ipcRenderer.invoke("ai:chat", payload),
  aiUpdateStoryMemory: (payload: {
    currentMemory: string;
    userMessage: string;
    assistantAnswer: string;
    chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
  }): Promise<{ ok: true; memoryText: string }> =>
    ipcRenderer.invoke("ai:updateStoryMemory", payload),
  aiGenerateProject: (payload: {
    storyText: string;
    currentProjectJson: string;
    storyMemory?: string;
    chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
    stylePrompt?: string;
    requestId?: string;
  }): Promise<AIProjectResult> => ipcRenderer.invoke("ai:generateProject", payload),
  aiPlanStory: (payload: {
    storyText: string;
    targetSceneCount: number | null;
    storyMemory?: string;
    chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
    stylePrompt?: string;
    requestId?: string;
  }): Promise<{ ok: true; planText: string }> =>
    ipcRenderer.invoke("ai:planStory", payload),
  aiPlanStoryArchitecture: (payload: {
    storyText: string;
    targetSceneCount: number;
    storyMemory?: string;
    chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
    stylePrompt?: string;
    correctionProblems?: string[];
    requestId?: string;
  }): Promise<{ ok: true; architectureText: string }> =>
    ipcRenderer.invoke("ai:planStoryArchitecture", payload),
  aiPlanStoryChunk: (payload: {
    storyText: string;
    targetSceneCount: number;
    architectureJson: string;
    approvedBlueprintJson: string;
    requiredSceneKeys: string[];
    correctionProblems?: string[];
    stylePrompt?: string;
    requestId?: string;
  }): Promise<{ ok: true; chunkText: string }> =>
    ipcRenderer.invoke("ai:planStoryChunk", payload),
  aiReviewStoryChunk: (payload: {
    architectureJson: string;
    approvedBlueprintJson: string;
    chunkJson: string;
    storyRequest: string;
    requestId?: string;
  }): Promise<{
    ok: true;
    review: { passes: boolean; problems: string[]; rewriteInstruction: string };
  }> => ipcRenderer.invoke("ai:reviewStoryChunk", payload),
  aiReviewStoryBlueprint: (payload: {
    blueprintJson: string;
    storyRequest: string;
    requestId?: string;
  }): Promise<{
    ok: true;
    review: { passes: boolean; problems: string[]; rewriteInstruction: string };
  }> => ipcRenderer.invoke("ai:reviewStoryBlueprint", payload),
  aiAnalyzeStoryLogic: (payload: {
    projectJson: string;
    requestId?: string;
  }): Promise<{ ok: true; reportText: string }> =>
    ipcRenderer.invoke("ai:analyzeStoryLogic", payload),
  aiValidateProjectDraft: (payload: {
    projectJson: string;
    storyRequest?: string;
    storyPlan?: string;
    memoryLibrary?: string;
    requestId?: string;
  }): Promise<{ ok: true; passes: boolean; score: number; problems: string[] }> =>
    ipcRenderer.invoke("ai:validateProjectDraft", payload),
  aiReviewStoryBlock: (payload: {
    storyPlan: string;
    projectJson: string;
    sceneIds: string[];
    requestId?: string;
  }): Promise<{
    ok: true;
    review: { passes: boolean; problems: string[]; rewriteInstruction: string };
  }> => ipcRenderer.invoke("ai:reviewStoryBlock", payload),
  aiExpandProjectChunk: (payload: {
    storyText: string;
    projectJson: string;
    targetSceneCount: number;
    batchSize: number;
    requiredSceneIds?: string[];
    blueprintChunkJson?: string;
    stylePrompt?: string;
    memoryLibrary?: string;
    requestId?: string;
  }): Promise<{ ok: true; patchJson: string }> =>
    ipcRenderer.invoke("ai:expandProjectChunk", payload),
  aiEditProject: (payload: {
    instruction: string;
    projectJson: string;
    storyMemory?: string;
    requestId?: string;
  }): Promise<{ ok: true; patchJson: string }> =>
    ipcRenderer.invoke("ai:editProject", payload),
  onAIProjectProgress: (
    requestId: string,
    callback: (payload: {
      requestId: string;
      delta?: string;
      status?: string;
      eventCount?: number;
      receivedChars?: number;
    }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: {
        requestId: string;
        delta?: string;
        status?: string;
        eventCount?: number;
        receivedChars?: number;
      }
    ) => {
      if (payload.requestId === requestId) {
        callback(payload);
      }
    };
    ipcRenderer.on("ai:projectProgress", handler);
    return () => ipcRenderer.removeListener("ai:projectProgress", handler);
  },
  aiGenerateSceneImage: (payload: {
    sceneJson: string;
    prompt: string;
    referenceImagePaths?: string[];
    imageModel?: string;
    imageSize?: string;
  }): Promise<AIImageResult> => ipcRenderer.invoke("ai:generateSceneImage", payload),
  aiCancel: (requestId: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke("ai:cancel", requestId)
});
