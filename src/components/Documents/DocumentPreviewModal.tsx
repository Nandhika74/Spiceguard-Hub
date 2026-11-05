import React, { useEffect, useState } from 'react';
import { DocumentItem } from '../../types';
import { formatDate } from '../../lib/dateUtils';
import { getSupabaseClient } from '../../lib/supabase';
import { FileText, Download, X, Loader2, AlertCircle } from 'lucide-react';

interface DocumentPreviewModalProps {
  document: DocumentItem | null;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({ document, onClose }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!document) return;
    let cancelled = false;
    const sourceUrl = document.file_url;
    const supabase = getSupabaseClient();
    const storagePath = sourceUrl.match(/\/storage\/v1\/object\/(?:public|sign)\/spiceguard-documents\/(.+)$/)?.[1]
      || (sourceUrl.startsWith('http') ? null : sourceUrl.replace(/^\/+/, ''));

    setPreviewUrl(null);
    setError(null);
    if (!storagePath || !supabase) {
      setPreviewUrl(sourceUrl);
      return;
    }

    setLoading(true);
    const timeoutId = window.setTimeout(() => {
      if (!cancelled) {
        setLoading(false);
        setError('The preview URL could not be retrieved. Download the file instead.');
      }
    }, 10000);

    void supabase.storage.from('spiceguard-documents').createSignedUrl(decodeURIComponent(storagePath), 3600)
      .then(({ data, error: signedUrlError }) => {
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        setLoading(false);
        if (signedUrlError || !data?.signedUrl) {
          setError('The preview URL could not be retrieved. Download the file instead.');
          return;
        }
        setPreviewUrl(data.signedUrl);
      })
      .catch(() => {
        if (cancelled) return;
        window.clearTimeout(timeoutId);
        setLoading(false);
        setError('The preview URL could not be retrieved. Download the file instead.');
      });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [document]);

  if (!document) return null;

  const fileUrl = previewUrl || document.file_url;
  const isImage =
    document.file_type?.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|svg)$/i.test(document.file_url || '');

  const isPdf =
    document.file_type === 'application/pdf' ||
    /\.pdf$/i.test(document.file_name || '') ||
    fileUrl.toLowerCase().includes('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col animate-scaleIn">
        {/* Header */}
        <div className="bg-stone-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate max-w-[280px] sm:max-w-md">
                {document.title}
              </h3>
              <p className="text-xs text-stone-400">
                Uploaded by {document.uploaded_by_name} • {formatDate(document.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={fileUrl}
              download={document.file_name || 'spiceguard-doc'}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </a>
            <button onClick={onClose} className="text-stone-400 hover:text-white p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Preview */}
        <div className="flex-1 overflow-y-auto p-5 bg-stone-100 flex items-center justify-center min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-stone-600">
              <Loader2 className="w-8 h-8 animate-spin text-[#164E33]" />
              <p className="text-sm font-semibold">Preparing preview...</p>
            </div>
          ) : error ? (
            <div className="p-8 rounded-2xl bg-white border border-red-200 text-center max-w-md space-y-3 shadow-sm">
              <AlertCircle className="w-8 h-8 mx-auto text-red-500" />
              <p className="text-sm font-semibold text-stone-900">{error}</p>
              <a href={document.file_url} download={document.file_name || 'spiceguard-doc'} className="inline-flex items-center gap-2 rounded-xl bg-emerald-900 px-4 py-2 text-xs font-bold text-white">
                <Download className="w-3.5 h-3.5" /> Download
              </a>
            </div>
          ) : isImage ? (
            <div className="max-w-full max-h-[60vh] flex flex-col items-center">
              <img
                src={fileUrl}
                onError={() => setError('This image could not be loaded. Download the file instead.')}
                alt={document.title}
                className="max-h-[55vh] object-contain rounded-2xl shadow-md border border-stone-300"
              />
            </div>
          ) : isPdf ? (
            <div className="w-full h-[65vh] rounded-2xl overflow-hidden border border-stone-300 bg-white shadow-inner">
              <iframe
                src={`${fileUrl}#toolbar=0`}
                title={document.title}
                className="w-full h-full border-0"
              />
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-white border border-stone-200 text-center max-w-md space-y-3 shadow-sm">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-800 flex items-center justify-center mx-auto font-black text-lg">
                {document.file_name?.split('.').pop()?.toUpperCase() || 'DOC'}
              </div>
              <h4 className="text-sm font-bold text-stone-900">{document.file_name || document.title}</h4>
              <p className="text-xs text-stone-500 leading-relaxed">
                {document.description || 'Raw technical document, jupyter notebook, or dataset file.'}
              </p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition"
              >
                <span>Download file</span>
                <Download className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Attached Files List if multiple files exist */}
        {document.attachments && document.attachments.length > 0 && (
          <div className="px-5 py-3 bg-stone-50 border-t border-stone-200">
            <p className="text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-2">
              Attached Files ({document.attachments.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {document.attachments.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-2 rounded-xl bg-white border border-stone-200 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-3.5 h-3.5 text-[#164E33] shrink-0" />
                    <span className="font-semibold text-stone-800 truncate">{file.name}</span>
                    {file.size && (
                      <span className="text-[10px] text-stone-400 shrink-0">
                        ({(file.size / 1024).toFixed(0)} KB)
                      </span>
                    )}
                  </div>
                  <a
                    href={file.url}
                    download={file.name}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 text-stone-400 hover:text-[#164E33] transition"
                    title="Download file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Meta */}
        <div className="p-4 bg-white border-t border-stone-200 flex items-center justify-between text-xs text-stone-600 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#164E33] bg-[#EAF3EB] px-2 py-0.5 rounded">
              {document.category}
            </span>
            {document.tags.map((tag, i) => (
              <span key={i} className="text-[11px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full">
                #{tag}
              </span>
            ))}
          </div>
          {document.file_size && (
            <span className="text-[11px] text-stone-400">
              Size: {(document.file_size / (1024 * 1024)).toFixed(2)} MB
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
