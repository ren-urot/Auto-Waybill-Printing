'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QRBlockProps {
  value: string;
  /** Called once the QR code has actually finished drawing into the canvas. */
  onRendered?: () => void;
}

export function QRBlock({ value, onRendered }: QRBlockProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onRenderedRef = useRef(onRendered);
  useEffect(() => {
    onRenderedRef.current = onRendered;
  });

  useEffect(() => {
    if (!canvasRef.current) return;
    // toCanvas is async. Previously this promise was neither awaited nor
    // caught, so a rejection was a silent unhandled rejection and the print
    // page had no way to know when drawing had finished.
    QRCode.toCanvas(canvasRef.current, value, { width: 96, margin: 0 })
      .then(() => onRenderedRef.current?.())
      .catch(console.error);
  }, [value]);

  return <canvas ref={canvasRef} />;
}
