# ADR-154 구현 상세 — 반응형 Breakpoint 저작 배선

> 본문: [154-responsive-breakpoint-authoring.md](../154-responsive-breakpoint-authoring.md)
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

## 3. Phase 1 — 데이터 모델 (canonical schema) ✅ Implemented 2026-07-16

1. `CanonicalNode` 에 `responsive?: ElementResponsiveConfig` optional 필드 추가 (`composition-document.types.ts`). 타입은 `responsive.types.ts` 의 것을 shared 로 이동 또는 re-export (builder→shared 역방향 import 금지, package boundary: specs ← shared ← builder).
2. 저장 규약:
   - **desktop = base**: desktop 값은 기존 `props.style` 에 그대로 저장 (BC 무변경). `responsive.styles.{prop}.{tablet|mobile}` 에는 **override 만** 저장 — cascade resolve 는 `getResponsiveValueWithCascade` 단일 진입점.
   - **longhand 정책 준수 (ADR-909)**: responsive override 도 store longhand only (gap → rowGap/columnGap 분배). `distributeShorthand` 경로 공유.
3. mutation: `canonicalMutations.ts` wrapper 경유 + canonical 1차 → set → `_rebuildIndexes` → persist 순서 (state-management.md 의무). history event 는 canonical replace event. **(Phase 2 로 이연 — 첫 소비자인 Inspector 편집과 함께 도입. 소비자 0 상태의 wrapper 선반영은 dormant foundation 회피 원칙 위배)**
4. roundtrip: `.pen` export/import (`adapters/pencil/pencilSchemaMap.ts`) 에 `responsive` 필드 보존 여부 판정 — pencil format 미규정 필드면 `PENCIL_DIRECT_NODE_FIELDS` 등재 또는 x-composition extension 경유 (Phase 1 착수 시 판정, ADR-116 §3). **판정 결과 (2026-07-16): direct field 등재 채택** — shared `PENCIL_NODE_FIELDS` + 양방향 `assignIfPresent` (clip/placeholder 선례). x-composition 기각: 해당 extension 은 events/actions 류 비-시각 payload 용이고, responsive 는 serializable 시각 config 라 direct field 정합.
5. 정적 가드: 기존 문서 (responsive 필드 없음) 로드 무영향 테스트.

## 4. Phase 2 — Builder 편집 경로

1. **activeBreakpoint 상태**: `canvasSettings` 슬라이스에 `activeBreakpoint: BreakpointName` (기본 desktop). 페이지 아트보드 폭을 breakpoint 대표 폭으로 전환 (desktop 1920 유지 / tablet 1024 / mobile 390 — 대표 폭은 리뷰에서 확정).
2. **스위처 UI**: 캔버스 툴바에 Monitor/Tablet/Smartphone 토글 (lucide, `BREAKPOINTS[].icon` 재사용).
3. **레이아웃/렌더 resolve**: `fullTreeLayout.ts` 의 요소 style 소비 앞단에서 `activeBreakpoint !== "desktop"` 이면 override merge (base ⊕ cascade). 주의:
   - **layoutVersion 계약**: activeBreakpoint 변경 + responsive override 편집 모두 `layoutVersion + 1` 경로 통과. `LAYOUT_PROP_KEYS` 에 responsive 시그니처 반영 (누락 시 캐시 히트로 미반영 — layout-engine.md 3-심볼 체인).
   - **sceneVersion projection signature**: responsive 는 projection-relevant field → `buildSceneStructureSnapshot()` signature input 에 동시 등재 (canvas-rendering.md §9 — 누락 시 phantom change 미감지).
   - **merged map override 판정 함정**: base⊕override 병합 map 에서 `style?.X != null` 재판정 금지 (메모리 feedback-merged-style-map-kills-override-detection) — resolve 결과와 override 존재 판정을 분리.
4. **Inspector**: 비-desktop breakpoint 에서 스타일 편집 시 override 로 저장 + 필드에 breakpoint 배지 (Figma/Webflow 관행). `ResponsiveVisibilityEditor` 를 PropertySection 으로 배선 (visibility → `display:none` emit).
5. **Skia 대칭**: builder 는 resolve 된 단일 스타일만 소비하므로 Skia 렌더러 변경 최소 — cross-check 로 3 breakpoint × 대표 컴포넌트 검증.

## 5. Phase 3 — Preview/Publish 출력

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
| `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts`                                 | `LAYOUT_PROP_KEYS` responsive 시그니처 등재                 |
| `apps/builder/src/builder/workspace/canvas/scene/buildSceneSnapshot.ts`                          | `buildSceneStructureSnapshot()` (:109) signature input 등재 |
| `apps/builder/src/builder/panels/styles/*` / `properties/editors/ResponsiveVisibilityEditor.tsx` | 배지 + 배선                                                 |
| `apps/builder/src/adapters/canonical/canonicalMutations.ts`                                      | responsive mutation wrapper                                 |
| `apps/builder/src/adapters/pencil/pencilSchemaMap.ts`                                            | roundtrip 보존                                              |
| `apps/builder/src/preview/*` + `packages/shared/src/utils/export.utils.ts`                       | @media 출력                                                 |

## 8. 테스트 계획

- unit: cascade resolve (desktop-first fallback 경계값 1279/1280, 767/768) / longhand 분배 / 미디어쿼리 문자열.
- 정적 가드: `LAYOUT_PROP_KEYS` responsive 등재 + signature input 등재 (기존 `fullTreeLayout.static.test.ts` 패턴).
- roundtrip: canonical ↔ .pen ↔ canonical 에서 `responsive` 보존.
- live: Phase 4 Chrome MCP 3-exercise.
