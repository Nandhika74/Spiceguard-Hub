import React, { useState } from 'react';
import { Task, DocumentCategory } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import { uploadDocumentFile } from '../../lib/storage';
import { CheckCircle2, Calendar, FileText, Upload, X, AlertCircle } from 'lucide-react';

interface TaskCompletionModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
}

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({ task, isOpen, onClose }) => {
  const { completeTaskWithDetails, addDocument, documents, workspace } = useRealtimeStore();

  const [completionDate, setCompletionDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [details, setDetails] = useState('');
  const [linkDocOption, setLinkDocOption] = useState<'none' | 'existing' | 'new'>('none');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docCategory, setDocCategory] = useState<DocumentCategory>('Plant Lipids data');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (task) {
      setCompletionDate(task.completion_date || new Date().toISOString().split('T')[0]);
      setDetails(task.completion_details || '');
      if (task.completion_document_id) {
        setLinkDocOption('existing');
        setSelectedDocId(task.completion_document_id);
      } else {
        setLinkDocOption('none');
        setSelectedDocId('');
      }
      setUploadFile(null);
      setErrorMsg(null);
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      let linkedDocId: string | undefined = undefined;
      let linkedDocTitle: string | undefined = undefined;

      if (linkDocOption === 'existing' && selectedDocId) {
        const doc = documents.find((d) => d.id === selectedDocId);
        if (doc) {
          linkedDocId = doc.id;
          linkedDocTitle = doc.title;
        }
      } else if (linkDocOption === 'new' && uploadFile) {
        const uniqueDocId = `doc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        let fileUrl = URL.createObjectURL(uploadFile);

        if (isSupabaseConfigured() && workspace?.id) {
          const res = await uploadDocumentFile(workspace.id, uniqueDocId, uploadFile);
          if (res.error || !res.path) {
            setErrorMsg(res.error || 'Failed to upload document.');
            setIsSubmitting(false);
            return;
          }
          fileUrl = res.path;
        }

        const docTitle = uploadFile.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ') || task.title;
        const addDocRes = await addDocument({
          title: docTitle,
          description: `Completion report/data for task: "${task.title}". Date: ${completionDate}. Notes: ${details.slice(0, 80)}`,
          category: docCategory,
          tags: ['task-completion', 'report'],
          file_url: fileUrl,
          file_name: uploadFile.name,
          file_size: uploadFile.size,
          file_type: uploadFile.type || 'application/octet-stream',
          attachments: [
            {
              name: uploadFile.name,
              url: fileUrl,
              size: uploadFile.size,
              type: uploadFile.type || 'application/octet-stream',
            },
          ],
          is_external_link: false,
          milestone_id: task.milestone_id,
        });

        if (addDocRes.success && addDocRes.document) {
          linkedDocId = addDocRes.document.id;
          linkedDocTitle = addDocRes.document.title;
        }
      }

      completeTaskWithDetails(task.id, {
        completion_date: completionDate,
        completion_details: details,
        completion_document_id: linkedDocId,
        completion_document_title: linkedDocTitle,
      });

      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save task completion.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden my-6 animate-scaleIn flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-emerald-950 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Mark Task as Complete</h3>
              <p className="text-[11px] text-emerald-200 truncate max-w-xs">{task.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-emerald-200 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Actual Execution / Visit Date */}
          <div>
            <label className="block text-xs font-semibold text-stone-800 mb-1">
              Actual Completion / Visit Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="date"
                required
                value={completionDate}
                onChange={(e) => setCompletionDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700 font-medium"
              />
            </div>
            {task.deadline && (
              <p className="text-[10px] text-stone-400 mt-1">
                Planned deadline was: <strong className="text-stone-600">{task.deadline}</strong>. You can specify the exact date when the lab setup, visit or analysis was completed (e.g. Nov 6).
              </p>
            )}
          </div>

          {/* Completion Details & Findings */}
          <div>
            <label className="block text-xs font-semibold text-stone-800 mb-1">
              Completion Details & Observations
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g., Completed on-site visit to Plant Lipids extraction unit. Inspected sensor baseline, collected 12 fresh curcumin sample curves..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700 resize-none"
            />
          </div>

          {/* Link / Upload Document Section */}
          <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-800 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-800" />
                Attach / Link Research Document
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-stone-200/60 text-[11px] font-medium text-stone-600">
              <button
                type="button"
                onClick={() => setLinkDocOption('none')}
                className={`py-1 rounded-md transition ${linkDocOption === 'none' ? 'bg-white text-emerald-950 font-bold shadow-2xs' : 'hover:text-stone-900'}`}
              >
                No document
              </button>
              <button
                type="button"
                onClick={() => setLinkDocOption('new')}
                className={`py-1 rounded-md transition ${linkDocOption === 'new' ? 'bg-white text-emerald-950 font-bold shadow-2xs' : 'hover:text-stone-900'}`}
              >
                Upload new file
              </button>
              <button
                type="button"
                onClick={() => setLinkDocOption('existing')}
                className={`py-1 rounded-md transition ${linkDocOption === 'existing' ? 'bg-white text-emerald-950 font-bold shadow-2xs' : 'hover:text-stone-900'}`}
              >
                Pick from Docs
              </button>
            </div>

            {linkDocOption === 'new' && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="file"
                    required
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-emerald-900 file:text-white hover:file:bg-emerald-800 cursor-pointer text-stone-600"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-stone-500 mb-0.5">Category in Documents section:</label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as DocumentCategory)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 bg-white"
                  >
                    <option value="Plant Lipids data">Plant Lipids data</option>
                    <option value="Model/ML">Model/ML</option>
                    <option value="Hardware/Sensors">Hardware/Sensors</option>
                    <option value="Biotech">Biotech</option>
                    <option value="Pitch/Reports">Pitch/Reports</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            )}

            {linkDocOption === 'existing' && (
              <div className="pt-1">
                <select
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 bg-white"
                >
                  <option value="">-- Choose document from workspace --</option>
                  {documents.map((doc) => (
                    <option key={doc.id} value={doc.id}>
                      {doc.title} ({doc.category})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 py-2 text-stone-600 hover:text-stone-900 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Confirm & Complete Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
