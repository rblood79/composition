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
- **BC**: 기존 문서와 프로젝트별 localStorage의 **기존 실효값**을 최초 1회 승계한다. 기존 write-through on/off 및 import 출처를 구분하며 baseTypography도 보존한다. 문서 저장 성공 뒤에만 legacy 설정을 id 캐시로 축소한다. 구 문서·설정 백업 복원으로 rollback하며 preset 4값만의 손실 역변환을 rollback으로 간주하지 않는다.
- **전환 비용**: 활성 snapshot 1회 설치 + themeVersion/notifyLayoutChange 각 1회. 노드별 snapshot 생성은 없으나 변경 축의 재해석·재레이아웃·paint는 수행한다. 600 요소 문서 총 전환 프레임 ≤25ms로 측정한다.
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

- 설명: `themes: { active, items: { id: { name, preset, tokens(델타) } }, order }`. preset은 매 resolve의 seed 생성 입력이고 명시 델타가 값을 덮는다. 문서에서 파생한 snapshot 하나를 Skia·layout·Preview·Publish에 연결한다. borderWidth 참조화는 타입·validator·generator·layout 소비자 확장을 포함한다. 최초 legacy migration 성공 이후 문서가 정본이며 Components 페이지가 테마 표면이다.
- 근거: Figma variables + modes (컬렉션 안 모드 전환, 컴포넌트는 변수 참조만) · Framer color/text styles (프로젝트 단위 스타일 세트, 편집 시 전 인스턴스 반영) · Webflow variables + modes — 셋 다 "컴포넌트는 참조, 값은 테마" 구조이고 프로젝트 단위 활성 하나가 기본이다. composition 의 rule ↔ TokenRef 분리가 이미 같은 구조 (F6).
- 위험: 기술(**H** — 독립 token map·DOM 변수·geometry 소비 경로의 누락 → G2/G3) / 성능(M — typography/border 변경은 재레이아웃 필요 → G4/G5) / 유지보수(M — 매핑과 파생 규칙 공유) / 마이그레이션(**H** — 문서·localStorage 실효값과 typography 승계 → G1). 구체적 대응은 Risks R1~R4 및 breakdown §3.

### 대안 C: B + 요소/페이지 스코프 테마 (subtree override)

- 설명: B 에 더해 노드가 `themeId` 를 가지면 그 subtree 는 다른 테마로 resolve. DOM 의 `[data-accent]` 를 일반화.
- 근거: Radix `data-accent` · Figma 의 프레임별 모드 지정.
- 위험: 기술(**H** — `resolveCanonicalToken` 에 스코프가 들어가고 Skia scene 이 노드별 팔레트를 들어야 한다; 캐시 키가 (rule, theme) 2차원) / 성능(**H** — 노드별 재resolve, 600 요소에서 미측정) / 유지보수(M) / 마이그레이션(L)

### 대안 D: DOM 전용 테마 — CSS 변수만 다중화, Skia 는 프리셋 유지

- 설명: Preview/Publish 만 테마 세트를 갖고 캔버스는 tint 프리셋.
- 위험: 기술(L) / 성능(L) / 유지보수(**H** — 캔버스와 Preview 가 다른 색을 보인다 = D3 대칭 위반, "CSS 가 기준" 언어 금지) / 마이그레이션(L)

### Risk Threshold Check

| 대안 | HIGH+                   | 판정                                               |
| ---- | ----------------------- | -------------------------------------------------- |
| A    | 없음                    | 요구 미충족 (값 편집 · border 축) — 기각           |
| B    | 기술 H · 마이그레이션 H | 채택 — G1~G3 선통과 전 구현 완료/BC 보장 주장 금지 |
| C    | 기술 H · 성능 H         | 유보 — B 의 재개 조건 (Decision 3)                 |
| D    | 유지보수 H (대칭 위반)  | 기각                                               |

루프 판정: A에는 HIGH가 없으나 직접 값 편집 요구를 충족하지 못한다. B의 HIGH는 소비자별 연결과 migration 행렬로 관리하며 G1~G3 미통과 시 완료하지 않는다. C/D는 스코프 확대 및 비대칭 위험으로 기각/유보한다. 추가 범위 분리는 같은 토큰 전달·저장 계약을 끊으므로 이번 설계 안에서 보강한다.

