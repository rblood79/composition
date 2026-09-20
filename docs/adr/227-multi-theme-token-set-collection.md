# ADR-227: 다중 테마 — 문서 소유 토큰 세트 컬렉션 + 활성 전환 + 테마 소유 축 확장

## Status

Proposed — 2026-09-20

설계 요청: 사용자 (2026-09-20) — "RAC 는 headless 라 기본 구조만 SSOT 로 정의하고 스타일은 theme 로. Components 페이지에서 기본 요소가 보이고 theme 를 선택하면 color · border 등이 바뀌는, Figma / Framer / 다른 웹빌더와 같은 기능." 코드 실측 결과 catalog rule 은 이미 TokenRef 만 들고 있어 그 골격은 있으나, theme 쪽이 "이름 있는 값 세트 여러 개" 가 아니라 프리셋 4 값 하나다.

## Context

**SSOT 3-domain 관계**: **D3 (시각 스타일) 내부 확장**. D3 SSOT 는 catalog `COMPONENT_RULES_TABLE` + theme/tokens root collection (ADR-142 · ADR-110) 이고, 이 ADR 은 그 둘 중 **theme/tokens 쪽의 모양** (단일 → 컬렉션) 과 **테마가 소유하는 축** (border 폭 추가) 을 정한다. rule 이 토큰을 "이름으로 참조" 하는 구조 (D3 의 rule ↔ token 분리) 는 바꾸지 않는다. D1 (RAC 구조) · D2 (PropContract) 무관 — SSOT 경계 재판정 아님.

### 문제

catalog rule 2,333 개 TokenRef 는 색 · 서체 · radius 를 이름으로만 가리키므로 토큰 값을 바꾸면 전 컴포넌트가 두 leg (Skia · DOM) 에서 같이 바뀐다 (F6). 그런데 그 값을 정하는 theme 는 (1) 문서당 **하나** 이고 (`ThemeSnapshot` — F1), (2) 값이 아니라 **프리셋 이름** (tint 12 · neutral · radius 5) 이라 사용자가 색을 직접 줄 수 없으며 (F10), (3) border 폭은 rule 리터럴이라 theme 밖이고 (F7), (4) 로드 시 문서 → 런타임 적용이 env flag 뒤에 있어 **실제 정본이 localStorage** 다 (F5). 다중 테마를 담던 IndexedDB `design_themes` 와 ThemeStudio 는 ADR-143 P4 에서 dead 로 폐기됐다 — 지금은 결정이 없는 공백이지 막힌 것이 아니다.

### 코드 사실 (2026-09-20, main `81d96353f`)

요약 — 전문은 breakdown §2 (F1~F12, 경로:라인).

- `ThemeSnapshot { tint, darkMode, neutral, radiusScale, customTokens? }` 단일 객체 (`composition-document.types.ts:61-73`). `resolveCanonicalToken(ref, doc)` 은 `doc.tokens[key]` 만 본다 (`variablesAdapter.ts:186-198`).
- 런타임은 `themeConfigStore` 전역 싱글턴 — `setTint` → `tintToSkiaColors` → `themeVersion+1` → `notifyLayoutChange` → localStorage (`themeConfigStore.ts:168-200`). 문서 → store 적용은 `VITE_ADR110_P2_THEMES_WRITE_THROUGH` 게이트 (`BuilderCore.tsx:640-661`).
- rule: hex 리터럴 0 · TokenRef 2,333 · `borderWidth` 숫자 리터럴 43 (`componentRulesTable.ts`).
- DOM leg 는 `--tint: var(--blue)` 한 줄 + `[data-accent]` 요소 override (`preview-system.css:7-45`); publish 는 `applyThemeConfig` 로 `--tint` · neutral alias · radius 주입 (`apps/publish/src/App.tsx:188-215`).
- Components 페이지 = 시스템 페이지 `page-components` — 템플릿 origin + 사용자 reusable origin 보관 (ADR-148 · F12). 팔레트 66 중 origin 을 갖는 것은 5 뿐이라 "컴포넌트 전집이 테마를 입는 표면" 은 아직 없다 — 그 확장은 [ADR-228](228-palette-wide-reusable-origins.md) (2026-09-21).

### Hard constraints

