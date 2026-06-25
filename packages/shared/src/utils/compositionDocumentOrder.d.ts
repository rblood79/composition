import type { CanonicalNode, CompositionDocument } from "../types/composition-document.types";
export type CanonicalParentId = string | null;
export type CanonicalDocumentOrderResult = {
    document: CompositionDocument;
    changed: boolean;
};
export type CanonicalRemoveResult = CanonicalDocumentOrderResult & {
    removed: CanonicalNode | null;
};
export declare function getCanonicalChildren(document: CompositionDocument, parentId: CanonicalParentId): readonly CanonicalNode[] | null;
export declare function insertCanonicalChild(document: CompositionDocument, parentId: CanonicalParentId, child: CanonicalNode, index?: number): CanonicalDocumentOrderResult;
export declare function removeCanonicalChild(document: CompositionDocument, childId: string): CanonicalRemoveResult;
export declare function moveCanonicalChild(document: CompositionDocument, childId: string, targetParentId: CanonicalParentId, index: number): CanonicalDocumentOrderResult;
export declare function appendDescendantChild(document: CompositionDocument, refPath: string, descendantPath: string, child: CanonicalNode): CanonicalDocumentOrderResult;
export declare function moveDescendantChild(document: CompositionDocument, refPath: string, descendantPath: string, childId: string, index: number): CanonicalDocumentOrderResult;
export declare function moveCanonicalChildToDescendants(document: CompositionDocument, childId: string, refPath: string, descendantPath: string, index: number): CanonicalDocumentOrderResult;
//# sourceMappingURL=compositionDocumentOrder.d.ts.map