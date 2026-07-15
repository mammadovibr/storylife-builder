import electron from "electron";
import type { OpenDialogOptions } from "electron";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { access, copyFile, mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import isDev from "electron-is-dev";
import {
  createStoryLifeArchive,
  isStoryLifeArchive,
  readStoryLifeArchive
} from "./projectArchive.js";
import { CAPY_3_STORY_REFERENCE } from "./storyReferenceLibrary.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const { app, BrowserWindow, dialog, ipcMain, nativeImage, protocol, shell } = electron;
const LOCAL_MEDIA_SCHEME = "storylife-media";
const remoteDebuggingPort = process.env.STORYLIFE_REMOTE_DEBUGGING_PORT;
const smokeResultPath = process.env.STORYLIFE_SMOKE_RESULT;
const DEFAULT_AI_MODEL = "gpt-5.4";
const activeAIRequests = new Map<string, AbortController>();
const closeApprovedWindowIds = new Set<number>();
let isApplicationQuitting = false;
let desktopMediaCacheRoot = "";

if (remoteDebuggingPort) {
  app.commandLine.appendSwitch("remote-debugging-port", remoteDebuggingPort);
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: LOCAL_MEDIA_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true
    }
  }
]);

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    show: !smokeResultPath,
    title: "StoryLife Builder",
    backgroundColor: "#f6f3ec",
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    void mainWindow.loadURL(process.env.STORYLIFE_DEV_URL || "http://127.0.0.1:5173");
  } else {
    void mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("close", (event) => {
    if (isApplicationQuitting || closeApprovedWindowIds.has(mainWindow.id)) {
      return;
    }
    event.preventDefault();
    mainWindow.webContents.send("app:closeRequested");
  });

  mainWindow.on("closed", () => {
    closeApprovedWindowIds.delete(mainWindow.id);
  });

  if (smokeResultPath) {
    mainWindow.webContents.once("did-finish-load", async () => {
      try {
        const result = await mainWindow.webContents.executeJavaScript(`
          (async () => {
            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const clickButton = (text) => {
              const button = [...document.querySelectorAll("button")].find((item) =>
                item.textContent.trim().includes(text)
              );
              if (!button) return false;
              button.click();
              return true;
            };
            const setNativeValue = (element, value) => {
              const prototype =
                element instanceof HTMLTextAreaElement
                  ? HTMLTextAreaElement.prototype
                  : HTMLInputElement.prototype;
              const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
              setter.call(element, value);
              element.dispatchEvent(new Event("input", { bubbles: true }));
              element.dispatchEvent(new Event("change", { bubbles: true }));
            };
            const findFieldByLabel = (labelText, selector) => {
              const labels = [...document.querySelectorAll("label")];
              const label = labels.find((item) =>
                item.textContent.trim().startsWith(labelText)
              );
              return label ? label.querySelector(selector) : null;
            };
            await wait(200);
            const text = document.body.innerText;
            const streamingMediaUrl = window.storyLife?.getMediaUrl(
              ${JSON.stringify(join(process.cwd(), "public/icons/storylife-180.png"))}
            );
            const streamingMediaResponse = streamingMediaUrl
              ? await fetch(streamingMediaUrl).catch(() => null)
              : null;
            const streamingMediaBytes = streamingMediaResponse?.ok
              ? (await streamingMediaResponse.arrayBuffer()).byteLength
              : 0;
            const streamingRangeResponse = streamingMediaUrl
              ? await fetch(streamingMediaUrl, {
                  headers: { Range: "bytes=0-31" }
                }).catch(() => null)
              : null;
            const streamingRangeBytes = streamingRangeResponse?.ok
              ? (await streamingRangeResponse.arrayBuffer()).byteLength
              : 0;
            const inspectorMenusInitiallyCollapsed =
              document.querySelectorAll(".inspector-collapsible .collapse-body").length === 0 &&
              !document.querySelector(".scene-image-section");
            const sceneMediaMenuClicked = clickButton("Scene Picture / Video");
            await wait(50);
            const canOpenSceneMediaMenu = Boolean(
              document.querySelector(".scene-image-section")
            );
            const sceneMediaPathInput = document.querySelector(
              ".scene-image-section input:not(.hidden-file-input)"
            );
            if (sceneMediaPathInput) {
              setNativeValue(
                sceneMediaPathInput,
                ${JSON.stringify(join(process.cwd(), "public/icons/storylife-180.png"))}
              );
              await wait(100);
            }
            clickButton("Scene Picture / Video");
            const titleInput = findFieldByLabel("Title", "input");
            const sceneTextArea = findFieldByLabel("Text", "textarea");
            if (titleInput) setNativeValue(titleInput, "Smoke Scene Title");
            if (sceneTextArea) setNativeValue(sceneTextArea, "Smoke scene text typed into inspector.");
            await wait(100);
            const addChoiceClicked = clickButton("Choice + Scene");
            await wait(150);
            let choiceInput = findFieldByLabel("Choice text", "textarea, input");
            if (!choiceInput) {
              clickButton("Choice 1");
              await wait(100);
              choiceInput = findFieldByLabel("Choice text", "textarea, input");
            }
            if (choiceInput) setNativeValue(choiceInput, "Smoke choice text");
            await wait(100);
            const sceneLayoutClicked = clickButton("Scene Layout");
            await wait(150);
            const sceneLayoutOpened = Boolean(document.querySelector(".scene-preview-modal"));
            const choicesTargetButton = [...document.querySelectorAll(
              ".scene-layout-target-tabs button"
            )].find((button) => button.textContent.trim() === "Choices");
            if (choicesTargetButton instanceof HTMLButtonElement) choicesTargetButton.click();
            await wait(50);
            const choiceFrameDetails = document.querySelector(".choice-frame-details");
            if (choiceFrameDetails instanceof HTMLDetailsElement) choiceFrameDetails.open = true;
            const firstCraftedFrame = document.querySelector(
              '.choice-frame-option[aria-label="Parchment Gold"]'
            );
            if (firstCraftedFrame instanceof HTMLButtonElement) firstCraftedFrame.click();
            await wait(50);
            const styledChoiceFrame = document.querySelector(".choice-preview-frame");
            const styledChoiceFrameBackground = styledChoiceFrame
              ? getComputedStyle(styledChoiceFrame).backgroundImage
              : "";
            const nativeChoiceFrameWorks =
              Boolean(firstCraftedFrame) &&
              styledChoiceFrameBackground.includes("linear-gradient") &&
              !styledChoiceFrameBackground.includes("url(");
            const nextSceneButton = document.querySelector(
              '.scene-layout-scene-nav-button[aria-label="Next scene"]'
            );
            if (nextSceneButton instanceof HTMLButtonElement) nextSceneButton.click();
            await wait(150);
            const sceneLayoutStaysOpenAfterNext =
              Boolean(document.querySelector(".scene-preview-modal")) &&
              document.querySelector(".scene-layout-scene-position")?.textContent.trim() === "2 / 2";
            const layoutTitleInput = document.querySelector(".scene-preview-title-input");
            if (layoutTitleInput) setNativeValue(layoutTitleInput, "Smoke Layout Title");
            clickButton("Close");
            await wait(100);
            clickButton("Menu");
            await wait(50);
            const aiAssistantClicked = clickButton("Image Studio");
            await wait(150);
            const imageStudioLauncherClicked = clickButton("Open Image Studio");
            await wait(200);
            const imageStudioOpened = Boolean(document.querySelector(".ai-image-studio-modal"));
            const imageVariantCount = document.querySelectorAll(".ai-image-variant-card").length;
            const animateButton = [...document.querySelectorAll(".ai-image-studio-modal button")]
              .find((button) => button.textContent.trim() === "Animate");
            if (animateButton instanceof HTMLButtonElement) animateButton.click();
            await wait(150);
            const proceduralAnimationOpened = Boolean(document.querySelector(".image-animation-modal"));
            const proceduralPresetCount = document.querySelectorAll(
              '.image-animation-modal label:first-of-type option'
            ).length;
            const applyAnimationButton = [...document.querySelectorAll(".image-animation-modal button")]
              .find((button) => button.textContent.trim() === "Apply");
            if (applyAnimationButton instanceof HTMLButtonElement) applyAnimationButton.click();
            await wait(150);
            const showOriginalButton = [...document.querySelectorAll(".ai-image-studio-modal button")]
              .find((button) => button.textContent.trim() === "Show Original");
            if (showOriginalButton instanceof HTMLButtonElement) showOriginalButton.click();
            await wait(100);
            const useAnimationButton = [...document.querySelectorAll(".ai-image-studio-modal button")]
              .find((button) => button.textContent.trim() === "Use Animation");
            if (useAnimationButton instanceof HTMLButtonElement) useAnimationButton.click();
            await wait(100);
            const animationCanBeRestored = [...document.querySelectorAll(".ai-image-studio-modal button")]
              .some((button) => button.textContent.trim() === "Show Original");
            const generationQualitySelect = findFieldByLabel("Generation quality", "select");
            const animateWithAIButton = [...document.querySelectorAll(".ai-image-studio-modal button")]
              .find((button) => button.textContent.trim() === "Animate with AI");
            if (animateWithAIButton instanceof HTMLButtonElement) animateWithAIButton.click();
            await wait(150);
            const aiFrameEditorOpened = Boolean(document.querySelector(".image-animation-modal"));
            const frameCountRange = findFieldByLabel("Number of Frames", 'input[type="range"]');
            const aiFrameLimitIsTwelve =
              frameCountRange instanceof HTMLInputElement && frameCountRange.max === "12";
            const cancelAnimationButton = [...document.querySelectorAll(".image-animation-modal button")]
              .find((button) => button.textContent.trim() === "Cancel");
            if (cancelAnimationButton instanceof HTMLButtonElement) cancelAnimationButton.click();
            await wait(50);
            const aiApiKeyInput = findFieldByLabel("API key", "input");
            const aiModelInput = findFieldByLabel("Model", "input");
            const aiPanel = document.querySelector(".ai-drawer, .ai-assistant-modal");
            const aiTextareas = aiPanel ? [...aiPanel.querySelectorAll("textarea")] : [];
            const aiChatInput = aiTextareas[0];
            const aiStoryInput = aiTextareas[1];
            const aiImageInput = aiTextareas[aiTextareas.length - 1];
            if (aiApiKeyInput) setNativeValue(aiApiKeyInput, "smoke-api-key");
            if (aiModelInput) setNativeValue(aiModelInput, "gpt-5.4");
            if (aiChatInput) setNativeValue(aiChatInput, "Smoke AI chat input");
            if (aiStoryInput) setNativeValue(aiStoryInput, "Smoke AI story input");
            if (aiImageInput) setNativeValue(aiImageInput, "Smoke AI image prompt");
            await wait(100);
            return {
              title: document.title,
              bodyText: text,
              hasRoot: Boolean(document.querySelector("#root")),
              hasToolbar: text.includes("StoryLife Builder") && text.includes("Save Project") && text.includes("Load Project") && text.includes("Play"),
              hasPanels: text.includes("Scenes") && text.includes("Inspector") && text.includes("Add Scene"),
              hasCanvas: Boolean(document.querySelector(".react-flow")),
              hasSceneNode: text.includes("Scene 1"),
              hasStoryLifeBridge: Boolean(window.storyLife),
              canLoadStreamingMedia: streamingMediaBytes > 0,
              canLoadStreamingMediaRange:
                streamingRangeResponse?.status === 206 && streamingRangeBytes === 32,
              inspectorMenusInitiallyCollapsed,
              canOpenSceneMediaMenu: sceneMediaMenuClicked && canOpenSceneMediaMenu,
              canTypeSceneTitle: titleInput && titleInput.value === "Smoke Scene Title",
              canTypeSceneText: sceneTextArea && sceneTextArea.value === "Smoke scene text typed into inspector.",
              canAddChoice: addChoiceClicked && Boolean(choiceInput),
              canTypeChoiceText: choiceInput && choiceInput.value === "Smoke choice text",
              canOpenSceneLayout: sceneLayoutClicked && sceneLayoutOpened,
              nativeChoiceFrameWorks,
              sceneLayoutStaysOpenAfterNext,
              canTypeSceneLayoutTitle: layoutTitleInput && layoutTitleInput.value === "Smoke Layout Title",
              canOpenAIAssistant: aiAssistantClicked && Boolean(document.querySelector(".ai-drawer, .ai-assistant-modal")),
              canOpenImageStudio: imageStudioLauncherClicked && imageStudioOpened,
              imageVariantHistoryWorks: imageVariantCount >= 1,
              proceduralAnimationEditorWorks:
                proceduralAnimationOpened && proceduralPresetCount >= 15,
              animationCanBeRestored,
              aiFrameEditorWorks: aiFrameEditorOpened && aiFrameLimitIsTwelve,
              generationQualityDefaultsLow:
                generationQualitySelect instanceof HTMLSelectElement &&
                generationQualitySelect.value === "low",
              canTypeAIApiKey: aiApiKeyInput && aiApiKeyInput.value === "smoke-api-key",
              canTypeAIModel: aiModelInput && aiModelInput.value === "gpt-5.4",
              canTypeAIChat: aiChatInput && aiChatInput.value === "Smoke AI chat input",
              canTypeAIStory: aiStoryInput && aiStoryInput.value === "Smoke AI story input",
              canTypeAIImagePrompt: aiImageInput && aiImageInput.value === "Smoke AI image prompt",
              errors: []
            };
          })()
        `);
        await writeFile(smokeResultPath, JSON.stringify(result, null, 2), "utf-8");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await writeFile(
          smokeResultPath,
          JSON.stringify({ errors: [message] }, null, 2),
          "utf-8"
        );
      } finally {
        app.quit();
      }
    });
  }
}

