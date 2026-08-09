'use client';

interface MiniLineChartProps {
  points: number[];
  labels: string[];
  color?: string;
}

// A deliberately small, dependency-free line chart — this app has no
// charting library installed, and the data it renders today is placeholder
// (see the "mock" callouts wherever this is used), so a lightweight SVG is
// enough. Swap for a real charting library once there's real series data
// and more than one chart shape to support.
export function MiniLineChart({ points, labels, color = 'var(--primary)' }: MiniLineChartProps) {
  const width = 640;
  const height = 180;
  const padding = 24;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;

  const step = (width - padding * 2) / (points.length - 1 || 1);
  const coords = points.map((value, i) => {
    const x = padding + i * step;
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return [x, y] as const;
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1][0]},${height - padding} L${coords[0][0]},${height - padding} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Sales trend chart">
      <defs>
        <linearGradient id="mini-line-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#mini-line-fill)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {coords.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.5} fill={color} />
      ))}
      {labels.map((label, i) => (
        <text
          key={label + i}
          x={coords[i]?.[0] ?? 0}
          y={height - 4}
          fontSize={10}
          textAnchor="middle"
          className="fill-muted-foreground"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
