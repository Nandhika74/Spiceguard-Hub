import React, { useState, useEffect } from 'react';
import { Milestone, Task, TaskStatus } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { formatDate, getDeadlineStatus } from '../../lib/dateUtils';
import { SEED_MEMBERS } from '../../lib/constants';
import { TaskItem } from './TaskItem';
import { MilestoneFormModal } from './MilestoneFormModal';
import { TaskFormModal } from './TaskFormModal';
import { MilestoneDateHistoryModal } from './MilestoneDateHistoryModal';
import { TaskCommentsModal } from './TaskCommentsModal';
import { TaskCompletionModal } from './TaskCompletionModal';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { StatCard } from '../ui/StatCard';
import { ChartCard } from '../ui/ChartCard';
import { DonutChart } from '../ui/DonutChart';
import { HorizontalBarChart } from '../ui/HorizontalBarChart';
import { BurndownChart } from '../ui/BurndownChart';
import {
  Plus,
  X,
  GripVertical,
  MoreHorizontal,
  Calendar,
  AlertCircle,
  Clock,
  Trash2,
  Edit2,
  Copy,
  Archive,
  Search,
  List as ListIcon,
  LayoutGrid,
  CalendarDays,
  Archive as ArchiveIcon,
  Check,
  Flag,
  CheckCircle2,
  ListTodo,
  FileText,
} from 'lucide-react';

