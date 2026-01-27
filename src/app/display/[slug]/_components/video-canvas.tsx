'use client';

import { useRef, useEffect, useCallback } from 'react';
import type { DisplayConfig } from '@/lib/display/types';
import { useDisplayStore } from '@/lib/display/use-display-store';

interface VideoCanvasProps {
  config: DisplayConfig;
  onVideoEnded: () => void;
  onVideoError: () => void;
}

export function VideoCanvas({
  config,
  onVideoEnded,
  onVideoError,
}: VideoCanvasProps) {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);

  const activeSlot = useDisplayStore((s) => s.activeSlot);
  const currentContent = useDisplayStore((s) => s.currentContent);
  const nextContent = useDisplayStore((s) => s.nextContent);
  const playerState = useDisplayStore((s) => s.playerState);
  const setSlotReady = useDisplayStore((s) => s.setSlotReady);
  const log = useDisplayStore((s) => s.log);

  const isDefaultContent =
    playerState === 'default_content' || playerState === 'initializing';
  const defaultUrl = config.defaultContentUrl;

  // Determine which URL goes to which slot
  const activeVideo = activeSlot === 'A' ? videoARef : videoBRef;
  const inactiveVideo = activeSlot === 'A' ? videoBRef : videoARef;

  // Load current content into active slot
  useEffect(() => {
    const video = activeVideo.current;
    if (!video) return;

    if (isDefaultContent && defaultUrl) {
      if (video.src !== defaultUrl) {
        video.src = defaultUrl;
        video.loop = true;
        video.load();
        video.play().catch(() => {
          log('warn', 'Default content autoplay blocked');
        });
      }
      return;
    }

    if (currentContent?.mediaUrl) {
      // Clear before reassigning to prevent memory leaks
      if (video.src && video.src !== currentContent.mediaUrl) {
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
      video.src = currentContent.mediaUrl;
      video.loop = false;
      video.load();
      video.play().catch(() => {
        log('warn', 'Content autoplay blocked');
      });
    }
  // eslint-disable-next-line
  }, [currentContent?.mediaUrl, playerState]);

  // Preload next content into inactive slot
  useEffect(() => {
    const video = inactiveVideo.current;
    if (!video) return;

    if (nextContent?.mediaUrl) {
      if (video.src !== nextContent.mediaUrl) {
        video.pause();
        video.removeAttribute('src');
        video.load();
        video.src = nextContent.mediaUrl;
        video.loop = false;
        video.load();
      }
    } else {
      // Clear inactive slot when no next content
      video.pause();
      video.removeAttribute('src');
      video.load();
      setSlotReady(activeSlot === 'A' ? 'B' : 'A', false);
    }
  // eslint-disable-next-line
  }, [nextContent?.mediaUrl]);

  // Handle video ended on active slot
  const handleEnded = useCallback(() => {
    if (!isDefaultContent) {
      onVideoEnded();
    }
  }, [isDefaultContent, onVideoEnded]);

  // Handle video error
  const handleError = useCallback(() => {
    log('error', 'Video element error');
    onVideoError();
  // eslint-disable-next-line
  }, [onVideoError]);

  // Handle inactive video can play (preload ready)
  const handleCanPlayInactive = useCallback(() => {
    const slot = activeSlot === 'A' ? 'B' : 'A';
    setSlotReady(slot, true);
    log('info', `Slot ${slot} preloaded and ready`);
  // eslint-disable-next-line
  }, [activeSlot]);

  const sharedProps = {
    muted: true,
    playsInline: true,
    preload: 'auto' as const,
    crossOrigin: 'anonymous' as const,
    className:
      'absolute inset-0 w-full h-full object-contain transition-opacity duration-500',
  };

  return (
    <div className="absolute inset-0">
      {/* Slot A */}
      <video
        ref={videoARef}
        {...sharedProps}
        style={{ opacity: activeSlot === 'A' ? 1 : 0, zIndex: activeSlot === 'A' ? 1 : 0 }}
        onEnded={activeSlot === 'A' ? handleEnded : undefined}
        onError={activeSlot === 'A' ? handleError : undefined}
        onCanPlay={activeSlot !== 'A' ? handleCanPlayInactive : undefined}
      />

      {/* Slot B */}
      <video
        ref={videoBRef}
        {...sharedProps}
        style={{ opacity: activeSlot === 'B' ? 1 : 0, zIndex: activeSlot === 'B' ? 1 : 0 }}
        onEnded={activeSlot === 'B' ? handleEnded : undefined}
        onError={activeSlot === 'B' ? handleError : undefined}
        onCanPlay={activeSlot !== 'B' ? handleCanPlayInactive : undefined}
      />

      {/* Fallback: if no content and no default, show black with billboard name */}
      {!currentContent && !defaultUrl && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="text-white/30 text-2xl font-light">
            {config.billboardName}
          </p>
        </div>
      )}
    </div>
  );
}
