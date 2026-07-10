import { useEffect, useRef, useState } from "react";
import {
  MediaAsset,
  MediaAssetType,
  MediaFolder,
  MediaLibrary,
  Scene,
  StoryFlag,
  StoryParameter
} from "../domain/project";

type FlagFilter = "all" | "used" | "unused" | "broken";
type ManagerTab = "logic" | "media";

interface LogicManagersProps {
  parameters: StoryParameter[];
  flags: StoryFlag[];
  mediaLibrary: MediaLibrary;
  scenes: Scene[];
  selectedScene: Scene | null;
  onAddMediaFolder: (folder: MediaFolder) => void;
  onRemoveMediaFolder: (folderId: string) => void;
  onApplyMediaToSelectedScene: (media: {
    path: string;
    type: MediaAssetType;
  }) => void;
  onAddParameter: () => void;
  onUpdateParameter: (
    parameterId: string,
    patch: Partial<StoryParameter>
  ) => void;
  onDeleteParameter: (parameterId: string) => void;
  onAddFlag: () => void;
  onUpdateFlag: (flagId: string, patch: Partial<StoryFlag>) => void;
  onDeleteFlag: (flagId: string) => void;
}

export function LogicManagers({
  parameters,
  flags,
  mediaLibrary,
  scenes,
  selectedScene,
  onAddMediaFolder,
  onRemoveMediaFolder,
  onApplyMediaToSelectedScene,
  onAddParameter,
  onUpdateParameter,
  onDeleteParameter,
  onAddFlag,
  onUpdateFlag,
  onDeleteFlag
}: LogicManagersProps) {
  const [expandedParameterIds, setExpandedParameterIds] = useState<Set<string>>(
    () => new Set()
  );
  const [expandedFlagIds, setExpandedFlagIds] = useState<Set<string>>(
    () => new Set()
  );
  const [activeTab, setActiveTab] = useState<ManagerTab>("logic");
  const [flagFilter, setFlagFilter] = useState<FlagFilter>("all");
  const knownParameterIdsRef = useRef(new Set(parameters.map((parameter) => parameter.id)));
  const knownFlagIdsRef = useRef(new Set(flags.map((flag) => flag.id)));

  useEffect(() => {
    const knownIds = knownParameterIdsRef.current;
    const currentParameterIds = new Set(parameters.map((parameter) => parameter.id));

    setExpandedParameterIds((currentIds) => {
      const nextIds = new Set(currentIds);
      for (const parameter of parameters) {
        if (!knownIds.has(parameter.id)) {
          nextIds.add(parameter.id);
          knownIds.add(parameter.id);
        }
      }
      for (const parameterId of nextIds) {
        if (!currentParameterIds.has(parameterId)) {
          nextIds.delete(parameterId);
        }
      }
      return nextIds;
    });
  }, [parameters]);

  useEffect(() => {
    const knownIds = knownFlagIdsRef.current;
    const currentFlagIds = new Set(flags.map((flag) => flag.id));

    setExpandedFlagIds((currentIds) => {
      const nextIds = new Set(currentIds);
      for (const flag of flags) {
        if (!knownIds.has(flag.id)) {
          nextIds.add(flag.id);
          knownIds.add(flag.id);
        }
      }
      for (const flagId of nextIds) {
        if (!currentFlagIds.has(flagId)) {
          nextIds.delete(flagId);
        }
      }
      return nextIds;
    });
  }, [flags]);

  function toggleParameter(parameterId: string) {
    setExpandedParameterIds((currentIds) => toggleSetValue(currentIds, parameterId));
  }

  function toggleFlag(flagId: string) {
    setExpandedFlagIds((currentIds) => toggleSetValue(currentIds, flagId));
  }

  const flagUsage = analyzeFlagUsage(flags, scenes);
  const visibleFlags = flags.filter((flag) => {
    const usage = flagUsage.get(flag.id);
    if (flagFilter === "all") {
      return true;
    }
    return usage?.status === flagFilter;
  });

  return (
    <div className="logic-managers">
      <div className="manager-tabs">
        <button
          type="button"
          className={activeTab === "logic" ? "active-tab" : ""}
          onClick={() => setActiveTab("logic")}
        >
          Logic
        </button>
        <button
          type="button"
          className={activeTab === "media" ? "active-tab" : ""}
          onClick={() => setActiveTab("media")}
        >
          Media Pool
        </button>
      </div>

      {activeTab === "media" ? (
        <MediaPoolSection
          mediaLibrary={mediaLibrary}
          scenes={scenes}
          selectedScene={selectedScene}
          onAddMediaFolder={onAddMediaFolder}
          onRemoveMediaFolder={onRemoveMediaFolder}
          onApplyMediaToSelectedScene={onApplyMediaToSelectedScene}
        />
      ) : (
        <>
      <section className="manager-section">
        <div className="manager-heading">
          <h3>Parameters</h3>
          <button type="button" onClick={onAddParameter}>
            Add
          </button>
        </div>
        {parameters.length === 0 && (
          <p className="empty-state">No parameters yet.</p>
        )}
        {parameters.map((parameter) => (
          <div className="manager-item collapsible-item" key={parameter.id}>
            <button
              type="button"
              className="collapse-header"
              onClick={() => toggleParameter(parameter.id)}
            >
              <span>{parameter.key || "Unnamed parameter"}</span>
              <small>{expandedParameterIds.has(parameter.id) ? "Hide" : "Edit"}</small>
            </button>
            {expandedParameterIds.has(parameter.id) && (
              <div className="collapse-body">
                <label className="field-label">
                  Key
                  <input
                    value={parameter.key}
                    onChange={(event) =>
                      onUpdateParameter(parameter.id, { key: event.target.value })
                    }
                  />
                </label>
                <label className="field-label">
                  Initial
                  <input
                    type="number"
                    value={parameter.initialValue}
                    onChange={(event) =>
                      onUpdateParameter(parameter.id, {
                        initialValue: readNumberInput(event.target.value)
                      })
                    }
                  />
                </label>
                <div className="two-column-fields">
              <label className="field-label">
                Min
                <input
                  type="number"
                  value={parameter.minValue ?? ""}
                  placeholder="none"
                  onChange={(event) =>
                    onUpdateParameter(parameter.id, {
                      minValue: readOptionalNumberInput(event.target.value)
                    })
                  }
                />
              </label>
              <label className="field-label">
                Max
                <input
                  type="number"
                  value={parameter.maxValue ?? ""}
                  placeholder="none"
                  onChange={(event) =>
                    onUpdateParameter(parameter.id, {
                      maxValue: readOptionalNumberInput(event.target.value)
                    })
                  }
                />
              </label>
                </div>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => onDeleteParameter(parameter.id)}
                >
                  Delete Parameter
                </button>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="manager-section">
        <div className="manager-heading">
          <h3>Flags</h3>
          <button type="button" onClick={onAddFlag}>
            Add
          </button>
        </div>
        <div className="segmented-row">
          {(["all", "used", "unused", "broken"] as FlagFilter[]).map((filter) => (
            <button
              type="button"
              className={flagFilter === filter ? "selected-filter" : ""}
              key={filter}
              onClick={() => setFlagFilter(filter)}
            >
              {filter}
            </button>
          ))}
        </div>
        {flags.length === 0 && <p className="empty-state">No flags yet.</p>}
        {visibleFlags.map((flag) => {
          const usage = flagUsage.get(flag.id) ?? createEmptyFlagUsage(flag.id);

          return (
          <div
            className={`manager-item collapsible-item flag-status-${usage.status}`}
            key={flag.id}
          >
            <button
              type="button"
              className="collapse-header"
              onClick={() => toggleFlag(flag.id)}
            >
              <span>{flag.key || "Unnamed flag"}</span>
              <small>
                {usage.status} | set {usage.setCount} | checked{" "}
                {usage.checkedCount} | target {usage.conditionalTargetCount}
              </small>
            </button>
            {expandedFlagIds.has(flag.id) && (
              <div className="collapse-body">
                <label className="field-label">
                  Key
                  <input
                    value={flag.key}
                    onChange={(event) =>
                      onUpdateFlag(flag.id, { key: event.target.value })
                    }
                  />
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={flag.defaultValue}
                    onChange={(event) =>
                      onUpdateFlag(flag.id, { defaultValue: event.target.checked })
                    }
                  />
                  Default true
                </label>
                <div className="flag-usage-list">
                  <strong>Usage</strong>
                  {usage.locations.length === 0 && (
                    <p className="empty-state">No usage yet.</p>
                  )}
                  {usage.locations.map((location) => (
                    <span key={location}>{location}</span>
                  ))}
                </div>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => onDeleteFlag(flag.id)}
                >
                  Delete Flag
                </button>
              </div>
            )}
          </div>
          );
        })}
      </section>
        </>
      )}
    </div>
  );
}

interface MediaPoolSectionProps {
  mediaLibrary: MediaLibrary;
  scenes: Scene[];
  selectedScene: Scene | null;
  onAddMediaFolder: (folder: MediaFolder) => void;
  onRemoveMediaFolder: (folderId: string) => void;
  onApplyMediaToSelectedScene: (media: {
    path: string;
    type: MediaAssetType;
  }) => void;
}

function MediaPoolSection({
  mediaLibrary,
  scenes,
  selectedScene,
  onAddMediaFolder,
  onRemoveMediaFolder,
  onApplyMediaToSelectedScene
}: MediaPoolSectionProps) {
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(
    () => new Set()
  );
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const usedMediaPaths = new Set(
    scenes.flatMap((scene) => [scene.imagePath, scene.soundPath])
      .map((path) => normalizeMediaPath(path))
      .filter(Boolean)
  );
  const allAssets = mediaLibrary.folders.flatMap((folder) => folder.assets);
  const usedAssets = uniqueAssetsByPath(
    allAssets.filter((asset) => usedMediaPaths.has(normalizeMediaPath(asset.path)))
  );

  async function addFolder() {
    setMessage("");

    if (!window.storyLife?.selectMediaFolder) {
      fallbackInputRef.current?.click();
      return;
    }

    try {
      const result = await window.storyLife.selectMediaFolder();
      if (!result.canceled) {
        onAddMediaFolder(result.folder);
        setExpandedFolderIds((currentIds) =>
          new Set(currentIds).add(result.folder.id)
        );
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Media folder failed.");
    }
  }

  function addWebFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    const acceptedFiles = Array.from(files).filter((file) =>
      /^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|wav|ogg|mp4|webm))$/.test(
        file.type
      )
    );
    const folderId = `media_folder_${Date.now()}`;
    const folder: MediaFolder = {
      id: folderId,
      name: "Imported files",
      path: "",
      assets: []
    };

    Promise.all(
      acceptedFiles.map(
        (file, index) =>
          new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.addEventListener("load", () => {
              if (typeof reader.result === "string") {
                folder.assets.push({
                  id: `media_asset_${Date.now()}_${index}`,
                  name: file.name,
                  path: reader.result,
                  type: file.type.startsWith("audio/") ? "audio" : "image"
                });
              }
              resolve();
            });
            reader.readAsDataURL(file);
          })
      )
    ).then(() => {
      onAddMediaFolder(folder);
      setExpandedFolderIds((currentIds) => new Set(currentIds).add(folderId));
      setMessage("Files embedded into this project for web/iPad testing.");
    });
  }

  return (
    <section className="manager-section media-pool-section">
      <div className="manager-heading">
        <h3>Media Pool</h3>
        <button type="button" onClick={addFolder}>
          Add Folder
        </button>
      </div>
      <input
        ref={fallbackInputRef}
        className="hidden-file-input"
        type="file"
        multiple
        accept=".png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.m4a,.webm,image/png,image/jpeg,image/webp,image/gif,audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/webm"
        onChange={(event) => {
          addWebFiles(event.target.files);
          event.target.value = "";
        }}
      />
      {mediaLibrary.folders.length === 0 && (
        <p className="empty-state">Add folders with images, gif and sounds.</p>
      )}
      {usedAssets.length > 0 && (
        <div className="manager-item collapsible-item media-used-folder">
          <button
            type="button"
            className="collapse-header"
            onClick={() =>
              setExpandedFolderIds((currentIds) =>
                toggleSetValue(currentIds, "media_used")
              )
            }
          >
            <span>Used</span>
            <small>{usedAssets.length} files</small>
          </button>
          {expandedFolderIds.has("media_used") && (
            <div className="collapse-body">
              <MediaAssetGrid
                assets={usedAssets}
                selectedScene={selectedScene}
                onPreviewAsset={setPreviewAsset}
              />
            </div>
          )}
        </div>
      )}
      {mediaLibrary.folders.map((folder) => (
        <MediaFolderView
          key={folder.id}
          folder={folder}
          assets={folder.assets.filter(
            (asset) => !usedMediaPaths.has(normalizeMediaPath(asset.path))
          )}
          isExpanded={expandedFolderIds.has(folder.id)}
          selectedScene={selectedScene}
          onToggle={() =>
            setExpandedFolderIds((currentIds) =>
              toggleSetValue(currentIds, folder.id)
            )
          }
          onPreviewAsset={setPreviewAsset}
          onRemoveFolder={() => onRemoveMediaFolder(folder.id)}
        />
      ))}
      {message && <p className="helper-text">{message}</p>}
      {previewAsset && (
        <MediaPreviewModal
          asset={previewAsset}
          selectedScene={selectedScene}
          onApply={() => {
            onApplyMediaToSelectedScene({
              path: previewAsset.path,
              type: previewAsset.type
            });
            setPreviewAsset(null);
          }}
          onClose={() => setPreviewAsset(null)}
        />
      )}
    </section>
  );
}

