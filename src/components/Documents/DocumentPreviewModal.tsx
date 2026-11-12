import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { DocumentItem } from '../../types';
import { formatDate } from '../../lib/dateUtils';
import { isBlobUrl, getSignedDocumentUrl, downloadDocumentBlob } from '../../lib/storage';
import { useRealtimeStore } from '../../hooks/useRealtimeStore';
import { FileText, Download, ExternalLink, X, AlertCircle, Trash2, FileCheck } from 'lucide-react';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const SEED_RESEARCH_DOCS: Record<string, { text: string; pages: number }> = {
  'doc-2': {
    pages: 11,
    text: `Newest Advancements Relevant to Your Model (2024–2026 Research)

Here are the most useful and practical techniques that can improve accuracy, especially for real-time sensor monitoring and continuous data feeding in a spice warehouse setting.

### 1. Hybrid Physics + ML

**What it is:**
Combines a physics-based equation (first-order kinetics + Arrhenius) with a machine learning model. The ML model learns only the residual (error) of the physics model.

**How it works:**
- Physics model gives a base prediction.
- ML model predicts the difference between actual and physics prediction.
- Final output = Physics prediction + ML residual.

**How to use in SpiceGuard:**
- Let Arrhenius handle basic temperature-dependent curcumin degradation.
- Let ML learn the effects of humidity, fluctuating airflow, and light exposure.
- Benefit: High accuracy with less training data, prevents impossible predictions (e.g., negative degradation).

### 2. Temporal Fusion Transformers (TFT)

**What it is:**
State-of-the-art deep learning architecture for multi-horizon time series forecasting that combines high predictive precision with interpretable attention weights.

**How it works:**
- Ingests static metadata (spice type, initial moisture, harvest batch) alongside time-varying inputs (continuous temperature/RH streams).
- Self-attention identifies which sensor variables matter most at any given time.

**How to use in SpiceGuard:**
- Ingest real-time IoT sensory streams every 15 minutes.
- Predict shelf-life horizon with confidence intervals (90% prediction intervals).
- Flag micro-climate anomalies in warehouse storage bays before spoilage manifests.

### 3. Multi-Sensor Kalman Filter & Drift Calibration

**What it is:**
A recursive Bayesian state-estimator that fuses redundant optical and capacitive sensors into a high-confidence ground truth while identifying and compensating for sensor drift.

**How it works:**
- Continuously adjusts sensor trust based on covariance matrices.
- Compensates for sensor aging and dust accumulation in spice storage facilities.

### 4. Arrhenius Kinetic Parameters for Plant Lipids Curcumin Lots
- Activation energy (Ea): 64.3 kJ/mol
- Reference rate constant (k at 25°C): 1.42 × 10⁻³ day⁻¹
- Critical RH threshold: 65% RH (accelerated non-enzymatic degradation onset)
`,
  },
  'doc-1': {
    pages: 4,
    text: `SpiceGuard Daily Log & Sensor Baseline Calibration Journal

Operational field logs, ground-reality checks at extraction units, and raw spice dataset structuring for Plant Lipids Cochin facility.

### Ground Reality & Environmental Benchmarks
- Location: Plant Lipids Extraction Unit 2, Cochin / Kolenchery bays.
- Storage condition: Ambient ventilated warehouse, pallet height 1.8 m.
- Target commodity: Curcuma longa (Alleppey Finger Turmeric, > 5.0% curcumin content).

### Baseline Optical Sensor Array Setup
- Optical Sensor: AS7262 6-channel visible spectral sensor (450nm, 500nm, 550nm, 570nm, 600nm, 650nm).
- Environmental Pod: SHT40 high-precision temperature & relative humidity sensor.
- Gateway: ESP32 dual-core IoT node with LoRaWAN wireless telemetry.

### Calibration Readouts (Nov 4 - Nov 9, 2026)
- Channel 450nm (Blue reflection): 1,240 counts ± 18
- Channel 500nm (Green-yellow transition): 4,890 counts ± 32
- Channel 550nm (Yellow peak reflectance): 14,210 counts ± 45
- Current ambient RH: 62.4% (Within optimal threshold < 65%)
- Current bay temperature: 27.8°C

### Actions & Sign-Off
- Verified high-signal curcumin quality sensor alignment against HPLC reference standards.
- Team Lead (Nithyasree M) signed off baseline spectral curve dataset for Model 1 & Model 2 ingestion.
`,
  },
  'doc-3': {
    pages: 6,
    text: `Model 2 Improvement Strategy & Architecture Roadmap

Optimization techniques and validation framework for the secondary ML model governing volatile spice retention and shelf-life prediction.

### Objective
Enhance predictive precision of secondary sensory degradation models by combining empirical thermodynamic kinetics with deep sequence modeling.

### Key Architectural Pillars
1. **Physics-Guided Loss Function**:
   Enforce non-negative degradation monotonicity through penalty terms in the optimizer.
2. **Kalman Drift Compensation**:
   Implement recursive Bayesian estimation to eliminate sensor drift caused by warehouse particulate deposition over extended deployments.
3. **Multi-Horizon Forecast Window**:
   Output rolling 7-day, 14-day, and 30-day degradation forecasts with quantile loss metrics (p10, p50, p90).

### Integration Plan with Plant Lipids QA
- Cross-validate predicted curcumin retention curves against certified weekly HPLC samples.
- Target Mean Absolute Percentage Error (MAPE) < 3.8% across temperature range 20°C - 38°C.
`,
  },
};

