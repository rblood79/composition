import type {
  BreakpointName,
  CatalogDocument,
  CatalogEntry,
  EntryId,
} from "../document/types";

/**
 * ADR-248 §4.3 Builder ↔ Preview catalog payload. The Builder sends one snapshot when the Preview
 * is ready (or asks for it), then one delta per published step: the changed entries and removed
 * ids between two editor revisions. The Preview never shares the editor's store; it validates and
 * applies each payload on its own graph with the same shared validator and resolver.
 *
 * `version` is the payload version: a message of another version — the old canonical document
 * messages included — is not a catalog payload and is never applied.
 */
export const CATALOG_PREVIEW_PAYLOAD_VERSION = 1 as const;

export interface CatalogPreviewSnapshotMessage {
  readonly type: "CATALOG_SNAPSHOT";
  readonly version: typeof CATALOG_PREVIEW_PAYLOAD_VERSION;
  readonly projectId: EntryId<"project">;
  /** The editor revision this document is at. */
  readonly revision: number;
  readonly document: CatalogDocument;
}
export interface CatalogPreviewDeltaMessage {
  readonly type: "CATALOG_DELTA";
  readonly version: typeof CATALOG_PREVIEW_PAYLOAD_VERSION;
  readonly projectId: EntryId<"project">;
  /** Applies only on a replica at exactly this editor revision. */
  readonly baseRevision: number;
  readonly revision: number;
  /** Entries as they are at `revision`. */
  readonly changed: readonly CatalogEntry[];
  readonly removedIds: readonly EntryId[];
}
export type CatalogPreviewMessage =
  CatalogPreviewSnapshotMessage | CatalogPreviewDeltaMessage;

/** Preview → Builder: send a fresh snapshot (a revision gap, a failed delta, another project). */
export interface CatalogPreviewSnapshotRequest {
  readonly type: "CATALOG_SNAPSHOT_REQUEST";
  readonly version: typeof CATALOG_PREVIEW_PAYLOAD_VERSION;
  /** The project the replica holds, if any. */
  readonly projectId: EntryId<"project"> | null;
  /** The editor revision the replica holds, if any. */
  readonly haveRevision: number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const isRevision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const isProjectId = (value: unknown): value is EntryId<"project"> =>
  typeof value === "string" && value.startsWith("project:project:");

/**
 * The envelope only (type, version, project, revisions, array shapes). Entry and document content
 * is validated by the graph when the payload is applied.
 */
export function parseCatalogPreviewMessage(
  value: unknown,
): CatalogPreviewMessage | null {
  if (!isRecord(value)) return null;
  if (value.type !== "CATALOG_SNAPSHOT" && value.type !== "CATALOG_DELTA")
    return null;
  if (value.version !== CATALOG_PREVIEW_PAYLOAD_VERSION) return null;
  if (!isProjectId(value.projectId) || !isRevision(value.revision)) return null;
  if (value.type === "CATALOG_SNAPSHOT")
    return isRecord(value.document)
      ? (value as unknown as CatalogPreviewSnapshotMessage)
      : null;
  if (
    !isRevision(value.baseRevision) ||
    (value.baseRevision as number) >= (value.revision as number) ||
    !Array.isArray(value.changed) ||
    !value.changed.every(isRecord) ||
    !Array.isArray(value.removedIds) ||
    !value.removedIds.every((id) => typeof id === "string")
  )
    return null;
  return value as unknown as CatalogPreviewDeltaMessage;
}

export function isCatalogPreviewSnapshotRequest(
  value: unknown,
): value is CatalogPreviewSnapshotRequest {
  return (
    isRecord(value) &&
    value.type === "CATALOG_SNAPSHOT_REQUEST" &&
    value.version === CATALOG_PREVIEW_PAYLOAD_VERSION &&
    (value.projectId === null || isProjectId(value.projectId)) &&
    (value.haveRevision === null || isRevision(value.haveRevision))
  );
}

/**
 * Builder → Preview: the page the editor shows (sent after each snapshot and on a page switch).
 * The Preview shows it until its own navigation (a link, a navigate action) moves elsewhere.
 */
export interface CatalogPreviewViewMessage {
  readonly type: "CATALOG_VIEW";
  readonly version: typeof CATALOG_PREVIEW_PAYLOAD_VERSION;
  readonly pageId: EntryId<"page">;
  /** The editor's breakpoint: the Preview resolves the document's tablet/mobile layers at it. */
  readonly breakpoint?: BreakpointName;
}

export function parseCatalogPreviewView(
  value: unknown,
): CatalogPreviewViewMessage | null {
  return isRecord(value) &&
    value.type === "CATALOG_VIEW" &&
    value.version === CATALOG_PREVIEW_PAYLOAD_VERSION &&
    typeof value.pageId === "string" &&
    value.pageId.startsWith("project:page:") &&
    (value.breakpoint === undefined ||
      value.breakpoint === "desktop" ||
      value.breakpoint === "tablet" ||
      value.breakpoint === "mobile")
    ? (value as unknown as CatalogPreviewViewMessage)
    : null;
}

/**
 * Builder → Preview: the data store's collections (H1 — rows never enter the document), sent when
 * the Preview is ready and whenever they change. Bound collections draw their rows from these.
 * Each item is the old Preview channel's collection projection (definition, mock rows, runtime
 * rows); endpoint secrets never travel.
 */
export interface CatalogPreviewDataMessage {
  readonly type: "CATALOG_DATA";
  readonly version: typeof CATALOG_PREVIEW_PAYLOAD_VERSION;
  readonly collections: readonly Readonly<Record<string, unknown>>[];
  /** Project variables (the data store's, H1 — `VariableDef` shape); absent = none. */
  readonly variables?: readonly Readonly<Record<string, unknown>>[];
}

export function parseCatalogPreviewData(
  value: unknown,
): CatalogPreviewDataMessage | null {
  return isRecord(value) &&
    value.type === "CATALOG_DATA" &&
    value.version === CATALOG_PREVIEW_PAYLOAD_VERSION &&
    Array.isArray(value.collections) &&
    value.collections.every(isRecord) &&
    (value.variables === undefined ||
      (Array.isArray(value.variables) && value.variables.every(isRecord)))
    ? (value as unknown as CatalogPreviewDataMessage)
    : null;
}