## Decision

**대안 B 채택.**

1. **Decision 1 — 스키마와 승계**: `ThemesCollection { active, items, order }`, 항목은 `{ id, name, preset, tokens(델타) }`. root tokens는 user-defined만. 최초 migration은 기존 부팅 정책의 실효값·baseTypography를 승계하고 저장 성공 후 문서 우선으로 전환한다. imported 문서에 이 기기의 legacy 설정을 섞지 않는다.
2. **Decision 2 — 전체 소비 경로**: 활성 테마 명시 델타 → root user-defined fallback → preset seed. 명시 파생값은 자동 파생보다 우선한다. 공통 snapshot을 실제 tokenResolver·layout·text/focus/shadow 소비자에 연결하고 DOM은 기존 의미 변수 매핑을 사용한다. Preview·Publish는 같은 helper를 쓰며 전환/reset 때 이전 override를 제거한다.
3. **Decision 3 — 테마 소유 축**: color · typography · radius · **border 폭 (신설 `{border.width.none|thin|thick}`, rule 리터럴 43 참조화)** · shadow · focus. size/spacing (density) · 요소/페이지 스코프 · 테마별 light/dark 이중 세트는 **유보** — 재개 조건은 breakdown §6.
4. **Decision 4 — 표면**: Themes 패널 = 테마 목록 (추가 = 복제 · 이름 · 삭제 · 활성) + 토큰 편집 (프리셋 채우기 유지). 테마 결과를 전집으로 보는 자리는 **Components 페이지** (origin · instance · slot) — 별도 섹션을 만들지 않고 [ADR-228](228-palette-wide-reusable-origins.md) 이 채운 origin 전집을 읽는다 (2026-09-21 사용자 정정: 초안의 "catalog leaf read-only 섹션" 철회 — 아무도 ref 하지 않는 origin 을 만든다).

위험 수용 근거: 기술·migration HIGH를 G1의 실효값 승계 행렬, G2의 축별 비기본값 대칭, G3의 CSS·box model 검증으로 관리한다. renderer와 layout 소비자까지 변경 범위에 포함하며 G1~G3를 통과하기 전 BC·대칭을 보장했다고 판정하지 않는다. D1/D2 의미 계약은 유지한다.

기각 사유: **A** — 값 편집이 없어 "theme 에서 선택하면 color · border 가 바뀐다" 의 절반 (사용자가 정한 값) 을 못 채우고, 채우려면 B 를 다시 해야 한다. **C** — 요구에 스코프가 없고 (프로젝트 단위 전환이면 충분) HIGH 2 를 지금 감수할 근거가 없다; B 의 스키마가 C 를 막지 않는다 (노드 `themeId` 추가로 확장 가능). **D** — 캔버스와 Preview 가 다른 색을 보이는 것은 D3 대칭 위반이며 이 프로젝트의 최상위 원칙에 어긋난다.

> 구현 상세: [227-multi-theme-token-set-collection-breakdown.md](design/227-multi-theme-token-set-collection-breakdown.md)

## Risks

| ID  | 위험                                                                                                                            | 심각도 | 대응                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------------------- |
| R1  | 카테고리별 map/실제 DOM 변수/hover 파생 전달 누락 — tokenResolver · colorTokenToCss · toSkiaStyle                               |  HIGH  | 공유 snapshot·실제 CSS 매핑·명시 파생값 우선순위, **G2** 축별 비기본값/reset/Publish                        |
| R2  | border TokenRef가 number 전용 타입·CSSGenerator·implicitStyles/size 산식에서 유실                                               |  HIGH  | 타입/검증/resolve/생성/레이아웃을 함께 확장, **G3** thin=3/thick=4 외곽·content box                         |
| R3  | 구 문서와 legacy localStorage 충돌 또는 baseTypography 소실                                                                     |  HIGH  | 기존 write-through 정책과 import를 구분한 승계, 저장 성공 후 전환, **G1** 실패/재시도/백업 복원             |
| R4  | 문서/캐시 이중화와 전환 History 중복                                                                                            |  MED   | migrated 문서 우선, **G4/G5** 사용자 전환 entry 1건·파생 처리 추가 0건·Undo/Redo                            |
| R5  | Components 페이지가 테마 표면이 되려면 origin 이 전집이어야 한다 — ADR-228 미착수면 5 항목만 보인다 (표면 결손, 기능 결함 아님) |  LOW   | 227 은 228 을 선행 조건으로 두지 않는다 · **G5** 는 그 시점의 Components 페이지 전수로 측정 · 228 뒤 재측정 |
| R6  | 문서 비대화 — 테마마다 토큰 전체 저장                                                                                           |  LOW   | 델타 저장 (ADR-143 규칙 그대로) · G1 에서 미커스터마이즈 테마 델타 = {} 확인                                |

