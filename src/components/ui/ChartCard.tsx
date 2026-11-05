import React from 'react';

interface ChartCardProps {
  title: string;
  subtitle?: string;
  rightSlot?: React.ReactNode;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  rightSlot,
  isEmpty = false,
  emptyMessage = 'No data available for the current selection.',
  children,
}) => {
  return (
    <div className="rounded-xl bg-white border border-[#E2E6DF] p-5 shadow-2xs flex flex-col justify-between">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#172D25] truncate">{title}</h3>
          {subtitle && (
            <p className="text-xs text-[#758078] mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        {rightSlot && <div className="shrink-0">{rightSlot}</div>}
      </div>

      {isEmpty ? (
        <div className="py-10 text-center text-xs text-[#758078] bg-[#F6F7F3] rounded-lg border border-dashed border-[#DCE8DA]">
          {emptyMessage}
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center">{children}</div>
      )}
    </div>
  );
};
