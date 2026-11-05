import React, { useState, useEffect } from 'react';
import { Milestone, MilestoneStatus } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { Target, Calendar, AlertCircle, X, HelpCircle, FileText } from 'lucide-react';

interface MilestoneFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestoneToEdit?: Milestone | null;
}

export const MilestoneFormModal: React.FC<MilestoneFormModalProps> = ({
  isOpen,
  onClose,
  milestoneToEdit,
}) => {
  const { addMilestone, updateMilestone, milestones } = useRealtimeStore();

  const isEditing = Boolean(milestoneToEdit);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [status, setStatus] = useState<MilestoneStatus>('Not Started');
  const [phaseLabel, setPhaseLabel] = useState('');
  const [supportRequired, setSupportRequired] = useState('');
  const [notes, setNotes] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (milestoneToEdit) {
      setTitle(milestoneToEdit.title);
      setDescription(milestoneToEdit.description || '');
      setPlannedDate(milestoneToEdit.planned_date);
      setStatus(milestoneToEdit.status);
      setPhaseLabel(milestoneToEdit.phase_label || '');
      setSupportRequired(milestoneToEdit.support_required || '');
      setNotes(milestoneToEdit.notes || '');
      setRescheduleReason('');
    } else {
      setTitle('');
      setDescription('');
      setPlannedDate('2026-11-30');
      setStatus('Not Started');
      setPhaseLabel(`Month ${milestones.length + 1}`);
      setSupportRequired('');
      setNotes('');
      setRescheduleReason('');
    }
    setErrorMsg(null);
  }, [milestoneToEdit, isOpen, milestones.length]);

  if (!isOpen) return null;

  const isRescheduled =
    isEditing &&
    milestoneToEdit &&
    plannedDate &&
    plannedDate !== milestoneToEdit.planned_date;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Milestone title is required.');
      return;
    }

    if (!plannedDate) {
      setErrorMsg('Planned completion date is required.');
      return;
    }

    if (!isEditing) {
      const res = addMilestone({
        title: cleanTitle,
        description,
        planned_date: plannedDate,
        support_required: supportRequired,
        phase_label: phaseLabel,
        notes,
      });

      if (!res.success) {
        setErrorMsg(res.message);
        return;
      }
    } else if (milestoneToEdit) {
      // Check for title collision if renamed
      if (
        cleanTitle.toLowerCase() !== milestoneToEdit.title.toLowerCase() &&
        milestones.some((m) => m.id !== milestoneToEdit.id && m.title.toLowerCase() === cleanTitle.toLowerCase())
      ) {
        setErrorMsg('Another milestone already uses this title.');
        return;
      }

      const res = updateMilestone(
        milestoneToEdit.id,
        {
          title: cleanTitle,
          description,
          planned_date: plannedDate,
          status,
          phase_label: phaseLabel,
          support_required: supportRequired,
          notes,
        },
        isRescheduled ? rescheduleReason : undefined
      );

      if (!res.success) {
        setErrorMsg(res.message);
        return;
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col animate-scaleIn">
        {/* Header */}
        <div className="bg-emerald-950 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Target className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {isEditing ? 'Edit PoC Milestone' : 'Add New Milestone'}
              </h3>
              <p className="text-xs text-emerald-300">
                {isEditing ? 'Pre-loaded or custom milestone' : 'Syncs live to all team devices'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Phase & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Phase Label
              </label>
              <input
                type="text"
                value={phaseLabel}
                onChange={(e) => setPhaseLabel(e.target.value)}
                placeholder="e.g. Month 1"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Milestone Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ground reality & sensor setup"
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Scope & Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Key objectives, lab milestones, and Plant Lipids expectations..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          {/* Planned Date & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Planned Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={plannedDate}
                onChange={(e) => setPlannedDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as MilestoneStatus)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
              >
                <option value="Not Started">Not Started</option>
                <option value="In Progress">In Progress</option>
                <option value="Blocked">Blocked</option>
                <option value="Done">Done</option>
              </select>
            </div>
          </div>

          {/* Reschedule Reason Prompt (if date changed) */}
          {isRescheduled && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 space-y-2 animate-fadeIn">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Planned Date Change Detected</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                The original planned date (<strong>{milestoneToEdit?.original_planned_date}</strong>)
                will be kept. A "Rescheduled" badge and an entry in date history will be logged.
              </p>
              <div>
                <label className="block text-[11px] font-semibold text-amber-950 mb-1">
                  Reason for Rescheduling (Optional)
                </label>
                <input
                  type="text"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Lab sensor shipment delayed by 5 days"
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-amber-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          )}

          {/* Support Required */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1 flex items-center justify-between">
              <span>Support Required from Plant Lipids / Mentors</span>
              <span className="text-[10px] text-stone-400 font-normal">Optional</span>
            </label>
            <input
              type="text"
              value={supportRequired}
              onChange={(e) => setSupportRequired(e.target.value)}
              placeholder="e.g. Warehouse access clearance, HPLC testing reference batches"
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 focus:outline-none focus:ring-2 focus:ring-emerald-700"
            />
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Internal Technical Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Sensor protocols, sample IDs, bench tests..."
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
              {isEditing ? 'Save Changes' : 'Create Milestone'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
