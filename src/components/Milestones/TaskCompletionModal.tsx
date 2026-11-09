import React, { useState, useEffect } from 'react';
import { Task, DocumentCategory } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import { uploadDocumentFile, readFileAsDataUrl } from '../../lib/storage';
import { generateUuid } from '../../lib/realtimeStore';
import {
  CheckCircle2,
  Calendar,
  FileText,
  Upload,
  X,
  AlertCircle,
  FileCheck,
  Trash2,
  FileUp,
  Loader2,
} from 'lucide-react';

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
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchronize initial state ONLY when opening or switching tasks.
  // CRITICAL: Do NOT depend on the raw task object reference, or the 4.5s
  // background polling sync will continuously wipe user typing and attached files!
  useEffect(() => {
    if (!isOpen || !task) return;
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
    setIsSubmitting(false);
    setIsSuccess(false);
  }, [isOpen, task?.id]);

  if (!isOpen || !task) return null;

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || isSubmitting || isSuccess) return;
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
        const uniqueDocId = generateUuid();
        let fileUrl: string;

        try {
          if (isSupabaseConfigured() && workspace?.id) {
            const res = await uploadDocumentFile(workspace.id, uniqueDocId, uploadFile);
            fileUrl = res.path || (await readFileAsDataUrl(uploadFile));
          } else {
            fileUrl = await readFileAsDataUrl(uploadFile);
          }
        } catch (storageErr) {
          console.warn('[TaskCompletionModal] Storage error fallback to data URL:', storageErr);
          fileUrl = await readFileAsDataUrl(uploadFile);
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

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setIsSubmitting(false);
        onClose();
      }, 450);
    } catch (err: any) {
      console.error('[TaskCompletionModal] Save error:', err);
      setErrorMsg(err?.message || 'Failed to save task completion.');
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting && !isSuccess) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden my-6 animate-scaleIn flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-stone-100 flex items-center justify-between bg-emerald-950 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">
                {task.status === 'Done' ? 'Edit Completion Details' : 'Mark Task as Complete'}
              </h3>
              <p className="text-[11px] text-emerald-200 truncate max-w-xs">{task.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting || isSuccess}
            className="text-emerald-200 hover:text-white disabled:opacity-30 p-1 rounded-md transition"
          >
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
              <Calendar className="w-4 h-4 text-stone-400 absolute left-3 top-2.5 pointer-events-none" />
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
                Planned deadline was: <strong className="text-stone-600">{task.deadline}</strong>. You can record the actual date when this work or visit took place.
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
              placeholder="e.g., Completed on-site visit to Plant Lipids extraction unit. Baseline sensor calibrations verified, raw curcumin batches recorded..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700 resize-none"
            />
          </div>

          {/* Link / Upload Document Section */}
          <div className="p-3.5 rounded-xl border border-stone-200 bg-stone-50 space-y-3">
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
                className={`py-1.5 rounded-md transition text-center ${
                  linkDocOption === 'none'
                    ? 'bg-white text-emerald-950 font-bold shadow-xs'
                    : 'hover:text-stone-900'
                }`}
              >
                No document
              </button>
              <button
                type="button"
                onClick={() => setLinkDocOption('new')}
                className={`py-1.5 rounded-md transition text-center ${
                  linkDocOption === 'new'
                    ? 'bg-white text-emerald-950 font-bold shadow-xs'
                    : 'hover:text-stone-900'
                }`}
              >
                Upload new file
              </button>
              <button
                type="button"
                onClick={() => setLinkDocOption('existing')}
                className={`py-1.5 rounded-md transition text-center ${
                  linkDocOption === 'existing'
                    ? 'bg-white text-emerald-950 font-bold shadow-xs'
                    : 'hover:text-stone-900'
                }`}
              >
                Pick from Docs
              </button>
            </div>

            {linkDocOption === 'new' && (
              <div className="space-y-2.5 pt-1">
                {!uploadFile ? (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-stone-300 hover:border-emerald-700 rounded-xl p-4 bg-white cursor-pointer transition hover:bg-emerald-50/20 group">
                    <FileUp className="w-7 h-7 text-stone-400 group-hover:text-emerald-700 mb-1.5 transition" />
                    <span className="text-xs font-semibold text-stone-700 group-hover:text-emerald-900">
                      Click to choose document or lab file
                    </span>
                    <span className="text-[10px] text-stone-400 mt-0.5">
                      PDF, Excel (.xlsx, .csv), Word (.docx), sensor readings or images
                    </span>
                    <input
                      type="file"
                      required
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setUploadFile(file);
                      }}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-emerald-200/70 text-emerald-900 flex items-center justify-center shrink-0">
                        <FileCheck className="w-5 h-5 text-emerald-800" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate max-w-[240px] text-emerald-950">
                          {uploadFile.name}
                        </p>
                        <p className="text-[10px] text-emerald-700 flex items-center gap-2">
                          <span>{formatFileSize(uploadFile.size)}</span>
                          <span className="inline-block w-1 h-1 rounded-full bg-emerald-400"></span>
                          <span className="font-semibold text-emerald-800">Loaded & ready</span>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadFile(null)}
                      className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Remove or choose a different file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-medium text-stone-600 mb-1">
                    Store under Category in Documents section:
                  </label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value as DocumentCategory)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
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
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-stone-300 bg-white focus:outline-none focus:ring-1 focus:ring-emerald-700"
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

          {/* Progress / Status feedback banner */}
          {isSubmitting && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-center gap-2 font-medium animate-fadeIn">
              <Loader2 className="w-4 h-4 text-emerald-700 animate-spin shrink-0" />
              <span>
                {uploadFile
                  ? `Uploading "${uploadFile.name}" & saving...`
                  : 'Saving task completion details...'}
              </span>
            </div>
          )}

          {isSuccess && (
            <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-950 flex items-center justify-center gap-2 font-bold animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>Task completed & saved! Closing...</span>
            </div>
          )}

          {/* Footer buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting || isSuccess}
              className="px-3.5 py-2 text-stone-600 hover:text-stone-900 disabled:opacity-40 text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isSuccess || (linkDocOption === 'new' && !uploadFile)}
              className="px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : isSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>Done!</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save & Confirm Details</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

