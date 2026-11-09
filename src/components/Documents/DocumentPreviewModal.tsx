import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { DocumentItem } from '../../types';
import { formatDate } from '../../lib/dateUtils';
import { isBlobUrl, getSignedDocumentUrl, downloadDocumentBlob } from '../../lib/storage';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { FileText, Download, ExternalLink, X, AlertCircle, Trash2 } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface DocumentPreviewModalProps {
  document: DocumentItem | null;
  onClose: () => void;
  onDelete?: (doc: DocumentItem) => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  document,
  onClose,
  onDelete,
}) => {
  const { documents } = useRealtimeStore();

  // If this document is deleted from store while preview is open, immediately close preview
  useEffect(() => {
    if (document && !documents.some((d) => d.id === document.id)) {
      onClose();
    }
  }, [documents, document?.id, onClose]);

  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);

  const fileNameOrUrl = (document?.file_name || document?.file_url || '').toLowerCase();
  const isUnsupportedBinaryOrCode = Boolean(
    document &&
      /\.(pkl|pickle|ipynb|csv|xlsx?|docx?|pptx?|zip|tar|gz|pt|pth|h5|onnx|bin)$/i.test(
        document.file_name || ''
      )
  );

  const isImage = Boolean(
    document &&
      !isUnsupportedBinaryOrCode &&
      (document.file_type?.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif|svg)$/i.test(fileNameOrUrl))
  );

  const isPdf = Boolean(
    document &&
      !isUnsupportedBinaryOrCode &&
      !isImage &&
      (document.file_type === 'application/pdf' ||
        /\.pdf$/i.test(document.file_name || '') ||
        (document.file_url || '').toLowerCase().includes('.pdf'))
  );

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    setSignedUrl(null);
    setImageBlobUrl(null);
    setPdfBuffer(null);
    setNumPages(0);
    setLoadError(null);

    if (!document) return;

    if (isBlobUrl(document.file_url)) {
      setLoadError('Attachment needs to be re-uploaded. Temporary browser blob URLs are no longer valid.');
      return;
    }

    setIsLoading(true);

    const loadPreview = async () => {
      try {
        const dlUrl = await getSignedDocumentUrl(
          document.file_url,
          document.file_name || document.title
        );
        if (active && dlUrl) {
          setSignedUrl(dlUrl);
        }

        if (isPdf) {
          if (!dlUrl) {
            setLoadError('Unable to generate a signed URL for this PDF.');
            return;
          }
          // Pass a non-download signed URL directly to PDF.js
          const viewUrl = await getSignedDocumentUrl(document.file_url);
          if (active) {
            setSignedUrl(viewUrl || dlUrl);
            setPdfBuffer(new ArrayBuffer(1)); // trigger renderPdf with viewUrl
          }
        } else if (isImage) {
          const { blob, error } = await downloadDocumentBlob(document.file_url);
          if (!active) return;
          if (error || !blob) {
            setLoadError(error || 'Unable to load image from storage. Please use the Download button.');
            return;
          }
          const mimeType = document.file_type || blob.type || 'image/png';
          objectUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }));
          if (active) setImageBlobUrl(objectUrl);
        } else if (!dlUrl) {
          setLoadError('Unable to access this file. It may be missing or inaccessible.');
        }
      } catch {
        if (active) {
          setLoadError('Unable to load inline preview. Please use the Download button.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadPreview();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [document, isPdf, isImage]);

  // Render PDF pages onto canvases using PDF.js (no iframe, never blocked by Chrome)
  useEffect(() => {
    let cancelled = false;
    if (!isPdf || !signedUrl || !pdfContainerRef.current) return;

    const container = pdfContainerRef.current;
    container.innerHTML = '';

    const renderPdf = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url: signedUrl });
        const pdf = await loadingTask.promise;

        if (cancelled) return;
        setNumPages(pdf.numPages);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = window.document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) {
            throw new Error(`Could not acquire 2D canvas context for page ${pageNum}.`);
          }

          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.className = 'w-full max-w-2xl rounded-xl shadow-md bg-white mx-auto block';

          container.appendChild(canvas);
          await page.render({ canvasContext: context, canvas, viewport }).promise;
        }
      } catch (err: any) {
        console.warn('PDF.js render warning:', err?.message || err);
        if (!cancelled) {
          const detail = err?.message ? ` (${err.message})` : '';
          setLoadError(`Failed to render PDF${detail}. Please use the Download button.`);
        }
      }
    };

    renderPdf();
    return () => {
      cancelled = true;
    };
  }, [isPdf, signedUrl]);

  if (!document) return null;

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
                {numPages > 0 ? ` • ${numPages} page${numPages > 1 ? 's' : ''}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {signedUrl && (
              <a
                href={signedUrl}
                download={document.file_name || 'spiceguard-doc'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(document)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-950/70 hover:bg-red-900 text-red-200 hover:text-white text-xs font-medium transition cursor-pointer"
                title="Delete this document"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Delete</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-stone-400 hover:text-white p-1 rounded-md transition"
              title="Close preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-stone-100 flex items-center justify-center min-h-[360px]">
          {isLoading ? (
            <div className="text-center space-y-2">
              <div className="w-7 h-7 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-stone-600 font-medium">Generating secure preview...</p>
            </div>
          ) : loadError ? (
            <div className="max-w-md p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-950">Preview Unavailable</p>
                <p className="mt-0.5">{loadError}</p>
              </div>
            </div>
          ) : isImage && imageBlobUrl ? (
            <img
              src={imageBlobUrl}
              alt={document.title}
              className="max-h-[65vh] max-w-full rounded-xl shadow-md object-contain"
            />
          ) : isPdf && pdfBuffer ? (
            <div ref={pdfContainerRef} className="w-full space-y-4 self-start" />
          ) : signedUrl ? (
            <div className="text-center space-y-3 p-6 bg-white rounded-2xl border border-stone-200 max-w-md">
              <FileText className="w-10 h-10 text-emerald-800 mx-auto" />
              <div>
                <p className="text-sm font-bold text-stone-900">
                  {document.file_name || document.title}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  Inline preview is not supported for this file type. Use the button below to download or open it.
                </p>
              </div>
              <a
                href={signedUrl}
                download={document.file_name || 'spiceguard-doc'}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Download File</span>
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
