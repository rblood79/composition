/**
 * PageBodySection — body 노드의 페이지·프레임 오소링 섹션.
 *
 * **왜 catalog 편집 계약 밖에 있나**: `bodyBinding.props.accepts` 는 `{}` 다
 * (Body.binding.ts). page↔frame 바인딩 / 부모 페이지(nested route) / 프레임 프리셋은
 * **element props 가 아니라 페이지·프레임 오소링 축**이라 `PropContract` 로 표현할 수
 * 없다. 따라서 `resolveEditContract` 는 body 에 semantic 필드를 0개 산출하고,
 * `CatalogEditContractEditor` 는 EmptyState 로 빠진다.
 *
 * **회귀 경위**: 2026-06-03 `5b89e707e` (ADR-912 단계 2) 가 per-type dispatch
 * (`getEditor(type, ctx)`) 를 `resolveEditContract` 단일 진입점으로 교체할 때,
 * `registry.ts` 의 body 전용 분기
 * (`editMode === "layout" ? LayoutBodyEditor : PageBodyEditor`) 가 대체 없이 사라졌다.
 * 그 결과 Layout 연결/해제 · 부모 페이지 지정 · customId · className · 프레임 프리셋이
 * 전부 UI 도달 불가가 됐다 (`applyPageFrameBinding*` 소비자 0건). 읽기 경로
 * (`getPageFrameBindingId` → LayerTree)만 살아 있어 "이미 걸린 layout 은 보이는데
 * 새로 걸 수단이 없는" 상태였다.
 *
 * **복구 형태**: 그 두 에디터를 `ComponentSemanticsSection` / `FrameSlotSection` 과
 * 같은 계층의 섹션으로 되살린다 — `CatalogEditContractEditor` 와 나란히 렌더되는
 * 비-catalog 축. catalog `accepts` 확장이나 새 `InspectorFieldKind` 도입이 아니다
 * (element props 계약을 오소링 축으로 오염시키지 않는다).
 */

import { memo, useCallback, useMemo } from "react";

import { useStore } from "../../stores";
import { useEditModeStore } from "../../stores/editMode";
import { PageBodyEditor } from "./editors/PageBodyEditor";
import { LayoutBodyEditor } from "./editors/LayoutBodyEditor";
import { useCanonicalPropertyElement } from "./hooks/useCanonicalPropertyRead";

/**
 * 비-catalog 오소링 섹션이 편집 축을 전담하는 노드 타입.
 *
 * `CatalogEditContractEditor` 가 이 타입에서는 "편집 계약이 비어 있습니다" EmptyState 를
 * 띄우지 않는다 — 계약이 빈 게 결함이 아니라 축이 다른 것이고, 실제 컨트롤은 본 섹션이
 * 공급하므로 EmptyState 가 함께 뜨면 모순된 안내가 된다.
 */
export const DEDICATED_SECTION_TYPES: ReadonlySet<string> = new Set(["body"]);

export const PageBodySection = memo(function PageBodySection({
  elementId,
}: {
  elementId: string;
}) {
  const element = useCanonicalPropertyElement(elementId);
  const editMode = useEditModeStore((state) => state.mode);

  const currentProps = useMemo(
    () => (element?.props ?? {}) as Record<string, unknown>,
    [element?.props],
  );

  // 레거시 `PropertyEditorWrapper.handleUpdate` 와 동일 write target.
  // body 는 propagation 규칙이 없어(getPropagationRules("body") → undefined) 자식 전파
  // 분기가 불필요하다. 본 섹션은 **선택 노드**에만 렌더되므로 selection 기준 write 가 정합.
  const handleUpdate = useCallback((updatedProps: Record<string, unknown>) => {
    useStore.getState().updateSelectedProperties(updatedProps);
  }, []);

  if (!element || element.type !== "body") return null;

  return editMode === "layout" ? (
    <LayoutBodyEditor
      elementId={elementId}
      currentProps={currentProps}
      onUpdate={handleUpdate}
    />
  ) : (
    <PageBodyEditor
      elementId={elementId}
      currentProps={currentProps}
      onUpdate={handleUpdate}
    />
  );
});
