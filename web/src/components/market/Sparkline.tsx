"use client";

import React from "react";

interface SparklineProps {
  path: string;
  width?: number;
  height?: number;
  direction: "up" | "down" | "stable";
  className?: string;
}

const DIRECTION_COLORS: Record<SparklineProps["direction"], string> = {
  up: "#f87171",      // red-400 — prices going up = bad for buyer
  down: "#34d399",    // emerald-400 — prices going down = good
  stable: "#cbd5e1",  // slate-300
};

/**
 * Extract the last point from an SVG path string.
 * Handles M/L commands with absolute coordinates.
 */
function getLastPoint(pathData: string): { x: number; y: number } | null {
  const commands = pathData.match(/[ML]\s*[\d.]+[\s,][\d.]+/gi);
  if (!commands || commands.length === 0) return null;
  const last = commands[commands.length - 1];
  const nums = last.match(/[\d.]+/g);
  if (!nums || nums.length < 2) return null;
  return { x: parseFloat(nums[0]), y: parseFloat(nums[1]) };
}

export function Sparkline({
  path,
  width = 60,
  height = 20,
  direction,
  className,
}: SparklineProps) {
  const color = DIRECTION_COLORS[direction];
  const lastPt = getLastPoint(path);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d={path}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {lastPt && (
        <circle
          cx={lastPt.x}
          cy={lastPt.y}
          r={2}
          fill={color}
        />
      )}
    </svg>
  );
}
