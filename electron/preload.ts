import { contextBridge, ipcRenderer } from "electron";

export type SaveProjectResult =
  | { canceled: true }
  | { canceled: false; filePath: string; verified: true; byteSize: number };

export type LoadProjectResult =
  | { canceled: true }
  | { canceled: false; filePath: string; contents: string; canOverwrite: boolean };

export interface SaveProjectOptions {
  filePath?: string;
  suggestedName?: string;
  saveAs?: boolean;
}

export type SelectImageResult =
  | { canceled: true }
  | { canceled: false; filePath: string; mediaType: "image" | "video" };

export type SelectAudioResult =
  | { canceled: true }
  | { canceled: false; filePath: string };

export type ImagePreviewResult =
  | { ok: true; dataUrl: string }
  | { ok: false };

export type SelectMediaFolderResult =
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
          type: "image" | "video" | "audio";
        }>;
      };
    };

export type ExportGameResult =
  | { canceled: true }
  | { canceled: false; exportPath: string };

export interface AISettingsResult {
  model: string;
  hasApiKey: boolean;
}

export type AITextResult = { ok: true; answer: string };

export type AIProjectResult = { ok: true; projectJson: string };

export type AIImageResult = { ok: true; filePath: string };

export interface GeneratedImageStorageInfo {
  folderPath: string;
  fileCount: number;
  totalBytes: number;
}

contextBridge.exposeInMainWorld("storyLife", {
  confirmClose: (): Promise<{ ok: boolean }> => ipcRenderer.invoke("app:confirmClose"),
  onCloseRequested: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on("app:closeRequested", listener);
    return () => ipcRenderer.removeListener("app:closeRequested", listener);
  },
  saveProject: (
    projectJson: string,
    options?: SaveProjectOptions
  ): Promise<SaveProjectResult> =>
    ipcRenderer.invoke("project:save", projectJson, options),
  loadProject: (): Promise<LoadProjectResult> =>
    ipcRenderer.invoke("project:load"),
  selectImage: (): Promise<SelectImageResult> =>
    ipcRenderer.invoke("image:select"),
  getMediaUrl: (mediaPath: string): string =>
    `storylife-media://local/${encodeURIComponent(mediaPath.trim())}`,
  readImagePreview: (imagePath: string): Promise<ImagePreviewResult> =>
    ipcRenderer.invoke("image:preview", imagePath),
  savePicture: (
    imagePath: string,
    suggestedName: string
  ): Promise<{ canceled: true } | { canceled: false; filePath: string }> =>
    ipcRenderer.invoke("image:saveCopy", imagePath, suggestedName),
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
    prompt: string;
    referenceImagePaths?: string[];
    imageModel?: string;
    imageSize?: string;
    imageQuality?: "low" | "medium" | "high";
    preserveReferenceCanvas?: boolean;
    requestId?: string;
  }): Promise<AIImageResult> => ipcRenderer.invoke("ai:generateSceneImage", payload),
  getGeneratedImageStorageInfo: (): Promise<GeneratedImageStorageInfo> =>
    ipcRenderer.invoke("ai:getGeneratedImageStorageInfo"),
  openGeneratedImageFolder: (): Promise<{ ok: true }> =>
    ipcRenderer.invoke("ai:openGeneratedImageFolder"),
  deleteGeneratedImage: (payload: {
    filePath: string;
    retainedPaths?: string[];
  }): Promise<{ deleted: boolean; reason?: string }> =>
    ipcRenderer.invoke("ai:deleteGeneratedImage", payload),
  cleanupGeneratedImages: (
    retainedPaths: string[]
  ): Promise<{
    deletedCount: number;
    deletedBytes: number;
    storage: GeneratedImageStorageInfo;
  }> => ipcRenderer.invoke("ai:cleanupGeneratedImages", retainedPaths),
  aiCancel: (requestId: string): Promise<{ ok: true }> =>
    ipcRenderer.invoke("ai:cancel", requestId)
});
