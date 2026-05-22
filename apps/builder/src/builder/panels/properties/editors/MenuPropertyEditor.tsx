import { createElement, memo } from "react";
import { GenericPropertyEditor } from "../generic";
import { getPropertyEditorSpec } from "../specRegistry";
import type { ComponentEditorProps } from "../../../inspector/types";

/**
 * ADR-099 Phase 4 — Menu items-manager 프로퍼티 에디터.
 *
 * `registry.ts.getCustomPreEditor("Menu")` pre-generic hook 이 진입점으로 선택.
 *
 * MenuSpec 에는 `items-manager` 타입 필드가 있으며,
 * `allowSections: true`, `allowSeparators: true`, `sectionHasSelection: true`
 * 플래그가 설정되어 있어 ItemsManager 가 Section/Separator 추가 UI 를 포함한다.
 *
 * ADR-076 TagGroupPropertyEditor / ListBoxPropertyEditor 와 같은 패턴:
 *   - spec-first 경로가 `metadata.editorName` 을 bypass 하므로 명시 진입점 필수
 *   - MenuSpec 전체를 GenericPropertyEditor 에 주입 (섹션 필터링 없음)
 */
const MenuPropertyEditor = memo(function MenuPropertyEditor(
  props: ComponentEditorProps,
) {
  const spec = getPropertyEditorSpec("Menu");
  if (!spec) return null;

  return createElement(GenericPropertyEditor, {
    ...props,
    spec,
  });
});

export default MenuPropertyEditor;
