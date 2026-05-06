/**
 * @fileoverview Pencil Import/Export Adapter Contracts — ADR-903 P0 + ADR-111 G5
 *
 * composition canonical은 pencil primitive 편집 도구가 아니다. 목적:
 *   (a) 필드명/구조 정합 (type, reusable, ref, descendants, slot)
 *   (b) adapter 경유 import/export 가능성
 *
 * ADR-111 G5 에서 stub 계약을 순수 매핑 함수로 승격했다. Builder UX/API 계층은
 * `apps/builder/src/adapters/pencil/**` 에서 document-level wrapper 로 노출한다.
 */

import type {
  CanonicalNode,
  CompositionDocument,
  DescendantOverride,
  RefNode,
} from "./composition-document.types";

// ──────────────────────────────────────────────────────────────────────────────
// Pencil Type Vocabularies
// ──────────────────────────────────────────────────────────────────────────────

/**
 * pencil primitive 10종 — composition canonical에 직접 값으로 등장하지 않음.
 * import/export adapter 경유 변환만 허용한다.
 */
export type PencilPrimitiveType =
  | "rectangle"
  | "ellipse"
  | "line"
  | "polygon"
  | "path"
  | "text"
  | "note"
  | "prompt"
  | "context"
  | "icon_font";

/**
 * pencil 공용 구조 타입 3종 — composition canonical에서도 직접 사용.
 * `ComponentTag` 값 공간에 포함된다.
 */
export type PencilStructureType = "ref" | "frame" | "group";

export type PencilNodeType = PencilPrimitiveType | PencilStructureType;

export type PencilDescendantOverride = Record<string, unknown>;

// ──────────────────────────────────────────────────────────────────────────────
// Pencil Document / Node
// ──────────────────────────────────────────────────────────────────────────────

export interface PencilDocument {
  version?: string;
  imports?: Record<string, string>;
  children: PencilNode[];
  [k: string]: unknown;
}

/**
 * pencil `.pen` schema의 node 기본 형태.
 *
 * 전체 primitive schema(Fill/Stroke/Effect/Shape/Text/Flexbox/IconFont 상세)는
 * Spec 계층 책임이다. 본 adapter 는 structural compatibility 와 roundtrip
 * 가능한 payload 보존만 담당한다.
 */
export interface PencilNode {
  id: string;
  type: PencilNodeType;
  name?: string;
  reusable?: boolean;
  ref?: string;
  descendants?: Record<string, PencilDescendantOverride>;
  slot?: false | string[];
  clip?: unknown;
  placeholder?: boolean;
  metadata?: Record<string, unknown>;
  children?: PencilNode[];
  [k: string]: unknown;
}

export interface PencilImportOptions {
  /** 오류 메시지와 trace metadata 에 사용하는 source label. */
  source?: string;
  /** import registry 처럼 top-level `.pen` node 를 reusable master 로 승격할 때 사용. */
  forceReusable?: boolean;
}

export interface PencilDocumentImportOptions {
  source?: string;
  /**
   * ADR-116 import registry 는 외부 `.pen` 의 top-level node 를 reusable master 로
   * 소비한다. 일반 file open/roundtrip adapter 는 원본 `reusable` 값을 보존한다.
   */
  forceTopLevelReusable?: boolean;
}

export interface PencilExportOptions {
  version?: string;
}

const DEFAULT_COMPOSITION_VERSION = "composition-1.0";
const DEFAULT_PENCIL_VERSION = "2.10";
const CANONICAL_SCHEMA_VERSION = "canonical-primary-1.0";

const PENCIL_NODE_FIELDS = new Set([
  "id",
  "type",
  "children",
  "metadata",
  "reusable",
  "ref",
  "descendants",
  "slot",
  "name",
  "clip",
  "placeholder",
]);

const PENCIL_PRIMITIVE_TYPES = new Set<string>([
  "rectangle",
  "ellipse",
  "line",
  "polygon",
  "path",
  "text",
  "note",
  "prompt",
  "context",
  "icon_font",
]);

