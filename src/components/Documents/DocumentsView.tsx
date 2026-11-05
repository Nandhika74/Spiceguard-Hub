import React, { useState, useEffect } from 'react';
import { DocumentItem } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { formatDate } from '../../lib/dateUtils';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import {
  FileText,
  Plus,
  Search,
  LayoutGrid,
  List,
  MoreHorizontal,
  Download,
  Trash2,
  Edit2,
  Eye,
} from 'lucide-react';

export const DocumentsView: React.FC = () => {
  const { documents, deleteDocument } = useRealtimeStore();

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [uploaderFilter, setUploaderFilter] = useState<string>('all');

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [docToEdit, setDocToEdit] = useState<DocumentItem | null>(null);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  const openPreview = (document: DocumentItem) => {
    console.debug('[DocumentPreview] opening document', {
      documentId: document.id,
      fileName: document.file_name,
      fileUrl: document.file_url,
      mimeType: document.file_type,
    });
    setPreviewDoc(document);
  };

  useEffect(() => {
    if (!activeMenuId) return;
    const handleOutsideClick = () => setActiveMenuId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [activeMenuId]);

  const filteredDocs = documents.filter((doc) => {
    if (categoryFilter !== 'all' && doc.category !== categoryFilter) return false;
    if (uploaderFilter !== 'all' && doc.uploaded_by !== uploaderFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        doc.title.toLowerCase().includes(q) ||
        (doc.description || '').toLowerCase().includes(q) ||
        (doc.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-20 md:pb-12 max-w-5xl">
      {/* Top Header matching Screenshot 2 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-stone-900 tracking-tight">Research & documents</h2>
          <p className="text-xs text-stone-500">
            {documents.length} files and links across the team
          </p>
        </div>

        <button
          onClick={() => {
            setDocToEdit(null);
            setUploadModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#164E33] hover:bg-[#123F29] text-white text-xs font-bold shadow-xs transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Add document</span>
        </button>
      </div>

      {/* Search and Filter bar matching Screenshot 2 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search titles, tags, descriptions..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white border border-stone-200/90 focus:outline-none focus:ring-2 focus:ring-[#164E33] font-medium placeholder-stone-400 shadow-2xs"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white border border-stone-200/90 font-medium text-stone-700 focus:outline-none shadow-2xs cursor-pointer"
        >
          <option value="all">All categories</option>
          <option value="Model/ML">Model/ML</option>
          <option value="Hardware/Sensors">Hardware/Sensors</option>
          <option value="Biotech">Biotech</option>
          <option value="Plant Lipids data">Plant Lipids data</option>
          <option value="Pitch/Reports">Pitch/Reports</option>
          <option value="Other">Other</option>
        </select>

        <select
          value={uploaderFilter}
          onChange={(e) => setUploaderFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl bg-white border border-stone-200/90 font-medium text-stone-700 focus:outline-none shadow-2xs cursor-pointer"
        >
          <option value="all">Everyone</option>
          <option value="nandhikas3@gmail.com">Nandhika S</option>
          <option value="nithyasree2410841@ssn.edu.in">Nithyasree M</option>
          <option value="sivakumarans.bbt24@rathinam.in">Sivakumaran S</option>
          <option value="abhijithsriram2410202@ssn.edu.in">Abhijith Sriram V</option>
        </select>

        {/* View mode toggle */}
        <div className="flex items-center bg-white border border-stone-200/90 p-1 rounded-xl shadow-2xs">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg transition ${
              viewMode === 'grid' ? 'bg-stone-100 text-[#164E33]' : 'text-stone-400'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg transition ${
              viewMode === 'list' ? 'bg-stone-100 text-[#164E33]' : 'text-stone-400'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Documents Grid matching Screenshot 2 */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocs.map((doc) => {
            return (
              <div
                key={doc.id}
                className="rounded-2xl bg-white border border-stone-200/90 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Top Icon & Options */}
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[#EAF3EB] text-[#22633C] flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>

                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() =>
                          setActiveMenuId(activeMenuId === doc.id ? null : doc.id)
                        }
                        className="p-1 text-stone-400 hover:text-stone-700 rounded-lg transition"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {activeMenuId === doc.id && (
                        <div className="absolute right-0 top-6 w-36 rounded-xl bg-white shadow-lg border border-stone-200 py-1 z-20 text-xs">
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              openPreview(doc);
                            }}
                            className="w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                          >
                            <Eye className="w-3.5 h-3.5 text-stone-400" />
                            Preview
                          </button>
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              setDocToEdit(doc);
                              setUploadModalOpen(true);
                            }}
                            className="w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-stone-400" />
                            Edit
                          </button>
                          <a
                            href={doc.file_url}
                            download={doc.file_name}
                            target="_blank"
                            rel="noreferrer"
                            onClick={() => setActiveMenuId(null)}
                            className="w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2"
                          >
                            <Download className="w-3.5 h-3.5 text-stone-400" />
                            Download
                          </a>
                          <button
                            onClick={() => {
                              setActiveMenuId(null);
                              if (confirm(`Delete document "${doc.title}"?`)) {
                                deleteDocument(doc.id);
                              }
                            }}
                            className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Snippet */}
                  <div className="mt-3 space-y-1">
                    <h3
                      onClick={() => openPreview(doc)}
                      className="text-xs font-bold text-stone-900 cursor-pointer hover:text-[#164E33] truncate"
                    >
                      {doc.title}
                    </h3>
                    <p className="text-[11px] text-stone-500 line-clamp-2 leading-relaxed">
                      {doc.description}
                    </p>
                  </div>

                  {/* Category Pill Tag matching Screenshot 2 */}
                  <div className="mt-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EAF3EB] text-[#1E5638]">
                      {doc.category}
                    </span>
                  </div>
                </div>

                {/* Footer: Nandhika S · 4 Nov */}
                <div className="mt-4 pt-3 border-t border-stone-100 text-[10px] text-stone-400">
                  {doc.uploaded_by_name} · {formatDate(doc.created_at).replace(/, \d{4}/, '') || '4 Nov'}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List Mode */
        <div className="rounded-2xl bg-white border border-stone-200/90 divide-y divide-stone-100 overflow-hidden shadow-xs">
          {filteredDocs.map((doc) => (
            <div
              key={doc.id}
              className="p-4 flex items-center justify-between gap-3 hover:bg-stone-50/60 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#EAF3EB] text-[#22633C] flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p
                    onClick={() => openPreview(doc)}
                    className="text-xs font-bold text-stone-900 cursor-pointer hover:text-[#164E33] truncate"
                  >
                    {doc.title}
                  </p>
                  <p className="text-[10px] text-stone-400">
                    {doc.uploaded_by_name} · {doc.category}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewDoc(doc)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <a
                  href={doc.file_url}
                  download={doc.file_name}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => {
                    if (confirm(`Delete document "${doc.title}"?`)) {
                      deleteDocument(doc.id);
                    }
                  }}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition"
                  title="Delete Document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <DocumentUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        docToEdit={docToEdit}
      />

      <DocumentPreviewModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
};
