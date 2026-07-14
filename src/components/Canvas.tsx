import { useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Connection,
  Controls,
  Edge,
  MarkerType,
  MiniMap,
  Node,
  NodeDragHandler,
  ReactFlowProvider,
  useReactFlow
} from "reactflow";
import {
  ChoiceCondition,
  MediaAssetType,
  Position,
  Scene,
  SceneId,
  SceneNodeColor
} from "../domain/project";

interface CanvasProps {
  scenes: Scene[];
  selectedSceneId: SceneId | null;
  startSceneId: SceneId;
  viewResetSignal: number;
  focusSelectedSignal: number;
  pickingTargetSceneId: SceneId | null;
  onSelectScene: (sceneId: SceneId) => void;
  onClearSelection: () => void;
  onMoveScene: (sceneId: SceneId, position: Position) => void;
  onConnectScenes: (sourceSceneId: SceneId, targetSceneId: SceneId) => void;
  onCreateConnectedScene: (sourceSceneId: SceneId, position: Position) => void;
  onChangeSceneNodeColor: (
    sceneId: SceneId,
    nodeColor: SceneNodeColor
  ) => void;
  onApplyMediaToScene: (
    sceneId: SceneId,
    media: { path: string; type: MediaAssetType }
  ) => void;
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasContent {...props} />
    </ReactFlowProvider>
  );
}

