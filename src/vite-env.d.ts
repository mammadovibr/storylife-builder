/// <reference types="vite/client" />

type SaveProjectResult =
  | { canceled: true }
  | { canceled: false; filePath: string; verified: true; byteSize: number };

type LoadProjectResult =
  | { canceled: true }
  | { canceled: false; filePath: string; contents: string; canOverwrite: boolean };

interface SaveProjectOptions {
  filePath?: string;
  suggestedName?: string;
  saveAs?: boolean;
}

type SelectImageResult =
  | { canceled: true }
  | { canceled: false; filePath: string; mediaType: "image" | "video" };

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
          type: "image" | "video" | "audio";
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

interface Window {
  storyLife?: {
    confirmClose(): Promise<{ ok: boolean }>;
    onCloseRequested(callback: () => void): () => void;
    saveProject(
      projectJson: string,
      options?: SaveProjectOptions
    ): Promise<SaveProjectResult>;
    loadProject(): Promise<LoadProjectResult>;
    selectImage(): Promise<SelectImageResult>;
    getMediaUrl(mediaPath: string): string;
    readImagePreview(imagePath: string): Promise<ImagePreviewResult>;
    savePicture(
      imagePath: string,
      suggestedName: string
    ): Promise<{ canceled: true } | { canceled: false; filePath: string }>;
    selectAudio(): Promise<SelectAudioResult>;
    selectMediaFolder(): Promise<SelectMediaFolderResult>;
    exportGame(projectJson: string): Promise<ExportGameResult>;
    getAISettings(): Promise<AISettingsResult>;
    saveAISettings(settings: {
      apiKey?: string;
      model?: string;
    }): Promise<AISettingsResult & { ok: true }>;
    aiChat(payload: {
      message: string;
      projectJson: string;
      selectedSceneId: string | null;
      storyMemory?: string;
      chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
      requestId?: string;
    }): Promise<AITextResult>;
    aiUpdateStoryMemory(payload: {
      currentMemory: string;
      userMessage: string;
      assistantAnswer: string;
      chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
    }): Promise<{ ok: true; memoryText: string }>;
    aiGenerateProject(payload: {
      storyText: string;
      currentProjectJson: string;
      storyMemory?: string;
      chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
      stylePrompt?: string;
      requestId?: string;
    }): Promise<AIProjectResult>;
    aiPlanStory(payload: {
      storyText: string;
      targetSceneCount: number | null;
      storyMemory?: string;
      chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
      stylePrompt?: string;
      requestId?: string;
    }): Promise<{ ok: true; planText: string }>;
    aiPlanStoryArchitecture(payload: {
      storyText: string;
      targetSceneCount: number;
      storyMemory?: string;
      chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
      stylePrompt?: string;
      correctionProblems?: string[];
      requestId?: string;
    }): Promise<{ ok: true; architectureText: string }>;
    aiPlanStoryChunk(payload: {
      storyText: string;
      targetSceneCount: number;
      architectureJson: string;
      approvedBlueprintJson: string;
      requiredSceneKeys: string[];
      correctionProblems?: string[];
      stylePrompt?: string;
      requestId?: string;
    }): Promise<{ ok: true; chunkText: string }>;
    aiReviewStoryChunk(payload: {
      architectureJson: string;
      approvedBlueprintJson: string;
      chunkJson: string;
      storyRequest: string;
      requestId?: string;
    }): Promise<{
      ok: true;
      review: { passes: boolean; problems: string[]; rewriteInstruction: string };
    }>;
    aiReviewStoryBlueprint(payload: {
      blueprintJson: string;
      storyRequest: string;
      requestId?: string;
    }): Promise<{
      ok: true;
      review: { passes: boolean; problems: string[]; rewriteInstruction: string };
    }>;
    aiAnalyzeStoryLogic(payload: {
      projectJson: string;
      requestId?: string;
    }): Promise<{ ok: true; reportText: string }>;
    aiValidateProjectDraft(payload: {
      projectJson: string;
      storyRequest?: string;
      storyPlan?: string;
      memoryLibrary?: string;
      requestId?: string;
    }): Promise<{ ok: true; passes: boolean; score: number; problems: string[] }>;
    aiReviewStoryBlock(payload: {
      storyPlan: string;
      projectJson: string;
      sceneIds: string[];
      requestId?: string;
    }): Promise<{
      ok: true;
      review: { passes: boolean; problems: string[]; rewriteInstruction: string };
    }>;
    aiExpandProjectChunk(payload: {
      storyText: string;
      projectJson: string;
      targetSceneCount: number;
      batchSize: number;
      requiredSceneIds?: string[];
      blueprintChunkJson?: string;
      stylePrompt?: string;
      memoryLibrary?: string;
      requestId?: string;
    }): Promise<{ ok: true; patchJson: string }>;
    aiEditProject(payload: {
      instruction: string;
      projectJson: string;
      storyMemory?: string;
      requestId?: string;
    }): Promise<{ ok: true; patchJson: string }>;
    onAIProjectProgress(
      requestId: string,
      callback: (payload: {
        requestId: string;
        delta?: string;
        status?: string;
        eventCount?: number;
        receivedChars?: number;
      }) => void
    ): () => void;
    aiGenerateSceneImage(payload: {
      prompt: string;
      referenceImagePaths?: string[];
      imageModel?: string;
      imageSize?: string;
      imageQuality?: "low" | "medium" | "high";
      preserveReferenceCanvas?: boolean;
      requestId?: string;
    }): Promise<AIImageResult>;
    aiCancel(requestId: string): Promise<{ ok: true }>;
  };
}
