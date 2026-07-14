import { useEffect, useRef, useState } from "react";

interface ToolbarProps {
  projectName: string;
  status: string;
  saveState: "saved" | "unsaved" | "autosaved";
  onProjectNameChange: (projectName: string) => void;
  onNewProject: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onLoad: () => void;
  onExport: () => void;
  onArrangeNodes: () => void;
  onProjectManager: () => void;
  onImageStudio: () => void;
  onProjectSettings: () => void;
  onPlay: () => void;
  onPlayFromHere: () => void;
  onDuplicateScene: () => void;
  onRestoreBackup: () => void;
  onExit: () => void;
  canUseSelectedSceneActions: boolean;
  canExportGame: boolean;
  canExitApplication: boolean;
}

export function Toolbar({
  projectName,
  status,
  saveState,
  onProjectNameChange,
  onNewProject,
  onSave,
  onSaveAs,
  onLoad,
  onExport,
  onArrangeNodes,
  onProjectManager,
  onImageStudio,
  onProjectSettings,
  onPlay,
  onPlayFromHere,
  onDuplicateScene,
  onRestoreBackup,
  onExit,
  canUseSelectedSceneActions,
  canExportGame,
  canExitApplication
}: ToolbarProps) {
  const [isMenuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function runMenuAction(action: () => void) {
    setMenuOpen(false);
    action();
  }

  return (
    <header className="toolbar">
      <div className="brand">
        <span className="brand-mark">S</span>
        <div>
          <h1>StoryLife Builder</h1>
          <span>v0.1</span>
        </div>
      </div>
      <input
        className="project-name-input"
        value={projectName}
        onChange={(event) => onProjectNameChange(event.target.value)}
        aria-label="Project name"
      />
      <div className="toolbar-actions">
        <button type="button" onClick={onSave}>
          Save
        </button>
        <button type="button" onClick={onSaveAs}>
          Save As
        </button>
        <button type="button" onClick={onLoad}>
          Load Project
        </button>
        <button
          type="button"
          className="ai-toolbar-button"
          onClick={onImageStudio}
        >
          AI Image Studio
        </button>
        <button
          type="button"
          className="toolbar-play-secondary"
          onClick={onPlayFromHere}
          disabled={!canUseSelectedSceneActions}
        >
          Play from here
        </button>
        <button type="button" className="primary-button" onClick={onPlay}>
          Play
        </button>
        <div className="toolbar-menu" ref={menuRef}>
          <button
            type="button"
            className="toolbar-menu-trigger"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={() => setMenuOpen((isOpen) => !isOpen)}
          >
            Menu
            <span aria-hidden="true">▾</span>
          </button>
          {isMenuOpen && (
            <div className="toolbar-menu-popover" role="menu">
              <button type="button" role="menuitem" onClick={() => runMenuAction(onProjectManager)}>
                Project Manager
              </button>
              <button type="button" role="menuitem" onClick={() => runMenuAction(onNewProject)}>
                New Project
              </button>
              <button type="button" role="menuitem" onClick={() => runMenuAction(onSave)}>
                Save
              </button>
              <button type="button" role="menuitem" onClick={() => runMenuAction(onSaveAs)}>
                Save As
              </button>
              <button type="button" role="menuitem" onClick={() => runMenuAction(onLoad)}>
                Load Project
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runMenuAction(onArrangeNodes)}
                title="Arrange scenes from top to bottom following story transitions"
              >
                Arrange Nodes
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runMenuAction(onExport)}
                className={canExportGame ? "" : "danger-button"}
                title={
                  canExportGame
                    ? "Export creates index.html and assets folder"
                    : "Open the desktop app window to export the full game folder"
                }
              >
                {canExportGame ? "Export Game" : "Desktop Export Required"}
              </button>
              <button type="button" role="menuitem" onClick={() => runMenuAction(onProjectSettings)}>
                Project Settings
              </button>
              <button type="button" role="menuitem" onClick={() => runMenuAction(onRestoreBackup)}>
                Restore Backup
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => runMenuAction(onDuplicateScene)}
                disabled={!canUseSelectedSceneActions}
              >
                Duplicate Scene
              </button>
              {canExitApplication && (
                <button
                  type="button"
                  role="menuitem"
                  className="danger-button toolbar-exit-button"
                  onClick={() => runMenuAction(onExit)}
                >
                  Exit
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="status-line" title={status}>
        {saveStateLabel[saveState]} | {status}
      </p>
    </header>
  );
}

const saveStateLabel = {
  saved: "Saved",
  unsaved: "Unsaved",
  autosaved: "Autosaved"
};
