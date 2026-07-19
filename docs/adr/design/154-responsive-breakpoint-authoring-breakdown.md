# ADR-154 구현 상세 — 반응형 Breakpoint 저작 배선

> 본문: [154-responsive-breakpoint-authoring.md](../completed/154-responsive-breakpoint-authoring.md)
> 상태: Accepted (2026-07-16) — 리뷰 round 1 승인, execute-adr 진행

## 1. Scope lock-in

- 2026-07-16 벤치마크 감사 ([2026-07-16-figma-benchmark-gap-analysis.md](../../reference/audits/2026-07-16-figma-benchmark-gap-analysis.md)) 의 C1 항목 단독 범위. 사용자가 3개 후보 (C1 배선 / 격차 해소 charter / H2 스타일 UI 노출) 중 **C1 단독**을 선택 (2026-07-16 세션 확정).
- H2 (스타일 편집 UI 노출)·H1 (캔버스 정밀 도구) 는 본 ADR 범위 밖 — 필요 시 사용자 제기 시점에 별도 ADR.
- 완전 신규 주제 ADR — 기존 ADR fork 아님 (fork 게이트 해당 없음).

## 2. Phase 0 — 인벤토리 freeze (착수 시 재실측)

기존 자산 (재사용) vs 신규 (부재) 판정표. 착수 시점에 라이브 재확인 후 freeze.

| 자산                                                                                            | 상태                                                                                                       | 위치                                                                                | 처리                                      |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------- |
| `BreakpointName`/`BREAKPOINTS`/`BREAKPOINT_ORDER` (desktop≥1280 / tablet 768–1279 / mobile<768) | 완비                                                                                                       | `apps/builder/src/types/builder/responsive.types.ts:15-62`                          | 재사용                                    |
| `ResponsiveValue<T>` / `ResponsiveStyles` (14 prop 화이트리스트) / `ElementResponsiveConfig`    | 완비                                                                                                       | `responsive.types.ts:72-132`                                                        | 재사용 (화이트리스트 확장은 Phase 2 판정) |
| `getResponsiveValueWithCascade` (desktop-first fallback)                                        | 완비                                                                                                       | `responsive.types.ts:239-266`                                                       | 재사용 — resolve 단일 진입점              |
| `generateMediaQueryString` / `GeneratedMediaQuery`                                              | 완비                                                                                                       | `responsive.types.ts:155-283`                                                       | 재사용 — Phase 3 CSS 출력                 |
| `BreakpointContext` 타입 (state+actions)                                                        | 타입만                                                                                                     | `responsive.types.ts:183-209`                                                       | Provider 구현은 신규                      |
| `ResponsiveVisibilityEditor`                                                                    | orphan (참조 0건)                                                                                          | `apps/builder/src/builder/panels/properties/editors/ResponsiveVisibilityEditor.tsx` | Phase 2 에서 배선                         |
| `CanonicalNode.responsive` 필드                                                                 | **부재**                                                                                                   | `packages/shared/src/types/composition-document.types.ts:593`                       | Phase 1 신규 (optional)                   |
| activeBreakpoint 편집 상태 / 스위처 UI                                                          | **부재**                                                                                                   | —                                                                                   | Phase 2 신규                              |
| 캔버스 breakpoint 폭 전환                                                                       | **부재** (고정 1920×1080: `BuilderCanvas.tsx:104-105`, `viewportSync.ts:22`)                               | —                                                                                   | Phase 2 신규                              |
| 레이아웃 resolve 주입 지점                                                                      | **부재**                                                                                                   | `layout/engines/fullTreeLayout.ts` (processedElementsMap 생성 앞단)                 | Phase 2 신규                              |
| Preview/Publish @media 출력                                                                     | **부재** (`generateStaticHtml` 은 title+viewport 만: `packages/shared/src/utils/export.utils.ts:982-1008`) | —                                                                                   | Phase 3 신규                              |

## 2.1 Phase 0 재실측 정정 (2026-07-19 · execute-adr)

Phase 2 착수 시 라이브 재실측 결과, §2 인벤토리의 아래 2행이 **stale** 임을 확인 (M3 원칙 — 추정 vs 실측 gap = Phase 0 freeze 부실, 새 ADR fork 아님. 본 정정으로 흡수):

