'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeBlockProps {
  value: string;
  /** Called once the barcode has actually been drawn into the SVG. */
  onRendered?: () => void;
  height?: number;
  fontSize?: number;
}

export function BarcodeBlock({ value, onRendered, height = 40, fontSize = 12 }: BarcodeBlockProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Held in a ref so a changing inline callback doesn't re-run the effect and
  // redraw the barcode on every parent render.
  const onRenderedRef = useRef(onRendered);
  useEffect(() => {
    onRenderedRef.current = onRendered;
  });

  useEffect(() => {
    if (!svgRef.current) return;
    // JsBarcode draws synchronously, so the code is on screen by the time this
    // returns.
    JsBarcode(svgRef.current, value, { format: 'CODE128', height, displayValue: true, fontSize });
    onRenderedRef.current?.();
  }, [value, height, fontSize]);

  return <svg ref={svgRef} />;
}
