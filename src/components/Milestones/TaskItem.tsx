import React, { useState, useEffect } from 'react';
import { Task, Milestone, DocumentItem } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { formatDate, getDeadlineStatus, timeAgo } from '../../lib/dateUtils';
import { SEED_MEMBERS } from '../../lib/constants';
import { TaskCompletionModal } from './TaskCompletionModal';
import { DocumentPreviewModal } from '../Documents/DocumentPreviewModal';
import {
  Check,
  Calendar,
  AlertCircle,
  MoreVertical,
  Trash2,
  Edit2,
  Clock,
  CheckCircle2,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface TaskItemProps {
  task: Task;
  milestones: Milestone[];
  isMenuOpen?: boolean;
  onToggleMenu?: () => void;
  onCloseMenu?: () => void;
  onRequestDelete?: (task: Task) => void;
  onOpenComments: (task: Task) => void;
  onEditTask: (task: Task) => void;
}

export const TaskItem: React.FC<TaskItemProps> = ({
  task,
  milestones: _milestones,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onRequestDelete,
  onOpenComments: _onOpenComments,
  onEditTask,
}) => {
  const { toggleTaskStatus, deleteTask, recentTaskActions, documents } = useRealtimeStore();
  const [internalShowMenu, setInternalShowMenu] = useState(false);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const [showDetailsExpanded, setShowDetailsExpanded] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  const isMenuVisible = isMenuOpen !== undefined ? isMenuOpen : internalShowMenu;
  const toggleMenu = onToggleMenu || (() => setInternalShowMenu((prev) => !prev));
  const closeMenu = onCloseMenu || (() => setInternalShowMenu(false));

  useEffect(() => {
    if (!isMenuVisible) return;
    const handleClose = () => closeMenu();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu();
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuVisible, closeMenu]);

  const isDone = task.status === 'Done';
  const { isOverdue, daysRemaining } = getDeadlineStatus(task.deadline, isDone);
  const recentAction = recentTaskActions[task.id];
  const isRecentAction = Boolean(
    recentAction && Date.now() - recentAction.timestamp < 120000
  );

  const assigneeMember = SEED_MEMBERS.find(
    (m) =>
      m.email.toLowerCase() === task.assignee_id?.toLowerCase() ||
      m.full_name.toLowerCase() === task.assignee_name?.toLowerCase()
  );

  const handleToggle = () => {
    if (isDone) {
      // Reopen task with expected status guard against concurrent conflicting edits
      toggleTaskStatus(task.id, 'Done');
    } else {
      // Open modal to record completion/visit date, notes, and document
      setShowCompletionModal(true);
    }
  };

  // Determine badge for deadline
  const renderDeadlineBadge = () => {
    if (!task.deadline) return null;

    if (isDone) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Completed</span>
        </span>
      );
    }

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

  const hasCompletionDetails = Boolean(
    task.completion_date || task.completion_details || task.completion_document_title
  );

  return (
    <div className="py-2.5 px-3 rounded-2xl hover:bg-stone-50/80 transition flex flex-col gap-2 group border border-transparent hover:border-stone-200">
      {/* Top Row: Checkbox, Title, and Badges */}
      <div className="flex items-center justify-between gap-3 min-w-0 w-full">
        {/* Left side: Round Checkbox and Title */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Round Checkbox */}
          <button
            onClick={handleToggle}
            className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition active:scale-90 ${
              isDone
                ? 'bg-[#164E33] text-white shadow-xs'
                : 'border-2 border-stone-300 hover:border-[#164E33] bg-white'
            }`}
            title={isDone ? 'Click to mark Incomplete' : 'Click to complete task and record visit/details'}
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
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-[10px] text-stone-400 truncate">
                {task.assignee_name || 'Whole team'} · edited by{' '}
                {task.updated_by === 'nandhikas3@gmail.com' ? 'Nandhika' : 'Team'}{' '}
                {timeAgo(task.updated_at)}
              </p>
              {isRecentAction && recentAction && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-100/90 px-1.5 py-0.2 rounded-full border border-emerald-300 shadow-2xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                  <span>
                    ⚡ {recentAction.actor} {recentAction.action}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side badges */}
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
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMenu();
              }}
              className={`p-1.5 rounded-lg transition active:scale-90 ${
                isMenuVisible ? 'text-stone-800 bg-stone-100' : 'text-stone-300 hover:text-stone-700 hover:bg-stone-100/60'
              }`}
              title="Task options"
              aria-label="Task options"
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>

            {isMenuVisible && (
              <>
                {/* Full-screen backdrop: touching/clicking anywhere outside immediately closes the menu */}
                <div
                  className="fixed inset-0 z-30 bg-transparent cursor-default select-none"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeMenu();
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    closeMenu();
                  }}
                  aria-hidden="true"
                />

                <div className="absolute right-0 top-7 w-48 rounded-xl bg-white shadow-2xl border border-stone-200 py-1.5 z-40 text-xs animate-scaleIn">
                  {isDone && (
                    <button
                      onClick={() => {
                        closeMenu();
                        setShowCompletionModal(true);
                      }}
                      className="w-full px-3 py-1.5 text-left text-emerald-800 hover:bg-emerald-50 flex items-center gap-2 font-medium cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Edit Completion Details
                    </button>
                  )}
                  <button
                    onClick={() => {
                      closeMenu();
                      onEditTask(task);
                    }}
                    className="w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-stone-400" />
                    Edit Task
                  </button>
                  <button
                    onClick={() => {
                      closeMenu();
                      if (onRequestDelete) {
                        onRequestDelete(task);
                      } else {
                        deleteTask(task.id);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Completion Details Banner (Visible when task is Done) */}
      {isDone && (
        <div className="ml-8 mt-0.5 rounded-xl bg-emerald-50/80 border border-emerald-200/90 p-3 text-xs space-y-2 transition">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-emerald-950 font-semibold flex-wrap">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Completed / Visited on{' '}
                <span className="font-bold text-emerald-900 bg-white px-2 py-0.5 rounded-md border border-emerald-200 shadow-2xs">
                  {formatDate(task.completion_date || task.updated_at).replace(/, \d{4}/, '')}
                </span>
              </span>
              {task.deadline && task.completion_date && task.completion_date !== task.deadline && (
                <span className="text-[11px] text-stone-500 font-normal">
                  (Planned: {formatDate(task.deadline).replace(/, \d{4}/, '')})
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {task.completed_by_name && (
                <span className="text-[10px] text-emerald-800 font-medium bg-emerald-100/80 px-2 py-0.5 rounded-full">
                  By {task.completed_by_name}
                </span>
              )}
              <button
                onClick={() => setShowCompletionModal(true)}
                className="text-[10px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline"
              >
                {hasCompletionDetails ? 'Edit details' : 'Add details'}
              </button>
              {task.completion_details && (
                <button
                  onClick={() => setShowDetailsExpanded(!showDetailsExpanded)}
                  className="text-stone-400 hover:text-stone-700 p-0.5 rounded"
                  title="Toggle details"
                >
                  {showDetailsExpanded ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Details & Findings block */}
          {task.completion_details && showDetailsExpanded && (
            <div className="p-2.5 rounded-lg bg-white/90 border border-emerald-200/80 text-stone-700 text-xs leading-relaxed space-y-1">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
                Completion Notes & Observations:
              </span>
              <p className="whitespace-pre-line">{task.completion_details}</p>
            </div>
          )}
          {/* Linked Research Document Chip (Only shown if document still exists in workspace documents) */}
          {(() => {
            const linkedDoc = documents.find(
              (d) =>
                (task.completion_document_id && d.id === task.completion_document_id) ||
                (task.completion_document_title &&
                  d.title.trim().toLowerCase() === task.completion_document_title.trim().toLowerCase())
            );

            if (!linkedDoc) return null;

            return (
              <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
                  Linked Document:
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(linkedDoc)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-emerald-300 hover:border-emerald-600 text-emerald-900 font-semibold text-xs shadow-2xs hover:bg-emerald-50 transition cursor-pointer"
                  title="Click to preview document"
                >
                  <FileText className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="truncate max-w-[220px]">
                    {linkedDoc.title}
                  </span>
                  <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-normal">
                    View doc
                  </span>
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Task Completion Modal */}
      <TaskCompletionModal
        task={task}
        isOpen={showCompletionModal}
        onClose={() => setShowCompletionModal(false)}
      />

      {/* Document Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          document={previewDoc}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
};