function MediaFolderView({
  folder,
  assets,
  isExpanded,
  selectedScene,
  onToggle,
  onPreviewAsset,
  onRemoveFolder
}: {
  folder: MediaFolder;
  assets: MediaAsset[];
  isExpanded: boolean;
  selectedScene: Scene | null;
  onToggle: () => void;
  onPreviewAsset: (asset: MediaAsset) => void;
  onRemoveFolder: () => void;
}) {
  return (
    <div className="manager-item collapsible-item" key={folder.id}>
          <button
            type="button"
            className="collapse-header"
            onClick={onToggle}
          >
            <span>{folder.name}</span>
        <small>{assets.length} available</small>
          </button>
      {isExpanded && (
            <div className="collapse-body">
          <MediaAssetGrid
            assets={assets}
            emptyLabel="No available media in folder."
            selectedScene={selectedScene}
            onPreviewAsset={onPreviewAsset}
          />
              <button
                type="button"
                className="danger-button"
            onClick={onRemoveFolder}
              >
                Remove Folder
              </button>
            </div>
          )}
        </div>
  );
}

function MediaAssetGrid({
  assets,
  emptyLabel = "No supported media in folder.",
  selectedScene,
  onPreviewAsset
}: {
  assets: MediaAsset[];
  emptyLabel?: string;
  selectedScene: Scene | null;
  onPreviewAsset: (asset: MediaAsset) => void;
}) {
  return (
    <div className="media-asset-list">
      {assets.length === 0 && <p className="empty-state">{emptyLabel}</p>}
      {assets.map((asset) => (
        <button
          type="button"
          className={`media-asset media-asset-${asset.type}`}
          key={asset.id}
          draggable
          title={
            selectedScene
              ? `Drag or click to preview: ${asset.name}`
              : "Select a node before applying"
          }
          onClick={() => {
            if (asset.type === "image") {
              onPreviewAsset(asset);
            }
          }}
          onDragStart={(event) => {
            event.dataTransfer.setData(
              "application/storylife-media",
              JSON.stringify({
                path: asset.path,
                type: asset.type
              })
            );
            event.dataTransfer.effectAllowed = "copy";
          }}
        >
          <span className="media-thumb">
            {asset.type === "image" ? (
              <img src={toMediaSrc(asset.path)} alt="" loading="lazy" />
            ) : (
              <span className="audio-thumb">Audio</span>
            )}
          </span>
          <strong>{asset.name}</strong>
        </button>
      ))}
    </div>
  );
}