- **두 leg 대칭** (ssot-hierarchy §1 D3): 테마 전환 결과가 Skia 캔버스와 Preview/Publish DOM 에서 같은 시각 결과여야 한다 — 팔레트 전수 × 테마 2 에서 Skia 픽셀 vs computed style digest Δ 0 (ADR-198 하니스 기준). "DOM 만 테마" 는 대칭 위반.
- **rule 무변경 원칙**: catalog `COMPONENT_RULES_TABLE` 의 값 (어느 토큰을 쓰는가) 은 바꾸지 않는다. 리터럴 → TokenRef 치환은 값 변경이 아니라 **참조화** 이며 seed 토큰이 현행 리터럴과 같은 값이라 시각 Δ 0 이어야 한다.
- **문서 비대화** (ADR-143 HC3): 테마마다 토큰 전체를 싣지 않는다 — seed 와 다른 델타만. 테마 N 개 문서 크기 ≤ N × 델타.
- **BC**: 기존 문서 100% 가 `themes` 단일 객체 (또는 부재) — 1회 hydration migration, 문서당 필드 1개 재직렬화, 마이그레이션 전후 시각 Δ 0 (활성 테마 = 구 프리셋). 롤백 = 활성 테마의 preset 4 값을 구 필드로 되쓰는 역변환 1개.
- **전환 비용**: 활성 테마 전환은 현행 `setTint` 와 같은 경로 (`themeVersion+1` + `notifyLayoutChange` 1회) — 노드별 재resolve 없음. 600 요소 문서 전환 프레임 ≤ 25 ms (perf-baseline frame lane).
- **쓰기 경로**: 테마 추가/삭제/전환/토큰 편집은 `runCanonicalMutation` 경유 + History 등록 (ADR-184/185). store 직접 mutate 0.

### Soft constraints

- 테마가 소유하는 축은 color · typography · radius · border 폭 · shadow · focus 까지. **size / spacing** (`height` 418 · `gap` 189 · `paddingX` 182 …) 은 밀도 (density) 축이라 이 ADR 밖 — Spectrum 도 density 를 theme 와 분리한다.
- 요소/페이지 스코프 테마 (DOM 의 `[data-accent]` 패턴) 는 유보 — Skia 소비처 0 이고 프레임 예산 미측정.
- 패널 규격은 Styles 패널 시안 (2026-09-13) 어법 — 28/32 두 티어 · `1fr 1fr 28px`.

## Alternatives Considered

### 대안 A: 프리셋 슬롯 다중화 — `themes.items = ThemeSnapshot[]` (값 편집 없음)

- 설명: 현행 4 값 프리셋 객체를 이름 붙여 여러 개 저장하고 활성 하나를 고른다. 토큰 값 편집 · border 축 확장 없음.
- 근거: 변경 최소. Webflow 초기 "Swatches" 수준.
- 위험: 기술(L) / 성능(L) / 유지보수(**M** — 사용자가 색을 직접 줄 수 없어 요구 (2) 미충족 → 곧 B 로 재작업) / 마이그레이션(L)

### 대안 B: 문서 소유 토큰 세트 컬렉션 — 프로젝트 단위 활성 하나 + 테마 소유 축 확장

- 설명: `themes: { active, items: { id: { name, preset, tokens(델타) } }, order }`. 프리셋은 새 테마를 만들 때 seed 를 채우는 생성기로 강등되고, 사용자가 `color.accent` 같은 토큰 값을 직접 편집한다. `resolveCanonicalToken` 이 활성 테마 델타 → 문서 user-defined → seed 순으로 읽고, Skia (`ResolvedTokenMap` 덮어쓰기) 와 DOM (`:root` CSS 변수 emit) 이 같은 델타를 소비한다. `borderWidth` 리터럴 43 → `{border.width.*}`. 로드 시 write-through 를 기본으로 (localStorage 는 캐시). 테마 표면 = Components 페이지 (ADR-228 이 origin 전집으로 채운다 — 이 ADR 은 별도 섹션을 만들지 않는다).
- 근거: Figma variables + modes (컬렉션 안 모드 전환, 컴포넌트는 변수 참조만) · Framer color/text styles (프로젝트 단위 스타일 세트, 편집 시 전 인스턴스 반영) · Webflow variables + modes — 셋 다 "컴포넌트는 참조, 값은 테마" 구조이고 프로젝트 단위 활성 하나가 기본이다. composition 의 rule ↔ TokenRef 분리가 이미 같은 구조 (F6).
- 위험: 기술(**M** — Skia 색은 프리셋에서 **파생** (hover/pressed 단계 · dark 반전, F11) 되므로 사용자 hex 직접 지정 시 파생 규칙을 토큰 키 단위로 유지해야 한다 → G2) / 성능(L — 전환은 현행 경로 1회) / 유지보수(**M** — 리터럴 sweep 이 두 leg 를 같이 지나야 하고 (`toSkiaStyle` · `toReactStyle` · CSSGenerator) 한쪽만 바뀌면 padding 만큼 갈리는 가족 (메모리 `feedback-skia-only-channel-divergence-family`) → G3 ratchet) / 마이그레이션(**M** — 문서 100% 1회 migration, 필드 1개, 역변환 있음 → G1)

