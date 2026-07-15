import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties
} from "react";
import HTMLFlipBook from "react-pageflip";
import { getActiveSceneImageVariant, type Choice, type RuntimeState, type Scene, type StoryProject } from "../domain/project";
import { getChoiceButtonFrameStyle } from "../utils/choiceButtonFrames";
import { applyColorOpacity } from "../utils/colorOpacity";
import { AnimatedSceneImage } from "./AnimatedSceneImage";

export interface VisibleChoice {
  choice: Choice;
  isAvailable: boolean;
}

interface ScenePhoneSnapshot {
  scene: Scene;
  visibleChoices: VisibleChoice[];
}

export function TransitionedScenePhone(props: ScenePhoneProps) {
  const { project, scene, visibleChoices, onChoice, displayMode = "preview" } = props;
  const latestSnapshotRef = useRef<ScenePhoneSnapshot>({ scene, visibleChoices });
  const transitionTimerRef = useRef<number | null>(null);
  const [outgoing, setOutgoing] = useState<ScenePhoneSnapshot | null>(null);
  const [transitionRevision, setTransitionRevision] = useState(0);
  const sceneTransition = resolveSceneTransition(project, scene);
  const transitionDuration = getSceneTransitionDuration(
    sceneTransition,
    resolveSceneTransitionSpeed(project, scene)
  );

  useLayoutEffect(() => {
    const previousSnapshot = latestSnapshotRef.current;
    latestSnapshotRef.current = { scene, visibleChoices };
    if (previousSnapshot.scene.id === scene.id) {
      return;
    }

    setOutgoing(previousSnapshot);
    setTransitionRevision((revision) => revision + 1);
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current);
    }
    transitionTimerRef.current = window.setTimeout(() => {
      setOutgoing(null);
      transitionTimerRef.current = null;
    }, transitionDuration + (sceneTransition === "pageTurn" ? 180 : 50));
  }, [scene, sceneTransition, transitionDuration, visibleChoices]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current !== null) {
        window.clearTimeout(transitionTimerRef.current);
      }
    },
    []
  );

  return (
    <div
      className={`scene-transition-stage scene-transition-stage-${sceneTransition} ${
        outgoing ? "is-transitioning" : ""
      } ${displayMode === "export" ? "is-export" : "is-preview"}`}
      style={{
        "--scene-transition-duration": `${transitionDuration}ms`
      } as CSSProperties}
    >
      {outgoing &&
        (sceneTransition === "pageTurn" ? (
          <PageFlipSceneTransition
            key={`page-turn-${outgoing.scene.id}-${scene.id}-${transitionRevision}`}
            project={project}
            outgoing={outgoing}
            incoming={{ scene, visibleChoices }}
            onChoice={onChoice}
            displayMode={displayMode}
            duration={transitionDuration}
          />
        ) : (
          <div
            className="scene-transition-layer is-outgoing"
            key={`outgoing-${outgoing.scene.id}-${transitionRevision}`}
            aria-hidden="true"
          >
            <ScenePhone
              project={project}
              scene={outgoing.scene}
              visibleChoices={outgoing.visibleChoices}
              onChoice={onChoice}
              displayMode={displayMode}
            />
          </div>
        ))}
      <div
        className="scene-transition-layer is-incoming"
        key={`incoming-${scene.id}-${transitionRevision}`}
      >
        <ScenePhone
          project={project}
          scene={scene}
          visibleChoices={visibleChoices}
          onChoice={onChoice}
          displayMode={displayMode}
        />
      </div>
    </div>
  );
}

interface PageFlipSceneTransitionProps {
  project: StoryProject;
  outgoing: ScenePhoneSnapshot;
  incoming: ScenePhoneSnapshot;
  onChoice: (choice: Choice) => void;
  displayMode: "preview" | "export";
  duration: number;
}

interface PageFlipHandle {
  pageFlip: () =>
    | {
        flipNext: (corner?: "top" | "bottom") => void;
      }
    | undefined;
}

