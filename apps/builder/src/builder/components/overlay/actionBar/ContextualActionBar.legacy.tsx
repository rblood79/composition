/**
 * ADR-192 Contextual Action Bar — 선택 page 하단 중앙 플로팅.
 *
 * - 항목: ADR-182 provider 정본의 부분집합 (`buildActionBarItems`) — 액션 신규 0
 * - ⋯ : 182 컨텍스트 메뉴를 버튼 위치에서 그대로 연다
 * - 빈 선택 / 텍스트 편집 중 / Hide → 미마운트. page 단독 선택은 page chrome을
 *   표시하고 요소 액션은 노출하지 않는다.
 * - 재렌더 트리거는 선택 집합 + store `elements` 교체뿐 — 드래그 중 좌표는
 *   Skia 프리뷰가 들고 드롭 시 1회 commit 되므로 프레임 루프와 무관 (HC2)
 * - 포커스: 루트 mousedown `preventDefault` + `preventFocusOnPress` 라 마우스
 *   조작은 (버튼이든 여백이든) 포커스를 옮기지 않아
 *   캔버스가 `canvas-focused` scope 를 유지한다 (HC3). 키보드로 진입한 동안은
 *   루트가 선언한 `data-shortcut-scope="global"` 이 우선이라 캔버스 단축키
 *   (←/→ 형제 재배치 · Escape 선택 해제) 가 툴바 탐색을 덮지 않고, Escape 는
 *   선택을 유지한 채 캔버스로 되돌린다 (R2)
 * - 배치: 좌측 핸들 드래그 · 옵션 메뉴 (Pin / Reset / Hide) — Photoshop
 *   Contextual Task Bar 의 ⋯ 메뉴 동형 (Phase 3, `useActionBarPlacement`)
 */
import { useViewportSyncStore } from "../../../workspace/canvas/stores";
import {
  getPagePositionPresentationSnapshot,
  readPagePositionForInteraction,
} from "../../../workspace/canvas/interaction/pagePositionPresentation";
import { startTransition, useCallback, useEffect, useState } from "react";
import { useStore } from "../../../stores";
import { useCanvasStore } from "../../../stores/canvasStore";
import { useContextMenu } from "../contextMenu";
import type { ActionBarModel } from "./actionBarPolicy";
import { buildActionBarItems } from "./buildActionBarItems";
import "./actionBar.css";
import { isBodyType } from "@composition/shared";
import { ActionBarView } from "./ContextualActionBar";

/**
 * ADR-248 4e-7: the old element store's part of `ContextualActionBar.tsx` (moved out so the catalog Builder's
 * import graph does not reach the old store). Goes with the old store.
 */
export function ContextualActionBar() {
  const isEditing = useCanvasStore((state) => state.isEditing);
  const selectedElementIds = useStore((state) => state.selectedElementIds);
  const pageSelection = useStore((state) => {
    if (state.selectedElementIds.length !== 1) return false;
    const selected = state.elementsMap.get(state.selectedElementIds[0]);
    const type = selected?.type.toLowerCase();
    return isBodyType(type) || type === "page";
  });
  const selectedPageId = useStore((state) => {
    let firstPageId: string | null = null;
    for (const id of state.selectedElementIds) {
      const selected = state.elementsMap.get(id) as
        | { page_id?: string | null; pageId?: string | null; type: string }
        | undefined;
      const pageId = selected?.page_id ?? selected?.pageId ?? null;
      if (pageId === state.currentPageId) return pageId;
      firstPageId ??= pageId;
    }
    if (firstPageId) return firstPageId;
    if (state.selectedElementIds.length !== 1) return null;
    const selected = state.elementsMap.get(state.selectedElementIds[0]);
    const type = selected?.type.toLowerCase();
    return isBodyType(type) || type === "page" ? state.currentPageId : null;
  });
  // `elements` 배열은 요소 변경(컴포넌트 토글·재부모화·삭제)마다 교체된다 —
  // 항목 라벨/조건이 갈리는 모든 경우를 덮는 가장 단순한 재산출 트리거.
  //
  // 2026-08-27 code-review #15 는 이 트리거가 과하다고 봤으나, 실측에서 비용이
  // 성립하지 않아 그대로 둔다 (live, 55 요소 프로젝트):
  //   - 캔버스 텍스트 편집 중 타이핑 10자 → `elements` identity 변경 0회
  //     (초안이 로컬이라 store 를 건드리지 않는다 — 키 입력당 재산출 없음)
  //   - 요소 드래그 → 0회 (드롭 시 1회 commit, 위 서술대로)
  //   - 속성 1건 확정(Gap) → 2회. 재산출 1회의 O(N) 부분은 provider 의
  //     `hasReorderableSiblings` 형제 탐색뿐이고 같은 형태를 재면 55개 0.0015ms /
  //     5,000개 0.049ms — 5,000 요소 문서의 편집 1회 비용 205ms 대비 무시 가능.
  // 트리거를 좁히면 라벨이 낡을 위험만 커진다.
  const elements = useStore((state) => state.elements);
  // undo 로 선택 대상이 사라진 경우(그룹 해제 등) — 선택 id 가 문서에 없으면
  // 182 provider 가 interactive map 잔상으로 항목을 만들 수 있어 바를 내린다.
  const selectionResolved = useStore((state) =>
    state.selectedElementIds.every((id) => state.elementsMap.has(id)),
  );
  const contextMenu = useContextMenu();
  // 182 provider 는 BuilderCanvas 의 interactive map 을 읽는데, 그 ref 는
  // BuilderCanvas 의 useEffect(BuilderCanvas.tsx:756) 에서 갱신된다. 같은 store
  // 변경에 대해 render 단계(useMemo)에서 읽으면 한 단계 낡은 map 을 보므로
  // (live 실측: 컴포넌트 토글 라벨이 한 클릭 늦게 바뀜) commit 이후 effect 에서
  // 산출한다 — BuilderCanvas 가 앞선 형제라 그 effect 가 먼저 실행된다.
  const [model, setModel] = useState<ActionBarModel | null>(null);
  useEffect(() => {
    // provider registry는 BuilderCanvas commit effect에서 갱신된다. 모델을
    // 같은 effect에서 동기 갱신하면 cascading render가 발생하므로, 선택 결과를
    // 낮은 우선순위 transition으로 반영해 registry commit 이후 한 번만 그린다.
    startTransition(() => {
      setModel(
        selectionResolved && !pageSelection
          ? buildActionBarItems(selectedElementIds)
          : null,
      );
    });
    // elements 는 재산출 트리거로만 쓴다 (항목 산출은 182 provider 가 담당)
  }, [selectedElementIds, selectionResolved, pageSelection, elements]);
  const openOverflow = useCallback(
    (target: Element | null) => {
      const rect = target?.getBoundingClientRect();
      contextMenu.open({
        surface: "canvas-element",
        clientX: rect ? rect.left : 0,
        clientY: rect ? rect.top : 0,
        targetElementIds: [...selectedElementIds],
      });
    },
    [contextMenu, selectedElementIds],
  );

  return (
    <ActionBarView
      isEditing={isEditing}
      selectedIds={selectedElementIds}
      pageSelection={pageSelection}
      selectedPageId={selectedPageId}
      resolved={selectionResolved}
      model={model}
      openOverflow={openOverflow}
      pageRectOf={(pageId) => {
        const position = readPagePositionForInteraction(
          pageId,
          useStore.getState().derivedPagePositions,
          getPagePositionPresentationSnapshot(),
        );
        return (
          position && {
            ...position,
            ...useViewportSyncStore.getState().canvasSize,
          }
        );
      }}
    />
  );
}
