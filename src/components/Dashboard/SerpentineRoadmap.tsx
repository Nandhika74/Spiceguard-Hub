import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Milestone, Task, ActiveTab } from '../../types';
import { formatDate, getDeadlineStatus } from '../../lib/dateUtils';
import {
  Check,
  AlertTriangle,
  Compass,
  FlaskConical,
  Warehouse,
  Layers,
  Cpu,
  FileCheck2,
  ArrowRight,
  Calendar,
  User,
  X,
} from 'lucide-react';

interface SerpentineRoadmapProps {
  milestones: Milestone[];
  tasks: Task[];
  onToggleTask: (taskId: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

const MILESTONE_ICONS = [
  Compass,
  FlaskConical,
  Warehouse,
  Layers,
  Cpu,
  FileCheck2,
];

// Balanced node coordinates in viewBox="0 0 1000 540" leaving generous room for left/right panels
const NODE_POSITIONS = [
  { x: 340, y: 85, align: 'left' as const },   // 01: Top-left
  { x: 660, y: 85, align: 'right' as const },  // 02: Top-right
  { x: 340, y: 270, align: 'left' as const },  // 03: Middle-left
  { x: 660, y: 270, align: 'right' as const }, // 04: Middle-right
  { x: 340, y: 455, align: 'left' as const },  // 05: Bottom-left
  { x: 660, y: 455, align: 'right' as const }, // 06: Bottom-right
];

// Continuous winding S-shaped Bezier curve connecting 01 -> 02 -> 03 -> 04 -> 05 -> 06
const SERPENTINE_PATH =
  'M 340 85 C 460 35, 540 135, 660 85 C 820 85, 820 270, 660 270 C 540 220, 460 320, 340 270 C 180 270, 180 455, 340 455 C 460 405, 540 505, 660 455';

export const SerpentineRoadmap: React.FC<SerpentineRoadmapProps> = ({
  milestones,
  tasks,
  onToggleTask,
  onNavigateTab,
}) => {
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);

  const sixMilestones = milestones.slice(0, 6);

  // Actual overall progress (0 when no tasks are completed)
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'Done').length;
  const overallProgress = totalTasks === 0 ? 0 : completedTasks / totalTasks;

  const getMilestoneMetrics = (m: Milestone) => {
    const mTasks = tasks.filter((t) => t.milestone_id === m.id);
    const mDone = mTasks.filter((t) => t.status === 'Done').length;
    const pct = mTasks.length === 0 ? 0 : Math.round((mDone / mTasks.length) * 100);
    const isCompleted = pct === 100 && mTasks.length > 0;
    const hasOverdue = mTasks.some(
      (t) => t.status !== 'Done' && getDeadlineStatus(t.deadline, false).isOverdue
    );
    const isInProgress = !isCompleted && (pct > 0 || m.status === 'In Progress');

    const state: 'completed' | 'inProgress' | 'delayed' | 'upcoming' = isCompleted
      ? 'completed'
      : hasOverdue
      ? 'delayed'
      : isInProgress
      ? 'inProgress'
      : 'upcoming';

    return { mTasks, mDone, pct, state };
  };

  const selectedMilestone = sixMilestones.find((m) => m.id === selectedMilestoneId);

