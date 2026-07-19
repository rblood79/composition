# ADR-154: 반응형 Breakpoint 저작 배선 — viewport 별 스타일 편집 + 3경로 출력

## Status

Implemented — 2026-07-19 (Phase 1~3 전체 delivered, execute-adr. Accepted 2026-07-16 — 리뷰 round 1 승인, 이슈 3건 전부 fixed, `docs/adr/reviews/154.md`)

> **구현 완료 (execute-adr, 2026-07-16 ~ 07-19)**:
>
> - **Phase 1** (canonical schema, 2026-07-16 `e065fdb74`): `CanonicalNode.responsive?` optional 필드 + `responsive.types.ts` shared 이동 + .pen direct field roundtrip + 정적 가드.
> - **Phase 2** (Builder 편집, 2026-07-19 `c262b1566`/`b693f0862`/`e8e70b9ed`): 기존 BuilderHeader 스위처 → `activeBreakpoint` bridge + `resolveResponsiveLayoutNode` (R1 — 시그니처 계산 이전 resolve 로 merged style 이 캐시 자연 무효화) + Inspector override 편집·canonical write. live: tablet flexDirection override → Skia 즉시 반영(row↔column) + persist roundtrip.
> - **Phase 3** (Preview/Publish @media, 2026-07-19 `cb049019d`/`f04af96b0`/`66da1a7d6`): `responsiveCss.ts` SSOT (Preview·Publish 공용, Skia `resolveResponsiveLayoutNode` 와 동일 `getResponsiveValueWithCascade`) + `@media !important` (R6 — stylesheet important-author 가 non-important inline 을 이김, base inline BC 0). live G2: Preview/Publish 리사이즈 3-breakpoint + Skia↔DOM 동시 대칭(width 80==80px).
> - **Gate**: G1(Phase 2 정적+live) / G2(Phase 3 리사이즈 실측+Skia↔DOM 대칭) / G3(live behavior 3-exercise) / G4(Phase 1 roundtrip) 전부 통과. type-check baseline 63 유지, 관련 test 29 PASS.
> - **render-visual props 대칭 — 해소 완료 (2026-07-19 후속 fix)**: `fontSize`/`textAlign`(2/14) Skia glyph 대칭을 `StoreRenderBridge.buildNodeForElement` (렌더 단일 choke point) 에서 layout 과 **동일** `resolveResponsiveLayoutNode` 적용으로 해소. activeBreakpoint 변경 → layout republish → forceFullRebuild 로 자연 재resolve. live(window probe, `__composition_SKIA_DEBUG__.getSkiaNode`): 라벨 glyph fontSize desktop 14 ↔ mobile 40(override) 전환 + reversible. 이제 layout(12/14)+render-visual(2/14) 14/14 Skia↔DOM 대칭.
> - **잔여 (후속)**: ~~(a) apps/publish SSG @media~~ → **해소 (2026-07-19 후속)**: apps/publish 리액트 SSG 도 `PageRenderer` 에서 `collectResponsiveCssFromElements`(shared, flat `Element[]` 대응)로 `@media <style>` emit. `deriveProjectRenderModelFromDocument` 가 canonical `responsive` 를 runtime `Element` 로 전달, `ElementRenderer` 는 이미 `data-element-id` 부여. live(Chrome MCP, publish dev 3001 + sessionStorage payload): tablet `display:none` / mobile `width:50px`+`display:none`(cascade) `@media` 규칙 emit + base inline width 100% 무변경 확인. (모든 publish 경로 = `generateStaticHtml` + 리액트 SSG 완결). ~~(b) breakpoint 배지 UI·`ResponsiveVisibilityEditor` 배선~~ → **해소 (2026-07-19 후속)**: 스타일 패널 헤더 breakpoint 배지 + `ResponsiveSection`(활성 breakpoint override chip 목록 + `ResponsiveVisibilityEditor` desktop-lock 배선) 추가. live 검증(Chrome MCP, project 000 Card): Tablet↔Mobile 배지 전환 + "Width" override chip 노출 + chip ✕ clear + Mobile visibility hidden(eye-off) 반영 + desktop base(width 100%) 격리 확인. ~~(c) `updateSelectedStylePreview` 비-desktop live preview~~ → **해소 (2026-07-19 후속)**: 비-desktop preview 가 base 대신 `buildResponsiveStyleOverride`(commit 과 동일 helper)로 responsive override 를 elementsMap 에 반영 → 드래그/타이핑 중 캔버스 즉시 반영(desktop preview 와 동일 구조, base 무변경). live(Chrome MCP, project 000 Card): mobile 에서 mid-drag `updateSelectedStylePreview("width","50%")` → 카드 layout 폭 390→50 즉시 전환 + Skia 렌더 축소 + `ResponsiveSection` Width chip 노출, commit 전. base width 100% 격리 확인.

