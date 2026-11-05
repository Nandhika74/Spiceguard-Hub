import { getSupabaseClient, getSupabaseCredentials } from './supabase';

export const DOCUMENTS_BUCKET = 'spiceguard-documents';

function isApplicationUrl(value: string): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const url = new URL(value);
    return /^https?:$/.test(url.protocol) && url.origin === window.location.origin;
  } catch {
    return false;
  }
}

export function getDocumentStoragePath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || isApplicationUrl(trimmed)) return null;

  try {
    const url = new URL(trimmed);
    const pathMatch = url.pathname.match(
      new RegExp(`/storage/v1/object/(?:public|sign|authenticated)/${DOCUMENTS_BUCKET}/(.+)$`)
    );
    return pathMatch ? decodeURIComponent(pathMatch[1]) : null;
  } catch {
    if (/^(?:\/|#|\?)/.test(trimmed)) return null;
    return trimmed.replace(/^\/+/, '');
  }
}

export async function getSignedDocumentUrl(fileUrl: string): Promise<string> {
  const source = fileUrl.trim();
  if (!source) {
    throw new Error('This document does not have a file path.');
  }

  const storagePath = getDocumentStoragePath(source);
  console.debug('[DocumentPreview] storage path', {
    fileUrl: source,
    storagePath,
  });
  if (!storagePath) {
    if (isApplicationUrl(source)) {
      throw new Error('The saved document URL points to the application, not a document.');
    }

    try {
      const externalUrl = new URL(source);
      if (!/^https?:$/.test(externalUrl.protocol)) {
        throw new Error('This document URL is invalid.');
      }
      return externalUrl.toString();
    } catch (error) {
      if (error instanceof Error && error.message !== 'This document URL is invalid.') {
        throw error;
      }
      throw new Error('This document URL is invalid.');
    }
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase is not configured for private document previews.');
  }

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, 3600);

  if (error) {
    throw new Error(`Unable to create a document preview URL: ${error.message}`);
  }
  if (!data?.signedUrl) {
    throw new Error('Supabase returned no document preview URL.');
  }

  try {
    const safeSignedUrl = new URL(data.signedUrl);
    const { url: supabaseUrl } = getSupabaseCredentials();
    const expectedOrigin = new URL(supabaseUrl).origin;
    if (
      safeSignedUrl.origin !== expectedOrigin ||
      !safeSignedUrl.pathname.includes(`/storage/v1/object/sign/${DOCUMENTS_BUCKET}/`)
    ) {
      throw new Error('Supabase returned an invalid document preview URL.');
    }
    console.debug('[DocumentPreview] resolved signed URL', {
      signedUrl: `${safeSignedUrl.origin}${safeSignedUrl.pathname}`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Supabase returned an invalid document preview URL.') {
      throw error;
    }
    throw new Error('Supabase returned an invalid document preview URL.');
  }

  return data.signedUrl;
}