  return (
    <div className="rounded-2xl bg-white border border-[#E3E7E1] p-5 sm:p-7 shadow-2xs space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#758078]">
            Programme Roadmap
          </span>
          <h3 className="text-lg font-bold text-[#103B2B] mt-0.5">
            Six-Month Milestone Journey
          </h3>
        </div>

        <button
          onClick={() => onNavigateTab('milestones')}
          className="text-xs font-semibold text-[#D97706] hover:underline flex items-center gap-1"
        >
          <span>Open Milestone Tracker</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* DESKTOP & TABLET: Continuous Winding S-Shaped Serpentine Roadmap */}
      <div className="hidden md:block relative w-full">
        <div className="relative w-full min-h-[500px]" style={{ aspectRatio: '1000 / 540' }}>
          {/* Winding SVG Path */}
          <svg
            viewBox="0 0 1000 540"
            className="w-full h-full overflow-visible"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="glow-dot" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Base Sage Track */}
            <motion.path
              d={SERPENTINE_PATH}
              fill="none"
              stroke="#DCE9DC"
              strokeWidth="6"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 1.1, ease: 'easeOut' }}
            />

            {/* Completed Progress Overlay (0 when overallProgress is 0) */}
            {overallProgress > 0 && (
              <motion.path
                d={SERPENTINE_PATH}
                fill="none"
                stroke="#103B2B"
                strokeWidth="6"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: overallProgress }}
                transition={{ duration: 1.2, ease: 'easeInOut' }}
              />
            )}

            {/* Subtle Moving Glowing Dot Travelling Along the Path */}
            <circle r="5" fill="#D97706" filter="url(#glow-dot)">
              <animateMotion
                dur="11s"
                repeatCount="indefinite"
                path={SERPENTINE_PATH}
              />
            </circle>
          </svg>

          {/* 6 Milestone Nodes & Alternating Info Panels */}
          {sixMilestones.map((m, idx) => {
            const pos = NODE_POSITIONS[idx];
            if (!pos) return null;
            const { mTasks, mDone, pct, state } = getMilestoneMetrics(m);
            const Icon = MILESTONE_ICONS[idx % MILESTONE_ICONS.length];
            const isSelected = selectedMilestoneId === m.id;
            const isLeft = pos.align === 'left';

            return (
              <React.Fragment key={m.id}>
                {/* Circular Milestone Node */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.35, delay: idx * 0.08 }}
                  style={{
                    left: `${(pos.x / 1000) * 100}%`,
                    top: `${(pos.y / 540) * 100}%`,
                  }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                >
                  <button
                    onClick={() =>
                      setSelectedMilestoneId(isSelected ? null : m.id)
                    }
                    className={`relative w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-md transition-all duration-200 cursor-pointer ${
                      state === 'completed'
                        ? 'bg-[#103B2B] text-white border-4 border-[#DCE9DC]'
                        : state === 'inProgress'
                        ? 'bg-[#D97706] text-white border-4 border-amber-100 shadow-[0_0_16px_rgba(217,119,6,0.35)]'
                        : state === 'delayed'
                        ? 'bg-[#D9534F] text-white border-4 border-red-100'
                        : 'bg-[#F5F7F4] text-[#103B2B] border-4 border-[#DCE9DC] hover:border-[#103B2B]'
                    } ${isSelected ? 'ring-4 ring-[#D97706]/40 scale-110' : 'hover:scale-105'}`}
                    title={`Month 0${idx + 1}: ${m.title}`}
                  >
                    {state === 'inProgress' && (
                      <span className="absolute inset-0 rounded-full bg-[#D97706] animate-ping opacity-20" />
                    )}
                    <span className="text-[10px] font-extrabold leading-none">
                      0{idx + 1}
                    </span>
                    <div className="mt-0.5">
                      {state === 'completed' ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : state === 'delayed' ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                    </div>
                  </button>
                </motion.div>

                {/* Alternating Compact Information Panel (Bounded within container, zero clipping) */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: idx * 0.08 + 0.05 }}
                  onClick={() =>
                    setSelectedMilestoneId(isSelected ? null : m.id)
                  }
                  style={{
                    top: `${(pos.y / 540) * 100}%`,
                    ...(isLeft
                      ? { left: '8px', right: 'calc(66% + 42px)' }
                      : { left: 'calc(66% + 42px)', right: '8px' }),
                  }}
                  className={`absolute -translate-y-1/2 p-3.5 rounded-xl bg-[#F5F7F4]/95 hover:bg-white border transition cursor-pointer shadow-2xs z-10 ${
                    isSelected
                      ? 'border-[#103B2B] bg-white shadow-sm'
                      : 'border-[#E3E7E1] hover:border-[#103B2B]/40'
                  } ${isLeft ? 'text-right' : 'text-left'}`}
                >
                  <div
                    className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider flex-wrap ${
                      isLeft ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span className="text-[#758078]">Month 0{idx + 1}</span>
                    <span className="text-stone-300">·</span>
                    <span
                      className={
                        state === 'completed'
                          ? 'text-[#103B2B]'
                          : state === 'inProgress'
                          ? 'text-[#D97706]'
                          : state === 'delayed'
                          ? 'text-[#D9534F]'
                          : 'text-[#758078]'
                      }
                    >
                      {state === 'completed'
                        ? 'Completed'
                        : state === 'inProgress'
                        ? 'In Progress'
                        : state === 'delayed'
                        ? 'Delayed'
                        : 'Upcoming'}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-[#103B2B] mt-1 leading-snug">
                    {m.title.replace(/^Month \d+\s*[–-]\s*/i, '')}
                  </h4>

                  <div
                    className={`flex items-center gap-2 mt-1.5 text-[11px] text-[#758078] flex-wrap ${
                      isLeft ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <span>
                      {mDone}/{mTasks.length} tasks
                    </span>
                    <span className="font-bold text-[#103B2B]">{pct}%</span>
                    {m.planned_date && (
                      <span>
                        · {formatDate(m.planned_date).replace(/, \d{4}/, '')}
                      </span>
                    )}
                  </div>
                </motion.div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* MOBILE: Vertical Connected Journey */}
      <div className="md:hidden relative pl-7 space-y-5 before:absolute before:left-[19px] before:top-4 before:bottom-4 before:w-1 before:bg-[#DCE9DC] before:rounded-full">
        {sixMilestones.map((m, idx) => {
          const { mTasks, mDone, pct, state } = getMilestoneMetrics(m);
          const Icon = MILESTONE_ICONS[idx % MILESTONE_ICONS.length];
          const isSelected = selectedMilestoneId === m.id;

          return (
            <div key={m.id} className="relative flex items-start gap-4">
              <button
                onClick={() => setSelectedMilestoneId(isSelected ? null : m.id)}
                className={`relative z-10 w-10 h-10 rounded-full flex flex-col items-center justify-center shrink-0 shadow-xs transition ${
                  state === 'completed'
                    ? 'bg-[#103B2B] text-white'
                    : state === 'inProgress'
                    ? 'bg-[#D97706] text-white'
                    : state === 'delayed'
                    ? 'bg-[#D9534F] text-white'
                    : 'bg-[#F5F7F4] text-[#103B2B] border-2 border-[#DCE9DC]'
                }`}
              >
                <span className="text-[9px] font-extrabold leading-none">
                  0{idx + 1}
                </span>
                <Icon className="w-3 h-3 mt-0.5" />
              </button>

              <div
                onClick={() => setSelectedMilestoneId(isSelected ? null : m.id)}
                className={`flex-1 p-3.5 rounded-xl bg-[#F5F7F4] border transition cursor-pointer ${
                  isSelected ? 'border-[#103B2B] bg-white' : 'border-[#E3E7E1]'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider">
                  <span className="text-[#758078]">Month 0{idx + 1}</span>
                  <span className="text-[#103B2B]">{pct}%</span>
                </div>
                <h4 className="text-xs font-bold text-[#103B2B] mt-0.5">
                  {m.title.replace(/^Month \d+\s*[–-]\s*/i, '')}
                </h4>
                <p className="text-[11px] text-[#758078] mt-1">
                  {mDone}/{mTasks.length} tasks ·{' '}
                  {formatDate(m.planned_date).replace(/, \d{4}/, '')}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Expandable Milestone Detail Panel */}
      <AnimatePresence>
        {selectedMilestone && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="p-5 rounded-xl bg-[#F5F7F4] border border-[#DCE9DC] space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#D97706]">
                    {selectedMilestone.phase_label || 'Milestone Details'}
                  </span>
                  <h4 className="text-base font-bold text-[#103B2B] mt-0.5">
                    {selectedMilestone.title}
                  </h4>
                  {selectedMilestone.description && (
                    <p className="text-xs text-[#758078] mt-1">
                      {selectedMilestone.description}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setSelectedMilestoneId(null)}
                  className="p-1.5 rounded-lg text-[#758078] hover:text-[#103B2B] hover:bg-white transition"
                  title="Close details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Associated Tasks */}
              <div className="divide-y divide-stone-200/70 bg-white rounded-xl border border-[#E3E7E1] px-4">
                {tasks
                  .filter((t) => t.milestone_id === selectedMilestone.id)
                  .map((t) => {
                    const isDone = t.status === 'Done';
                    return (
                      <div
                        key={t.id}
                        className="py-3 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <button
                            onClick={() => onToggleTask(t.id)}
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                              isDone
                                ? 'bg-[#103B2B] border-[#103B2B] text-white'
                                : 'border-stone-300 hover:border-[#103B2B] bg-white'
                            }`}
                          >
                            {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                          <div className="min-w-0">
                            <p
                              className={`font-semibold truncate ${
                                isDone
                                  ? 'line-through text-stone-400'
                                  : 'text-[#172D25]'
                              }`}
                            >
                              {t.title}
                            </p>
                            <div className="flex items-center gap-3 text-[11px] text-[#758078] mt-0.5">
                              <span className="inline-flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {t.assignee_name || 'Team'}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(t.deadline)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                            isDone
                              ? 'bg-[#103B2B]/10 text-[#103B2B]'
                              : t.status === 'In Progress'
                              ? 'bg-[#D97706]/15 text-[#D97706]'
                              : 'bg-stone-100 text-[#758078]'
                          }`}
                        >
                          {isDone ? 'Completed' : t.status === 'Todo' ? 'To Do' : t.status}
                        </span>
                      </div>
                    );
                  })}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => onNavigateTab('milestones')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#103B2B] hover:bg-[#09251B] text-white text-xs font-semibold transition"
                >
                  <span>Manage in Milestone Tracker</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
