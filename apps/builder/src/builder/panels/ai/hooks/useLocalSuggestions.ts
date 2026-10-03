import { useMemo, useSyncExternalStore } from "react";
import { isBodyType } from "@composition/shared";
import { getAiReadHost } from "../../../../services/ai/aiReadHost";
import { useI18n, semanticLabelKeys, translateKey } from "@/i18n";
import { readCompilerState } from "../../../../services/ai/compiler/builderHost";
import { getLocalSuggestions } from "../localSuggestions";

const noSubscription = () => () => {};

export function useLocalSuggestions() {
  const { t, locale } = useI18n();
  // ADR-248 4e-5: the open Builder's read host (its document and selection) — 4e-7: only it.
  const host = getAiReadHost();
  const hostVersion = useSyncExternalStore(
    host?.subscribe ?? noSubscription,
    () => host?.version() ?? "",
  );
  return useMemo(() => {
    const { manifest, context, identity } = readCompilerState();
    const hostSelected = host?.selectedIds();
    // 단일 대상 IR을 다중 선택 전체에 대한 편집처럼 제안하지 않는다.
    const node =
      host && hostSelected!.length === 1
        ? host.elements().find((element) => element.id === hostSelected![0])
        : undefined;
    const target = node
      ? context.nodes.find((entry) => entry.id === node.id)
      : undefined;
    const selectedType = isBodyType(target?.type)
      ? undefined
      : (target?.componentType ?? target?.type);
    return {
      selectedType,
      suggestions: getLocalSuggestions({
        manifest,
        identity,
        context:
          node && selectedType ? context : { ...context, selectedId: null },
        fields: host && node && selectedType ? [...host.fields(node.id)] : [],
        korean: locale.startsWith("ko"),
        label: (value) =>
          semanticLabelKeys[value]
            ? translateKey(t, semanticLabelKeys[value], value)
            : value,
      }),
    };
  }, [locale, t, host, hostVersion]);
}
