import React from 'react';
import { Task } from '../../types';

interface BurndownChartProps {
  tasks: Task[];
}

export const BurndownChart: React.FC<BurndownChartProps> = ({ tasks }) => {
  // Collect distinct completion dates from actual task records
  const completedDates = Array.from(
    new Set(
      tasks
        .filter((t) => t.status === 'Done' && t.completed_at)
        .map((t) => t.completed_at!.split('T')[0])
    )
  ).sort();

  if (tasks.length === 0 || completedDates.length < 2) {
    return (
      <div className="py-10 px-4 text-center text-xs text-[#758078] bg-[#F6F7F3] rounded-lg border border-dashed border-[#DCE8DA]">
        Insufficient historical completion snapshots to plot a burndown curve yet. Complete tasks across multiple dates to generate actual burndown history.
      </div>
    );
  }

  const total = tasks.length;
  const points = completedDates.map((date) => {
    const doneByDate = tasks.filter(
      (t) => t.status === 'Done' && t.completed_at && t.completed_at.split('T')[0] <= date
    ).length;
    return {
      date,
      remaining: Math.max(0, total - doneByDate),
    };
  });

  const width = 360;
  const height = 140;
  const padX = 24;
  const padY = 18;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const svgPoints = points
    .map((p, idx) => {
      const x = padX + (idx / (points.length - 1)) * innerW;
      const y = padY + (p.remaining / total) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-36 overflow-visible">
        {/* Horizontal grid lines */}
        <line
          x1={padX}
          y1={padY}
          x2={width - padX}
          y2={padY}
          stroke="#E2E6DF"
          strokeDasharray="3 3"
        />
        <line
          x1={padX}
          y1={height - padY}
          x2={width - padX}
          y2={height - padY}
          stroke="#E2E6DF"
        />

        {/* Burndown polyline */}
        <polyline
          fill="none"
          stroke="#1C6245"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={svgPoints}
        />

        {/* Data points */}
        {points.map((p, idx) => {
          const x = padX + (idx / (points.length - 1)) * innerW;
          const y = padY + (p.remaining / total) * innerH;
          return (
            <circle
              key={p.date}
              cx={x}
              cy={y}
              r="3.5"
              fill="#E99132"
              stroke="#FFFFFF"
              strokeWidth="1.5"
            />
          );
        })}
      </svg>

      <div className="flex items-center justify-between text-[11px] text-[#758078] px-1">
        <span>{points[0].date} ({points[0].remaining} left)</span>
        <span>{points[points.length - 1].date} ({points[points.length - 1].remaining} left)</span>
      </div>
    </div>
  );
};
