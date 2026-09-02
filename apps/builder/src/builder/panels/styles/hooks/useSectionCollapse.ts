/**
 * useSectionCollapse - 섹션 접기/펴기 상태 관리 훅
 *
 * Zustand + persist로 localStorage에 저장
 * 키보드 단축키:
 * - Alt/Option + S: 전체 펼침/접기
 * - Alt/Option + Shift + S: Focus Mode 토글
 */

import { useCallback } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Styles 패널의 섹션 id 4개 — `collapseAll()` 기본 대상이자 ⌥S 전체 토글의 판정 집합.
 * 종전에는 StylesPanel 이 `collapsedSections.size === 4` 로 "전부 접힘" 을 판정해,
 * 다른 패널(Components/Monitor/History)의 섹션이 하나라도 접혀 있으면 영원히 거짓이 되어
 * ⌥S 로 다시 펼칠 수 없었다. 판정은 반드시 id 집합으로 한다.
 */
export const STYLE_PANEL_SECTION_IDS: readonly string[] = [
  "transform",
  "layout",
  "appearance",
  "typography",
];

/**
 * 섹션 그룹이 전부 접혀 있는가 (일반 모드 기준 — `collapsedSections` 만 본다).
 * Focus Mode 는 Section 이 그릴 때 덮어쓰는 표시 규칙이지 저장 상태가 아니므로 여기서 다루지 않는다.
 * 빈 그룹은 "전부 접힘" 이 아니다 (토글 버튼이 펼침 상태로 보여야 한다).
 */
export function areAllSectionsCollapsed(
  collapsedSections: ReadonlySet<string>,
  sectionIds: readonly string[],
): boolean {
  if (sectionIds.length === 0) return false;
  return sectionIds.every((id) => collapsedSections.has(id));
}

interface SectionCollapseState {
  // State
  collapsedSections: Set<string>;
  focusMode: boolean; // Focus Mode: 한 번에 한 섹션만 펼침
  activeFocusSection: string | null; // Focus Mode에서 현재 활성 섹션

  // Actions
  toggleSection: (sectionId: string) => void;
  isCollapsed: (sectionId: string) => boolean;
  expandSections: (sectionIds: string[]) => void;
  expandAll: () => void;
  collapseAll: (sectionIds?: readonly string[]) => void;
  /** 그룹이 전부 접혀 있으면 그 그룹만 펼치고, 아니면 그 그룹만 접는다 (다른 패널 id 불변). */
  toggleSectionGroup: (sectionIds: readonly string[]) => void;
  toggleFocusMode: () => void;
  setFocusSection: (sectionId: string) => void;
}

export const useSectionCollapse = create<SectionCollapseState>()(
  persist(
    (set, get) => ({
      // Initial state: all sections expanded
      collapsedSections: new Set<string>(),
      focusMode: false,
      activeFocusSection: null,

      // Toggle a single section
      toggleSection: (sectionId: string) =>
        set((state) => {
          if (state.focusMode) {
            // Focus Mode: 클릭한 섹션으로 전환
            return { activeFocusSection: sectionId };
          } else {
            // Normal Mode: 토글
            const newSet = new Set(state.collapsedSections);
            if (newSet.has(sectionId)) {
              newSet.delete(sectionId);
            } else {
              newSet.add(sectionId);
            }
            return { collapsedSections: newSet };
          }
        }),

      // Check if a section is collapsed
      isCollapsed: (sectionId: string) => {
        const state = get();
        if (state.focusMode) {
          // Focus Mode: activeFocusSection이 아니면 접힘
          return state.activeFocusSection !== sectionId;
        } else {
          // Normal Mode: collapsedSections에 있으면 접힘
          return state.collapsedSections.has(sectionId);
        }
      },

      // Expand specific sections (remove from collapsed set)
      expandSections: (sectionIds: string[]) =>
        set((state) => {
          const newSet = new Set(state.collapsedSections);
          sectionIds.forEach((id) => newSet.delete(id));
          return { collapsedSections: newSet };
        }),

      // Expand all sections
      expandAll: () => set({ collapsedSections: new Set() }),

      // Collapse all sections (specific IDs or default style panel sections)
      collapseAll: (sectionIds?: readonly string[]) =>
        set((state) => ({
          collapsedSections: new Set([
            ...state.collapsedSections,
            ...(sectionIds ?? STYLE_PANEL_SECTION_IDS),
          ]),
        })),

      // Toggle a section group as a whole — 그룹 밖 id 는 건드리지 않는다
      toggleSectionGroup: (sectionIds: readonly string[]) =>
        set((state) => {
          const newSet = new Set(state.collapsedSections);
          if (areAllSectionsCollapsed(state.collapsedSections, sectionIds)) {
            sectionIds.forEach((id) => newSet.delete(id));
          } else {
            sectionIds.forEach((id) => newSet.add(id));
          }
          return { collapsedSections: newSet };
        }),

      // Toggle Focus Mode
      toggleFocusMode: () =>
        set((state) => {
          const newFocusMode = !state.focusMode;
          return {
            focusMode: newFocusMode,
            // Focus Mode 활성화 시 첫 번째 섹션만 펼침
            activeFocusSection: newFocusMode ? "transform" : null,
          };
        }),

      // Set active focus section
      setFocusSection: (sectionId: string) =>
        set((state) => {
          if (!state.focusMode) return state;
          return { activeFocusSection: sectionId };
        }),
    }),
    {
      name: "styles-panel-collapse", // localStorage key
      // Custom serialization for Set
      partialize: (state) => ({
        collapsedSections: Array.from(state.collapsedSections),
        focusMode: state.focusMode,
        activeFocusSection: state.activeFocusSection,
      }),
      merge: (
        persistedState: unknown,
        currentState: SectionCollapseState,
      ): SectionCollapseState => {
        const stored = persistedState as Partial<{
          collapsedSections: string[];
          focusMode: boolean;
          activeFocusSection: string | null;
        }>;

        return {
          ...currentState,
          collapsedSections: new Set(stored?.collapsedSections || []),
          focusMode: stored?.focusMode || false,
          activeFocusSection: stored?.activeFocusSection || null,
        };
      },
    },
  ),
);

/**
 * 섹션 그룹 전체 접기/펼치기 — 패널 헤더 토글 버튼과 단축키가 공유하는 단일 판정.
 * `allCollapsed` 는 primitive boolean 구독이라 그룹 밖 섹션 토글에는 리렌더하지 않는다.
 */
export function useSectionGroupToggle(sectionIds: readonly string[]): {
  allCollapsed: boolean;
  toggle: () => void;
} {
  const allCollapsed = useSectionCollapse((s) =>
    areAllSectionsCollapsed(s.collapsedSections, sectionIds),
  );
  const toggleSectionGroup = useSectionCollapse((s) => s.toggleSectionGroup);
  const toggle = useCallback(
    () => toggleSectionGroup(sectionIds),
    [sectionIds, toggleSectionGroup],
  );
  return { allCollapsed, toggle };
}
