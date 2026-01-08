/**
 * Map strokes between old and new pages using RapidInk anchors
 * This enables preserving handwriting when regenerating templates
 */

import type { RmFile, Line, RemarkableDocument, DocumentContent } from './types';
import { parseRmFile } from './parser';
import { writeRmFile, cloneRmFile, createRmFile } from './writer';
import { parseContent, serializeContent, generateUuid } from './content';

/** Page anchor from RapidInk PDF */
export interface PageAnchor {
  pageIndex: number;
  anchor: string; // e.g., "day-2026-01-15", "week-2026-03", "month-2026-01"
}

/** Mapping result for a single page */
export interface PageMappingResult {
  oldPageUuid: string;
  newPageUuid: string;
  oldPageIndex: number;
  newPageIndex: number;
  anchor: string;
  hasStrokes: boolean;
}

/**
 * Build a page mapping between old and new templates based on anchors
 *
 * @param oldAnchors - Anchors from the original template (from PDF)
 * @param newAnchors - Anchors from the new template
 * @param oldContent - Content file from the device document
 * @returns Mapping of old page indices to new page indices
 */
export function buildPageMapping(
  oldAnchors: PageAnchor[],
  newAnchors: PageAnchor[],
  oldContent: DocumentContent
): PageMappingResult[] {
  const results: PageMappingResult[] = [];

  // Create a map of anchor -> new page index
  const newAnchorMap = new Map<string, number>();
  for (const { pageIndex, anchor } of newAnchors) {
    newAnchorMap.set(anchor, pageIndex);
  }

  // Match old pages to new pages by anchor
  for (const { pageIndex: oldIndex, anchor } of oldAnchors) {
    const newIndex = newAnchorMap.get(anchor);
    if (newIndex !== undefined && oldIndex < oldContent.pages.length) {
      results.push({
        oldPageUuid: oldContent.pages[oldIndex],
        newPageUuid: '', // Will be filled in later
        oldPageIndex: oldIndex,
        newPageIndex: newIndex,
        anchor,
        hasStrokes: false, // Will be determined when processing .rm files
      });
    }
  }

  return results;
}

/**
 * Map strokes from old .rm files to new pages
 *
 * @param oldPages - Map of page UUID -> .rm file data
 * @param mapping - Page mapping results
 * @param newPageCount - Total pages in new template
 * @returns Map of new page UUID -> .rm file data
 */
export function mapStrokes(
  oldPages: Map<string, Uint8Array>,
  mapping: PageMappingResult[],
  newPageCount: number
): { newPages: Map<string, Uint8Array>; newContent: DocumentContent } {
  const newPages = new Map<string, Uint8Array>();

  // Generate new page UUIDs
  const newPageUuids: string[] = [];
  for (let i = 0; i < newPageCount; i++) {
    newPageUuids.push(generateUuid());
  }

  // Update mapping with new UUIDs
  for (const result of mapping) {
    result.newPageUuid = newPageUuids[result.newPageIndex];
  }

  // Process each mapped page
  for (const result of mapping) {
    const oldRmData = oldPages.get(result.oldPageUuid);
    if (!oldRmData) continue;

    try {
      // Parse the old .rm file
      const rmFile = parseRmFile(oldRmData);

      // Check if it has any strokes
      result.hasStrokes = rmFile.lines.length > 0;

      if (result.hasStrokes) {
        // Write back the .rm file for the new page
        // The strokes themselves don't need modification - just the file name changes
        const newRmData = writeRmFile(rmFile);
        newPages.set(result.newPageUuid, newRmData);
      }
    } catch (e) {
      console.warn(`Failed to process page ${result.oldPageUuid}:`, e);
    }
  }

  // Create new content structure
  const newContent: DocumentContent = {
    fileType: 'pdf',
    formatVersion: 2,
    pageCount: newPageCount,
    pages: newPageUuids,
    orientation: 'portrait',
  };

  return { newPages, newContent };
}

/**
 * Create a coordinate transform for mapping strokes to different page dimensions
 * Used when the template page size changes
 */
export interface CoordinateTransform {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Calculate transform between old and new page dimensions
 */
export function calculateTransform(
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number
): CoordinateTransform {
  return {
    scaleX: newWidth / oldWidth,
    scaleY: newHeight / oldHeight,
    offsetX: 0,
    offsetY: 0,
  };
}

/**
 * Apply coordinate transform to strokes
 */
export function transformStrokes(lines: Line[], transform: CoordinateTransform): Line[] {
  return lines.map((line) => ({
    ...line,
    points: line.points.map((point) => ({
      ...point,
      x: point.x * transform.scaleX + transform.offsetX,
      y: point.y * transform.scaleY + transform.offsetY,
      width: Math.round(point.width * Math.min(transform.scaleX, transform.scaleY)),
    })),
  }));
}

/**
 * Full document migration - takes old device files and new template,
 * produces new device files with strokes preserved
 */
export interface MigrationInput {
  /** Content from old .content file */
  oldContent: DocumentContent;
  /** Map of page UUID -> .rm file bytes from old document */
  oldRmFiles: Map<string, Uint8Array>;
  /** Page anchors extracted from old PDF */
  oldAnchors: PageAnchor[];
  /** Page anchors from new template */
  newAnchors: PageAnchor[];
  /** Total pages in new template */
  newPageCount: number;
  /** New PDF bytes */
  newPdf: Uint8Array;
  /** Document name */
  visibleName: string;
}

export interface MigrationOutput {
  /** New .content JSON */
  content: string;
  /** New .metadata JSON */
  metadata: string;
  /** Map of page UUID -> .rm file bytes */
  rmFiles: Map<string, Uint8Array>;
  /** New PDF bytes */
  pdf: Uint8Array;
  /** Summary of what was migrated */
  summary: {
    totalOldPages: number;
    totalNewPages: number;
    mappedPages: number;
    pagesWithStrokes: number;
  };
}

/**
 * Perform full document migration
 */
export function migrateDocument(input: MigrationInput): MigrationOutput {
  // Build page mapping
  const mapping = buildPageMapping(input.oldAnchors, input.newAnchors, input.oldContent);

  // Map strokes to new pages
  const { newPages, newContent } = mapStrokes(
    input.oldRmFiles,
    mapping,
    input.newPageCount
  );

  // Create metadata
  const now = new Date().toISOString();
  const metadata = {
    deleted: false,
    lastModified: now,
    lastOpened: now,
    lastOpenedPage: 0,
    metadatamodified: false,
    modified: true,
    parent: '',
    pinned: false,
    synced: false,
    type: 'DocumentType',
    version: 1,
    visibleName: input.visibleName,
  };

  // Calculate summary
  const pagesWithStrokes = mapping.filter((m) => m.hasStrokes).length;

  return {
    content: serializeContent(newContent),
    metadata: JSON.stringify(metadata, null, 2),
    rmFiles: newPages,
    pdf: input.newPdf,
    summary: {
      totalOldPages: input.oldContent.pageCount,
      totalNewPages: input.newPageCount,
      mappedPages: mapping.length,
      pagesWithStrokes,
    },
  };
}
