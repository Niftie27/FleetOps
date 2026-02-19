import { useState, useRef, useCallback } from "react";

interface SpeedChartProps {
  data: { time: string; speed: number }[];
}

const PADDING = { top: 24, right: 24, bottom: 32, left: 48 };
const WIDTH = 600;
const HEIGHT = 220;
const CHART_W = WIDTH - PADDING.left - PADDING.right;
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;

// How many labels can fit without crowding (each label ~50px wide at viewBox scale)
const MAX_VISIBLE_LABELS = Math.floor(CHART_W / 52);

const SpeedChart = ({ data }: SpeedChartProps) => {
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; time: string; speed: number;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (!data.length) return null;

  const maxSpeed = Math.max(...data.map((d) => d.speed));
  const yMax = Math.ceil(Math.max(maxSpeed, 20) / 20) * 20;

  const xScale = (i: number) =>
    PADDING.left + (i / Math.max(data.length - 1, 1)) * CHART_W;
  const yScale = (v: number) =>
    PADDING.top + CHART_H - (v / yMax) * CHART_H;

  // Show label every Nth point so we never exceed MAX_VISIBLE_LABELS
  const labelStep = Math.max(1, Math.ceil(data.length / MAX_VISIBLE_LABELS));
  const showLabel = (i: number) =>
    i === 0 || i === data.length - 1 || i % labelStep === 0;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg || !data.length) return;
      const rect = svg.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * WIDTH;
      let closestIdx = 0;
      let closestDist = Infinity;
      data.forEach((_, i) => {
        const dist = Math.abs(xScale(i) - mouseX);
        if (dist < closestDist) { closestDist = dist; closestIdx = i; }
      });
      if (closestDist < 40) {
        setTooltip({
          x: xScale(closestIdx),
          y: yScale(data[closestIdx].speed),
          time: data[closestIdx].time,
          speed: data[closestIdx].speed,
        });
      } else {
        setTooltip(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data]
  );

  const linePoints = data.map((d, i) => `${xScale(i)},${yScale(d.speed)}`).join(" ");
  const areaPoints = `${PADDING.left},${PADDING.top + CHART_H} ${linePoints} ${xScale(data.length - 1)},${PADDING.top + CHART_H}`;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(yMax * t));

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTooltip(null)}
    >
      {/* Y grid + labels */}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PADDING.left} y1={yScale(tick)}
            x2={WIDTH - PADDING.right} y2={yScale(tick)}
            stroke="hsl(217,33%,25%)" strokeWidth="0.5"
          />
          <text
            x={PADDING.left - 6} y={yScale(tick) + 3}
            textAnchor="end" className="fill-muted-foreground" fontSize="9"
          >{tick}</text>
        </g>
      ))}

      {/* Y axis label */}
      <text x={10} y={PADDING.top - 6} className="fill-muted-foreground" fontSize="9">km/h</text>

      {/* Area fill */}
      <polygon points={areaPoints} fill="hsla(199,89%,48%,0.08)" />

      {/* Line */}
      <polyline
        fill="none" stroke="hsl(199,89%,48%)" strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" points={linePoints}
      />

      {/* Data point dots */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xScale(i)} cy={yScale(d.speed)}
          r={tooltip?.time === d.time ? 6 : 3}
          fill="hsl(199,89%,48%)" stroke="hsl(217,33%,17%)" strokeWidth="2"
          className="transition-all duration-150"
        />
      ))}

      {/* X-axis labels — only every Nth point */}
      {data.map((d, i) =>
        showLabel(i) ? (
          <text
            key={i}
            x={xScale(i)} y={HEIGHT - 6}
            textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
            className="fill-muted-foreground" fontSize="9"
          >
            {d.time}
          </text>
        ) : null
      )}

      {/* Tooltip */}
      {tooltip && (
        <g>
          <line
            x1={tooltip.x} y1={PADDING.top}
            x2={tooltip.x} y2={PADDING.top + CHART_H}
            stroke="hsl(199,89%,48%)" strokeWidth="1" strokeDasharray="4,3" opacity="0.5"
          />
          <rect
            x={Math.min(tooltip.x - 42, WIDTH - PADDING.right - 84)}
            y={tooltip.y - 42} width="84" height="34"
            rx="6" fill="hsl(217,33%,17%)" stroke="hsl(217,33%,28%)" strokeWidth="1"
          />
          <text
            x={Math.min(tooltip.x, WIDTH - PADDING.right - 42)}
            y={tooltip.y - 28}
            textAnchor="middle" fontSize="9" className="fill-muted-foreground"
          >{tooltip.time}</text>
          <text
            x={Math.min(tooltip.x, WIDTH - PADDING.right - 42)}
            y={tooltip.y - 15}
            textAnchor="middle" fontSize="12" fontWeight="600" fill="hsl(199,89%,48%)"
          >{tooltip.speed} km/h</text>
        </g>
      )}
    </svg>
  );
};

export default SpeedChart;