export const MilestonesView: React.FC = () => {
  const {
    milestones,
    tasks,
    isTeamLead,
    updateTask,
    deleteTask,
    toggleTaskStatus,
    duplicateMilestone,
    archiveMilestone,
    deleteMilestone,
  } = useRealtimeStore();

  const [currentView, setCurrentView] = useState<'list' | 'board' | 'timeline'>('list');
  const [showArchived, setShowArchived] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [milestoneToEdit, setMilestoneToEdit] = useState<Milestone | null>(null);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [targetMilestoneForTask, setTargetMilestoneForTask] = useState<string | undefined>(undefined);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  const [taskForCompletionModal, setTaskForCompletionModal] = useState<Task | null>(null);

  const [dateHistoryMilestone, setDateHistoryMilestone] = useState<Milestone | null>(null);
  const [commentsModalTask, setCommentsModalTask] = useState<Task | null>(null);

  const [activeMenuMilestoneId, setActiveMenuMilestoneId] = useState<string | null>(null);
  const [activeMenuTaskId, setActiveMenuTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [milestoneToDelete, setMilestoneToDelete] = useState<Milestone | null>(null);

  // Auto-dismiss 3-dots menus when touching or clicking anywhere else on screen (critical for mobile UI)
  useEffect(() => {
    if (!activeMenuMilestoneId && !activeMenuTaskId) return;
    const handleOutsideInteraction = () => {
      setActiveMenuMilestoneId(null);
      setActiveMenuTaskId(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveMenuMilestoneId(null);
        setActiveMenuTaskId(null);
      }
    };
    window.addEventListener('click', handleOutsideInteraction);
    window.addEventListener('touchstart', handleOutsideInteraction);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutsideInteraction);
      window.removeEventListener('touchstart', handleOutsideInteraction);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeMenuMilestoneId, activeMenuTaskId]);

  const activeMilestones = milestones.filter((m) => (showArchived ? m.archived : !m.archived));

  // Filter tasks based on search & filters
  const filteredTasks = tasks.filter((task) => {
    const parentMilestone = milestones.find((m) => m.id === task.milestone_id);
    if (!showArchived && parentMilestone?.archived) return false;

    if (assigneeFilter !== 'all') {
      const needle = assigneeFilter.toLowerCase();
      const matchEmail = (task.assignee_id || '').toLowerCase().includes(needle);
      const matchName = (task.assignee_name || '').toLowerCase().includes(needle);
      if (!matchEmail && !matchName) return false;
    }

    if (statusFilter !== 'all' && task.status !== statusFilter) return false;

    if (monthFilter !== 'all') {
      const phase = (parentMilestone?.phase_label || '').toLowerCase();
      const title = (parentMilestone?.title || '').toLowerCase();
      const mFilter = monthFilter.toLowerCase();
      if (!phase.includes(mFilter) && !title.includes(mFilter)) return false;
    }

    if (onlyOverdue) {
      const isDone = task.status === 'Done';
      const { isOverdue } = getDeadlineStatus(task.deadline, isDone);
      if (!isOverdue) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchAssignee = (task.assignee_name || '').toLowerCase().includes(q);
      const matchNotes = (task.notes || '').toLowerCase().includes(q);
      const matchMilestone = (parentMilestone?.title || '').toLowerCase().includes(q);
      if (!matchTitle && !matchAssignee && !matchNotes && !matchMilestone) return false;
    }

    return true;
  });

  const isFiltering =
    assigneeFilter !== 'all' ||
    statusFilter !== 'all' ||
    monthFilter !== 'all' ||
    onlyOverdue ||
    searchQuery.trim().length > 0;

  // Filter milestones based on month filter and matching tasks
  const filteredMilestones = activeMilestones.filter((milestone) => {
    if (monthFilter !== 'all') {
      const phase = (milestone.phase_label || '').toLowerCase();
      const title = (milestone.title || '').toLowerCase();
      const mFilter = monthFilter.toLowerCase();
      if (!phase.includes(mFilter) && !title.includes(mFilter)) return false;
    }

    if (assigneeFilter !== 'all' || statusFilter !== 'all' || onlyOverdue || searchQuery.trim()) {
      const hasMatchingTasks = filteredTasks.some((t) => t.milestone_id === milestone.id);
      if (!hasMatchingTasks) {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = milestone.title.toLowerCase().includes(q);
          const matchDesc = (milestone.description || '').toLowerCase().includes(q);
          if (!matchTitle && !matchDesc) return false;
        } else {
          return false;
        }
      }
    }

    return true;
  });

  const openTasksCount = filteredTasks.filter((t) => t.status !== 'Done').length;

  const handleToggleTaskStatus = (task: Task) => {
    if (task.status === 'Done') {
      toggleTaskStatus(task.id, task.status);
    } else {
      setTaskForCompletionModal(task);
    }
  };

  const handleMoveTaskStatus = (taskId: string, targetStatus: TaskStatus) => {
    updateTask(taskId, { status: targetStatus });
  };

  return (
    <div className="space-y-6 pb-20 md:pb-12 max-w-6xl">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#103C2B] tracking-tight">
            Milestones & Tasks
          </h2>
          <p className="text-xs text-[#758078]">
            {activeMilestones.length} milestones · {openTasksCount} open tasks
          </p>
        </div>

        <button
          onClick={() => {
            setMilestoneToEdit(null);
            setMilestoneModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#103C2B] hover:bg-[#1C6245] text-white text-xs font-semibold shadow-xs transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add milestone</span>
        </button>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center bg-white border border-[#E2E8E0] p-1 rounded-xl shadow-2xs">
          <button
            onClick={() => setCurrentView('list')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentView === 'list'
                ? 'bg-[#164E33] text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <ListIcon className="w-3.5 h-3.5" />
            <span>List</span>
          </button>

          <button
            onClick={() => setCurrentView('board')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentView === 'board'
                ? 'bg-[#164E33] text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Board</span>
          </button>

          <button
            onClick={() => setCurrentView('timeline')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              currentView === 'timeline'
                ? 'bg-[#164E33] text-white shadow-2xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Timeline</span>
          </button>
        </div>

        <button
          onClick={() => setShowArchived(!showArchived)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
            showArchived
              ? 'bg-stone-800 text-white border-stone-800'
              : 'bg-white text-stone-600 border-[#E2E8E0] hover:bg-stone-50'
          }`}
        >
          <ArchiveIcon className="w-3.5 h-3.5" />
          <span>{showArchived ? 'Active Milestones' : 'Archived'}</span>
        </button>
      </div>

      {/* Search and Filters Bar matching image_9221fae2.png */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search milestones and tasks..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-[#E2E8E0] focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400 shadow-2xs"
          />
        </div>

        <select
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white border border-[#E2E8E0] font-medium text-stone-700 focus:outline-none shadow-2xs cursor-pointer"
        >
          <option value="all">Everyone</option>
          <option value="Abhijith">Abhijith Sriram V</option>
          <option value="Sivakumaran">Sivakumaran S</option>
          <option value="Nandhika">Nandhika S</option>
          <option value="Nithyasree">Nithyasree M</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white border border-[#E2E8E0] font-medium text-stone-700 focus:outline-none shadow-2xs cursor-pointer"
        >
          <option value="all">Any status</option>
          <option value="Todo">Not Started</option>
          <option value="In Progress">In Progress</option>
          <option value="Blocked">Blocked</option>
          <option value="Done">Done</option>
        </select>

        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white border border-[#E2E8E0] font-medium text-stone-700 focus:outline-none shadow-2xs cursor-pointer"
        >
          <option value="all">All months</option>
          <option value="Month 1">Month 1</option>
          <option value="Month 2">Month 2</option>
          <option value="Month 3">Month 3</option>
          <option value="Month 4">Month 4</option>
          <option value="Month 5">Month 5</option>
          <option value="Month 6">Month 6</option>
        </select>

        <button
          onClick={() => setOnlyOverdue(!onlyOverdue)}
          className={`px-3 py-2 text-xs rounded-xl border font-medium transition flex items-center gap-1.5 shadow-2xs ${
            onlyOverdue
              ? 'bg-rose-50 text-rose-700 border-rose-300 font-bold'
              : 'bg-white text-stone-700 border-[#E2E8E0] hover:bg-stone-50'
          }`}
        >
          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
          <span>Overdue</span>
        </button>

        {isFiltering && (
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setAssigneeFilter('all');
              setStatusFilter('all');
              setMonthFilter('all');
              setOnlyOverdue(false);
            }}
            className="px-3 py-2 text-xs rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Clear all active filters"
          >
            <X className="w-3.5 h-3.5 text-emerald-700" />
            <span>Reset filters ({filteredTasks.length} matching)</span>
          </button>
        )}
      </div>

      {/* VIEW 1: KANBAN BOARD matching image_9221fae2.png */}
      {currentView === 'board' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {/* Column 1: NOT STARTED */}
          {renderBoardColumn(
            '• NOT STARTED',
            filteredTasks.filter((t) => t.status === 'Todo'),
            'text-stone-400',
            'Todo'
          )}

          {/* Column 2: IN PROGRESS */}
          {renderBoardColumn(
            '• IN PROGRESS',
            filteredTasks.filter((t) => t.status === 'In Progress'),
            'text-blue-500',
            'In Progress'
          )}

          {/* Column 3: BLOCKED */}
          {renderBoardColumn(
            '• BLOCKED',
            filteredTasks.filter((t) => t.status === 'Blocked'),
            'text-rose-500',
            'Blocked'
          )}

          {/* Column 4: DONE */}
          {renderBoardColumn(
            '• DONE',
            filteredTasks.filter((t) => t.status === 'Done'),
            'text-emerald-600',
            'Done'
          )}
        </div>
      )}

      {/* VIEW 2: TIMELINE GANTT matching image_c851e388.png */}
      {currentView === 'timeline' && (
        <div className="rounded-2xl bg-white border border-[#E2E8E0] p-6 shadow-xs space-y-6">
          {/* Header Axis */}
          <div className="flex items-center justify-between text-xs font-bold text-stone-400 uppercase tracking-wider pb-2 border-b border-stone-100">
            <span>31 OCT</span>
            <span>15 MAR</span>
          </div>

          {/* Timeline Rows */}
          <div className="space-y-6 relative">
            {activeMilestones.map((m, idx) => {
              const mTasks = tasks.filter((t) => t.milestone_id === m.id);
              const doneCount = mTasks.filter((t) => t.status === 'Done').length;
              const pct = mTasks.length === 0 ? 0 : Math.round((doneCount / mTasks.length) * 100);

              // Calculate start offset & width according to month index
              const offsetPct = Math.min(85, idx * 16);
              const widthPct = Math.max(18, 25);

              return (
                <div key={m.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[#14281E]">
                    <span className="truncate pr-4">
                      {m.phase_label || `Month ${idx + 1}`} · {m.title.replace(/^Month \d+ – /, '')}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={idx === 0 ? 'text-red-500 font-bold' : 'text-stone-400'}>
                        {formatDate(m.planned_date).replace(/, \d{4}/, '')}
                      </span>
                      <span className="text-stone-400 font-bold w-9 text-right">{pct}%</span>
                    </div>
                  </div>

                  {/* Gantt Bar Track */}
                  <div className="h-4 bg-[#F2F6F2] rounded-full relative overflow-hidden">
                    <div
                      className="absolute top-0 bottom-0 rounded-full flex overflow-hidden"
                      style={{ left: `${offsetPct}%`, width: `${widthPct}%` }}
                    >
                      {/* Completed portion in dark green */}
                      <div
                        className="h-full bg-[#164E33] transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                      {/* Remaining planned portion in lighter green */}
                      <div
                        className="h-full bg-[#529E72] transition-all duration-500 flex-1"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend matching image_c851e388.png */}
          <div className="pt-4 border-t border-stone-100 flex items-center gap-6 text-xs text-stone-500 font-medium">
            <div className="flex items-center gap-2">
              <span className="w-3 h-2 rounded bg-[#529E72]" />
              <span>Planned</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-2 rounded bg-[#164E33]" />
              <span>Done</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-0.5 h-3 bg-[#D96B1C]" />
              <span>Today</span>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: LIST VIEW (Milestone Cards with Tasks) */}
      {currentView === 'list' && (
        <div className="space-y-5">
          {filteredMilestones.length === 0 ? (
            <div className="rounded-3xl bg-white border border-[#E2E8E0] p-10 text-center shadow-xs space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-800 mx-auto flex items-center justify-center">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-stone-800">No matching milestones or tasks found</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto">
                No items match your active filters. Try adjusting your search query, status, assignee, or month filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setAssigneeFilter('all');
                  setStatusFilter('all');
                  setMonthFilter('all');
                  setOnlyOverdue(false);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            filteredMilestones.map((milestone, idx) => {
              const allMilestoneTasks = tasks.filter((t) => t.milestone_id === milestone.id);
              const completedCount = allMilestoneTasks.filter((t) => t.status === 'Done').length;
              const isAllDone = allMilestoneTasks.length > 0 && completedCount === allMilestoneTasks.length;
              const pct = allMilestoneTasks.length === 0 ? 0 : Math.round((completedCount / allMilestoneTasks.length) * 100);

              // Tasks to display: filtered when filters are active, or all tasks when viewing unfiltered
              const displayedTasks = isFiltering
                ? filteredTasks.filter((t) => t.milestone_id === milestone.id)
                : allMilestoneTasks;

              return (
              <div
                key={milestone.id}
                className="rounded-3xl bg-white border border-[#E2E8E0] shadow-xs overflow-hidden"
              >
                {/* Progress bar line along top */}
                <div className="w-full h-1 bg-stone-100">
                  <div
                    className="h-full bg-[#164E33] transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Milestone Header */}
                <div className="p-5 sm:p-6 pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <GripVertical className="w-4 h-4 text-stone-300 cursor-grab" />
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-[#EAF3EB] text-[#1E5638] tracking-wider">
                        {milestone.phase_label || `MONTH ${idx + 1}`}
                      </span>
                      <span className="text-[11px] font-medium text-stone-500 flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isAllDone
                              ? 'bg-[#164E33]'
                              : milestone.status === 'In Progress'
                              ? 'bg-amber-500'
                              : 'bg-stone-400'
                          }`}
                        />
                        {isAllDone ? 'Done' : milestone.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-[#14281E]">{pct}%</span>
                      <div className="relative">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuTaskId(null);
                            setActiveMenuMilestoneId(
                              activeMenuMilestoneId === milestone.id ? null : milestone.id
                            );
                          }}
                          className="p-1 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition active:scale-95"
                          title="Milestone options"
                          aria-label="Milestone options"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {activeMenuMilestoneId === milestone.id && (
                          <>
                            {/* Full-screen backdrop to dismiss on click/touch outside */}
                            <div
                              className="fixed inset-0 z-30 bg-transparent cursor-default select-none"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuMilestoneId(null);
                              }}
                              onTouchStart={(e) => {
                                e.stopPropagation();
                                setActiveMenuMilestoneId(null);
                              }}
                              aria-hidden="true"
                            />
                            <div className="absolute right-0 top-7 w-44 rounded-2xl bg-white shadow-xl border border-stone-200 py-1.5 z-40 text-xs animate-scaleIn">
                              <button
                                onClick={() => {
                                  setActiveMenuMilestoneId(null);
                                  setMilestoneToEdit(milestone);
                                  setMilestoneModalOpen(true);
                                }}
                                className="w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-stone-400" />
                                Edit Milestone
                              </button>
                              <button
                                onClick={() => {
                                  setActiveMenuMilestoneId(null);
                                  duplicateMilestone(milestone.id);
                                }}
                                className="w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5 text-stone-400" />
                                Duplicate
                              </button>
                              <button
                                onClick={() => {
                                  setActiveMenuMilestoneId(null);
                                  archiveMilestone(milestone.id, !milestone.archived);
                                }}
                                className="w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                              >
                                <Archive className="w-3.5 h-3.5 text-stone-400" />
                                {milestone.archived ? 'Restore' : 'Archive'}
                              </button>
                              {isTeamLead && (
                                <button
                                  onClick={() => {
                                    setActiveMenuMilestoneId(null);
                                    setMilestoneToDelete(milestone);
                                  }}
                                  className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-stone-100 cursor-pointer font-medium"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Milestone Title & Description */}
                  <div className="mt-2.5 space-y-1">
                    <h3 className="text-base font-bold text-[#14281E] leading-snug">
                      {milestone.title}
                    </h3>
                    {milestone.description && (
                      <p className="text-xs text-stone-500 leading-relaxed">
                        {milestone.description}
                      </p>
                    )}
                    <p className="text-xs text-stone-400 font-medium pt-0.5">
                      Planned {formatDate(milestone.planned_date).replace(/, \d{4}/, '')}
                    </p>
                  </div>
                </div>

                {/* Tasks List */}
                <div className="px-3 sm:px-5 pb-4 space-y-0.5 divide-y divide-stone-100">
                  {displayedTasks.length === 0 ? (
                    <div className="py-4 text-center text-xs text-stone-400 font-medium">
                      {isFiltering
                        ? 'No tasks in this milestone match the active filters.'
                        : 'No tasks added yet. Click "+ Add task" below.'}
                    </div>
                  ) : (
                    displayedTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        milestones={milestones}
                        isMenuOpen={activeMenuTaskId === task.id}
                        onToggleMenu={() => {
                          setActiveMenuMilestoneId(null);
                          setActiveMenuTaskId(activeMenuTaskId === task.id ? null : task.id);
                        }}
                        onCloseMenu={() => setActiveMenuTaskId(null)}
                        onRequestDelete={(t) => setTaskToDelete(t)}
                        onOpenComments={(t) => setCommentsModalTask(t)}
                        onEditTask={(t) => {
                          setTaskToEdit(t);
                          setTaskModalOpen(true);
                        }}
                      />
                    ))
                  )}

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setTargetMilestoneForTask(milestone.id);
                        setTaskToEdit(null);
                        setTaskModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#164E33] hover:text-[#113E28] py-1 px-1 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add task</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          }))}
        </div>
      )}

      {/* Modals */}
      <MilestoneFormModal
        isOpen={milestoneModalOpen}
        onClose={() => setMilestoneModalOpen(false)}
        milestoneToEdit={milestoneToEdit}
      />

      <TaskFormModal
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        milestoneId={targetMilestoneForTask}
        taskToEdit={taskToEdit}
      />

      <MilestoneDateHistoryModal
        milestone={dateHistoryMilestone}
        onClose={() => setDateHistoryMilestone(null)}
      />

      <TaskCommentsModal
        task={commentsModalTask}
        onClose={() => setCommentsModalTask(null)}
      />

      <TaskCompletionModal
        task={taskForCompletionModal}
        isOpen={Boolean(taskForCompletionModal)}
        onClose={() => setTaskForCompletionModal(null)}
      />

      {/* Confirmation Dialog for Task Deletion */}
      <ConfirmDeleteModal
        isOpen={Boolean(taskToDelete)}
        title="Delete Task"
        message={`Are you sure you want to delete "${taskToDelete?.title}"? (You will have 10 seconds to undo this deletion).`}
        confirmLabel="Delete Task"
        onConfirm={() => {
          if (taskToDelete) {
            deleteTask(taskToDelete.id);
            setTaskToDelete(null);
          }
        }}
        onCancel={() => setTaskToDelete(null)}
      />

      {/* Confirmation Dialog for Milestone Deletion */}
      <ConfirmDeleteModal
        isOpen={Boolean(milestoneToDelete)}
        title="Delete Milestone"
        message={`Are you sure you want to delete milestone "${milestoneToDelete?.title}" and all its tasks? This action cannot be undone.`}
        confirmLabel="Delete Milestone"
        onConfirm={() => {
          if (milestoneToDelete) {
            deleteMilestone(milestoneToDelete.id);
            setMilestoneToDelete(null);
          }
        }}
        onCancel={() => setMilestoneToDelete(null)}
      />
    </div>
  );

  // Helper to render Kanban column matching image_9221fae2.png
  function renderBoardColumn(
    colTitle: string,
    tasksInCol: Task[],
    dotColorClass: string,
    statusValue: TaskStatus
  ) {
    return (
      <div className="rounded-2xl bg-[#E3EAE3]/50 p-3 space-y-3 min-h-[400px]">
        {/* Column Header */}
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-[#14281E] uppercase tracking-wider flex items-center gap-1.5">
            <span className={dotColorClass}>●</span>
            <span>{colTitle.replace('• ', '')}</span>
          </span>
          <span className="text-[10px] font-bold text-stone-500 bg-white px-2 py-0.5 rounded-full border border-stone-200">
            {tasksInCol.length}
          </span>
        </div>

        {/* Tasks Cards in Column */}
        <div className="space-y-2.5">
          {tasksInCol.map((task) => {
            const parentMilestone = milestones.find((m) => m.id === task.milestone_id);
            const isDone = task.status === 'Done';
            const { isOverdue, daysRemaining } = getDeadlineStatus(task.deadline, isDone);

            const assigneeMember = SEED_MEMBERS.find(
              (m) =>
                m.email.toLowerCase() === task.assignee_id?.toLowerCase() ||
                m.full_name.toLowerCase() === task.assignee_name?.toLowerCase()
            );

            return (
              <div
                key={task.id}
                className="rounded-2xl bg-white border border-[#E2E8E0] p-4 shadow-xs hover:border-[#164E33]/40 transition space-y-2.5 group"
              >
                {/* Title & Phase */}
                <div>
                  <h4
                    onClick={() => {
                      setTaskToEdit(task);
                      setTaskModalOpen(true);
                    }}
                    className={`text-xs font-bold cursor-pointer hover:text-[#164E33] leading-snug ${
                      isDone ? 'line-through text-stone-400' : 'text-[#14281E]'
                    }`}
                  >
                    {task.title}
                  </h4>
                  <p className="text-[10px] text-stone-400 mt-0.5 font-medium">
                    {parentMilestone?.phase_label || 'Month 1'}
                  </p>
                </div>

                {/* Priority & Deadline / Completion Date Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Priority Pill */}
                  <span
                    className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider ${
                      task.priority === 'High'
                        ? 'bg-rose-50 text-rose-600'
                        : 'bg-[#FEF3EB] text-[#D96B1C]'
                    }`}
                  >
                    {task.priority === 'High' ? 'HIGH' : 'MEDIUM'}
                  </span>

                  {/* Completion date or deadline badge */}
                  {isDone ? (
                    <span className="text-[10px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>{task.completion_date ? `Visited ${formatDate(task.completion_date).replace(/, \d{4}/, '')}` : 'Completed'}</span>
                    </span>
                  ) : task.deadline ? (
                    <span className="text-[10px] text-stone-500 flex items-center gap-1 font-medium">
                      {isOverdue ? (
                        <span className="text-red-500 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{Math.abs(daysRemaining)}d late</span>
                        </span>
                      ) : daysRemaining === 0 ? (
                        <span className="text-[#D96B1C] font-bold flex items-center gap-1 bg-[#FEF3EB] px-2 py-0.5 rounded-full">
                          <Calendar className="w-3 h-3" />
                          <span>Today</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-stone-400" />
                          <span>{formatDate(task.deadline).replace(/, \d{4}/, '')}</span>
                        </span>
                      )}
                    </span>
                  ) : null}
                </div>

                {/* Completion observations snippet & attached doc on board card */}
                {isDone && task.completion_details && (
                  <p className="text-[10px] text-stone-600 bg-emerald-50/70 p-2 rounded-lg border border-emerald-100 italic line-clamp-2 leading-relaxed">
                    &ldquo;{task.completion_details}&rdquo;
                  </p>
                )}

                {isDone && task.completion_document_title && (
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-900 bg-white px-2 py-1 rounded-md border border-emerald-200 shadow-2xs truncate">
                    <FileText className="w-3 h-3 text-emerald-700 shrink-0" />
                    <span className="truncate">{task.completion_document_title}</span>
                  </div>
                )}

                {/* Bottom Row: Assignee Avatar & Actions */}
                <div className="pt-1 flex items-center justify-between border-t border-stone-50">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0 shadow-2xs"
                      style={{ backgroundColor: assigneeMember?.avatar_color || '#164E33' }}
                    >
                      {assigneeMember
                        ? assigneeMember.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                        : '•'}
                    </div>
                    <span className="text-[10px] text-stone-500 font-medium">
                      {assigneeMember?.full_name.split(' ')[0] || 'Team'}
                    </span>
                  </div>

                  {/* Checkbox toggle or Status move button */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleTaskStatus(task)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition active:scale-90 ${
                        isDone
                          ? 'bg-[#164E33] text-white shadow-xs'
                          : 'border-2 border-stone-300 hover:border-[#164E33] bg-white'
                      }`}
                      title={isDone ? 'Mark as Not Started' : 'Mark as Done'}
                    >
                      {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>

                    <button
                      onClick={() => setTaskToDelete(task)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-stone-300 hover:text-red-500 rounded transition"
                      title="Delete task"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
};
