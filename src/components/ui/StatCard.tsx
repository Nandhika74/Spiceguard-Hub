import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon?: LucideIcon;
  tone?: 'default' | 'primary' | 'amber' | 'danger' | 'dark';
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  subtext,
  icon: Icon,
  tone = 'default',
  onClick,
}) => {
  const isDark = tone === 'dark';

  const iconBg =
    tone === 'primary'
      ? 'bg-[#DCE8DA] text-[#103C2B]'
      : tone === 'amber'
      ? 'bg-[#E99132]/15 text-[#E99132]'
      : tone === 'danger'
      ? 'bg-[#D9534F]/15 text-[#D9534F]'
      : isDark
      ? 'bg-[#1C6245] text-[#E99132]'
      : 'bg-[#F6F7F3] text-[#103C2B]';

  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-4 border transition ${
        isDark
          ? 'bg-[#103C2B] border-[#1C6245] text-white'
          : 'bg-white border-[#E2E6DF] text-[#172D25] shadow-2xs'
      } ${onClick ? 'cursor-pointer hover:border-[#1C6245]/50' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-[11px] font-semibold uppercase tracking-wider truncate ${
            isDark ? 'text-[#DCE8DA]' : 'text-[#758078]'
          }`}
        >
          {label}
        </span>
        {Icon && (
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>

      <p
        className={`text-2xl font-bold mt-2 leading-none ${
          tone === 'danger' ? 'text-[#D9534F]' : isDark ? 'text-white' : 'text-[#172D25]'
        }`}
      >
        {value}
      </p>

      {subtext && (
        <p
          className={`text-[11px] mt-1.5 truncate ${
            isDark ? 'text-[#DCE8DA]/80' : 'text-[#758078]'
          }`}
        >
          {subtext}
        </p>
      )}
    </div>
  );
};