function MediaPreviewModal({
  asset,
  selectedScene,
  onApply,
  onClose
}: {
  asset: MediaAsset;
  selectedScene: Scene | null;
  onApply: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="media-preview-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Media preview"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <h2>{asset.name}</h2>
            <p>{selectedScene ? `Selected: ${selectedScene.title || selectedScene.id}` : "Select a node first"}</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="media-preview-image-box">
          <img className="media-preview-large-image" src={toMediaSrc(asset.path)} alt="" />
        </div>
        <div className="media-preview-actions">
          <button type="button" onClick={onApply} disabled={!selectedScene}>
            Apply to selected node
          </button>
        </div>
      </section>
    </div>
  );
}

function uniqueAssetsByPath(assets: MediaAsset[]): MediaAsset[] {
  const seenPaths = new Set<string>();
  return assets.filter((asset) => {
    const normalizedPath = normalizeMediaPath(asset.path);
    if (seenPaths.has(normalizedPath)) {
      return false;
    }
    seenPaths.add(normalizedPath);
    return true;
  });
}

function normalizeMediaPath(mediaPath: string): string {
  return mediaPath.trim().replace(/\\/g, "/").toLowerCase();
}

function toMediaSrc(mediaPath: string): string {
  const trimmedPath = mediaPath.trim();

  if (
    trimmedPath.startsWith("file://") ||
    trimmedPath.startsWith("http://") ||
    trimmedPath.startsWith("https://") ||
    trimmedPath.startsWith("data:")
  ) {
    return trimmedPath;
  }

  if (/^[a-zA-Z]:\\/.test(trimmedPath)) {
    return `file:///${trimmedPath.replace(/\\/g, "/")}`;
  }

  return trimmedPath;
}

