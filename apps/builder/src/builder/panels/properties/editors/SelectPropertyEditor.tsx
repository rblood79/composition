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
 * ADR-144 Phase 7 Wave C — Select 의 3 input mode 분기 진입점.
 *
 * `registry.ts.getCustomPreEditor("Select")` pre-generic hook 이 선택.
 * `detectInspectorInputMode` 의 반환값에 따라 한 번에 한 mode UI 만 노출한다
 * (상호 배타). 시각 prop 편집은 모든 mode 에서 GenericPropertyEditor 가 담당
 * — mode 2 에서는 ItemsManager 섹션이 제거된 spec 사본을 주입한다.
 *
 * 분기:
 *   - "external-databinding" (mode 1): GenericPropertyEditor 전체 (ItemsManager
 *     가 자체적으로 dataBinding picker UI 로 표시)
 *   - "resolved-tree"        (mode 2): ResolvedTreeSlotEditor + GenericPropertyEditor
 *     filtered (ItemsManager 섹션 제외)
 *   - "legacy-items"         (mode 3): GenericPropertyEditor 전체 (ItemsManager 가
 *     items[] 편집 UI 로 표시) — fallback
 */
const SelectPropertyEditor = memo(function SelectPropertyEditor(
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

  const spec = getPropertyEditorSpec("Select");
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

export default SelectPropertyEditor;
