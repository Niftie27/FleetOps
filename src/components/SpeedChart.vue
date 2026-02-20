<template>
  <svg
    ref="svgRef"
    :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
    class="h-full w-full select-none"
    preserveAspectRatio="xMidYMid meet"
    @mousemove="handleMouseMove"
    @mouseleave="tooltip = null"
  >
    <!-- Y grid lines + labels -->
    <g v-for="tick in yTicks" :key="tick">
      <line
        :x1="P.left" :y1="yScale(tick)"
        :x2="WIDTH - P.right" :y2="yScale(tick)"
        stroke="hsl(217,33%,25%)" stroke-width="0.5"
      />
      <text
        :x="P.left - 6" :y="yScale(tick) + 3.5"
        text-anchor="end" fill="hsl(215,20%,55%)" font-size="10"
      >{{ tick }}</text>
    </g>

    <!-- km/h label -->
    <text :x="P.left" :y="P.top - 8" fill="hsl(215,20%,55%)" font-size="10">km/h</text>

    <!-- Area fill -->
    <polygon v-if="data.length > 1" :points="areaPoints" fill="hsla(199,89%,48%,0.08)" />

    <!-- Line -->
    <polyline
      v-if="data.length > 1"
      fill="none" stroke="hsl(199,89%,48%)" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"
      :points="linePoints"
    />

    <!-- Dots -->
    <circle
      v-for="(d, i) in data" :key="'dot-' + i"
      :cx="xScale(i)" :cy="yScale(d.speed)"
      :r="tooltip?.idx === i ? 6 : 3.5"
      fill="hsl(199,89%,48%)"
      stroke="hsl(222,47%,11%)" stroke-width="2"
      style="transition: r 0.1s"
    />

    <!-- X-axis labels — rendered for every point that passes showLabel -->
    <template v-for="(d, i) in data" :key="'lbl-' + i">
      <text
        v-if="showLabel(i)"
        :x="xScale(i)"
        :y="HEIGHT - 6"
        :text-anchor="labelAnchor(i)"
        fill="hsl(215,20%,55%)"
        font-size="10"
      >{{ d.time }}</text>
    </template>

    <!-- Tooltip crosshair + card -->
    <g v-if="tooltip">
      <line
        :x1="tooltip.x" :y1="P.top"
        :x2="tooltip.x" :y2="P.top + CHART_H"
        stroke="hsl(199,89%,48%)" stroke-width="1"
        stroke-dasharray="4 3" opacity="0.6"
      />
      <!-- Card background -->
      <rect
        :x="tooltipX - 40" :y="tooltip.y - 46"
        width="80" height="38"
        rx="6"
        fill="hsl(222,47%,11%)"
        stroke="hsl(217,33%,28%)" stroke-width="1"
      />
      <text
        :x="tooltipX" :y="tooltip.y - 31"
        text-anchor="middle" fill="hsl(215,20%,65%)" font-size="10"
      >{{ tooltip.time }}</text>
      <text
        :x="tooltipX" :y="tooltip.y - 16"
        text-anchor="middle" fill="hsl(199,89%,60%)" font-size="13" font-weight="700"
      >{{ tooltip.speed }} km/h</text>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{ data: { time: string; speed: number }[] }>()

const P = { top: 28, right: 20, bottom: 32, left: 44 }
const WIDTH = 600
const HEIGHT = 210
const CHART_W = WIDTH - P.left - P.right
const CHART_H = HEIGHT - P.top - P.bottom

const svgRef = ref<SVGSVGElement | null>(null)
const tooltip = ref<{ x: number; y: number; time: string; speed: number; idx: number } | null>(null)

const yMax = computed(() => {
  if (!props.data.length) return 100
  const max = Math.max(...props.data.map(d => d.speed))
  return Math.ceil(Math.max(max, 20) / 20) * 20
})

function xScale(i: number): number {
  if (props.data.length <= 1) return P.left + CHART_W / 2
  return P.left + (i / (props.data.length - 1)) * CHART_W
}

function yScale(v: number): number {
  return P.top + CHART_H - (v / yMax.value) * CHART_H
}

const yTicks = computed(() =>
  [0, 0.25, 0.5, 0.75, 1].map(t => Math.round(yMax.value * t))
)

const linePoints = computed(() =>
  props.data.map((d, i) => `${xScale(i)},${yScale(d.speed)}`).join(' ')
)

const areaPoints = computed(() => {
  if (!props.data.length) return ''
  const n = props.data.length
  return `${xScale(0)},${P.top + CHART_H} ${linePoints.value} ${xScale(n - 1)},${P.top + CHART_H}`
})

// Max labels that fit without overlapping (each label ~44px wide at font-size 10)
const maxLabels = Math.max(2, Math.floor(CHART_W / 46))

function showLabel(i: number): boolean {
  const n = props.data.length
  if (n <= maxLabels) return true               // show all if they fit
  if (i === 0 || i === n - 1) return true       // always show first + last
  const step = Math.ceil(n / (maxLabels - 2))
  return i % step === 0
}

function labelAnchor(i: number): string {
  if (i === 0) return 'start'
  if (i === props.data.length - 1) return 'end'
  return 'middle'
}

// Clamp tooltip card X so it never overflows chart area
const tooltipX = computed(() => {
  if (!tooltip.value) return 0
  return Math.min(Math.max(tooltip.value.x, P.left + 40), WIDTH - P.right - 40)
})

function handleMouseMove(e: MouseEvent) {
  const svg = svgRef.value
  if (!svg || !props.data.length) return

  // Correct coordinate transform regardless of CSS scaling
  const pt = svg.createSVGPoint()
  pt.x = e.clientX
  pt.y = e.clientY
  const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse())

  let closestIdx = 0
  let closestDist = Infinity
  props.data.forEach((_, i) => {
    const dist = Math.abs(xScale(i) - svgP.x)
    if (dist < closestDist) { closestDist = dist; closestIdx = i }
  })

  if (closestDist < 32) {
    tooltip.value = {
      x: xScale(closestIdx),
      y: yScale(props.data[closestIdx].speed),
      time: props.data[closestIdx].time,
      speed: props.data[closestIdx].speed,
      idx: closestIdx,
    }
  } else {
    tooltip.value = null
  }
}
</script>
