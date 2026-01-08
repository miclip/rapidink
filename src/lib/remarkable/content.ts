/**
 * Handle .content and .metadata JSON files from reMarkable documents
 */

import type { DocumentMetadata, DocumentContent, RemarkableDocument } from './types';

/**
 * Parse a .metadata file
 */
export function parseMetadata(json: string): DocumentMetadata {
  const data = JSON.parse(json);
  return {
    deleted: data.deleted ?? false,
    lastModified: data.lastModified ?? '',
    lastOpened: data.lastOpened ?? '',
    lastOpenedPage: data.lastOpenedPage ?? 0,
    metadatamodified: data.metadatamodified ?? false,
    modified: data.modified ?? false,
    parent: data.parent ?? '',
    pinned: data.pinned ?? false,
    synced: data.synced ?? false,
    type: data.type ?? 'DocumentType',
    version: data.version ?? 1,
    visibleName: data.visibleName ?? 'Untitled',
  };
}

/**
 * Serialize a .metadata file
 */
export function serializeMetadata(metadata: DocumentMetadata): string {
  return JSON.stringify(metadata, null, 2);
}

/**
 * Parse a .content file
 */
export function parseContent(json: string): DocumentContent {
  const data = JSON.parse(json);
  return {
    coverPageNumber: data.coverPageNumber,
    documentMetadata: data.documentMetadata,
    dummyDocument: data.dummyDocument,
    extraMetadata: data.extraMetadata,
    fileType: data.fileType ?? 'pdf',
    fontName: data.fontName,
    formatVersion: data.formatVersion ?? 2,
    lineHeight: data.lineHeight,
    margins: data.margins,
    orientation: data.orientation,
    originalPageCount: data.originalPageCount,
    pageCount: data.pageCount ?? 0,
    pages: data.pages ?? [],
    pageTags: data.pageTags,
    sizeInBytes: data.sizeInBytes,
    tags: data.tags,
    textAlignment: data.textAlignment,
    textScale: data.textScale,
    transform: data.transform,
  };
}

/**
 * Serialize a .content file
 */
export function serializeContent(content: DocumentContent): string {
  // Only include defined fields
  const output: Record<string, unknown> = {};

  if (content.coverPageNumber !== undefined) output.coverPageNumber = content.coverPageNumber;
  if (content.documentMetadata !== undefined) output.documentMetadata = content.documentMetadata;
  if (content.dummyDocument !== undefined) output.dummyDocument = content.dummyDocument;
  if (content.extraMetadata !== undefined) output.extraMetadata = content.extraMetadata;
  output.fileType = content.fileType;
  if (content.fontName !== undefined) output.fontName = content.fontName;
  if (content.formatVersion !== undefined) output.formatVersion = content.formatVersion;
  if (content.lineHeight !== undefined) output.lineHeight = content.lineHeight;
  if (content.margins !== undefined) output.margins = content.margins;
  if (content.orientation !== undefined) output.orientation = content.orientation;
  if (content.originalPageCount !== undefined) output.originalPageCount = content.originalPageCount;
  output.pageCount = content.pageCount;
  output.pages = content.pages;
  if (content.pageTags !== undefined) output.pageTags = content.pageTags;
  if (content.sizeInBytes !== undefined) output.sizeInBytes = content.sizeInBytes;
  if (content.tags !== undefined) output.tags = content.tags;
  if (content.textAlignment !== undefined) output.textAlignment = content.textAlignment;
  if (content.textScale !== undefined) output.textScale = content.textScale;
  if (content.transform !== undefined) output.transform = content.transform;

  return JSON.stringify(output, null, 2);
}

/**
 * Generate a new UUID (v4)
 */
export function generateUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a new .content file for a document with given page count
 */
export function createContent(pageCount: number, fileType: string = 'pdf'): DocumentContent {
  const pages = Array.from({ length: pageCount }, () => generateUuid());

  return {
    fileType,
    formatVersion: 2,
    pageCount,
    pages,
    orientation: 'portrait',
  };
}

/**
 * Create a new .metadata file
 */
export function createMetadata(visibleName: string): DocumentMetadata {
  const now = new Date().toISOString();

  return {
    deleted: false,
    lastModified: now,
    lastOpened: now,
    lastOpenedPage: 0,
    metadatamodified: false,
    modified: true,
    parent: '', // Root folder
    pinned: false,
    synced: false,
    type: 'DocumentType',
    version: 1,
    visibleName,
  };
}

/**
 * Update a .content file with new page UUIDs
 * Preserves the page order and generates new UUIDs for new pages
 */
export function updateContentPages(
  content: DocumentContent,
  newPageCount: number,
  pageMapping: Map<number, number> // oldIndex -> newIndex
): { content: DocumentContent; pageUuidMapping: Map<string, string> } {
  const newPages: string[] = [];
  const pageUuidMapping = new Map<string, string>(); // oldUuid -> newUuid

  // Generate new UUIDs for all pages
  for (let i = 0; i < newPageCount; i++) {
    newPages.push(generateUuid());
  }

  // Map old page UUIDs to new page UUIDs based on page mapping
  for (const [oldIndex, newIndex] of pageMapping) {
    if (oldIndex < content.pages.length && newIndex < newPages.length) {
      pageUuidMapping.set(content.pages[oldIndex], newPages[newIndex]);
    }
  }

  return {
    content: {
      ...content,
      pageCount: newPageCount,
      pages: newPages,
    },
    pageUuidMapping,
  };
}