## Context

composition 은 노코드 **웹사이트** 빌더이지만 breakpoint 기반 반응형 저작 기능이 없다. 2026-07-16 Figma 벤치마크 감사 ([reference/audits/2026-07-16-figma-benchmark-gap-analysis.md](../../reference/audits/2026-07-16-figma-benchmark-gap-analysis.md)) 에서 **C1 · CRITICAL** (웹사이트 도구로서의 성립 격차 1순위) 로 판정됐다. Figma Sites 는 Desktop/Mobile 2-breakpoint 독립 편집이 제품의 출발점이다.

실측 상태 (2026-07-16):

- **타입/유틸 계층은 완비**: `apps/builder/src/types/builder/responsive.types.ts` — 3-breakpoint (desktop≥1280 / tablet 768–1279 / mobile<768), `ResponsiveValue`/`ElementResponsiveConfig`, desktop-first cascade resolve (`getResponsiveValueWithCascade`), 미디어쿼리 생성 (`generateMediaQueryString`), `BreakpointContext` 타입까지 설계돼 있다.
- **소비자 0**: 유일 소비자 `ResponsiveVisibilityEditor.tsx` 는 어디서도 참조되지 않는 orphan. `CanonicalNode` (`packages/shared/src/types/composition-document.types.ts:593`) 에 responsive 필드 부재, 캔버스는 고정 1920×1080 (`BuilderCanvas.tsx:104-105`), publish 출력에 `@media` 0건 (`export.utils.ts:982-1008`).
- 즉 본 ADR 은 "신규 설계"가 아니라 **기존 설계의 배선 (wiring) 방식 결정**이다.

**SSOT 3-domain 판정**: **D3 (시각 스타일)** — viewport 별 스타일은 시각 결과의 축이다. DOM 구조/ARIA (D1) 불변, props API (D2) 무관. Builder(Skia) 와 Preview/Publish(DOM+CSS) 는 대등 consumer 로서 동일 resolve 결과를 산출해야 한다.