function CanvasContent({
  scenes,
  selectedSceneId,
  startSceneId,
  viewResetSignal,
  focusSelectedSignal,
  pickingTargetSceneId,
  onSelectScene,
  onClearSelection,
  onMoveScene,
  onConnectScenes,
  onCreateConnectedScene,
  onChangeSceneNodeColor,
  onApplyMediaToScene
}: CanvasProps) {
  const reactFlow = useReactFlow();
  const ctrlDragSourceRef = useRef<SceneId | null>(null);
  const [colorMenu, setColorMenu] = useState<{
    sceneId: SceneId;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      reactFlow.fitView({
        duration: 220,
        maxZoom: 1,
        padding: 0.24
      });
    });
  }, [reactFlow, viewResetSignal]);

  useEffect(() => {
    const selectedScene = scenes.find((scene) => scene.id === selectedSceneId);
    if (!selectedScene) {
      return;
    }

    window.requestAnimationFrame(() => {
      reactFlow.setCenter(
        selectedScene.position.x + 110,
        selectedScene.position.y + 70,
        {
          duration: 220,
          zoom: 0.9
        }
      );
    });
  }, [focusSelectedSignal, reactFlow]);
  const nodes = useMemo<Node[]>(
    () =>
      scenes.map((scene) => ({
        id: scene.id,
        type: "default",
        position: scene.position,
        selected: scene.id === selectedSceneId,
        className: getNodeClassName(scene, startSceneId),
        data: {
          label: (
            <div
              className="story-node"
              onDragOver={(event) => {
                if (
                  event.dataTransfer.types.includes(
                    "application/storylife-media"
                  )
                ) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }
              }}
              onDrop={(event) => {
                const rawMedia = event.dataTransfer.getData(
                  "application/storylife-media"
                );
                if (!rawMedia) {
                  return;
                }
                event.preventDefault();
                try {
                  const media = JSON.parse(rawMedia) as {
                    path: string;
                    type: MediaAssetType;
                  };
                  onApplyMediaToScene(scene.id, media);
                } catch {
                  // Ignore malformed drag data from outside the editor.
                }
              }}
            >
              {scene.imagePath.trim() !== "" && (
                <NodeThumbnail
                  mediaPath={scene.imagePath}
                  mediaType={scene.visualMediaType}
                />
              )}
              <strong>{scene.title || "Untitled scene"}</strong>
              <small className="node-layout-badge">
                {formatLayoutName(scene.layoutType)}
              </small>
            </div>
          )
        }
      })),
    [scenes, selectedSceneId, startSceneId, onApplyMediaToScene]
  );

  const edges = useMemo<Edge[]>(
    () =>
      scenes.flatMap((scene, sceneIndex) =>
        scene.choices.flatMap((choice, choiceIndex) => {
          const outcomeTargets =
            choice.useMultipleOutcomes && choice.outcomes.length > 0
              ? choice.outcomes
              : [
                  {
                    id: "default",
                    targetSceneId: choice.targetNodeId,
                    percent: 100
                  }
                ];

          const defaultEdge = outcomeTargets
            .filter((outcome) =>
              scenes.some((targetScene) => targetScene.id === outcome.targetSceneId)
            )
            .map((outcome, outcomeIndex) => {
              const isOutgoing = scene.id === selectedSceneId;
              const isIncoming = outcome.targetSceneId === selectedSceneId;
              const stroke = isOutgoing
                ? "#2f8f5b"
                : isIncoming
                  ? "#3269b1"
                  : "#5c6f68";
              const label =
                choice.useMultipleOutcomes && choice.outcomes.length > 1
                  ? `${choice.text || "Choice"} ${outcome.percent}%`
                  : choice.text || "Choice";

              return {
                id: getDefaultEdgeId(
                  scene.id,
                  sceneIndex,
                  choiceIndex,
                  choice.id,
                  `${outcome.targetSceneId}-${outcome.id}-${outcomeIndex}`
                ),
                source: scene.id,
                target: outcome.targetSceneId,
                label,
                type: "smoothstep",
                animated: isOutgoing || isIncoming,
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: stroke
                },
                labelBgPadding: [8, 4] as [number, number],
                labelBgBorderRadius: 4,
                labelBgStyle: {
                  fill: isOutgoing || isIncoming ? "#fffdfa" : "#f6f3ec"
                },
                style: {
                  strokeWidth: isOutgoing || isIncoming ? 3 : 2,
                  stroke
                }
              };
            });

          const conditionalEdges = choice.conditionalTargets
            .filter((conditionalTarget) =>
              scenes.some(
                (targetScene) => targetScene.id === conditionalTarget.targetSceneId
              )
            )
            .map((conditionalTarget, conditionalIndex) => {
              const isOutgoing = scene.id === selectedSceneId;
              const isIncoming = conditionalTarget.targetSceneId === selectedSceneId;
              const stroke = isOutgoing
                ? "#a9682a"
                : isIncoming
                  ? "#7d4bb3"
                  : "#92755a";

              return {
                id: getConditionalEdgeId(
                  scene.id,
                  sceneIndex,
                  choice.id,
                  choiceIndex,
                  conditionalTarget.id,
                  conditionalIndex,
                  conditionalTarget.targetSceneId
                ),
                source: scene.id,
                target: conditionalTarget.targetSceneId,
                label: formatConditions(conditionalTarget.conditions),
                type: "smoothstep",
                animated: isOutgoing || isIncoming,
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: stroke
                },
                labelBgPadding: [8, 4] as [number, number],
                labelBgBorderRadius: 4,
                labelBgStyle: {
                  fill: "#fffdfa"
                },
                style: {
                  strokeWidth: isOutgoing || isIncoming ? 3 : 2,
                  strokeDasharray: "7 6",
                  stroke
                }
              };
            });

          return [...defaultEdge, ...conditionalEdges];
        })
      ),
    [scenes, selectedSceneId, startSceneId]
  );

  const handleNodeDragStart: NodeDragHandler = (event, node) => {
    ctrlDragSourceRef.current = "ctrlKey" in event && event.ctrlKey ? node.id : null;
  };

  const handleNodeDragStop: NodeDragHandler = (_event, node) => {
    if (ctrlDragSourceRef.current === node.id) {
      ctrlDragSourceRef.current = null;
      onCreateConnectedScene(node.id, node.position);
      return;
    }
    ctrlDragSourceRef.current = null;
    onMoveScene(node.id, node.position);
  };

  function handleConnect(connection: Connection) {
    if (!connection.source || !connection.target) {
      return;
    }

    onConnectScenes(connection.source, connection.target);
  }

  return (
    <section className={`canvas-panel ${pickingTargetSceneId ? "is-picking-target" : ""}`}>
      <span className="canvas-decor canvas-decor-foliage" aria-hidden="true" />
      <span className="canvas-decor canvas-decor-mountains" aria-hidden="true" />
      <span className="canvas-decor canvas-decor-balloon" aria-hidden="true" />
      {pickingTargetSceneId && (
        <div className="canvas-pick-banner">
          Click a node to use it as this choice target
        </div>
      )}
      <button
        type="button"
        className="canvas-reset-view-button"
        onClick={() =>
          reactFlow.fitView({
            duration: 220,
            maxZoom: 1,
            padding: 0.24
          })
        }
      >
        Reset View
      </button>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={(_event, node) => onSelectScene(node.id)}
        onPaneClick={() => {
          setColorMenu(null);
          onClearSelection();
        }}
        onNodeContextMenu={(event, node) => {
          event.preventDefault();
          onSelectScene(node.id);
          setColorMenu({
            sceneId: node.id,
            x: event.clientX,
            y: event.clientY
          });
        }}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onConnect={handleConnect}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        minZoom={0.05}
        preventScrolling={false}
        fitView={false}
      >
        <Background color="#d7d0c3" gap={28} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            if (node.id === selectedSceneId) return "#4fc3f7";
            const scene = scenes.find((item) => item.id === node.id);
            return NODE_COLORS.find((color) => color.value === scene?.nodeColor)?.hex ?? "#eee4d5";
          }}
          maskColor="rgba(12, 17, 24, 0.68)"
        />
      </ReactFlow>
      {colorMenu && (
        <div
          className="node-color-menu"
          style={{ left: colorMenu.x, top: colorMenu.y }}
        >
          {NODE_COLORS.map((color) => (
            <button
              type="button"
              key={color.value}
              onClick={() => {
                onChangeSceneNodeColor(colorMenu.sceneId, color.value);
                setColorMenu(null);
              }}
            >
              <span style={{ background: color.hex }} />
              {color.label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function NodeThumbnail({
  mediaPath,
  mediaType
}: {
  mediaPath: string;
  mediaType: "image" | "video";
}) {
  const [src, setSrc] = useState(() => getNodeMediaSrc(mediaPath));
  const [isHidden, setHidden] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    setHidden(false);
    setSrc(getNodeMediaSrc(mediaPath));

    if (
      !isLocalPath(mediaPath) ||
      window.storyLife?.getMediaUrl ||
      !window.storyLife?.readImagePreview
    ) {
      return () => {
        isCurrent = false;
      };
    }

    window.storyLife
      .readImagePreview(mediaPath)
      .then((result) => {
        if (!isCurrent) {
          return;
        }
        if (result.ok) {
          setSrc(result.dataUrl);
          setHidden(false);
        } else if (isLocalPath(mediaPath)) {
          setHidden(true);
        }
      })
      .catch(() => {
        if (isCurrent && isLocalPath(mediaPath)) {
          setHidden(true);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [mediaPath]);

  if (isHidden || !src) {
    return null;
  }

  return mediaType === "video" ? (
    <video
      className="story-node-thumbnail"
      src={src}
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={(event) => {
        const video = event.currentTarget;
        video.pause();
        if (Number.isFinite(video.duration) && video.duration > 0.1) {
          video.currentTime = 0.1;
        }
      }}
      onError={() => setHidden(true)}
    />
  ) : (
    <img
      className="story-node-thumbnail"
      src={src}
      alt=""
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => setHidden(true)}
    />
  );
}

function getNodeMediaSrc(mediaPath: string): string {
  if (isLocalPath(mediaPath)) {
    if (window.storyLife?.getMediaUrl) {
      return window.storyLife.getMediaUrl(mediaPath);
    }
    if (window.storyLife?.readImagePreview) {
      return "";
    }
  }
  return toImageSrc(mediaPath);
}

const NODE_COLORS: Array<{
  value: SceneNodeColor;
  label: string;
  hex: string;
}> = [
  { value: "slate", label: "Default", hex: "#eee4d5" },
  { value: "green", label: "Green", hex: "#16a34a" },
  { value: "blue", label: "Blue", hex: "#2563eb" },
  { value: "purple", label: "Purple", hex: "#9333ea" },
  { value: "amber", label: "Amber", hex: "#d97706" },
  { value: "red", label: "Red", hex: "#dc2626" }
];

function formatLayoutName(layoutType: string): string {
  return layoutType
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}

function getNodeClassName(scene: Scene, startSceneId: SceneId): string {
  const classes = ["story-flow-node", `story-node-color-${scene.nodeColor}`];
  if (scene.id === startSceneId) {
    classes.push("story-flow-node-start");
  }
  if (scene.sceneType === "ending") {
    classes.push("story-flow-node-ending");
  } else if (scene.sceneType === "important") {
    classes.push("story-flow-node-important");
  } else if (
    scene.sceneType === "flagLogic" ||
    scene.choices.some(
      (choice) =>
        choice.conditions.length > 0 ||
        choice.effects.length > 0 ||
        choice.conditionalTargets.length > 0
    )
  ) {
    classes.push("story-flow-node-logic");
  }
  return classes.join(" ");
}

function getDefaultEdgeId(
  sourceSceneId: SceneId,
  sourceSceneIndex: number,
  choiceIndex: number,
  choiceId: string,
  targetSceneId: SceneId
): string {
  return `${sourceSceneId}::${sourceSceneIndex}::choice-${choiceIndex}::${choiceId}::${targetSceneId}`;
}

function getConditionalEdgeId(
  sourceSceneId: SceneId,
  sourceSceneIndex: number,
  choiceId: string,
  choiceIndex: number,
  conditionalTargetId: string,
  conditionalIndex: number,
  targetSceneId: SceneId
): string {
  return `${sourceSceneId}::${sourceSceneIndex}::choice-${choiceIndex}::${choiceId}::conditional-${conditionalIndex}::${conditionalTargetId}::${targetSceneId}`;
}

function formatConditions(conditions: ChoiceCondition[]): string {
  if (conditions.length === 0) {
    return "conditional target";
  }

  return conditions
    .map((condition) =>
      condition.type === "flag"
        ? `${condition.flagId} = ${condition.expectedValue}`
        : `${condition.parameterId} ${condition.operator} ${condition.value}`
    )
    .join(" + ");
}

function toImageSrc(imagePath: string): string {
  const trimmedPath = imagePath.trim();

  if (
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

function isLocalPath(imagePath: string): boolean {
  const trimmedPath = imagePath.trim();
  return trimmedPath.startsWith("file://") || /^[a-zA-Z]:\\/.test(trimmedPath);
}
