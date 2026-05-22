import { createElement, memo, useMemo } from "react";
import type { ComponentSpec } from "@composition/specs";
import { GenericPropertyEditor } from "../generic";
import { getPropertyEditorSpec } from "../specRegistry";
import type { ComponentEditorProps } from "../../../inspector/types";
import {
  useCanonicalPropertyChildrenMap,
  useCanonicalPropertyElement,
} from "../hooks/useCanonicalPropertyRead";
import {
  detectInspectorInputMode,
  type InspectorInputMode,
} from "../inspectorInputMode";
import ResolvedTreeSlotEditor from "./ResolvedTreeSlotEditor";
import type { Element } from "../../../../types/core/store.types";

/**
 * ADR-076 P6 + ADR-144 Wave C — ListBox 의 3 input mode 분기 진입점.
 *
 * `registry.ts.getCustomPreEditor("ListBox")` pre-generic hook 이 진입점으로 선택.
 *
 * 3 input mode (Wave C 도입 — `detectInspectorInputMode` 단일 진입점):
 *   - "external-databinding" (mode 1): GenericPropertyEditor 전체 (ItemsManager 가
 *     자체적으로 dataBinding picker UI 로 표시)
 *   - "resolved-tree"        (mode 2): ResolvedTreeSlotEditor + GenericPropertyEditor
 *     filtered (ItemsManager 섹션 제외) — composite resolved-tree authoring path
 *   - "legacy-items"         (mode 3): 기존 ADR-076 hasTemplateMode 분기 보존 —
 *     Field 자식 보유 시 ItemsManager 섹션 필터, 미보유 시 전체 spec 주입
 *
 * 한 instance 에 두 mode 가 동시 표시되지 않도록 상호 배타 (ADR-144 task 7
 * acceptance). ListBox 의 hasTemplateMode 휴리스틱은 mode === "legacy-items"
 * 분기 안에서만 평가된다.
 *
 * ADR-076 Hard Constraint #3 — 부모 단위 원자성: 마이그레이션 + Factory 가 혼합 부모
 * 생성을 원천 봉쇄하므로, 본 컴포넌트는 "어느 한쪽이 참"인 상태만 처리한다.
 *
 * 구현 제약 (ADR-076 Decision):
 *   - `GenericPropertyEditor.evaluateVisibility` 는 subtree 관찰 불가 → spec
 *     `visibleWhen` 선언만으로는 ItemsManager 비활성 불가
 *   - `registry.ts:124-135` spec-first 경로가 `metadata.editorName` 을 bypass →
 *     `metadata.editorName` 단독 연결만으로는 로드 안 됨
 *   이에 따라 `registry.ts` `getCustomPreEditor` pre-hook + 본 컴포넌트 조합으로 구현.
 */
const ListBoxPropertyEditor = memo(function ListBoxPropertyEditor(
  props: ComponentEditorProps,
) {
  const { elementId } = props;
  const element = useCanonicalPropertyElement(elementId);
  const childrenByParent = useCanonicalPropertyChildrenMap();

  const mode: InspectorInputMode = useMemo(() => {
    if (!element) return "legacy-items";
    return detectInspectorInputMode(element as unknown as Element, {
      ownerPath: null,
      lookupElement: () => undefined,
    });
  }, [element]);

  // mode 3 (legacy-items) 안에서만 평가되는 ADR-076 휴리스틱.
  const hasTemplateMode = useMemo(() => {
    if (mode !== "legacy-items") return false;
    const children = childrenByParent.get(elementId) ?? [];
    const listBoxItems = children.filter((c) => c.type === "ListBoxItem");
    if (listBoxItems.length === 0) return false;
    for (const lbi of listBoxItems) {
      const subs = childrenByParent.get(lbi.id) ?? [];
      if (subs.some((s) => s.type === "Field")) return true;
    }
    return false;
  }, [childrenByParent, elementId, mode]);

  const spec = getPropertyEditorSpec("ListBox");
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

  // mode === "external-databinding" (mode 1) — ItemsManager 가 dataBinding picker 로 표시
  // mode === "legacy-items"         (mode 3) — hasTemplateMode 분기로 ItemsManager 섹션 제어
  const renderSpec =
    mode === "legacy-items" && hasTemplateMode
      ? filterOutItemManagementSection(spec)
      : spec;

  return createElement(GenericPropertyEditor, {
    ...props,
    spec: renderSpec,
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

export default ListBoxPropertyEditor;
