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
