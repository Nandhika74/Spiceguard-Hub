import React from 'react';

export interface BarItem {
  label: string;
  value: number;
  maxValue?: number;
  suffix?: string;
  color?: string;
  badge?: string;
}

interface HorizontalBarChartProps {
  items: BarItem[];
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({ items }) => {
  const globalMax = Math.max(1, ...items.map((i) => i.maxValue ?? i.value));

  return (
    <div className="space-y-3.5">
      {items.map((item, idx) => {
        const denom = item.maxValue ?? globalMax;
        const pct = denom === 0 ? 0 : Math.min(100, Math.round((item.value / denom) * 100));

        return (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-semibold text-[#172D25] truncate">{item.label}</span>
                {item.badge && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E99132]/15 text-[#E99132] shrink-0">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="font-bold text-[#103C2B] shrink-0">
                {item.value}
                {item.suffix || ''}
              </span>
            </div>

            <div className="w-full h-2 bg-[#F6F7F3] rounded-full overflow-hidden border border-[#E2E6DF]/60">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  backgroundColor: item.color || '#1C6245',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
