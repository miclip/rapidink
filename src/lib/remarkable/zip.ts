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
 * Supports multiple structures:
 * - Standard: {uuid}/ folder with .rm files, sibling {uuid}.metadata/.content/.pdf
 * - Flat: all files in one folder, {uuid}.metadata/.content/.pdf with *.rm files
 */
export async function loadDocumentFromZip(zipData: ArrayBuffer): Promise<RemarkableDocument> {
  const zip = await JSZip.loadAsync(zipData);

  // Find the document UUID from the .metadata filename
  let uuid = '';
  let metadataPath = '';
  zip.forEach((path) => {
    if (path.endsWith('.metadata')) {
      const parts = path.split('/');
      const filename = parts[parts.length - 1];
      uuid = filename.replace('.metadata', '');
      metadataPath = path;
    }
  });

  if (!uuid) {
    throw new Error('No .metadata file found in ZIP');
  }

  // Determine the prefix (folder containing the files)
  const prefix = metadataPath.includes('/') ? metadataPath.substring(0, metadataPath.lastIndexOf('/') + 1) : '';

  // Load metadata
  const metadataFile = zip.file(metadataPath);
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
  const rawPages = new Map<string, Uint8Array>();
  for (const pageUuid of content.pages) {
    const rmFile = zip.file(prefix + pageUuid + '.rm') || zip.file(pageUuid + '.rm');
    if (rmFile) {
      try {
        const rmData = await rmFile.async('uint8array');
        rawPages.set(pageUuid, rmData);  // Store raw bytes
        const parsed = parseRmFile(rmData);
        pages.set(pageUuid, parsed);
      } catch (e) {
        // Still store raw bytes even if parsing fails
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
    rawPages,
    originalPdf,
  };
}

/**
 * Create a ZIP file from a reMarkable document
 * Uses flat structure matching reMarkable's xochitl folder layout
 */
export async function createDocumentZip(
  uuid: string,
  metadata: string,
  content: string,
  rmFiles: Map<string, Uint8Array>,
  pdf?: Uint8Array
): Promise<Blob> {
  const zip = new JSZip();

  // Create folder for the document (contains .rm files)
  const folder = zip.folder(uuid);
  if (!folder) {
    throw new Error('Failed to create folder');
  }

  // Add metadata and content at root level (siblings to the folder)
  zip.file(uuid + '.metadata', metadata);
  zip.file(uuid + '.content', content);

  // Add .rm files inside the uuid folder
  for (const [pageUuid, rmData] of rmFiles) {
    folder.file(pageUuid + '.rm', rmData);
  }

  // Add PDF at root level
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

  // Find UUID and metadata path
  let uuid = '';
  let metadataPath = '';
  zip.forEach((path) => {
    if (path.endsWith('.metadata')) {
      const parts = path.split('/');
      const filename = parts[parts.length - 1];
      uuid = filename.replace('.metadata', '');
      metadataPath = path;
    }
  });

  if (!uuid) {
    throw new Error('Could not determine document UUID');
  }

  // Determine the prefix (folder containing the files)
  const prefix = metadataPath.includes('/') ? metadataPath.substring(0, metadataPath.lastIndexOf('/') + 1) : '';

  // Load metadata
  const metadataFile = zip.file(metadataPath);
  if (!metadataFile) {
    throw new Error('No .metadata file found');
  }
  const metadata = parseMetadata(await metadataFile.async('string'));

  // Load content
  const contentFile = zip.file(prefix + uuid + '.content') || zip.file(uuid + '.content');
  if (!contentFile) {
    throw new Error('No .content file found');
  }
  const content = parseContent(await contentFile.async('string'));

  // Count .rm files
  let pagesWithRmFiles = 0;
  for (const pageUuid of content.pages) {
    const rmFile = zip.file(prefix + pageUuid + '.rm') || zip.file(pageUuid + '.rm');
    if (rmFile) pagesWithRmFiles++;
  }

  // Check for PDF
  const hasPdf = zip.file(prefix + uuid + '.pdf') !== null || zip.file(uuid + '.pdf') !== null;

  return {
    uuid,
    visibleName: metadata.visibleName,
    pageCount: content.pageCount,
    pagesWithRmFiles,
    hasPdf,
  };
}
