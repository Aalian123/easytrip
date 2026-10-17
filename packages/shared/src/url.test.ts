import { describe, expect, it } from 'vitest';
import { detectLinkProvider, isSafeExternalUrl, LinkProvider } from './url';

describe('isSafeExternalUrl', () => {
  it('accepts http and https links', () => {
    expect(isSafeExternalUrl('https://drive.google.com/file/d/abc/view')).toBe(true);
    expect(isSafeExternalUrl('http://example.com/photo.jpg')).toBe(true);
  });

  it('rejects script and data urls', () => {
    expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeExternalUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
  });

  it('rejects anything that is not a url', () => {
    expect(isSafeExternalUrl('drive.google.com/file')).toBe(false);
    expect(isSafeExternalUrl('')).toBe(false);
  });
});

describe('detectLinkProvider', () => {
  it('names the common drives', () => {
    expect(detectLinkProvider('https://drive.google.com/file/d/abc/view')).toBe(LinkProvider.GOOGLE_DRIVE);
    expect(detectLinkProvider('https://www.dropbox.com/s/abc/photo.jpg')).toBe(LinkProvider.DROPBOX);
    expect(detectLinkProvider('https://youtu.be/abc')).toBe(LinkProvider.YOUTUBE);
  });

  it('falls back to a generic link', () => {
    expect(detectLinkProvider('https://example.com/photo.jpg')).toBe(LinkProvider.OTHER);
  });
});
