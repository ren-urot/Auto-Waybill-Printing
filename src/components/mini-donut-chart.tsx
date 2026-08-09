export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface MiniDonutChartProps {
  segments: DonutSegment[];
  centerLabel: string;
  centerValue: string;
}

// Dependency-free SVG donut — see mini-line-chart.tsx for why this app
// hand-rolls charts instead of pulling in a charting library right now.
export function MiniDonutChart({ segments, centerLabel, centerValue }: MiniDonutChartProps) {
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const radius = 60;
  const stroke = 20;
  const circumference = 2 * Math.PI * radius;

  const arcs = segments.reduce<Array<DonutSegment & { dash: number; offset: number }>>((acc, segment) => {
    const previous = acc[acc.length - 1];
    const offset = previous ? previous.offset + previous.dash : 0;
    const dash = (segment.value / total) * circumference;
    acc.push({ ...segment, dash, offset });
    return acc;
  }, []);

  return (
    <div className="flex items-center gap-6">
      <svg width={160} height={160} viewBox="0 0 160 160" role="img" aria-label={`${centerLabel} breakdown`}>
        <g transform="translate(80,80) rotate(-90)">
          <circle r={radius} fill="none" stroke="var(--border)" strokeWidth={stroke} />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={stroke}
              strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
              strokeDashoffset={-arc.offset}
              strokeLinecap="butt"
            />
          ))}
        </g>
        <text x="80" y="76" textAnchor="middle" fontSize={20} fontWeight={600} className="fill-foreground font-mono">
          {centerValue}
        </text>
        <text x="80" y="94" textAnchor="middle" fontSize={11} className="fill-muted-foreground">
          {centerLabel}
        </text>
      </svg>
      <ul className="space-y-2 text-sm">
        {segments.map((segment) => (
          <li key={segment.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="text-muted-foreground">{segment.label}</span>
            <span className="font-mono font-medium">
              {segment.value} ({total > 0 ? Math.round((segment.value / total) * 1000) / 10 : 0}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
