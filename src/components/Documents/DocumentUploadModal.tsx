import React, { useState, useEffect } from 'react';
import { DocumentItem, DocumentCategory } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { isSupabaseConfigured } from '../../lib/supabase';
import {
  uploadDocumentFile,
  readFileAsDataUrl,
  isBlobUrl,
  getSignedDocumentUrl,
  deleteDocumentFile,
} from '../../lib/storage';
import {
  Upload,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  FileText,
  Eye,
  Download,
} from 'lucide-react';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  docToEdit?: DocumentItem | null;
  onPreviewDocument?: (doc: DocumentItem) => void;
}

interface SelectedFileItem {
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  docToEdit,
  onPreviewDocument,
}) => {
  const { addDocument, updateDocument, milestones, workspace } = useRealtimeStore();
  const [isUploading, setIsUploading] = useState(false);

  const isEditing = Boolean(docToEdit);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('Other');
  const [milestoneId, setMilestoneId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<SelectedFileItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (docToEdit) {
      setTitle(docToEdit.title);
      setDescription(docToEdit.description || '');
      setCategory(docToEdit.category);
      setMilestoneId(docToEdit.milestone_id || '');
      setTagsInput(docToEdit.tags?.join(', ') || '');
      setExternalUrl(
        docToEdit.is_external_link && !isBlobUrl(docToEdit.file_url)
          ? docToEdit.file_url || ''
          : ''
      );
      setSelectedFiles([]);
    } else {
      setTitle('');
      setDescription('');
      setCategory('Other');
      setMilestoneId('');
      setTagsInput('');
      setExternalUrl('');
      setSelectedFiles([]);
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setIsUploading(false);
  }, [docToEdit?.id, isOpen]);

  if (!isOpen) return null;

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const MAX_SIZE = 25 * 1024 * 1024;
    for (const f of files) {
      if (f.size > MAX_SIZE) {
        setErrorMsg(`"${f.name}" exceeds the 25 MB file size limit.`);
        return;
      }
    }

    const newItems: SelectedFileItem[] = files.map((file) => ({
      file,
      status: 'pending',
    }));

    setSelectedFiles((prev) => (isEditing ? newItems.slice(0, 1) : [...prev, ...newItems]));
    if (!title && files.length > 0) {
      const cleanName = files[0].name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setTitle(cleanName);
    }
    e.target.value = '';
  };

  const removeSelectedFile = (idx: number) => {
    if (isUploading) return;
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;

    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Title is required.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    setIsUploading(true);

    try {
      if (isEditing && docToEdit) {
        const oldFileUrl = docToEdit.file_url;
        let newFileUrl = externalUrl.trim() || docToEdit.file_url;
        let newFileName = docToEdit.file_name;
        let newFileSize = docToEdit.file_size;
        let newFileType = docToEdit.file_type;
        let newAttachments = docToEdit.attachments || [];
        let isExternal = Boolean(externalUrl.trim());

        if (selectedFiles.length > 0) {
          const file = selectedFiles[0].file;
          setSelectedFiles([{ file, status: 'uploading' }]);

          if (isSupabaseConfigured() && workspace?.id) {
            const res = await uploadDocumentFile(workspace.id, docToEdit.id, file);
            if (res.error || !res.path) {
              setSelectedFiles([{ file, status: 'error', error: res.error || 'Upload failed' }]);
              setErrorMsg(res.error || `Failed to upload ${file.name}`);
              return;
            }
            newFileUrl = res.path;
          } else {
            newFileUrl = URL.createObjectURL(file);
          }

          newFileName = file.name;
          newFileSize = file.size;
          newFileType = file.type || 'application/octet-stream';
          newAttachments = [
            {
              name: file.name,
              url: newFileUrl,
              size: file.size,
              type: newFileType,
            },
          ];
          isExternal = false;
          setSelectedFiles([{ file, status: 'success' }]);
        }

        const updateRes = await updateDocument(docToEdit.id, {
          title: cleanTitle,
          description: description.trim(),
          category,
          milestone_id: milestoneId || undefined,
          tags,
          file_url: newFileUrl,
          file_name: newFileName,
          file_size: newFileSize,
          file_type: newFileType,
          attachments: newAttachments,
          is_external_link: isExternal,
        });

        if (!updateRes.success) {
          setErrorMsg(updateRes.message || 'Failed to update document.');
          return;
        }

        if (selectedFiles.length > 0 && oldFileUrl && oldFileUrl !== newFileUrl) {
          await deleteDocumentFile(oldFileUrl);
        }

        onClose();
        return;
      }

      // Create mode: if multiple files are selected, upload and create a separate record for each
      if (selectedFiles.length > 0) {
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < selectedFiles.length; i++) {
          const item = selectedFiles[i];
          if (item.status === 'success') {
            successCount++;
            continue;
          }

          setSelectedFiles((prev) =>
            prev.map((p, idx) => (idx === i ? { ...p, status: 'uploading', error: undefined } : p))
          );

          const uniqueDocId = `doc-${Date.now().toString(36)}-${i}-${Math.random()
            .toString(36)
            .substring(2, 6)}`;

          let fileUrl = '';
          if (isSupabaseConfigured() && workspace?.id) {
            const uploadRes = await uploadDocumentFile(workspace.id, uniqueDocId, item.file);
            if (uploadRes.error || !uploadRes.path) {
              failCount++;
              setSelectedFiles((prev) =>
                prev.map((p, idx) =>
                  idx === i
                    ? { ...p, status: 'error', error: uploadRes.error || 'Storage upload failed' }
                    : p
                )
              );
              continue;
            }
            fileUrl = uploadRes.path;
          } else {
            fileUrl = await readFileAsDataUrl(item.file);
          }

          const docTitle =
            selectedFiles.length === 1
              ? cleanTitle
              : item.file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ') || cleanTitle;

          const dbRes = await addDocument({
            title: docTitle,
            description: description.trim(),
            category,
            tags,
            file_url: fileUrl,
            file_name: item.file.name,
            file_size: item.file.size,
            file_type: item.file.type || 'application/octet-stream',
            attachments: [
              {
                name: item.file.name,
                url: fileUrl,
                size: item.file.size,
                type: item.file.type || 'application/octet-stream',
              },
            ],
            is_external_link: false,
            milestone_id: milestoneId || undefined,
          });

          if (!dbRes.success) {
            failCount++;
            setSelectedFiles((prev) =>
              prev.map((p, idx) =>
                idx === i
                  ? { ...p, status: 'error', error: dbRes.message || 'Database save failed' }
                  : p
              )
            );
            continue;
          }

          successCount++;
          setSelectedFiles((prev) =>
            prev.map((p, idx) => (idx === i ? { ...p, status: 'success' } : p))
          );
        }

        if (failCount > 0) {
          setErrorMsg(
            `${successCount} file(s) uploaded, ${failCount} failed. Fix or remove failed files and retry.`
          );
          return;
        }

        setSuccessMsg(
          successCount === 1
            ? 'Document uploaded successfully!'
            : `${successCount} documents uploaded successfully!`
        );
        onClose();
        return;
      }

      // External link only (no file selected)
      const extUrl = externalUrl.trim();
      if (!extUrl) {
        setErrorMsg('Please select at least one file or paste an external link.');
        return;
      }

      const res = await addDocument({
        title: cleanTitle,
        description: description.trim(),
        category,
        tags,
        file_url: extUrl,
        file_name: cleanTitle,
        file_size: 0,
        file_type: 'text/uri-list',
        attachments: [],
        is_external_link: true,
        milestone_id: milestoneId || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.message || 'Failed to save document.');
        return;
      }

      onClose();
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden my-6 animate-scaleIn flex flex-col">
        {/* Header */}
        <div className="p-6 sm:p-7 pb-4 flex items-center justify-between border-b border-stone-100">
          <h2 className="text-lg font-bold text-[#14281E]">
            {isEditing ? 'Edit document' : 'Add documents'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg transition disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body matching image_aa1dfba3.png */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-7 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
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
              placeholder="Sensor BOM v2"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-stone-800 mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400 resize-none"
            />
          </div>

          {/* Category & Milestone side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DocumentCategory)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#164E33] cursor-pointer"
              >
                <option value="Other">Other</option>
                <option value="Model/ML">Model/ML</option>
                <option value="Hardware/Sensors">Hardware/Sensors</option>
                <option value="Biotech">Biotech</option>
                <option value="Plant Lipids data">Plant Lipids data</option>
                <option value="Pitch/Reports">Pitch/Reports</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-800 mb-1.5">
                Milestone
              </label>
              <select
                value={milestoneId}
                onChange={(e) => setMilestoneId(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#164E33] cursor-pointer"
              >
                <option value="">Not linked</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.phase_label || m.title.substring(0, 24)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Tags (comma separated) */}
          <div>
            <label className="block text-xs font-semibold text-stone-800 mb-1.5">
              Tags (comma separated)
            </label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="turmeric, dataset"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400"
            />
          </div>

          {/* Existing Attachment in Edit Mode */}
          {isEditing && docToEdit && docToEdit.file_url && (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#EAF3EB] text-[#164E33] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-stone-800 truncate">
                    {docToEdit.file_name || docToEdit.title}
                  </p>
                  <p className="text-[10px] text-stone-500">
                    {isBlobUrl(docToEdit.file_url)
                      ? 'Legacy local attachment — please upload a replacement file below'
                      : `${docToEdit.file_type || 'File'}${
                          docToEdit.file_size
                            ? ` • ${(docToEdit.file_size / 1024).toFixed(1)} KB`
                            : ''
                        }`}
                  </p>
                </div>
              </div>

              {!isBlobUrl(docToEdit.file_url) && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {onPreviewDocument && (
                    <button
                      type="button"
                      onClick={() => onPreviewDocument(docToEdit)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 text-[11px] font-semibold transition"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Preview</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      const url = await getSignedDocumentUrl(
                        docToEdit.file_url,
                        docToEdit.file_name || docToEdit.title
                      );
                      if (url) {
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = docToEdit.file_name || docToEdit.title;
                        a.target = '_blank';
                        a.rel = 'noreferrer';
                        a.click();
                      }
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 text-[11px] font-semibold transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Green Dashed Upload Box */}
          <div className="rounded-2xl border-2 border-dashed border-[#D2E2D6] bg-[#F7FAF7] p-5 space-y-3">
            <div className="text-center relative cursor-pointer py-1">
              <input
                type="file"
                multiple={!isEditing}
                disabled={isUploading}
                onChange={handleFilesChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
              />
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#164E33]">
                <Upload className="w-4 h-4" />
                <span>
                  {isEditing
                    ? 'Replace attachment (optional, max 25 MB)'
                    : 'Add files — pick as many as you like (max 25 MB each)'}
                </span>
              </div>
              <p className="text-[10px] text-stone-400 mt-1">
                Files are stored privately in Supabase Storage and opened with a secure link.
              </p>
            </div>

            {/* Selected files list with per-file status */}
            {selectedFiles.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pt-1">
                {selectedFiles.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-stone-200 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {item.status === 'uploading' && (
                        <Loader2 className="w-3.5 h-3.5 text-[#164E33] animate-spin shrink-0" />
                      )}
                      {item.status === 'success' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      )}
                      {item.status === 'error' && (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      )}
                      <span className="font-semibold text-stone-800 truncate">
                        {item.file.name}
                      </span>
                      {item.error && (
                        <span className="text-[10px] text-red-600 truncate">
                          ({item.error})
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => removeSelectedFile(i)}
                      className="text-stone-400 hover:text-red-500 p-1 disabled:opacity-40 shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="text-center text-[10px] font-bold text-stone-400 uppercase tracking-widest pt-1">
              OR
            </div>

            <input
              type="text"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="Paste an external link (Docs, Drive, notebook...)"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400"
            />
          </div>

          {/* Bottom Bar: Cancel + Add Document */}
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
              disabled={isUploading}
              className="px-5 py-2.5 rounded-xl bg-[#164E33] hover:bg-[#123F29] disabled:opacity-60 text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              {isUploading ? 'Uploading...' : isEditing ? 'Save Changes' : 'Add document'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
