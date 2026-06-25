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
const PENCIL_PRIMITIVE_TYPES = new Set([
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
const PENCIL_STRUCTURE_TYPES = new Set(["ref", "frame", "group"]);
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function assertRecord(value, source) {
    if (isRecord(value))
        return value;
    throw new Error(`[ADR-111] Invalid Pencil payload from ${source}: expected object`);
}
function isPencilNodeType(value) {
    return (typeof value === "string" &&
        (PENCIL_PRIMITIVE_TYPES.has(value) || PENCIL_STRUCTURE_TYPES.has(value)));
}
function isStringArray(value) {
    return (Array.isArray(value) && value.every((item) => typeof item === "string"));
}
function getMetadata(value) {
    return isRecord(value.metadata) ? { ...value.metadata } : {};
}
function getCompositionTypeFromMetadata(metadata) {
    const compositionType = metadata.compositionType;
    if (typeof compositionType !== "string")
        return undefined;
    return /^[A-Z]/.test(compositionType)
        ? compositionType
        : undefined;
}
function assertPencilNode(value, source) {
    const node = assertRecord(value, source);
    if (typeof node.id !== "string" || node.id.length === 0) {
        throw new Error(`[ADR-111] Invalid Pencil import node from ${source}: expected non-empty id`);
    }
    if (node.id.includes("/")) {
        throw new Error(`[ADR-111] Invalid Pencil import node ${node.id}: slash is not allowed in canonical ids`);
    }
    if (!isPencilNodeType(node.type)) {
        throw new Error(`[ADR-111] Invalid Pencil import node ${node.id}: expected supported type`);
    }
    if ("children" in node && node.children !== undefined) {
        if (!Array.isArray(node.children)) {
            throw new Error(`[ADR-111] Invalid Pencil import node ${node.id}: children must be an array`);
        }
    }
    return node;
}
function toCanonicalType(pencilType, metadata) {
    const compositionType = getCompositionTypeFromMetadata(metadata);
    if (compositionType)
        return compositionType;
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
function toPencilType(node) {
    const pencilType = node.metadata?.pencilType;
    if (isPencilNodeType(pencilType))
        return pencilType;
    switch (node.type) {
        case "ref":
        case "frame":
        case "group":
            return node.type;
        case "Text":
            return "text";
        case "Icon":
            return "icon_font";
        // ADR-130 Phase 6: explicit case for legacy "Group" (RAC ARIA semantic).
        // Without this branch the default fall-through still returns "frame", but
        // making it explicit locks in the metadata round-trip priority (header of
        // this function already returns metadata.pencilType when present).
        case "Group":
            return "frame";
        default:
            return "frame";
    }
}
function collectPencilProps(node) {
    const props = {};
    for (const [key, value] of Object.entries(node)) {
        if (PENCIL_NODE_FIELDS.has(key))
            continue;
        props[key] = value;
    }
    return Object.keys(props).length > 0 ? props : undefined;
}
function collectMetadata(node, pencilType) {
    const metadata = getMetadata(node);
    return {
        ...metadata,
        type: typeof metadata.type === "string" ? metadata.type : pencilType,
        pencilType,
    };
}
function collectExportMetadata(node, pencilType) {
    const metadata = isRecord(node.metadata)
        ? { ...node.metadata }
        : {};
    delete metadata.type;
    delete metadata.pencilType;
    delete metadata.legacyProps;
    delete metadata.importedFrom;
    if (pencilType === "frame" &&
        node.type !== "frame" &&
        node.type !== "group") {
        metadata.compositionType =
            typeof metadata.compositionType === "string"
                ? metadata.compositionType
                : node.type;
    }
    return Object.keys(metadata).length > 0 ? metadata : undefined;
}
function importDescendants(value, source) {
    if (value === undefined)
        return undefined;
    const descendants = assertRecord(value, source);
    const result = {};
    for (const [path, override] of Object.entries(descendants)) {
        const overrideRecord = assertRecord(override, `${source}:${path}`);
        if (typeof overrideRecord.type === "string") {
            result[path] = pencilPrimitiveToComponent(overrideRecord, {
                source,
            });
            continue;
        }
        if (Array.isArray(overrideRecord.children)) {
            result[path] = {
                ...overrideRecord,
                children: overrideRecord.children.map((child) => pencilPrimitiveToComponent(child, { source })),
            };
            continue;
        }
        result[path] = { ...overrideRecord };
    }
    return result;
}
function exportDescendants(descendants) {
    if (!descendants)
        return undefined;
    const result = {};
    for (const [path, override] of Object.entries(descendants)) {
        const overrideRecord = override;
        if (!isRecord(overrideRecord))
            continue;
        if (typeof overrideRecord.type === "string" &&
            typeof overrideRecord.id === "string") {
            result[path] = componentToPencilTree(overrideRecord);
            continue;
        }
        if (Array.isArray(overrideRecord.children)) {
            result[path] = {
                ...overrideRecord,
                children: overrideRecord.children
                    .filter((child) => isRecord(child) &&
                    typeof child.id === "string" &&
                    typeof child.type === "string")
                    .map(componentToPencilTree),
            };
            continue;
        }
        result[path] = { ...overrideRecord };
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
function normalizeImports(value, source) {
    if (value === undefined)
        return undefined;
    const imports = assertRecord(value, `${source}:imports`);
    const result = {};
    for (const [key, importSource] of Object.entries(imports)) {
        if (typeof importSource !== "string" || importSource.length === 0) {
            throw new Error(`[ADR-111] Invalid Pencil imports entry ${key}: expected non-empty source`);
        }
        result[key] = importSource;
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
function assignIfPresent(target, source, key) {
    if (key in source && source[key] !== undefined) {
        target[key] = source[key];
    }
}
// ──────────────────────────────────────────────────────────────────────────────
// Import Adapter (pencil `.pen` → composition canonical)
// ──────────────────────────────────────────────────────────────────────────────
export function pencilPrimitiveToComponent(primitive, options = {}) {
    const source = options.source ?? "pencil document";
    const node = assertPencilNode(primitive, source);
    const record = node;
    const metadata = getMetadata(record);
    const canonicalType = toCanonicalType(node.type, metadata);
    const children = node.children?.map((child) => pencilPrimitiveToComponent(child, { source }));
    const props = collectPencilProps(record);
    const canonicalNode = {
        id: node.id,
        type: canonicalType,
        metadata: collectMetadata(record, node.type),
    };
    if (typeof node.name === "string")
        canonicalNode.name = node.name;
    if (options.forceReusable) {
        canonicalNode.reusable = true;
    }
    else if (typeof node.reusable === "boolean") {
        canonicalNode.reusable = node.reusable;
    }
    if (node.children !== undefined)
        canonicalNode.children = children ?? [];
    if (props)
        canonicalNode.props = props;
    if (node.slot === false || isStringArray(node.slot)) {
        canonicalNode.slot = node.slot;
    }
    assignIfPresent(canonicalNode, record, "clip");
    assignIfPresent(canonicalNode, record, "placeholder");
    if (canonicalType === "ref") {
        if (typeof record.ref !== "string" || record.ref.length === 0) {
            throw new Error(`[ADR-111] Invalid Pencil import ref ${node.id}: expected ref`);
        }
        const refNode = {
            ...canonicalNode,
            type: "ref",
            ref: record.ref,
        };
        const descendants = importDescendants(record.descendants, source);
        if (descendants)
            refNode.descendants = descendants;
        return refNode;
    }
    return canonicalNode;
}
export function pencilDocumentToCompositionDocument(document, options = {}) {
    const source = options.source ?? "pencil document";
    const payload = assertRecord(document, source);
    if (!Array.isArray(payload.children)) {
        throw new Error(`[ADR-111] Invalid Pencil document from ${source}: expected children array`);
    }
    const imports = normalizeImports(payload.imports, source);
    return {
        version: DEFAULT_COMPOSITION_VERSION,
        ...(imports ? { imports } : {}),
        children: payload.children.map((child) => pencilPrimitiveToComponent(child, {
            source,
            forceReusable: options.forceTopLevelReusable,
        })),
        _meta: { schemaVersion: CANONICAL_SCHEMA_VERSION },
    };
}
export function pencilNodeToCompositionDocument(node, options = {}) {
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
export function componentToPencilTree(node) {
    const pencilType = toPencilType(node);
    const nodeRecord = node;
    const pencilNode = {
        id: node.id,
        type: pencilType,
    };
    if (isRecord(node.props)) {
        for (const [key, value] of Object.entries(node.props)) {
            if (PENCIL_NODE_FIELDS.has(key))
                continue;
            pencilNode[key] = value;
        }
    }
    if (typeof node.name === "string")
        pencilNode.name = node.name;
    if (typeof node.reusable === "boolean")
        pencilNode.reusable = node.reusable;
    if (node.slot === false || isStringArray(node.slot))
        pencilNode.slot = node.slot;
    assignIfPresent(pencilNode, nodeRecord, "clip");
    assignIfPresent(pencilNode, nodeRecord, "placeholder");
    if (node.type === "ref") {
        pencilNode.ref = node.ref;
        const descendants = exportDescendants(node.descendants);
        if (descendants)
            pencilNode.descendants = descendants;
    }
    if (node.children !== undefined) {
        pencilNode.children = node.children.map(componentToPencilTree);
    }
    const metadata = collectExportMetadata(node, pencilType);
    if (metadata)
        pencilNode.metadata = metadata;
    return pencilNode;
}
export function compositionDocumentToPencilDocument(document, options = {}) {
    return {
        version: options.version ?? DEFAULT_PENCIL_VERSION,
        ...(document.imports ? { imports: { ...document.imports } } : {}),
        children: document.children.map(componentToPencilTree),
    };
}
//# sourceMappingURL=pencil-adapter.types.js.map