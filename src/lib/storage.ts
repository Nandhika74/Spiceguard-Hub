import { getSupabaseClient } from './supabase';

export const DOCUMENTS_BUCKET = 'spiceguard-documents';

export function isBlobUrl(url?: string | null): boolean {
  return Boolean(url && url.trim().startsWith('blob:'));
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function uploadDocumentFile(
  workspaceId: string,
  docId: string,
  file: File
): Promise<{ path: string | null; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      return { path: dataUrl };
    } catch {
      return { path: null, error: 'Supabase is not configured and file read failed.' };
    }
  }

  try {
    const slice = await file.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(slice);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
    const isPdfHeader = String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
    console.log('[Storage Upload]', {
      name: file.name,
      type: file.type,
      size: file.size,
      first16Hex: hex,
      startsWithPdf: isPdfHeader,
    });
  } catch {
    // ignore diagnostic read error
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const uniqueSuffix = Math.random().toString(36).substring(2, 7);
  const storagePath = `${workspaceId}/${docId}/${Date.now()}-${uniqueSuffix}-${safeName}`;

  try {
    const uploadPromise = supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      });

    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) =>
      setTimeout(
        () =>
          resolve({
            data: null,
            error: { message: 'Storage upload timed out; switching to instant inline storage.' },
          }),
        3500
      )
    );

    const { data, error } = await Promise.race([uploadPromise, timeoutPromise]);

    if (error || !data) {
      console.warn(
        `[uploadDocumentFile] Storage upload fallback (${error?.message || 'no data'}). Saving inline Data URL.`
      );
      const dataUrl = await readFileAsDataUrl(file);
      return { path: dataUrl };
    }

    return { path: data.path };
  } catch (err: any) {
    console.warn(`[uploadDocumentFile] Storage error (${err?.message || err}). Falling back to inline data URL.`);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      return { path: dataUrl };
    } catch {
      return { path: null, error: err?.message || 'Storage upload failed' };
    }
  }
}

export async function deleteDocumentFile(pathOrUrl?: string | null): Promise<void> {
  if (!pathOrUrl || isBlobUrl(pathOrUrl) || pathOrUrl.startsWith('data:')) return;
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) return;

  const supabase = getSupabaseClient();
  if (!supabase) return;

  await supabase.storage.from(DOCUMENTS_BUCKET).remove([pathOrUrl]);
}

export async function downloadDocumentBlob(
  pathOrUrl: string
): Promise<{ blob: Blob | null; error?: string }> {
  if (!pathOrUrl || isBlobUrl(pathOrUrl)) {
    return { blob: null, error: 'Invalid or expired local blob URL.' };
  }

  if (pathOrUrl.startsWith('data:')) {
    try {
      const resp = await fetch(pathOrUrl);
      const blob = await resp.blob();
      return { blob };
    } catch {
      return { blob: null, error: 'Failed to convert data URL to file.' };
    }
  }

  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    try {
      const resp = await fetch(pathOrUrl);
      if (!resp.ok) {
        return { blob: null, error: `HTTP ${resp.status}: Unable to fetch file.` };
      }
      const blob = await resp.blob();
      return { blob };
    } catch {
      return { blob: null, error: 'Network error while fetching external file.' };
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { blob: null, error: 'Supabase is not configured.' };
  }

  // Primary: fetch via fresh signed URL (same storage object endpoint that Download uses)
  const signedUrl = await getSignedDocumentUrl(pathOrUrl);
  if (signedUrl) {
    try {
      const resp = await fetch(signedUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob.size > 0) {
          return { blob };
        }
      }
    } catch {
      // Fall through to SDK download
    }
  }

  // Fallback: authenticated SDK download
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(pathOrUrl);

  if (error || !data) {
    return { blob: null, error: error?.message || 'File not found in storage.' };
  }

  try {
    const slice = await data.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(slice);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
    const isPdfHeader = String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-';
    console.log('[Storage Download]', {
      type: data.type,
      size: data.size,
      first16Hex: hex,
      startsWithPdf: isPdfHeader,
    });
  } catch {
    // ignore diagnostic read error
  }

  return { blob: data };
}

export async function getSignedDocumentUrl(
  pathOrUrl: string,
  downloadFileName?: string
): Promise<string | null> {
  if (!pathOrUrl || isBlobUrl(pathOrUrl)) {
    return null;
  }

  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://') || pathOrUrl.startsWith('data:')) {
    return pathOrUrl;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(
      pathOrUrl,
      3600,
      downloadFileName ? { download: downloadFileName } : undefined
    );

  if (error || !data?.signedUrl) {
    return null;
  }

  return data.signedUrl;
}
