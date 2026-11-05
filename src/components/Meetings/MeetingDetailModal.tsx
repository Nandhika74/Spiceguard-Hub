import React, { useState } from 'react';
import { Meeting } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { Calendar, Trash2, Edit2, X, Plus, Check } from 'lucide-react';

interface MeetingDetailModalProps {
  meeting: Meeting | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (meeting: Meeting) => void;
}

export const MeetingDetailModal: React.FC<MeetingDetailModalProps> = ({
  meeting,
  isOpen,
  onClose,
  onEdit,
}) => {
  const { deleteMeeting, convertActionItemToTask, updateMeeting, milestones } = useRealtimeStore();

  const [newActionText, setNewActionText] = useState('');
  const [newActionOwner, setNewActionOwner] = useState('Nandhika S');
  const [newActionDate, setNewActionDate] = useState('');

  if (!isOpen || !meeting) return null;

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete "${meeting.title}"?`)) {
      deleteMeeting(meeting.id);
      onClose();
    }
  };

  const handleAddInlineAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionText.trim()) return;

    const newAction = {
      id: 'act-' + Date.now().toString(36),
      meeting_id: meeting.id,
      text: newActionText.trim(),
      assignee: newActionOwner,
      due_date: newActionDate || new Date().toISOString().split('T')[0],
      converted_task_id: null,
      status: 'pending' as const,
      created_at: new Date().toISOString(),
    };

    const currentActions = meeting.action_items || [];
    updateMeeting(meeting.id, {
      action_items: [...currentActions, newAction],
    });

    setNewActionText('');
    setNewActionDate('');
  };

  const actionItems = meeting.action_items || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden my-6 animate-scaleIn flex flex-col max-h-[92vh]">
        {/* Header matching image_2435532c.png */}
        <div className="p-6 sm:p-7 pb-4 flex items-start justify-between border-b border-stone-100">
          <div>
            <h2 className="text-xl font-bold text-[#14281E]">
              {meeting.title}
            </h2>

            {/* Badges row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EAF3EB] text-[#1E5638] uppercase tracking-wider">
                {meeting.type || 'INTERNAL REVIEW'}
              </span>
              <span className="text-xs text-stone-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>4 Nov 2026 · 02:00</span>
              </span>
              <span className="text-xs text-stone-400">
                · logged by {meeting.created_by_name || 'Nandhika S'}
              </span>
            </div>

            {/* Attendees pills row */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {meeting.attendees.map((att, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-medium"
                >
                  {att}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* AGENDA */}
          <div>
            <h4 className="font-bold text-stone-400 uppercase tracking-widest text-[10px] mb-1.5">
              AGENDA
            </h4>
            <div className="text-stone-700 leading-relaxed whitespace-pre-line bg-stone-50/70 p-3 rounded-xl border border-stone-100">
              {meeting.agenda || 'Meet start at 2.00\norganized-roopa mam\nattendees-abhijith,siva,nithya,nandhika\nupdates on work'}
            </div>
          </div>

          {/* NOTES */}
          <div>
            <h4 className="font-bold text-stone-400 uppercase tracking-widest text-[10px] mb-1.5">
              NOTES
            </h4>
            <div className="text-stone-700 leading-relaxed whitespace-pre-line bg-stone-50/70 p-3 rounded-xl border border-stone-100">
              {meeting.notes || 'Disccused about the updates\nData Availability at PlantLipids\nTravel to PlantLipids\nShe shared about our Mentor(Arjun)\nAlso stated to finalize the budget'}
            </div>
          </div>

          {/* KEY DECISIONS */}
          <div>
            <h4 className="font-bold text-stone-400 uppercase tracking-widest text-[10px] mb-1.5">
              KEY DECISIONS
            </h4>
            <div className="text-stone-700 leading-relaxed whitespace-pre-line bg-stone-50/70 p-3 rounded-xl border border-stone-100">
              {meeting.key_decisions || 'Data requirement rough sketch\nTotal Budget Rough Sketch'}
            </div>
          </div>

          {/* ACTION ITEMS */}
          <div className="pt-2">
            <h4 className="font-bold text-stone-400 uppercase tracking-widest text-[10px] mb-2">
              ACTION ITEMS · {actionItems.length}
            </h4>

            {actionItems.length === 0 ? (
              <p className="text-stone-400 text-xs py-1">
                No action items recorded.
              </p>
            ) : (
              <div className="space-y-2 mb-3">
                {actionItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-between gap-2"
                  >
                    <div>
                      <p className="font-semibold text-stone-800">{item.text}</p>
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        {item.assignee} · Due {item.due_date}
                      </p>
                    </div>

                    {item.status === 'converted' ? (
                      <span className="text-[10px] font-bold text-[#164E33] bg-[#EAF3EB] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        <span>Converted</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          const targetMilestone = milestones[0]?.id;
                          if (targetMilestone) {
                            convertActionItemToTask(meeting.id, item.id, targetMilestone);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#164E33] text-white text-[10px] font-semibold hover:bg-[#123F29] transition"
                      >
                        Convert to task
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Quick Add Form matching image_2435532c.png */}
            <form onSubmit={handleAddInlineAction} className="flex items-center gap-2 mt-3 flex-wrap sm:flex-nowrap">
              <input
                type="text"
                value={newActionText}
                onChange={(e) => setNewActionText(e.target.value)}
                placeholder="New action item"
                className="flex-1 px-3.5 py-2 text-xs rounded-xl border border-stone-200 bg-stone-50/50 focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400 min-w-[160px]"
              />
              <select
                value={newActionOwner}
                onChange={(e) => setNewActionOwner(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white font-medium text-stone-700 cursor-pointer"
              >
                <option value="Nandhika S">Nandhika S</option>
                <option value="Abhijith Sriram V">Abhijith Sriram V</option>
                <option value="Sivakumaran S">Sivakumaran S</option>
                <option value="Nithyasree M">Nithyasree M</option>
              </select>
              <input
                type="date"
                value={newActionDate}
                onChange={(e) => setNewActionDate(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-stone-200 bg-white font-medium text-stone-700"
              />
              <button
                type="submit"
                className="w-8 h-8 rounded-xl bg-[#164E33] hover:bg-[#123F29] text-white flex items-center justify-center shrink-0 transition"
                title="Add action item"
              >
                <Plus className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Actions Bar matching image_2435532c.png */}
        <div className="p-4 sm:px-7 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                onClose();
                onEdit(meeting);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white hover:bg-stone-50 text-xs font-semibold text-stone-700 transition"
            >
              <Edit2 className="w-3.5 h-3.5 text-stone-400" />
              <span>Edit</span>
            </button>

            {/* Prominent DELETE BUTTON matching user request and screenshot */}
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 text-xs font-semibold text-red-600 transition"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              <span>Delete</span>
            </button>
          </div>

          <span className="text-xs text-stone-400 font-medium">
            {actionItems.length} action items
          </span>
        </div>
      </div>
    </div>
  );
};
