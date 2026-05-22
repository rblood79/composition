import { createElement, memo, useMemo } from "react";
import type { ComponentSpec } from "@composition/specs";
import { GenericPropertyEditor } from "../generic";
import { getPropertyEditorSpec } from "../specRegistry";
import type { ComponentEditorProps } from "../../../inspector/types";
import { useCanonicalPropertyElement } from "../hooks/useCanonicalPropertyRead";
import {
  detectInspectorInputMode,
  type InspectorInputMode,
} from "../inspectorInputMode";
import ResolvedTreeSlotEditor from "./ResolvedTreeSlotEditor";
import type { Element } from "../../../../types/core/store.types";

/**
 * ADR-144 Phase 7 Wave C — ComboBox 의 3 input mode 분기 진입점.
 *
 * `registry.ts.getCustomPreEditor("ComboBox")` pre-generic hook 이 선택.
 * SelectPropertyEditor 와 같은 분기 패턴 (mode 1/2/3 상호 배타). resolved-tree
 * mode 2 시 slot 추가/삭제 UI 는 공통 `ResolvedTreeSlotEditor` 로 위임한다.
 */
const ComboBoxPropertyEditor = memo(function ComboBoxPropertyEditor(
  props: ComponentEditorProps,
) {
  const { elementId } = props;
  const element = useCanonicalPropertyElement(elementId);

  const mode: InspectorInputMode = useMemo(() => {
    if (!element) return "legacy-items";
    return detectInspectorInputMode(element as unknown as Element, {
      ownerPath: null,
      lookupElement: () => undefined,
    });
  }, [element]);

  const spec = getPropertyEditorSpec("ComboBox");
  if (!spec) return null;

  if (mode === "resolved-tree") {
    const filteredSpec = filterOutItemManagementSection(spec);
    return (
      <>
        <ResolvedTreeSlotEditor elementId={elementId} />
        {createElement(GenericPropertyEditor, {
          ...props,
          spec: filteredSpec,
        })}
      </>
    );
  }

  // mode === "external-databinding" (mode 1) or "legacy-items" (mode 3)
  return createElement(GenericPropertyEditor, {
    ...props,
    spec,
  });
});

function filterOutItemManagementSection(
  spec: ComponentSpec<Record<string, unknown>>,
): ComponentSpec<Record<string, unknown>> {
  const sections = spec.properties?.sections ?? [];
  const filtered = sections.filter((s) => s.title !== "Item Management");
  return {
    ...spec,
    properties: {
      ...(spec.properties ?? {}),
      sections: filtered,
    },
  } as ComponentSpec<Record<string, unknown>>;
}

export default ComboBoxPropertyEditor;