function PageFlipSceneTransition({
  project,
  outgoing,
  incoming,
  onChoice,
  displayMode,
  duration
}: PageFlipSceneTransitionProps) {
  const bookRef = useRef<PageFlipHandle | null>(null);
  const [pageSize, setPageSize] = useState(() => getPageFlipSize(displayMode));

  useLayoutEffect(() => {
    const updateSize = () => {
      const nextSize = getPageFlipSize(displayMode);
      setPageSize((currentSize) =>
        currentSize.width === nextSize.width && currentSize.height === nextSize.height
          ? currentSize
          : nextSize
      );
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [displayMode]);

  return (
    <div className="scene-pageflip-host" aria-hidden="true">
      <HTMLFlipBook
        key={`${pageSize.width}x${pageSize.height}`}
        ref={bookRef}
        className="scene-pageflip-book"
        style={{}}
        startPage={0}
        size="fixed"
        width={pageSize.width}
        height={pageSize.height}
        minWidth={pageSize.width}
        maxWidth={pageSize.width}
        minHeight={pageSize.height}
        maxHeight={pageSize.height}
        drawShadow
        flippingTime={duration}
        usePortrait
        startZIndex={10}
        autoSize={false}
        maxShadowOpacity={0.48}
        showCover={false}
        mobileScrollSupport
        clickEventForward={false}
        useMouseEvents={false}
        swipeDistance={30}
        showPageCorners={false}
        disableFlipByClick
        renderOnlyPageLengthChange
        onInit={() => {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              bookRef.current?.pageFlip()?.flipNext("bottom");
            });
          });
        }}
      >
        <div className="scene-pageflip-page" data-density="soft">
          <ScenePhone
            project={project}
            scene={outgoing.scene}
            visibleChoices={outgoing.visibleChoices}
            onChoice={onChoice}
            displayMode={displayMode}
          />
        </div>
        <div className="scene-pageflip-page" data-density="soft">
          <ScenePhone
            project={project}
            scene={incoming.scene}
            visibleChoices={incoming.visibleChoices}
            onChoice={onChoice}
            displayMode={displayMode}
          />
        </div>
      </HTMLFlipBook>
    </div>
  );
}

function getPageFlipSize(displayMode: "preview" | "export") {
  if (typeof window === "undefined") {
    return { width: 390, height: 760 };
  }

  if (displayMode === "export") {
    return {
      width: Math.max(1, document.documentElement.clientWidth || window.innerWidth),
      height: Math.max(760, window.innerHeight)
    };
  }

  return {
    width: 390,
    height: Math.max(1, Math.min(760, window.innerHeight - 170))
  };
}

interface ScenePhoneProps {
  project: StoryProject;
  scene: Scene;
  visibleChoices: VisibleChoice[];
  onChoice: (choice: Choice) => void;
  displayMode?: "preview" | "export";
}

export function ScenePhone({
  project,
  scene,
  visibleChoices,
  onChoice,
  displayMode = "preview"
}: ScenePhoneProps) {
  const imageSrc = useResolvedMediaSrc(scene.imagePath);
  const effectiveLayout =
    scene.layoutType === "noImage" || scene.imagePath.trim() === ""
      ? "noImage"
      : scene.layoutType;
  const choicesAreTransparent =
    scene.style.choicesPanelTransparent || scene.style.choicesPanelOpacity <= 0;
  return (
    <article
      className={`play-card-exact scene-live-preview-phone scene-preview-layout-${effectiveLayout} scene-ornament-${scene.style.ornamentStyle} ${
        displayMode === "export" ? "scene-export-viewport" : ""
      }`}
      key={scene.id}
      style={getExactPhoneStyle(scene, effectiveLayout, project, imageSrc)}
    >
      <ExactSceneVisual scene={scene} mediaSrc={imageSrc} />
      <ExactSceneTitle scene={scene} project={project} />
      <ExactSceneText scene={scene} project={project} />
      <div
        className={`scene-mini-choice exact-play-choices ${
          scene.style.choicesPanelHeight > 0 ? "has-fixed-height" : ""
        }`}
        style={getExactChoicesStyle(scene)}
      >
        <div className="scene-preview-choice-list">
          {visibleChoices.map(({ choice, isAvailable }) => (
            <button
              type="button"
              key={choice.id}
              disabled={!isAvailable}
              className={`choice-preview-input exact-play-choice-button ${
                !isAvailable ? "locked-choice" : ""
              } ${choicesAreTransparent ? "transparent-choice-button" : ""} ${
                scene.style.choicesBorderEnabled && scene.style.ornamentStyle !== "none"
                  ? "scene-ornament-panel"
                  : ""
              }`}
              style={getExactChoiceButtonStyle(scene)}
              onClick={() => {
                playChoiceClickSound();
                onChoice(choice);
              }}
            >
              <span
                className="choice-text-inner"
                style={getChoiceTextOffsetStyle(scene)}
              >
                {!isAvailable ? "Locked: " : ""}
                {choice.text}
              </span>
            </button>
          ))}
        </div>
      </div>
    </article>
  );
}

