import { useMemo } from "react";
import { useActiveCanonicalDocument } from "../../stores/canonical/canonicalElementsBridge";
import { collectCanonicalPanelNodes } from "../canonicalPanelNodes";
import type { PanelNode } from "../panelNode";

export function useCanonicalPanelElements(): readonly PanelNode[] | null {
  const canonicalDocument = useActiveCanonicalDocument();

  return useMemo(() => {
    if (!canonicalDocument) return null;
    return collectCanonicalPanelNodes(canonicalDocument);
  }, [canonicalDocument]);
}