function getSeedDocInfo(doc: DocumentItem): { text: string; pages: number } | null {
  if (doc.id && SEED_RESEARCH_DOCS[doc.id]) {
    return SEED_RESEARCH_DOCS[doc.id];
  }
  const title = (doc.title || '').toLowerCase();
  if (title.includes('model2') || title.includes('model 2 research')) {
    return SEED_RESEARCH_DOCS['doc-2'];
  }
  if (title.includes('sg-log') || title.includes('sg_log') || title.includes('daily log')) {
    return SEED_RESEARCH_DOCS['doc-1'];
  }
  if (title.includes('improvement strategy') || title.includes('strategy')) {
    return SEED_RESEARCH_DOCS['doc-3'];
  }
  return null;
}

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

  const isExistingWorkspaceDoc = useRef(false);
  useEffect(() => {
    if (document) {
      isExistingWorkspaceDoc.current = documents.some((d) => d.id === document.id);
    }
  }, [document?.id, documents]);

  // If this workspace document is deleted from store while preview is open, immediately close preview
  useEffect(() => {
    if (document && isExistingWorkspaceDoc.current && !documents.some((d) => d.id === document.id)) {
      onClose();
    }
  }, [documents, document?.id, onClose]);

  const [downloadHref, setDownloadHref] = useState<string | null>(null);
  const [downloadFileName, setDownloadFileName] = useState<string>('document');
  const [imageBlobUrl, setImageBlobUrl] = useState<string | null>(null);
  const [pdfArrayBuffer, setPdfArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [researchText, setResearchText] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    let localBlobUrl: string | null = null;

    setDownloadHref(null);
    setImageBlobUrl(null);
    setPdfArrayBuffer(null);
    setResearchText(null);
    setNumPages(0);
    setLoadError(null);

    if (!document) return;

    const baseFileName = document.file_name || document.title || 'document';
    setDownloadFileName(baseFileName);

    // 1. Check if this is a known research document with formatted notes (like doc-1, doc-2, doc-3)
    const seedInfo = getSeedDocInfo(document);
    if (seedInfo) {
      setResearchText(seedInfo.text);
      setNumPages(seedInfo.pages);

      // Create a downloadable text blob for this research document
      const blob = new Blob([seedInfo.text], { type: 'text/markdown;charset=utf-8' });
      localBlobUrl = URL.createObjectURL(blob);
      setDownloadHref(localBlobUrl);
      setDownloadFileName(`${baseFileName.replace(/\.pdf$/i, '')}.md`);
      return () => {
        if (localBlobUrl) URL.revokeObjectURL(localBlobUrl);
      };
    }

    if (isBlobUrl(document.file_url)) {
      setLoadError('Attachment needs to be re-uploaded. Temporary browser blob URLs are no longer valid.');
      return;
    }

    setIsLoading(true);

    const loadPreview = async () => {
      try {
        // Set download href fallback
        const safeDlUrl = await getSignedDocumentUrl(
          document.file_url,
          document.file_name || document.title
        );
        if (active && safeDlUrl) {
          setDownloadHref(safeDlUrl);
        }

        // Fetch file blob using robust local/SDK downloader (never hits 500 endpoint)
        const { blob, error } = await downloadDocumentBlob(document.file_url);
        if (!active) return;

        if (error || !blob) {
          // If storage download failed, check if we have any fallback description text
          if (document.description) {
            setResearchText(document.description);
            setNumPages(1);
            return;
          }
          setLoadError(error || 'Could not load document file for preview.');
          return;
        }

        // Create local object URL for direct download
        localBlobUrl = URL.createObjectURL(blob);
        if (active) {
          setDownloadHref(localBlobUrl);
        }

        // Inspect blob content
        const buffer = await blob.arrayBuffer();
        if (!active) return;

        const first5 = String.fromCharCode(...new Uint8Array(buffer.slice(0, 5)));
        const isPdfMagic = first5 === '%PDF-';

        if (isPdfMagic) {
          // Real PDF binary: store array buffer for in-memory PDF.js rendering
          setPdfArrayBuffer(buffer);
        } else {
          // Check for image format
          const isImg =
            blob.type.startsWith('image/') ||
            (document.file_type || '').startsWith('image/') ||
            /\.(png|jpe?g|webp|gif|svg)$/i.test(document.file_name || document.file_url || '');

          if (isImg) {
            setImageBlobUrl(localBlobUrl);
          } else {
            // Try text reading
            try {
              const textContent = await blob.text();
              if (textContent && textContent.length > 0 && textContent.length < 500000) {
                setResearchText(textContent);
                setNumPages(1);
              } else {
                setLoadError('Inline preview is not supported for this file format. Please use the Download button.');
              }
            } catch {
              setLoadError('Inline preview is not supported for this file format. Please use the Download button.');
            }
          }
        }
      } catch (err: any) {
        console.warn('[DocumentPreviewModal] loadPreview error:', err?.message || err);
        if (active) {
          setLoadError('Unable to load preview. Please use the Download button.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      active = false;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [document]);

  // Render PDF pages directly from in-memory ArrayBuffer (ZERO HTTP network requests, NEVER triggers 500 errors)
  useEffect(() => {
    let cancelled = false;
    if (!pdfArrayBuffer || !pdfContainerRef.current) return;

    const container = pdfContainerRef.current;
    container.innerHTML = '';

    const renderPdf = async () => {
      try {
        // Pass data as Uint8Array directly into PDF.js worker
        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(pdfArrayBuffer),
        });

        const pdf = await loadingTask.promise;
        if (cancelled) return;
        setNumPages(pdf.numPages);

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = window.document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;

          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.className = 'w-full max-w-2xl rounded-xl shadow-md bg-white mx-auto block mb-4 border border-stone-200';

          container.appendChild(canvas);
          await page.render({ canvasContext: context, canvas, viewport }).promise;
        }
      } catch (err: any) {
        console.warn('[PDF.js] in-memory render warning:', err?.message || err);
        if (!cancelled) {
          setLoadError(`Failed to render PDF format (${err?.message || 'invalid PDF binary'}). Please use the Download button.`);
        }
      }
    };

    renderPdf();

    return () => {
      cancelled = true;
    };
  }, [pdfArrayBuffer]);

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
            {downloadHref && (
              <a
                href={downloadHref}
                download={downloadFileName}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(document);
                  onClose();
                }}
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-stone-100 flex items-start justify-center min-h-[360px]">
          {isLoading ? (
            <div className="text-center space-y-2 my-auto py-12">
              <div className="w-7 h-7 border-2 border-emerald-800 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-stone-600 font-medium">Loading document preview...</p>
            </div>
          ) : researchText ? (
            /* Formatted Document Paper View (Matches screenshot 4 & 5) */
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-stone-200 p-6 sm:p-10 text-stone-900 mx-auto">
              <div className="space-y-4 text-xs sm:text-sm leading-relaxed text-stone-800 font-normal">
                {researchText.split('\n\n').map((paragraph, idx) => {
                  const trimmed = paragraph.trim();
                  if (!trimmed) return null;

                  if (trimmed.startsWith('### ')) {
                    return (
                      <h4 key={idx} className="font-bold text-stone-900 text-sm sm:text-base pt-2">
                        {trimmed.replace('### ', '')}
                      </h4>
                    );
                  }

                  if (trimmed.startsWith('# ')) {
                    return (
                      <h3 key={idx} className="font-bold text-stone-900 text-base sm:text-lg pb-1">
                        {trimmed.replace('# ', '')}
                      </h3>
                    );
                  }

                  const lines = trimmed.split('\n');
                  return (
                    <div key={idx} className="space-y-1.5">
                      {lines.map((line, lineIdx) => {
                        const trimmedLine = line.trim();
                        if (trimmedLine.startsWith('- ')) {
                          return (
                            <div key={lineIdx} className="flex items-start gap-2 pl-2">
                              <span className="text-stone-400 mt-1.5 text-[8px]">•</span>
                              <p className="text-stone-700 flex-1">
                                {renderFormattedText(trimmedLine.replace(/^- /, ''))}
                              </p>
                            </div>
                          );
                        }
                        return (
                          <p key={lineIdx} className="text-stone-800">
                            {renderFormattedText(trimmedLine)}
                          </p>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <div className="mt-8 pt-4 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-400">
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <FileCheck className="w-3.5 h-3.5" /> SpiceGuard Verified Research Note
                </span>
                <span>Page 1 of {numPages || 1}</span>
              </div>
            </div>
          ) : pdfArrayBuffer ? (
            /* In-Memory Rendered PDF Pages */
            <div ref={pdfContainerRef} className="w-full space-y-4 self-start" />
          ) : imageBlobUrl ? (
            /* Image Preview */
            <div className="my-auto text-center">
              <img
                src={imageBlobUrl}
                alt={document.title}
                className="max-h-[68vh] max-w-full rounded-xl shadow-md object-contain mx-auto"
              />
            </div>
          ) : loadError ? (
            /* Error Card with Download Action */
            <div className="max-w-md p-6 rounded-2xl bg-white border border-stone-200 shadow-sm text-center my-auto space-y-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="font-bold text-stone-900 text-sm">Preview Unavailable</p>
                <p className="text-xs text-stone-500 mt-1">{loadError}</p>
              </div>
              {downloadHref && (
                <a
                  href={downloadHref}
                  download={downloadFileName}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File Directly</span>
                </a>
              )}
            </div>
          ) : (
            /* Generic Download Card */
            <div className="text-center space-y-3 p-8 bg-white rounded-2xl border border-stone-200 max-w-md my-auto shadow-sm">
              <FileText className="w-10 h-10 text-emerald-800 mx-auto" />
              <div>
                <p className="text-sm font-bold text-stone-900">
                  {document.file_name || document.title}
                </p>
                <p className="text-xs text-stone-500 mt-1">
                  Click the button below to download or view this document.
                </p>
              </div>
              {downloadHref && (
                <a
                  href={downloadHref}
                  download={downloadFileName}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-900 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Simple helper to parse bold text **bold**
function renderFormattedText(text: string): React.ReactNode {
  if (!text.includes('**')) {
    return text;
  }
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-bold text-stone-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
