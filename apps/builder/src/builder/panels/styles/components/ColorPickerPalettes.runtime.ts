/**
 * ColorPickerPalettes — 색 피커 아래 「Theme · Document」 팔레트 (panel-ui 05 #1, 2026-09-15 ·
 * ADR-298 Phase 3 2026-11-02)
 *
 * Theme = 테마 색 토큰 (토큰 모델 A — 사용자 결정 4 「Theme 먼저」): 스와치는 활성 테마 · 색 모드의
 * 값을 보이고, 클릭은 그 토큰의 변수 (`var(--accent)`) 를 commit 한다 — 노드는 토큰을 참조해 테마 ·
 * 색 모드를 따른다 (`panelFillColor` · `styleFields` 가 `TokenUse` 로). 옛 accent · neutral 사다리
 * (theme 이 쓰는 lightness 값) 는 토큰이 아니어서 commit 하면 리터럴이 됐다.
 * Document = 이 문서에서 쓰인 리터럴 색 자동 수집 (useDocumentColors — 저장소 없음).
 * swatch 28 · 6열 gap 8 (208, 팝오버 215 안) · 헤더 28 · 그룹 라벨 18 — 새 값 0.
 */

/** Theme 팔레트의 묶음 — 이름은 `{color.<name>}` 토큰 (라이브러리 토큰 표 `libraryTokenScale.ts`). */
export const THEME_PALETTE_GROUPS: readonly {
  readonly label: string;
  readonly tokens: readonly string[];
}[] = [
  { label: "Accent", tokens: ["accent-subtle", "accent", "accent-content"] },
  {
    label: "Surface",
    tokens: ["base", "pasteboard", "layer-1", "layer-2", "elevated", "border"],
  },
  {
    label: "Neutral",
    tokens: ["neutral-subtle", "neutral-subdued", "neutral"],
  },
  {
    label: "Status",
    tokens: [
      "informative",
      "positive",
      "notice",
      "negative",
      "informative-subtle",
      "positive-subtle",
      "notice-subtle",
      "negative-subtle",
    ],
  },
];

export interface ColorPickerPalettesProps {
  /** 현재 색 (hex8) — 같은 색의 Document 스와치에 선택 링 */
  value: string;
  /** 현재 값이 테마 토큰이면 그 변수 (`var(--accent)`) — 그 Theme 스와치에 선택 링 */
  token?: string;
  /** hex8 (Document) 또는 토큰 변수 (Theme) */
  onSelect: (value: string) => void;
}
