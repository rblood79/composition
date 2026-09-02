/**
 * Navigator 패널 Section id — Section `id` (collapse persist 키), 분할 컨테이너
 * (`SectionSplitStack`) 의 접힘 판정, 헤더 "모든 섹션 접기/펼치기" 토글이 같은 값을 읽는다.
 */
export const NAVIGATOR_SECTION_IDS = {
  pages: "navigator-pages",
  layers: "navigator-layers",
  frames: "navigator-frames",
  frameLayers: "navigator-frame-layers",
} as const;

/** Pages 탭의 섹션 (헤더 토글 대상) */
export const NAVIGATOR_PAGES_TAB_SECTION_IDS: readonly string[] = [
  NAVIGATOR_SECTION_IDS.pages,
  NAVIGATOR_SECTION_IDS.layers,
];

/** Layouts(Frames) 탭의 섹션 (헤더 토글 대상) */
export const NAVIGATOR_LAYOUTS_TAB_SECTION_IDS: readonly string[] = [
  NAVIGATOR_SECTION_IDS.frames,
  NAVIGATOR_SECTION_IDS.frameLayers,
];

/** 분할 상한 저장 키 (localStorage) */
export const NAVIGATOR_SPLIT_STORAGE_KEYS = {
  pages: "navigator-split:pages",
  layouts: "navigator-split:layouts",
} as const;