function resolveSceneTransition(project: StoryProject, scene: Scene) {
  return scene.style.sceneTransition === "project"
    ? project.theme.sceneTransition
    : scene.style.sceneTransition;
}

function resolveSceneTransitionSpeed(project: StoryProject, scene: Scene) {
  return scene.style.sceneTransitionSpeed > 0
    ? scene.style.sceneTransitionSpeed
    : project.theme.sceneTransitionSpeed;
}

function getSceneTransitionDuration(
  transition: ReturnType<typeof resolveSceneTransition>,
  speed: number
) {
  const safeSpeed = Math.min(2, Math.max(0.5, speed || 1));
  const baseDuration =
    transition === "pageTurn" ? 1250 : transition === "crossfade" ? 720 : 640;
  return Math.round(baseDuration / safeSpeed);
}

function ExactSceneVisual({ scene, mediaSrc }: { scene: Scene; mediaSrc: string }) {
  if (scene.imagePath.trim() === "" || mediaSrc.trim() === "" || scene.layoutType === "noImage") {
    return null;
  }

  return (
    <div
      className="scene-preview-editable scene-preview-image-editable"
      style={getExactImageFrameStyle(scene)}
    >
      {scene.visualMediaType === "video" ? (
        <video
          className="scene-preview-image"
          style={getExactImageStyle(scene)}
          src={mediaSrc}
          autoPlay
          muted={scene.soundPath.trim() !== ""}
          playsInline
          loop={scene.videoLoop}
          preload="auto"
        />
      ) : (
        <AnimatedSceneImage
          imagePath={scene.imagePath}
          animation={getActiveSceneImageVariant(scene)?.animation ?? null}
          className="scene-preview-image"
          style={getExactImageStyle(scene)}
          alt=""
          onError={(event) => {
            event.currentTarget.style.visibility = "hidden";
          }}
          onLoad={(event) => {
            event.currentTarget.style.visibility = "visible";
          }}
        />
      )}
    </div>
  );
}

function ExactSceneText({
  scene,
  project
}: {
  scene: Scene;
  project: StoryProject;
}) {
  return (
    <section
      className={`scene-preview-text-panel ${
        scene.style.textBorderEnabled && scene.style.ornamentStyle !== "none"
          ? "scene-ornament-panel"
          : ""
      }`}
      style={getExactTextStyle(scene, project)}
    >
      <p style={getTextContentOffsetStyle(scene, "text")}>{scene.text}</p>
    </section>
  );
}

function ExactSceneTitle({
  scene,
  project
}: {
  scene: Scene;
  project: StoryProject;
}) {
  if (!scene.style.showSceneTitle) {
    return null;
  }

  return (
    <section
      className={`scene-preview-title-panel ${
        scene.style.titleBorderEnabled && scene.style.ornamentStyle !== "none"
          ? "scene-ornament-panel"
          : ""
      }`}
      style={getExactTitleStyle(scene, project)}
    >
      <h1
        style={{
          fontSize: `${scene.style.titleFontSize}px`,
          ...getTextContentOffsetStyle(scene, "title")
        }}
      >
        {scene.title}
      </h1>
    </section>
  );
}

function getExactPhoneStyle(
  scene: Scene,
  effectiveLayout: string,
  project: StoryProject,
  imageSrc: string
): CSSProperties {
  void effectiveLayout;
  void imageSrc;

  return {
    background: scene.style.backgroundColor || project.theme.backgroundColor,
    color: scene.style.textColor || project.theme.textColor
  };
}

