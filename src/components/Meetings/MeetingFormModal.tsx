import React, { useState, useEffect } from 'react';
import { Meeting, MeetingType, MeetingActionItem } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { Plus, Trash2, X, AlertCircle, Paperclip, Calendar, Check, FileText, Upload } from 'lucide-react';
import { SEED_MEMBERS } from '../../lib/constants';
import { readFileAsDataUrl } from '../../lib/storage';

interface MeetingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  meetingToEdit?: Meeting | null;
}

const getInitialDateTimeLocal = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const MeetingFormModal: React.FC<MeetingFormModalProps> = ({
  isOpen,
  onClose,
  meetingToEdit,
}) => {
  const { addMeeting, updateMeeting, currentUser, teamMembers, documents } = useRealtimeStore();

  const isEditing = Boolean(meetingToEdit);

  const availableMembers = teamMembers.length > 0 ? teamMembers : SEED_MEMBERS;
  const teamShortNames = availableMembers.map((m) => m.full_name.split(' ')[0]);

  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(getInitialDateTimeLocal());
  const [type, setType] = useState<MeetingType>('Internal review');
  const [selectedAttendees, setSelectedAttendees] = useState<string[]>([currentUser.full_name.split(' ')[0]]);
  const [guestAttendees, setGuestAttendees] = useState('');
  const [agenda, setAgenda] = useState('');
  const [notes, setNotes] = useState('');
  const [keyDecisions, setKeyDecisions] = useState('');
  const [inferencesLearnings, setInferencesLearnings] = useState('');
  const [attachments, setAttachments] = useState<
    Array<{ name: string; url: string; size?: number; document_id?: string }>
  >([]);
  const [attachTab, setAttachTab] = useState<'upload' | 'pick'>('upload');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [isReadingFile, setIsReadingFile] = useState(false);

  // Action Items
  const [actionItems, setActionItems] = useState<
    Array<{ id: string; text: string; assignee: string; due_date: string }>
  >([]);
  const [showAddActionForm, setShowAddActionForm] = useState(false);
  const [newActionText, setNewActionText] = useState('');
  const [newActionAssignee, setNewActionAssignee] = useState(currentUser.full_name);
  const [newActionDueDate, setNewActionDueDate] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (meetingToEdit) {
      setTitle(meetingToEdit.title);
      setMeetingDate(meetingToEdit.meeting_date ? meetingToEdit.meeting_date.substring(0, 16) : getInitialDateTimeLocal());
      setType(meetingToEdit.type);
      setSelectedAttendees(
        (meetingToEdit.attendees || []).map((a) => a.split(' ')[0])
      );
      setGuestAttendees(meetingToEdit.guest_attendees || '');
      setAgenda(meetingToEdit.agenda || '');
      setNotes(meetingToEdit.notes || '');
      setKeyDecisions(meetingToEdit.key_decisions || '');
      setInferencesLearnings(meetingToEdit.inferences_learnings || '');
      setAttachments(meetingToEdit.attachment_urls || []);
      setActionItems(
        (meetingToEdit.action_items || []).map((a) => ({
          id: a.id,
          text: a.text,
          assignee: a.assignee || '',
          due_date: a.due_date || '',
        }))
      );
    } else {
      setTitle('');
      setMeetingDate(getInitialDateTimeLocal());
      setType('Internal review');
      setSelectedAttendees([currentUser.full_name.split(' ')[0]]);
      setGuestAttendees('');
      setAgenda('');
      setNotes('');
      setKeyDecisions('');
      setInferencesLearnings('');
      setAttachments([]);
      setActionItems([]);
      setShowAddActionForm(false);
      setSelectedDocId('');
    }
    setErrorMsg(null);
  }, [meetingToEdit, isOpen, currentUser.full_name]);

  if (!isOpen) return null;

  const toggleAttendee = (shortName: string) => {
    setSelectedAttendees((prev) =>
      prev.includes(shortName) ? prev.filter((n) => n !== shortName) : [...prev, shortName]
    );
  };

  const handleAddActionItem = () => {
    if (!newActionText.trim()) return;
    setActionItems((prev) => [
      ...prev,
      {
        id: 'act-' + Math.random().toString(36).substring(2, 7),
        text: newActionText.trim(),
        assignee: newActionAssignee,
        due_date: newActionDueDate || new Date().toISOString().split('T')[0],
      },
    ]);
    setNewActionText('');
    setShowAddActionForm(false);
  };

  const handleRemoveActionItem = (id: string) => {
    setActionItems((prev) => prev.filter((a) => a.id !== id));
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsReadingFile(true);
    try {
      for (const f of files) {
        let permanentUrl: string;
        try {
          permanentUrl = await readFileAsDataUrl(f);
        } catch {
          permanentUrl = URL.createObjectURL(f);
        }
        setAttachments((prev) => [
          ...prev,
          { name: f.name, url: permanentUrl, size: f.size },
        ]);
      }
    } finally {
      setIsReadingFile(false);
      e.target.value = '';
    }
  };

  const handleLinkExistingDoc = (docId: string) => {
    if (!docId) return;
    const doc = documents.find((d) => d.id === docId);
    if (!doc) return;

    // Check if already attached
    if (attachments.some((a) => a.document_id === doc.id || a.url === doc.file_url)) {
      return;
    }

    setAttachments((prev) => [
      ...prev,
      {
        name: doc.title,
        url: doc.file_url,
        size: doc.file_size,
        document_id: doc.id,
      },
    ]);
    setSelectedDocId('');
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Meeting title is required.');
      return;
    }

    if (!meetingDate) {
      setErrorMsg('Date & time is required.');
      return;
    }

    const formattedActionItems: MeetingActionItem[] = actionItems.map((a) => ({
      id: a.id,
      meeting_id: meetingToEdit ? meetingToEdit.id : '',
      text: a.text,
      assignee: a.assignee,
      due_date: a.due_date,
      converted_task_id: null,
      status: 'pending',
      created_at: new Date().toISOString(),
    }));

    if (isEditing && meetingToEdit) {
      updateMeeting(meetingToEdit.id, {
        title: cleanTitle,
        meeting_date: new Date(meetingDate).toISOString(),
        type,
        attendees: selectedAttendees,
        guest_attendees: guestAttendees,
        agenda,
        notes,
        key_decisions: keyDecisions,
        inferences_learnings: inferencesLearnings,
        attachment_urls: attachments,
        action_items: formattedActionItems,
      });
    } else {
      addMeeting({
        title: cleanTitle,
        meeting_date: new Date(meetingDate).toISOString(),
        type,
        attendees: selectedAttendees,
        guest_attendees: guestAttendees,
        agenda,
        notes,
        key_decisions: keyDecisions,
        inferences_learnings: inferencesLearnings,
        attachment_urls: attachments,
        action_items: formattedActionItems,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden my-6 animate-scaleIn flex flex-col max-h-[92vh]">
        {/* Scrollable Form Body matching image_9e8e7919.png */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Title * */}
          <div>
            <label className="block text-xs font-semibold text-stone-800 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Weekly sync with Plant Lipids"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400"
              required
            />
          </div>

          {/* Date & Time + Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Date & time
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as MeetingType)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium cursor-pointer"
              >
                <option value="Internal review">Internal review</option>
                <option value="Plant Lipids">Plant Lipids</option>
                <option value="Mentor meeting">Mentor meeting</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Attendees matching image_9e8e7919.png */}
          <div>
            <label className="block text-xs font-semibold text-stone-800 mb-1.5">
              Attendees
            </label>
            <div className="flex flex-wrap gap-2 mb-2.5">
              {teamShortNames.map((name) => {
                const isSelected = selectedAttendees.includes(name);
                return (
                  <button
                    type="button"
                    key={name}
                    onClick={() => toggleAttendee(name)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      isSelected
                        ? 'bg-[#164E33] text-white border-[#164E33]'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    {name}
                  </button>
                );
              })}
            </div>

            <input
              type="text"
              value={guestAttendees}
              onChange={(e) => setGuestAttendees(e.target.value)}
              placeholder="Guests (free text), e.g. Dr. Rao, Plant Lipids QA"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400"
            />
          </div>

          {/* Agenda & Notes side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Agenda
              </label>
              <textarea
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400 resize-none"
              />
            </div>
          </div>

          {/* Key decisions & Inferences & learnings side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Key decisions
              </label>
              <textarea
                value={keyDecisions}
                onChange={(e) => setKeyDecisions(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400 resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Inferences & learnings
              </label>
              <textarea
                value={inferencesLearnings}
                onChange={(e) => setInferencesLearnings(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400 resize-none"
              />
            </div>
          </div>

          {/* Action items matching image_9e8e7919.png */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-stone-800">
                Action items
              </label>
              <button
                type="button"
                onClick={() => setShowAddActionForm(!showAddActionForm)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#164E33] hover:text-[#123F29]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {showAddActionForm && (
              <div className="p-3 mb-2.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
                <input
                  type="text"
                  value={newActionText}
                  onChange={(e) => setNewActionText(e.target.value)}
                  placeholder="Action item task description..."
                  className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-200 bg-white"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={newActionAssignee}
                    onChange={(e) => setNewActionAssignee(e.target.value)}
                    className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-stone-200 bg-white"
                  >
                    {teamShortNames.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={newActionDueDate}
                    onChange={(e) => setNewActionDueDate(e.target.value)}
                    className="px-2.5 py-1 text-xs rounded-lg border border-stone-200 bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddActionItem}
                    className="px-3 py-1 bg-[#164E33] text-white rounded-lg text-xs font-semibold"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            {actionItems.length === 0 ? (
              <p className="text-xs text-stone-400">
                No action items yet. They can be converted to tasks later.
              </p>
            ) : (
              <div className="space-y-1.5">
                {actionItems.map((a) => (
                  <div
                    key={a.id}
                    className="p-2 rounded-xl bg-stone-50 border border-stone-200 text-xs flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-stone-800">{a.text}</span>
                      <span className="text-[10px] text-stone-400 ml-2">
                        ({a.assignee} · {a.due_date})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveActionItem(a.id)}
                      className="text-stone-400 hover:text-red-500 p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Attach / Link Documents */}
          <div className="pt-1">
            <label className="block text-xs font-semibold text-stone-800 mb-1.5">
              Attach files & link documents
            </label>

            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setAttachTab('upload')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  attachTab === 'upload'
                    ? 'bg-[#164E33] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Upload file
              </button>
              <button
                type="button"
                onClick={() => setAttachTab('pick')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  attachTab === 'pick'
                    ? 'bg-[#164E33] text-white shadow-xs'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                Pick from Docs ({documents.length})
              </button>
            </div>

            {attachTab === 'upload' ? (
              <div className="relative inline-block">
                <input
                  type="file"
                  multiple
                  onChange={handleFileAttach}
                  disabled={isReadingFile}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  disabled={isReadingFile}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-700 transition"
                >
                  <Paperclip className="w-3.5 h-3.5 text-stone-400" />
                  <span>{isReadingFile ? 'Processing file...' : 'Choose files from device'}</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <select
                  value={selectedDocId}
                  onChange={(e) => handleLinkExistingDoc(e.target.value)}
                  className="w-full max-w-md px-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-white font-medium text-stone-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#164E33]"
                >
                  <option value="">-- Choose document from Docs section --</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title} ({doc.category})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {attachments.map((att, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-100 text-xs text-stone-700 border border-stone-200"
                  >
                    {att.document_id ? (
                      <FileText className="w-3 h-3 text-emerald-800" />
                    ) : (
                      <Paperclip className="w-3 h-3 text-stone-400" />
                    )}
                    <span className="truncate max-w-[180px]" title={att.name}>{att.name}</span>
                    {att.document_id && (
                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-medium">
                        Docs
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(i)}
                      className="text-stone-400 hover:text-red-500 ml-0.5 cursor-pointer"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Bar: Cancel and Log Meeting button */}
          <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#164E33] hover:bg-[#123F29] text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              {isEditing ? 'Save changes' : 'Log meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
