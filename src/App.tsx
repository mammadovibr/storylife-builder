import {
  ChangeEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { AIAssistantModal } from "./components/AIAssistantModal";
import { Canvas } from "./components/Canvas";
import { Inspector } from "./components/Inspector";
import { LeftPanel } from "./components/LeftPanel";
import { LogicManagers } from "./components/LogicManagers";
import { PlayMode } from "./components/PlayMode";
import { ProjectSettingsModal } from "./components/ProjectSettingsModal";
import { Toolbar } from "./components/Toolbar";
import {
  createChoice,
  createDefaultProject,
  createFlag,
  createParameter,
  createScene,
  FlagId,
  migrateProject,
  MediaAssetType,
  MediaFolder,
  ParameterId,
  Scene,
  SceneId,
  SceneNodeColor,
  serializeProject,
  StoryFlag,
  StoryParameter,
  StoryProject
} from "./domain/project";

type ResizeTarget = "left" | "logic" | "inspector";
type SaveState = "saved" | "unsaved" | "autosaved";
const AUTOSAVE_KEY = "storylife-autosave-v1";
const BACKUPS_KEY = "storylife-backups-v1";
const LAST_MANUAL_SAVE_KEY = "storylife-last-manual-save-v1";

export default function App() {
  const fallbackProjectInputRef = useRef<HTMLInputElement | null>(null);
  const [project, setProject] = useState<StoryProject>(() => createDefaultProject());
  const [selectedSceneId, setSelectedSceneId] = useState<SceneId | null>(
    project.startSceneId
  );
  const [playSceneId, setPlaySceneId] = useState<SceneId | null>(null);
  const [isProjectSettingsOpen, setProjectSettingsOpen] = useState(false);
  const [isAIAssistantOpen, setAIAssistantOpen] = useState(false);
  const [isProjectManagerOpen, setProjectManagerOpen] = useState(true);
  const [isLogicPanelCollapsed, setLogicPanelCollapsed] = useState(false);
  const [aiPanelWidth, setAIPanelWidth] = useState(420);
  const [pendingChoiceTarget, setPendingChoiceTarget] = useState<{
    sceneId: SceneId;
    choiceId: string;
  } | null>(null);
  const [canvasViewResetSignal, setCanvasViewResetSignal] = useState(0);
  const [canvasRefreshSignal, setCanvasRefreshSignal] = useState(0);
  const [canvasFocusSelectedSignal, setCanvasFocusSelectedSignal] = useState(0);
  const [status, setStatus] = useState("Ready");
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const firstProjectEffectRef = useRef(true);
  const projectRef = useRef(project);
  const selectedSceneIdRef = useRef<SceneId | null>(selectedSceneId);
  const copiedSceneRef = useRef<Scene | null>(null);
  const undoStackRef = useRef<StoryProject[]>([]);
  const redoStackRef = useRef<StoryProject[]>([]);
  const [panelSizes, setPanelSizes] = useState({
    left: 240,
    logic: 300,
    inspector: 420
  });
  const canExportGame = Boolean(window.storyLife?.exportGame);

  const selectedScene = useMemo(
    () => project.scenes.find((scene) => scene.id === selectedSceneId) ?? null,
    [project.scenes, selectedSceneId]
  );

  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  useEffect(() => {
    selectedSceneIdRef.current = selectedSceneId;
  }, [selectedSceneId]);

  useEffect(() => {
    function handleOfflineReady() {
      setStatus("Offline ready");
    }

    function handleOfflineError() {
      setStatus("Offline setup failed - reconnect and reload");
    }

    window.addEventListener("storylife:offline-ready", handleOfflineReady);
    window.addEventListener("storylife:offline-error", handleOfflineError);
    if (document.documentElement.dataset.offlineReady === "true") {
      handleOfflineReady();
    }
    return () => {
      window.removeEventListener("storylife:offline-ready", handleOfflineReady);
      window.removeEventListener("storylife:offline-error", handleOfflineError);
    };
  }, []);

  useEffect(() => {
    const resizeSignal = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });

    return () => window.cancelAnimationFrame(resizeSignal);
  }, [panelSizes, isLogicPanelCollapsed, selectedScene]);

  useEffect(() => {
    if (firstProjectEffectRef.current) {
      firstProjectEffectRef.current = false;
      return;
    }

    setSaveState("unsaved");
  }, [project]);

  useEffect(() => {
    if (saveState !== "unsaved") {
      return;
    }

    const autosaveTimer = window.setTimeout(() => {
      writeAutosave(project);
      setSaveState("autosaved");
      setStatus("Autosaved");
    }, 2500);

    return () => window.clearTimeout(autosaveTimer);
  }, [project, saveState]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (saveState === "unsaved") {
        writeAutosave(project);
        setSaveState("autosaved");
        setStatus("Autosaved");
      }
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [project, saveState]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      writeBackup(project);
    }, 300000);

    return () => window.clearInterval(intervalId);
  }, [project]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (saveState === "unsaved" || saveState === "autosaved") {
        event.preventDefault();
        event.returnValue = "Save before exit?";
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveState]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isAIAssistantOpen) {
        return;
      }

      if (isEditableTarget(event.target)) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void saveProject();
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        setCanvasFocusSelectedSignal((currentSignal) => currentSignal + 1);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelectedScene();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        event.preventDefault();
        pasteCopiedScene();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redoProjectChange();
        } else {
          undoProjectChange();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redoProjectChange();
        return;
      }

      if (event.key === "Backspace" || event.key === "Delete") {
        event.preventDefault();
        deleteSelectedScene();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  function commitProjectChange(
    updater: (currentProject: StoryProject) => StoryProject,
    trackHistory = true
  ) {
    setProject((currentProject) => {
      if (trackHistory) {
        undoStackRef.current = [...undoStackRef.current.slice(-49), currentProject];
        redoStackRef.current = [];
      }
      const nextProject = updater(currentProject);
      projectRef.current = nextProject;
      return nextProject;
    });
  }

  function undoProjectChange() {
    const previousProject = undoStackRef.current.pop();
    if (!previousProject) {
      setStatus("Nothing to undo");
      return;
    }

    redoStackRef.current.push(projectRef.current);
    setProject(previousProject);
    ensureSelectedSceneExists(previousProject);
    setSaveState("unsaved");
    setStatus("Undo");
  }

  function redoProjectChange() {
    const nextProject = redoStackRef.current.pop();
    if (!nextProject) {
      setStatus("Nothing to redo");
      return;
    }

    undoStackRef.current.push(projectRef.current);
    setProject(nextProject);
    ensureSelectedSceneExists(nextProject);
    setSaveState("unsaved");
    setStatus("Redo");
  }

  function ensureSelectedSceneExists(nextProject: StoryProject) {
    if (
      selectedSceneIdRef.current &&
      !nextProject.scenes.some((scene) => scene.id === selectedSceneIdRef.current)
    ) {
      setSelectedSceneId(nextProject.startSceneId);
    }
  }

  function clearProjectHistory() {
    undoStackRef.current = [];
    redoStackRef.current = [];
  }

  function copySelectedScene() {
    const scene = projectRef.current.scenes.find(
      (item) => item.id === selectedSceneIdRef.current
    );
    if (!scene) {
      setStatus("Select a scene to copy");
      return;
    }

    copiedSceneRef.current = cloneScene(scene);
    setStatus(`Copied: ${scene.title || scene.id}`);
  }

  function pasteCopiedScene() {
    const copiedScene = copiedSceneRef.current;
    if (!copiedScene) {
      setStatus("Copy a scene first");
      return;
    }

    let pastedSceneId = "";
    commitProjectChange((currentProject) => {
      const sceneNumber = getNextNumericId("scene", currentProject.scenes);
      const existingChoices = currentProject.scenes.flatMap((scene) => scene.choices);
      const baseScene = currentProject.scenes.find(
        (scene) => scene.id === selectedSceneIdRef.current
      );
      const pastedScene: Scene = {
        ...cloneScene(copiedScene),
        id: `scene_${sceneNumber}`,
        title: `${copiedScene.title || "Scene"} Copy`,
        position: findAvailableScenePosition(
          currentProject.scenes,
          getPreferredNewScenePosition(currentProject.scenes, baseScene ?? copiedScene, {
            x: (baseScene ?? copiedScene).position.x + 280,
            y: (baseScene ?? copiedScene).position.y + 40
          })
        ),
        choices: copiedScene.choices.map((choice, choiceIndex) => ({
          ...choice,
          id: `choice_${
            getNextNumericId("choice", existingChoices) + choiceIndex
          }`,
          effects: choice.effects.map((effect) => ({ ...effect })),
          conditions: choice.conditions.map((condition) => ({ ...condition })),
          outcomes: choice.outcomes.map((outcome) => ({ ...outcome })),
          conditionalTargets: choice.conditionalTargets.map((target) => ({
            ...target,
            conditions: target.conditions.map((condition) => ({ ...condition }))
          }))
        }))
      };
      pastedSceneId = pastedScene.id;
      return {
        ...currentProject,
        scenes: [...currentProject.scenes, pastedScene]
      };
    });

    if (pastedSceneId) {
      setSelectedSceneId(pastedSceneId);
      setStatus("Scene pasted");
    }
  }

  function restoreAutosaveProject() {
    const autosave = readAutosave();
    if (!autosave) {
      return;
    }

    setProject(autosave.project);
    clearProjectHistory();
    setSelectedSceneId(autosave.project.startSceneId);
    setPlaySceneId(null);
    setSaveState("autosaved");
    setStatus("Autosave restored");
    setProjectManagerOpen(false);
  }

  function updateScene(
    sceneId: SceneId,
    updater: (scene: Scene) => Scene,
    trackHistory = true
  ) {
    commitProjectChange((currentProject) => ({
      ...currentProject,
      scenes: currentProject.scenes.map((scene) =>
        scene.id === sceneId ? updater(scene) : scene
      )
    }), trackHistory);
  }

  function handleCanvasSceneSelect(sceneId: SceneId) {
    if (pendingChoiceTarget) {
      updateChoiceTarget(
        pendingChoiceTarget.sceneId,
        pendingChoiceTarget.choiceId,
        sceneId
      );
      setSelectedSceneId(pendingChoiceTarget.sceneId);
      setPendingChoiceTarget(null);
      setStatus("Choice target selected");
      return;
    }

    setSelectedSceneId(sceneId);
  }

  function clearCanvasSelection() {
    setPendingChoiceTarget(null);
    setSelectedSceneId(null);
    setStatus("No scene selected");
  }

  function updateChoiceTarget(
    sceneId: SceneId,
    choiceId: string,
    targetNodeId: SceneId
  ) {
    updateScene(sceneId, (scene) => ({
      ...scene,
      choices: scene.choices.map((choice) =>
        choice.id === choiceId
          ? {
              ...choice,
              targetNodeId,
              outcomes:
                choice.useMultipleOutcomes || choice.outcomes.length !== 1
                  ? choice.outcomes
                  : [{ ...choice.outcomes[0], targetSceneId: targetNodeId, percent: 100 }]
            }
          : choice
      )
    }));
  }

  function deleteSelectedScene() {
    if (!selectedSceneIdRef.current) {
      setStatus("Select a scene to delete");
      return;
    }
    deleteScene(selectedSceneIdRef.current);
  }

  function deleteScene(sceneId: SceneId) {
    const currentProject = projectRef.current;
    if (currentProject.scenes.length <= 1) {
      setStatus("Cannot delete the only scene");
      return;
    }

    const fallbackScene =
      currentProject.scenes.find((scene) => scene.id !== sceneId) ??
      currentProject.scenes[0];

    commitProjectChange((projectToUpdate) => ({
      ...projectToUpdate,
      startSceneId:
        projectToUpdate.startSceneId === sceneId
          ? fallbackScene.id
          : projectToUpdate.startSceneId,
      scenes: projectToUpdate.scenes
        .filter((scene) => scene.id !== sceneId)
        .map((scene) => ({
          ...scene,
          choices: scene.choices
            .filter((choice) => choice.targetNodeId !== sceneId)
            .map((choice) => ({
              ...choice,
              outcomes: choice.outcomes.filter(
                (outcome) => outcome.targetSceneId !== sceneId
              ),
              conditionalTargets: choice.conditionalTargets.filter(
                (target) => target.targetSceneId !== sceneId
              )
            }))
        }))
    }));
    setSelectedSceneId(fallbackScene.id);
    setStatus("Scene deleted");
  }

  function addScene() {
    let newSceneId = "";
    commitProjectChange((currentProject) => {
      const sceneNumber = getNextNumericId("scene", currentProject.scenes);
      const scene = createScene(sceneNumber, `scene_${sceneNumber}`);
      const selectedScene = currentProject.scenes.find(
        (item) => item.id === selectedSceneId
      );
      scene.position = findAvailableScenePosition(
        currentProject.scenes,
        getPreferredNewScenePosition(currentProject.scenes, selectedScene, scene.position)
      );
      newSceneId = scene.id;
      return {
        ...currentProject,
        scenes: [...currentProject.scenes, scene]
      };
    });
    if (newSceneId) {
      setSelectedSceneId(newSceneId);
    }
  }

  function duplicateSelectedScene() {
    if (!selectedScene) {
      return;
    }

    let duplicatedSceneId = "";
    commitProjectChange((currentProject) => {
      const sceneNumber = getNextNumericId("scene", currentProject.scenes);
      const duplicatedScene: Scene = {
        ...selectedScene,
        id: `scene_${sceneNumber}`,
        title: `${selectedScene.title || "Scene"} Copy`,
        position: findAvailableScenePosition(
          currentProject.scenes,
          getPreferredNewScenePosition(currentProject.scenes, selectedScene, {
            x: selectedScene.position.x + 280,
            y: selectedScene.position.y + 40
          })
        ),
        choices: selectedScene.choices.map((choice, choiceIndex) => ({
          ...choice,
          id: `choice_${getNextNumericId(
            "choice",
            currentProject.scenes.flatMap((scene) => scene.choices)
          ) + choiceIndex}`,
          effects: choice.effects.map((effect) => ({ ...effect })),
          conditions: choice.conditions.map((condition) => ({ ...condition })),
          outcomes: choice.outcomes.map((outcome) => ({ ...outcome })),
          conditionalTargets: choice.conditionalTargets.map(
            (conditionalTarget) => ({
              ...conditionalTarget,
              conditions: conditionalTarget.conditions.map((condition) => ({
                ...condition
              }))
            })
          )
        }))
      };

      duplicatedSceneId = duplicatedScene.id;
      return {
        ...currentProject,
        scenes: [...currentProject.scenes, duplicatedScene]
      };
    });
    if (duplicatedSceneId) {
      setSelectedSceneId(duplicatedSceneId);
    }
  }

  function addChoice(sceneId: SceneId) {
    const fallbackTarget = project.scenes[0]?.id;
    if (!fallbackTarget) {
      return;
    }

    addChoiceToTarget(sceneId, fallbackTarget);
  }

  function addChoiceToTarget(sceneId: SceneId, targetNodeId: SceneId) {
    commitProjectChange((currentProject) => {
      const choiceNumber = getNextNumericId(
        "choice",
        currentProject.scenes.flatMap((scene) => scene.choices)
      );

      return {
        ...currentProject,
        scenes: currentProject.scenes.map((scene) =>
          scene.id === sceneId
            ? {
                ...scene,
                choices: [
                  ...scene.choices,
                  createChoice(targetNodeId, `choice_${choiceNumber}`)
                ]
              }
            : scene
        )
      };
    });
  }

  function addParameter() {
    commitProjectChange((currentProject) => {
      const parameterNumber = getNextNumericId(
        "parameter",
        currentProject.parameters
      );

      return {
        ...currentProject,
        parameters: [
          ...currentProject.parameters,
          createParameter(parameterNumber, `parameter_${parameterNumber}`)
        ]
      };
    });
  }

  function updateParameter(
    parameterId: ParameterId,
    patch: Partial<StoryParameter>
  ) {
    commitProjectChange((currentProject) => ({
      ...currentProject,
      parameters: currentProject.parameters.map((parameter) =>
        parameter.id === parameterId ? { ...parameter, ...patch } : parameter
      )
    }));
  }

  function deleteParameter(parameterId: ParameterId) {
    commitProjectChange((currentProject) => ({
      ...currentProject,
      parameters: currentProject.parameters.filter(
        (parameter) => parameter.id !== parameterId
      ),
      scenes: currentProject.scenes.map((scene) => ({
        ...scene,
        choices: scene.choices.map((choice) => ({
          ...choice,
          effects: choice.effects.filter(
            (effect) =>
              effect.type !== "parameter" || effect.parameterId !== parameterId
          ),
          conditions: choice.conditions.filter(
            (condition) =>
              condition.type !== "parameter" ||
              condition.parameterId !== parameterId
          )
        }))
      }))
    }));
  }

  function addFlag() {
    commitProjectChange((currentProject) => {
      const flagNumber = getNextNumericId("flag", currentProject.flags);

      return {
        ...currentProject,
        flags: [
          ...currentProject.flags,
          createFlag(flagNumber, `flag_${flagNumber}`)
        ]
      };
    });
  }

  function updateFlag(flagId: FlagId, patch: Partial<StoryFlag>) {
    commitProjectChange((currentProject) => ({
      ...currentProject,
      flags: currentProject.flags.map((flag) =>
        flag.id === flagId ? { ...flag, ...patch } : flag
      )
    }));
  }

  function updateAudio(patch: Partial<StoryProject["audio"]>) {
    commitProjectChange((currentProject) => ({
      ...currentProject,
      audio: {
        ...currentProject.audio,
        ...patch
      }
    }), false);
  }

  function updateTheme(patch: Partial<StoryProject["theme"]>) {
    commitProjectChange((currentProject) => ({
      ...currentProject,
      theme: {
        ...currentProject.theme,
        ...patch
      }
    }), false);
  }

  function changeSceneNodeColor(sceneId: SceneId, nodeColor: SceneNodeColor) {
    updateScene(sceneId, (scene) => ({ ...scene, nodeColor }));
  }

  function addMediaFolder(folder: MediaFolder) {
    commitProjectChange((currentProject) => ({
      ...currentProject,
      mediaLibrary: {
        folders: [
          ...currentProject.mediaLibrary.folders.filter(
            (currentFolder) => currentFolder.id !== folder.id
          ),
          folder
        ]
      }
    }));
    setStatus(`Media folder added: ${folder.name}`);
  }

  function removeMediaFolder(folderId: string) {
    commitProjectChange((currentProject) => ({
      ...currentProject,
      mediaLibrary: {
        folders: currentProject.mediaLibrary.folders.filter(
          (folder) => folder.id !== folderId
        )
      }
    }));
    setStatus("Media folder removed");
  }

  function applyMediaToScene(
    sceneId: SceneId,
    media: { path: string; type: MediaAssetType }
  ) {
    updateScene(sceneId, (scene) =>
      media.type === "audio"
        ? { ...scene, soundPath: media.path }
        : { ...scene, imagePath: media.path }
    );
    setSelectedSceneId(sceneId);
    setStatus(media.type === "audio" ? "Scene sound applied" : "Scene image applied");
  }

  function deleteFlag(flagId: FlagId) {
    commitProjectChange((currentProject) => ({
      ...currentProject,
      flags: currentProject.flags.filter((flag) => flag.id !== flagId),
      scenes: currentProject.scenes.map((scene) => ({
        ...scene,
        choices: scene.choices.map((choice) => ({
          ...choice,
          effects: choice.effects.filter(
            (effect) => effect.type !== "flag" || effect.flagId !== flagId
          ),
          conditions: choice.conditions.filter(
            (condition) => condition.type !== "flag" || condition.flagId !== flagId
          )
        }))
      }))
    }));
  }

  async function saveProject() {
    const projectJson = serializeProject(project);

    if (!window.storyLife) {
      downloadProjectInBrowser(projectJson);
      recordManualSave();
      setSaveState("saved");
      setStatus("Project downloaded");
      return;
    }

    try {
      const result = await window.storyLife.saveProject(projectJson);
      if (!result.canceled) {
        recordManualSave();
        setSaveState("saved");
        setStatus(`Saved: ${result.filePath}`);
      }
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function loadProject() {
    if (!window.storyLife) {
      fallbackProjectInputRef.current?.click();
      return;
    }

    try {
      const result = await window.storyLife.loadProject();
      if (result.canceled) {
        return;
      }

      const loadedProject = migrateProject(JSON.parse(result.contents));
      setProject(loadedProject);
      clearProjectHistory();
      setSelectedSceneId(loadedProject.startSceneId);
      setPlaySceneId(null);
      recordManualSave();
      setSaveState("saved");
      setStatus(`Loaded: ${result.filePath}`);
      setProjectManagerOpen(false);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  function newProject(skipConfirm = false) {
    if (
      !skipConfirm &&
      (saveState === "unsaved" || saveState === "autosaved") &&
      !window.confirm("Create a new project? Unsaved changes will be lost.")
    ) {
      return;
    }

    const nextProject = createDefaultProject();
    setProject(nextProject);
    clearProjectHistory();
    setSelectedSceneId(nextProject.startSceneId);
    setPlaySceneId(null);
    setPendingChoiceTarget(null);
    setProjectSettingsOpen(false);
    localStorage.removeItem(AUTOSAVE_KEY);
    setSaveState("saved");
    setStatus("New project created");
    setProjectManagerOpen(false);
  }

  function restoreBackup() {
    const backups = readBackups();
    if (backups.length === 0) {
      setStatus("No backups found");
      return;
    }

    const list = backups
      .map(
        (backup, index) =>
          `${index + 1}. ${new Date(backup.savedAt).toLocaleString()} - ${
            backup.project.projectName
          }`
      )
      .join("\n");
    const answer = window.prompt(`Restore Backup\n\n${list}\n\nEnter number:`);
    const index = Number(answer) - 1;
    const backup = backups[index];
    if (!backup) {
      return;
    }

    setProject(backup.project);
    clearProjectHistory();
    setSelectedSceneId(backup.project.startSceneId);
    setPlaySceneId(null);
    setSaveState("autosaved");
    setStatus("Backup restored");
    setProjectManagerOpen(false);
  }

  async function loadProjectFromFallbackInput(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const loadedProject = migrateProject(JSON.parse(await file.text()));
      setProject(loadedProject);
      clearProjectHistory();
      setSelectedSceneId(loadedProject.startSceneId);
      setPlaySceneId(null);
      setStatus(`Loaded: ${file.name}`);
      setProjectManagerOpen(false);
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  async function exportGame() {
    const projectJson = serializeProject(project);

    if (!window.storyLife?.exportGame) {
      const message =
        "Game export with images and audio works only in the desktop app window. Close the browser tab and run the app with npm.cmd run dev, then use Export Game there.";
      window.alert(message);
      setStatus("Desktop app export is required");
      return;
    }

    try {
      const result = await window.storyLife.exportGame(projectJson);
      if (!result.canceled) {
        setStatus(`Exported game: ${result.exportPath}`);
      }
    } catch (error) {
      setStatus(getErrorMessage(error));
    }
  }

  function applyAIProject(nextProject: StoryProject) {
    commitProjectChange(() => nextProject);
    setSelectedSceneId(nextProject.startSceneId);
    setPlaySceneId(null);
    setCanvasRefreshSignal((currentSignal) => currentSignal + 1);
    setStatus("AI project applied");
  }

  function startPanelResize(target: ResizeTarget, event: MouseEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startSize = panelSizes[target];
    const direction = target === "inspector" ? -1 : 1;

    function handleMouseMove(moveEvent: globalThis.MouseEvent) {
      const delta = (moveEvent.clientX - startX) * direction;
      const nextSize = clamp(startSize + delta, getMinSize(target), getMaxSize(target));

      setPanelSizes((currentSizes) => ({
        ...currentSizes,
        [target]: nextSize
      }));
    }

    function handleMouseUp() {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.classList.remove("is-resizing-panels");
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new Event("resize"));
        setCanvasRefreshSignal((currentSignal) => currentSignal + 1);
        setCanvasFocusSelectedSignal((currentSignal) => currentSignal + 1);
      });
    }

    document.body.classList.add("is-resizing-panels");
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function startAIPanelResize(event: ReactPointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = aiPanelWidth;

    function handlePointerMove(moveEvent: PointerEvent) {
      const delta = startX - moveEvent.clientX;
      setAIPanelWidth(clamp(startWidth + delta, 360, Math.min(760, window.innerWidth - 120)));
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      document.body.classList.remove("is-resizing-panels");
    }

    document.body.classList.add("is-resizing-panels");
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  if (playSceneId) {
    return (
      <PlayMode
        project={project}
        currentSceneId={playSceneId}
        onChoose={setPlaySceneId}
        onExit={() => setPlaySceneId(null)}
      />
    );
  }

  return (
    <div
      className={`app-shell ${isAIAssistantOpen ? "ai-panel-open" : ""}`}
      style={{
        ["--ai-panel-width" as string]: `${aiPanelWidth}px`
      }}
    >
      <input
        ref={fallbackProjectInputRef}
        className="hidden-file-input"
        type="file"
        onChange={loadProjectFromFallbackInput}
      />
      <Toolbar
        projectName={project.projectName}
        status={status}
        onProjectNameChange={(projectName) =>
          commitProjectChange((currentProject) => ({
            ...currentProject,
            projectName
          }))
        }
        onNewProject={newProject}
        onSave={saveProject}
        onLoad={loadProject}
        onExport={exportGame}
        onProjectManager={() => setProjectManagerOpen(true)}
        onAIAssistant={() => setAIAssistantOpen(true)}
        onProjectSettings={() => setProjectSettingsOpen(true)}
        onPlay={() => setPlaySceneId(project.startSceneId)}
        onPlayFromHere={() => selectedScene && setPlaySceneId(selectedScene.id)}
        onDuplicateScene={duplicateSelectedScene}
        onRestoreBackup={restoreBackup}
        canUseSelectedSceneActions={Boolean(selectedScene)}
        canExportGame={canExportGame}
        saveState={saveState}
      />
      <main
        className="editor-layout"
        style={{
          gridTemplateColumns: `${panelSizes.left}px 6px ${
            isLogicPanelCollapsed ? 48 : panelSizes.logic
          }px 6px minmax(0, 1fr)${
            selectedScene ? ` 6px ${panelSizes.inspector}px` : ""
          }`,
          marginRight: isAIAssistantOpen ? `calc(${aiPanelWidth}px + 28px)` : undefined
        }}
      >
        <LeftPanel
          scenes={project.scenes}
          flags={project.flags}
          selectedSceneId={selectedSceneId}
          startSceneId={project.startSceneId}
          onAddScene={addScene}
          onSelectScene={setSelectedSceneId}
          onSetStartScene={(startSceneId) =>
            commitProjectChange((currentProject) => ({
              ...currentProject,
              startSceneId
            }))
          }
        />
        <div
          className="resize-handle"
          role="separator"
          aria-label="Resize scenes panel"
          onMouseDown={(event) => startPanelResize("left", event)}
        />
        <aside
          className={`logic-panel-shell ${
            isLogicPanelCollapsed ? "is-collapsed" : ""
          }`}
        >
          <button
            type="button"
            className="logic-panel-toggle"
            onClick={() => setLogicPanelCollapsed((isCollapsed) => !isCollapsed)}
            title={isLogicPanelCollapsed ? "Show Logic and Media Pool" : "Hide Logic and Media Pool"}
            aria-expanded={!isLogicPanelCollapsed}
          >
            <span aria-hidden="true">{isLogicPanelCollapsed ? "›" : "‹"}</span>
            <strong>{isLogicPanelCollapsed ? "Logic / Media" : "Hide panel"}</strong>
          </button>
          {!isLogicPanelCollapsed && (
            <LogicManagers
              parameters={project.parameters}
              flags={project.flags}
              mediaLibrary={project.mediaLibrary}
              scenes={project.scenes}
              selectedScene={selectedScene}
              onAddMediaFolder={addMediaFolder}
              onRemoveMediaFolder={removeMediaFolder}
              onApplyMediaToSelectedScene={(media) => {
                if (!selectedScene) {
                  setStatus("Select a scene first");
                  return;
                }
                applyMediaToScene(selectedScene.id, media);
              }}
              onAddParameter={addParameter}
              onUpdateParameter={updateParameter}
              onDeleteParameter={deleteParameter}
              onAddFlag={addFlag}
              onUpdateFlag={updateFlag}
              onDeleteFlag={deleteFlag}
            />
          )}
        </aside>
        <div
          className={`resize-handle ${isLogicPanelCollapsed ? "is-disabled" : ""}`}
          role="separator"
          aria-label="Resize logic panel"
          onMouseDown={
            isLogicPanelCollapsed
              ? undefined
              : (event) => startPanelResize("logic", event)
          }
        />
        <Canvas
          key={canvasRefreshSignal}
          scenes={project.scenes}
          selectedSceneId={selectedSceneId}
          startSceneId={project.startSceneId}
          viewResetSignal={canvasViewResetSignal}
          focusSelectedSignal={canvasFocusSelectedSignal}
          pickingTargetSceneId={pendingChoiceTarget?.sceneId ?? null}
          onSelectScene={handleCanvasSceneSelect}
          onClearSelection={clearCanvasSelection}
          onMoveScene={(sceneId, position) =>
            updateScene(sceneId, (scene) => ({ ...scene, position }))
          }
          onConnectScenes={addChoiceToTarget}
          onChangeSceneNodeColor={changeSceneNodeColor}
          onApplyMediaToScene={applyMediaToScene}
        />
        {selectedScene && (
          <>
            <div
              className="resize-handle"
              role="separator"
              aria-label="Resize inspector panel"
              onMouseDown={(event) => startPanelResize("inspector", event)}
            />
            <Inspector
              selectedScene={selectedScene}
              scenes={project.scenes}
              parameters={project.parameters}
              flags={project.flags}
              projectTheme={project.theme}
              onUpdateScene={updateScene}
              onAddChoice={addChoice}
              onDeleteScene={deleteScene}
              onPickChoiceTarget={(sceneId, choiceId) => {
                setPendingChoiceTarget({ sceneId, choiceId });
                setSelectedSceneId(sceneId);
                setStatus("Click a target node on the canvas");
              }}
              onSceneLayoutClose={() => {
                setCanvasRefreshSignal((currentSignal) => currentSignal + 1);
                setCanvasFocusSelectedSignal((currentSignal) => currentSignal + 1);
              }}
              isPickingChoiceTarget={Boolean(pendingChoiceTarget)}
            />
          </>
        )}
      </main>
      {isProjectSettingsOpen && (
        <ProjectSettingsModal
          audio={project.audio}
          theme={project.theme}
          onUpdateAudio={updateAudio}
          onUpdateTheme={updateTheme}
          onClose={() => setProjectSettingsOpen(false)}
        />
      )}
      {isAIAssistantOpen && (
        <AIAssistantModal
          project={project}
          selectedSceneId={selectedSceneId}
          width={aiPanelWidth}
          onApplyProject={applyAIProject}
          onResizeStart={startAIPanelResize}
          onClose={() => setAIAssistantOpen(false)}
        />
      )}
      {isProjectManagerOpen && (
        <ProjectManagerModal
          autosave={readAutosave()}
          backups={readBackups()}
          onCreateNew={() => newProject(true)}
          onLoadProject={() => void loadProject()}
          onOpenAutosave={restoreAutosaveProject}
          onOpenBackup={(backup) => {
            setProject(backup.project);
            clearProjectHistory();
            setSelectedSceneId(backup.project.startSceneId);
            setPlaySceneId(null);
            setSaveState("autosaved");
            setStatus("Backup opened");
            setProjectManagerOpen(false);
          }}
          onClose={() => setProjectManagerOpen(false)}
        />
      )}
    </div>
  );
}

function ProjectManagerModal({
  autosave,
  backups,
  onCreateNew,
  onLoadProject,
  onOpenAutosave,
  onOpenBackup,
  onClose
}: {
  autosave: StoredProjectSnapshot | null;
  backups: StoredProjectSnapshot[];
  onCreateNew: () => void;
  onLoadProject: () => void;
  onOpenAutosave: () => void;
  onOpenBackup: (backup: StoredProjectSnapshot) => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop project-manager-backdrop" role="presentation">
      <section className="project-manager-modal" role="dialog" aria-modal="true">
        <div className="project-manager-heading">
          <div>
            <span className="brand-mark">SL</span>
            <div>
              <h2>StoryLife Builder</h2>
              <p>Project Manager</p>
            </div>
          </div>
          <button type="button" onClick={onClose}>
            Continue
          </button>
        </div>
        <div className="project-manager-actions">
          <button type="button" className="primary-button" onClick={onCreateNew}>
            Create New Project
          </button>
          <button type="button" onClick={onLoadProject}>
            Load Project File
          </button>
          <button type="button" onClick={onOpenAutosave} disabled={!autosave}>
            Open Autosave
          </button>
        </div>
        <section className="project-manager-recents">
          <h3>Recent Backups</h3>
          {backups.length === 0 ? (
            <p className="empty-state">No backups yet.</p>
          ) : (
            backups.slice(0, 8).map((backup) => (
              <button
                type="button"
                key={backup.savedAt}
                onClick={() => onOpenBackup(backup)}
              >
                <strong>{backup.project.projectName}</strong>
                <span>{new Date(backup.savedAt).toLocaleString()}</span>
              </button>
            ))
          )}
        </section>
      </section>
    </div>
  );
}

function downloadProjectInBrowser(contents: string, fileName = "project.json") {
  const blob = new Blob([contents], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function createStandaloneGameHtml(project: StoryProject): string {
  const playerProject = {
    ...project,
    mediaLibrary: undefined,
    scenes: project.scenes.map(({ authorNotes: _authorNotes, ...scene }) => scene)
  };
  const storyJson = JSON.stringify(playerProject).replace(/</g, "\\u003c");

  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>${escapeHtml(project.projectName)}</title><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#eee8dc;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#26231f;padding:18px}#app{width:min(390px,100%);height:min(760px,calc(100vh - 36px));min-height:690px;display:grid;grid-template-rows:auto 1fr auto;align-content:start;gap:12px;overflow:auto;border:10px solid #26231f;border-radius:34px;padding:14px;background:linear-gradient(180deg,#fbf1df,#e8eee8);background-size:cover;background-position:center;box-shadow:0 24px 60px rgba(49,43,35,.25);animation:fade .56s ease both}.image-frame{margin:0;border:0;border-radius:18px;background:transparent;box-shadow:none;padding:0;transform-origin:center}img{display:block;width:100%;height:220px;max-height:220px;border-radius:18px;object-fit:cover}.content{margin:0;border:1px solid rgba(164,141,105,.34);border-radius:18px;background:rgba(255,253,248,.84);box-shadow:0 12px 28px rgba(70,61,45,.1);padding:18px}h1{margin:0 0 14px;font-size:25px;line-height:1.18;overflow-wrap:anywhere}p{margin:0;font-size:16px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.long h1{font-size:23px}.long p{font-size:15px}.very-long h1{font-size:21px}.very-long p{font-size:14px;line-height:1.45}.choices{display:grid;gap:12px;padding:0;transform-origin:center}button{min-height:54px;border:1px solid rgba(128,112,88,.26);border-radius:16px;background:linear-gradient(180deg,#fffaf1,#edf5ef);box-shadow:0 10px 22px rgba(70,61,45,.09);padding:12px 15px;text-align:left;white-space:normal;overflow-wrap:anywhere;font:inherit;color:#26231f}button:active{background:linear-gradient(180deg,#dfeee7,#c9ddd3)}button:disabled{opacity:.6}.layout-imageBackground,.layout-dialogueStyle{color:#fffdfa}.layout-imageBackground .content,.layout-dialogueStyle .content{border-color:rgba(255,255,255,.22);background:rgba(28,25,22,.72);color:#fffdfa;backdrop-filter:blur(6px)}.layout-imageBackground .body{display:grid;align-content:end;min-height:560px;padding-top:220px}.layout-dialogueStyle{display:grid;grid-template-rows:1fr auto auto}.dialogue-spacer{min-height:360px}.layout-fullImageMoment{display:grid;grid-template-rows:1fr auto auto}.layout-fullImageMoment .image-frame{display:grid;min-height:430px}.layout-fullImageMoment img{height:100%;max-height:none}.caption{margin-top:10px;padding:14px 16px}.caption h1{margin-bottom:8px;font-size:20px}.caption p{font-size:14px;line-height:1.4}.layout-noImage .body{display:grid;align-content:center;min-height:560px}@keyframes fade{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}</style></head><body><main id="app"></main><script>const story=${storyJson};let currentSceneId=story.startSceneId;let runtimeState={parameters:Object.fromEntries((story.parameters||[]).map(p=>[p.id,p.initialValue||0])),flags:Object.fromEntries((story.flags||[]).map(f=>[f.id,Boolean(f.defaultValue)]))};let bgAudio=null,sceneAudio=new Audio(),bgLoopRestarting=false;setupAudio();render();function setupAudio(){const a=story.audio||{};if(a.backgroundMusicPath){bgAudio=new Audio(a.backgroundMusicPath);bgAudio.loop=false;bgAudio.volume=0;bgAudio.addEventListener(timeupdate,handleBackgroundLoop);document.addEventListener(click,()=>bgAudio.play().catch(()=>{}),{once:true});bgAudio.play().catch(()=>{});fadeAudio(bgAudio,Number(a.musicVolume??.55),Number(a.musicFadeInSeconds??.8))}}function handleBackgroundLoop(){if(!bgAudio||bgLoopRestarting)return;const a=story.audio||{},fadeOut=Math.max(Number(a.musicFadeOutSeconds??.8),.35);if(!Number.isFinite(bgAudio.duration)||bgAudio.duration<=fadeOut+.15)return;if(bgAudio.duration-bgAudio.currentTime>fadeOut)return;bgLoopRestarting=true;fadeAudio(bgAudio,0,fadeOut,()=>{bgAudio.currentTime=0;bgAudio.play().catch(()=>{});fadeAudio(bgAudio,Number(a.musicVolume??.55),Number(a.musicFadeInSeconds??.8),()=>{bgLoopRestarting=false})})}function fadeAudio(audio,target,duration,onDone){const start=audio.volume,ms=Math.max(0,duration*1000);if(ms===0){audio.volume=target;if(onDone)onDone();return}const t0=performance.now(),id=setInterval(()=>{const p=Math.min((performance.now()-t0)/ms,1);audio.volume=start+(target-start)*p;if(p>=1){clearInterval(id);if(onDone)onDone()}},40)}function render(){const scene=story.scenes.find(s=>s.id===currentSceneId);const app=document.querySelector("#app");if(!scene){app.innerHTML='<section class="content"><h1>Scene not found</h1></section>';return}const layout=!scene.imagePath||scene.layoutType==="noImage"?"noImage":scene.layoutType||"imageTop";const st=scene.style||{},theme=story.theme||{};app.className="layout-"+layout;app.style.backgroundColor=st.backgroundColor||theme.backgroundColor||"#eee8dc";app.style.color=st.textColor||theme.textColor||"#26231f";app.style.backgroundImage=(layout==="imageBackground"||layout==="dialogueStyle")&&scene.imagePath?'linear-gradient(180deg,rgba(28,25,22,.18),rgba(28,25,22,.52)),url("'+escapeAttr(scene.imagePath)+'")':"";app.innerHTML=bodyHtml(scene,layout)+'<section class="choices"></section>';const box=app.querySelector(".choices");box.setAttribute("style",choicesStyle(scene));(scene.choices||[]).filter(c=>(c.conditions||[]).every(conditionPasses)||c.conditionFailBehavior!=="hidden").forEach(choice=>{const available=(choice.conditions||[]).every(conditionPasses);const button=document.createElement("button");button.textContent=(available?"":"Locked: ")+(choice.text||"Continue");button.disabled=!available;button.onclick=()=>{const nextSceneId=resolveChoiceTarget(choice);applyEffects(choice);currentSceneId=nextSceneId;render()};box.appendChild(button)});playSceneSound(scene)}function bodyHtml(scene,layout){const len=String(scene.text||"").trim().length;const cls="content"+(len>1100?" very-long":len>650?" long":"");const image=scene.imagePath?'<div class="image-frame" style="'+escapeAttr(transformStyle(scene,"image"))+'"><img alt="" src="'+escapeAttr(scene.imagePath)+'"></div>':"";const content='<section class="'+cls+'" style="'+escapeAttr(contentStyle(scene))+'"><h1>'+escapeHtml(scene.title||"Untitled scene")+'</h1><p>'+escapeHtml(scene.text||"This scene has no text yet.")+'</p></section>';if(layout==="textFirst")return'<div class="body">'+content+image+'</div>';if(layout==="splitLayout")return'<div class="body">'+image+content+'</div>';if(layout==="fullImageMoment")return'<div class="body">'+image+content.replace("content","content caption")+'</div>';if(layout==="imageBackground")return'<div class="body">'+content+'</div>';if(layout==="dialogueStyle")return'<div class="dialogue-spacer"></div>'+content;if(layout==="noImage")return'<div class="body">'+content+'</div>';return'<div class="body">'+image+content+'</div>'}function transformStyle(scene,target){const st=scene.style||{};const x=Number(st[target+"OffsetX"]||0)/3,y=Number(st[target+"OffsetY"]||0)/3,scale=Number(st[target+"Scale"]||1);return"transform:translate("+x+"px,"+y+"px) scale("+scale+")"}function contentStyle(scene){const st=scene.style||{};let css=transformStyle(scene,"text");if(st.textPanelColor)css+=";background:"+st.textPanelColor;if(st.textBorderColor)css+=";border-color:"+st.textBorderColor;if(st.textColor)css+=";color:"+st.textColor;css+=";font-family:"+fontFamily(st.textFontFamily)+";font-size:"+(st.textFontSize||16)+"px;text-align:"+(st.textAlign==="center"?"center":"left");if(Number(st.textPanelWidth||0)>0)css+=";width:"+Number(st.textPanelWidth)+"px";if(Number(st.textPanelHeight||0)>0)css+=";min-height:"+Number(st.textPanelHeight)+"px";return css}function choicesStyle(scene){const st=scene.style||{};let css=transformStyle(scene,"choices");if(Number(st.choicesPanelWidth||0)>0)css+=";width:"+Number(st.choicesPanelWidth)+"px";if(Number(st.choicesPanelHeight||0)>0)css+=";min-height:"+Number(st.choicesPanelHeight)+"px";return css}function fontFamily(v){if(v==="serif")return'Georgia, "Times New Roman", serif';if(v==="mono")return'"Cascadia Mono", "Consolas", monospace';return'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif'}function playSceneSound(scene){sceneAudio.pause();sceneAudio.currentTime=0;if(!scene.soundPath)return;const a=story.audio||{},normal=Number(a.musicVolume??.55),fade=Boolean(a.fadeMusicOnSceneSound??true)&&Boolean(scene.fadeMusicOnSceneSound??true);if(bgAudio&&fade)bgAudio.volume=Math.min(normal,.18);sceneAudio.src=scene.soundPath;sceneAudio.onended=()=>{if(bgAudio)bgAudio.volume=normal};sceneAudio.play().catch(()=>{if(bgAudio)bgAudio.volume=normal})}function resolveChoiceTarget(choice){for(const target of choice.conditionalTargets||[]){if((target.conditions||[]).every(conditionPasses))return target.targetSceneId}return choice.targetNodeId}function conditionPasses(condition){if(condition.type==="flag")return Boolean(runtimeState.flags[condition.flagId]||false)===Boolean(condition.expectedValue);const value=runtimeState.parameters[condition.parameterId]||0,expected=condition.value||0;if(condition.operator===">")return value>expected;if(condition.operator==="<")return value<expected;if(condition.operator==="<=")return value<=expected;if(condition.operator==="==")return value===expected;if(condition.operator==="!=")return value!==expected;return value>=expected}function applyEffects(choice){for(const effect of choice.effects||[]){if(effect.type==="flag")runtimeState.flags[effect.flagId]=Boolean(effect.value);else{const current=runtimeState.parameters[effect.parameterId]||0,value=Number(effect.value||0);runtimeState.parameters[effect.parameterId]=effect.operation==="add"?current+value:effect.operation==="subtract"?current-value:value}}}function escapeHtml(v){return String(v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}function escapeAttr(v){return escapeHtml(v)}</script></body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

interface StoredProjectSnapshot {
  savedAt: number;
  project: StoryProject;
}

function writeAutosave(project: StoryProject) {
  try {
    localStorage.setItem(
      AUTOSAVE_KEY,
      JSON.stringify({ savedAt: Date.now(), project })
    );
  } catch {
    // Local storage can be blocked in some browser/iPad modes.
  }
}

function readAutosave(): StoredProjectSnapshot | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredProjectSnapshot;
    return {
      savedAt: Number(parsed.savedAt) || 0,
      project: migrateProject(parsed.project)
    };
  } catch {
    return null;
  }
}

function writeBackup(project: StoryProject) {
  try {
    const backups = readBackups();
    const latestBackup = backups[0];
    if (
      latestBackup &&
      serializeProject(latestBackup.project) === serializeProject(project)
    ) {
      return;
    }

    backups.unshift({ savedAt: Date.now(), project });
    localStorage.setItem(BACKUPS_KEY, JSON.stringify(backups.slice(0, 10)));
  } catch {
    // Backup storage is best-effort in web/iPad mode.
  }
}

function readBackups(): StoredProjectSnapshot[] {
  try {
    const raw = localStorage.getItem(BACKUPS_KEY);
    if (!raw) {
      return [];
    }
    return (JSON.parse(raw) as StoredProjectSnapshot[])
      .map((backup) => ({
        savedAt: Number(backup.savedAt) || 0,
        project: migrateProject(backup.project)
      }))
      .filter((backup) => backup.savedAt > 0);
  } catch {
    return [];
  }
}

function recordManualSave() {
  localStorage.setItem(LAST_MANUAL_SAVE_KEY, String(Date.now()));
}

function readLastManualSaveAt(): number {
  return Number(localStorage.getItem(LAST_MANUAL_SAVE_KEY)) || 0;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getMinSize(target: ResizeTarget): number {
  return target === "inspector" ? 340 : 210;
}

function getMaxSize(target: ResizeTarget): number {
  return target === "inspector" ? 620 : 460;
}

function getPreferredNewScenePosition(
  scenes: Scene[],
  selectedScene: Scene | undefined,
  fallbackPosition: { x: number; y: number }
): { x: number; y: number } {
  const preferredPosition = selectedScene
    ? {
        x: selectedScene.position.x + 280,
        y: selectedScene.position.y
      }
    : fallbackPosition;

  if (preferredPosition.x <= 2600) {
    return preferredPosition;
  }

  const maxY = Math.max(120, ...scenes.map((scene) => scene.position.y));
  return {
    x: 120,
    y: maxY + 220
  };
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

function findAvailableScenePosition(
  scenes: Scene[],
  preferredPosition: { x: number; y: number }
): { x: number; y: number } {
  let nextPosition = { ...preferredPosition };
  const isOccupied = (position: { x: number; y: number }) =>
    scenes.some(
      (scene) =>
        Math.abs(scene.position.x - position.x) < 190 &&
        Math.abs(scene.position.y - position.y) < 150
    );

  while (isOccupied(nextPosition)) {
    nextPosition = {
      x: nextPosition.x + 38,
      y: nextPosition.y + 38
    };
  }

  return nextPosition;
}

function cloneScene(scene: Scene): Scene {
  return {
    ...scene,
    position: { ...scene.position },
    choices: scene.choices.map((choice) => ({
      ...choice,
      outcomes: choice.outcomes.map((outcome) => ({ ...outcome })),
      effects: choice.effects.map((effect) => ({ ...effect })),
      conditions: choice.conditions.map((condition) => ({ ...condition })),
      conditionalTargets: choice.conditionalTargets.map((target) => ({
        ...target,
        conditions: target.conditions.map((condition) => ({ ...condition }))
      }))
    }))
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    target.closest("input, textarea, select, [contenteditable='true']")
  );
}
