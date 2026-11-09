import React, { useState, useEffect } from 'react';
import { Task, TaskPriority, TaskStatus } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { SEED_MEMBERS } from '../../lib/constants';
import { CheckSquare, Calendar, AlertTriangle, X, User } from 'lucide-react';

interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestoneId?: string;
  taskToEdit?: Task | null;
}

export const TaskFormModal: React.FC<TaskFormModalProps> = ({
  isOpen,
  onClose,
  milestoneId,
  taskToEdit,
}) => {
  const { milestones, addTask, updateTask, currentUser } = useRealtimeStore();

  const isEditing = Boolean(taskToEdit);

  const [targetMilestoneId, setTargetMilestoneId] = useState(milestoneId || '');
  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Med');
  const [status, setStatus] = useState<TaskStatus>('Todo');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (taskToEdit) {
      setTargetMilestoneId(taskToEdit.milestone_id);
      setTitle(taskToEdit.title);
      setAssigneeId(taskToEdit.assignee_id || currentUser.email);
      setDeadline(taskToEdit.deadline || '');
      setPriority(taskToEdit.priority);
      setStatus(taskToEdit.status);
      setNotes((taskToEdit.notes || '').replace(/\s*<!--\s*spiceguard_completion:[\s\S]*?-->/g, '').trim());
    } else {
      setTargetMilestoneId(milestoneId || (milestones[0]?.id || ''));
      setTitle('');
      setAssigneeId(currentUser.email);
      setDeadline('');
      setPriority('Med');
      setStatus('Todo');
      setNotes('');
    }
    setErrorMsg(null);
  }, [isOpen, taskToEdit?.id, milestoneId]);

  if (!isOpen) return null;

  const currentMilestone = milestones.find((m) => m.id === targetMilestoneId);

  // Warning if deadline > milestone planned date
  const isDeadlineExceedingMilestone =
    deadline &&
    currentMilestone?.planned_date &&
    deadline > currentMilestone.planned_date;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Task title is required.');
      return;
    }

    if (!targetMilestoneId) {
      setErrorMsg('Please select a target milestone.');
      return;
    }

    if (!isEditing) {
      const res = addTask({
        milestone_id: targetMilestoneId,
        title: cleanTitle,
        assignee_id: assigneeId,
        deadline: deadline || currentMilestone?.planned_date,
        priority,
        notes,
      });

      if (!res.success) {
        setErrorMsg(res.message);
        return;
      }
    } else if (taskToEdit) {
      const res = updateTask(taskToEdit.id, {
        milestone_id: targetMilestoneId,
        title: cleanTitle,
        assignee_id: assigneeId,
        deadline,
        priority,
        status,
        notes,
      });

      if (!res.success) {
        setErrorMsg(res.message);
        return;
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="bg-emerald-950 text-white p-4 sm:p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <CheckSquare className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isEditing ? 'Edit Task' : 'Add New Task'}
              </h3>
              <p className="text-xs text-emerald-300">
                {currentMilestone ? currentMilestone.title : 'SpiceGuard Sprint Task'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
              {errorMsg}
            </div>
          )}

          {/* Target Milestone */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Parent Milestone
            </label>
            <select
              value={targetMilestoneId}
              onChange={(e) => setTargetMilestoneId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
            >
              {milestones
                .filter((m) => !m.archived)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.phase_label || m.title.split('–')[0]} — {m.title}
                  </option>
                ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Calibrate NIR sensor for curcumin absorption"
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
              required
            />
          </div>

          {/* Assignee & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
              >
                <option value="team">Team (Shared / Unassigned)</option>
                {SEED_MEMBERS.map((member) => (
                  <option key={member.id} value={member.email}>
                    {member.full_name} ({member.role.split(' ')[0]})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
              >
                <option value="Low">Low</option>
                <option value="Med">Medium</option>
                <option value="High">High</option>
              </select>
            </div>
          </div>

          {/* Deadline & Status (if editing) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
              />
            </div>

            {isEditing ? (
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
                >
                  <option value="Todo">Todo</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Blocked">Blocked</option>
                  <option value="Done">Done</option>
                </select>
              </div>
            ) : null}
          </div>

          {/* Warning if task deadline is later than milestone planned date */}
          {isDeadlineExceedingMilestone && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Task deadline ({deadline}) extends beyond milestone target
                date ({currentMilestone?.planned_date}). You can still proceed.
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Technical specs, sample batch numbers..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition active:scale-98"
            >
              {isEditing ? 'Save Task' : 'Add Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