### 대안 C: B + 요소/페이지 스코프 테마 (subtree override)

- 설명: B 에 더해 노드가 `themeId` 를 가지면 그 subtree 는 다른 테마로 resolve. DOM 의 `[data-accent]` 를 일반화.
- 근거: Radix `data-accent` · Figma 의 프레임별 모드 지정.
- 위험: 기술(**H** — `resolveCanonicalToken` 에 스코프가 들어가고 Skia scene 이 노드별 팔레트를 들어야 한다; 캐시 키가 (rule, theme) 2차원) / 성능(**H** — 노드별 재resolve, 600 요소에서 미측정) / 유지보수(M) / 마이그레이션(L)

### 대안 D: DOM 전용 테마 — CSS 변수만 다중화, Skia 는 프리셋 유지

- 설명: Preview/Publish 만 테마 세트를 갖고 캔버스는 tint 프리셋.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — 캔버스와 Preview 가 다른 색을 보인다 = D3 대칭 위반, "CSS 가 기준" 언어 금지) / 마이그레이션(L)

### Risk Threshold Check

| 대안 | HIGH+                  | 판정                                     |
| ---- | ---------------------- | ---------------------------------------- |
| A    | 없음                   | 요구 미충족 (값 편집 · border 축) — 기각 |
| B    | 없음 (M 3)             | **채택** — M 3 은 G1~G3 로 관리          |
| C    | 기술 H · 성능 H        | 유보 — B 의 재개 조건 (Decision 3)       |
| D    | 유지보수 H (대칭 위반) | 기각                                     |

루프 판정: 채택 대안에 HIGH 0 → 추가 루프 불필요. C 의 HIGH 는 회피 (스코프 유보) 로 처리.

## Decision

**대안 B 채택.**

1. **Decision 1 — 스키마**: `CompositionDocument.themes` = `ThemesCollection { active, items, order }`, 항목 = `{ id, name, preset: ThemeSnapshot, tokens: TokensSnapshot(델타) }`. `tokens` root 필드는 테마 무관 user-defined 만. 1회 hydration migration + 역변환. write-through 기본 (env flag 제거) — 정본은 문서, localStorage 는 마지막 활성 id 캐시.
2. **Decision 2 — 두 leg resolve**: `resolveCanonicalToken(ref, doc)` = 활성 테마 델타 → user-defined → seed. Skia 는 프리셋 파생 `ResolvedTokenMap` 위에 델타를 덮고 (파생 규칙은 토큰 키 단위 유지), DOM 은 같은 델타를 `:root` CSS 변수로 emit 하는 함수 하나를 builder Preview 와 publish 가 공유. 전환 = `themeVersion+1` 1회.
3. **Decision 3 — 테마 소유 축**: color · typography · radius · **border 폭 (신설 `{border.width.none|thin|thick}`, rule 리터럴 43 참조화)** · shadow · focus. size/spacing (density) · 요소/페이지 스코프 · 테마별 light/dark 이중 세트는 **유보** — 재개 조건은 breakdown §6.
4. **Decision 4 — 표면**: Themes 패널 = 테마 목록 (추가 = 복제 · 이름 · 삭제 · 활성) + 토큰 편집 (프리셋 채우기 유지). 테마 결과를 전집으로 보는 자리는 **Components 페이지** (origin · instance · slot) — 별도 섹션을 만들지 않고 [ADR-228](228-palette-wide-reusable-origins.md) 이 채운 origin 전집을 읽는다 (2026-09-21 사용자 정정: 초안의 "catalog leaf read-only 섹션" 철회 — 아무도 ref 하지 않는 origin 을 만든다).