| 자산                             | §2 원 판정                | 재실측 (2026-07-19)                                                                                                                                                                                                                       | 처리                                    |
| -------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| breakpoint 스위처 UI             | **부재** (Phase 2 신규)   | **존재 (live)** — `BuilderHeader.tsx:166` `ToggleButtonGroup` (desktop/laptop/tablet/mobile 4 preset), `BuilderCore.tsx:402` breakpoints 목록 + `handleBreakpointChange` (localStorage 저장)                                              | **재사용** — 중복 스위처 미생성         |
| 캔버스 breakpoint 폭 전환        | **부재** (고정 1920×1080) | **존재 (live)** — `useWorkspaceCanvasSizing.ts` 가 선택된 breakpoint 의 `max_width/max_height` 로 아트보드 폭 전환 (`Workspace.tsx:91` `pageWidth={canvasSize.width}`). "고정 1920×1080" 은 `BuilderCanvas` DEFAULT 상수일 뿐 실동작 아님 | **재사용** — 폭 전환 배선 불필요        |
| responsive override resolve      | 부재 (Phase 2 신규)       | **부재 확정** — `fullTreeLayout.ts` 에 responsive/activeBreakpoint/cascade 0건. 기존 스위처는 아트보드만 리사이즈, override 미연결                                                                                                        | **신규 (핵심 gap)**                     |
| activeBreakpoint(BreakpointName) | 부재                      | 부재 — 기존 선택은 `Set<Key>` (4 preset), layout/Inspector 가 읽을 `BreakpointName` 미노출                                                                                                                                                | **신규** — 기존 선택기에서 파생(bridge) |

**정정에 따른 Phase 2 방향 조정**: 신규 스위처/폭 전환을 만들지 않고 **기존 BuilderHeader 선택기를 단일 source 로 재사용**한다. 기존 선택(`Set<Key>`, desktop/laptop/tablet/mobile) → `activeBreakpoint: BreakpointName` 파생 (laptop→desktop tier 매핑, laptop 은 아트보드 크기 preset 일 뿐 override tier 없음). desktop/laptop 편집은 base(기존 동작 무변경), tablet/mobile 편집만 override. 이로써 Phase 2 실작업은 **resolve 배선 + R1 계약 + Inspector override 편집 + mutation** 으로 좁혀진다.

## 3. Phase 1 — 데이터 모델 (canonical schema) ✅ Implemented 2026-07-16

1. `CanonicalNode` 에 `responsive?: ElementResponsiveConfig` optional 필드 추가 (`composition-document.types.ts`). 타입은 `responsive.types.ts` 의 것을 shared 로 이동 또는 re-export (builder→shared 역방향 import 금지, package boundary: specs ← shared ← builder).
2. 저장 규약:
   - **desktop = base**: desktop 값은 기존 `props.style` 에 그대로 저장 (BC 무변경). `responsive.styles.{prop}.{tablet|mobile}` 에는 **override 만** 저장 — cascade resolve 는 `getResponsiveValueWithCascade` 단일 진입점.
   - **longhand 정책 준수 (ADR-909)**: responsive override 도 store longhand only (gap → rowGap/columnGap 분배). `distributeShorthand` 경로 공유.
3. mutation: `canonicalMutations.ts` wrapper 경유 + canonical 1차 → set → `_rebuildIndexes` → persist 순서 (state-management.md 의무). history event 는 canonical replace event. **(Phase 2 로 이연 — 첫 소비자인 Inspector 편집과 함께 도입. 소비자 0 상태의 wrapper 선반영은 dormant foundation 회피 원칙 위배)**
4. roundtrip: `.pen` export/import (`adapters/pencil/pencilSchemaMap.ts`) 에 `responsive` 필드 보존 여부 판정 — pencil format 미규정 필드면 `PENCIL_DIRECT_NODE_FIELDS` 등재 또는 x-composition extension 경유 (Phase 1 착수 시 판정, ADR-116 §3). **판정 결과 (2026-07-16): direct field 등재 채택** — shared `PENCIL_NODE_FIELDS` + 양방향 `assignIfPresent` (clip/placeholder 선례). x-composition 기각: 해당 extension 은 events/actions 류 비-시각 payload 용이고, responsive 는 serializable 시각 config 라 direct field 정합.
5. 정적 가드: 기존 문서 (responsive 필드 없음) 로드 무영향 테스트.

## 4. Phase 2 — Builder 편집 경로

