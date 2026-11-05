import React from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  centerLabel?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  segments,
  centerLabel = 'Tasks',
}) => {
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
        <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 110 110">
          <circle
            cx="55"
            cy="55"
            r={radius}
            fill="transparent"
            stroke="#F6F7F3"
            strokeWidth="12"
          />
          {total > 0 &&
            segments.map((seg, idx) => {
              if (seg.value <= 0) return null;
              const pct = seg.value / total;
              const dashArray = `${pct * circumference} ${circumference}`;
              const dashOffset = -cumulativePercent * circumference;
              cumulativePercent += pct;

              return (
                <circle
                  key={idx}
                  cx="55"
                  cy="55"
                  r={radius}
                  fill="transparent"
                  stroke={seg.color}
                  strokeWidth="12"
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                  className="transition-all duration-500"
                />
              );
            })}
        </svg>
        <div className="absolute text-center">
          <span className="text-xl font-bold text-[#172D25] block leading-none">
            {total}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#758078] block mt-1">
            {centerLabel}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full space-y-2">
        {segments.map((seg, idx) => {
          const pct = total === 0 ? 0 : Math.round((seg.value / total) * 100);
          return (
            <div key={idx} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="text-[#172D25] font-medium truncate">{seg.label}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-bold text-[#172D25]">{seg.value}</span>
                <span className="text-[#758078] w-9 text-right">({pct}%)</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
