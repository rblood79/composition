/**
 * Export Utilities
 *
 * 🚀 Phase 10: 프로젝트 Export/Import 유틸리티
 *
 * Builder에서 생성된 프로젝트를 JSON으로 내보내고,
 * Publish 앱에서 로드할 수 있는 기능을 제공합니다.
 *
 * @since 2026-01-02
 * @updated 2026-01-02 Phase 1 - Zod 검증 추가
 */
import { ExportErrorCode, EXPORT_LIMITS, } from "../types/export.types";
import { ExportedProjectSchema } from "../schemas/project.schema";
import { buildRegistryFontFaceCss } from "./fontRegistry";
// ============================================
// Constants
// ============================================
const CURRENT_VERSION = "1.0.0";
const DANGEROUS_KEYS = ["__proto__", "constructor", "prototype"];
export const PAGE_FRAME_ELEMENT_ID_SEPARATOR = "::page-frame::";
const CANONICAL_REF_FIELD = "ref";
const CANONICAL_REF_CHILD_PATCHES_FIELD = "descendants";
const COMPONENT_ROLE_RUNTIME_FIELD = "componentRole";
const COMPONENT_MASTER_RUNTIME_FIELD = "masterId";
const COMPONENT_OVERRIDES_RUNTIME_FIELD = "overrides";
const FRAME_LAYOUT_RUNTIME_FIELD = "layout_id";
const SLOT_NAME_RUNTIME_FIELD = "slot_name";
const LEGACY_PROPS_METADATA_FIELD = "legacyProps";
export function toPageFrameElementId(pageId, frameElementId) {
    return `${pageId}${PAGE_FRAME_ELEMENT_ID_SEPARATOR}${frameElementId}`;
}
function readCanonicalMetadataCustomId(metadata) {
    if (!metadata || Array.isArray(metadata))
        return undefined;
    const customId = metadata.customId;
    if (typeof customId === "string" && customId.length > 0) {
        return customId;
    }
    const legacyProps = metadata[LEGACY_PROPS_METADATA_FIELD];
    if (!legacyProps || typeof legacyProps !== "object")
        return undefined;
    if (Array.isArray(legacyProps))
        return undefined;
    const legacyCustomId = legacyProps.customId;
    return typeof legacyCustomId === "string" && legacyCustomId.length > 0
        ? legacyCustomId
        : undefined;
}
// ============================================
// Error Helpers
// ============================================
/**
 * ExportError 생성 헬퍼
 */
function createError(code, message, options) {
    return {
        code,
        message,
        field: options?.field,
        detail: options?.detail,
        severity: options?.severity ?? "error",
    };
}
/**
 * Zod 에러를 ExportError로 변환
 */
function zodErrorToExportError(zodError) {
    const firstError = zodError.issues[0];
    const field = firstError?.path.map(String).join(".") || undefined;
    const message = firstError?.message || "Validation failed";
    return createError(ExportErrorCode.VALIDATION_ERROR, message, {
        field,
        detail: zodError.issues.length > 1
            ? `+${zodError.issues.length - 1} more errors`
            : undefined,
    });
}
/**
 * 모든 Zod 에러를 ExportError 배열로 변환
 */
function zodErrorsToExportErrors(zodError) {
    return zodError.issues.map((err) => {
        const field = err.path.map(String).join(".") || undefined;
        return createError(ExportErrorCode.VALIDATION_ERROR, err.message, {
            field,
        });
    });
}
// ============================================
// Security Helpers
// ============================================
/**
 * 위험한 키를 필터링하는 JSON 파서
 */
function safeJsonParse(jsonString) {
    return JSON.parse(jsonString, (key, value) => {
        if (DANGEROUS_KEYS.includes(key)) {
            console.warn(`[Security] Blocked dangerous key: ${key}`);
            return undefined;
        }
        return value;
    });
}
/**
 * 파일 크기 검증
 */