> **✅ 핵심 Implemented 2026-07-19 (execute-adr, live 검증)** — 커밋 `c262b1566`(2-a resolve 배선) + `b693f0862`(2-b Inspector override) + `e8e70b9ed`(2-c threading 누락 해소). layout-affecting responsive override 저작이 실제 builder 에서 end-to-end 작동 확인 (Chrome MCP): tablet 에서 flexDirection override 편집 → Skia 자식 배치 즉시 전환(row↔column) + desktop base 격리(override 미침범) + persist→reload roundtrip 생존. 아래는 실제 배선 결과 반영.
>
> **잔여 (후속)**: ~~(a) render-visual props 대칭~~ → **해소 (2026-07-19 후속 fix)**: `fontSize`/`textAlign`(2/14) Skia glyph 를 `StoreRenderBridge.buildNodeForElement`(렌더 단일 choke point)에서 layout 과 동일 `resolveResponsiveLayoutNode` 적용 → glyph 가 activeBreakpoint override 값으로 렌더. layout props 12/14 + render-visual 2/14 = 14/14 Skia↔DOM 대칭. (b) **breakpoint 배지 UI** + `ResponsiveVisibilityEditor` PropertySection 배선(항목 4 후반) 미착수 — override 편집은 작동하나 어느 필드가 override 인지 시각 표시 없음. (c) **updateSelectedStylePreview** 는 비-desktop 에서 live preview skip(commit 시 반영) — drag 중 실시간 미리보기 후속.
>
> **§2.1 재실측 반영 (2026-07-19)**: 항목 1·2(activeBreakpoint 상태·스위처 UI·아트보드 폭 전환)는 기존 자산 재사용으로 대체됨. 아래 1·2 는 신규 build 가 아니라 **기존 BuilderHeader 선택기 → activeBreakpoint 파생 bridge**.

1. **activeBreakpoint 파생 (bridge, 기존 선택기 재사용)**: `canvasSettings` 슬라이스에 `activeBreakpoint: BreakpointName` (기본 desktop) 추가 — layout/Inspector 가 읽을 SSOT. 값은 **기존 BuilderHeader 선택기**(`BuilderCore.handleBreakpointChange`, `Set<Key>` 4 preset)에서 파생하여 store 에 write (desktop/laptop→desktop, tablet→tablet, mobile→mobile). 아트보드 폭 전환은 기존 `useWorkspaceCanvasSizing` 이 이미 담당 → 신규 배선 불필요.
2. **스위처 UI**: 신규 생성 안 함 — 기존 `BuilderHeader` `ToggleButtonGroup` 재사용 (§2.1). laptop preset 은 아트보드 크기 전용(override tier 없음), desktop tier 로 resolve.
3. **레이아웃/렌더 resolve (핵심 신규)**: `fullTreeLayout.ts` 의 요소 style 소비 앞단에서 `activeBreakpoint !== "desktop"` 이면 override merge (base ⊕ cascade, `getResponsiveValueWithCascade` 단일 진입점). 주의:
   - **layoutVersion 계약 (R1 HIGH)**: activeBreakpoint 변경(전역) + responsive override 편집(요소별) 모두 `layoutVersion + 1` 경로 통과. **채택 방식**: resolve 를 **시그니처 계산 이전**에 수행하여 effective(merged) style 로 `createElementLayoutSignature` 가 계산되게 한다 — override 를 `LAYOUT_STYLE_KEYS` 에 별도 등재하지 않고도 merged style 이 시그니처에 자연 반영(activeBreakpoint 변경→merge 결과 변경→시그니처 변경→캐시 miss). activeBreakpoint 전역 term 은 `pageLayoutSignature` 에 prefix 로 추가(또는 cache 비교 dimension). `LAYOUT_PROP_KEYS`(props 축) 오등재 함정 회피.
   - **sceneVersion projection signature**: responsive 는 projection-relevant field → `buildSceneStructureSnapshot()` signature input 에 activeBreakpoint + element.responsive 동시 등재 (canvas-rendering.md §9 — 누락 시 phantom change 미감지).
   - **merged map override 판정 함정**: base⊕override 병합 map 에서 `style?.X != null` 재판정 금지 (메모리 feedback-merged-style-map-kills-override-detection) — Inspector override 존재 판정은 **raw `element.responsive`** 를 읽고, resolve 결과(merged style)와 분리.
