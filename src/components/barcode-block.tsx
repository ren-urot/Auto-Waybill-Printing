'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export function BarcodeBlock({ value }: { value: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      JsBarcode(svgRef.current, value, { format: 'CODE128', height: 40, displayValue: true, fontSize: 12 });
    }
  }, [value]);

  return <svg ref={svgRef} />;
}
