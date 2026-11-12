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
  // Always produce a self-contained Data URL so previews, downloads, and rendering
  // work instantaneously without relying on unstable remote storage buckets.
  let dataUrl: string | null = null;
  try {
    dataUrl = await readFileAsDataUrl(file);
  } catch (err: any) {
    console.warn('[uploadDocumentFile] Failed to read file as data URL:', err?.message || err);
  }

  const supabase = getSupabaseClient();
  if (supabase) {
    // Optionally mirror file to Supabase storage in background without failing user experience
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
    const storagePath = `${workspaceId}/${docId}/${Date.now()}-${uniqueSuffix}-${safeName}`;

    supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'application/octet-stream',
      })
      .then(({ error }) => {
        if (error) {
          console.warn('[uploadDocumentFile] Background Supabase upload note:', error.message);
        }
      })
      .catch((err) => {
        console.warn('[uploadDocumentFile] Background Supabase upload error:', err?.message || err);
      });
  }

  if (dataUrl) {
    return { path: dataUrl };
  }

  return { path: null, error: 'Could not read file data.' };
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
      const parts = pathOrUrl.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
      const binary = atob(parts[1]);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      return { blob: new Blob([array], { type: mime }) };
    } catch {
      try {
        const resp = await fetch(pathOrUrl);
        const blob = await resp.blob();
        return { blob };
      } catch {
        return { blob: null, error: 'Failed to convert data URL to file.' };
      }
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
    return { blob: null, error: 'Storage is not configured.' };
  }

  // 1. Try direct SDK download first (avoids /object/sign 500)
  try {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .download(pathOrUrl);

    if (!error && data && data.size > 0) {
      return { blob: data };
    }
  } catch (err: any) {
    console.warn('[downloadDocumentBlob] SDK download error:', err?.message || err);
  }

  // 2. Try public URL
  try {
    const { data: pubData } = supabase.storage
      .from(DOCUMENTS_BUCKET)
      .getPublicUrl(pathOrUrl);

    if (pubData?.publicUrl) {
      const resp = await fetch(pubData.publicUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob.size > 0) return { blob };
      }
    }
  } catch {
    // ignore
  }

  // 3. Fallback: try createSignedUrl only as last resort inside try/catch
  try {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(pathOrUrl, 3600);

    if (!error && data?.signedUrl) {
      const resp = await fetch(data.signedUrl);
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob.size > 0) return { blob };
      }
    }
  } catch (err: any) {
    console.warn('[downloadDocumentBlob] Signed URL fallback note:', err?.message || err);
  }

  return { blob: null, error: 'File not found in storage.' };
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

  try {
    const { data, error } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .createSignedUrl(
        pathOrUrl,
        3600,
        downloadFileName ? { download: downloadFileName } : undefined
      );

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
  } catch {
    // catch 500 error from signed URL endpoint
  }

  try {
    const { data } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(pathOrUrl);
    if (data?.publicUrl) {
      return data.publicUrl;
    }
  } catch {
    // ignore
  }

  return null;
}
