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
import type { CanonicalNode, CompositionDocument } from "./composition-document.types";
/**
 * pencil primitive 10종 — composition canonical에 직접 값으로 등장하지 않음.
 * import/export adapter 경유 변환만 허용한다.
 */
export type PencilPrimitiveType = "rectangle" | "ellipse" | "line" | "polygon" | "path" | "text" | "note" | "prompt" | "context" | "icon_font";
/**
 * pencil 공용 구조 타입 3종 — composition canonical에서도 직접 사용.
 * `ComponentTag` 값 공간에 포함된다.
 */
export type PencilStructureType = "ref" | "frame" | "group";
export type PencilNodeType = PencilPrimitiveType | PencilStructureType;
export type PencilDescendantOverride = Record<string, unknown>;
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
export declare function pencilPrimitiveToComponent(primitive: PencilNode, options?: PencilImportOptions): CanonicalNode;
export declare function pencilDocumentToCompositionDocument(document: PencilDocument, options?: PencilDocumentImportOptions): CompositionDocument;
export declare function pencilNodeToCompositionDocument(node: PencilNode, options?: PencilDocumentImportOptions): CompositionDocument;
export declare function componentToPencilTree(node: CanonicalNode): PencilNode;
export declare function compositionDocumentToPencilDocument(document: CompositionDocument, options?: PencilExportOptions): PencilDocument;
//# sourceMappingURL=pencil-adapter.types.d.ts.map