interface FlagUsage {
  flagId: string;
  status: "used" | "unused" | "broken";
  setCount: number;
  checkedCount: number;
  conditionalTargetCount: number;
  locations: string[];
}

function analyzeFlagUsage(flags: StoryFlag[], scenes: Scene[]): Map<string, FlagUsage> {
  const usage = new Map(flags.map((flag) => [flag.id, createEmptyFlagUsage(flag.id)]));

  for (const scene of scenes) {
    for (const choice of scene.choices) {
      for (const effect of choice.effects) {
        if (effect.type === "flag") {
          const item = usage.get(effect.flagId);
          if (item) {
            item.setCount += 1;
            item.locations.push(`${scene.title || scene.id}: sets flag`);
          }
        }
      }
      for (const condition of choice.conditions) {
        if (condition.type === "flag") {
          const item = usage.get(condition.flagId);
          if (item) {
            item.checkedCount += 1;
            item.locations.push(`${scene.title || scene.id}: checks choice`);
          }
        }
      }
      for (const conditionalTarget of choice.conditionalTargets) {
        for (const condition of conditionalTarget.conditions) {
          if (condition.type === "flag") {
            const item = usage.get(condition.flagId);
            if (item) {
              item.conditionalTargetCount += 1;
              item.locations.push(`${scene.title || scene.id}: routes target`);
            }
          }
        }
      }
    }
  }

  for (const item of usage.values()) {
    const hasAnyUse =
      item.setCount + item.checkedCount + item.conditionalTargetCount > 0;
    item.status = !hasAnyUse
      ? "unused"
      : item.setCount === 0 &&
          (item.checkedCount > 0 || item.conditionalTargetCount > 0)
        ? "broken"
        : "used";
  }

  return usage;
}

function createEmptyFlagUsage(flagId: string): FlagUsage {
  return {
    flagId,
    status: "unused",
    setCount: 0,
    checkedCount: 0,
    conditionalTargetCount: 0,
    locations: []
  };
}

function toggleSetValue(currentIds: Set<string>, itemId: string): Set<string> {
  const nextIds = new Set(currentIds);
  if (nextIds.has(itemId)) {
    nextIds.delete(itemId);
  } else {
    nextIds.add(itemId);
  }
  return nextIds;
}

function readNumberInput(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readOptionalNumberInput(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