**Generator 지원 선언** (반복 패턴 선차단 #2): responsive override 는 element inline style 축으로 catalog generated CSS 와 직교 — catalog Generator 확장 불필요. 신규 emit 지점은 element 단위 `@media` 규칙 (Phase 3) 뿐이다.

**Hard Constraints**:

1. Canvas 60fps — breakpoint 전환 시 full-tree 재계산이 발생하나, 전환은 명시적 사용자 행위 (페이지 전환과 동일 비용 클래스) 로 프레임 예산 밖.
2. Skia↔DOM 시각 대칭 (`/cross-check` 통과) — 같은 breakpoint 에서 두 경로 시각 결과 동일.
3. 기존 문서 하위 호환 — `responsive` 필드 없는 canonical 문서 로드 무영향 (optional 필드, base 스타일 저장 위치 무변경).
4. layoutVersion / sceneVersion 계약 준수 — override 편집·breakpoint 전환이 재계산을 확실히 트리거 (**`LAYOUT_STYLE_KEYS`**(계층 B, style 축 — override 는 위 §Generator 지원 선언대로 inline style 축이다) + projection signature 동시 등재).

**Soft Constraints**:

- 기존 3-breakpoint 타입 자산 재사용 (신규 breakpoint 편집 가능화는 범위 밖).
- Figma Sites (2-breakpoint) / Webflow (desktop-first cascade) / Framer (breakpoint variants) 업계 전례 — cascade 모델이 노코드 빌더 주류.

## Alternatives Considered

### 대안 A: 기존 cascade 모델 배선 — desktop=base + override 저장 + resolve 단일 진입점

- 설명: desktop 값은 기존 `props.style` 유지 (BC 무변경), tablet/mobile 은 `CanonicalNode.responsive.styles` 에 **override 만** 저장. Builder 는 `activeBreakpoint` 상태로 resolve 된 단일 스타일을 기존 파이프 (레이아웃 엔진→Skia) 에 공급, Preview/Publish 는 `generateMediaQueryString` 으로 `@media` CSS emit.
- 근거: Webflow·Framer 의 desktop-first cascade 와 동형. 코드베이스의 `getResponsiveValueWithCascade` 가 이미 이 모델로 구현돼 있음 — 배선 비용 최소.
- 위험:
  - 기술: **M** — 3경로 (Skia/Preview/Publish) resolve 일관성. 단 resolve 진입점을 단일 함수로 강제해 완화.
  - 성능: **M** — breakpoint 전환 시 full-tree rebuild. 명시적 사용자 행위라 60fps 예산 밖, 기존 페이지 전환과 동일 비용 클래스.
  - 유지보수: **M** — layoutVersion/signature 계약 접점 증가 (정적 가드로 완화).
  - 마이그레이션: **L** — optional 필드, 기존 문서 무변경.

### 대안 B: @media CSS 출력 중심 (build-time, DOM 우선)

- 설명: override 를 곧바로 media query CSS 로만 emit — builder 캔버스는 desktop 만 정확 표시, tablet/mobile 은 Preview 리사이즈로만 확인.
- 근거: 코드량 최소 (Skia 경로 무변경). 초기 웹 빌더 (구세대 페이지 빌더) 에서 흔한 모델.
- 위험:
  - 기술: **H** — Skia 는 media query 를 해석하지 않음 → builder 에서 비-desktop 편집·확인 불가.
  - 성능: **L**.
  - 유지보수: **H** — "CSS 에서만 보이는 상태" 는 D3 대칭 (Skia↔CSS 시각 동일성) 을 구조적으로 파괴 — ssot-hierarchy.md 금지 패턴.
  - 마이그레이션: **L**.

### 대안 C: breakpoint 별 독립 페이지 사본 (Figma Sites 초기 모델)

- 설명: 페이지를 breakpoint 별로 복제해 각각 독립 편집 (Figma Sites 의 Desktop/Mobile 별 콘텐츠 편집 모델).
- 근거: Figma Sites 가 채택한 모델 — 디자인 자유도 최대.
- 위험:
  - 기술: **M** — 복제·동기화 파이프 신규.
  - 성능: **M** — 문서 크기 breakpoint 수 배수.
  - 유지보수: **C** — 텍스트/구조 수정을 breakpoint 수만큼 반복, canonical `children[]` order SSOT (ADR-118) 와 사본 간 동기화 충돌. Figma Sites 에서도 콘텐츠 이중 관리가 공론화된 비판점.
  - 마이그레이션: **H** — 이후 cascade 모델로 회귀 시 사본 병합 비용.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | ---- | ---- | -------- | ------------ | :--------: |
| A    | M    | M    | M        | L            |     0      |
| B    | H    | L    | H        | L            |     2      |
| C    | M    | M    | C        | H            |  2 (C 1)   |

루프 판정: 대안 A 가 HIGH 0 으로 threshold 통과 — 추가 대안 루프 불필요.

## Decision

**대안 A: 기존 cascade 모델 배선**을 선택한다.

선택 근거:

1. HIGH+ 위험 0 인 유일한 대안 — 잔존 위험 (3경로 일관성, 재계산 계약) 은 resolve 단일 진입점 + 정적 가드 + live 게이트로 관리 가능한 MEDIUM.
2. `responsive.types.ts` 의 cascade/미디어쿼리 유틸이 이미 이 모델로 완성돼 있어 배선 비용이 최소 — "설계 재사용" 이 본 ADR 의 전제.
3. desktop=base 저장 규약으로 기존 문서·기존 편집 흐름이 무변경 (BC 위험 최소).

기각 사유:

- **대안 B 기각**: builder 에서 비-desktop 상태를 편집·확인할 수 없어 D3 대칭 (Skia↔CSS 시각 동일성) 을 구조적으로 파괴 — 벤치마크가 지적한 격차 (breakpoint 저작) 를 절반만 해소.
- **대안 C 기각**: 콘텐츠 이중 관리 + canonical order SSOT 와의 동기화 충돌 (유지보수 CRITICAL). Figma Sites 전례에서도 비판점으로 확인된 모델.

> 구현 상세: [154-responsive-breakpoint-authoring-breakdown.md](../design/154-responsive-breakpoint-authoring-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                                    | 심각도 | 대응                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | layoutVersion **5-심볼 2계층 체인** / sceneVersion projection signature 등재 누락 → override 편집·breakpoint 전환이 캔버스에 미반영. **축 주의**: responsive override 는 **style 축**(§Generator 지원 선언)이므로 계층 B 는 `LAYOUT_PROP_KEYS`(props 축, `props[key]` 만 읽음)가 아니라 **`LAYOUT_STYLE_KEYS`** 다 — 잘못된 배열에 등재하면 정적 가드는 통과하고 기능만 무반영이 된다 (ADR-156 R6 동형) |  HIGH  | **`LAYOUT_STYLE_KEYS`**(style 축) + `NON_LAYOUT_PROPS_UPDATE` 미등재 확인(계층 A) + `buildSceneStructureSnapshot()` signature input 동시 등재를 정적 테스트로 가드 (G1). `activeBreakpoint` 자체는 element props 가 아닌 전역 상태라 별도 invalidation 경로 확인 필요 |
| R2  | 3경로 (Skia/Preview/Publish) resolve 발산 — 한 경로만 cascade 를 다르게 해석                                                                                                                                                                                                                                                                                                                            |  MED   | resolve 단일 진입점 (`getResponsiveValueWithCascade`) 강제 + publish 는 @media 단일 출력 (런타임 JS resolve 금지) + `/cross-check` (G2)                                                                                                                               |
| R3  | breakpoint 전환 full-tree rebuild 비용이 대형 문서에서 체감 지연                                                                                                                                                                                                                                                                                                                                        |  MED   | 페이지 전환과 동일 경로 재사용 (기존 비용 검증됨). 착수 시 대형 문서 (100+ 요소) 전환 시간 실측, 500ms 초과 시 증분 경로 검토                                                                                                                                         |
| R4  | responsive override 가 store longhand 정책 (ADR-909) 을 우회해 shorthand 로 저장 → 편집 무시 회귀                                                                                                                                                                                                                                                                                                       |  MED   | override 쓰기도 `distributeShorthand` 경로 공유, 신규 consumer 체크리스트 (style-ssot.md) 적용                                                                                                                                                                        |
| R5  | .pen roundtrip 에서 `responsive` 필드 유실 (pencil format 미규정 필드)                                                                                                                                                                                                                                                                                                                                  |  MED   | Phase 1 에서 `PENCIL_DIRECT_NODE_FIELDS` 등재 vs x-composition extension 경유 판정 + roundtrip 테스트                                                                                                                                                                 |
| R6  | Preview/Publish 는 요소 스타일을 inline (`style={element.props.style}`) 으로 적용 — `@media` stylesheet 규칙이 inline 을 이기지 못해 tablet/mobile override 가 무효화 (리뷰 round 1 발견)                                                                                                                                                                                                               |  MED   | responsive override 보유 요소는 base 스타일도 `[data-element-id]` selector stylesheet 규칙으로 승격 (또는 CSS custom property 간접화) — Phase 3 착수 시 2안 중 확정, G2 Preview 리사이즈 실측이 검출 게이트                                                           |

## Gates

| Gate | 시점                | 통과 조건                                                                                                                                                                                                                          | 실패 시 대안                                   |
| ---- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| G1   | Phase 2 완료 커밋   | 정적 테스트: **`LAYOUT_STYLE_KEYS`**(style 축 — `LAYOUT_PROP_KEYS` 아님) 에 responsive 시그니처 + signature input 등재 확인 (fullTreeLayout.static.test.ts 패턴) + **live**: tablet override 편집 → Skia 즉시 반영 (새로고침 없이) | 등재 후 재실행 — 미등재 상태로 phase 종결 금지 |
| G2   | Phase 3 완료 커밋   | `/cross-check` 대표 컴포넌트 3종 × 3 breakpoint 시각 대칭 + Preview 리사이즈 @media 동작                                                                                                                                           | 발산 경로 수정 후 재검증                       |
| G3   | Implemented 승격 전 | live behavior 게이트 (CLAUDE.md 완료 기준): Chrome MCP 로 스위처 전환·tablet override 편집·Preview 반영 3-exercise 를 검증 블록에 명시                                                                                             | 승격 보류 — test PASS 단독 종결 금지           |
| G4   | Phase 1 완료 커밋   | 기존 문서 (responsive 부재) 로드 무영향 + .pen roundtrip 보존 테스트                                                                                                                                                               | 스키마 재설계 (extension 경유로 전환)          |

## Consequences

### Positive

- 벤치마크 C1 (CRITICAL) 해소 — "웹사이트 디자인 도구" 정체성의 최소 요건 충족. Figma Sites 의 2-breakpoint 대비 3-breakpoint 저작.
- C3 (SEO/반응형 출력) 의 선행 조건 확보 — publish 출력에 `@media` 경로가 생김.
- orphan 자산 (`responsive.types.ts`, `ResponsiveVisibilityEditor`) 이 가동 경로에 편입 — dead code 해소.

### Negative

- Inspector 복잡도 증가 — breakpoint 배지(스타일 패널 헤더)·override chip 요약(`ResponsiveSection`)이 스타일 패널에 접점 추가. 단 실제 구현은 per-field dirty 마커를 전 입력에 배선하지 않고 전용 섹션 1개 + 헤더 배지로 국한했다 (`useHasDirtyStyles` 판정 배열 미확장 — override 존재 판정은 raw `element.responsive` 를 읽는 `useResponsiveOverrides` 단일 훅).
- canonical schema 필드 1 증가 — mutation wrapper/history/roundtrip/signature 4곳 동시 보수 의무가 영구 추가.
- full-tree 재계산 트리거 1종 추가 — layoutVersion 계약 관리 표면 확대.
- ~~render-visual props (`fontSize`/`textAlign` 2/14) Skia glyph 대칭 미완~~ → **해소 (2026-07-19)**: `StoreRenderBridge.buildNodeForElement` 에서 layout 과 동일 `resolveResponsiveLayoutNode` 적용 — glyph 가 activeBreakpoint 기준 override 값으로 렌더 (live: fontSize desktop 14 ↔ mobile 40). layout+render 14/14 Skia↔DOM 대칭.
