import { createElement, memo, useMemo } from "react";
import type { ComponentSpec } from "@composition/specs";
import { GenericPropertyEditor } from "../generic";
import { getPropertyEditorSpec } from "../specRegistry";
import type { ComponentEditorProps } from "../../../inspector/types";
import { useCanonicalPropertyChildrenMap } from "../hooks/useCanonicalPropertyRead";

/**
 * ADR-076 P6 — ListBox 듀얼 모드 프로퍼티 에디터.
 *
 * `registry.ts.getCustomPreEditor("ListBox")` pre-generic hook 이 진입점으로 선택.
 * 내부에서 현재 ListBox 의 자식 중 Field element 가 있는 ListBoxItem 이 존재하는지
 * 감지하여 편집 UI 를 분기한다:
 *
 *   - 템플릿 모드 (Field 자식 보유): ListBoxSpec "Item Management" 섹션 filter 한
 *     사본을 GenericPropertyEditor 에 주입. 실제 컬럼 관리는 ListBoxItemEditor 가
 *     Field 자식 편집 UI 로 담당.
 *   - 정적 모드 (Field 자식 없음): GenericPropertyEditor 에 ListBoxSpec 전체 주입 →
 *     ItemsManager 섹션으로 items[] 편집.
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
  const childrenByParent = useCanonicalPropertyChildrenMap();

  // 자식 ListBoxItem 중 하나라도 Field 자식 보유 → 템플릿 모드
  const hasTemplateMode = useMemo(() => {
    const children = childrenByParent.get(elementId) ?? [];
    const listBoxItems = children.filter((c) => c.type === "ListBoxItem");
    if (listBoxItems.length === 0) return false;
    for (const lbi of listBoxItems) {
      const subs = childrenByParent.get(lbi.id) ?? [];
      if (subs.some((s) => s.type === "Field")) return true;
    }
    return false;
  }, [childrenByParent, elementId]);

  const spec = getPropertyEditorSpec("ListBox");
  if (!spec) return null;

  const renderSpec = hasTemplateMode
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
