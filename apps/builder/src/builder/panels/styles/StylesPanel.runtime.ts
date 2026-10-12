/**
 * StylesPanel - 스타일 편집 뷰 (ADR-252: Design 패널의 Layout · Style · Text · Screen 탭)
 *
 * 절 (Size · Position · Layout · Spacing / Fill · Border · Effect / Typography / Responsive) 을 **4개 그룹 탭**으로 묶어
 * 한 번에 한 그룹만 보여준다 (섹션 삭제 없음 — 그룹화만). 「수정된 속성만」 뷰 (Modified 탭) 는
 * ADR-252 에서 뺐다 (사용자 2026-10-04) — 그룹 탭 dot · 섹션 reset 이 같은 dirty 판정을 쓴다.
 * 그룹 정의·그룹별 dirty 판정은 `constants/styleGroups.ts`, 탭 UI 어법(선택된 탭에만 라벨)은
 * `components/StylesPanelTabs.tsx`.
 *
 * 패널 (헤더 · 탭 줄 · 탭 상태) 은 `panels/design/DesignPanel.tsx` 가 소유한다. 이 파일은 스타일
 * 탭의 본문 (`StylesTabBody`) · 헤더 액션 (`StylesHeaderActions`) · 단축키 등록부
 * (`StylesTabShortcuts`) · 탭 표시 (`useStylesTabMarks`) 를 준다.
 */

import { useMemo } from "react";

import { isDelegatedSubpart } from "../delegatedSubpart";

import "./StylesPanel.css";

import { toDirtyGroups, type StyleGroupId } from "./constants/styleGroups";

import { useDirtyStyleProps } from "./hooks/useResetStyles";

import { useStylesHost, useStylesSelectedId } from "./stylesHost";

/** 컨텍스트 메뉴·다중 선택 툴바와 같은 복사/붙여넣기 정본. */

/**
 * 선택된 요소의 스타일 편집 상태 — 탭 본문 · 헤더가 같이 읽는다.
 * `delegatedSubpart`: ADR-923 잔여 1 (2026-09-03 판정 A) — parent 가 self-compose 하는 sub-part 는
 * style 정본이 parent rule 이라 여기서 준 값은 어디에도 실리지 않으므로 안내만 (`delegatedSubpart.ts`).
 */
export function useStylesSelection() {
  const hasSelectedElement = useStylesSelectedId() != null;
  const host = useStylesHost();
  const selectedElement = host.useSelectedElement();
  const selectedSubpartOwnerType = host.subpartStyleOwnerOf(
    selectedElement?.id,
  );
  const delegatedSubpart = isDelegatedSubpart(
    selectedElement?.type,
    selectedSubpartOwnerType,
  );
  return {
    hasSelectedElement,
    selectedElement,
    selectedSubpartOwnerType,
    delegatedSubpart,
  };
}

/**
 * 탭 줄의 표시 — "지금 안 보이는 그룹에 수정이 있다" dot.
 * 수정은 baseline(factory default / spec preset / subpart)과 실제로 다른 prop 만 센다.
 * reset 버튼(useHasDirtyStyles)과 동일 baseline 공유 — factory 가 주입한 layout default 는 제외.
 */
export function useStylesDirtyGroups(): ReadonlySet<StyleGroupId> {
  const dirtyProps = useDirtyStyleProps();
  return useMemo(() => toDirtyGroups(dirtyProps), [dirtyProps]);
}
