// 레일 버튼 찾기 — live 하니스 공용 (ADR-252 R7).
//
// 종전 하니스 58곳은 레일 버튼을 순서 인덱스 (`RAIL_ORDER.indexOf(panelId)`) 로 찾았다. 레일은
// 패널 등록 · 숨김 (2026-09-29 테마 · 작업 내역 메뉴 전용) · 통합 (ADR-252 Properties · Styles →
// Design) 으로 바뀌므로 인덱스가 다른 버튼을 누른다. 레일 버튼은 RAC `ToggleButton` 이고 접근 이름이
// 패널 이름이라 그 이름으로 찾는다. 이름은 locale 로 번역되므로 하니스는 en-US 로 돈다 (Playwright 기본
// locale · `composition-locale` 미설정 — 한국어로 돌리는 하니스는 이 표 대신 자기 이름을 쓴다).
//
// `styles` 는 Design 패널의 Layout · Style · Text · Screen · Modified 탭이다 — 버튼은 Design 과 같다.
// 특정 탭이 필요하면 패널을 연 뒤 탭을 고른다 (`.panel-tablist [role="tab"]`).
export const RAIL_LABELS = {
  navigator: "Navigator",
  components: "Components",
  datatable: "Data",
  datatableEditor: "Data Editor",
  theme: "Theme",
  ai: "AI",
  properties: "Design",
  styles: "Design",
  events: "Interactions",
  interactions: "Interactions",
  history: "History",
  settings: "Settings",
};

/** The rail toggle of `panelId` (by its accessible name, not its position). */
export function railButton(page, panelId) {
  const label = RAIL_LABELS[panelId] ?? panelId;
  return page.locator(`.panel-toggle-rail button[aria-label="${label}"]`).first();
}