function validateFileSize(size) {
    if (size > EXPORT_LIMITS.MAX_FILE_SIZE) {
        return createError(ExportErrorCode.FILE_TOO_LARGE, `File exceeds ${EXPORT_LIMITS.MAX_FILE_SIZE / 1024 / 1024}MB limit`, { detail: `Size: ${(size / 1024 / 1024).toFixed(2)}MB` });
    }
    return null;
}
export const COMPONENTS_PAGE_ROLE = "components";
export const COMPONENTS_PAGE_SLUG = "/__components";
export function isComponentsPageMetadata(metadata) {
    return metadata?.pageRole === COMPONENTS_PAGE_ROLE;
}
export function isEditorPageNode(node) {
    const metadata = node.metadata;
    return (metadata?.type === "page" ||
        metadata?.type === "legacy-page" ||
        (node.type === "frame" && node.reusable !== true));
}
export function isRuntimePageNode(node) {
    if (!isEditorPageNode(node))
        return false;
    return !isComponentsPageMetadata(node.metadata);
}
function extractPageLayoutBinding(node) {
    const metadata = node.metadata;
    if (typeof metadata?.layoutId === "string" && metadata.layoutId.length > 0) {
        return metadata.layoutId;
    }
    const ref = node[CANONICAL_REF_FIELD];
    if (typeof ref === "string" && ref.length > 0) {
        return ref.startsWith("layout-") ? ref.slice("layout-".length) : ref;
    }
    return null;
}
function readPageParentId(node) {
    const metadata = node.metadata;
    return typeof metadata?.parent_id === "string" &&
        metadata.parent_id.length > 0
        ? metadata.parent_id
        : null;
}
function readPageSlug(node, fallbackIndex) {
    const metadata = node.metadata;
    return typeof metadata?.slug === "string" && metadata.slug.length > 0
        ? metadata.slug
        : makeSlug(fallbackIndex, node);
}
function makeSlug(index, node) {
    if (index === 0)
        return "/";
    return `/${node.id.replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase()}`;
}
function findNodeById(nodes, id) {
    for (const node of nodes) {
        if (node.id === id)
            return node;
        const found = findNodeById(node.children ?? [], id);
        if (found)
            return found;
    }
    return null;
}
function resolveRenderableNode(document, node) {
    const ref = node.ref;
    if (!ref)
        return node;
    const master = findNodeById(document.children, ref);
    if (!master)
        return node;
    return {
        ...master,
        ...node,
        type: master.type,
        props: { ...(master.props ?? {}), ...(node.props ?? {}) },
        children: node.children ?? master.children,
    };
}
function resolvePageRenderableChildren(document, pageNode) {
    if (pageNode.type === "ref") {
        const ref = pageNode[CANONICAL_REF_FIELD];
        if (typeof ref === "string" && ref.length > 0) {
            const target = findNodeById(document.children, ref);
            if (target?.children)
                return target.children;
        }
    }
    return pageNode.children ?? [];
}
function isCanonicalNode(value) {
    if (!value || typeof value !== "object")
        return false;
    const candidate = value;
    return typeof candidate.id === "string" && typeof candidate.type === "string";
}
function readDescendantChildren(override) {
    if (!override || typeof override !== "object")
        return [];
    if (isCanonicalNode(override))
        return [override];
    const children = override.children;
    if (!Array.isArray(children))
        return [];
    return children.filter(isCanonicalNode);
}
function getRefDescendantChildren(pageNode) {
    if (pageNode.type !== "ref")
        return [];
    const descendants = pageNode[CANONICAL_REF_CHILD_PATCHES_FIELD] ?? {};
    const children = [];
    for (const override of Object.values(descendants)) {
        children.push(...readDescendantChildren(override));
    }
    return children;
}
function isBodyNode(node) {
    return node.type.toLowerCase() === "body";
}
function isLegacySlotHoistedNode(node) {
    const metadata = node.metadata;
    return metadata?.type === "legacy-slot-hoisted";
}
function getRuntimeElementType(node) {
    if (isLegacySlotHoistedNode(node))
        return "Slot";
    return isBodyNode(node) ? "body" : node.type;
}
function getRuntimeElementProps(node) {
    const metadata = node.metadata;
    const props = { ...(node.props ?? {}) };
    if (metadata?.type === "legacy-slot-hoisted" &&
        typeof metadata.slotName === "string") {
        props.name ??= metadata.slotName;
    }
    return props;
}
function makeDefaultPageBodyNode(pageId) {
    return {
        id: `${pageId}-body`,
        type: "Body",
        props: {
            className: "react-aria-Body",
            style: {
                display: "block",
                fontFamily: `"Pretendard", "Inter Variable", monospace, system-ui, sans-serif`,
                overflow: "auto",
            },
        },
        children: [],
    };
}
function getRuntimeStableSegment(node) {
    return readCanonicalMetadataCustomId(node.metadata) ?? node.name ?? node.id;
}
function isRecord(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function mergePropsWithStyleDeep(baseProps, patchProps) {
    const merged = { ...baseProps, ...patchProps };
    if (baseProps.style || patchProps.style) {
        merged.style = {
            ...(baseProps.style ?? {}),
            ...(patchProps.style ?? {}),
        };
    }
    return merged;
}
function getDescendantPatchProps(override) {
    const { children, descendants: _descendants, id: _id, metadata: _metadata, name: _name, ref: _ref, reusable: _reusable, slot: _slot, type: _type, ...props } = override;
    if (isRecord(override.props))
        return override.props;
    if (children !== undefined && !Array.isArray(children)) {
        props.children = children;
    }
    return props;
}
function getDescendantOverride(descendants, path) {
    if (!descendants || !path)
        return null;
    const override = descendants[path];
    return isRecord(override) ? override : null;
}
function applyDescendantOverride(node, override) {
    if (!override)
        return node;
    const type = override.type;
    if (typeof type === "string" && type.length > 0) {
        return isCanonicalNode(override) ? override : node;
    }
    const children = override.children;
    const props = mergePropsWithStyleDeep(node.props ?? {}, getDescendantPatchProps(override));
    return {
        ...node,
        props,
        ...(Array.isArray(children)
            ? { children: children.filter(isCanonicalNode) }
            : {}),
    };
}
function collectRuntimeElements(document, nodes, pageId, parentId, elements, pageLayoutBinding, options = {}) {
    nodes.forEach((sourceNode, index) => {
        const descendantPath = options.descendants && options.idPathPrefix
            ? options.descendantPathPrefix
                ? `${options.descendantPathPrefix}/${getRuntimeStableSegment(sourceNode)}`
                : getRuntimeStableSegment(sourceNode)
            : undefined;
        const descendantOverride = getDescendantOverride(options.descendants, descendantPath);
        const sourceNodeWithDescendantOverride = applyDescendantOverride(sourceNode, descendantOverride);
        const node = resolveRenderableNode(document, sourceNodeWithDescendantOverride);
        const nodeSegment = options.idPathPrefix
            ? getRuntimeStableSegment(sourceNode)
            : node.id;
        const localElementId = options.idPathPrefix
            ? `${options.idPathPrefix}/${nodeSegment}`
            : nodeSegment;
        const elementId = options.projectFrameElementIds
            ? toPageFrameElementId(pageId, localElementId)
            : localElementId;
        const elementParentId = parentId;
        const element = {
            id: elementId,
            type: getRuntimeElementType(node),
            props: getRuntimeElementProps(node),
            parent_id: elementParentId,
            page_id: pageId,
        };
        if (node.name !== undefined) {
            element.componentName = node.name;
        }
        const customId = sourceNode.type === "ref"
            ? readCanonicalMetadataCustomId(sourceNode.metadata)
            : (readCanonicalMetadataCustomId(sourceNode.metadata) ??
                readCanonicalMetadataCustomId(node.metadata));
        if (customId !== undefined) {
            element.customId = customId;
        }
        const sourceRefNode = sourceNode;
        const ref = sourceRefNode[CANONICAL_REF_FIELD];
        const refDescendants = sourceNode.type === "ref" &&
            isRecord(sourceRefNode[CANONICAL_REF_CHILD_PATCHES_FIELD])
            ? sourceRefNode[CANONICAL_REF_CHILD_PATCHES_FIELD]
            : options.descendants;
        if (sourceNode.type === "ref" && typeof ref === "string") {
            element[COMPONENT_ROLE_RUNTIME_FIELD] = "instance";
            element[COMPONENT_MASTER_RUNTIME_FIELD] = ref;
            element.ref = ref;
            element[COMPONENT_OVERRIDES_RUNTIME_FIELD] = {
                ...(sourceNode.props ?? {}),
            };
            if (sourceRefNode[CANONICAL_REF_CHILD_PATCHES_FIELD]) {
                element[CANONICAL_REF_CHILD_PATCHES_FIELD] =
                    sourceRefNode[CANONICAL_REF_CHILD_PATCHES_FIELD];
            }
        }
        else if (node.reusable === true || sourceNode.reusable === true) {
            element[COMPONENT_ROLE_RUNTIME_FIELD] = "master";
            element.reusable = true;
        }
        if (isLegacySlotHoistedNode(node) &&
            typeof node.metadata?.slotName ===
                "string") {
            element[SLOT_NAME_RUNTIME_FIELD] = node.metadata
                .slotName;
        }
        if (pageLayoutBinding !== null) {
            element[FRAME_LAYOUT_RUNTIME_FIELD] = pageLayoutBinding;
        }
        elements.push(element);
        const childIdPathPrefix = sourceNode.type === "ref" || options.idPathPrefix
            ? localElementId
            : undefined;
        const childDescendantPathPrefix = sourceNode.type === "ref" ? undefined : descendantPath;
        const childOptions = {
            ...options,
            ...(refDescendants ? { descendants: refDescendants } : {}),
            ...(childDescendantPathPrefix
                ? { descendantPathPrefix: childDescendantPathPrefix }
                : {}),
            ...(childIdPathPrefix ? { idPathPrefix: childIdPathPrefix } : {}),
        };
        if (!childDescendantPathPrefix) {
            delete childOptions.descendantPathPrefix;
        }
        collectRuntimeElements(document, node.children ?? [], pageId, elementId, elements, pageLayoutBinding, childOptions);
    });
}
function collectPageOwnedRuntimeElements(document, pageNode, pageId, elements) {
    const descendantChildren = getRefDescendantChildren(pageNode);
    const directChildren = pageNode.children ?? [];
    const directBody = directChildren.find(isBodyNode) ?? null;
    if (!directBody && descendantChildren.some(isBodyNode)) {
        collectRuntimeElements(document, descendantChildren, pageId, null, elements, null);
        return;
    }
    const pageBody = directBody ?? makeDefaultPageBodyNode(pageId);
    collectRuntimeElements(document, [pageBody], pageId, null, elements, null);
    const seenIds = new Set([pageBody.id]);
    const pageOwnedChildren = [];
    for (const child of [...directChildren, ...descendantChildren]) {
        if (seenIds.has(child.id) || isBodyNode(child))
            continue;
        pageOwnedChildren.push(child);
        seenIds.add(child.id);
    }
    if (pageOwnedChildren.length === 0)
        return;
    collectRuntimeElements(document, pageOwnedChildren, pageId, pageBody.id, elements, null);
}
function collectPageFrameProjectionRuntimeElements(document, pageNode, pageId, pageLayoutBinding, elements) {
    const ref = pageNode[CANONICAL_REF_FIELD];
    if (typeof ref !== "string" || ref.length === 0)
        return;
    const target = findNodeById(document.children, ref);
    if (!target?.children)
        return;
    collectRuntimeElements(document, target.children, pageId, null, elements, pageLayoutBinding, { projectFrameElementIds: true });
}
function collectPageRuntimeElements(document, pageNode, elements) {
    const pageLayoutBinding = extractPageLayoutBinding(pageNode);
    if (pageLayoutBinding !== null && pageNode.type === "ref") {
        collectPageOwnedRuntimeElements(document, pageNode, pageNode.id, elements);
        collectPageFrameProjectionRuntimeElements(document, pageNode, pageNode.id, pageLayoutBinding, elements);
        return;
    }
    const renderableChildren = resolvePageRenderableChildren(document, pageNode);
    collectRuntimeElements(document, renderableChildren, pageNode.id, null, elements, pageLayoutBinding);
}
export function deriveProjectRenderModelFromDocument(document, projectId, currentPageId, options = {}) {
    const audience = options.audience ?? "runtime";
    const explicitEditorPageNodes = document.children.filter(isEditorPageNode);
    const pageNodes = explicitEditorPageNodes.length > 0
        ? audience === "editor"
            ? explicitEditorPageNodes
            : explicitEditorPageNodes.filter(isRuntimePageNode)
        : [
            {
                id: "page-root",
                type: "frame",
                name: "Home",
                children: document.children.filter((node) => !node.reusable),
            },
        ];
    const pages = pageNodes.map((node, index) => {
        const layoutBinding = extractPageLayoutBinding(node);
        const page = {
            id: node.id,
            title: node.name ?? (index === 0 ? "Home" : `Page ${index + 1}`),
            slug: readPageSlug(node, index),
            project_id: projectId,
            parent_id: readPageParentId(node),
        };
        if (layoutBinding !== null) {
            page[FRAME_LAYOUT_RUNTIME_FIELD] = layoutBinding;
        }
        return page;
    });
    const elements = [];
    pageNodes.forEach((node) => {
        collectPageRuntimeElements(document, node, elements);
    });
    return {
        pages,
        elements,
        currentPageId: currentPageId && pages.some((page) => page.id === currentPageId)
            ? currentPageId
            : (pages[0]?.id ?? null),
    };
}
export function deriveProjectEditorPageModelFromDocument(document, projectId, currentPageId) {
    return deriveProjectRenderModelFromDocument(document, projectId, currentPageId, {
        audience: "editor",
    });
}
// ============================================
// Export Functions
// ============================================
/**
 * 프로젝트 데이터를 JSON 문자열로 변환
 */
export function serializeProjectData(projectId, projectName, document, currentPageId, fontRegistry, metadata) {
    const exportData = {
        version: CURRENT_VERSION,
        exportedAt: new Date().toISOString(),
        project: {
            id: projectId,
            name: projectName,
        },
        document,
        currentPageId,
        fontRegistry,
        metadata,
    };
    return JSON.stringify(exportData, null, 2);
}
/**
 * 프로젝트 데이터를 JSON 파일로 다운로드
 */
export function downloadProjectAsJson(projectId, projectName, canonicalDocument, currentPageId, fontRegistry, metadata) {
    const jsonString = serializeProjectData(projectId, projectName, canonicalDocument, currentPageId, fontRegistry, metadata);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${projectName || "project"}-${projectId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
// ============================================
// Import Functions
// ============================================
/**
 * JSON 문자열에서 프로젝트 데이터 파싱 및 검증
 */
export function parseProjectData(jsonString) {
    // 1. JSON 파싱
    let parsed;
    try {
        parsed = safeJsonParse(jsonString);
    }
    catch (error) {
        return {
            success: false,
            error: createError(ExportErrorCode.PARSE_ERROR, error instanceof Error ? error.message : "Failed to parse JSON"),
        };
    }
    // 2. Zod 스키마 검증
    const result = ExportedProjectSchema.safeParse(parsed);
    if (!result.success) {
        return {
            success: false,
            error: zodErrorToExportError(result.error),
            errors: zodErrorsToExportErrors(result.error),
        };
    }
    const data = result.data;
    const warnings = [];
    // 3. 추가 비즈니스 로직 검증
    const exportedAt = new Date(data.exportedAt);
    if (exportedAt > new Date()) {
        warnings.push(createError(ExportErrorCode.VALIDATION_ERROR, "exportedAt is in the future", { field: "exportedAt", severity: "warning" }));
    }
    return {
        success: true,
        data,
        warnings: warnings.length > 0 ? warnings : undefined,
    };
}
/**
 * URL에서 프로젝트 데이터 로드
 */
export async function loadProjectFromUrl(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            return {
                success: false,
                error: createError(ExportErrorCode.PARSE_ERROR, `Failed to fetch: ${response.status} ${response.statusText}`),
            };
        }
        // Content-Length가 있으면 파일 크기 검증
        const contentLength = response.headers.get("Content-Length");
        if (contentLength) {
            const sizeError = validateFileSize(parseInt(contentLength, 10));
            if (sizeError) {
                return { success: false, error: sizeError };
            }
        }
        const jsonString = await response.text();
        // 파일 크기 검증 (Content-Length가 없는 경우)
        const sizeError = validateFileSize(jsonString.length);
        if (sizeError) {
            return { success: false, error: sizeError };
        }
        return parseProjectData(jsonString);
    }
    catch (error) {
        return {
            success: false,
            error: createError(ExportErrorCode.PARSE_ERROR, error instanceof Error ? error.message : "Failed to load project"),
        };
    }
}
/**
 * File 객체에서 프로젝트 데이터 로드
 */
export async function loadProjectFromFile(file) {
    // 파일 크기 검증
    const sizeError = validateFileSize(file.size);
    if (sizeError) {
        return { success: false, error: sizeError };
    }
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === "string") {
                resolve(parseProjectData(content));
            }
            else {
                resolve({
                    success: false,
                    error: createError(ExportErrorCode.PARSE_ERROR, "Failed to read file content"),
                });
            }
        };
        reader.onerror = () => {
            resolve({
                success: false,
                error: createError(ExportErrorCode.PARSE_ERROR, "Failed to read file"),
            });
        };
        reader.readAsText(file);
    });
}
// ============================================
// Static HTML Generation
// ============================================
/**
 * 정적 HTML 파일 생성
 *
 * 프로젝트 데이터를 인라인으로 포함한 standalone HTML 파일을 생성합니다.
 */
