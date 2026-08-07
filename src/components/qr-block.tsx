'use client';

import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export function QRBlock({ value }: { value: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, { width: 96, margin: 0 });
    }
  }, [value]);

  return <canvas ref={canvasRef} />;
}
