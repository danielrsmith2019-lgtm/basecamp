'use client';

import { useRef, useState, useCallback } from 'react';

/**
 * useShareWorkout — hook for rendering a ShareCard to canvas
 * and triggering navigator.share() or download fallback.
 *
 * Returns:
 *   - cardRef: attach to <ShareCard ref={cardRef}>
 *   - isGenerating: loading state
 *   - shareWorkout: async () => void
 *   - downloadImage: async () => void
 *   - error: string | null
 */
export function useShareWorkout({ onShared } = {}) {
  const cardRef = useRef(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const renderToCanvas = useCallback(async () => {
    if (!cardRef.current) throw new Error('ShareCard ref not attached');

    // Dynamically import html2canvas (tree-shaking friendly)
    const html2canvas = (await import('html2canvas')).default;

    const canvas = await html2canvas(cardRef.current, {
      scale: 1, // Card is already 1080×1920
      useCORS: true,
      backgroundColor: '#0a0a0a',
      logging: false,
      width: 1080,
      height: 1920,
    });

    return canvas;
  }, []);

  const canvasToBlob = useCallback((canvas) => {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create image blob'));
        },
        'image/png',
        1.0
      );
    });
  }, []);

  /**
   * shareWorkout — native share on mobile, download fallback on desktop
   */
  const shareWorkout = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const canvas = await renderToCanvas();
      const blob = await canvasToBlob(canvas);
      const file = new File([blob], 'basecamp-workout.png', {
        type: 'image/png',
      });

      // Try native share (mobile)
      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: 'My BaseCamp Workout',
          text: 'Check out my workout on BaseCamp!',
          files: [file],
        });
        onShared?.();
      } else {
        // Fallback: download
        await downloadBlob(blob);
        onShared?.();
      }
    } catch (err) {
      // User cancelled share — not an error
      if (err.name === 'AbortError') return;
      console.error('Share failed:', err);
      setError('Failed to share. Try downloading instead.');
    } finally {
      setIsGenerating(false);
    }
  }, [renderToCanvas, canvasToBlob, onShared]);

  /**
   * downloadImage — force-download the card as PNG
   */
  const downloadImage = useCallback(async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const canvas = await renderToCanvas();
      const blob = await canvasToBlob(canvas);
      await downloadBlob(blob);
      onShared?.();
    } catch (err) {
      console.error('Download failed:', err);
      setError('Failed to generate image.');
    } finally {
      setIsGenerating(false);
    }
  }, [renderToCanvas, canvasToBlob, onShared]);

  return {
    cardRef,
    isGenerating,
    shareWorkout,
    downloadImage,
    error,
  };
}

/* ─── Helper ───────────────────────────────────────────────────────── */

function downloadBlob(blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `basecamp-workout-${Date.now()}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}