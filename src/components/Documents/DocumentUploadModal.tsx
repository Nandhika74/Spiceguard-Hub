import React, { useState, useEffect } from 'react';
import { DocumentItem, DocumentCategory } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { Upload, X, AlertCircle } from 'lucide-react';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  docToEdit?: DocumentItem | null;
}

export const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({
  isOpen,
  onClose,
  docToEdit,
}) => {
  const { addDocument, updateDocument, milestones } = useRealtimeStore();

  const isEditing = Boolean(docToEdit);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<DocumentCategory>('Other');
  const [milestoneId, setMilestoneId] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (docToEdit) {
      setTitle(docToEdit.title);
      setDescription(docToEdit.description || '');
      setCategory(docToEdit.category);
      setMilestoneId(docToEdit.milestone_id || '');
      setTagsInput(docToEdit.tags?.join(', ') || '');
      setExternalUrl(docToEdit.file_url || '');
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
  }, [docToEdit, isOpen]);

  if (!isOpen) return null;

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg(null);
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const MAX_SIZE = 25 * 1024 * 1024;
    for (const f of files) {
      if (f.size > MAX_SIZE) {
        setErrorMsg(`"${f.name}" exceeds the 25 MB file size limit.`);
        return;
      }
    }

    setSelectedFiles((prev) => [...prev, ...files]);
    if (!title && files.length > 0) {
      const cleanName = files[0].name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setTitle(cleanName);
    }
  };

  const removeSelectedFile = (idx: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMsg('Title is required.');
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    const attachmentsList = selectedFiles.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
      size: file.size,
      type: file.type,
    }));

    const fileUrl = externalUrl.trim() || attachmentsList[0]?.url || 'https://storage.spiceguard.local/doc';

    if (isEditing && docToEdit) {
      updateDocument(docToEdit.id, {
        title: cleanTitle,
        description: description.trim(),
        category,
        milestone_id: milestoneId || undefined,
        tags,
        file_url: fileUrl,
      });
    } else {
      addDocument({
        title: cleanTitle,
        description: description.trim(),
        category,
        tags,
        file_url: fileUrl,
        file_name: selectedFiles[0]?.name || cleanTitle,
        file_size: selectedFiles[0]?.size || 0,
        file_type: selectedFiles[0]?.type || 'application/pdf',
        attachments: attachmentsList,
        is_external_link: Boolean(externalUrl.trim()),
        milestone_id: milestoneId || undefined,
      });
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden my-6 animate-scaleIn flex flex-col">
        {/* Header matching image_aa1dfba3.png */}
        <div className="p-6 sm:p-7 pb-4 flex items-center justify-between border-b border-stone-100">
          <h2 className="text-lg font-bold text-[#14281E]">
            Add documents
          </h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 p-1.5 rounded-lg transition"
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

          {/* Green Dashed Upload Box matching image_aa1dfba3.png */}
          <div className="rounded-2xl border-2 border-dashed border-[#D2E2D6] bg-[#F7FAF7] p-5 space-y-3">
            <div className="text-center relative cursor-pointer py-1">
              <input
                type="file"
                multiple
                onChange={handleFilesChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#164E33]">
                <Upload className="w-4 h-4" />
                <span>Add files — pick as many as you like (max 25 MB each)</span>
              </div>
              <p className="text-[10px] text-stone-400 mt-1">
                Files are stored privately (stored privately) and opened with a secure link.
              </p>
            </div>

            {/* Selected files list */}
            {selectedFiles.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto pt-1">
                {selectedFiles.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2 rounded-xl bg-white border border-stone-200 text-xs"
                  >
                    <span className="font-semibold text-stone-800 truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeSelectedFile(i)}
                      className="text-stone-400 hover:text-red-500 p-1"
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
              className="px-5 py-2.5 rounded-xl bg-[#164E33] hover:bg-[#123F29] text-white text-xs font-bold shadow-xs transition active:scale-95"
            >
              Add document
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
