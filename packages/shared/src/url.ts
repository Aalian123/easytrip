/**
 * Evidence and documents are external links (Google Drive and similar), never
 * uploads. Everything stored is a URL, so every URL is validated on the way in.
 */

const ALLOWED_PROTOCOLS = ['http:', 'https:'];

export const LinkProvider = {
  GOOGLE_DRIVE: 'GOOGLE_DRIVE',
  DROPBOX: 'DROPBOX',
  ONEDRIVE: 'ONEDRIVE',
  GOOGLE_PHOTOS: 'GOOGLE_PHOTOS',
  YOUTUBE: 'YOUTUBE',
  OTHER: 'OTHER',
} as const;
export type LinkProvider = (typeof LinkProvider)[keyof typeof LinkProvider];

export function isSafeExternalUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) return false;
  return parsed.hostname.length > 0;
}

export function detectLinkProvider(value: string): LinkProvider {
  let host: string;
  try {
    host = new URL(value.trim()).hostname.toLowerCase();
  } catch {
    return LinkProvider.OTHER;
  }
  if (host.endsWith('drive.google.com') || host.endsWith('docs.google.com')) return LinkProvider.GOOGLE_DRIVE;
  if (host.endsWith('photos.google.com') || host.endsWith('photos.app.goo.gl')) return LinkProvider.GOOGLE_PHOTOS;
  if (host.endsWith('dropbox.com')) return LinkProvider.DROPBOX;
  if (host.includes('onedrive') || host.endsWith('1drv.ms') || host.endsWith('sharepoint.com'))
    return LinkProvider.ONEDRIVE;
  if (host.endsWith('youtube.com') || host.endsWith('youtu.be')) return LinkProvider.YOUTUBE;
  return LinkProvider.OTHER;
}

export const LINK_PROVIDER_LABELS: Record<LinkProvider, string> = {
  GOOGLE_DRIVE: 'Google Drive',
  DROPBOX: 'Dropbox',
  ONEDRIVE: 'OneDrive',
  GOOGLE_PHOTOS: 'Google Photos',
  YOUTUBE: 'YouTube',
  OTHER: 'Link',
};
