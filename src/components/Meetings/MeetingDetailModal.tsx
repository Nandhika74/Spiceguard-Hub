import React, { useState } from 'react';
import { Meeting } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { Calendar, Trash2, Edit2, X, Plus, Check, Paperclip, FileText, ExternalLink } from 'lucide-react';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { DocumentPreviewModal } from '../Documents/DocumentPreviewModal';
import { generateUuid } from '../../lib/realtimeStore';
import { SEED_MEMBERS } from '../../lib/constants';

const getMemberDetails = (nameOrEmail: string, teamMembers: any[]) => {
  const q = nameOrEmail.toLowerCase().trim();
  const found =
    teamMembers.find(
      (m) =>
        m.email.toLowerCase() === q ||
        m.full_name.toLowerCase() === q ||
        m.full_name.toLowerCase().includes(q) ||
        q.includes(m.full_name.toLowerCase().split(' ')[0])
    ) ||
    SEED_MEMBERS.find(
      (m) =>
        m.email.toLowerCase() === q ||
        m.full_name.toLowerCase() === q ||
        m.full_name.toLowerCase().includes(q) ||
        q.includes(m.full_name.toLowerCase().split(' ')[0])
    );

  if (found) {
    const parts = found.full_name.split(' ');
    const initials =
      parts.length > 1
        ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
        : parts[0].substring(0, 2).toUpperCase();
    return {
      name: found.full_name,
      shortName: parts[0],
      initials,
      color: found.avatar_color || '#164E33',
    };
  }

  const clean = nameOrEmail.trim();
  const initials = clean.length >= 2 ? clean.substring(0, 2).toUpperCase() : clean.toUpperCase();
  return {
    name: clean,
    shortName: clean,
    initials,
    color: '#4B5563',
  };
};

const formatMeetingDateDisplay = (dateString?: string | null) => {
  if (!dateString) return 'Not set';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = d.getDate();
    const month = d.toLocaleDateString('en-US', { month: 'short' });
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year} · ${hours}:${minutes}`;
  } catch {
    return dateString;
  }
};

const formatFileSize = (bytes?: number | null) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

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
  const { deleteMeeting, convertActionItemToTask, updateMeeting, milestones, teamMembers, documents } = useRealtimeStore();

  const [newActionText, setNewActionText] = useState('');
  const [newActionOwner, setNewActionOwner] = useState('Nandhika S');
  const [newActionDate, setNewActionDate] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  if (!isOpen || !meeting) return null;

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleAddInlineAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActionText.trim()) return;

    const newAction = {
      id: generateUuid(),
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
                <span>{formatMeetingDateDisplay(meeting.meeting_date)}</span>
              </span>
              <span className="text-xs text-stone-400">
                · logged by {meeting.created_by_name || meeting.created_by || 'Team member'}
              </span>
            </div>

            {/* Attendees pills row */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {(meeting.attendees || []).map((att, i) => {
                const details = getMemberDetails(att, teamMembers);
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-medium"
                  >
                    <span
                      className="w-4 h-4 rounded-full text-white text-[8px] font-bold flex items-center justify-center"
                      style={{ backgroundColor: details.color }}
                    >
                      {details.initials}
                    </span>
                    <span>{details.name}</span>
                  </span>
                );
              })}
              {meeting.guest_attendees && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200/60 text-xs font-medium">
                  <span>Guests: {meeting.guest_attendees}</span>
                </span>
              )}
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
          {/* INFERENCES & LEARNINGS */}
          {meeting.inferences_learnings && (
            <div>
              <h4 className="font-bold text-stone-400 uppercase tracking-widest text-[10px] mb-1.5">
                INFERENCES & LEARNINGS
              </h4>
              <div className="text-[#1E5638] leading-relaxed whitespace-pre-line bg-[#EAF3EB] p-3 rounded-xl border border-[#D5E8D8] font-medium">
                {meeting.inferences_learnings}
              </div>
            </div>
          )}

          {/* AGENDA */}
          <div>
            <h4 className="font-bold text-stone-400 uppercase tracking-widest text-[10px] mb-1.5">
              AGENDA
            </h4>
            <div className="text-stone-700 leading-relaxed whitespace-pre-line bg-stone-50/70 p-3 rounded-xl border border-stone-100">
              {meeting.agenda ? (
                meeting.agenda
              ) : (
                <span className="text-stone-400 italic">No agenda specified for this meeting.</span>
              )}
            </div>
          </div>

          {/* NOTES */}
          <div>
            <h4 className="font-bold text-stone-400 uppercase tracking-widest text-[10px] mb-1.5">
              NOTES
            </h4>
            <div className="text-stone-700 leading-relaxed whitespace-pre-line bg-stone-50/70 p-3 rounded-xl border border-stone-100">
              {meeting.notes ? (
                meeting.notes
              ) : (
                <span className="text-stone-400 italic">No meeting notes recorded.</span>
              )}
            </div>
          </div>

          {/* KEY DECISIONS */}
          <div>
            <h4 className="font-bold text-stone-400 uppercase tracking-widest text-[10px] mb-1.5">
              KEY DECISIONS
            </h4>
            <div className="text-stone-700 leading-relaxed whitespace-pre-line bg-stone-50/70 p-3 rounded-xl border border-stone-100">
              {meeting.key_decisions ? (
                meeting.key_decisions
              ) : (
                <span className="text-stone-400 italic">No key decisions recorded.</span>
              )}
            </div>
          </div>

          {/* ATTACHED FILES & LINKED DOCUMENTS */}
          {meeting.attachment_urls && meeting.attachment_urls.length > 0 && (
            <div className="pt-1">
              <h4 className="font-bold text-stone-400 uppercase tracking-widest text-[10px] mb-2 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-stone-400" />
                <span>ATTACHED FILES & LINKED DOCS ({meeting.attachment_urls.length})</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {meeting.attachment_urls.map((att, i) => {
                  const handleOpenAttachment = () => {
                    const matchingDoc = documents.find(
                      (d) =>
                        d.id === (att as any).document_id ||
                        d.title.toLowerCase() === att.name.toLowerCase() ||
                        d.file_url === att.url
                    );
                    if (matchingDoc) {
                      setPreviewDoc(matchingDoc);
                    } else {
                      setPreviewDoc({
                        id: (att as any).document_id || `att-${meeting.id}-${i}`,
                        title: att.name,
                        file_name: att.name,
                        file_url: att.url,
                        file_size: att.size,
                        category: 'Plant Lipids data',
                        tags: ['Meeting Attachment'],
                        is_external_link: false,
                        uploaded_by: meeting.created_by,
                        uploaded_by_name: meeting.created_by_name || 'Team member',
                        created_at: meeting.created_at,
                        updated_at: meeting.updated_at,
                      });
                    }
                  };

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-200 hover:border-emerald-600 transition group"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-emerald-800 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-stone-800 truncate max-w-[190px]" title={att.name}>
                            {att.name}
                          </p>
                          {att.size ? (
                            <p className="text-[10px] text-stone-400">{formatFileSize(att.size)}</p>
                          ) : null}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenAttachment}
                        className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition shrink-0 cursor-pointer"
                      >
                        Preview
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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

      <ConfirmDeleteModal
        isOpen={showDeleteConfirm}
        title="Delete Meeting Log"
        message={`Are you sure you want to delete "${meeting.title}"? This action cannot be undone.`}
        confirmLabel="Delete Meeting"
        onConfirm={() => {
          deleteMeeting(meeting.id);
          setShowDeleteConfirm(false);
          onClose();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <DocumentPreviewModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
};