app.whenReady().then(async () => {
  desktopMediaCacheRoot = join(app.getPath("userData"), "media-cache");
  await mkdir(desktopMediaCacheRoot, { recursive: true });

  protocol.handle(LOCAL_MEDIA_SCHEME, async (request) => {
    const sourcePath = getLocalMediaPathFromUrl(request.url);
    if (!sourcePath || !isSupportedLocalMediaExtension(extname(sourcePath))) {
      return new Response("Media file not found", { status: 404 });
    }

    try {
      const fileStats = await stat(sourcePath);
      if (!fileStats.isFile()) {
        return new Response("Media file not found", { status: 404 });
      }

      const rangeHeader = request.headers.get("range");
      const byteRange = rangeHeader
        ? parseSingleByteRange(rangeHeader, fileStats.size)
        : null;
      if (rangeHeader && !byteRange) {
        return new Response(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${fileStats.size}` }
        });
      }

      const start = byteRange?.start ?? 0;
      const end = byteRange?.end ?? Math.max(0, fileStats.size - 1);
      const contentLength = fileStats.size === 0 ? 0 : end - start + 1;
      const headers = new Headers({
        "Accept-Ranges": "bytes",
        "Content-Length": String(contentLength),
        "Content-Type": getLocalMediaMimeType(extname(sourcePath))
      });
      if (byteRange) {
        headers.set("Content-Range", `bytes ${start}-${end}/${fileStats.size}`);
      }
      if (request.method === "HEAD" || fileStats.size === 0) {
        return new Response(null, { status: byteRange ? 206 : 200, headers });
      }

      const nodeStream = createReadStream(sourcePath, { start, end });
      return new Response(Readable.toWeb(nodeStream) as ReadableStream, {
        status: byteRange ? 206 : 200,
        headers
      });
    } catch {
      return new Response("Media file not found", { status: 404 });
    }
  });
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  isApplicationQuitting = true;
});

ipcMain.handle("app:confirmClose", (event) => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  if (!parentWindow) {
    return { ok: false as const };
  }
  for (const window of BrowserWindow.getAllWindows()) {
    closeApprovedWindowIds.add(window.id);
  }
  setImmediate(() => {
    isApplicationQuitting = true;
    app.quit();
  });
  return { ok: true as const };
});

ipcMain.handle("project:save", async (
  event,
  projectJson: string,
  options?: { filePath?: string; suggestedName?: string; saveAs?: boolean }
) => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  let filePath = options?.saveAs ? "" : options?.filePath?.trim() ?? "";

  if (!filePath) {
    const dialogOptions = {
      title: options?.saveAs ? "Save StoryLife Project As" : "Save StoryLife Project",
      defaultPath:
        options?.filePath?.trim() ||
        options?.suggestedName?.trim() ||
        "StoryLife Project.storylife",
      filters: [{ name: "Portable StoryLife Project", extensions: ["storylife"] }]
    };
    const result = parentWindow
      ? await dialog.showSaveDialog(parentWindow, dialogOptions)
      : await dialog.showSaveDialog(dialogOptions);

    if (result.canceled || !result.filePath) {
      return { canceled: true as const };
    }
    filePath = result.filePath;
  }

  const archiveBuffer = await createStoryLifeArchive(projectJson);
  await readStoryLifeArchive(archiveBuffer);
  await writeFile(filePath, archiveBuffer);
  const persistedBuffer = await readFile(filePath);
  const expectedHash = createHash("sha256").update(archiveBuffer).digest("hex");
  const persistedHash = createHash("sha256").update(persistedBuffer).digest("hex");
  if (expectedHash !== persistedHash) {
    throw new Error("Project save verification failed. The written file does not match the project archive.");
  }
  await readStoryLifeArchive(persistedBuffer);
  return {
    canceled: false as const,
    filePath,
    verified: true as const,
    byteSize: persistedBuffer.length
  };
});

ipcMain.handle("project:load", async () => {
  const result = await dialog.showOpenDialog({
    title: "Load StoryLife Project",
    properties: ["openFile"],
    filters: [
      { name: "StoryLife Project", extensions: ["storylife", "zip", "json", "txt"] },
      { name: "All Files", extensions: ["*"] }
    ]
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true as const };
  }

  const filePath = result.filePaths[0];
  const fileBuffer = await readFile(filePath);
  const archiveCacheKey = createHash("sha256")
    .update(fileBuffer)
    .digest("hex")
    .slice(0, 24);
  const portableArchive = isStoryLifeArchive(fileBuffer);
  const contents = portableArchive
    ? await readStoryLifeArchive(
        fileBuffer,
        join(desktopMediaCacheRoot, archiveCacheKey)
      )
    : fileBuffer.toString("utf-8");
  return {
    canceled: false as const,
    filePath,
    contents,
    canOverwrite: portableArchive
  };
});

ipcMain.handle("image:select", async (event) => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  const options: OpenDialogOptions = {
    title: "Select Scene Picture or Video",
    properties: ["openFile"],
    filters: [
      {
        name: "Pictures and videos",
        extensions: ["png", "jpg", "jpeg", "webp", "gif", "mp4", "webm", "mov", "m4v"]
      }
    ]
  };
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true as const };
  }

  const filePath = result.filePaths[0];
  return {
    canceled: false as const,
    filePath,
    mediaType: isVideoExtension(extname(filePath)) ? "video" as const : "image" as const
  };
});

ipcMain.handle("image:preview", async (_event, imagePath: string) => {
  const sourcePath = normalizeLocalImagePath(imagePath);
  if (!sourcePath) {
    return { ok: false as const };
  }

  const extension = extname(sourcePath).toLowerCase();
  if (!isPictureExtension(extension) && !isVideoExtension(extension)) {
    return { ok: false as const };
  }

  try {
    const imageBuffer = await readFile(sourcePath);
    return {
      ok: true as const,
      dataUrl: `data:${getVisualMediaMimeType(extension)};base64,${imageBuffer.toString(
        "base64"
      )}`
    };
  } catch {
    return { ok: false as const };
  }
});

ipcMain.handle(
  "image:saveCopy",
  async (event, imagePath: string, suggestedName: string) => {
    const picture = await readPictureForSaving(imagePath);
    const extension = getImageExtension(picture.mimeType);
    const safeBaseName = sanitizeFileName(
      basename(suggestedName, extname(suggestedName)) || "scene-picture"
    );
    const parentWindow = BrowserWindow.fromWebContents(event.sender);
    const options = {
      title: "Save Picture",
      defaultPath: `${safeBaseName}${extension}`,
      filters: [{ name: "Picture", extensions: [extension.slice(1)] }]
    };
    const result = parentWindow
      ? await dialog.showSaveDialog(parentWindow, options)
      : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) {
      return { canceled: true as const };
    }
    await writeFile(result.filePath, picture.buffer);
    return { canceled: false as const, filePath: result.filePath };
  }
);

ipcMain.handle("audio:select", async (event) => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  const options: OpenDialogOptions = {
    title: "Select Audio",
    properties: ["openFile"],
    filters: [
      { name: "Audio", extensions: ["mp3", "wav", "ogg", "m4a", "webm"] }
    ]
  };
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true as const };
  }

  return { canceled: false as const, filePath: result.filePaths[0] };
});

ipcMain.handle("media:selectFolder", async (event) => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  const options: OpenDialogOptions = {
    title: "Add Media Folder",
    properties: ["openDirectory"]
  };
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, options)
    : await dialog.showOpenDialog(options);

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true as const };
  }

  const folderPath = result.filePaths[0];
  const assets = await scanMediaFolder(folderPath);

  return {
    canceled: false as const,
    folder: {
      id: createStableId("media_folder", folderPath),
      name: basename(folderPath),
      path: folderPath,
      assets
    }
  };
});

ipcMain.handle("ai:getSettings", async () => {
  const settings = await readAISettings();
  return {
    model: settings.model,
    hasApiKey: Boolean(settings.apiKey || process.env.OPENAI_API_KEY)
  };
});

ipcMain.handle(
  "ai:saveSettings",
  async (_event, settings: { apiKey?: string; model?: string }) => {
    const currentSettings = await readAISettings();
    const nextSettings = {
      apiKey:
        typeof settings.apiKey === "string" && settings.apiKey.trim() !== ""
          ? settings.apiKey.trim()
          : currentSettings.apiKey,
      model:
        typeof settings.model === "string" && settings.model.trim() !== ""
          ? settings.model.trim()
          : currentSettings.model
    };

    await writeAISettings(nextSettings);
    return {
      ok: true as const,
      model: nextSettings.model,
      hasApiKey: Boolean(nextSettings.apiKey || process.env.OPENAI_API_KEY)
    };
  }
);

ipcMain.handle(
  "ai:chat",
  async (
    _event,
    payload: {
      message: string;
      projectJson: string;
      selectedSceneId: string | null;
      storyMemory?: string;
      chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
      requestId?: string;
    }
  ) => {
    const abortController = createAIAbortController(payload.requestId);
    try {
      if (payload.requestId) {
        _event.sender.send("ai:projectProgress", {
          requestId: payload.requestId,
          status: "Request reached StoryLife desktop app. Sending to OpenAI..."
        });
      }
      const answer = await callOpenAIText({
        systemPrompt: createAssistantSystemPrompt(),
        userPrompt: [
          "Current StoryLife project JSON:",
          payload.projectJson,
          "",
          `Selected scene id: ${payload.selectedSceneId ?? "none"}`,
          "",
          "Persistent story memory:",
          formatStoryMemory(payload.storyMemory),
          "",
          "Recent chat history:",
          formatAIChatHistory(payload.chatHistory),
          "",
          "User message:",
          payload.message
        ].join("\n"),
        signal: abortController.signal
      });

      return { ok: true as const, answer };
    } finally {
      cleanupAIAbortController(payload.requestId);
    }
  }
);

ipcMain.handle(
  "ai:updateStoryMemory",
  async (
    _event,
    payload: {
      currentMemory: string;
      userMessage: string;
      assistantAnswer: string;
      chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
    }
  ) => {
    const answer = await callOpenAIText({
      systemPrompt: createStoryMemorySystemPrompt(),
      userPrompt: [
        "Current persistent story memory:",
        formatStoryMemory(payload.currentMemory),
        "",
        "Recent chat history:",
        formatAIChatHistory(payload.chatHistory),
        "",
        "Newest user message:",
        payload.userMessage,
        "",
        "Newest assistant answer:",
        payload.assistantAnswer,
        "",
        "Rewrite the persistent story memory now."
      ].join("\n"),
      maxOutputTokens: 5000
    });

    return { ok: true as const, memoryText: compactStoryMemory(answer) };
  }
);

ipcMain.handle(
  "ai:generateProject",
  async (
    _event,
    payload: {
      storyText: string;
      currentProjectJson: string;
      storyMemory?: string;
      chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
      stylePrompt?: string;
      requestId?: string;
    }
  ) => {
    const abortController = createAIAbortController(payload.requestId);
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 240000);
    try {
      const answer = await callOpenAIText({
        systemPrompt: createLeanProjectWriterSystemPrompt(),
        userPrompt: [
          "Create a complete StoryLife Builder project JSON from this story request.",
          "",
          "Current project summary, only for optional context:",
          createProjectContextSummary(payload.currentProjectJson),
          "",
          "Story request:",
          payload.storyText,
          "",
          "SELECTED STORY STYLE RULES:",
          formatStoryStylePrompt(payload.stylePrompt),
          "",
          "Persistent story memory that must be followed:",
          formatStoryMemory(payload.storyMemory),
          "",
          "Recent brainstorming chat that must be treated as creative brief:",
          formatAIChatHistory(payload.chatHistory),
          "",
          "Important: return a valid project JSON object now. Do not say that you are generating it. Do not ask for more input.",
          "If the story request says this is the first block of a large project, obey the scene limit exactly."
        ].join("\n"),
        signal: abortController.signal,
        maxOutputTokens: 32000,
        onTextDelta: (delta) => {
          if (payload.requestId) {
            _event.sender.send("ai:projectProgress", {
              requestId: payload.requestId,
              delta
            });
          }
        },
        onStatus: (status) => {
          if (payload.requestId) {
            _event.sender.send("ai:projectProgress", {
              requestId: payload.requestId,
              ...status
            });
          }
        }
      });

      return { ok: true as const, projectJson: extractJsonObject(answer) };
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error(
          "AI project generation took longer than 4 minutes and was stopped. Try a smaller project first, or ask for fewer scenes."
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanupAIAbortController(payload.requestId);
    }
  }
);

ipcMain.handle(
  "ai:planStory",
  async (
    _event,
    payload: {
      storyText: string;
      targetSceneCount: number | null;
      storyMemory?: string;
      chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
      stylePrompt?: string;
      requestId?: string;
    }
  ) => {
    const abortController = createAIAbortController(payload.requestId);
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 240000);
    try {
      const answer = await callOpenAIText({
        systemPrompt: createLeanStoryPlannerSystemPrompt(),
        userPrompt: [
          "Create the complete structured story blueprint before project JSON is generated.",
          "",
          `Target scene count: ${payload.targetSceneCount ?? "not specified"}`,
          "",
          "User story request:",
          payload.storyText,
          "",
          "SELECTED STORY STYLE RULES:",
          formatStoryStylePrompt(payload.stylePrompt),
          "",
          "Persistent story memory that must be used as binding context:",
          formatStoryMemory(payload.storyMemory),
          "",
          "Recent brainstorming chat that must be used as context:",
          formatAIChatHistory(payload.chatHistory)
        ].join("\n"),
        signal: abortController.signal,
        maxOutputTokens: 20000,
        onTextDelta: (delta) => {
          if (payload.requestId) {
            _event.sender.send("ai:projectProgress", {
              requestId: payload.requestId,
              delta
            });
          }
        },
        onStatus: (status) => {
          if (payload.requestId) {
            _event.sender.send("ai:projectProgress", {
              requestId: payload.requestId,
              ...status
            });
          }
        }
      });

      return { ok: true as const, planText: answer.trim() };
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error("AI story planning took longer than 4 minutes and was stopped.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanupAIAbortController(payload.requestId);
    }
  }
);

ipcMain.handle(
  "ai:planStoryArchitecture",
  async (
    _event,
    payload: {
      storyText: string;
      targetSceneCount: number;
      storyMemory?: string;
      chatHistory?: Array<{ role: "user" | "assistant" | "system"; text: string }>;
      stylePrompt?: string;
      correctionProblems?: string[];
      requestId?: string;
    }
  ) => {
    const abortController = createAIAbortController(payload.requestId);
    const timeoutId = setTimeout(() => abortController.abort(), 240000);
    try {
      const answer = await callOpenAIText({
        systemPrompt: createLeanStoryArchitectureSystemPrompt(),
        userPrompt: [
          "Write a compact creative map for this interactive text quest.",
          `Aim for ${payload.targetSceneCount} ordered story beats. The Builder, not you, owns the final scene count and link graph.`,
          "",
          "ORIGINAL STORY REQUEST:",
          payload.storyText,
          "",
          "SELECTED STORY STYLE RULES:",
          formatStoryStylePrompt(payload.stylePrompt),
          "",
          "PERSISTENT STORY MEMORY:",
          formatStoryMemory(payload.storyMemory),
          "",
          "RECENT DISCUSSION:",
          formatAIChatHistory(payload.chatHistory),
          "",
          "ONLY FIX THESE JSON OR MAP READABILITY PROBLEMS FROM THE PREVIOUS ATTEMPT:",
          payload.correctionProblems?.map((problem) => `- ${problem}`).join("\n") || "none",
          "",
          CAPY_3_STORY_REFERENCE,
          "",
          "Return the architecture JSON now."
        ].join("\n"),
        signal: abortController.signal,
        maxOutputTokens: 5000,
        onTextDelta: (delta) => {
          if (payload.requestId) {
            _event.sender.send("ai:projectProgress", { requestId: payload.requestId, delta });
          }
        }
      });
      return { ok: true as const, architectureText: answer.trim() };
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error("AI story architecture planning took longer than 4 minutes and was stopped.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanupAIAbortController(payload.requestId);
    }
  }
);

ipcMain.handle(
  "ai:planStoryChunk",
  async (
    _event,
    payload: {
      storyText: string;
      targetSceneCount: number;
      architectureJson: string;
      approvedBlueprintJson: string;
      requiredSceneKeys: string[];
      correctionProblems?: string[];
      stylePrompt?: string;
      requestId?: string;
    }
  ) => {
    const abortController = createAIAbortController(payload.requestId);
    const timeoutId = setTimeout(() => abortController.abort(), 240000);
    try {
      const answer = await callOpenAIText({
        systemPrompt: createLeanStoryBlueprintChunkSystemPrompt(),
        userPrompt: [
          "Write the next append-only block of the interactive story blueprint.",
          `Finished story scene count: ${payload.targetSceneCount}`,
          `Return exactly these semantic scene keys in this order: ${payload.requiredSceneKeys.join(", ")}`,
          "",
          "ORIGINAL STORY REQUEST:",
          payload.storyText,
          "",
          "MASTER STORY ARCHITECTURE:",
          payload.architectureJson,
          "",
          CAPY_3_STORY_REFERENCE,
          "",
          "ALREADY APPROVED BLUEPRINT SCENES. Preserve them and continue their exact branches:",
          payload.approvedBlueprintJson,
          "",
          "SELECTED STORY STYLE RULES:",
          formatStoryStylePrompt(payload.stylePrompt),
          "",
          "PROBLEMS FROM THE PREVIOUS ATTEMPT AT THIS SMALL BLOCK:",
          payload.correctionProblems?.map((problem) => `- ${problem}`).join("\n") || "none",
          "",
          "Return only the next blueprint chunk JSON."
        ].join("\n"),
        signal: abortController.signal,
        maxOutputTokens: 12000,
        onTextDelta: (delta) => {
          if (payload.requestId) {
            _event.sender.send("ai:projectProgress", { requestId: payload.requestId, delta });
          }
        }
      });
      return { ok: true as const, chunkText: answer.trim() };
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error("AI story blueprint chunk took longer than 4 minutes and was stopped.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanupAIAbortController(payload.requestId);
    }
  }
);

ipcMain.handle(
  "ai:reviewStoryChunk",
  async (
    _event,
    payload: {
      architectureJson: string;
      approvedBlueprintJson: string;
      chunkJson: string;
      storyRequest: string;
      requestId?: string;
    }
  ) => {
    const abortController = createAIAbortController(payload.requestId);
    const timeoutId = setTimeout(() => abortController.abort(), 240000);
    try {
      const answer = await callOpenAIText({
        systemPrompt: createSemanticStoryChunkReviewerSystemPrompt(),
        userPrompt: [
          "Act as the second, independent story editor. Review only the new semantic story block.",
          "",
          "ORIGINAL STORY REQUEST:",
          payload.storyRequest.slice(0, 12000),
          "",
          "BINDING MASTER ARCHITECTURE:",
          payload.architectureJson,
          "",
          "ALREADY APPROVED STORY:",
          payload.approvedBlueprintJson,
          "",
          "NEW BLOCK TO REVIEW:",
          payload.chunkJson
        ].join("\n"),
        signal: abortController.signal,
        maxOutputTokens: 5000
      });
      return { ok: true as const, review: parseStoryBlockReview(answer) };
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error("AI story editor took longer than 4 minutes and was stopped.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanupAIAbortController(payload.requestId);
    }
  }
);

ipcMain.handle(
  "ai:reviewStoryBlueprint",
  async (
    _event,
    payload: {
      blueprintJson: string;
      storyRequest: string;
      requestId?: string;
    }
  ) => {
    const abortController = createAIAbortController(payload.requestId);
    const timeoutId = setTimeout(() => abortController.abort(), 240000);
    try {
      const answer = await callOpenAIText({
        systemPrompt: createLeanStoryBlueprintReviewerSystemPrompt(),
        userPrompt: [
          "Review this complete interactive text-quest blueprint before any project JSON is written.",
          "",
          "ORIGINAL STORY REQUEST:",
          payload.storyRequest.slice(0, 12000),
          "",
          "FULL STRUCTURALLY VALID BLUEPRINT JSON:",
          payload.blueprintJson
        ].join("\n"),
        signal: abortController.signal,
        maxOutputTokens: 6000
      });
      return {
        ok: true as const,
        review: parseStoryBlockReview(answer)
      };
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error("AI story blueprint review took longer than 4 minutes and was stopped.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanupAIAbortController(payload.requestId);
    }
  }
);

ipcMain.handle(
  "ai:analyzeStoryLogic",
  async (
    _event,
    payload: {
      projectJson: string;
      requestId?: string;
    }
  ) => {
    const abortController = createAIAbortController(payload.requestId);
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 240000);
    try {
      const answer = await callOpenAIText({
        systemPrompt: createStoryLogicAnalyzerSystemPrompt(),
        userPrompt: [
          "Analyze this StoryLife Builder project as a screenwriter, story editor, and interactive narrative designer.",
          "Do not perform a technical graph validation. Analyze story meaning, player choice logic, consequences, character continuity, conflict, pacing, and real branching.",
          "",
          "Project summary:",
          createProjectContextSummary(payload.projectJson),
          "",
          "Tail scenes:",
          createProjectTailSummary(payload.projectJson),
          "",
          "Full project JSON:",
          payload.projectJson,
          "",
          "Return the report in Russian using exactly the requested report structure."
        ].join("\n"),
        signal: abortController.signal,
        maxOutputTokens: 16000,
        onTextDelta: (delta) => {
          if (payload.requestId) {
            _event.sender.send("ai:projectProgress", {
              requestId: payload.requestId,
              delta
            });
          }
        },
        onStatus: (status) => {
          if (payload.requestId) {
            _event.sender.send("ai:projectProgress", {
              requestId: payload.requestId,
              ...status
            });
          }
        }
      });

      return { ok: true as const, reportText: answer.trim() };
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error("AI story logic analysis took longer than 4 minutes and was stopped.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanupAIAbortController(payload.requestId);
    }
  }
);

ipcMain.handle(
  "ai:reviewStoryBlock",
  async (
    _event,
    payload: {
      storyPlan: string;
      projectJson: string;
      sceneIds: string[];
      requestId?: string;
    }
  ) => {
    const abortController = createAIAbortController(payload.requestId);
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 120000);
    try {
      const answer = await callOpenAIText({
        systemPrompt: createLeanStoryBlockReviewerSystemPrompt(),
        userPrompt: [
          "Review this newly generated StoryLife block against the approved story plan.",
          "",
          "Approved story plan:",
          payload.storyPlan.slice(0, 14000),
          "",
          "Scene ids in the new block:",
          payload.sceneIds.join(", "),
          "",
          "Project summary and scene map:",
          createProjectContextSummary(payload.projectJson),
          "",
          "Relevant new block JSON:",
          createSceneSubsetJson(payload.projectJson, payload.sceneIds),
          "",
          "Return the review JSON now."
        ].join("\n"),
        signal: abortController.signal,
        maxOutputTokens: 5000
      });

      return {
        ok: true as const,
        review: parseStoryBlockReview(answer)
      };
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error("AI story block review took longer than 2 minutes and was stopped.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanupAIAbortController(payload.requestId);
    }
  }
);

ipcMain.handle(
  "ai:validateProjectDraft",
  async (
    _event,
    payload: {
      projectJson: string;
      storyRequest?: string;
      storyPlan?: string;
      memoryLibrary?: string;
      requestId?: string;
    }
  ) => {
    const abortController = createAIAbortController(payload.requestId);
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 720000);
    try {
      const auditChunks = createProjectLogicAuditChunks(payload.projectJson, 25);
      const problems: string[] = [];
      const scores: number[] = [];
      let allPass = auditChunks.length > 0;

      for (const [index, auditChunk] of auditChunks.entries()) {
        if (payload.requestId) {
          _event.sender.send("ai:projectProgress", {
            requestId: payload.requestId,
            status: `Checking story logic block ${index + 1}/${auditChunks.length}...`
          });
        }

        const answer = await callOpenAIText({
          systemPrompt: createLeanProjectDraftValidatorSystemPrompt(),
          userPrompt: [
            `AUDIT BLOCK ${index + 1} OF ${auditChunks.length}.`,
            "Inspect every SOURCE SCENE in this block. Target previews may point outside the block and are included to judge each transition.",
            "",
            "ORIGINAL STORY REQUEST:",
            (payload.storyRequest?.trim() || "Not provided.").slice(0, 6000),
            "",
            "APPROVED STORY PLAN:",
            (payload.storyPlan?.trim() || "Not provided.").slice(0, 14000),
            "",
            "PROJECT MEMORY EXCERPT:",
            createValidationMemoryExcerpt(payload.memoryLibrary),
            "",
            "PROJECT OVERVIEW:",
            createProjectContextSummary(payload.projectJson).slice(0, 18000),
            "",
            "SCENES AND DIRECT TARGET PREVIEWS:",
            auditChunk
          ].join("\n"),
          signal: abortController.signal,
          maxOutputTokens: 5000
        });
        const parsed = JSON.parse(extractJsonObject(answer)) as {
          passes?: unknown;
          score?: unknown;
          problems?: unknown;
        };
        const blockScore =
          typeof parsed.score === "number"
            ? Math.max(0, Math.min(100, Math.round(parsed.score)))
            : 0;
        const blockProblems = Array.isArray(parsed.problems)
          ? parsed.problems.map((problem) => String(problem)).filter(Boolean)
          : [`Audit block ${index + 1}: AI validator did not return a problems array.`];
        scores.push(blockScore);
        problems.push(...blockProblems);
        if (parsed.passes !== true || blockScore < 75 || blockProblems.length > 0) {
          allPass = false;
        }
      }

      const score = scores.length > 0 ? Math.min(...scores) : 0;
      const uniqueProblems = [...new Set(problems)].slice(0, 40);
      return {
        ok: true as const,
        passes: allPass && score >= 75 && uniqueProblems.length === 0,
        score,
        problems: uniqueProblems
      };
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error("AI project validation took longer than 12 minutes and was stopped.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanupAIAbortController(payload.requestId);
    }
  }
);

ipcMain.handle(
  "ai:expandProjectChunk",
  async (
    _event,
    payload: {
      storyText: string;
      projectJson: string;
      targetSceneCount: number;
      batchSize: number;
      requiredSceneIds?: string[];
      blueprintChunkJson?: string;
      stylePrompt?: string;
      memoryLibrary?: string;
      requestId?: string;
    }
  ) => {
    const abortController = createAIAbortController(payload.requestId);
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 240000);
    try {
      if (payload.requestId) {
        _event.sender.send("ai:projectProgress", {
          requestId: payload.requestId,
          status: `Requesting next scene chunk up to ${payload.targetSceneCount} total scenes...`
        });
      }

      const answer = await callOpenAIText({
        systemPrompt: createLeanProjectExpansionSystemPrompt(),
        userPrompt: [
          "Expand this StoryLife Builder project by returning a JSON patch, not the full project.",
          "",
          "Current project summary:",
          createProjectContextSummary(payload.projectJson),
          "",
          "Current project tail scenes:",
          createProjectTailSummary(payload.projectJson),
          "",
          "EXACT SCENE IDS REQUIRED IN newScenes:",
          payload.requiredSceneIds?.join(", ") || `${payload.batchSize} next sequential scene ids`,
          "",
          "EXACT APPROVED BLUEPRINT SCENES TO TURN INTO FINISHED PROSE:",
          payload.blueprintChunkJson?.trim() || "Use the matching scenes from the approved plan in the story request.",
          "",
          "PERSISTENT PROJECT MEMORY LIBRARY:",
          payload.memoryLibrary?.trim() || "No separate memory library yet.",
          "",
          `Target total scenes: ${payload.targetSceneCount}`,
          `Return exactly this many new scenes in this patch: ${payload.batchSize}`,
          "",
          "Original user story request:",
          payload.storyText,
          "",
          "SELECTED STORY STYLE RULES:",
          formatStoryStylePrompt(payload.stylePrompt),
          "",
          "Return only raw JSON patch now."
        ].join("\n"),
        signal: abortController.signal,
        maxOutputTokens: 16000,
        onTextDelta: (delta) => {
          if (payload.requestId) {
            _event.sender.send("ai:projectProgress", {
              requestId: payload.requestId,
              delta
            });
          }
        },
        onStatus: (status) => {
          if (payload.requestId) {
            _event.sender.send("ai:projectProgress", {
              requestId: payload.requestId,
              ...status
            });
          }
        }
      });

      return { ok: true as const, patchJson: extractJsonObject(answer) };
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error(
          "AI scene chunk generation took longer than 4 minutes and was stopped."
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanupAIAbortController(payload.requestId);
    }
  }
);

ipcMain.handle(
  "ai:editProject",
  async (
    _event,
    payload: {
      instruction: string;
      projectJson: string;
      storyMemory?: string;
      requestId?: string;
    }
  ) => {
    const abortController = createAIAbortController(payload.requestId);
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 240000);
    try {
      const answer = await callOpenAIText({
        systemPrompt: createLeanProjectEditSystemPrompt(),
        userPrompt: [
          "Edit the existing StoryLife Builder project. Do not create a new story from scratch.",
          "",
          "Current project summary:",
          createProjectContextSummary(payload.projectJson),
          "",
          "Current project JSON:",
          payload.projectJson,
          "",
          "Persistent story memory and user-approved creative direction:",
          formatStoryMemory(payload.storyMemory),
          "",
          "User edit instruction:",
          payload.instruction,
          "",
          "Return only raw JSON patch now."
        ].join("\n"),
        signal: abortController.signal,
        maxOutputTokens: 12000,
        onTextDelta: (delta) => {
          if (payload.requestId) {
            _event.sender.send("ai:projectProgress", {
              requestId: payload.requestId,
              delta
            });
          }
        },
        onStatus: (status) => {
          if (payload.requestId) {
            _event.sender.send("ai:projectProgress", {
              requestId: payload.requestId,
              ...status
            });
          }
        }
      });

      return { ok: true as const, patchJson: extractJsonObject(answer) };
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error("AI project edit took longer than 4 minutes and was stopped.");
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanupAIAbortController(payload.requestId);
    }
  }
);

ipcMain.handle("ai:cancel", async (_event, requestId: string) => {
  const abortController = activeAIRequests.get(requestId);
  if (abortController) {
    abortController.abort();
    activeAIRequests.delete(requestId);
  }

  return { ok: true as const };
});

function getGeneratedImagesDirectory(): string {
  return join(app.getPath("userData"), "ai-generated-images");
}

function normalizeManagedImagePath(filePath: string): string {
  return resolve(filePath.startsWith("file://") ? fileURLToPath(filePath) : filePath);
}

function normalizePathForComparison(filePath: string): string {
  const normalized = resolve(filePath);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function isManagedGeneratedImage(filePath: string): boolean {
  if (!filePath.trim()) return false;
  try {
    const root = normalizePathForComparison(getGeneratedImagesDirectory());
    const candidate = normalizePathForComparison(normalizeManagedImagePath(filePath));
    return candidate.startsWith(`${root}${sep}`);
  } catch {
    return false;
  }
}

async function getGeneratedImageStorageInfo() {
  const folderPath = getGeneratedImagesDirectory();
  await mkdir(folderPath, { recursive: true });
  const entries = await readdir(folderPath, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile());
  const sizes = await Promise.all(
    files.map(async (entry) => (await stat(join(folderPath, entry.name))).size)
  );
  return {
    folderPath,
    fileCount: files.length,
    totalBytes: sizes.reduce((total, size) => total + size, 0)
  };
}

ipcMain.handle("ai:getGeneratedImageStorageInfo", async () =>
  getGeneratedImageStorageInfo()
);

ipcMain.handle("ai:openGeneratedImageFolder", async () => {
  const folderPath = getGeneratedImagesDirectory();
  await mkdir(folderPath, { recursive: true });
  const error = await shell.openPath(folderPath);
  if (error) throw new Error(error);
  return { ok: true as const };
});

ipcMain.handle(
  "ai:deleteGeneratedImage",
  async (_event, payload: { filePath: string; retainedPaths?: string[] }) => {
    if (!isManagedGeneratedImage(payload.filePath)) {
      return { deleted: false as const, reason: "outside-managed-folder" as const };
    }
    const candidate = normalizeManagedImagePath(payload.filePath);
    const retainedPaths = new Set(
      (payload.retainedPaths ?? [])
        .filter(isManagedGeneratedImage)
        .map((filePath) => normalizePathForComparison(normalizeManagedImagePath(filePath)))
    );
    if (retainedPaths.has(normalizePathForComparison(candidate))) {
      return { deleted: false as const, reason: "still-used" as const };
    }
    try {
      await unlink(candidate);
      return { deleted: true as const };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { deleted: false as const, reason: "missing" as const };
      }
      throw error;
    }
  }
);

ipcMain.handle(
  "ai:cleanupGeneratedImages",
  async (_event, retainedPaths: string[] = []) => {
    const folderPath = getGeneratedImagesDirectory();
    await mkdir(folderPath, { recursive: true });
    const retained = new Set(
      retainedPaths
        .filter(isManagedGeneratedImage)
        .map((filePath) => normalizePathForComparison(normalizeManagedImagePath(filePath)))
    );
    const entries = await readdir(folderPath, { withFileTypes: true });
    let deletedCount = 0;
    let deletedBytes = 0;

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const filePath = join(folderPath, entry.name);
      if (retained.has(normalizePathForComparison(filePath))) continue;
      const fileStats = await stat(filePath);
      await unlink(filePath);
      deletedCount += 1;
      deletedBytes += fileStats.size;
    }

    return {
      deletedCount,
      deletedBytes,
      storage: await getGeneratedImageStorageInfo()
    };
  }
);

ipcMain.handle(
  "ai:generateSceneImage",
  async (
    _event,
    payload: {
      prompt: string;
      referenceImagePaths?: string[];
      imageModel?: string;
      imageSize?: string;
      imageQuality?: string;
      preserveReferenceCanvas?: boolean;
      requestId?: string;
    }
  ) => {
    const abortController = createAIAbortController(payload.requestId);
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, 180000);

    try {
      const filePath = await callOpenAIImage({
        prompt: payload.prompt,
        referenceImagePaths: payload.referenceImagePaths,
        imageModel: payload.imageModel,
        imageSize: payload.imageSize,
        imageQuality: payload.imageQuality,
        preserveReferenceCanvas: payload.preserveReferenceCanvas,
        signal: abortController.signal
      });

      return { ok: true as const, filePath };
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error(
          "AI image generation took longer than 3 minutes and was stopped. Try a shorter prompt, fewer references, or another image model."
        );
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      cleanupAIAbortController(payload.requestId);
    }
  }
);

ipcMain.handle("game:export", async (event, projectJson: string) => {
  const parentWindow = BrowserWindow.fromWebContents(event.sender);
  const result = parentWindow
    ? await dialog.showOpenDialog(parentWindow, {
        title: "Select Export Folder",
        properties: ["openDirectory", "createDirectory"]
      })
    : await dialog.showOpenDialog({
        title: "Select Export Folder",
        properties: ["openDirectory", "createDirectory"]
      });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true as const };
  }

  const exportPath = result.filePaths[0];
  const project = JSON.parse(projectJson) as ExportProject;
  const exportedProject = await prepareExportProject(project, exportPath);

  await copyPlayerBuild(exportPath);
  await mkdir(join(exportPath, "assets", "data"), { recursive: true });
  await writeFile(
    join(exportPath, "assets", "data", "story.json"),
    `${JSON.stringify(exportedProject, null, 2)}\n`,
    "utf-8"
  );

  return { canceled: false as const, exportPath };
});

interface ExportProject {
  projectName: string;
  startSceneId: string;
  mediaLibrary?: unknown;
  theme?: {
    backgroundColor: string;
    textColor: string;
  };
  audio?: {
    backgroundMusicPath: string;
    musicVolume: number;
    musicFadeInSeconds?: number;
    musicFadeOutSeconds?: number;
    fadeMusicOnSceneSound: boolean;
    sceneSoundDuckVolume?: number;
  };
  parameters: Array<{
    id: string;
    key: string;
    initialValue: number;
    minValue: number | null;
    maxValue: number | null;
  }>;
  flags: Array<{ id: string; key: string; defaultValue: boolean }>;
  scenes: ExportScene[];
}

interface ExportScene {
  id: string;
  title: string;
  text: string;
  imagePath: string;
  visualMediaType?: "image" | "video";
  videoLoop?: boolean;
  activeImageVariantId?: string;
  imageVariants?: Array<{
    id: string;
    imagePath: string;
    name?: string;
    prompt?: string;
    createdAt?: number;
    animation?: {
      type: "procedural" | "aiFrames";
      enabled?: boolean;
      sourceImagePath?: string;
      frames?: Array<{
        id: string;
        source: "original" | "generated";
        imagePath: string;
        instruction?: string;
      }>;
      [key: string]: unknown;
    } | null;
  }>;
  soundPath?: string;
  layoutType?: string;
  fadeMusicOnSceneSound?: boolean;
  soundVolume?: number;
  soundFadeInSeconds?: number;
  soundFadeOutSeconds?: number;
  style?: Record<string, unknown>;
  choices: Array<{
    id: string;
    text: string;
    targetNodeId: string;
    useMultipleOutcomes?: boolean;
    outcomes?: Array<{
      id: string;
      targetSceneId: string;
      percent: number;
    }>;
    conditionalTargets?: Array<{
      id: string;
      conditions: Array<Record<string, unknown>>;
      targetSceneId: string;
    }>;
    effects: Array<Record<string, unknown>>;
    conditions: Array<Record<string, unknown>>;
    conditionFailBehavior: "hidden" | "disabled";
  }>;
}

async function prepareExportProject(
  project: ExportProject,
  exportPath: string
): Promise<ExportProject> {
  await mkdir(join(exportPath, "assets", "images"), { recursive: true });
  await mkdir(join(exportPath, "assets", "video"), { recursive: true });
  await mkdir(join(exportPath, "assets", "audio"), { recursive: true });

  const scenes = await Promise.all(
    project.scenes.map(async (scene) => {
      const sourceImagePath = scene.imagePath;
      const imagePath = await copySceneVisual(scene, exportPath);
      const imageVariant = await prepareExportImageVariant(
        scene,
        sourceImagePath,
        imagePath,
        exportPath
      );
      const soundPath = await copyAudioFile(scene.soundPath ?? "", scene.id, exportPath);
      return {
        ...scene,
        imagePath,
        imageVariants: imageVariant ? [imageVariant] : [],
        activeImageVariantId: imageVariant?.id ?? "",
        soundPath,
        authorNotes: undefined
      };
    })
  );

  const backgroundMusicPath = await copyAudioFile(
    project.audio?.backgroundMusicPath ?? "",
    "background_music",
    exportPath
  );

  return {
    ...project,
    audio: {
      backgroundMusicPath,
      musicVolume: project.audio?.musicVolume ?? 0.55,
      musicFadeInSeconds: project.audio?.musicFadeInSeconds ?? 0.8,
      musicFadeOutSeconds: project.audio?.musicFadeOutSeconds ?? 0.8,
      fadeMusicOnSceneSound: project.audio?.fadeMusicOnSceneSound ?? true,
      sceneSoundDuckVolume: project.audio?.sceneSoundDuckVolume ?? 0.18
    },
    mediaLibrary: undefined,
    scenes
  };
}

async function prepareExportImageVariant(
  scene: ExportScene,
  sourceImagePath: string,
  exportedImagePath: string,
  exportPath: string
): Promise<NonNullable<ExportScene["imageVariants"]>[number] | null> {
  const variant = scene.imageVariants?.find(
    (candidate) => candidate.id === scene.activeImageVariantId
  ) ?? scene.imageVariants?.find((candidate) => candidate.imagePath === sourceImagePath);
  if (!variant || !exportedImagePath) return null;
  if (!variant.animation?.enabled) {
    return { ...variant, imagePath: exportedImagePath, animation: null };
  }
  if (variant.animation.type !== "aiFrames") {
    return {
      ...variant,
      imagePath: exportedImagePath,
      animation: { ...variant.animation, sourceImagePath: exportedImagePath }
    };
  }
  const frames = await Promise.all((variant.animation.frames ?? []).map(async (frame, index) => ({
    ...frame,
    imagePath: frame.source === "original"
      ? ""
      : await copyAnimationFrame(frame.imagePath, `${scene.id}_${index + 1}`, exportPath)
  })));
  return {
    ...variant,
    imagePath: exportedImagePath,
    animation: {
      ...variant.animation,
      sourceImagePath: exportedImagePath,
      frames: frames.filter((frame) => frame.source === "original" || frame.imagePath)
    }
  };
}

async function copyAnimationFrame(
  framePath: string,
  id: string,
  exportPath: string
): Promise<string> {
  const sourcePath = normalizeLocalImagePath(framePath);
  if (!sourcePath) return "";
  const dataFile = sourcePath.startsWith("data:image/") ? parseDataUrl(sourcePath) : null;
  if (dataFile) {
    const extension = getImageExtension(dataFile.mimeType);
    const relativePath = `assets/images/${sanitizeFileName(id)}${extension}`;
    await writeFile(join(exportPath, relativePath), dataFile.buffer);
    return relativePath;
  }
  try { await access(sourcePath); } catch { return ""; }
  const extension = extname(sourcePath).toLowerCase();
  if (!isPictureExtension(extension)) return "";
  const relativePath = `assets/images/${sanitizeFileName(id)}${extension}`;
  await copyFile(sourcePath, join(exportPath, relativePath));
  return relativePath;
}

async function copySceneVisual(
  scene: ExportScene,
  exportPath: string
): Promise<string> {
  const sourcePath = normalizeLocalImagePath(scene.imagePath);
  if (!sourcePath) {
    return "";
  }

  if (sourcePath.startsWith("data:image/") || sourcePath.startsWith("data:video/")) {
    const dataFile = parseDataUrl(sourcePath);
    if (!dataFile) {
      return "";
    }

    const isVideo = dataFile.mimeType.startsWith("video/");
    const extension = isVideo
      ? getVideoExtension(dataFile.mimeType)
      : getImageExtension(dataFile.mimeType);
    const fileName = `${sanitizeFileName(scene.id)}${extension}`;
    const relativePath = `assets/${isVideo ? "video" : "images"}/${fileName}`;
    await writeFile(join(exportPath, relativePath), dataFile.buffer);
    return relativePath;
  }

  try {
    await access(sourcePath);
  } catch {
    return "";
  }

  const extension = extname(sourcePath).toLowerCase();
  if (!isPictureExtension(extension) && !isVideoExtension(extension)) {
    return "";
  }

  const fileName = `${sanitizeFileName(scene.id)}${extension}`;
  const relativePath = `assets/${isVideoExtension(extension) ? "video" : "images"}/${fileName}`;
  await copyFile(sourcePath, join(exportPath, relativePath));
  return relativePath;
}

async function copyAudioFile(
  audioPath: string,
  id: string,
  exportPath: string
): Promise<string> {
  const sourcePath = normalizeLocalFilePath(audioPath);
  if (!sourcePath) {
    return "";
  }

  if (sourcePath.startsWith("data:audio/")) {
    const dataFile = parseDataUrl(sourcePath);
    if (!dataFile) {
      return "";
    }

    const extension = getAudioExtension(dataFile.mimeType);
    const fileName = `${sanitizeFileName(id)}${extension}`;
    const relativePath = `assets/audio/${fileName}`;
    await writeFile(join(exportPath, relativePath), dataFile.buffer);
    return relativePath;
  }

  try {
    await access(sourcePath);
  } catch {
    return "";
  }

  const extension = extname(sourcePath).toLowerCase();
  if (![".mp3", ".wav", ".ogg", ".m4a", ".webm"].includes(extension)) {
    return "";
  }

  const fileName = `${sanitizeFileName(id)}${extension}`;
  const relativePath = `assets/audio/${fileName}`;
  await copyFile(sourcePath, join(exportPath, relativePath));
  return relativePath;
}

function normalizeLocalImagePath(imagePath: string): string {
  return normalizeLocalFilePath(imagePath);
}

function getLocalMediaPathFromUrl(mediaUrl: string): string {
  try {
    const parsedUrl = new URL(mediaUrl);
    if (parsedUrl.protocol !== `${LOCAL_MEDIA_SCHEME}:` || parsedUrl.hostname !== "local") {
      return "";
    }
    return normalizeLocalFilePath(decodeURIComponent(parsedUrl.pathname.slice(1)));
  } catch {
    return "";
  }
}

function isSupportedLocalMediaExtension(extension: string): boolean {
  const normalizedExtension = extension.toLowerCase();
  return (
    isPictureExtension(normalizedExtension) ||
    isVideoExtension(normalizedExtension) ||
    [".mp3", ".wav", ".ogg", ".m4a"].includes(normalizedExtension)
  );
}

function parseSingleByteRange(
  rangeHeader: string,
  fileSize: number
): { start: number; end: number } | null {
  if (fileSize <= 0) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2])) {
    return null;
  }

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return {
      start: Math.max(0, fileSize - suffixLength),
      end: fileSize - 1
    };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : fileSize - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= fileSize ||
    requestedEnd < start
  ) {
    return null;
  }
  return { start, end: Math.min(requestedEnd, fileSize - 1) };
}

function getLocalMediaMimeType(extension: string): string {
  const normalizedExtension = extension.toLowerCase();
  if (isPictureExtension(normalizedExtension) || isVideoExtension(normalizedExtension)) {
    return getVisualMediaMimeType(normalizedExtension);
  }
  if (normalizedExtension === ".mp3") return "audio/mpeg";
  if (normalizedExtension === ".wav") return "audio/wav";
  if (normalizedExtension === ".ogg") return "audio/ogg";
  if (normalizedExtension === ".m4a") return "audio/mp4";
  return "application/octet-stream";
}

function getVisualMediaMimeType(extension: string): string {
  const normalizedExtension = extension.toLowerCase();
  if (normalizedExtension === ".mp4" || normalizedExtension === ".m4v") {
    return "video/mp4";
  }
  if (normalizedExtension === ".webm") {
    return "video/webm";
  }
  if (normalizedExtension === ".mov") {
    return "video/quicktime";
  }
  if (normalizedExtension === ".jpg" || normalizedExtension === ".jpeg") {
    return "image/jpeg";
  }
  if (normalizedExtension === ".webp") {
    return "image/webp";
  }
  if (normalizedExtension === ".gif") {
    return "image/gif";
  }
  return "image/png";
}

function getImageMimeType(extension: string): string {
  return getVisualMediaMimeType(extension);
}

function isPictureExtension(extension: string): boolean {
  return [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension.toLowerCase());
}

function isVideoExtension(extension: string): boolean {
  return [".mp4", ".webm", ".mov", ".m4v"].includes(extension.toLowerCase());
}

function getImageExtension(mimeType: string): string {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return ".jpg";
  }
  if (mimeType === "image/webp") {
    return ".webp";
  }
  if (mimeType === "image/gif") {
    return ".gif";
  }
  return ".png";
}

function getVideoExtension(mimeType: string): string {
  if (mimeType === "video/webm") return ".webm";
  if (mimeType === "video/quicktime") return ".mov";
  return ".mp4";
}

async function readPictureForSaving(
  imagePath: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const dataFile = parseDataUrl(imagePath);
  if (dataFile) {
    if (!dataFile.mimeType.startsWith("image/")) {
      throw new Error("Only pictures can be saved with Save Picture.");
    }
    return dataFile;
  }

  if (/^https?:/i.test(imagePath)) {
    const response = await fetch(imagePath);
    if (!response.ok) throw new Error("Could not download this picture.");
    const mimeType = response.headers.get("content-type")?.split(";")[0] || "image/png";
    if (!mimeType.startsWith("image/")) {
      throw new Error("The selected media is not a picture.");
    }
    return { buffer: Buffer.from(await response.arrayBuffer()), mimeType };
  }

  const filePath = normalizeLocalFilePath(imagePath);
  const extension = extname(filePath).toLowerCase();
  if (!isPictureExtension(extension)) {
    throw new Error("The selected media is not a supported picture.");
  }
  return {
    buffer: await readFile(filePath),
    mimeType: getVisualMediaMimeType(extension)
  };
}

function getAudioExtension(mimeType: string): string {
  if (mimeType === "audio/mpeg" || mimeType === "audio/mp3") {
    return ".mp3";
  }
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") {
    return ".wav";
  }
  if (mimeType === "audio/ogg") {
    return ".ogg";
  }
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") {
    return ".m4a";
  }
  if (mimeType === "audio/webm") {
    return ".webm";
  }
  return ".mp3";
}

function parseDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:([^;,]+)(;base64)?,(.*)$/s);
  if (!match) {
    return null;
  }

  const [, mimeType, base64Flag, rawData] = match;
  const buffer = base64Flag
    ? Buffer.from(rawData, "base64")
    : Buffer.from(decodeURIComponent(rawData), "utf-8");

  return { mimeType, buffer };
}

function normalizeLocalFilePath(imagePath: string): string {
  const trimmedPath = imagePath.trim();
  if (!trimmedPath || trimmedPath.startsWith("blob:")) {
    return "";
  }

  if (trimmedPath.startsWith("file://")) {
    return fileURLToPath(trimmedPath);
  }

  return trimmedPath;
}

async function scanMediaFolder(folderPath: string) {
  const assets: Array<{
    id: string;
    name: string;
    path: string;
    type: "image" | "video" | "audio";
  }> = [];

  async function walk(currentPath: string, depth: number) {
    if (depth > 4 || assets.length >= 1000) {
      return;
    }

    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath, depth + 1);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = extname(entry.name).toLowerCase();
      const type = [".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension)
        ? "image"
        : [".mp4", ".webm", ".mov", ".m4v"].includes(extension)
          ? "video"
          : [".mp3", ".wav", ".ogg", ".m4a"].includes(extension)
            ? "audio"
            : null;

      if (type) {
        assets.push({
          id: createStableId("media_asset", entryPath),
          name: entry.name,
          path: entryPath,
          type
        });
      }
    }
  }

  await walk(folderPath, 0);
  return assets.sort((a, b) => a.name.localeCompare(b.name));
}

function createStableId(prefix: string, value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `${prefix}_${hash.toString(16)}`;
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function copyPlayerBuild(exportPath: string) {
  const distPath = join(__dirname, "../dist-player");
  await copyFile(join(distPath, "player.html"), join(exportPath, "index.html"));
  await copyDirectory(join(distPath, "assets"), join(exportPath, "assets"));
}

async function copyDirectory(sourcePath: string, targetPath: string) {
  await mkdir(targetPath, { recursive: true });
  const entries = await readdir(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const sourceEntryPath = join(sourcePath, entry.name);
    const targetEntryPath = join(targetPath, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourceEntryPath, targetEntryPath);
    } else if (entry.isFile()) {
      await copyFile(sourceEntryPath, targetEntryPath);
    }
  }
}

function createExportHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>StoryLife Game</title>
    <style>
      :root {
        color: #24231f;
        background: #eee8dc;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      * { box-sizing: border-box; }
      html {
        min-height: 100%;
        background: #eee8dc;
      }
      body {
        margin: 0;
        min-height: 100dvh;
        overflow-x: hidden;
        background: #eee8dc;
      }
      #game-shell {
        width: 100vw;
        min-height: 100dvh;
        display: flex;
        justify-content: center;
        align-items: flex-start;
        overflow: visible;
        padding: 0;
      }
      #app {
        width: 390px;
        min-width: 390px;
        height: 760px;
        min-height: 760px;
        position: relative;
        display: grid;
        align-content: start;
        gap: 12px;
        overflow: visible;
        overscroll-behavior: contain;
        border: 10px solid #24231f;
        border-radius: 34px;
        background:
          radial-gradient(circle at 50% 0%, rgba(255, 245, 220, 0.9), transparent 32%),
          linear-gradient(180deg, #fbf1df 0%, #f3eadc 45%, #e8eee8 100%);
        background-size: cover;
        background-position: center;
        box-shadow: 0 24px 60px rgba(49, 43, 35, 0.22);
        padding: 14px;
        transform: scale(var(--storylife-scale, 1));
        transform-origin: top center;
      }
      #app::-webkit-scrollbar {
        width: 0;
        height: 0;
      }
      #app.scene-transition {
        animation: scene-crossfade 560ms ease both;
      }
      .scene-preview-editable {
        position: relative;
        transform-origin: center;
      }
      .scene-preview-image-editable {
        display: grid;
        max-width: 100%;
        overflow: hidden;
        contain: paint;
        border-radius: 18px;
      }
      .scene-preview-image-editable img,
      .scene-preview-image {
        width: 100%;
        height: 220px;
        display: block;
        border-radius: 18px;
        object-fit: cover;
        pointer-events: none;
        transform-origin: center;
      }
      .scene-preview-text-panel {
        box-sizing: border-box;
        max-width: 100%;
        min-width: 0;
        margin: 0;
        border: 1px solid rgba(164, 141, 105, 0.34);
        border-radius: 18px;
        background: rgba(255, 253, 248, 0.82);
        box-shadow: 0 12px 28px rgba(70, 61, 45, 0.1);
        padding: 18px;
        transform-origin: center;
        overflow: visible;
      }
      .scene-preview-title-panel {
        box-sizing: border-box;
        max-width: 100%;
        min-width: 0;
        margin: 0;
        border: 1px solid rgba(164, 141, 105, 0.34);
        border-radius: 18px;
        background: rgba(255, 253, 248, 0.82);
        box-shadow: 0 12px 28px rgba(70, 61, 45, 0.1);
        padding: 18px;
        transform-origin: center;
        overflow: visible;
      }
      h1 {
        margin: 0;
        font-size: 1.55em;
        line-height: 1.16;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      p {
        margin: 8px 0 0;
        font-size: 1em;
        line-height: 1.45;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .scene-preview-text-panel.long-text h1 {
        font-size: 1.42em;
      }
      .scene-preview-text-panel.long-text p {
        font-size: 0.94em;
        line-height: 1.5;
      }
      .scene-preview-text-panel.very-long-text h1 {
        font-size: 1.32em;
      }
      .scene-preview-text-panel.very-long-text p {
        font-size: 0.88em;
        line-height: 1.45;
      }
      .scene-preview-layout-imageBackground,
      .scene-preview-layout-dialogueStyle {
        color: #fffdfa;
      }
      .scene-preview-layout-imageTop,
      .scene-preview-layout-textFirst {
        grid-template-rows: auto auto auto auto;
      }
      .scene-preview-layout-textFirst .scene-preview-title-panel {
        order: 1;
      }
      .scene-preview-layout-textFirst .scene-preview-text-panel {
        order: 2;
      }
      .scene-preview-layout-textFirst .scene-preview-image-editable {
        order: 3;
      }
      .scene-preview-layout-textFirst .scene-mini-choice {
        order: 4;
      }
      .scene-preview-layout-splitLayout .scene-preview-image-editable {
        margin-top: 12px;
      }
      .scene-preview-layout-imageBackground {
        align-content: end;
        padding-top: 220px;
      }
      .scene-preview-layout-dialogueStyle {
        align-content: end;
        padding-top: 390px;
      }
      .scene-preview-layout-imageBackground .scene-preview-image-editable,
      .scene-preview-layout-dialogueStyle .scene-preview-image-editable {
        display: none;
      }
      .scene-preview-layout-fullImageMoment {
        grid-template-rows: minmax(420px, 1fr) auto auto;
        align-content: stretch;
      }
      .scene-preview-layout-fullImageMoment .scene-preview-image-editable,
      .scene-preview-layout-fullImageMoment .scene-preview-image {
        height: 100%;
      }
      .caption-content {
        margin-top: 10px;
        padding: 14px 16px;
      }
      .caption-content h1 {
        margin-bottom: 8px;
        font-size: 20px;
      }
      .caption-content p {
        font-size: 14px;
        line-height: 1.4;
      }
      .scene-preview-layout-noImage {
        align-content: center;
      }
      .scene-mini-choice {
        box-sizing: border-box;
        max-width: 100%;
        min-width: 0;
        display: grid;
        gap: 8px;
        border: 1px solid rgba(128, 112, 88, 0.26);
        border-radius: 12px;
        background: linear-gradient(180deg, #fffaf1, #edf5ef);
        color: #24231f;
        padding: 9px 10px;
        transform-origin: center;
        overflow: visible;
      }
      .exact-play-choice-button {
        display: block;
        width: 100%;
        min-height: 42px;
        border: 1px solid rgba(128, 112, 88, 0.2);
        border-radius: 12px;
        background: rgba(255, 253, 248, 0.72);
        color: #24231f;
        padding: 9px 10px;
        font: inherit;
        text-align: left;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
        transition:
          background 160ms ease,
          border-color 160ms ease,
          box-shadow 160ms ease,
          transform 160ms ease;
      }
      .exact-play-choice-button:not(:disabled) { cursor: pointer; }
      .choice-text-inner { display:block; transform-origin:center; pointer-events:none; }
      .exact-play-choice-button:not(:disabled):hover {
        border-color: rgba(56, 79, 73, 0.56);
        box-shadow: 0 13px 26px rgba(56, 79, 73, 0.14);
      }
      .exact-play-choice-button:not(:disabled):active {
        background: linear-gradient(180deg, #dfeee7, #c9ddd3);
        transform: translateY(1px) scale(0.99);
      }
      .exact-play-choice-button:disabled {
        background: #ece7dc;
        cursor: not-allowed;
        opacity: 0.62;
      }
      .error {
        padding: 24px;
        color: #8f362f;
      }
      @keyframes scene-crossfade {
        from {
          opacity: 0;
          transform: translateY(8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    </style>
  </head>
  <body>
    <div id="game-shell">
      <main id="app"></main>
    </div>
    <script>
      let story;
      let currentSceneId;
      let runtimeState;
      let backgroundAudio;
      let sceneAudio;
      let backgroundLoopRestarting = false;
      const designWidth = 390;

      fetch("assets/data/story.json")
        .then((response) => response.json())
        .then((data) => {
          story = data;
          currentSceneId = story.startSceneId;
          runtimeState = createRuntimeState(story);
          document.title = story.projectName || "StoryLife Game";
          setupAudio();
          render();
          window.addEventListener("resize", updateViewportScale);
          window.addEventListener("orientationchange", () => {
            window.setTimeout(updateViewportScale, 80);
          });
        })
        .catch((error) => {
          document.querySelector("#app").innerHTML =
            '<div class="error">Could not load story.json: ' + escapeHtml(String(error)) + '</div>';
        });

      function createRuntimeState(project) {
        return {
          parameters: Object.fromEntries((project.parameters || []).map((parameter) => [
            parameter.id,
            clampParameterValue(parameter.initialValue || 0, parameter)
          ])),
          flags: Object.fromEntries((project.flags || []).map((flag) => [
            flag.id,
            Boolean(flag.defaultValue)
          ]))
        };
      }

      function render() {
        const scene = story.scenes.find((item) => item.id === currentSceneId);
        const app = document.querySelector("#app");
        if (!scene) {
          app.innerHTML = '<div class="error">Scene not found.</div>';
          return;
        }

        const visibleChoices = (scene.choices || [])
          .map((choice) => ({ choice, available: conditionsPass(choice) }))
          .filter(({ choice, available }) => available || choice.conditionFailBehavior !== "hidden");

        app.classList.remove("scene-transition");
        void app.offsetWidth;
        app.classList.add("scene-transition");

        const contentClass = getContentClass(scene.text || "");
        const effectiveLayout = !scene.imagePath || scene.layoutType === "noImage" ? "noImage" : (scene.layoutType || "imageTop");

        app.className = "scene-transition scene-live-preview-phone play-card-exact scene-preview-layout-" + effectiveLayout;
        const sceneStyle = scene.style || {};
        const theme = story.theme || {};
        app.style.background = sceneStyle.backgroundColor || theme.backgroundColor || "#eee8dc";
        app.style.color = sceneStyle.textColor || theme.textColor || "#26231f";
        app.style.backgroundImage =
          (effectiveLayout === "imageBackground" || effectiveLayout === "dialogueStyle") && scene.imagePath
            ? 'linear-gradient(180deg, rgba(28,25,22,.18), rgba(28,25,22,.52)), url("' + escapeAttribute(scene.imagePath) + '")'
            : "";
        app.style.backgroundSize = app.style.backgroundImage ? "cover" : "";
        app.style.backgroundPosition = app.style.backgroundImage ? "center" : "";

        app.innerHTML = renderSceneBody(scene, effectiveLayout, contentClass) + '<div class="scene-mini-choice exact-play-choices"></div>';

        const imageElement = app.querySelector(".scene-preview-image");
        if (imageElement) {
          imageElement.addEventListener("error", () => {
            imageElement.closest(".scene-preview-image-editable").remove();
          });
        }

        const choicesElement = app.querySelector(".scene-mini-choice");
        choicesElement.setAttribute("style", choicesStyle(scene));
        for (const item of visibleChoices) {
          const button = document.createElement("button");
          button.className = item.available
            ? "choice-preview-input exact-play-choice-button"
            : "choice-preview-input exact-play-choice-button locked-choice";
          const buttonText = document.createElement("span");
          buttonText.className = "choice-text-inner";
          buttonText.textContent = (item.available ? "" : "Locked: ") + (item.choice.text || "");
          buttonText.setAttribute("style", textContentOffsetStyle(scene, "choices"));
          button.appendChild(buttonText);
          button.disabled = !item.available;
            button.style.color = sceneStyle.choicesTextColor || "";
            button.style.fontSize = Number(sceneStyle.choicesFontSize || 16) + "px";
            button.style.fontFamily = fontFamily(sceneStyle.choicesFontFamily || "system");
            if (sceneStyle.choicesBorderEnabled === false) button.style.border = "0";
            button.style.cssText += choiceFrameStyle(sceneStyle.choicesFrameStyle || "none");
          button.addEventListener("click", () => {
            playChoiceClickSound();
            const nextSceneId = resolveChoiceTarget(item.choice);
            runtimeState = applyEffects(item.choice);
            currentSceneId = nextSceneId;
            render();
          });
          choicesElement.appendChild(button);
        }
        updateViewportScale();
        for (const image of app.querySelectorAll("img")) {
          image.addEventListener("load", updateViewportScale, { once: true });
        }
        playSceneSound(scene);
      }

      function updateViewportScale() {
        const app = document.querySelector("#app");
        const shell = document.querySelector("#game-shell");
        if (!app || !shell) return;

        const viewportWidth = Math.max(1, window.innerWidth);
        const scale = Math.min(1, viewportWidth / designWidth);
        document.documentElement.style.setProperty("--storylife-scale", String(scale));

        window.requestAnimationFrame(() => {
          const appHeight = Math.max(760, app.scrollHeight);
          const scaledHeight = Math.ceil(appHeight * scale);
          shell.style.height = scaledHeight + "px";
          shell.style.minHeight = Math.max(window.innerHeight, scaledHeight) + "px";
        });
      }

      function renderSceneBody(scene, layout, contentClass) {
        const image = scene.imagePath ? '<div class="scene-preview-editable scene-preview-image-editable" style="' + escapeAttribute(imageFrameStyle(scene)) + '"><img class="scene-preview-image" style="' + escapeAttribute(imageStyle(scene)) + '" src="' + escapeAttribute(scene.imagePath) + '" alt="" /></div>' : "";
        const sceneStyle = scene.style || {};
        const title = sceneStyle.showSceneTitle === false ? "" : '<section class="scene-preview-title-panel scene-preview-editable" style="' + escapeAttribute(titleStyle(scene)) + '"><h1 style="font-size:' + Number(sceneStyle.titleFontSize || 22) + 'px;text-align:' + (sceneStyle.textAlign === "center" ? "center" : "left") + ';' + escapeAttribute(textContentOffsetStyle(scene, "title")) + '">' + escapeHtml(scene.title || "") + '</h1></section>';
        const textPanelClass = (contentClass ? contentClass + ' ' : '') + 'scene-preview-text-panel scene-preview-editable';
        const content = '<section class="' + textPanelClass + '" style="' + escapeAttribute(contentStyle(scene)) + '"><p style="' + escapeAttribute(textContentOffsetStyle(scene, "text")) + '">' + escapeHtml(scene.text || "") + '</p></section>';
        const captionContent = '<section class="' + textPanelClass + ' caption-content" style="' + escapeAttribute(contentStyle(scene)) + '"><p style="' + escapeAttribute(textContentOffsetStyle(scene, "text")) + '">' + escapeHtml(scene.text || "") + '</p></section>';
        if (layout === "textFirst") return title + content + image;
        if (layout === "splitLayout") return image + title + content;
        if (layout === "fullImageMoment") return image + title + captionContent;
        if (layout === "imageBackground") return image + title + content;
        if (layout === "dialogueStyle") return image + title + content;
        if (layout === "noImage") return title + content;
        return image + title + content;
      }

      function imageFrameStyle(scene) {
        const style = scene.style || {};
        return 'transform:translate(' + Number(style.imageOffsetX || 0) / 3 + 'px,' + Number(style.imageOffsetY || 0) / 3 + 'px)';
      }

      function imageStyle(scene) {
        const style = scene.style || {};
        return 'transform:scale(' + Number(style.imageScale || 1) + ')';
      }

      function titleStyle(scene) {
        const style = scene.style || {};
        const theme = story.theme || {};
        let css = 'transform:' + transformStyle(scene, "title");
        css += style.titlePanelTransparent
          ? ';background:transparent;border-color:transparent;box-shadow:none'
          : ';background:' + (style.titlePanelColor || 'rgba(255,253,248,0.82)') + ';border-color:' + (style.titleBorderColor || 'rgba(164,141,105,0.34)');
        if (style.titleBorderEnabled === false) css += ';border:0';
        css += ';color:' + (style.titleTextColor || style.textColor || theme.textColor || '#26231f');
        css += ';font-family:' + getFontFamily(style.textFontFamily);
        css += ';text-align:' + (style.textAlign === "center" ? "center" : "left");
        if (Number(style.titlePanelWidth || 0) > 0) css += ';width:' + Number(style.titlePanelWidth) + 'px';
        if (Number(style.titlePanelHeight || 0) > 0) css += ';height:' + Number(style.titlePanelHeight) + 'px';
        return css;
      }

      function contentStyle(scene) {
        const style = scene.style || {};
        const theme = story.theme || {};
        let css = 'transform:' + transformStyle(scene, "text");
        css += style.textPanelTransparent
          ? ';background:transparent;border-color:transparent;box-shadow:none'
          : ';background:' + (style.textPanelColor || 'rgba(255,253,248,0.82)') + ';border-color:' + (style.textBorderColor || 'rgba(164,141,105,0.34)');
        if (style.textBorderEnabled === false) css += ';border:0';
        css += ';color:' + (style.textColor || theme.textColor || '#26231f');
        css += ';font-family:' + getFontFamily(style.textFontFamily);
        css += ';font-size:' + Number(style.textFontSize || 16) + 'px';
        css += ';text-align:' + (style.textAlign === "center" ? "center" : "left");
        if (Number(style.textPanelWidth || 0) > 0) css += ';width:' + Number(style.textPanelWidth) + 'px';
        if (Number(style.textPanelHeight || 0) > 0) css += ';height:' + Number(style.textPanelHeight) + 'px';
        return css;
      }

      function choicesStyle(scene) {
        const style = scene.style || {};
        let css = 'transform:' + transformStyle(scene, "choices");
        css += style.choicesPanelTransparent
          ? ';background:transparent;border-color:transparent;box-shadow:none'
          : ';background:' + (style.choicesPanelColor || 'linear-gradient(180deg, #fffaf1, #edf5ef)') + ';border-color:' + (style.choicesBorderColor || 'rgba(128,112,88,0.26)');
        if (style.choicesBorderEnabled === false) css += ';border:0';
        css += ';color:' + (style.choicesTextColor || '#24231f');
        css += ';font-size:' + Number(style.choicesFontSize || 16) + 'px';
        css += ';font-family:' + fontFamily(style.choicesFontFamily || 'system');
        if (Number(style.choicesPanelWidth || 0) > 0) css += ';width:' + Number(style.choicesPanelWidth) + 'px';
        if (Number(style.choicesPanelHeight || 0) > 0) css += ';height:' + Number(style.choicesPanelHeight) + 'px';
        return css;
      }

      function textContentOffsetStyle(scene, target) {
        const style = scene.style || {};
        const x = target === "title"
          ? Number(style.titleTextOffsetX || 0)
          : target === "text"
            ? Number(style.sceneTextOffsetX || 0)
            : Number(style.choiceTextOffsetX || 0);
        const y = target === "title"
          ? Number(style.titleTextOffsetY || 0)
          : target === "text"
            ? Number(style.sceneTextOffsetY || 0)
            : Number(style.choiceTextOffsetY || 0);
        return 'transform:translate(' + x / 3 + 'px,' + y / 3 + 'px)';
      }

      function choiceFrameStyle(frameId) {
        const match = String(frameId || '').match(/^crafted_(0[1-9]|1[0-9]|20)$/);
        if (!match) return '';
        const palettes = [
          ['#fff3ce', '#d9b66f', '#8d6425', '14px'], ['#25252a', '#09090b', '#a83246', '8px'],
          ['#d9efc4', '#618f4e', '#315e35', '18px 8px'], ['#183f82', '#091d48', '#d4ae4e', '12px'],
          ['#711d2b', '#24070e', '#c65a68', '4px 16px'], ['#f4fbff', '#9fc8df', '#7599b4', '20px 8px'],
          ['#6b2fb1', '#220844', '#bd80ff', '16px'], ['#9b6335', '#4a2816', '#d09a55', '10px'],
          ['#a86b2f', '#3d2113', '#d2a15b', '6px 18px'], ['#103447', '#06141e', '#18d9ed', '4px'],
          ['#ffd9df', '#bd7180', '#9d5060', '22px'], ['#202124', '#070708', '#c7a553', '2px'],
          ['#ead4a5', '#a9804d', '#79552d', '3px 15px'], ['#d8ffff', '#66aeb5', '#e9ffff', '24px 10px'],
          ['#68492c', '#261a12', '#60864d', '10px 2px'], ['#173b72', '#070d24', '#e1bd5b', '14px 4px'],
          ['#a85d37', '#4a2418', '#d1835a', '7px'], ['#b9dfae', '#3f805d', '#c6a65b', '2px 16px'],
          ['#d58a19', '#5c2c08', '#ffd060', '2px 20px'], ['#f4f1e8', '#b8b4a9', '#36383d', '0 14px']
        ];
        const palette = palettes[Number(match[1]) - 1];
        return ';background:linear-gradient(135deg,' + palette[0] + ',' + palette[1] + ')' +
          ';border:2px solid ' + palette[2] + ';border-radius:' + palette[3] +
          ';box-shadow:inset 0 0 0 1px ' + palette[2] + ',0 4px 10px rgba(0,0,0,.22)';
      }

      function transformStyle(scene, target) {
        const style = scene.style || {};
        const x = Number(style[target + "OffsetX"] || 0);
        const y = Number(style[target + "OffsetY"] || 0);
        const scale = Number(style[target + "Scale"] || 1);
        return 'translate(' + x / 3 + 'px,' + y / 3 + 'px) scale(' + scale + ')';
      }

      function getFontFamily(fontFamily) {
        if (fontFamily === "serif") return 'Georgia, "Times New Roman", serif';
        if (fontFamily === "mono") return '"Cascadia Mono", "Consolas", monospace';
        return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      }

      function setupAudio() {
        const audio = story.audio || {};
        if (audio.backgroundMusicPath) {
          backgroundAudio = new Audio(audio.backgroundMusicPath);
          backgroundAudio.loop = false;
          backgroundAudio.volume = 0;
          backgroundAudio.addEventListener("timeupdate", handleBackgroundLoop);
          document.addEventListener("click", () => backgroundAudio.play().catch(() => {}), { once: true });
          backgroundAudio.play().catch(() => {});
          fadeAudio(backgroundAudio, Number(audio.musicVolume ?? 0.55), Number(audio.musicFadeInSeconds ?? 0.8));
        }
        sceneAudio = new Audio();
      }

      function handleBackgroundLoop() {
        if (!backgroundAudio || backgroundLoopRestarting) return;
        const audio = story.audio || {};
        const fadeOutSeconds = Math.max(Number(audio.musicFadeOutSeconds ?? 0.8), 0.35);
        if (!Number.isFinite(backgroundAudio.duration) || backgroundAudio.duration <= fadeOutSeconds + 0.15) return;
        if (backgroundAudio.duration - backgroundAudio.currentTime > fadeOutSeconds) return;
        backgroundLoopRestarting = true;
        fadeAudio(backgroundAudio, 0, fadeOutSeconds, () => {
          backgroundAudio.currentTime = 0;
          backgroundAudio.play().catch(() => {});
          fadeAudio(backgroundAudio, Number(audio.musicVolume ?? 0.55), Number(audio.musicFadeInSeconds ?? 0.8), () => {
            backgroundLoopRestarting = false;
          });
        });
      }

      function playSceneSound(scene) {
        if (!sceneAudio) return;
        sceneAudio.pause();
        sceneAudio.currentTime = 0;
        if (!scene.soundPath) return;
        const audio = story.audio || {};
        const normalVolume = Number(audio.musicVolume ?? 0.55);
        const duckVolume = Number(audio.sceneSoundDuckVolume ?? 0.18);
        const shouldFade = Boolean(audio.fadeMusicOnSceneSound ?? true) && Boolean(scene.fadeMusicOnSceneSound ?? true);
        if (backgroundAudio && shouldFade) fadeAudio(backgroundAudio, duckVolume, Number(audio.musicFadeOutSeconds ?? 0.8));
        sceneAudio.src = scene.soundPath;
        sceneAudio.volume = 0;
        sceneAudio.onended = () => {
          if (backgroundAudio) fadeAudio(backgroundAudio, normalVolume, Number(audio.musicFadeInSeconds ?? 0.8));
        };
        sceneAudio.play().catch(() => {
          if (backgroundAudio) fadeAudio(backgroundAudio, normalVolume, Number(audio.musicFadeInSeconds ?? 0.8));
        });
        fadeAudio(sceneAudio, Number(scene.soundVolume ?? 1), Number(scene.soundFadeInSeconds ?? 0));
      }

      function playChoiceClickSound() {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const context = new AudioContextClass();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const now = context.currentTime;
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(740, now);
        oscillator.frequency.exponentialRampToValueAtTime(980, now + 0.07);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.14);
        oscillator.addEventListener("ended", () => context.close());
      }

      function fadeAudio(audioElement, targetVolume, durationSeconds, onComplete) {
        const startVolume = audioElement.volume;
        const durationMs = Math.max(0, durationSeconds * 1000);
        if (durationMs === 0) {
          audioElement.volume = targetVolume;
          if (onComplete) onComplete();
          return;
        }
        const startTime = performance.now();
        const timerId = window.setInterval(() => {
          const progress = Math.min((performance.now() - startTime) / durationMs, 1);
          audioElement.volume = startVolume + (targetVolume - startVolume) * progress;
          if (progress >= 1) {
            window.clearInterval(timerId);
            if (onComplete) onComplete();
          }
        }, 40);
      }

      function resolveChoiceTarget(choice) {
        for (const conditionalTarget of choice.conditionalTargets || []) {
          if ((conditionalTarget.conditions || []).every((condition) => conditionPasses(condition))) {
            return conditionalTarget.targetSceneId;
          }
        }
        if (choice.useMultipleOutcomes && Array.isArray(choice.outcomes) && choice.outcomes.length > 0) {
          if (choice.outcomes.length === 1) {
            return choice.outcomes[0].targetSceneId || choice.targetNodeId;
          }
          const total = choice.outcomes.reduce((sum, outcome) => sum + Math.max(0, Number(outcome.percent || 0)), 0);
          if (total <= 0) {
            return choice.outcomes[0].targetSceneId || choice.targetNodeId;
          }
          let roll = Math.random() * total;
          for (const outcome of choice.outcomes) {
            roll -= Math.max(0, Number(outcome.percent || 0));
            if (roll <= 0) {
              return outcome.targetSceneId || choice.targetNodeId;
            }
          }
          return choice.outcomes[choice.outcomes.length - 1].targetSceneId || choice.targetNodeId;
        }
        return choice.targetNodeId;
      }

      function conditionsPass(choice) {
        return (choice.conditions || []).every(conditionPasses);
      }

      function conditionPasses(condition) {
        if (condition.type === "parameter") {
          const currentValue = runtimeState.parameters[condition.parameterId] ?? 0;
          return compareNumber(currentValue, condition.operator, condition.value || 0);
        }
        return Boolean(runtimeState.flags[condition.flagId] ?? false) === Boolean(condition.expectedValue);
      }

      function getContentClass(text) {
        const length = String(text).trim().length;
        if (length > 1100) return "very-long-text";
        if (length > 650) return "long-text";
        return "";
      }

      function applyEffects(choice) {
        const parameters = { ...runtimeState.parameters };
        const flags = { ...runtimeState.flags };
        for (const effect of choice.effects || []) {
          if (effect.type === "parameter") {
            const parameter = (story.parameters || []).find((item) => item.id === effect.parameterId);
            const currentValue = parameters[effect.parameterId] ?? 0;
            const value = Number(effect.value || 0);
            const nextValue =
              effect.operation === "add" ? currentValue + value :
              effect.operation === "subtract" ? currentValue - value :
              value;
            parameters[effect.parameterId] = parameter ? clampParameterValue(nextValue, parameter) : nextValue;
          } else if (effect.type === "flag") {
            flags[effect.flagId] = Boolean(effect.value);
          }
        }
        return { parameters, flags };
      }

      function compareNumber(currentValue, operator, expectedValue) {
        if (operator === ">") return currentValue > expectedValue;
        if (operator === "<") return currentValue < expectedValue;
        if (operator === "<=") return currentValue <= expectedValue;
        if (operator === "==") return currentValue === expectedValue;
        if (operator === "!=") return currentValue !== expectedValue;
        return currentValue >= expectedValue;
      }

      function clampParameterValue(value, parameter) {
        let nextValue = Number(value || 0);
        if (parameter.minValue !== null && parameter.minValue !== undefined) {
          nextValue = Math.max(nextValue, Number(parameter.minValue));
        }
        if (parameter.maxValue !== null && parameter.maxValue !== undefined) {
          nextValue = Math.min(nextValue, Number(parameter.maxValue));
        }
        return nextValue;
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      function escapeAttribute(value) {
        return escapeHtml(value);
      }
    </script>
  </body>
</html>
`;
}

interface AISettings {
  apiKey: string;
  model: string;
}

interface OpenAIResponseBody {
  output_text?: string;
  output?: Array<{
    type?: string;
    result?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
}

interface OpenAIImageResponseBody {
  data?: Array<{
    b64_json?: string;
    url?: string;
  }>;
  error?: {
    message?: string;
  };
}

async function readAISettings(): Promise<AISettings> {
  try {
    const rawSettings = await readFile(getAISettingsPath(), "utf-8");
    const parsed = JSON.parse(rawSettings) as Partial<AISettings>;
    const savedModel =
      typeof parsed.model === "string" && parsed.model.trim() !== ""
        ? parsed.model.trim()
        : DEFAULT_AI_MODEL;
    return {
      apiKey: typeof parsed.apiKey === "string" ? parsed.apiKey : "",
      model: savedModel === "gpt-4.1-mini" ? DEFAULT_AI_MODEL : savedModel
    };
  } catch {
    return {
      apiKey: "",
      model: DEFAULT_AI_MODEL
    };
  }
}

async function writeAISettings(settings: AISettings) {
  await mkdir(dirname(getAISettingsPath()), { recursive: true });
  await writeFile(getAISettingsPath(), `${JSON.stringify(settings, null, 2)}\n`, "utf-8");
}

function getAISettingsPath(): string {
  return join(app.getPath("userData"), "ai-settings.json");
}

async function callOpenAIText({
  systemPrompt,
  userPrompt,
  signal,
  maxOutputTokens,
  onTextDelta,
  onStatus
}: {
  systemPrompt: string;
  userPrompt: string;
  signal?: AbortSignal;
  maxOutputTokens?: number;
  onTextDelta?: (delta: string) => void;
  onStatus?: (status: {
    status?: string;
    eventCount?: number;
    receivedChars?: number;
  }) => void;
}): Promise<string> {
  const settings = await readAISettings();
  const apiKey = settings.apiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenAI API key is not set. Open AI Assistant settings and paste your API key first."
    );
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: settings.model || DEFAULT_AI_MODEL,
      ...(maxOutputTokens ? { max_output_tokens: maxOutputTokens } : {}),
      ...(onTextDelta ? { stream: true } : {}),
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }]
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }]
        }
      ]
    })
  });

  onStatus?.({
    status: `OpenAI connection opened. HTTP ${response.status}. Waiting for streamed text...`
  });

  if (onTextDelta) {
    return readOpenAITextStream(response, onTextDelta, onStatus);
  }

  const responseJson = (await response.json()) as OpenAIResponseBody;

  if (!response.ok) {
    const message =
      responseJson.error?.message ||
      `OpenAI request failed with status ${response.status}`;
    throw new Error(message);
  }

  const text = extractOpenAIText(responseJson);
  if (!text.trim()) {
    throw new Error("OpenAI returned an empty response.");
  }

  return text;
}

