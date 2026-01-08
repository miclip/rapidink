/**
 * Handle ZIP archives for reMarkable document folders
 */

import JSZip from 'jszip';
import type { RemarkableDocument, DocumentContent, DocumentMetadata, RmFile } from './types';
import { parseContent, parseMetadata, serializeContent } from './content';
import { parseRmFile } from './parser';
import { writeRmFile } from './writer';

/**
 * Load a reMarkable document from a ZIP file
 * Expected structure: {uuid}/ containing .content, .metadata, .rm files, and optionally .pdf
 */
export async function loadDocumentFromZip(zipData: ArrayBuffer): Promise<RemarkableDocument> {
  const zip = await JSZip.loadAsync(zipData);

  // Find the document UUID (root folder)
  const folders = new Set<string>();
  zip.forEach((path) => {
    const parts = path.split('/');
    if (parts[0] && !parts[0].includes('.')) {
      folders.add(parts[0]);
    }
  });

  if (folders.size === 0) {
    throw new Error('No document folder found in ZIP');
  }
  if (folders.size > 1) {
    throw new Error('Multiple document folders found in ZIP - please include only one document');
  }

  const uuid = Array.from(folders)[0];
  const prefix = uuid + '/';

  // Load metadata
  const metadataFile = zip.file(uuid + '.metadata') || zip.file(prefix + uuid + '.metadata');
  if (!metadataFile) {
    throw new Error('No .metadata file found');
  }
  const metadataJson = await metadataFile.async('string');
  const metadata = parseMetadata(metadataJson);

  // Load content
  const contentFile = zip.file(uuid + '.content') || zip.file(prefix + uuid + '.content');
  if (!contentFile) {
    throw new Error('No .content file found');
  }
  const contentJson = await contentFile.async('string');
  const content = parseContent(contentJson);

  // Load .rm files for each page
  const pages = new Map<string, RmFile>();
  for (const pageUuid of content.pages) {
    const rmFile = zip.file(prefix + pageUuid + '.rm') || zip.file(pageUuid + '.rm');
    if (rmFile) {
      try {
        const rmData = await rmFile.async('uint8array');
        const parsed = parseRmFile(rmData);
        pages.set(pageUuid, parsed);
      } catch (e) {
        console.warn(`Failed to parse .rm file for page ${pageUuid}:`, e);
      }
    }
  }

  // Load original PDF if present
  let originalPdf: Uint8Array | undefined;
  const pdfFile = zip.file(uuid + '.pdf') || zip.file(prefix + uuid + '.pdf');
  if (pdfFile) {
    originalPdf = await pdfFile.async('uint8array');
  }

  return {
    uuid,
    metadata,
    content,
    pages,
    originalPdf,
  };
}

/**
 * Create a ZIP file from a reMarkable document
 */
export async function createDocumentZip(
  uuid: string,
  metadata: string,
  content: string,
  rmFiles: Map<string, Uint8Array>,
  pdf?: Uint8Array
): Promise<Blob> {
  const zip = new JSZip();

  // Create the document folder
  const folder = zip.folder(uuid);
  if (!folder) {
    throw new Error('Failed to create folder');
  }

  // Add metadata and content
  zip.file(uuid + '.metadata', metadata);
  zip.file(uuid + '.content', content);

  // Add .rm files
  for (const [pageUuid, rmData] of rmFiles) {
    folder.file(pageUuid + '.rm', rmData);
  }

  // Add PDF if provided
  if (pdf) {
    zip.file(uuid + '.pdf', pdf);
  }

  // Generate ZIP
  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Quick check if a ZIP looks like a reMarkable document
 */
export async function isRemarkableDocumentZip(zipData: ArrayBuffer): Promise<boolean> {
  try {
    const zip = await JSZip.loadAsync(zipData);
    let hasContent = false;
    let hasMetadata = false;

    zip.forEach((path) => {
      if (path.endsWith('.content')) hasContent = true;
      if (path.endsWith('.metadata')) hasMetadata = true;
    });

    return hasContent && hasMetadata;
  } catch {
    return false;
  }
}

/**
 * Get summary info about a reMarkable document ZIP without fully parsing
 */
export interface DocumentZipInfo {
  uuid: string;
  visibleName: string;
  pageCount: number;
  pagesWithRmFiles: number;
  hasPdf: boolean;
}

export async function getDocumentZipInfo(zipData: ArrayBuffer): Promise<DocumentZipInfo> {
  const zip = await JSZip.loadAsync(zipData);

  // Find UUID
  let uuid = '';
  zip.forEach((path) => {
    if (path.endsWith('.metadata')) {
      const parts = path.split('/');
      const filename = parts[parts.length - 1];
      uuid = filename.replace('.metadata', '');
    }
  });

  if (!uuid) {
    throw new Error('Could not determine document UUID');
  }

  // Load metadata
  const metadataFile = zip.file(uuid + '.metadata') || zip.file(uuid + '/' + uuid + '.metadata');
  if (!metadataFile) {
    throw new Error('No .metadata file found');
  }
  const metadata = parseMetadata(await metadataFile.async('string'));

  // Load content
  const contentFile = zip.file(uuid + '.content') || zip.file(uuid + '/' + uuid + '.content');
  if (!contentFile) {
    throw new Error('No .content file found');
  }
  const content = parseContent(await contentFile.async('string'));

  // Count .rm files
  let pagesWithRmFiles = 0;
  for (const pageUuid of content.pages) {
    const rmFile = zip.file(uuid + '/' + pageUuid + '.rm') || zip.file(pageUuid + '.rm');
    if (rmFile) pagesWithRmFiles++;
  }

  // Check for PDF
  const hasPdf = zip.file(uuid + '.pdf') !== null || zip.file(uuid + '/' + uuid + '.pdf') !== null;

  return {
    uuid,
    visibleName: metadata.visibleName,
    pageCount: content.pageCount,
    pagesWithRmFiles,
    hasPdf,
  };
}
