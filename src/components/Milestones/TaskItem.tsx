import React, { useState, useEffect } from 'react';
import { Task, Milestone } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { formatDate, getDeadlineStatus, timeAgo } from '../../lib/dateUtils';
import { SEED_MEMBERS } from '../../lib/constants';
import {
  Check,
  Calendar,
  AlertCircle,
  MoreVertical,
  Trash2,
  Edit2,
  Clock,
} from 'lucide-react';

interface TaskItemProps {
  task: Task;
  milestones: Milestone[];
  onOpenComments: (task: Task) => void;
  onEditTask: (task: Task) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  milestones,
  onOpenComments,
  onEditTask,
}) => {
  const { toggleTaskStatus, deleteTask } = useRealtimeStore();
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!showMenu) return;
    const handleClose = () => setShowMenu(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowMenu(false);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showMenu]);

  const isDone = task.status === 'Done';
  const { isOverdue, daysRemaining } = getDeadlineStatus(task.deadline, isDone);

  const assigneeMember = SEED_MEMBERS.find(
    (m) =>
      m.email.toLowerCase() === task.assignee_id?.toLowerCase() ||
      m.full_name.toLowerCase() === task.assignee_name?.toLowerCase()
  );

  const handleToggle = () => {
    toggleTaskStatus(task.id);
  };

  // Determine badge for deadline matching Screenshot 4
  const renderDeadlineBadge = () => {
    if (!task.deadline) return null;

    if (isOverdue) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-500 bg-red-50/80 px-2 py-0.5 rounded-full border border-red-200/60">
          <AlertCircle className="w-3 h-3" />
          <span>{Math.abs(daysRemaining)}d late</span>
        </span>
      );
    }

    if (daysRemaining === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
          <Clock className="w-3 h-3" />
          <span>Today</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 bg-stone-100/80 px-2 py-0.5 rounded-full">
        <Calendar className="w-3 h-3 text-stone-400" />
        <span>{formatDate(task.deadline).replace(/, \d{4}/, '')}</span>
      </span>
    );
  };

  return (
    <div className="py-2.5 px-3 rounded-2xl hover:bg-stone-50/80 transition flex items-center justify-between gap-3 group border border-transparent hover:border-stone-200">
      {/* Left side: Round Checkbox and Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Round Checkbox matching Screenshot 4 */}
        <button
          onClick={handleToggle}
          className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition active:scale-90 ${
            isDone
              ? 'bg-[#164E33] text-white shadow-xs'
              : 'border-2 border-stone-300 hover:border-[#164E33] bg-white'
          }`}
          title={isDone ? 'Mark Incomplete' : 'Mark Done'}
        >
          {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>

        {/* Task Details */}
        <div className="min-w-0 flex-1">
          <h4
            onClick={() => onEditTask(task)}
            className={`text-xs font-semibold leading-snug cursor-pointer truncate ${
              isDone ? 'line-through text-stone-400' : 'text-stone-900 hover:text-[#164E33]'
            }`}
          >
            {task.title}
          </h4>
          <p className="text-[10px] text-stone-400 mt-0.5 truncate">
            {task.assignee_name || 'Whole team'} · edited by{' '}
            {task.updated_by === 'nandhikas3@gmail.com' ? 'Nandhika' : 'Team'}{' '}
            {timeAgo(task.updated_at)}
          </p>
        </div>
      </div>

      {/* Right side badges matching Screenshot 4 */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Priority Badge */}
        <span
          className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider ${
            task.priority === 'High'
              ? 'bg-rose-50 text-rose-600 border border-rose-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          {task.priority === 'High' ? 'HIGH' : 'MEDIUM'}
        </span>

        {/* Due status badge */}
        {renderDeadlineBadge()}

        {/* Assignee Avatar Circle */}
        <div
          className="w-6 h-6 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 shadow-2xs"
          style={{ backgroundColor: assigneeMember?.avatar_color || '#164E33' }}
          title={task.assignee_name || 'Unassigned'}
        >
          {assigneeMember
            ? assigneeMember.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
            : '•'}
        </div>

        {/* Options */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-stone-300 hover:text-stone-700 rounded-lg"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-6 w-40 rounded-xl bg-white shadow-lg border border-stone-200 py-1 z-20 text-xs">
              <button
                onClick={() => {
                  setShowMenu(false);
                  onEditTask(task);
                }}
                className="w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2"
              >
                <Edit2 className="w-3.5 h-3.5 text-stone-400" />
                Edit
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  if (confirm(`Delete task "${task.title}"?`)) {
                    deleteTask(task.id);
                  }
                }}
                className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
