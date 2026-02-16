import { useState, useRef, useCallback } from "react";

interface SpeedChartProps {
  data: { time: string; speed: number }[];
}

const PADDING = { top: 20, right: 20, bottom: 30, left: 45 };
const WIDTH = 600;
const HEIGHT = 250;
const CHART_W = WIDTH - PADDING.left - PADDING.right;
const CHART_H = HEIGHT - PADDING.top - PADDING.bottom;

const SpeedChart = ({ data }: SpeedChartProps) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; time: string; speed: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const maxSpeed = Math.max(...(data.length ? data.map((d) => d.speed) : [10]));
  const yMax = Math.ceil(maxSpeed / 20) * 20;

  const xScale = useCallback((i: number) => PADDING.left + (i / Math.max(data.length - 1, 1)) * CHART_W, [data.length]);
  const yScale = useCallback((v: number) => PADDING.top + CHART_H - (v / yMax) * CHART_H, [yMax]);

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
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
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
    [data, xScale, yScale]
  );

  if (!data.length) return null;

  const linePoints = data.map((d, i) => `${xScale(i)},${yScale(d.speed)}`).join(" ");
  const areaPoints = `${PADDING.left},${PADDING.top + CHART_H} ${linePoints} ${xScale(data.length - 1)},${PADDING.top + CHART_H}`;

  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((yMax / 4) * i));

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setTooltip(null)}
    >
      {/* Grid lines */}
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PADDING.left}
            y1={yScale(tick)}
            x2={WIDTH - PADDING.right}
            y2={yScale(tick)}
            stroke="hsl(217,33%,25%)"
            strokeWidth="0.5"
          />
          <text
            x={PADDING.left - 8}
            y={yScale(tick) + 3}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize="10"
          >
            {tick}
          </text>
        </g>
      ))}

      {/* X-axis labels */}
      {data.map((d, i) => (
        <text
          key={i}
          x={xScale(i)}
          y={HEIGHT - 6}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="10"
        >
          {d.time}
        </text>
      ))}

      {/* Y-axis label */}
      <text
        x={12}
        y={PADDING.top - 6}
        className="fill-muted-foreground"
        fontSize="10"
      >
        km/h
      </text>

      {/* Area fill */}
      <polygon points={areaPoints} fill="hsla(199,89%,48%,0.08)" />

      {/* Line */}
      <polyline
        fill="none"
        stroke="hsl(199,89%,48%)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={linePoints}
      />

      {/* Data points */}
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xScale(i)}
          cy={yScale(d.speed)}
          r={tooltip?.time === d.time ? 6 : 3.5}
          fill="hsl(199,89%,48%)"
          stroke="hsl(217,33%,17%)"
          strokeWidth="2"
          className="transition-all duration-150"
        />
      ))}

      {/* Tooltip */}
      {tooltip && (
        <g>
          {/* Vertical line */}
          <line
            x1={tooltip.x}
            y1={PADDING.top}
            x2={tooltip.x}
            y2={PADDING.top + CHART_H}
            stroke="hsl(199,89%,48%)"
            strokeWidth="1"
            strokeDasharray="4,3"
            opacity="0.4"
          />
          {/* Tooltip box */}
          <rect
            x={tooltip.x - 42}
            y={tooltip.y - 38}
            width="84"
            height="30"
            rx="6"
            fill="hsl(217,33%,17%)"
            stroke="hsl(217,33%,25%)"
            strokeWidth="1"
          />
          <text
            x={tooltip.x}
            y={tooltip.y - 25}
            textAnchor="middle"
            fontSize="10"
            className="fill-muted-foreground"
          >
            {tooltip.time}
          </text>
          <text
            x={tooltip.x}
            y={tooltip.y - 13}
            textAnchor="middle"
            fontSize="12"
            fontWeight="600"
            fill="hsl(199,89%,48%)"
          >
            {tooltip.speed} km/h
          </text>
        </g>
      )}
    </svg>
  );
};

export default SpeedChart;
