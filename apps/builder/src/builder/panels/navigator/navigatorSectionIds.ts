/**
 * Navigator 패널 Section id — Section `id` (collapse persist 키) 와
 * 헤더 "모든 섹션 접기/펼치기" 토글 (`SectionGroupToggleButton`) 이 같은 값을 읽는다.
 */
export const NAVIGATOR_SECTION_IDS = {
  pages: "navigator-pages",
  layers: "navigator-layers",
} as const;

export const NAVIGATOR_SECTION_ID_LIST: readonly string[] = [
  NAVIGATOR_SECTION_IDS.pages,
  NAVIGATOR_SECTION_IDS.layers,
];