export function generateStaticHtml(projectId, projectName, document, currentPageId, fontRegistry, themeCSS = "") {
    const projectData = {
        version: CURRENT_VERSION,
        exportedAt: new Date().toISOString(),
        project: { id: projectId, name: projectName },
        document,
        currentPageId,
        fontRegistry,
    };
    const customFontCss = fontRegistry
        ? buildRegistryFontFaceCss(fontRegistry)
        : "";
    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(projectName)}</title>
  <style>
    /* Reset */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    

    ${customFontCss}

    ${themeCSS}

    /* Navigation */
    .publish-nav {
      display: flex;
      gap: 1rem;
      padding: 1rem;
      background: #f5f5f5;
      border-bottom: 1px solid #ddd;
    }
    .publish-nav a {
      color: #333;
      text-decoration: none;
      padding: 0.5rem 1rem;
      border-radius: 4px;
    }
    .publish-nav a:hover { background: #e0e0e0; }
    .publish-nav a.active { background: #333; color: white; }

    /* Page container */
    .page-container { padding: 1rem; }
    .page { display: none; }
    .page.active { display: block; }

    /* Component styles */
    .component { position: relative; }

    /* Flex/Grid support */
    [data-layout="flex"] { display: flex; }
    [data-layout="grid"] { display: grid; }

    /* Button styles */
    button {
      padding: 0.5rem 1rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: white;
      cursor: pointer;
    }
    button:hover { background: #f5f5f5; }

    /* Input styles */
    input, textarea, select {
      padding: 0.5rem;
      border: 1px solid #ccc;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <nav class="publish-nav" id="pageNav"></nav>
  <main class="page-container" id="pageContainer"></main>

  <script type="application/json" id="projectData">${JSON.stringify(projectData)}</script>

  <script>
    (function() {
      const projectData = JSON.parse(document.getElementById('projectData').textContent);
      const compositionDocument = projectData.document;
      const currentPageId = projectData.currentPageId || null;

      function isPageNode(node) {
        const metadata = node.metadata || {};
        const isPage = metadata.type === 'page' || metadata.type === 'legacy-page' || node.type === 'page' || (node.type === 'frame' && node.reusable !== true);
        return isPage && metadata.pageRole !== 'components';
      }

      function makeSlug(index, node) {
        if (index === 0) return '/';
        return '/' + String(node.id).replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase();
      }

      function findNodeById(nodes, id) {
        for (const node of nodes || []) {
          if (node.id === id) return node;
          const found = findNodeById(node.children || [], id);
          if (found) return found;
        }
        return null;
      }

      function resolveNode(node) {
        if (!node.ref) return node;
        const master = findNodeById(compositionDocument.children || [], node.ref);
        if (!master) return node;
        return {
          ...master,
          ...node,
          type: master.type,
          props: { ...(master.props || {}), ...(node.props || {}) },
          children: node.children || master.children,
        };
      }

      const pageNodes = (compositionDocument.children || []).filter(isPageNode);
      const renderPages = pageNodes.length > 0
        ? pageNodes
        : [{ id: 'page-root', type: 'page', name: 'Home', children: (compositionDocument.children || []).filter(node => !node.reusable) }];

      const pages = renderPages.map((node, index) => ({
        id: node.id,
        title: node.name || (index === 0 ? 'Home' : 'Page ' + (index + 1)),
        slug: makeSlug(index, node),
        node,
      }));

      const nav = document.getElementById('pageNav');
      pages.forEach(page => {
        const link = document.createElement('a');
        link.href = '#' + (page.slug || page.id);
        link.textContent = page.title;
        link.dataset.pageId = page.id;
        nav.appendChild(link);
      });

      function renderNode(sourceNode) {
        const node = resolveNode(sourceNode);
        const type = mapTagToHtml(node.type);
        const dom = document.createElement(type);
        dom.className = 'component';
        dom.dataset.canonicalId = node.id;

        const props = node.props || {};
        if (props.style) {
          Object.assign(dom.style, props.style);
        }

        if (props.children && typeof props.children === 'string') {
          dom.textContent = props.children;
        }

        if (props.placeholder) dom.placeholder = props.placeholder;
        if (props.src) dom.src = props.src;
        if (props.href) dom.href = props.href;
        if (props.alt) dom.alt = props.alt;

        (node.children || []).forEach(child => {
          if (!child.reusable) {
            dom.appendChild(renderNode(child));
          }
        });

        return dom;
      }

      function mapTagToHtml(type) {
        const map = {
          'Container': 'div', 'Box': 'div', 'Flex': 'div', 'Grid': 'div',
          'Text': 'span', 'Heading': 'h2', 'Paragraph': 'p', 'Label': 'label',
          'Button': 'button', 'Link': 'a', 'Image': 'img',
          'Input': 'input', 'TextField': 'input', 'TextArea': 'textarea',
          'Select': 'select', 'Checkbox': 'input', 'Radio': 'input',
          'Form': 'form', 'Section': 'section', 'Article': 'article',
          'Header': 'header', 'Footer': 'footer', 'Nav': 'nav', 'Main': 'main',
          'Aside': 'aside', 'Div': 'div', 'Span': 'span',
        };
        return map[type] || 'div';
      }

      function renderPage(pageId) {
        const container = document.getElementById('pageContainer');
        container.innerHTML = '';

        const page = pages.find(p => p.id === pageId);
        if (!page) return;

        const pageDiv = document.createElement('div');
        pageDiv.className = 'page active';

        (page.node.children || []).forEach(node => {
          if (!node.reusable) {
            pageDiv.appendChild(renderNode(node));
          }
        });

        container.appendChild(pageDiv);

        nav.querySelectorAll('a').forEach(a => {
          a.classList.toggle('active', a.dataset.pageId === pageId);
        });
      }

      function handleHashChange() {
        const hash = window.location.hash.slice(1);
        const page = pages.find(p => p.slug === hash || p.id === hash);
        if (page) {
          renderPage(page.id);
        } else if (pages.length > 0) {
          const defaultPage = pages.find(p => p.id === currentPageId) || pages[0];
          renderPage(defaultPage.id);
        }
      }

      window.addEventListener('hashchange', handleHashChange);
      handleHashChange();
    })();
  </script>
</body>
</html>`;
}
/**
 * HTML 이스케이프
 */
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
/**
 * 정적 HTML 파일 다운로드 (단일 파일)
 */
export function downloadStaticHtml(projectId, projectName, document, currentPageId, fontRegistry, themeCSS = "") {
    const html = generateStaticHtml(projectId, projectName, document, currentPageId, fontRegistry, themeCSS);
    downloadBlob(new Blob([html], { type: "text/html" }), `${projectName || "project"}.html`);
}
// ============================================
// Multi-file Export (ADR-014 Phase E)
// ============================================
/**
 * Data URL → Uint8Array 변환
 */
function dataUrlToArrayBuffer(dataUrl) {
    const base64 = dataUrl.split(",")[1];
    if (!base64)
        throw new Error("Invalid data URL");
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < binary.length; i++) {
        view[i] = binary.charCodeAt(i);
    }
    return buffer;
}
/**
 * 안전한 파일명 생성 (특수문자 제거)
 */
function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
}
function rewriteRegistryForExport(registry) {
    const assets = [];
    const usedNames = new Set();
    const faces = registry.faces.map((face) => {
        if (face.source.type !== "data-url-temp") {
            // remote-url, project-asset → 그대로 유지
            return face;
        }
        // data URL → 바이너리 추출
        const data = dataUrlToArrayBuffer(face.source.url);
        // 파일명 결정
        const ext = face.format
            ? `.${face.format === "truetype" ? "ttf" : face.format === "opentype" ? "otf" : face.format}`
            : ".woff2";
        const baseName = face.source.originalFileName
            ? sanitizeFileName(face.source.originalFileName.replace(/\.[^.]+$/, ""))
            : sanitizeFileName(`${face.family}-${face.weight || "400"}`);
        // 중복 방지
        let fileName = `${baseName}${ext}`;
        let counter = 1;
        while (usedNames.has(fileName)) {
            fileName = `${baseName}-${counter}${ext}`;
            counter++;
        }
        usedNames.add(fileName);
        const relativePath = `assets/fonts/${fileName}`;
        assets.push({ path: relativePath, data });
        return {
            ...face,
            source: {
                ...face.source,
                type: "project-asset",
                url: relativePath,
            },
        };
    });
    return {
        registry: { version: 2, faces },
        assets,
    };
}
/**
 * 멀티파일 프로젝트 Export
 *
 * showDirectoryPicker (Chrome) 또는 ZIP fallback (Firefox/Safari)
 */
export async function exportProject(options) {
    const { fontRegistry } = options;
    // 폰트 레지스트리 rewrite
    let exportRegistry;
    let fontAssets = [];
    if (fontRegistry && fontRegistry.faces.length > 0) {
        const result = rewriteRegistryForExport(fontRegistry);
        exportRegistry = result.registry;
        fontAssets = result.assets;
    }
    // HTML 생성 (rewritten 폰트 경로 사용)
    const html = generateStaticHtml(options.projectId, options.projectName, options.document, options.currentPageId, exportRegistry, options.themeCSS || "");
    // 폰트가 없으면 단일 HTML 다운로드
    if (fontAssets.length === 0) {
        downloadBlob(new Blob([html], { type: "text/html" }), `${options.projectName || "project"}.html`);
        return;
    }
    // 멀티파일 export
    if ("showDirectoryPicker" in window) {
        await exportToDirectory(html, fontAssets, options.projectName);
    }
    else {
        await exportAsZip(html, fontAssets, options.projectName);
    }
}
/**
 * File System Access API로 디렉터리에 직접 저장
 */
async function exportToDirectory(html, fontAssets, _projectName) {
    const dirHandle = await window.showDirectoryPicker();
    // index.html 쓰기
    const htmlFile = await dirHandle.getFileHandle("index.html", {
        create: true,
    });
    const htmlWritable = await htmlFile.createWritable();
    await htmlWritable.write(html);
    await htmlWritable.close();
    // assets/fonts/ 디렉터리 생성 후 폰트 파일 쓰기
    if (fontAssets.length > 0) {
        const assetsDir = await dirHandle.getDirectoryHandle("assets", {
            create: true,
        });
        const fontsDir = await assetsDir.getDirectoryHandle("fonts", {
            create: true,
        });
        for (const asset of fontAssets) {
            const fileName = asset.path.split("/").pop();
            const fileHandle = await fontsDir.getFileHandle(fileName, {
                create: true,
            });
            const writable = await fileHandle.createWritable();
            await writable.write(asset.data);
            await writable.close();
        }
    }
    console.log(`[Export] 디렉터리 저장 완료: index.html + ${fontAssets.length} font files`);
}
/**
 * JSZip fallback — ZIP 파일로 다운로드
 */
async function exportAsZip(html, fontAssets, projectName) {
    const JSZip = (await import("jszip")).default;
    const zip = new JSZip();
    zip.file("index.html", html);
    for (const asset of fontAssets) {
        zip.file(asset.path, asset.data);
    }
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `${projectName || "project"}.zip`);
}
/**
 * Blob → <a download> 다운로드
 */
function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
export { ExportErrorCode, EXPORT_LIMITS } from "../types/export.types";
//# sourceMappingURL=export.utils.js.map