잔존 HIGH R1~R3은 G2/G3/G1과 각각 대응한다. 설계 수리와 구현 gate 통과는 별개다.

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                 | 실패 시 대안                                     |
| ---- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| G0   | Phase 0      | F1~F12 재실측 + token/geometry/DOM/Publish 소비자 표 + legacy 출처별 fixture + border 문자열/shorthand 포함 sweep + 변경 파일 집합 확정                   | 같은 ADR inventory 보강                          |
| G1   | Phase 1      | legacy flag on/off·themes 유무·stale 충돌·baseTypography·외부 import·저장 실패/재시도·reload 멱등·백업 복원, 기존 실효 시각 Δ0, 미편집 델타 {}            | migration 수리, legacy 값 보존                   |
| G2   | Phase 2      | Default/편집 테마 전수 및 color/typography/radius/shadow/focus 각각 비기본값·reset·light/dark·명시 hover/pressed, Canvas/Preview/Publish 소비 결과 일치   | 배선·매핑 수리, 미지원 축을 완료로 처리하지 않음 |
| G3   | Phase 3      | number/TokenRef 타입·resolve·CSS parse 통과, literal ratchet/원복 RED, seed Δ0, thin=3/thick=4 paint/외곽/content box 일치                                | 소비 경로 수리 후 재측정                         |
| G4   | Phase 4 live | 테마 생성/전환/편집/reset/reload/Undo/Redo, Canvas·Preview·Properties 반영, 사용자 전환 entry 1건, 600요소 총 전환 프레임 ≤25ms                           | snapshot 적용·invalidation 경로 수리             |
| G5   | Phase 5 live | Components origin/instance/slot 전수 반영, children 구조 무변화, 사용자 전환 entry 1건·파생 처리 추가 0건(동일 테마 재선택 0건), Undo/Redo, 600요소 ≤25ms | G4와 같은 경로 수리, 228 뒤 확정 전수로 재실행   |

측정 조건 (measurement-validity §1): Q1 의미 검증은 비기본 preset·legacy 설정·축별 수작업 fixture, 600요소 합성 문서는 규모 전용. Q2 불리 케이스는 typography/border 편집 및 light/dark·가시 집합 변경. Q3 같은 세션·문서·입력에서 기존 preset 전환과 새 전환의 총 frame 비용 A/B, 시각은 변경 전 baseline과 비기본 기대값을 각각 대조한다. Q4 DB hydration→snapshot→production 소비자→Preview ready/Publish를 실제 실행한다. Q5 ADR-198 실제 브라우저 픽셀·computed style·외곽/content box와 독립 기대값을 사용하며 두 내부 map의 일치만으로 통과하지 않는다. visible·headed·1440×900·DPR·기기·반복 수·힙 상태를 기록한다.

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
- 활성 snapshot을 color뿐 아니라 typography/radius/border/shadow/focus 및 layout 소비자에 전달해야 한다. 기존 CSS·generator·cache 배선 변경 비용이 발생한다.
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

## 리뷰 보완 (2026-09-21)

[round 1 리뷰](reviews/227.md)의 H1/H2/H3/M4를 반영했다. 설계 수리 완료, Proposed 유지. 구현·live·pixel·perf G0~G5는 UNVERIFIED다.
