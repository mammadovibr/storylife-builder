import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactEventHandler
} from "react";
import type { SceneImageAnimation } from "../domain/project";
import {
  getAIPlaybackOrder,
  getProceduralAnimationFrames,
  getProceduralAnimationOptions
} from "../utils/imageAnimation";

interface AnimatedSceneImageProps {
  imagePath: string;
  animation: SceneImageAnimation | null;
  className?: string;
  style?: CSSProperties;
  alt?: string;
  playing?: boolean;
  onLoad?: ReactEventHandler<HTMLImageElement>;
  onError?: ReactEventHandler<HTMLImageElement>;
}

export function AnimatedSceneImage({
  imagePath,
  animation,
  className,
  style,
  alt = "",
  playing = true,
  onLoad,
  onError
}: AnimatedSceneImageProps) {
  const layerRef = useRef<HTMLSpanElement | null>(null);
  const activeAnimation = animation?.enabled ? animation : null;
  const framePaths = useMemo(() => {
    if (activeAnimation?.type !== "aiFrames") return [imagePath];
    return activeAnimation.frames.map((frame) =>
      frame.source === "original"
        ? activeAnimation.sourceImagePath || imagePath
        : frame.imagePath
    ).filter(Boolean);
  }, [activeAnimation, imagePath]);
  const [frameIndex, setFrameIndex] = useState(0);

  useEffect(() => {
    setFrameIndex(0);
    if (!playing || activeAnimation?.type !== "aiFrames" || framePaths.length < 2) return;
    const order = getAIPlaybackOrder(framePaths.length, activeAnimation.pingPong);
    let orderIndex = 0;
    const intervalId = window.setInterval(() => {
      orderIndex += 1;
      if (orderIndex >= order.length) {
        if (!activeAnimation.loop) {
          window.clearInterval(intervalId);
          setFrameIndex(order[order.length - 1] ?? 0);
          return;
        }
        orderIndex = 0;
      }
      setFrameIndex(order[orderIndex] ?? 0);
    }, Math.round(1000 / activeAnimation.fps));
    return () => window.clearInterval(intervalId);
  }, [activeAnimation, framePaths.length, playing]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || !playing || activeAnimation?.type !== "procedural") return;
    const playback = layer.animate(
      getProceduralAnimationFrames(
        activeAnimation.preset,
        activeAnimation.intensity,
        activeAnimation.direction
      ),
      getProceduralAnimationOptions(activeAnimation)
    );
    return () => playback.cancel();
  }, [activeAnimation, playing]);

  useEffect(() => {
    if (activeAnimation?.type !== "aiFrames") return;
    const preloaders = framePaths.map((path) => {
      const image = new Image();
      image.src = toAnimationMediaSrc(path);
      return image;
    });
    return () => preloaders.forEach((image) => { image.src = ""; });
  }, [activeAnimation, framePaths]);

  const visiblePath = framePaths[frameIndex] || imagePath;
  return (
    <span ref={layerRef} className="scene-image-animation-layer">
      <img
        className={className}
        style={style}
        src={toAnimationMediaSrc(visiblePath)}
        alt={alt}
        onLoad={onLoad}
        onError={onError}
      />
    </span>
  );
}

export function toAnimationMediaSrc(mediaPath: string): string {
  const trimmedPath = mediaPath.trim();
  if (/^[a-zA-Z]:\\/.test(trimmedPath) && window.storyLife?.getMediaUrl) {
    return window.storyLife.getMediaUrl(trimmedPath);
  }
  if (trimmedPath.startsWith("file://") && window.storyLife?.getMediaUrl) {
    return window.storyLife.getMediaUrl(trimmedPath);
  }
  return trimmedPath;
}