const PENCIL_STRUCTURE_TYPES = new Set<string>(["ref", "frame", "group"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertRecord(value: unknown, source: string): Record<string, unknown> {
  if (isRecord(value)) return value;
  throw new Error(
    `[ADR-111] Invalid Pencil payload from ${source}: expected object`,
  );
}

function isPencilNodeType(value: unknown): value is PencilNodeType {
  return (
    typeof value === "string" &&
    (PENCIL_PRIMITIVE_TYPES.has(value) || PENCIL_STRUCTURE_TYPES.has(value))
  );
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function getMetadata(value: Record<string, unknown>): Record<string, unknown> {
  return isRecord(value.metadata) ? { ...value.metadata } : {};
}

function getCompositionTypeFromMetadata(
  metadata: Record<string, unknown>,
): CanonicalNode["type"] | undefined {
  const compositionType = metadata.compositionType;
  if (typeof compositionType !== "string") return undefined;

  return /^[A-Z]/.test(compositionType)
    ? (compositionType as CanonicalNode["type"])
    : undefined;
}

function assertPencilNode(value: unknown, source: string): PencilNode {
  const node = assertRecord(value, source);
  if (typeof node.id !== "string" || node.id.length === 0) {
    throw new Error(
      `[ADR-111] Invalid Pencil import node from ${source}: expected non-empty id`,
    );
  }
  if (node.id.includes("/")) {
    throw new Error(
      `[ADR-111] Invalid Pencil import node ${node.id}: slash is not allowed in canonical ids`,
    );
  }
  if (!isPencilNodeType(node.type)) {
    throw new Error(
      `[ADR-111] Invalid Pencil import node ${node.id}: expected supported type`,
    );
  }
  if ("children" in node && node.children !== undefined) {
    if (!Array.isArray(node.children)) {
      throw new Error(
        `[ADR-111] Invalid Pencil import node ${node.id}: children must be an array`,
      );
    }
  }

  return node as unknown as PencilNode;
}

function toCanonicalType(
  pencilType: PencilNodeType,
  metadata: Record<string, unknown>,
): CanonicalNode["type"] {
  const compositionType = getCompositionTypeFromMetadata(metadata);
  if (compositionType) return compositionType;

  switch (pencilType) {
    case "ref":
      return "ref";
    case "frame":
    case "group":
    case "rectangle":
    case "ellipse":
    case "line":
    case "polygon":
    case "path":
      return "frame";
    case "text":
      return "Text";
    case "icon_font":
      return "Icon";
    case "note":
    case "prompt":
    case "context":
      return "Text";
  }
}

function toPencilType(node: CanonicalNode): PencilNodeType {
  const pencilType = node.metadata?.pencilType;
  if (isPencilNodeType(pencilType)) return pencilType;

  switch (node.type) {
    case "ref":
    case "frame":
    case "group":
      return node.type;
    case "Text":
      return "text";
    case "Icon":
      return "icon_font";
    default:
      return "frame";
  }
}

function collectPencilProps(
  node: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const props: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (PENCIL_NODE_FIELDS.has(key)) continue;
    props[key] = value;
  }

  return Object.keys(props).length > 0 ? props : undefined;
}

function collectMetadata(
  node: Record<string, unknown>,
  pencilType: PencilNodeType,
): CanonicalNode["metadata"] {
  const metadata = getMetadata(node);
  return {
    ...metadata,
    type: typeof metadata.type === "string" ? metadata.type : pencilType,
    pencilType,
  };
}

function collectExportMetadata(
  node: CanonicalNode,
  pencilType: PencilNodeType,
): Record<string, unknown> | undefined {
  const metadata: Record<string, unknown> = isRecord(node.metadata)
    ? { ...node.metadata }
    : {};

  delete metadata.type;
  delete metadata.pencilType;
  delete metadata.legacyProps;
  delete metadata.importedFrom;

  if (
    pencilType === "frame" &&
    node.type !== "frame" &&
    node.type !== "group"
  ) {
    metadata.compositionType =
      typeof metadata.compositionType === "string"
        ? metadata.compositionType
        : node.type;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function importDescendants(
  value: unknown,
  source: string,
): Record<string, DescendantOverride> | undefined {
  if (value === undefined) return undefined;
  const descendants = assertRecord(value, source);
  const result: Record<string, DescendantOverride> = {};

  for (const [path, override] of Object.entries(descendants)) {
    const overrideRecord = assertRecord(override, `${source}:${path}`);

    if (typeof overrideRecord.type === "string") {
      result[path] = pencilPrimitiveToComponent(overrideRecord as PencilNode, {
        source,
      }) as DescendantOverride;
      continue;
    }

    if (Array.isArray(overrideRecord.children)) {
      result[path] = {
        ...overrideRecord,
        children: overrideRecord.children.map((child) =>
          pencilPrimitiveToComponent(child, { source }),
        ),
      } as DescendantOverride;
      continue;
    }

    result[path] = { ...overrideRecord } as DescendantOverride;
  }

  return result;
}

function exportDescendants(
  descendants: RefNode["descendants"] | undefined,
): Record<string, PencilDescendantOverride> | undefined {
  if (!descendants) return undefined;
  const result: Record<string, PencilDescendantOverride> = {};

  for (const [path, override] of Object.entries(descendants)) {
    const overrideRecord: unknown = override;
    if (!isRecord(overrideRecord)) continue;

    if (
      typeof overrideRecord.type === "string" &&
      typeof overrideRecord.id === "string"
    ) {
      result[path] = componentToPencilTree(
        overrideRecord as unknown as CanonicalNode,
      );
      continue;
    }

    if (Array.isArray(overrideRecord.children)) {
      result[path] = {
        ...overrideRecord,
        children: overrideRecord.children
          .filter(
            (child): child is CanonicalNode =>
              isRecord(child) &&
              typeof child.id === "string" &&
              typeof child.type === "string",
          )
          .map(componentToPencilTree),
      };
      continue;
    }

    result[path] = { ...overrideRecord };
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function normalizeImports(
  value: unknown,
  source: string,
): Record<string, string> | undefined {
  if (value === undefined) return undefined;
  const imports = assertRecord(value, `${source}:imports`);
  const result: Record<string, string> = {};

  for (const [key, importSource] of Object.entries(imports)) {
    if (typeof importSource !== "string" || importSource.length === 0) {
      throw new Error(
        `[ADR-111] Invalid Pencil imports entry ${key}: expected non-empty source`,
      );
    }
    result[key] = importSource;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function assignIfPresent(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
  key: string,
): void {
  if (key in source && source[key] !== undefined) {
    target[key] = source[key];
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Import Adapter (pencil `.pen` → composition canonical)
// ──────────────────────────────────────────────────────────────────────────────

export function pencilPrimitiveToComponent(
  primitive: PencilNode,
  options: PencilImportOptions = {},
): CanonicalNode {
  const source = options.source ?? "pencil document";
  const node = assertPencilNode(primitive, source);
  const record = node as Record<string, unknown>;
  const metadata = getMetadata(record);
  const canonicalType = toCanonicalType(node.type, metadata);
  const children = node.children?.map((child) =>
    pencilPrimitiveToComponent(child, { source }),
  );
  const props = collectPencilProps(record);

  const canonicalNode: CanonicalNode & Record<string, unknown> = {
    id: node.id,
    type: canonicalType,
    metadata: collectMetadata(record, node.type),
  };

  if (typeof node.name === "string") canonicalNode.name = node.name;
  if (options.forceReusable) {
    canonicalNode.reusable = true;
  } else if (typeof node.reusable === "boolean") {
    canonicalNode.reusable = node.reusable;
  }
  if (node.children !== undefined) canonicalNode.children = children ?? [];
  if (props) canonicalNode.props = props;
  if (node.slot === false || isStringArray(node.slot)) {
    canonicalNode.slot = node.slot;
  }
  assignIfPresent(canonicalNode, record, "clip");
  assignIfPresent(canonicalNode, record, "placeholder");

  if (canonicalType === "ref") {
    if (typeof record.ref !== "string" || record.ref.length === 0) {
      throw new Error(
        `[ADR-111] Invalid Pencil import ref ${node.id}: expected ref`,
      );
    }

    const refNode: RefNode = {
      ...(canonicalNode as CanonicalNode),
      type: "ref",
      ref: record.ref,
    };
    const descendants = importDescendants(record.descendants, source);
    if (descendants) refNode.descendants = descendants;
    return refNode;
  }

  return canonicalNode as CanonicalNode;
}

export function pencilDocumentToCompositionDocument(
  document: PencilDocument,
  options: PencilDocumentImportOptions = {},
): CompositionDocument {
  const source = options.source ?? "pencil document";
  const payload = assertRecord(document, source);
  if (!Array.isArray(payload.children)) {
    throw new Error(
      `[ADR-111] Invalid Pencil document from ${source}: expected children array`,
    );
  }

  const imports = normalizeImports(payload.imports, source);

  return {
    version: DEFAULT_COMPOSITION_VERSION,
    ...(imports ? { imports } : {}),
    children: payload.children.map((child) =>
      pencilPrimitiveToComponent(child, {
        source,
        forceReusable: options.forceTopLevelReusable,
      }),
    ),
    _meta: { schemaVersion: CANONICAL_SCHEMA_VERSION },
  };
}

export function pencilNodeToCompositionDocument(
  node: PencilNode,
  options: PencilDocumentImportOptions = {},
): CompositionDocument {
  return {
    version: DEFAULT_COMPOSITION_VERSION,
    children: [
      pencilPrimitiveToComponent(node, {
        source: options.source,
        forceReusable: options.forceTopLevelReusable,
      }),
    ],
    _meta: { schemaVersion: CANONICAL_SCHEMA_VERSION },
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Export Adapter (composition canonical → pencil `.pen`)
// ──────────────────────────────────────────────────────────────────────────────

export function componentToPencilTree(node: CanonicalNode): PencilNode {
  const pencilType = toPencilType(node);
  const nodeRecord = node as CanonicalNode & Record<string, unknown>;
  const pencilNode: Record<string, unknown> = {
    id: node.id,
    type: pencilType,
  };

  if (isRecord(node.props)) {
    for (const [key, value] of Object.entries(node.props)) {
      if (PENCIL_NODE_FIELDS.has(key)) continue;
      pencilNode[key] = value;
    }
  }

  if (typeof node.name === "string") pencilNode.name = node.name;
  if (typeof node.reusable === "boolean") pencilNode.reusable = node.reusable;
  if (node.slot === false || isStringArray(node.slot))
    pencilNode.slot = node.slot;
  assignIfPresent(pencilNode, nodeRecord, "clip");
  assignIfPresent(pencilNode, nodeRecord, "placeholder");

  if (node.type === "ref") {
    pencilNode.ref = (node as RefNode).ref;
    const descendants = exportDescendants((node as RefNode).descendants);
    if (descendants) pencilNode.descendants = descendants;
  }

  if (node.children !== undefined) {
    pencilNode.children = node.children.map(componentToPencilTree);
  }

  const metadata = collectExportMetadata(node, pencilType);
  if (metadata) pencilNode.metadata = metadata;

  return pencilNode as PencilNode;
}

export function compositionDocumentToPencilDocument(
  document: CompositionDocument,
  options: PencilExportOptions = {},
): PencilDocument {
  return {
    version: options.version ?? DEFAULT_PENCIL_VERSION,
    ...(document.imports ? { imports: { ...document.imports } } : {}),
    children: document.children.map(componentToPencilTree),
  };
}