function getExactTextStyle(scene: Scene, project: StoryProject): CSSProperties {
  return {
    ...getExactTransformStyle(scene, "text"),
    ...getPanelVisualStyle({
      transparent: scene.style.textPanelTransparent || scene.style.textPanelOpacity <= 0,
      color: scene.style.textPanelColor || "#fffdfa",
      borderColor: scene.style.textBorderColor || "#a48d69",
      borderEnabled: scene.style.textBorderEnabled,
      opacity: scene.style.textPanelOpacity
    }),
    color: scene.style.textColor || project.theme.textColor,
    fontFamily: getSceneFontFamily(scene.style.textFontFamily),
    fontSize: `${scene.style.textFontSize}px`,
    width: scene.style.textPanelWidth > 0 ? `${scene.style.textPanelWidth}px` : undefined,
    height:
      scene.style.textPanelHeight > 0 ? `${scene.style.textPanelHeight}px` : undefined,
    textAlign: scene.style.textAlign,
    padding: `${scene.style.textPaddingTop}px ${scene.style.textPaddingSide}px`
  };
}

function getExactTitleStyle(scene: Scene, project: StoryProject): CSSProperties {
  return {
    ...getExactTransformStyle(scene, "title"),
    ...getPanelVisualStyle({
      transparent: scene.style.titlePanelTransparent || scene.style.titlePanelOpacity <= 0,
      color: scene.style.titlePanelColor || "#fffdfa",
      borderColor: scene.style.titleBorderColor || "#a48d69",
      borderEnabled: scene.style.titleBorderEnabled,
      opacity: scene.style.titlePanelOpacity
    }),
    color: scene.style.titleTextColor || scene.style.textColor || project.theme.textColor,
    fontFamily: getSceneFontFamily(scene.style.textFontFamily),
    width:
      scene.style.titlePanelWidth > 0 ? `${scene.style.titlePanelWidth}px` : undefined,
    height:
      scene.style.titlePanelHeight > 0
        ? `${scene.style.titlePanelHeight}px`
        : undefined,
    textAlign: scene.style.textAlign,
    padding: `${scene.style.titlePaddingTop}px ${scene.style.titlePaddingSide}px`
  };
}

function getExactImageFrameStyle(scene: Scene): CSSProperties {
  return {
    transform: `translate(${scene.style.imageOffsetX / 3}px, ${
      scene.style.imageOffsetY / 3
    }px) scale(${scene.style.imageScale})`
  };
}

function getExactImageStyle(scene: Scene): CSSProperties {
  return {
    clipPath: `inset(${scene.style.imageCropTop}% ${scene.style.imageCropRight}% ${scene.style.imageCropBottom}% ${scene.style.imageCropLeft}%)`,
    filter: `brightness(${scene.style.imageBrightness})`,
    opacity: scene.style.imageOpacity
  };
}

function getExactTransformStyle(
  scene: Scene,
  target: "image" | "title" | "text" | "choices"
): CSSProperties {
  const style = scene.style;
  const x =
    target === "image"
      ? style.imageOffsetX
      : target === "title"
        ? style.titleOffsetX
      : target === "text"
        ? style.textOffsetX
        : style.choicesOffsetX;
  const y =
    target === "image"
      ? style.imageOffsetY
      : target === "title"
        ? style.titleOffsetY
      : target === "text"
        ? style.textOffsetY
        : style.choicesOffsetY;
  const scale =
    target === "image"
      ? style.imageScale
      : target === "title"
        ? style.titleScale
      : target === "text"
        ? style.textScale
        : style.choicesScale;

  return {
    transform: `translate(-50%, 0) translate(${x / 3}px, ${y / 3}px) scale(${scale})`
  };
}

function getExactChoicesStyle(scene: Scene): CSSProperties {
  return {
    ...getExactTransformStyle(scene, "choices"),
    color: scene.style.choicesTextColor || undefined,
    fontSize: `${scene.style.choicesFontSize}px`,
    fontFamily: getSceneFontFamily(scene.style.choicesFontFamily),
    width:
      scene.style.choicesPanelWidth > 0 ? `${scene.style.choicesPanelWidth}px` : undefined,
    minHeight:
      scene.style.choicesPanelHeight > 0
        ? `${scene.style.choicesPanelHeight}px`
        : undefined
  };
}

