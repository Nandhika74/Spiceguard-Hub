import React, { useState } from 'react';
import { Task, TaskStatus, Milestone } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { formatDate, getDeadlineStatus } from '../../lib/dateUtils';
import { SEED_MEMBERS } from '../../lib/constants';
import { CheckCircle2, Circle, AlertCircle, Clock, Plus, MoveRight } from 'lucide-react';

interface MilestoneKanbanProps {
  tasks: Task[];
  milestones: Milestone[];
  onOpenTask: (task: Task) => void;
  onAddTask: (milestoneId?: string) => void;
}

export const MilestoneKanban: React.FC<MilestoneKanbanProps> = ({
  tasks,
  milestones,
  onOpenTask,
  onAddTask,
}) => {
  const { updateTask } = useRealtimeStore();
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const columns: { id: TaskStatus; label: string; color: string; badgeBg: string }[] = [
    { id: 'Todo', label: 'To Do', color: 'border-stone-300', badgeBg: 'bg-stone-100 text-stone-700' },
    { id: 'In Progress', label: 'In Progress', color: 'border-blue-400', badgeBg: 'bg-blue-100 text-blue-800' },
    { id: 'Blocked', label: 'Blocked', color: 'border-red-400', badgeBg: 'bg-red-100 text-red-800' },
    { id: 'Done', label: 'Completed', color: 'border-emerald-500', badgeBg: 'bg-emerald-100 text-emerald-800' },
  ];

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      updateTask(taskId, { status: targetStatus });
    }
    setDraggedTaskId(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto pb-6">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);

        return (
          <div
            key={col.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
            className={`flex flex-col rounded-2xl bg-stone-100/80 border-t-4 ${col.color} p-3.5 min-h-[500px] border border-stone-200/80`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                  {col.label}
                </h4>
                <span className={`text-[11px] font-bold px-2 py-0.2 rounded-full ${col.badgeBg}`}>
                  {colTasks.length}
                </span>
              </div>
              <button
                onClick={() => onAddTask()}
                className="p-1 rounded-lg text-stone-500 hover:text-emerald-900 hover:bg-white transition"
                title="Add task to column"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Tasks list */}
            <div className="flex-1 space-y-2.5 overflow-y-auto">
              {colTasks.length === 0 ? (
                <div className="py-12 text-center text-xs text-stone-400 border-2 border-dashed border-stone-200 rounded-xl">
                  Drop tasks here
                </div>
              ) : (
                colTasks.map((task) => {
                  const parentMilestone = milestones.find((m) => m.id === task.milestone_id);
                  const isDone = task.status === 'Done';
                  const { isOverdue, isDueSoon } = getDeadlineStatus(task.deadline, isDone);
                  const assigneeMember = SEED_MEMBERS.find(
                    (m) => m.email.toLowerCase() === task.assignee_id?.toLowerCase()
                  );

                  return (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onClick={() => onOpenTask(task)}
                      className={`p-3 rounded-xl bg-white border border-stone-200 shadow-xs hover:shadow-md cursor-grab active:cursor-grabbing transition space-y-2 ${
                        isOverdue
                          ? 'border-red-300 bg-red-50/20'
                          : isDueSoon
                          ? 'border-amber-300 bg-amber-50/20'
                          : ''
                      }`}
                    >
                      {/* Milestone tag */}
                      {parentMilestone && (
                        <div className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded inline-block truncate max-w-full">
                          {parentMilestone.phase_label || parentMilestone.title.split('–')[0]}
                        </div>
                      )}

                      <h5 className="text-xs font-bold text-stone-900 leading-snug">
                        {task.title}
                      </h5>

                      <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-[11px]">
                        {/* Assignee */}
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center shrink-0"
                            style={{ backgroundColor: assigneeMember?.avatar_color || '#14532D' }}
                          >
                            {(task.assignee_name || 'U').charAt(0)}
                          </div>
                          <span className="text-[10px] text-stone-600 truncate max-w-[80px]">
                            {task.assignee_name?.split(' ')[0]}
                          </span>
                        </div>

                        {/* Deadline */}
                        {task.deadline && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                              isOverdue
                                ? 'bg-red-100 text-red-800 font-bold'
                                : isDueSoon
                                ? 'bg-amber-100 text-amber-900 font-bold'
                                : 'text-stone-500'
                            }`}
                          >
                            {formatDate(task.deadline)}
                          </span>
                        )}
                      </div>

                      {/* Quick Move Row for mobile/touch */}
                      <div className="flex items-center justify-end gap-1 pt-1 text-[10px] text-stone-400">
                        <span>Move:</span>
                        {columns
                          .filter((c) => c.id !== task.status)
                          .map((c) => (
                            <button
                              key={c.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTask(task.id, { status: c.id });
                              }}
                              className="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-emerald-100 hover:text-emerald-900 font-semibold text-stone-600 transition"
                            >
                              {c.id.charAt(0)}
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
