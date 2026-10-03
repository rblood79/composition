/**
 * Design 패널의 활성 탭 (ADR-252) — 세션 store 하나 (저장 안 함).
 *
 * 탭은 `Property | Layout | Style | Text | Screen` 이다. Property = 컴포넌트 설정 (D2),
 * 나머지 넷은 Styles 그룹 (D3, `styleGroups.ts` 의 `StyleGroupId`). 탭 상태를 패널 로컬
 * `useState` 가 아니라 여기 두는 이유: ⌥6 · 「패널 열기」 호출 (page 설정 · 변수 owner) ·
 * AI agent 가 패널 밖에서 탭을 고르고, ⌘⌥C / ⌘⌥V 는 활성 탭의 쌍만 등록한다 (배타적 등록 —
 * dispatcher 가 같은 scope 의 첫 매치에서 멈춰 `canRun` 으로는 가를 수 없다).
 */
import { create } from "zustand";
import { setPanelWorkspacePanelVisibility } from "../../layout/panelWorkspaceVisibility";
import { useBuilderUiStore } from "../../stores/builderUiStore";
import {
  STYLE_GROUP_IDS,
  type StyleGroupId,
} from "../styles/constants/styleGroups";

export type DesignViewId = "property" | StyleGroupId;

export const DESIGN_VIEW_IDS: readonly DesignViewId[] = [
  "property",
  ...STYLE_GROUP_IDS,
];

/** Styles 그룹 (Layout · Style · Text · Screen) 인지 — Property 탭이 아닌지. */
export function isStyleView(view: DesignViewId): view is StyleGroupId {
  return view !== "property";
}

interface DesignPanelViewState {
  view: DesignViewId;
  setView: (view: DesignViewId) => void;
}

export const useDesignPanelView = create<DesignPanelViewState>((set) => ({
  view: "property",
  setView: (view) => set({ view }),
}));

/** Design 패널 (id `properties` — 레이아웃 저장 키) 이 보이는지. */
function isDesignPanelVisible(): boolean {
  return (
    useBuilderUiStore.getState().panelWorkspaceLayout?.visibility.properties ===
    true
  );
}

/** Design 패널을 열고 `view` 탭을 고른다 (이미 열려 있으면 탭만 바꾼다). */
export function openDesignPanel(view: DesignViewId): void {
  useDesignPanelView.getState().setView(view);
  setPanelWorkspacePanelVisibility("properties", true);
}

/**
 * ⌥6 — Design 을 `view` 탭으로 연다. 이미 그 탭으로 열려 있으면 닫는다 (⌥5 와 같은 토글 어법).
 */
export function toggleDesignPanelView(view: DesignViewId): void {
  if (isDesignPanelVisible() && useDesignPanelView.getState().view === view) {
    setPanelWorkspacePanelVisibility("properties", false);
    return;
  }
  openDesignPanel(view);
}
