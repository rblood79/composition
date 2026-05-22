import { useMemo } from "react";
import { useActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import { visitCanonicalDocumentElements } from "../../stores/canonical/canonicalElementsView";
import type { PanelNode } from "../panelNode";

export function useCanonicalPanelElements(): PanelNode[] | null {
  const canonicalDocument = useActiveCanonicalDocument();

  return useMemo(() => {
    if (!canonicalDocument) return null;
    const elements: PanelNode[] = [];
    visitCanonicalDocumentElements(canonicalDocument, (element) => {
      elements.push(element);
    });
    return elements;
  }, [canonicalDocument]);
}

/**
 * ADR-144 Wave D — `CompositionDocument.reusableComponents` root collection
 * 의 master + sub-tree 만 PanelNode[] 로 추출. LayersSection 의 Components
 * 섹션 (Pages 섹션과 분리된 영역) 에서 사용.
 *
 * page tree 에 배치된 ref instance 는 제외. master 자체와 그 자식들
 * (master sub-tree) 만 포함.
 */
export function useReusableComponentsPanelElements(): PanelNode[] {
  const canonicalDocument = useActiveCanonicalDocument();

  return useMemo(() => {
    if (
      !canonicalDocument?.reusableComponents ||
      canonicalDocument.reusableComponents.length === 0
    ) {
      return [];
    }
    const elements: PanelNode[] = [];
    // visitCanonicalDocumentElements 가 양쪽 (children + reusableComponents)
    // 모두 traverse 하므로, reusableComponents 만 visit 하려면 children 을
    // 빈 array 로 swap 한 임시 doc 사용.
    visitCanonicalDocumentElements(
      {
        ...canonicalDocument,
        children: [],
      },
      (element) => {
        elements.push(element);
      },
    );
    return elements;
  }, [canonicalDocument]);
}