4. **Inspector**: 비-desktop breakpoint 에서 스타일 편집 시 override 로 저장 + 필드에 breakpoint 배지 (Figma/Webflow 관행). `ResponsiveVisibilityEditor` 를 PropertySection 으로 배선 (visibility → `display:none` emit).
5. **Skia 대칭**: builder 는 resolve 된 단일 스타일만 소비하므로 Skia 렌더러 변경 최소 — cross-check 로 3 breakpoint × 대표 컴포넌트 검증.

## 5. Phase 3 — Preview/Publish 출력

> **✅ Implemented 2026-07-19 (execute-adr, live 검증)** — 커밋 `cb049019d`(3-a shared @media SSOT) + `f04af96b0`(3-b Preview 주입) + `66da1a7d6`(3-c Publish 출력). 3-sub-step 분할 실행.
>
> **R6 확정 (2안 중 개선안 채택)**: breakdown 이 제시한 2안(① base 를 `[data-element-id]` stylesheet 로 승격 + inline strip / ② CSS custom property 간접화) 대신 **더 단순한 3안**을 채택 — tablet/mobile override 만 `@media { [data-element-id] { prop: value !important } }` 로 emit, **base inline 무변경**. 근거: CSS cascade 상 stylesheet `!important` 선언(important-author 버킷)이 non-important inline(normal-author 버킷)을 origin/importance 단계에서 이긴다(특이도 비교 이전). inline strip / base 승격 불필요 → desktop 렌더 BC 0. `!important` 는 `[data-element-id]` selector + tablet/mobile @media 로 스코프 한정.
>
> **SSOT (R2)**: `packages/shared/src/utils/responsiveCss.ts` 의 `buildResponsiveElementCss` / `collectResponsiveCss` 가 Preview(App.tsx)·Publish(export.utils.ts) 공용 단일 진입점. Builder(Skia) `resolveResponsiveLayoutNode` 와 **동일** `getResponsiveValueWithCascade` 로 breakpoint 값 pre-resolve → 3경로 발산 0. `BREAKPOINTS` 상호배타 범위(desktop≥1280/tablet768–1279/mobile≤767)라 mobile 이 tablet 을 자연 상속 못 하므로 각 bp 를 cascade pre-resolve 하여 해당 @media 에 직접 삽입.
>
> **G2 live 검증 (Chrome MCP, 실제 project 000 Button + 생성 정적 HTML)**:
>
> - Preview iframe 리사이즈 3-breakpoint: desktop 1400px→200px(base inline) / tablet 1000px→200px(mobile-only override 미적용, cascade) / mobile 500px→80px(`@media !important` 가 inline 200px 이김).
> - Publish(generateStaticHtml) 정적 HTML resizable iframe: tablet→flex-direction:column(override) / mobile→column(cascade)+width:80px(override).
> - **Skia↔DOM 대칭 동시 실측** (activeBreakpoint=mobile): Skia layout width=80 == DOM preview computed width=80px — 두 consumer 동일 override 값.
> - persist roundtrip: base(props.style)/override(responsive.styles) 새로고침 후 IDB→canonical→element 생존. 검증 후 요소 원상 복구(responsive 0건 확인).
> - 15 unit test (responsiveCss 12 + generateStaticHtml.responsive 3).
>
> **잔여 (후속)**: ~~(a) render-visual props 대칭~~ → **해소 (2026-07-19 후속 fix)**: `StoreRenderBridge.buildNodeForElement` 에서 layout 과 동일 `resolveResponsiveLayoutNode` 적용 → Skia glyph 가 activeBreakpoint override 값 렌더(live window probe: fontSize desktop 14 ↔ mobile 40). DOM @media(Phase 3) 와 동일 resolve helper 라 mobile 에서 DOM computed == Skia glyph == 40 대칭. (b) **apps/publish SSG(ElementRenderer)** — ADR §2 인벤토리가 명명한 publish 출력은 `generateStaticHtml` 단일 경로라 본 phase 는 그로 한정. apps/publish 리액트 SSG 앱도 inline style 적용 구조라 동일 @media 주입이 필요하나 ADR scope 밖 후속(scope inflation 회피). (c) **BreakpointContext Provider(forcedBreakpoint 테스트용, 항목 3)** — 실제 iframe 리사이즈로 @media 가 동작하므로 강제 breakpoint provider 는 미착수(선택). (d) generateStaticHtml 의 base 숫자 스타일 inline 미적용은 pre-existing 한계(ADR-154 무관).

