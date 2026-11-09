import React, { useState, useEffect } from 'react';
import { DocumentItem } from '../../types';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { formatDate } from '../../lib/dateUtils';
import { DocumentUploadModal } from './DocumentUploadModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
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
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenuId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
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
                onClick={() => setPreviewDoc(doc)}
                className="rounded-2xl bg-white border border-stone-200/90 p-5 shadow-xs hover:shadow-md hover:border-[#164E33]/40 transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top Icon & Options */}
                  <div className="flex items-center justify-between">
                    <div className="w-9 h-9 rounded-xl bg-[#EAF3EB] text-[#22633C] flex items-center justify-center">
                      <FileText className="w-4 h-4" />
                    </div>

                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(activeMenuId === doc.id ? null : doc.id);
                        }}
                        className="p-1 text-stone-400 hover:text-stone-700 rounded-lg transition"
                        title="Document options"
                        aria-label="Document options"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {activeMenuId === doc.id && (
                        <>
                          <div
                            className="fixed inset-0 z-30 bg-transparent cursor-default select-none"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(null);
                            }}
                            aria-hidden="true"
                          />
                          <div className="absolute right-0 top-6 w-36 rounded-xl bg-white shadow-xl border border-stone-200 py-1.5 z-40 text-xs animate-scaleIn">
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                openPreview(doc);
                              }}
                              className="w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
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
                              className="w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
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
                              className="w-full px-3 py-1.5 text-left text-stone-700 hover:bg-stone-50 flex items-center gap-2 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5 text-stone-400" />
                              Download
                            </a>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                                setDocToDelete(doc);
                              }}
                              className="w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer font-medium border-t border-stone-100"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Delete
                            </button>
                          </div>
                        </>
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

                  {/* Category & File Metadata */}
                  <div className="mt-3 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#EAF3EB] text-[#1E5638]">
                      {doc.category}
                    </span>
                    {doc.file_name && (
                      <span className="text-[10px] font-medium text-stone-500 truncate max-w-[140px]">
                        {doc.file_name}
                      </span>
                    )}
                    {doc.file_size ? (
                      <span className="text-[10px] text-stone-400">
                        • {(doc.file_size / 1024).toFixed(0)} KB
                      </span>
                    ) : null}
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
              onClick={() => setPreviewDoc(doc)}
              className="p-4 flex items-center justify-between gap-3 hover:bg-stone-50/60 transition cursor-pointer"
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
                  <p className="text-[10px] text-stone-400 truncate">
                    {doc.uploaded_by_name} · {doc.category}
                    {doc.file_name ? ` · ${doc.file_name}` : ''}
                    {doc.file_size ? ` (${(doc.file_size / 1024).toFixed(0)} KB)` : ''}
                  </p>
                </div>
              </div>

              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewDoc(doc);
                  }}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                  title="Preview Document"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <a
                  href={doc.file_url}
                  download={doc.file_name}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition"
                  title="Download File"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    setDocToDelete(doc);
                  }}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
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
        onPreviewDocument={(doc) => setPreviewDoc(doc)}
      />

      <DocumentPreviewModal
        document={previewDoc}
        onClose={() => setPreviewDoc(null)}
        onDelete={(doc) => setDocToDelete(doc)}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(docToDelete)}
        title="Delete Document"
        message={`Are you sure you want to delete "${docToDelete?.title}"? This action cannot be undone.`}
        confirmLabel="Delete Document"
        onConfirm={() => {
          if (docToDelete) {
            // Immediately close preview if it is the deleted document
            if (previewDoc?.id === docToDelete.id) {
              setPreviewDoc(null);
            }
            deleteDocument(docToDelete.id);
            setDocToDelete(null);
          }
        }}
        onCancel={() => setDocToDelete(null)}
      />
    </div>
  );
};