function getExactChoiceButtonStyle(scene: Scene): CSSProperties {
  return {
    ...getPanelVisualStyle({
      transparent: scene.style.choicesPanelTransparent || scene.style.choicesPanelOpacity <= 0,
      color: scene.style.choicesPanelColor || "#fffaf1",
      borderColor: scene.style.choicesBorderColor || "#807058",
      borderEnabled: scene.style.choicesBorderEnabled,
      opacity: scene.style.choicesPanelOpacity
    }),
    color: scene.style.choicesTextColor || undefined,
    fontSize: `${scene.style.choicesFontSize}px`,
    fontFamily: getSceneFontFamily(scene.style.choicesFontFamily),
    padding: `${scene.style.choicesPaddingTop}px ${scene.style.choicesPaddingSide}px`,
    ...getChoiceButtonFrameStyle(
      scene.style.choicesFrameStyle,
      scene.style.choicesPanelTransparent ? 0 : scene.style.choicesPanelOpacity
    )
  };
}

function getTextContentOffsetStyle(
  scene: Scene,
  target: "title" | "text"
): CSSProperties {
  const x = target === "title" ? scene.style.titleTextOffsetX : scene.style.sceneTextOffsetX;
  const y = target === "title" ? scene.style.titleTextOffsetY : scene.style.sceneTextOffsetY;
  return { transform: `translate(${x / 3}px, ${y / 3}px)` };
}

function getChoiceTextOffsetStyle(scene: Scene): CSSProperties {
  return {
    transform: `translate(${scene.style.choiceTextOffsetX / 3}px, ${
      scene.style.choiceTextOffsetY / 3
    }px)`
  };
}

function getSceneFontFamily(fontFamily: string): string {
  if (fontFamily === "serif") {
    return 'Georgia, "Times New Roman", serif';
  }
  if (fontFamily === "mono") {
    return '"Cascadia Mono", "Consolas", monospace';
  }
  return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
}

function getPanelVisualStyle({
  transparent,
  color,
  borderColor,
  borderEnabled,
  opacity
}: {
  transparent: boolean;
  color: string;
  borderColor: string;
  borderEnabled: boolean;
  opacity: number;
}): CSSProperties {
  if (transparent || opacity <= 0) {
    return {
      background: "transparent",
      border: 0,
      boxShadow: "none",
      backdropFilter: "none"
    };
  }

  return {
    background: colorToRgba(color, opacity),
    ...(borderEnabled
      ? { borderColor: colorToRgba(borderColor, Math.min(1, Math.max(0.12, opacity))) }
      : { border: 0 }),
    boxShadow: opacity < 0.08 ? "none" : undefined,
    backdropFilter: "none"
  };
}

function colorToRgba(color: string, opacity: number): string {
  return applyColorOpacity(color, opacity);
}

export function toMediaSrc(imagePath: string): string {
  const trimmedPath = imagePath.trim();

  if (isLocalMediaPath(trimmedPath) && window.storyLife?.getMediaUrl) {
    return window.storyLife.getMediaUrl(trimmedPath);
  }

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

function useResolvedMediaSrc(imagePath: string): string {
  const [src, setSrc] = useState(() => getInitialMediaSrc(imagePath));

  useEffect(() => {
    let isCurrent = true;
    setSrc(getInitialMediaSrc(imagePath));

    if (
      !imagePath.trim() ||
      !isLocalMediaPath(imagePath) ||
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

  return src;
}

function getInitialMediaSrc(mediaPath: string): string {
  if (
    isLocalMediaPath(mediaPath) &&
    !window.storyLife?.getMediaUrl &&
    window.storyLife?.readImagePreview
  ) {
    return "";
  }
  return toMediaSrc(mediaPath);
}

function isLocalMediaPath(mediaPath: string): boolean {
  const trimmedPath = mediaPath.trim();
  return trimmedPath.startsWith("file://") || /^[a-zA-Z]:\\/.test(trimmedPath);
}

function playChoiceClickSound() {
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & {
      webkitAudioContext?: typeof AudioContext;
    }).webkitAudioContext;

  if (!AudioContextClass) {
    return;
  }

  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(740, now);
  oscillator.frequency.exponentialRampToValueAtTime(980, now + 0.07);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.14);
  oscillator.addEventListener("ended", () => void audioContext.close());
}

export type { RuntimeState };