async function readOpenAITextStream(
  response: Response,
  onTextDelta: (delta: string) => void,
  onStatus?: (status: {
    status?: string;
    eventCount?: number;
    receivedChars?: number;
  }) => void
): Promise<string> {
  if (!response.ok) {
    const responseJson = (await response.json()) as OpenAIResponseBody;
    const message =
      responseJson.error?.message ||
      `OpenAI request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (!response.body) {
    throw new Error("OpenAI returned an empty stream.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let eventCount = 0;
  let receivedChars = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine.startsWith("data:")) {
        continue;
      }

      const rawData = trimmedLine.slice(5).trim();
      if (!rawData || rawData === "[DONE]") {
        continue;
      }

      try {
        const event = JSON.parse(rawData) as {
          type?: string;
          delta?: string;
          output_text?: string;
          response?: OpenAIResponseBody;
        };
        eventCount += 1;
        if (event.type && (eventCount <= 12 || eventCount % 50 === 0)) {
          onStatus?.({
            status: `OpenAI stream event: ${event.type}`,
            eventCount,
            receivedChars
          });
        }
        const delta =
          typeof event.delta === "string"
            ? event.delta
            : typeof event.output_text === "string"
              ? event.output_text
              : "";
        if (delta) {
          text += delta;
          receivedChars += delta.length;
          onTextDelta(delta);
          if (receivedChars < 600 || receivedChars % 2000 < delta.length) {
            onStatus?.({
              status: `Receiving project JSON: ${receivedChars} characters`,
              eventCount,
              receivedChars
            });
          }
        }
      } catch {
        // Ignore keepalive or malformed stream fragments.
      }
    }
  }

  onStatus?.({
    status: `OpenAI stream finished. Total: ${receivedChars} characters in ${eventCount} events.`,
    eventCount,
    receivedChars
  });

  if (!text.trim()) {
    throw new Error("OpenAI returned an empty response.");
  }

  return text;
}

function createAIAbortController(requestId: string | undefined): AbortController {
  const abortController = new AbortController();
  if (requestId) {
    activeAIRequests.set(requestId, abortController);
  }
  return abortController;
}

function cleanupAIAbortController(requestId: string | undefined) {
  if (requestId) {
    activeAIRequests.delete(requestId);
  }
}

function extractOpenAIText(responseJson: OpenAIResponseBody): string {
  if (typeof responseJson.output_text === "string") {
    return responseJson.output_text;
  }

  return (responseJson.output ?? [])
    .flatMap((outputItem) => outputItem.content ?? [])
    .map((contentItem) => contentItem.text ?? "")
    .join("\n")
    .trim();
}

async function callOpenAIImage({
  prompt,
  referenceImagePaths = [],
  imageModel,
  imageSize,
  imageQuality,
  preserveReferenceCanvas = false,
  signal
}: {
  prompt: string;
  referenceImagePaths?: string[];
  imageModel?: string;
  imageSize?: string;
  imageQuality?: string;
  preserveReferenceCanvas?: boolean;
  signal?: AbortSignal;
}): Promise<string> {
  const settings = await readAISettings();
  const apiKey = settings.apiKey || process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OpenAI API key is not set. Open AI Assistant settings and paste your API key first."
    );
  }

  const model = normalizeImageModel(imageModel);
  const size = normalizeImageSize(imageSize, model);
  const quality = normalizeImageQuality(imageQuality);
  const referenceRequirement = referenceImagePaths.length > 0
    ? preserveReferenceCanvas
      ? "LOCKED CANVAS REQUIREMENT: Treat the attached image as the complete frame to edit. Preserve its exact aspect ratio, orientation, crop boundaries, camera, subject scale, and visible content. Never expand the view or infer missing anatomy. Change only the details explicitly requested and keep everything else unchanged."
      : "IDENTITY REFERENCE REQUIREMENT: The attached images define the character's identity. The generated image must depict the same recognizable character, preserving facial structure, distinctive features, hair or fur pattern, body shape, costume, and key colors. Change only pose, action, camera, lighting, and environment as requested by the prompt. Do not copy text or UI from the references."
    : "";
  const imagePrompt = [
    prompt.trim(),
    referenceRequirement
  ].join("\n");

  const validReferencePaths = await filterReadableImagePaths(referenceImagePaths.slice(0, 3));
  if (referenceImagePaths.length > 0 && validReferencePaths.length === 0) {
    throw new Error(
      "The selected reference images could not be read. Reopen the project or select the reference files again."
    );
  }
  const response =
    validReferencePaths.length > 0
      ? await callOpenAIImageEdit({
          apiKey,
          model,
          prompt: imagePrompt,
          imagePaths: validReferencePaths,
          size,
          quality,
          signal
        })
      : await callOpenAIImageGeneration({
          apiKey,
          model,
          prompt: imagePrompt,
          size,
          quality,
          signal
        });

  const responseJson = (await response.json()) as OpenAIImageResponseBody;

  if (!response.ok) {
    const message =
      responseJson.error?.message ||
      `OpenAI image request failed with status ${response.status}`;
    throw new Error(message);
  }

  const imageResult = responseJson.data?.find((item) => item.b64_json || item.url);

  if (!imageResult) {
    throw new Error("OpenAI did not return an image.");
  }

  const imagesDir = getGeneratedImagesDirectory();
  await mkdir(imagesDir, { recursive: true });
  const filePath = join(
    imagesDir,
    `scene-image-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`
  );
  let imageBuffer: Buffer;
  if (imageResult.b64_json) {
    imageBuffer = Buffer.from(imageResult.b64_json, "base64");
  } else if (imageResult.url) {
    const imageResponse = await fetch(imageResult.url, { signal });
    if (!imageResponse.ok) {
      throw new Error(`Could not download generated image: ${imageResponse.status}`);
    }
    imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  } else {
    throw new Error("OpenAI returned an empty image result.");
  }
  await writeFile(filePath, compressGeneratedImage(imageBuffer));
  return filePath;
}

async function callOpenAIImageGeneration({
  apiKey,
  model,
  prompt,
  size,
  quality,
  signal
}: {
  apiKey: string;
  model: string;
  prompt: string;
  size: string;
  quality: "low" | "medium" | "high";
  signal?: AbortSignal;
}): Promise<Response> {
  return fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      quality
    })
  });
}

async function callOpenAIImageEdit({
  apiKey,
  model,
  prompt,
  imagePaths,
  size,
  quality,
  signal
}: {
  apiKey: string;
  model: string;
  prompt: string;
  imagePaths: string[];
  size: string;
  quality: "low" | "medium" | "high";
  signal?: AbortSignal;
}): Promise<Response> {
  const formData = new FormData();
  formData.set("model", model);
  formData.set("prompt", prompt);
  formData.set("size", size);
  formData.set("quality", quality);

  for (const imagePath of imagePaths) {
    const dataImage = parseImageDataUrl(imagePath);
    const buffer = dataImage?.buffer ?? await readFile(imagePath);
    const mimeType = dataImage?.mimeType ?? getImageMimeType(extname(imagePath).toLowerCase());
    const fileName = dataImage?.fileName ?? basename(imagePath);
    const blob = new Blob([buffer], { type: mimeType });
    formData.append("image[]", blob, fileName);
  }

  return fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body: formData
  });
}

async function filterReadableImagePaths(imagePaths: string[]): Promise<string[]> {
  const readablePaths: string[] = [];
  for (const imagePath of imagePaths) {
    const normalizedPath = normalizeLocalImagePath(imagePath);
    if (!normalizedPath) {
      continue;
    }

    const dataImage = parseImageDataUrl(normalizedPath);
    if (normalizedPath.startsWith("data:")) {
      if (dataImage && dataImage.buffer.length > 0) {
        readablePaths.push(normalizedPath);
      }
      continue;
    }

    const extension = extname(normalizedPath).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
      continue;
    }

    try {
      await access(normalizedPath);
      readablePaths.push(normalizedPath);
    } catch {
      // Ignore missing references instead of failing the whole queue.
    }
  }
  return readablePaths;
}

function parseImageDataUrl(
  source: string
): { buffer: Buffer; mimeType: string; fileName: string } | null {
  const match = source.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=\s]+)$/);
  if (!match) {
    return null;
  }
  const mimeType = match[1].toLowerCase();
  const extension = mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
  return {
    buffer: Buffer.from(match[2].replace(/\s/g, ""), "base64"),
    mimeType,
    fileName: `reference.${extension}`
  };
}

function normalizeImageModel(imageModel: string | undefined): string {
  const model = imageModel?.trim();
  if (
    model === "gpt-image-2" ||
    model === "gpt-image-1.5" ||
    model === "gpt-image-1" ||
    model === "gpt-image-1-mini"
  ) {
    return model;
  }

  return "gpt-image-2";
}

function normalizeImageSize(imageSize: string | undefined, imageModel: string): string {
  const size = imageSize?.trim();
  if (size === "auto") return size;
  if (size === "1024x1024" || size === "1024x1536" || size === "1536x1024") {
    return size;
  }

  if (imageModel === "gpt-image-2") {
    const customSize = size?.match(/^(\d{2,4})x(\d{2,4})$/);
    if (customSize) {
      const width = Number(customSize[1]);
      const height = Number(customSize[2]);
      const ratio = Math.max(width / height, height / width);
      const totalPixels = width * height;
      if (
        width <= 3840 &&
        height <= 3840 &&
        width % 16 === 0 &&
        height % 16 === 0 &&
        ratio <= 3 &&
        totalPixels >= 655_360 &&
        totalPixels <= 8_294_400
      ) {
        return size!;
      }
    }
  }

  return "1024x1536";
}

function normalizeImageQuality(imageQuality: string | undefined): "low" | "medium" | "high" {
  return imageQuality === "medium" || imageQuality === "high" ? imageQuality : "low";
}

function compressGeneratedImage(sourceBuffer: Buffer): Buffer {
  const targetBytes = 600 * 1024;
  let image = nativeImage.createFromBuffer(sourceBuffer);
  if (image.isEmpty()) {
    throw new Error("The generated image could not be decoded for project-friendly compression.");
  }

  for (let resizePass = 0; resizePass < 7; resizePass += 1) {
    for (let quality = 86; quality >= 44; quality -= 6) {
      const jpeg = image.toJPEG(quality);
      if (jpeg.length <= targetBytes) return jpeg;
    }
    const size = image.getSize();
    if (size.width <= 640 || size.height <= 640) break;
    image = image.resize({
      width: Math.max(640, Math.round(size.width * 0.88)),
      height: Math.max(640, Math.round(size.height * 0.88)),
      quality: "better"
    });
  }
  return image.toJPEG(42);
}

async function readImageAsDataUrl(imagePath: string): Promise<string> {
  const trimmedPath = imagePath.trim();
  if (!trimmedPath) {
    return "";
  }

  if (trimmedPath.startsWith("data:image/")) {
    return trimmedPath;
  }

  const sourcePath = normalizeLocalImagePath(trimmedPath);
  if (!sourcePath) {
    return "";
  }

  const extension = extname(sourcePath).toLowerCase();
  if (![".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(extension)) {
    return "";
  }

  const imageBuffer = await readFile(sourcePath);
  return `data:${getImageMimeType(extension)};base64,${imageBuffer.toString("base64")}`;
}

function extractJsonObject(value: string): string {
  const trimmed = value.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed;
  const startIndex = candidate.indexOf("{");
  const endIndex = candidate.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("AI did not return a JSON project.");
  }

  const jsonText = candidate.slice(startIndex, endIndex + 1);
  JSON.parse(jsonText);
  return jsonText;
}

function parseStoryBlockReview(value: string): {
  passes: boolean;
  problems: string[];
  rewriteInstruction: string;
} {
  try {
    const parsed = JSON.parse(extractJsonObject(value)) as {
      passes?: unknown;
      problems?: unknown;
      rewriteInstruction?: unknown;
    };
    return {
      passes: Boolean(parsed.passes),
      problems: Array.isArray(parsed.problems)
        ? parsed.problems.map((problem) => String(problem)).slice(0, 8)
        : [],
      rewriteInstruction:
        typeof parsed.rewriteInstruction === "string"
          ? parsed.rewriteInstruction.slice(0, 3000)
          : ""
    };
  } catch {
    return {
      passes: false,
      problems: ["Reviewer did not return valid review JSON."],
      rewriteInstruction:
        "Review failed. Re-check the latest block for continuity with the approved plan and previous scenes, then fix only the affected scenes."
    };
  }
}

function createProjectLogicAuditChunks(projectJson: string, batchSize: number): string[] {
  try {
    const project = JSON.parse(projectJson) as { scenes?: unknown };
    const scenes = Array.isArray(project.scenes)
      ? project.scenes.filter(
          (scene): scene is Record<string, unknown> =>
            typeof scene === "object" && scene !== null && !Array.isArray(scene)
        )
      : [];
    const sceneMap = new Map(
      scenes.map((scene) => [String(scene.id ?? ""), scene] as const).filter(([id]) => id !== "")
    );
    const safeBatchSize = Math.max(1, Math.min(40, Math.floor(batchSize)));
    const chunks: string[] = [];

    for (let offset = 0; offset < scenes.length; offset += safeBatchSize) {
      const block = scenes.slice(offset, offset + safeBatchSize).map((scene) => {
        const choices = Array.isArray(scene.choices)
          ? scene.choices.filter(
              (choice): choice is Record<string, unknown> =>
                typeof choice === "object" && choice !== null && !Array.isArray(choice)
            )
          : [];
        const choiceLines = choices.map((choice) => {
          const targetId = String(choice.targetNodeId ?? "");
          const target = sceneMap.get(targetId);
          return [
            `CHOICE ${String(choice.id ?? "")}: ${String(choice.text ?? "")} -> ${targetId}`,
            `TARGET PREVIEW: ${target ? `${String(target.title ?? "")} | ${String(target.text ?? "").slice(0, 420)}` : "MISSING"}`
          ].join("\n");
        });
        return [
          `SOURCE ${String(scene.id ?? "")} [${String(scene.sceneType ?? "normal")}]: ${String(scene.title ?? "")}`,
          `TEXT: ${String(scene.text ?? "").slice(0, 700)}`,
          choiceLines.length > 0 ? choiceLines.join("\n") : "CHOICES: none"
        ].join("\n");
      });
      chunks.push(block.join("\n\n"));
    }
    return chunks;
  } catch {
    return [];
  }
}

function createValidationMemoryExcerpt(memoryLibrary: string | undefined): string {
  const memory = String(memoryLibrary ?? "").trim();
  if (!memory) {
    return "Not provided.";
  }
  if (memory.length <= 16000) {
    return memory;
  }
  return `${memory.slice(0, 8000)}\n\n[...middle omitted...]\n\n${memory.slice(-8000)}`;
}

function createLeanStoryPlannerSystemPrompt(): string {
  return [
    "You are the story writer. Write a complete interactive text-quest blueprint before it is converted to technical project JSON.",
    "Return only one raw JSON object. No Markdown, prose outside JSON, tables, questions, or approval requests.",
    "Blueprint shape: {\"title\":\"\",\"premise\":\"\",\"tone\":\"\",\"scenes\":[{\"key\":\"walk_atm_grandpa\",\"branchId\":\"walk_grandpa\",\"characters\":[\"erik\",\"grandpa\"],\"location\":\"ATM\",\"title\":\"\",\"purpose\":\"\",\"arrivalReason\":\"\",\"beat\":\"\",\"text\":\"finished scene prose shown to the player\",\"sceneType\":\"normal\",\"choices\":[{\"text\":\"short player action\",\"targetKey\":\"walk_insult_grandpa\",\"immediateConsequence\":\"what happens immediately\"}]}]}.",
    "Follow the user's premise, tone, characters, requested scene count, endings, and previous discussion.",
    "This is not a linear story with decorative buttons. Every player choice is a concrete action that must cause a different immediate consequence.",
    "Hard rule: choices in the same scene must lead to different next scene ids. Branches may merge only later, after each branch has shown its own consequence scene.",
    "If there is only one possible next event, plan one honest choice instead of two fake choices.",
    "Return exactly the requested number of scenes. Give every scene a unique lowercase semantic key that describes its event. Never write scene_1, scene_2, or any technical scene number; the application assigns those later.",
    "Plan the entire requested story now, including its beginning, escalation, payoffs, multiple developed branches, and distinct ending scenes.",
    "Every normal scene needs at least one choice. Every ending scene uses sceneType ending and choices:[].",
    "Use one-choice normal scenes only for a necessary consequence, transition, or payoff. Across the full story, repeatedly create real decision scenes with two or more meaningful actions.",
    "For a story of 8 or more scenes, create at least two main endings and at least two real branching decisions; larger stories need roughly one real branching decision per 8 scenes.",
    "Shape the story as deliberate funnels: choices split into developed consequence routes, compatible routes may converge later, and the accumulated decisions must feed several main endings. Do not create one disguised linear path.",
    "Every scene must be reachable from scene_1, and every reachable normal scene must have at least one route to an ending.",
    "Every targetKey must refer to a later scene in the scenes array. Do not use backward links or cycles to fill the requested scene count.",
    "Major branches must keep their own characters, causes, consequences, and fitting endings. Never merge incompatible antagonists or punishments into one generic scene.",
    "For every scene provide branchId, complete characters present, location, concrete purpose, arrivalReason, beat, finished player-facing text, and each choice's exact button text, targetKey, and immediateConsequence.",
    "Make every target logically follow the exact action the player selected. Do not insert random locations, characters, conflicts, or filler scenes.",
    "Do not plan flags or parameters. Direct scene branches and distinct consequence scenes carry all story logic.",
    "Endings must resolve the central conflict and have no outgoing choices.",
    "Before finishing, audit every choice-target pair and correct fake choices, accidental loops, missing targets, and forgotten branches."
  ].join("\n");
}

function createLeanStoryArchitectureSystemPrompt(): string {
  return [
    "You are a story architect, not a JSON project builder.",
    "Return one raw JSON object and nothing else.",
    "Shape: {\"title\":\"\",\"premise\":\"\",\"tone\":\"\",\"centralConflict\":\"\",\"characters\":[{\"key\":\"\",\"role\":\"\"}],\"scenePlan\":[{\"key\":\"meaningful_event_key\",\"purpose\":\"\",\"allowedCharacters\":[],\"location\":\"\",\"sceneType\":\"normal\",\"outgoingTargets\":[]}],\"continuityRules\":[],\"thingsToAvoid\":[]}.",
    "Follow the user's premise, tone, characters, requested endings, and recent discussion exactly.",
    "Create an ordered list of concrete story beats: opening, different route consequences, escalation, payoffs, and distinct endings. Earlier route decisions must change actual events, not merely wording.",
    "This must be an interactive branching story, never a linear story with decorative buttons.",
    "Plan different events for different decisions. Compatible routes may converge only after their separate consequences are shown.",
    "Use short unique lowercase English semantic keys. Do not use technical scene numbers.",
    "Mark the intended final outcomes with sceneType ending. The Builder will assign the exact graph and final count, so make neighboring beats flexible enough to connect causally without random jumps.",
    "Do not add flags or parameters. Keep the map concise; finished prose is written later."
  ].join("\n");
}

function createLeanStoryBlueprintChunkSystemPrompt(): string {
  return [
    "You are the only story writer. Write one small block of a planned interactive text quest.",
    "Return only raw JSON: {\"scenes\":[{\"key\":\"walk_atm_grandpa\",\"branchId\":\"walk_grandpa\",\"characters\":[\"erik\",\"grandpa\"],\"location\":\"ATM\",\"title\":\"\",\"purpose\":\"\",\"arrivalReason\":\"\",\"beat\":\"\",\"text\":\"finished scene prose shown to the player\",\"sceneType\":\"normal\",\"choices\":[{\"text\":\"short player action\",\"targetKey\":\"walk_insult_grandpa\",\"immediateConsequence\":\"exact immediate result\"}]}]}.",
    "Return exactly the requested keys in order and do not rewrite approved scenes.",
    "Copy branchId, sceneType, and the exact outgoing target keys from the supplied map. The Builder owns those links.",
    "Write polished scene titles and player-facing prose, not outline notes.",
    "For every outgoing target write one short player-action button and a different immediate consequence.",
    "Read each COMPLETE target contract before naming its button. Derive the button action from the target's purpose, location, structuralRole, incomingSources, and causalConstraint; never derive it only from the current scene.",
    "A mishap, cheating, betrayal, punishment, or chaotic ending requires an explicitly risky or dishonest button. An innocent action such as warming up, listening, helping, or walking calmly can never secretly produce that result.",
    "The target scene must begin as a logical result of that exact action, including when it is written in a later block.",
    "Earlier route choices must create visible route-specific events. Do not make all earlier scenes cosmetic preparation for one final good-versus-bad switch.",
    "When a resolution scene points to one ending and one later resolution scene, write a real consequence now versus a concrete further attempt; do not disguise them as equivalent warm-up actions.",
    "Do not collapse two choices into the same immediate event. Do not invent extra targets, loops, flags, parameters, characters, or conflicts.",
    "At a convergence, arrivalReason and scene text must make sense for every incoming route and acknowledge how the player arrived.",
    "Ending scenes have choices:[]. All other scenes follow the supplied outgoing targets."
  ].join("\n");
}

function createSemanticStoryChunkReviewerSystemPrompt(): string {
  return [
    "You are the second independent story editor. You never write project JSON and never praise the writer.",
    "Return only raw JSON: {\"passes\":true,\"problems\":[],\"rewriteInstruction\":\"\"}.",
    "Review each source scene, button action, immediateConsequence, and target semantic scene as one causal chain.",
    "Fail a button if it contains narration rather than a concise player action, or if the target scene does not visibly begin with the result of that exact action.",
    "Fail branch contamination: characters, relatives, locations, knowledge, punishments, or unresolved events from another branch may not appear unless the architecture explicitly uses a shared convergence scene.",
    "Fail filler choices, duplicate consequences, abrupt jumps, unexplained arrivals, generic punishment scenes, and characters who appear without setup.",
    "Fail any neutral or innocent button that secretly leads to cheating, betrayal, punishment, chaos, or the opposite moral meaning.",
    "Fail a block that postpones all meaningful consequences to a final binary choice while earlier branches only change travel or preparation wording.",
    "Fail a supposedly interactive block if normal scenes omit player actions, if planned branches are silently removed, or if different routes are collapsed before their distinct consequences are shown.",
    "Check branchId, characters, location, arrivalReason, scene text, and choices against the master architecture and approved scenes.",
    "Pass only when a human reader can follow why every new scene happened and which earlier player choice caused it.",
    "Name semantic scene keys and exact choice text in concise problems. rewriteInstruction must tell the writer how to repair only this block."
  ].join("\n");
}

function createLeanProjectWriterSystemPrompt(): string {
  return [
    "You convert an already approved interactive text-quest plan into StoryLife Builder JSON.",
    "Return only one raw JSON object. No Markdown, commentary, questions, or promises to continue later.",
    "Do not invent a new plot. Follow the supplied full story plan scene by scene.",
    "The project is an interactive text quest: every choice is a concrete player action with a different immediate consequence.",
    "Hard rule: choices in the same scene must have different targetNodeId values. If only one next event exists, use one honest choice.",
    "Branches may converge only after separate consequence scenes. Never use flags or parameters to disguise same-target buttons.",
    "Use sequential scene ids scene_1 through scene_N and choice ids choice_1_1, choice_1_2, and so on.",
    "flags must be []. parameters must be []. Never create parameter or flag effects and conditions.",
    "For a requested partial block, return exactly the requested number of scene objects in the requested sequential id order.",
    "For a requested partial prose block, set choices:[] on every scene because the app restores the approved complete choice graph after all blocks are written.",
    ...createLeanProjectSchemaRules(),
    "In a one-shot complete project, ending scenes use sceneType:\"ending\" and choices:[], while normal scenes need honest choices. The temporary partial-block rule above is the only exception.",
    "The following six-scene JSON is ONLY a tiny teaching fragment that demonstrates valid schema and the rule choice -> distinct consequence.",
    "It is not a recommended story size or complete branch design. The real project must contain the full requested number of scenes, many developed branches and choices, longer consequence chains, meaningful later convergences, and all requested distinct endings.",
    "Never shorten a requested large story to the size or topology of this example. Copy only its JSON structure and causal branching principle, never its story content:",
    createGoldStandardProjectExample(),
    "Before returning, parse the JSON mentally and audit every scene: valid target, distinct choice targets, logical consequence, no fake choice, no random jump."
  ].join("\n");
}

function createLeanProjectExpansionSystemPrompt(): string {
  return [
    "You turn the requested slice of an approved interactive text-quest blueprint into finished scene prose and return one raw JSON patch object.",
    "Return JSON only. Never return the full project.",
    "Patch shape: {\"storyBible\":{},\"storyStyles\":[],\"flags\":[],\"parameters\":[],\"updatedScenes\":[],\"newScenes\":[]}.",
    "Return every exact required scene id once, in the supplied order. Never skip an id, jump ahead, duplicate an id, or add another scene.",
    "Use the matching blueprint title, purpose, arrivalReason, and beat to write vivid finished scene text. Do not change the plot or substitute another blueprint scene.",
    "updatedScenes must be []. The app restores all choices and links from the approved full blueprint after the final prose chunk.",
    "Set choices:[] on every new scene in this temporary prose patch. Do not attempt to connect chunks and do not create targets or outcomes.",
    "flags must be []. parameters must be []. Never create effects or conditions.",
    ...createLeanProjectSchemaRules(false),
    "Continue character knowledge, location, causal events, and tone from the supplied plan and project memory.",
    "Before returning, audit the newScenes ids against the exact required list and parse the JSON mentally."
  ].join("\n");
}

function createLeanStoryBlueprintReviewerSystemPrompt(): string {
  return [
    "You are a strict story editor reviewing a complete interactive text-quest blueprint before JSON production.",
    "Return only raw JSON: {\"passes\":true,\"problems\":[],\"rewriteInstruction\":\"\"}.",
    "The graph is already structurally valid. Judge narrative logic, not JSON syntax.",
    "Fail repetitive filler loops, repeated versions of the same choice, branches that differ only in wording, and choices that change only route length.",
    "Fail characters who appear or know facts without setup, events not caused by previous choices, and random locations or punishments.",
    "Fail merged scenes that generically combine incompatible incoming routes, antagonists, locations, or consequences.",
    "Fail a large blueprint that behaves like one linear chain: it needs repeated real branching decisions, later compatible convergence, and several main endings caused by the accumulated routes.",
    "Each major branch must preserve its identity and receive developed consequences and a fitting resolution. Do not collapse distinct branches into one generic ending unless the original request explicitly requires one and the convergence is fully justified.",
    "Check every scene purpose, arrivalReason, beat, finished text, choice text, immediateConsequence, and target scene together.",
    "Pass only if an ordinary human reader would recognize one coherent authored interactive story rather than a graph assembled to satisfy scene count.",
    "List concise concrete problems with scene ids. rewriteInstruction must tell the planner how to rewrite the full blueprint."
  ].join("\n");
}

function createLeanStoryBlockReviewerSystemPrompt(): string {
  return [
    "You are a strict editor of an interactive text quest.",
    "Return only raw JSON: {\"passes\":true,\"problems\":[],\"rewriteInstruction\":\"\"}.",
    "Review every supplied scene and every choice-target pair against the approved full story plan.",
    "Fail if two choices in one scene share the same immediate target, if a target does not logically follow its choice, or if a branch forgets its premise.",
    "Fail random jumps, filler choices, accidental loops, unexplained characters, early fake endings, parameters, and decorative state bookkeeping.",
    "Pass only when this block is a coherent part of one interactive story. Name exact scene ids and choice text in problems."
  ].join("\n");
}

function createLeanProjectDraftValidatorSystemPrompt(): string {
  return [
    "You are the final quality gate for a complete interactive text quest.",
    "Return only raw JSON: {\"passes\":true,\"score\":90,\"problems\":[]}.",
    "Inspect every source scene and its target previews. Every choice must cause a logical and different immediate consequence.",
    "Fail same-target buttons, fake choices, unrelated jumps, accidental loops, forgotten branches, incoherent characters, filler scenes, and endings unrelated to previous decisions.",
    "Branches may merge only after each route has shown its own consequence. A story with one unavoidable path disguised by buttons must fail.",
    "Fail all parameters, parameter effects, and parameter conditions. Report unnecessary flags as problems.",
    "Use concrete scene ids and choice text. passes requires score >= 75 and an empty problems array. Do not rewrite the project."
  ].join("\n");
}

function createLeanProjectEditSystemPrompt(): string {
  return [
    "You repair an existing StoryLife Builder interactive text-quest JSON by returning one raw patch object.",
    "Return JSON only. Patch shape: {\"storyBible\":{},\"storyStyles\":[],\"flags\":[],\"parameters\":[],\"updatedScenes\":[],\"newScenes\":[]}.",
    "Keep the same story and stable scene ids. Update at most 8 scenes and add at most 4 genuinely necessary consequence scenes.",
    "When fixing fake choices, give each choice a different immediate target that logically follows the exact action, or keep one honest choice if no branch exists.",
    "Branches may converge later, never immediately. Do not create random links just to make target ids different.",
    "parameters must be []. Never add parameter effects or conditions. Do not add flags to fake consequences.",
    ...createLeanProjectSchemaRules(false),
    "All targets must exist in the current project or this patch. Preserve unrelated valid scenes, media, layouts, and positions."
  ].join("\n");
}

function createLeanProjectSchemaRules(includeProjectRoot = true): string[] {
  return [
    ...(includeProjectRoot
      ? [
          "Project root requires version:1, projectName, startSceneId, storyBible, storyStyles, flags, parameters, scenes."
        ]
      : []),
    "Each scene requires id,title,text,imagePath,soundPath,soundVolume,soundFadeInSeconds,soundFadeOutSeconds,layoutType,fadeMusicOnSceneSound,sceneType,nodeColor,style,authorNotes,position,choices.",
    "Use style:{} unless preserving an existing style. position is {\"x\":number,\"y\":number}.",
    "Each choice requires id,text,targetNodeId,useMultipleOutcomes,outcomes,conditionalTargets,effects,conditions,conditionFailBehavior.",
    "Normal choice shape uses useMultipleOutcomes:false, one 100-percent outcome to the same targetNodeId, and empty conditionalTargets/effects/conditions.",
    "conditionFailBehavior is \"hidden\". layoutType is imageTop,imageBackground,textFirst,splitLayout,fullImageMoment,dialogueStyle,or noImage."
  ];
}

function createGoldStandardProjectExample(): string {
  const scene = (
    id: string,
    title: string,
    text: string,
    sceneType: "normal" | "ending",
    position: { x: number; y: number },
    choices: unknown[]
  ) => ({
    id,
    title,
    text,
    imagePath: "",
    soundPath: "",
    soundVolume: 1,
    soundFadeInSeconds: 0,
    soundFadeOutSeconds: 0,
    layoutType: "textFirst",
    fadeMusicOnSceneSound: true,
    sceneType,
    nodeColor: sceneType === "ending" ? "amber" : "slate",
    style: {},
    authorNotes: "",
    position,
    choices
  });
  const choice = (id: string, text: string, targetNodeId: string) => ({
    id,
    text,
    targetNodeId,
    useMultipleOutcomes: false,
    outcomes: [{ id: `outcome_${id}`, targetSceneId: targetNodeId, percent: 100 }],
    conditionalTargets: [],
    effects: [],
    conditions: [],
    conditionFailBehavior: "hidden"
  });

  return JSON.stringify({
    version: 1,
    projectName: "Example Quest",
    startSceneId: "scene_1",
    storyBible: {
      premise: "A traveler must reach a closed station.",
      genre: "adventure",
      tone: "tense but grounded",
      protagonist: "Traveler",
      coreConflict: "Reach the last train.",
      currentArcSummary: "Two routes create different consequences before converging.",
      keyCharacters: [],
      worldRules: [],
      openMysteries: [],
      resolvedMysteries: [],
      promisesToPayOff: [],
      importantPastEvents: [],
      continuityNotes: [],
      endingPlan: ["Catch the train", "Miss the train"],
      chapterPlan: []
    },
    storyStyles: ["adventure"],
    flags: [],
    parameters: [],
    scenes: [
      scene(
        "scene_1",
        "Blocked Street",
        "The traveler sees a locked gate and hears the last train in the distance.",
        "normal",
        { x: 0, y: 0 },
        [
          choice("choice_1_1", "Climb over the gate", "scene_2"),
          choice("choice_1_2", "Run through the market", "scene_3")
        ]
      ),
      scene(
        "scene_2",
        "Cut Hands",
        "The traveler lands behind the gate with bleeding palms but gains a shortcut.",
        "normal",
        { x: -220, y: 180 },
        [choice("choice_2_1", "Push through the pain toward the platform", "scene_4")]
      ),
      scene(
        "scene_3",
        "Crowded Market",
        "The traveler avoids injury but loses time squeezing through closing stalls.",
        "normal",
        { x: 220, y: 180 },
        [choice("choice_3_1", "Leave the market and sprint to the platform", "scene_4")]
      ),
      scene(
        "scene_4",
        "Last Platform",
        "Both routes reach the platform for different reasons and the train doors begin to close.",
        "normal",
        { x: 0, y: 360 },
        [
          choice("choice_4_1", "Jump through the closing doors", "scene_5"),
          choice("choice_4_2", "Stop and help a fallen passenger", "scene_6")
        ]
      ),
      scene(
        "scene_5",
        "On Board",
        "The traveler catches the train and watches the station disappear behind the window.",
        "ending",
        { x: -220, y: 540 },
        []
      ),
      scene(
        "scene_6",
        "Train Departed",
        "The train leaves, but the rescued passenger offers the traveler another way forward.",
        "ending",
        { x: 220, y: 540 },
        []
      )
    ]
  });
}

function createSceneSubsetJson(projectJson: string, sceneIds: string[]): string {
  try {
    const project = JSON.parse(projectJson) as {
      scenes?: unknown;
      flags?: unknown;
      storyBible?: unknown;
      storyStyles?: unknown;
    };
    const sceneIdSet = new Set(sceneIds);
    const scenes = Array.isArray(project.scenes)
      ? project.scenes.filter((scene) => {
          if (!scene || typeof scene !== "object") {
            return false;
          }
          const id = (scene as { id?: unknown }).id;
          return typeof id === "string" && sceneIdSet.has(id);
        })
      : [];
    return JSON.stringify(
      {
        storyStyles: project.storyStyles,
        storyBible: project.storyBible,
        flags: project.flags,
        scenes
      },
      null,
      2
    ).slice(0, 24000);
  } catch {
    return "{}";
  }
}

function createProjectContextSummary(projectJson: string): string {
  try {
    const project = JSON.parse(projectJson) as {
      projectName?: unknown;
      startSceneId?: unknown;
      scenes?: Array<{
        id?: unknown;
        title?: unknown;
        sceneType?: unknown;
        choices?: Array<{ text?: unknown; targetNodeId?: unknown }>;
      }>;
      flags?: Array<{ id?: unknown; key?: unknown }>;
      parameters?: Array<{ id?: unknown; key?: unknown }>;
      storyBible?: Record<string, unknown>;
      storyStyles?: unknown;
    };
    const scenes = Array.isArray(project.scenes) ? project.scenes : [];
    const flags = Array.isArray(project.flags) ? project.flags : [];
    const parameters = Array.isArray(project.parameters) ? project.parameters : [];

    return [
      `projectName: ${typeof project.projectName === "string" ? project.projectName : "Untitled"}`,
      `startSceneId: ${typeof project.startSceneId === "string" ? project.startSceneId : "none"}`,
      `storyStyles: ${
        Array.isArray(project.storyStyles) ? project.storyStyles.map(String).join(", ") : "default"
      }`,
      `sceneCount: ${scenes.length}`,
      `flagCount: ${flags.length}`,
      `parameterCount: ${parameters.length}`,
      `storyBible: ${createStoryBibleSummary(project.storyBible)}`,
      `sceneMap: ${scenes
        .map((scene) => {
          const choices = Array.isArray(scene.choices) ? scene.choices : [];
          const links = choices
            .slice(0, 3)
            .map((choice) => `${String(choice.text ?? "choice")}->${String(choice.targetNodeId ?? "")}`)
            .join(",");
          return `${String(scene.id ?? "")}:${String(scene.title ?? "")}[${String(scene.sceneType ?? "normal")}]${links ? `{${links}}` : ""}`;
        })
        .join(" | ")
        .slice(0, 24000)}`,
      `flags: ${flags
        .slice(0, 20)
        .map((flag) => `${String(flag.id ?? "")}:${String(flag.key ?? "")}`)
        .join(" | ")}`,
      `parameters: ${parameters
        .slice(0, 20)
        .map((parameter) => `${String(parameter.id ?? "")}:${String(parameter.key ?? "")}`)
        .join(" | ")}`
    ].join("\n");
  } catch {
    return "No readable current project context.";
  }
}

function createStoryBibleSummary(storyBible: unknown): string {
  if (!storyBible || typeof storyBible !== "object") {
    return "empty";
  }

  const bible = storyBible as Record<string, unknown>;
  const read = (key: string) => String(bible[key] ?? "");
  const readList = (key: string) =>
    Array.isArray(bible[key]) ? (bible[key] as unknown[]).map(String).join(" | ") : "";
  const chapterPlan = Array.isArray(bible.chapterPlan)
    ? (bible.chapterPlan as Array<Record<string, unknown>>)
        .map((chapter) =>
          `${String(chapter.id ?? "")}:${String(chapter.title ?? "")}[${String(chapter.status ?? "")}] ${String(chapter.summary ?? "")}`
        )
        .join(" | ")
    : "";

  return [
    `premise=${read("premise")}`,
    `genre=${read("genre")}`,
    `tone=${read("tone")}`,
    `protagonist=${read("protagonist")}`,
    `coreConflict=${read("coreConflict")}`,
    `currentArc=${read("currentArcSummary")}`,
    `characters=${readList("keyCharacters")}`,
    `openMysteries=${readList("openMysteries")}`,
    `resolvedMysteries=${readList("resolvedMysteries")}`,
    `promises=${readList("promisesToPayOff")}`,
    `pastEvents=${readList("importantPastEvents")}`,
    `continuity=${readList("continuityNotes")}`,
    `endingPlan=${readList("endingPlan")}`,
    `chapterPlan=${chapterPlan}`
  ]
    .join("\n")
    .slice(0, 18000);
}

function formatAIChatHistory(
  chatHistory: Array<{ role: "user" | "assistant" | "system"; text: string }> | undefined
): string {
  if (!Array.isArray(chatHistory) || chatHistory.length === 0) {
    return "No recent chat history.";
  }

  return chatHistory
    .slice(-12)
    .map((message) => {
      const role =
        message.role === "user" ? "User" : message.role === "system" ? "System" : "Assistant";
      return `${role}: ${String(message.text ?? "").slice(0, 800)}`;
    })
    .join("\n\n")
    .slice(0, 9000);
}

function formatStoryMemory(storyMemory: string | undefined): string {
  const memory = String(storyMemory ?? "").trim();
  return memory ? compactStoryMemory(memory) : "No persistent story memory yet.";
}

function compactStoryMemory(storyMemory: string | { toString(): string }): string {
  const memory = String(storyMemory ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!memory) {
    return "";
  }

  if (looksLikeProjectJsonDump(memory)) {
    return "Story memory was ignored because it looked like a generated JSON/project dump instead of a compact creative brief.";
  }

  const maxLength = 6500;
  if (memory.length <= maxLength) {
    return memory;
  }

  const preferredSections = [
    "PROJECT PREMISE:",
    "GENRE AND TONE:",
    "STYLE RULES:",
    "MAIN CHARACTERS:",
    "PLOT DECISIONS AGREED WITH USER:",
    "CHOICE DESIGN RULES:",
    "OPTIONAL DISTANT CONSEQUENCES (USUALLY NONE):",
    "THINGS TO AVOID:",
    "OPEN QUESTIONS:"
  ];
  const lines = memory.split("\n");
  const keptLines: string[] = [];
  let currentSection = "";

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (preferredSections.includes(trimmedLine)) {
      currentSection = trimmedLine;
      keptLines.push(trimmedLine);
      continue;
    }

    if (!currentSection || trimmedLine === "") {
      continue;
    }

    const sectionLineCount = keptLines.filter((keptLine) => keptLine.startsWith("- ")).length;
    if (sectionLineCount > 48) {
      continue;
    }

    keptLines.push(line.slice(0, 700));
    if (keptLines.join("\n").length > maxLength) {
      break;
    }
  }

  const compacted = keptLines.join("\n").trim();
  return (compacted || memory.slice(0, maxLength)).slice(0, maxLength);
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

function createProjectTailSummary(projectJson: string): string {
  try {
    const project = JSON.parse(projectJson) as {
      scenes?: Array<{
        id?: unknown;
        title?: unknown;
        text?: unknown;
        sceneType?: unknown;
        choices?: Array<{ text?: unknown; targetNodeId?: unknown }>;
      }>;
    };
    const scenes = Array.isArray(project.scenes) ? project.scenes : [];

    return scenes
      .slice(-12)
      .map((scene) => {
        const choices = Array.isArray(scene.choices) ? scene.choices : [];
        return [
          `id: ${String(scene.id ?? "")}`,
          `title: ${String(scene.title ?? "")}`,
          `type: ${String(scene.sceneType ?? "normal")}`,
          `text: ${String(scene.text ?? "").slice(0, 420)}`,
          `choices: ${choices
            .map((choice) => `${String(choice.text ?? "")}->${String(choice.targetNodeId ?? "")}`)
            .join(" | ")}`
        ].join("; ");
      })
      .join("\n");
  } catch {
    return "No readable current project tail.";
  }
}

function createProjectFrontierSummary(projectJson: string): string {
  try {
    const project = JSON.parse(projectJson) as {
      scenes?: Array<{ id?: unknown; title?: unknown; sceneType?: unknown; choices?: unknown }>;
    };
    const frontierScenes = (Array.isArray(project.scenes) ? project.scenes : []).filter(
      (scene) =>
        scene &&
        typeof scene === "object" &&
        scene.sceneType !== "ending" &&
        Array.isArray(scene.choices) &&
        scene.choices.length === 0
    );
    return frontierScenes.length > 0
      ? frontierScenes
          .map((scene) => `${String(scene.id ?? "")}: ${String(scene.title ?? "")}`)
          .join("\n")
      : "none";
  } catch {
    return "unreadable";
  }
}

function createAssistantSystemPrompt(): string {
  return [
    "You are the built-in AI assistant for StoryLife Builder.",
    "Speak in Russian unless the user asks otherwise.",
    "Behave like a normal thoughtful ChatGPT conversation partner when the user is brainstorming or discussing a story.",
    "Be warm, practical, and conversational.",
    "Remember and use the recent chat history provided in the prompt.",
    "Use the persistent story memory as the user's approved creative direction. Do not contradict it casually.",
    "You understand interactive story projects made of scenes, choices, flags, layouts, images, and audio.",
    "When suggesting structural changes, describe what should change clearly.",
    "Do not invent features outside the current StoryLife Builder format.",
    "This chat response must not claim that you already changed the project unless the app explicitly used an edit/build action.",
    "If the user says they only want to discuss, brainstorm, think, or talk first, stay in discussion mode.",
    "If the user asks for a project generation or project edit from chat, explain briefly which button/action to use or that the app can apply it, but do not ask them to repeat context that is already in recent chat history.",
    "Style intelligence: match the requested genre and scale. A silly dog story can be funny, concrete, and playful; it must not become heavy philosophy unless the user asks for that tone.",
    "Avoid vague tragic phrases like 'accept fate', 'despite everything', 'smiritsya', or abstract soul-searching when the premise calls for physical action, humor, adventure, or simple clear choices."
  ].join("\n");
}

function createStoryMemorySystemPrompt(): string {
  return [
    "You maintain the persistent StoryLife Builder story memory.",
    "Write in Russian unless the user's story is clearly in another language.",
    "Return only the updated memory text. No Markdown fences.",
    "This memory is not prose. It is a compact creative brief for later project generation and editing.",
    "Hard limit: keep the whole memory under 4500 characters.",
    "Use short bullet points. Never include full scenes, full JSON, long excerpts, or generated project text.",
    "Preserve concrete user-approved facts from long chat discussions.",
    "Do not invent a new story. Do not add random drama.",
    "If the user is only joking or asking a technical question, keep the memory mostly unchanged.",
    "If the user changes direction, update the memory clearly and remove contradicted old decisions.",
    "Include sections:",
    "PROJECT PREMISE:",
    "GENRE AND TONE:",
    "STYLE RULES:",
    "MAIN CHARACTERS:",
    "PLOT DECISIONS AGREED WITH USER:",
    "CHOICE DESIGN RULES:",
    "OPTIONAL DISTANT CONSEQUENCES (USUALLY NONE):",
    "THINGS TO AVOID:",
    "OPEN QUESTIONS:",
    "Do not invent flags or parameters while updating memory. Parameters are forbidden. Mention a distant remembered consequence only when the user explicitly approved it.",
    "Style rule: match the story's genre. Comedy, children's adventure, slice-of-life, thriller, horror, romance, and absurd stories need different scene language and choices.",
    "Important: avoid melodramatic philosophical filler unless the user explicitly wants that. For example, a dog looking for a place to poop should get concrete dog actions and funny obstacles, not choices like 'accept fate'."
  ].join("\n");
}

function createStoryLogicAnalyzerSystemPrompt(): string {
  return [
    "You are a strict but useful StoryLife Builder narrative editor, screenwriter, and interactive game writer.",
    "Write in Russian.",
    "This is NOT a technical graph validator. Do not focus on JSON syntax, missing ids, or implementation details unless they directly damage story logic.",
    "Your job is to find narrative problems: illogical transitions, fake choices, forgotten consequences, character contradictions, forgotten conflicts, weak pacing, and railroading.",
    "Do not merely retell or summarize the story. Mention plot content only when it supports a specific problem or score.",
    "For every outgoing choice you inspect, ask: does the target scene logically follow from this exact player action? If the player chose 'go to the library', the next scene must happen in the library, show the consequence of going there, or clearly explain why the route changed.",
    "Check choice quality. A real choice changes information, danger, relationship, route, access, tone, character state, or future options. If different choices lead to almost the same result, call it a weak/fake choice.",
    "Check consequences. If a choice creates an event, promise, injury, secret, betrayal, discovery, conflict, or relationship change, verify that later scenes remember it. If it is forgotten, report it.",
    "Check characters. Report characters who appear without setup, disappear without explanation, know things they should not know, forget what happened, or behave against their established motive without a scene reason.",
    "Check conflicts. Identify conflicts that are introduced, developed, paid off, or forgotten. Report abandoned conflicts and conflicts that do not escalate.",
    "Check pacing. Find repeated scenes, empty scenes, scenes that do not change anything, and scenes that feel too similar.",
    "Check interactivity. Evaluate whether the story really branches or just moves on rails through bottlenecks that erase choices.",
    "Use scene ids/titles and choice text when possible. If a problem involves multiple scenes, list the most relevant scenes.",
    "Required report format:",
    "1. Общая оценка: 0-100",
    "2. Логика сюжета: 0-100",
    "3. Качество выборов: 0-100",
    "4. Интерактивность: 0-100",
    "5. Последствия: 0-100",
    "6. Персонажи: 0-100",
    "7. Темп: 0-100",
    "",
    "Then write:",
    "Короткий вердикт: 3-6 sentences maximum. No full plot retelling.",
    "",
    "Проблемы:",
    "For each problem use this exact structure:",
    "- Важность: Critical / Major / Medium / Minor",
    "- Сцена: scene id and title if available",
    "- Выбор: exact choice text if relevant, otherwise 'нет'",
    "- Описание проблемы: what is wrong",
    "- Почему это проблема: why it hurts the story/game",
    "- Как исправить: concrete rewrite/edit suggestion",
    "",
    "Required problem categories to cover when relevant:",
    "- Логика переходов",
    "- Фейковые или слабые выборы",
    "- Забытые последствия",
    "- Персонажи",
    "- Конфликты",
    "- Темп",
    "- Рельсовость / слабая интерактивность",
    "",
    "If a category has no serious issues, say briefly that no serious issue was found in that category.",
    "Be strict. If the project has many problems, say so clearly. If the story is good, still mention remaining risks and concrete improvements."
  ].join("\n");
}

function formatStoryStylePrompt(stylePrompt: string | undefined): string {
  const trimmedPrompt = typeof stylePrompt === "string" ? stylePrompt.trim() : "";
  if (trimmedPrompt) {
    return trimmedPrompt;
  }

  return [
    "Universal style rule: do not artificially dramatize every scene.",
    "If the story is simple, funny, domestic, absurd, or everyday, write it simply, vividly, and naturally.",
    "Do not turn every scene into tragedy, crisis, trauma, or philosophical drama.",
    "Default Adventure style: keep scenes active, concrete, event-driven, and exploratory.",
    "Default Cinematic style: use vivid visual staging, scene momentum, atmosphere, and strong set-pieces."
  ].join("\n");
}