1. **단일 출력 모델**: @media CSS (`generateMediaQueryString` 재사용). publish 런타임 JS resolve 금지 (R2 발산 차단).
2. responsive override → element 별 CSS 규칙 emit: `ElementGeneratedCSS` (baseCSS + mediaQueries) 를 Preview 스타일 주입 경로와 `generateStaticHtml`/SSG 출력에 추가.
3. Preview iframe 리사이즈로 breakpoint 동작 확인 경로 확보 (BreakpointContext Provider — `forcedBreakpoint` 테스트용).
4. visibility override 는 `display:none` @media 규칙로 통일 (JS 분기 금지).
5. **inline style specificity 해소 (R6 — 리뷰 round 1 발견)**: Preview/Publish 는 요소 스타일을 inline 으로 적용 (`style={element.props.style}` — `packages/shared/src/renderers/__tests__/rendererStyleContract.allowlist.ts` 빈 allowlist = 전 renderer 통과, `CanonicalNodeRenderer.tsx:314` `data-element-id` 마커 존재). inline 은 `@media` stylesheet 규칙보다 우선하므로 **responsive override 보유 요소는 base 스타일도 `[data-element-id="..."]` selector stylesheet 로 승격**하거나 **CSS custom property 간접화** (inline 에는 `var(--x)` 만 두고 값은 stylesheet 에서 breakpoint 별 재정의) 중 1안을 Phase 3 착수 시 확정. 미해소 시 G2 (Preview 리사이즈 실측) 에서 FAIL.

## 6. Phase 4 — 검증·종결

- live behavior 게이트 (CLAUDE.md 완료 기준): Chrome MCP 로 실제 builder 에서 ① 스위처 전환 → 아트보드 폭 변경 ② tablet 에서 flexDirection override 편집 → Skia 반영 ③ Preview 리사이즈 시 @media 적용 — 3개 exercise 를 커밋 검증 블록에 명시.
- `/cross-check`: 대표 컴포넌트 3종 × 3 breakpoint.
- 회귀: 기존 문서 로드 (responsive 부재) / undo-redo / .pen roundtrip.
- CHANGELOG: Implemented 승격 커밋에 Features 엔트리 (trigger #1).

## 7. 파일 변경표 (예상 — Phase 0 재실측으로 확정)

| 파일                                                                                             | 변경                                                        |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| `packages/shared/src/types/composition-document.types.ts`                                        | `CanonicalNode.responsive?` 추가                            |
| `apps/builder/src/types/builder/responsive.types.ts`                                             | shared 이동 또는 re-export 정리                             |
| `apps/builder/src/builder/stores/canvasSettings.ts`                                              | `activeBreakpoint` 상태                                     |
| `apps/builder/src/builder/workspace/canvas/BuilderCanvas.tsx` + `viewportSync.ts`                | 아트보드 폭 전환                                            |
| `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts`                     | resolve 주입 + layoutVersion 트리거                         |
| `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts`                                 | **`LAYOUT_STYLE_KEYS`** responsive 시그니처 등재 (style 축) |
| `apps/builder/src/builder/workspace/canvas/scene/buildSceneSnapshot.ts`                          | `buildSceneStructureSnapshot()` (:109) signature input 등재 |
| `apps/builder/src/builder/panels/styles/*` / `properties/editors/ResponsiveVisibilityEditor.tsx` | 배지 + 배선                                                 |
| `apps/builder/src/adapters/canonical/canonicalMutations.ts`                                      | responsive mutation wrapper                                 |
| `apps/builder/src/adapters/pencil/pencilSchemaMap.ts`                                            | roundtrip 보존                                              |
| `apps/builder/src/preview/*` + `packages/shared/src/utils/export.utils.ts`                       | @media 출력                                                 |

## 8. 테스트 계획

- unit: cascade resolve (desktop-first fallback 경계값 1279/1280, 767/768) / longhand 분배 / 미디어쿼리 문자열.
- 정적 가드: **`LAYOUT_STYLE_KEYS`** responsive 등재 (style 축 — `LAYOUT_PROP_KEYS` 아님) + signature input 등재 (기존 `fullTreeLayout.static.test.ts` 패턴).
- roundtrip: canonical ↔ .pen ↔ canonical 에서 `responsive` 보존.
- live: Phase 4 Chrome MCP 3-exercise.
