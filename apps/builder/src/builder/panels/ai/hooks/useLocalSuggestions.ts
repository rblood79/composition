import { useMemo } from "react";
import { resolveEditContract } from "@composition/shared";
import { useI18n, semanticLabelKeys, translateKey } from "@/i18n";
import { useStore } from "../../../stores";
import { useCanonicalDocumentStore } from "../../../stores/canonical/canonicalDocumentStore";
import { getNodeMap } from "../../../stores/canonical/canonicalTraversalHelpers";
import { readCompilerState } from "../../../../services/ai/compiler/builderHost";
import { getLocalSuggestions } from "../localSuggestions";

export function useLocalSuggestions() {
  const { t, locale } = useI18n();
  const selectedId = useStore((state) => state.selectedElementId);
  const selectionCount = useStore((state) => state.selectedElementIds.length);
  const pageId = useStore((state) => state.currentPageId);
  const doc = useCanonicalDocumentStore((state) =>
    state.currentProjectId
      ? state.documents.get(state.currentProjectId)
      : undefined,
  );
  return useMemo(() => {
    const { manifest, context, identity } = readCompilerState();
    // 단일 대상 IR을 다중 선택 전체에 대한 편집처럼 제안하지 않는다.
    const node =
      selectionCount <= 1 && selectedId
        ? getNodeMap().get(selectedId)
        : undefined;
    const target = node
      ? context.nodes.find((node) => node.id === selectedId)
      : undefined;
    const selectedType =
      target?.type === "body"
        ? undefined
        : (target?.componentType ?? target?.type);
    return {
      selectedType,
      suggestions: getLocalSuggestions({
        manifest,
        identity,
        context:
          node && selectedType ? context : { ...context, selectedId: null },
        fields:
          node && selectedType ? resolveEditContract(node, doc).fields : [],
        korean: locale.startsWith("ko"),
        label: (value) =>
          semanticLabelKeys[value]
            ? translateKey(t, semanticLabelKeys[value], value)
            : value,
      }),
    };
  }, [doc, selectedId, selectionCount, pageId, locale, t]);
}
