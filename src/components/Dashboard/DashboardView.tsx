import React from 'react';
import { motion } from 'motion/react';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { getDeadlineStatus, getDaysLeftUntil, formatDate, timeAgo } from '../../lib/dateUtils';
import { ActiveTab, Task } from '../../types';
import { SerpentineRoadmap } from './SerpentineRoadmap';
import { TaskCompletionModal } from '../Milestones/TaskCompletionModal';
import {
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flag,
  ArrowRight,
  Check,
  Building2,
  Layers,
  ListTodo,
  Activity,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigateTab: (tab: ActiveTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateTab }) => {
  const {
    milestones,
    tasks,
    currentUser,
    activityLog,
    toggleTaskStatus,
  } = useRealtimeStore();

  const [taskForCompletionModal, setTaskForCompletionModal] = React.useState<Task | null>(null);

  const handleToggleTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.status === 'Done') {
      toggleTaskStatus(taskId, task.status);
    } else {
      setTaskForCompletionModal(task);
    }
  };

  const activeMilestones = milestones.filter((m) => !m.archived);

  // Dynamically calculated task metrics
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'Done').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'In Progress').length;
  const pendingTasks = tasks.filter((t) => t.status === 'Todo').length;
  const overallCompletion =
    totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const daysRemaining = getDaysLeftUntil('2027-03-15');

  const overdueTasks = tasks.filter((t) => {
    if (t.status === 'Done') return false;
    return getDeadlineStatus(t.deadline, false).isOverdue;
  });

  const attentionTasks = tasks.filter((t) => {
    if (t.status === 'Done') return false;
    const isOverdue = getDeadlineStatus(t.deadline, false).isOverdue;
    return isOverdue || t.status === 'Blocked' || t.priority === 'High';
  });

  const upcomingDeadlines = tasks
    .filter((t) => {
      if (t.status === 'Done') return false;
      const { isOverdue, daysRemaining: d } = getDeadlineStatus(t.deadline, false);
      return !isOverdue && d <= 14;
    })
    .slice(0, 5);

  const myAssignedTasks = tasks.filter(
    (t) =>
      t.assignee_id?.toLowerCase() === currentUser.email.toLowerCase() ||
      t.assignee_name?.toLowerCase() === currentUser.full_name.toLowerCase()
  );

  const recentlyUpdatedMilestones = [...activeMilestones]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-6 pb-20 md:pb-12 max-w-6xl mx-auto pt-4">
      {/* 1. Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex items-center justify-between gap-4 flex-wrap"
      >
        <div>
          <h2 className="text-2xl sm:text-[28px] font-bold text-[#103B2B] tracking-tight leading-tight">
            Good to see you, {currentUser.full_name.split(' ')[0]}
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Here&apos;s where the PoC stands today.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-[#E3E7E1] text-[#103B2B] text-xs font-semibold shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Synced</span>
        </div>
      </motion.div>

      {/* 2. Project Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.04 }}
        className="rounded-2xl bg-white border border-[#E3E7E1] p-6 shadow-2xs"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-5 border-b border-stone-100">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#D97706]">
              <Building2 className="w-3.5 h-3.5" />
              <span>Six-Month Proof of Concept · Plant Lipids Private Limited</span>
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-[#103B2B] tracking-tight">
              Spice Warehouse Intelligence & Digitisation
            </h3>
          </div>

          {/* Overall Progress Bar */}
          <div className="w-full lg:w-72 shrink-0 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-stone-600">Overall PoC completion</span>
              <span className="font-bold text-[#103B2B]">{overallCompletion}%</span>
            </div>
            <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#103B2B] rounded-full transition-all duration-500"
                style={{ width: `${overallCompletion}%` }}
              />
            </div>
          </div>
        </div>

        {/* Programme Metadata Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-5 text-xs">
          <div>
            <span className="text-stone-400 font-medium block">Duration</span>
            <span className="font-semibold text-stone-800 mt-0.5 block">Six months</span>
          </div>
          <div>
            <span className="text-stone-400 font-medium block">Total milestones</span>
            <span className="font-semibold text-stone-800 mt-0.5 block">
              {activeMilestones.length} milestones
            </span>
          </div>
          <div>
            <span className="text-stone-400 font-medium block">Total tasks</span>
            <span className="font-semibold text-stone-800 mt-0.5 block">
              {totalTasks} tasks
            </span>
          </div>
          <div>
            <span className="text-stone-400 font-medium block">Final report deadline</span>
            <span className="font-semibold text-[#D97706] mt-0.5 block">
              15 March 2027 ({daysRemaining} days left)
            </span>
          </div>
        </div>
      </motion.div>

      {/* 3. Top Section: Circular Project Completion + Segmented Task Distribution */}
      {(() => {
        const ringRadius = 64;
        const ringCircumference = 2 * Math.PI * ringRadius;
        const ringOffset =
          ringCircumference - (overallCompletion / 100) * ringCircumference;

        // Mutually exclusive task counts summing to totalTasks
        const overdueCount = overdueTasks.length;
        const inProgCount = tasks.filter(
          (t) =>
            t.status === 'In Progress' &&
            !getDeadlineStatus(t.deadline, false).isOverdue
        ).length;
        const pendingCount = Math.max(
          0,
          totalTasks - completedTasks - inProgCount - overdueCount
        );

        const segments = [
          {
            key: 'completed',
            label: 'Completed',
            count: completedTasks,
            color: '#1C6245',
            detail: 'Tasks marked Done',
          },
          {
            key: 'inProgress',
            label: 'In Progress',
            count: inProgCount,
            color: '#E99132',
            detail: 'Currently active',
          },
          {
            key: 'pending',
            label: 'Pending',
            count: pendingCount,
            color: '#DCE8DA',
            detail: 'Scheduled to start',
          },
          {
            key: 'overdue',
            label: 'Overdue',
            count: overdueCount,
            color: '#D9534F',
            detail: 'Past due date',
          },
        ];

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: Overall Project Completion Circular Ring */}
              <div className="lg:col-span-5 rounded-2xl bg-white border border-[#E3E7E1] p-6 shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#758078]">
                      Project Progress
                    </span>
                    <h3 className="text-base font-bold text-[#103C2B] mt-0.5">
                      Overall Completion
                    </h3>
                  </div>
                  <span className="text-xs font-semibold text-[#103C2B] bg-[#DCE8DA]/60 px-2.5 py-1 rounded-full">
                    {daysRemaining}d left
                  </span>
                </div>

                {/* Animated SVG Circular Progress Ring */}
                <div className="my-6 flex items-center justify-center">
                  <div className="relative w-40 h-40 flex items-center justify-center">
                    <svg className="w-40 h-40 transform -rotate-90" viewBox="0 0 152 152">
                      {/* Outer subtle decorative ring */}
                      <circle
                        cx="76"
                        cy="76"
                        r={ringRadius + 7}
                        fill="transparent"
                        stroke="#DCE8DA"
                        strokeWidth="1"
                        strokeDasharray="3 4"
                      />
                      {/* Base Track */}
                      <circle
                        cx="76"
                        cy="76"
                        r={ringRadius}
                        fill="transparent"
                        stroke="#F6F7F3"
                        strokeWidth="11"
                      />
                      {/* Animated Progress Arc */}
                      <circle
                        cx="76"
                        cy="76"
                        r={ringRadius}
                        fill="transparent"
                        stroke="#103C2B"
                        strokeWidth="11"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringOffset}
                        strokeLinecap="round"
                        className="transition-all duration-700 ease-out"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <span className="text-3xl font-bold text-[#103C2B] tracking-tight block leading-none">
                        {overallCompletion}%
                      </span>
                      <span className="text-xs font-semibold text-[#758078] block mt-1.5">
                        {completedTasks} / {totalTasks} tasks
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-[#758078]">Final deadline</span>
                  <span className="font-semibold text-[#172D25]">15 March 2027</span>
                </div>
              </div>

              {/* Right: Task Distribution Horizontal Segmented Bar */}
              <div className="lg:col-span-7 rounded-2xl bg-white border border-[#E3E7E1] p-6 shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#758078]">
                        Workload & Status
                      </span>
                      <h3 className="text-base font-bold text-[#103C2B] mt-0.5">
                        Task Distribution
                      </h3>
                    </div>
                    <span className="text-xs font-semibold text-[#758078]">
                      {totalTasks} total tasks
                    </span>
                  </div>

                  {/* Large Horizontal Segmented Progress Bar */}
                  <div className="mt-7">
                    <div className="w-full h-5 rounded-full bg-[#F6F7F3] overflow-hidden flex p-0.5 border border-[#E3E7E1]">
                      {totalTasks > 0 &&
                        segments.map((seg) => {
                          if (seg.count === 0) return null;
                          const widthPct = (seg.count / totalTasks) * 100;
                          return (
                            <div
                              key={seg.key}
                              style={{
                                width: `${widthPct}%`,
                                backgroundColor: seg.color,
                              }}
                              title={`${seg.label}: ${seg.count} tasks (${Math.round(
                                widthPct
                              )}%) — ${seg.detail}`}
                              className="h-full first:rounded-l-full last:rounded-r-full transition-all duration-500 hover:opacity-85 cursor-pointer"
                            />
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* Clean Legend with Exact Counts, Percentages & Hover Details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-4 border-t border-stone-100">
                  {segments.map((seg) => {
                    const pct =
                      totalTasks === 0 ? 0 : Math.round((seg.count / totalTasks) * 100);
                    return (
                      <div
                        key={seg.key}
                        onClick={() => onNavigateTab('milestones')}
                        className="p-3 rounded-xl bg-[#F6F7F3]/70 hover:bg-[#F6F7F3] border border-transparent hover:border-[#E3E7E1] transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: seg.color }}
                          />
                          <span className="text-xs font-semibold text-[#172D25] truncate">
                            {seg.label}
                          </span>
                        </div>
                        <div className="mt-2 flex items-baseline justify-between">
                          <span className="text-xl font-bold text-[#103C2B]">
                            {seg.count}
                          </span>
                          <span className="text-xs font-semibold text-[#758078]">
                            {pct}%
                          </span>
                        </div>
                        <p className="text-[10px] text-[#758078] mt-1 truncate group-hover:text-[#172D25] transition">
                          {seg.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Section: Full-Width Animated Serpentine Roadmap */}
            <SerpentineRoadmap
              milestones={activeMilestones}
              tasks={tasks}
              onToggleTask={handleToggleTask}
              onNavigateTab={onNavigateTab}
            />
          </div>
        );
      })()}

      {/* 4. My Assigned Tasks & Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* My Assigned Tasks */}
        <div className="rounded-2xl bg-white border border-[#E3E7E1] p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#103B2B] uppercase tracking-wider">
              My Assigned Tasks
            </h3>
            <button
              onClick={() => onNavigateTab('milestones')}
              className="text-xs font-semibold text-[#D97706] hover:underline flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-stone-100">
            {myAssignedTasks.length === 0 ? (
              <p className="text-xs text-stone-400 py-4">No tasks assigned to you.</p>
            ) : (
              myAssignedTasks.slice(0, 5).map((t) => {
                const isDone = t.status === 'Done';
                const parentM = milestones.find((m) => m.id === t.milestone_id);
                return (
                  <div key={t.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => handleToggleTask(t.id)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                          isDone
                            ? 'bg-[#103B2B] border-[#103B2B] text-white'
                            : 'border-stone-300 hover:border-[#103B2B] bg-white'
                        }`}
                        title={isDone ? 'Mark as To Do' : 'Mark as Completed & Record Visit'}
                      >
                        {isDone && <Check className="w-3 h-3 stroke-[3]" />}
                      </button>
                      <div className="min-w-0">
                        <p
                          onClick={() => onNavigateTab('milestones')}
                          className={`text-xs font-semibold cursor-pointer truncate ${
                            isDone ? 'line-through text-stone-400' : 'text-stone-900 hover:text-[#103B2B]'
                          }`}
                        >
                          {t.title}
                        </p>
                        <p className="text-[11px] text-stone-400 truncate">
                          {parentM?.phase_label || 'PoC'} · {isDone && t.completion_date ? `Visited ${formatDate(t.completion_date).replace(/, \d{4}/, '')}` : `Due ${formatDate(t.deadline)}`}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isDone
                          ? 'bg-emerald-50 text-emerald-700'
                          : t.status === 'In Progress'
                          ? 'bg-amber-50 text-[#D97706]'
                          : 'bg-stone-100 text-stone-600'
                      }`}
                    >
                      {isDone ? 'Completed' : t.status === 'Todo' ? 'To Do' : t.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Upcoming Deadlines */}
        <div className="rounded-2xl bg-white border border-[#E3E7E1] p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#103B2B] uppercase tracking-wider">
              Upcoming Deadlines (Next 14 Days)
            </h3>
            <button
              onClick={() => onNavigateTab('milestones')}
              className="text-xs font-semibold text-[#D97706] hover:underline flex items-center gap-1"
            >
              <span>All deadlines</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-stone-100">
            {upcomingDeadlines.length === 0 ? (
              <p className="text-xs text-stone-400 py-4">
                No upcoming deadlines in the next 14 days.
              </p>
            ) : (
              upcomingDeadlines.map((t) => {
                const { daysRemaining: d } = getDeadlineStatus(t.deadline, false);
                return (
                  <div
                    key={t.id}
                    onClick={() => onNavigateTab('milestones')}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-stone-50/60 transition cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-stone-900 truncate">{t.title}</p>
                      <p className="text-[11px] text-stone-400 truncate">
                        Assigned to {t.assignee_name}
                      </p>
                    </div>
                    <span className="text-[11px] font-semibold text-[#D97706] bg-amber-50 px-2.5 py-0.5 rounded-full shrink-0">
                      {d === 0 ? 'Due today' : `${d}d left`}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 5. Tasks Requiring Attention & Recently Updated Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tasks Requiring Attention */}
        <div className="rounded-2xl bg-white border border-[#E3E7E1] p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#103B2B] uppercase tracking-wider">
              Tasks Requiring Attention
            </h3>
            <span className="text-xs text-stone-400 font-medium">
              {attentionTasks.length} items
            </span>
          </div>

          <div className="divide-y divide-stone-100">
            {attentionTasks.length === 0 ? (
              <p className="text-xs text-stone-400 py-4">
                All tasks are on track. No blockers or overdue items.
              </p>
            ) : (
              attentionTasks.slice(0, 4).map((t) => {
                const { isOverdue } = getDeadlineStatus(t.deadline, false);
                return (
                  <div
                    key={t.id}
                    onClick={() => onNavigateTab('milestones')}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-stone-50/60 transition cursor-pointer"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-stone-900 truncate">{t.title}</p>
                      <p className="text-[11px] text-stone-400 truncate">
                        {t.assignee_name} · Due {formatDate(t.deadline)}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                        isOverdue
                          ? 'bg-red-50 text-red-600'
                          : t.status === 'Blocked'
                          ? 'bg-rose-50 text-rose-600'
                          : 'bg-amber-50 text-[#D97706]'
                      }`}
                    >
                      {isOverdue ? 'Overdue' : t.status === 'Blocked' ? 'Blocked' : 'High Priority'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recently Updated Milestones */}
        <div className="rounded-2xl bg-white border border-[#E3E7E1] p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#103B2B] uppercase tracking-wider">
              Recently Updated Milestones
            </h3>
            <button
              onClick={() => onNavigateTab('milestones')}
              className="text-xs font-semibold text-[#D97706] hover:underline flex items-center gap-1"
            >
              <span>All milestones</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {recentlyUpdatedMilestones.map((m) => {
              const mTasks = tasks.filter((t) => t.milestone_id === m.id);
              const doneCount = mTasks.filter((t) => t.status === 'Done').length;
              const pct = mTasks.length === 0 ? 0 : Math.round((doneCount / mTasks.length) * 100);

              return (
                <div
                  key={m.id}
                  onClick={() => onNavigateTab('milestones')}
                  className="p-3 rounded-xl bg-[#F5F7F4] border border-[#E3E7E1] hover:border-[#103B2B]/40 transition cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Flag className="w-3.5 h-3.5 text-[#103B2B] shrink-0" />
                      <span className="text-xs font-semibold text-stone-900 truncate">
                        {m.title}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-[#103B2B] shrink-0">{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#103B2B] rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 6. Recent Team Activity */}
      <div className="rounded-2xl bg-white border border-[#E3E7E1] p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#103B2B]" />
            <h3 className="text-sm font-bold text-[#103B2B] uppercase tracking-wider">
              Recent Team Activity
            </h3>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Live sync</span>
          </span>
        </div>

        <div className="divide-y divide-stone-100">
          {activityLog.length === 0 ? (
            <p className="text-xs text-stone-400 py-4">No recent activity recorded yet.</p>
          ) : (
            activityLog.slice(0, 6).map((item, idx) => (
              <div key={item.id || idx} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-[#103B2B] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                    {item.details
                      ? item.details
                          .split(' ')
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                      : 'SG'}
                  </div>
                  <p className="text-xs text-stone-800 font-medium truncate">{item.details}</p>
                </div>
                <span className="text-[11px] text-stone-400 shrink-0">
                  {timeAgo(item.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <TaskCompletionModal
        task={taskForCompletionModal}
        isOpen={Boolean(taskForCompletionModal)}
        onClose={() => setTaskForCompletionModal(null)}
      />
    </div>
  );
};