위험 수용 근거: 잔존 M 3 은 모두 측정 가능한 게이트 (round-trip · 픽셀 digest · ratchet) 로 닫힌다. rule 값과 D1/D2 경계는 손대지 않으므로 실패 시 롤백 범위가 theme 층 안에 갇힌다.

기각 사유: **A** — 값 편집이 없어 "theme 에서 선택하면 color · border 가 바뀐다" 의 절반 (사용자가 정한 값) 을 못 채우고, 채우려면 B 를 다시 해야 한다. **C** — 요구에 스코프가 없고 (프로젝트 단위 전환이면 충분) HIGH 2 를 지금 감수할 근거가 없다; B 의 스키마가 C 를 막지 않는다 (노드 `themeId` 추가로 확장 가능). **D** — 캔버스와 Preview 가 다른 색을 보이는 것은 D3 대칭 위반이며 이 프로젝트의 최상위 원칙에 어긋난다.

> 구현 상세: [227-multi-theme-token-set-collection-breakdown.md](design/227-multi-theme-token-set-collection-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                          | 심각도 | 대응                                                                                                        |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------- |
| R1  | Skia 파생 규칙 손실 — 사용자 hex 직접 지정 시 hover/pressed 단계 · dark 반전이 프리셋 파생과 달라져 캔버스와 Preview 가 갈린다 (`tintToSkiaColors.ts` · `preview-system.css`) |  MED   | 파생을 토큰 키 단위로 유지 (`accent` 만 주면 `accent-hover` 는 파생 함수) · **G2** 팔레트 전수 digest       |
| R2  | 리터럴 sweep 두 leg drift — `borderWidth` 참조화가 `toSkiaStyle` / `toReactStyle` / CSSGenerator 중 한쪽만 지나면 padding 만큼 갈린다 (메모리 divergence family)              |  MED   | ratchet (숫자 리터럴 0 고정) + **G3** 원복 RED + 픽셀 Δ 0                                                   |
| R3  | migration BC — 구 `themes` 단일 객체 · `tokens` 델타 분할에서 값 소실 (fallback = 기본값이면 무증상, 메모리 `feedback-fallback-equals-default-masks-dropped-channel`)         |  MED   | **G1** round-trip 을 기본값이 아닌 커스텀 프리셋 fixture 로 · 역변환 테스트                                 |
| R4  | 정본 이중화 — localStorage 테마와 문서 테마가 다른 프로젝트에서 엇갈린다 (F5 의 잔재)                                                                                         |  MED   | write-through 기본 · localStorage 는 id 캐시만 · 로드 시 문서 우선 (G4 새로고침 시나리오)                   |
| R5  | Components 페이지가 테마 표면이 되려면 origin 이 전집이어야 한다 — ADR-228 미착수면 5 항목만 보인다 (표면 결손, 기능 결함 아님)                                               |  LOW   | 227 은 228 을 선행 조건으로 두지 않는다 · **G5** 는 그 시점의 Components 페이지 전수로 측정 · 228 뒤 재측정 |
| R6  | 문서 비대화 — 테마마다 토큰 전체 저장                                                                                                                                         |  LOW   | 델타 저장 (ADR-143 규칙 그대로) · G1 에서 미커스터마이즈 테마 델타 = {} 확인                                |

잔존 HIGH 위험 없음.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                            | 실패 시 대안                                                             |
| ---- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| G0   | Phase 0      | F1~F12 재실측 일치 · `resolveCanonicalToken`/`resolveToken` 호출처 전수 · fixture `themes` 보유 수 집계 · 파일 수 추정 25 대비 1.5× 이내                                                             | inventory 보강 commit (M3) 후 재개                                       |
| G1   | Phase 1      | fixture round-trip 100% (커스텀 프리셋 · 부재 · 구 델타 3 종) · 구 문서 로드 시각 Δ 0 · 역변환 = 구 필드 복원 · 미커스터마이즈 테마 델타 `{}`                                                        | migration 함수 수리, 스키마 변경 없이                                    |
| G2   | Phase 2      | 팔레트 전수 × 테마 2 (Default · accent/border 편집) 에서 Skia 픽셀 vs Preview computed style digest 일치 · hover/pressed/dark 파생 토큰 값 두 leg 동일 · publish `<style>` 이 같은 변수 emit         | 파생 규칙을 토큰 키 단위로 재정렬 · 대칭 안 되는 축은 테마 밖으로 되돌림 |
| G3   | Phase 3      | `borderWidth` 숫자 리터럴 0 ratchet · 원복 RED (1곳 되돌리면 실패) · sweep 전후 두 leg 픽셀 Δ 0                                                                                                      | 리터럴 축 축소 (thin 만) 후 재측정                                       |
| G4   | Phase 4 live | Chrome MCP 또는 headed Playwright: 테마 2개 생성 → 전환 시 캔버스 · Preview · Properties swatch 같은 프레임 반영 · 새로고침 후 활성 유지 · Undo 로 복귀 · 600 요소 전환 프레임 ≤ 25 ms               | 전환 경로를 `setTint` 경로로 되돌리고 원인 분리                          |
| G5   | Phase 5 live | Components 페이지 (origin · instance · slot 전수) 가 테마 전환 1회에 바뀜 · canonical `children[]` 길이 · history 길이 무변화 (테마 전환은 노드를 만들지 않는다) · 600 요소 문서 전환 프레임 ≤ 25 ms | 전환 경로 원인 분리 (G4 와 같은 대안)                                    |

측정 조건 (measurement-validity §1): Q1 fixture 는 **커스텀 프리셋** (기본값이 아닌 값 — fallback = 기본값이면 드롭이 무증상) · Q2 불리 케이스 = 사용자 hex 직접 지정 테마 (파생 규칙이 걸리는 쪽) + dark · Q3 대조군 = Default 테마 (구 프리셋과 같은 값) 의 두 leg digest · Q4 소비 경로 = 로드 → `applyCanonicalThemes` → store → Skia/DOM 을 live 로 (env flag 제거 뒤) · Q5 oracle = ADR-198 하니스 픽셀 + Preview computed style (외부) — `tintToSkiaColors` 와 CSS 가 서로를 확인하는 형태 금지. 기록 항목: visibilityState visible · headed · 1440×900 · DPR.

### Live Exercise

(Implemented 승격 시 기재)

## Consequences

### Positive

- theme 가 Figma / Framer 와 같은 뜻 — 이름 있는 값 세트, 여러 개, 전환. rule 은 손대지 않고 전 컴포넌트가 두 leg 에서 같이 바뀐다.
- 정본이 문서로 돌아온다 (localStorage 잔재 종료) — publish 가 같은 테마를 싣는다.
- border 폭이 테마 축에 들어와 rule 리터럴 43 이 사라진다 (ratchet 으로 재유입 차단).
- Components 페이지 (origin · instance · slot) 가 "컴포넌트가 theme 를 입는 자리" 가 된다 — ADR-228 이 origin 을 전집으로 채우면 theme + components 한 세트.

### Negative

- `CompositionDocument.themes` 타입 변경 — 이 필드를 읽는 adapter · publish · 테스트 fixture 재직렬화 1회.
- Skia 색 파생 (`tintToSkiaColors`) 이 "프리셋 → map" 에서 "프리셋 → map → 델타 덮기" 로 한 단계 늘어난다.
- density (size/spacing) · 스코프 테마 · light/dark 이중 세트는 남는다 — 재개 조건은 breakdown §6.

## References

- [ADR-110](completed/110-canonical-themes-variables-land-plan.md) — canonical `themes`/`tokens` adapter (base)
- [ADR-143](completed/143-canonical-token-field-realignment.md) — tokens 델타 저장 · `design_themes` store 폐기
- [ADR-142](completed/142-starter-spec-component-system-cutover.md) — D3 SSOT = catalog + theme/tokens
- [ADR-193](completed/193-theme-aware-semantic-palette-map.md) — neutral alias · publish `applyThemeConfig` 함정
- [ADR-198](completed/198-d3-renderer-pixel-parity-gate.md) — 팔레트 전수 픽셀 parity 하니스 (G2 재사용)
- [ADR-228](228-palette-wide-reusable-origins.md) — 직교 · Components 페이지 origin 전집 (테마 표면)
- [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md) §1 D3 · §6 금지 패턴
- 외부: Figma Variables (collections · modes) · Framer Styles (color / text styles) · Webflow Variables + modes · Adobe Spectrum density 축 분리
