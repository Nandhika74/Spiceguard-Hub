import React, { useState } from 'react';
import { Meeting, MeetingType, MeetingActionItem } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { formatDate, formatDateTime, timeAgo } from '../../lib/dateUtils';
import { SEED_MEMBERS } from '../../lib/constants';
import { MeetingFormModal } from './MeetingFormModal';
import {
  Plus,
  Search,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit2,
  Paperclip,
  Check,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  ArrowRight,
} from 'lucide-react';

import { MeetingDetailModal } from './MeetingDetailModal';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { DocumentPreviewModal } from '../Documents/DocumentPreviewModal';

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

export const MeetingsView: React.FC = () => {
  const {
    meetings,
    milestones,
    deleteMeeting,
    convertActionItemToTask,
    currentUser,
    isTeamLead,
    teamMembers,
    documents,
  } = useRealtimeStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [meetingToEdit, setMeetingToEdit] = useState<Meeting | null>(null);
  const [detailMeeting, setDetailMeeting] = useState<Meeting | null>(null);
  const [meetingToDelete, setMeetingToDelete] = useState<Meeting | null>(null);
  const [previewDoc, setPreviewDoc] = useState<any | null>(null);

  // Milestone selection for converting action items
  const [selectedMilestoneForConvert, setSelectedMilestoneForConvert] = useState<Record<string, string>>({});
  const [convertSuccessToast, setConvertSuccessToast] = useState<string | null>(null);

  // Expanded meetings state (default expanded if only 1, or toggleable)
  const [expandedMeetingIds, setExpandedMeetingIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedMeetingIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const filteredMeetings = meetings.filter((m) => {
    if (typeFilter !== 'all' && m.type !== typeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        m.title.toLowerCase().includes(q) ||
        (m.agenda || '').toLowerCase().includes(q) ||
        (m.key_decisions || '').toLowerCase().includes(q) ||
        (m.inferences_learnings || '').toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q) ||
        m.attendees.some((a) => a.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const handleConvertActionItem = (meetingId: string, actionItem: MeetingActionItem) => {
    const targetMilestoneId = selectedMilestoneForConvert[actionItem.id] || milestones[0]?.id;
    if (!targetMilestoneId) {
      alert('Please select a milestone first.');
      return;
    }

    const res = convertActionItemToTask(meetingId, actionItem.id, targetMilestoneId);
    if (res.success) {
      setConvertSuccessToast(res.message);
      setTimeout(() => setConvertSuccessToast(null), 3500);
    } else {
      alert(res.message);
    }
  };

  const getBadgeStyle = (type: MeetingType) => {
    switch (type) {
      case 'Internal review':
        return 'bg-[#EFF6FF] text-[#2563EB]';
      case 'Plant Lipids':
        return 'bg-[#FEF3EB] text-[#D96B1C]';
      case 'Mentor meeting':
        return 'bg-[#F3E8FF] text-[#7E22CE]';
      default:
        return 'bg-stone-100 text-stone-600';
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-12 max-w-5xl">
      {/* Toast Notification for Converted Task */}
      {convertSuccessToast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-50 bg-[#164E33] text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-semibold animate-slideUp">
          <CheckCircle2 className="w-4 h-4 text-emerald-300" />
          <span>{convertSuccessToast}</span>
        </div>
      )}

      {/* Header matching image_5523de88.png */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Meetings & inferences</h2>
          <p className="text-xs text-stone-500">
            {meetings.length} logs · 1 this month
          </p>
        </div>

        <button
          onClick={() => {
            setMeetingToEdit(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#164E33] hover:bg-[#123F29] text-white text-xs font-semibold shadow-xs transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Log meeting</span>
        </button>
      </div>

      {/* Search and Filter bar matching image_5523de88.png */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search meetings, decisions, learnings..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400 shadow-2xs"
          />
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3.5 py-2 text-xs rounded-xl bg-white border border-stone-200 font-medium text-stone-700 focus:outline-none shadow-2xs cursor-pointer min-w-[120px]"
        >
          <option value="all">All types</option>
          <option value="Internal review">Internal review</option>
          <option value="Plant Lipids">Plant Lipids</option>
          <option value="Mentor meeting">Mentor meeting</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Meetings List matching image_5523de88.png */}
      <div className="space-y-4">
        {filteredMeetings.length === 0 ? (
          <div className="py-16 text-center text-stone-400 bg-white rounded-3xl border border-stone-200">
            <Calendar className="w-10 h-10 mx-auto text-stone-300 mb-2" />
            <p className="text-sm font-semibold text-stone-600">No meeting logs found.</p>
            <p className="text-xs text-stone-400 mt-1">
              Click &quot;Log meeting&quot; to record meeting notes, inferences, and decisions.
            </p>
          </div>
        ) : (
          filteredMeetings.map((meeting) => {
            const isExpanded = Boolean(expandedMeetingIds[meeting.id]);
            const isCreatorOrLead =
              isTeamLead || meeting.created_by.toLowerCase() === currentUser.email.toLowerCase();
            const actionCount = meeting.action_items?.length || 0;

            // Extract dynamic attendee details
            const attendeesList = (meeting.attendees || []).map((att) =>
              getMemberDetails(att, teamMembers)
            );
            const attendeeCount = meeting.attendees?.length || 0;

            return (
              <div
                key={meeting.id}
                className="rounded-2xl bg-white border border-[#E2E8E0] p-5 sm:p-6 shadow-xs hover:border-[#164E33]/30 transition"
              >
                {/* Top Row: Type Pill and Actions Pill */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded ${getBadgeStyle(
                      meeting.type
                    )}`}
                  >
                    {meeting.type}
                  </span>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                      {actionCount} actions
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setMeetingToEdit(meeting);
                          setModalOpen(true);
                        }}
                        className="p-1 text-stone-400 hover:text-stone-700 rounded-md transition"
                        title="Edit Meeting"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setMeetingToDelete(meeting)}
                        className="p-1 text-stone-400 hover:text-red-600 rounded-md transition cursor-pointer"
                        title="Delete Meeting"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Meeting Title */}
                <h3
                  onClick={() => setDetailMeeting(meeting)}
                  className="text-base font-bold text-[#14281E] mt-2.5 cursor-pointer hover:text-[#164E33] transition"
                >
                  {meeting.title}
                </h3>

                {/* Date & Time */}
                <p className="text-xs text-stone-500 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  <span>{formatMeetingDateDisplay(meeting.meeting_date)}</span>
                </p>

                {/* Inferences / Topics highlight tag container matching image_5523de88.png */}
                {(meeting.inferences_learnings || meeting.agenda) && (
                  <div className="mt-3">
                    <div className="inline-block bg-[#EAF3EB] text-[#1E5638] text-xs font-medium px-3 py-1.5 rounded-xl leading-relaxed">
                      {meeting.inferences_learnings || meeting.agenda}
                    </div>
                  </div>
                )}

                {/* Footer Row matching image_5523de88.png */}
                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    {/* Overlapping Avatar Stack */}
                    {attendeesList.length > 0 && (
                      <div className="flex items-center -space-x-1.5">
                        {attendeesList.map((a, i) => (
                          <div
                            key={i}
                            title={a.name}
                            className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center border border-white shadow-2xs"
                            style={{ backgroundColor: a.color }}
                          >
                            {a.initials}
                          </div>
                        ))}
                      </div>
                    )}

                    <span className="text-xs text-stone-500 font-medium">
                      {attendeeCount} {attendeeCount === 1 ? 'attendee' : 'attendees'} · by {meeting.created_by_name || 'Team member'}
                    </span>
                  </div>

                  <button
                    onClick={() => toggleExpand(meeting.id)}
                    className="p-1 text-stone-400 hover:text-stone-700 rounded-lg transition"
                    title={isExpanded ? 'Collapse notes' : 'Expand full notes & action items'}
                  >
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <SlidersHorizontal className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Expanded Details Pane */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-stone-100 space-y-4 animate-fadeIn text-xs">
                    {meeting.agenda && (
                      <div>
                        <h4 className="font-bold text-stone-800 uppercase text-[10px] tracking-wider mb-1">
                          Agenda
                        </h4>
                        <p className="text-stone-600 leading-relaxed bg-stone-50/80 p-2.5 rounded-xl border border-stone-100">
                          {meeting.agenda}
                        </p>
                      </div>
                    )}

                    {meeting.notes && (
                      <div>
                        <h4 className="font-bold text-stone-800 uppercase text-[10px] tracking-wider mb-1">
                          Meeting Notes
                        </h4>
                        <p className="text-stone-600 leading-relaxed bg-stone-50/80 p-2.5 rounded-xl border border-stone-100">
                          {meeting.notes}
                        </p>
                      </div>
                    )}

                    {meeting.key_decisions && (
                      <div>
                        <h4 className="font-bold text-stone-800 uppercase text-[10px] tracking-wider mb-1">
                          Key Decisions
                        </h4>
                        <p className="text-stone-600 leading-relaxed bg-stone-50/80 p-2.5 rounded-xl border border-stone-100 whitespace-pre-line">
                          {meeting.key_decisions}
                        </p>
                      </div>
                    )}

                    {/* Action Items List */}
                    {meeting.action_items && meeting.action_items.length > 0 && (
                      <div>
                        <h4 className="font-bold text-stone-800 uppercase text-[10px] tracking-wider mb-2">
                          Action Items ({meeting.action_items.length})
                        </h4>
                        <div className="space-y-2">
                          {meeting.action_items.map((ai) => (
                            <div
                              key={ai.id}
                              className="p-3 rounded-xl bg-stone-50 border border-stone-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                            >
                              <div className="space-y-0.5">
                                <p className="font-semibold text-stone-900">{ai.text}</p>
                                <p className="text-[10px] text-stone-400">
                                  Assignee: <strong>{ai.assignee || 'Unassigned'}</strong> • Due:{' '}
                                  {ai.due_date ? formatDate(ai.due_date) : 'Not specified'}
                                </p>
                              </div>

                              <div>
                                {ai.status === 'converted' ? (
                                  <span className="text-[10px] font-bold text-[#164E33] bg-[#EAF3EB] px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    <span>Converted to Task</span>
                                  </span>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={selectedMilestoneForConvert[ai.id] || milestones[0]?.id || ''}
                                      onChange={(e) =>
                                        setSelectedMilestoneForConvert((prev) => ({
                                          ...prev,
                                          [ai.id]: e.target.value,
                                        }))
                                      }
                                      className="text-[11px] py-1 px-2 rounded-lg border border-stone-200 bg-white"
                                    >
                                      {milestones.map((m) => (
                                        <option key={m.id} value={m.id}>
                                          {m.phase_label || m.title.substring(0, 20)}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => handleConvertActionItem(meeting.id, ai)}
                                      className="px-2.5 py-1 rounded-lg bg-[#164E33] hover:bg-[#123F29] text-white text-[11px] font-semibold transition"
                                    >
                                      Convert
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Attachments */}
                    {meeting.attachment_urls && meeting.attachment_urls.length > 0 && (
                      <div>
                        <h4 className="font-bold text-stone-800 uppercase text-[10px] tracking-wider mb-1.5">
                          Attached Files & Linked Docs ({meeting.attachment_urls.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
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
                              <button
                                key={i}
                                type="button"
                                onClick={handleOpenAttachment}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 hover:bg-emerald-50 hover:text-emerald-900 border border-stone-200 text-stone-700 text-xs transition cursor-pointer"
                                title="Click to preview attachment"
                              >
                                <Paperclip className="w-3.5 h-3.5 text-stone-400 group-hover:text-emerald-700" />
                                <span>{att.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Meeting Detail Modal matching image_2435532c.png */}
      <MeetingDetailModal
        meeting={detailMeeting}
        isOpen={Boolean(detailMeeting)}
        onClose={() => setDetailMeeting(null)}
        onEdit={(m) => {
          setDetailMeeting(null);
          setMeetingToEdit(m);
          setModalOpen(true);
        }}
      />

      {/* Modal matching image_9e8e7919.png */}
      <MeetingFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        meetingToEdit={meetingToEdit}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(meetingToDelete)}
        title="Delete Meeting Log"
        message={`Are you sure you want to delete "${meetingToDelete?.title}"? This action cannot be undone.`}
        confirmLabel="Delete Meeting"
        onConfirm={() => {
          if (meetingToDelete) {
            deleteMeeting(meetingToDelete.id);
            setMeetingToDelete(null);
          }
        }}
        onCancel={() => setMeetingToDelete(null)}
      />

      {/* Document Preview Modal */}
      <DocumentPreviewModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
};
