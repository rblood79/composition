# Figma 대비 composition 웹사이트 디자인 기능 격차 벤치마크

> **작성**: 2026-07-16 · **방법**: 코드베이스 실측 (병렬 탐색 4축 — 시각 스타일 / 레이아웃·반응형·캔버스 도구 / 컴포넌트·디자인 시스템 / 인터랙션·퍼블리시·협업·데이터) × Figma/Figma Sites 공개 기준선 (2025 Config + Sites 문서) 교차.
> **성격**: 스냅샷 감사 문서 — 이후 기능 추가 시 stale 가능. 근거는 실측 시점의 파일 경로.

## 총평

composition 은 **렌더링 인프라와 데이터/이벤트 계층은 Figma 를 능가하는 수준**이지만, **디자이너가 손으로 만지는 표면 — 반응형 저작, 캔버스 정밀 편집 도구, 스타일 편집 UI, 협업 — 에서 구조적 격차**가 있다.

핵심 관찰:

> **격차의 약 절반은 "기능 부재"가 아니라 "렌더 파이프는 완비됐는데 편집 UI 가 미노출"** — grid 편집기, position 모드, transform, blur/filter, blend mode, clip-path, breakpoint 가 전부 이 패턴이다. 이 절반은 해소 비용이 낮다 (Inspector 노출 수준). 나머지 절반 (실배포, 협업, 벡터 도구) 은 아키텍처 투자가 필요하다.

## Figma 기준선 요약 (비교 대상)

- **Figma Sites** (2025): Desktop/Mobile 2-breakpoint 반응형 저작, 프리셋 인터랙션 (mouse/scroll parallax, scroll transform, lightbox), hover/pressed 상태, code layers (React 커스텀 코드 + AI 편집), CMS, publish + 커스텀 도메인.
- **Config 2025**: Figma Draw (brushes, pattern/texture fill, shape builder, boolean ops, text-on-path, dynamic stroke, progressive blur), Grid auto layout (2차원 배치 + span), Figma Make (텍스트→동작 코드 프로토타입).
- **기존 코어**: components/variants/component properties, Variables (모드·alias), 명명 스타일, 팀 라이브러리, 멀티플레이어·코멘트·버전 히스토리, 플러그인 생태계, Dev Mode.

---

## 1. 심각도별 격차 지도

심각도 기준: **CRITICAL** = 웹사이트 제작 도구로서 성립을 위협 / **HIGH** = 디자인 생산성·품질 직결 / **MEDIUM** = 경쟁 열위 (제품 성격 판단 필요) / **LOW** = 주변부.

### 🔴 CRITICAL

| #   | 격차                   | Figma (Sites)                                  | composition 실측                                                                                                                                                                                                    | 근거                                                                                                                                      |
| --- | ---------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | 반응형 breakpoint 저작 | Desktop/Mobile 2-breakpoint 독립 편집이 출발점 | 타입 시스템 (desktop≥1280/tablet 768–1279/mobile<768 + 미디어쿼리 생성 + cascade fallback) 은 **완성돼 있으나 미배선** — 유일 소비자 `ResponsiveVisibilityEditor.tsx` 가 참조 0건 orphan. breakpoint 스위처 UI 부재 | `apps/builder/src/types/builder/responsive.types.ts`, `apps/builder/src/builder/panels/properties/editors/ResponsiveVisibilityEditor.tsx` |
| C2  | 실제 웹 배포           | publish → 호스팅 + 커스텀 도메인 완결          | `apps/publish` 는 **JSON 뷰어 런타임** (sessionStorage / `?project=` / 파일 드롭). 호스팅·도메인·CDN 코드 0건. Static HTML export 는 JS 런타임 임베드형 단일 파일                                                   | `apps/publish/src/App.tsx`, `packages/shared/src/utils/export.utils.ts:982` (`generateStaticHtml`)                                        |
| C3  | SEO/반응형 출력        | 게시 사이트에 meta/responsive 기본 제공        | export HTML 에 `@media` 0건, og:/meta description/sitemap/robots.txt 0건 (title+viewport 만)                                                                                                                        | `export.utils.ts:1006-1008`                                                                                                               |
| C4  | 실시간 협업            | 멀티플레이어 커서·코멘트·공유 권한 (본질 강점) | Supabase 는 **auth 전용**, 프로젝트는 로컬 IndexedDB. presence/broadcast/코멘트/공유링크/권한 전부 0건 (`realtimeBatcher.ts` 는 데이터테이블 동기화용)                                                              | `apps/builder/src/env/supabase.client.ts`, `dashboard/index.tsx:170`                                                                      |

C4 는 제품 타깃이 enterprise 팀이면 CRITICAL, 개인 도구면 HIGH 로 강등 가능.

### 🟠 HIGH

| #   | 격차                            | Figma                                                                                  | composition 실측                                                                                                                                                                                                                                                 |
| --- | ------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Smart guides / 정밀 캔버스 도구 | 요소↔요소 스냅 정렬선, ruler+수동 가이드, 거리 측정 (Alt 호버), 레이어 검색, lock/hide | snap-to-grid (8/16/24px, `gridRenderer.ts`) 만 존재. 요소 간 smart guide·ruler·거리 측정·레이어 검색 전무. 에디터 레벨 lock/hide 부재 (`toggleVisibility` 는 런타임 이벤트 액션)                                                                                 |
| H2  | 스타일 편집 UI 노출 격차        | 모든 시각 속성 패널 직접 편집                                                          | 렌더는 Skia+DOM 대칭 지원인데 편집 UI 없음: **요소 opacity · blend mode(18종) · layer/backdrop blur · CSS filter 7종 · clip-path · 2D transform (rotate/scale/skew/flip) · per-corner radius · text-shadow · word-spacing** — style 문자열 경유로만 도달         |
| H3  | 다중 fill 합성                  | fill 스택 무제한 합성 + 레이어별 blend                                                 | 편집기 스택 (dnd 재정렬 + 레이어별 opacity/blend 저장) 완성 — **렌더가 최상위 enabled 1개만 소비** (`fillToSkia.ts` `fillsToSkiaFillStyle`, `fillAdapter.ts` `fillsToCssBackgroundStyle`). fill.blendMode 는 저장만 되고 미소비                                  |
| H4  | grid/position 편집기            | Grid auto layout — 시각적 행/열 편집 + span                                            | Rust 엔진 (grid.rs 39KB) + sticky resolver 완비. **grid-template 시각 편집기·position (static/relative/absolute/sticky/fixed) 토글 UI 부재** — grid 는 레이아웃 프리셋 9종/generic display 드롭다운으로만 진입                                                   |
| H5  | 프로토타입 모션                 | Sites 프리셋 인터랙션 (scroll parallax 등), smart animate, hover/press                 | hover/pressed 상태 스타일 + press-scale (ADR-140, Builder Skia 는 pressed 미렌더) 지원. **transition 편집 UI·keyframe 타임라인·scroll 애니메이션·페이지 전환 애니메이션 전무**. `animationEngine.ts` 헤더가 "UI 없이 API 만 제공" 명시                           |
| H6  | 디자인 토큰 저작 UI             | Variables 완전 CRUD (모드·alias·스코프)                                                | 토큰 타입 시스템 (alias/scope/모드) + light/dark + ThemesPanel (tint/tone/radius/typography 프리셋) 지원 — **사용자 토큰 생성·편집 UI 없음** (`CreateTokenInput` 타입만 존재, 값은 `componentRulesTable.ts` 코드 편집). ADR-110 write-through 는 env flag 게이트 |
| H7  | 버전 관리                       | 명명 버전 히스토리 + 복원 + 브랜칭                                                     | undo/redo 50 depth (페이지별) + 히스토리 패널 + jump-to-index 지원. **명명 버전/체크포인트 없음**                                                                                                                                                                |

### 🟡 MEDIUM

| #   | 격차                                     | 실측                                                                                                                                                                                |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | 벡터/드로잉 도구 (Figma Draw 축)         | shape 도구·pen·boolean·freehand 전무 — `activeTool` 상태 자체가 없음. 컴포넌트 조립형 정체성상 의도된 비대상일 수 있으나, 히어로 그래픽·장식 요소를 도구 안에서 못 만드는 건 실격차 |
| M2  | 사용자 저작 variant / component property | catalog variant/size 는 고정 테마 룰. Figma 식 사용자 정의 variant set·boolean/text/swap property 패널 없음 (slot fill 이 instance swap 근접)                                       |
| M3  | 이미지 에셋 관리                         | 업로드·미디어 라이브러리 0건 — 이미지는 URL fill 만 (폰트는 반대로 업로드 관리 지원: `FontManagerPanel.tsx`)                                                                        |
| M4  | 명명 스타일 프리셋                       | 텍스트/이펙트/색상 스타일 저장 라이브러리·문서 색상 스와치 없음. `figma.types.ts` 에 타입 스캐폴드만 존재 (구현 0건)                                                                |
| M5  | 팀 라이브러리                            | reusable 컴포넌트는 문서 scope 한정 — 프로젝트 간 공유/게시/버전 없음                                                                                                               |
| M6  | 디바이스 프리셋                          | 페이지 크기 고정 1920×1080 기본 (`BuilderCanvas.tsx:104`) — 디바이스 프리셋 없음                                                                                                    |
| M7  | stroke 고급                              | per-side border·stroke 위치 (inside/outside)·다중 stroke·cap/join 편집 없음 (`nodeRendererBorders.ts` 항상 center inset)                                                            |
| M8  | 플러그인/코드 export                     | 플러그인 API 0건, React 코드 export 0건 (Sites code layers 대응물 없음 — 이벤트/액션 시스템이 부분 대체)                                                                            |

### ⚪ LOW

diamond gradient · video fill · corner smoothing(squircle) · texture/noise fill · 텍스트 그라디언트/스트로크 · text-on-path · 3D transform (Skia) · OKLCH 피커 (파싱은 지원) · justify 정렬 · 스펠체크 · 접근성 검사기 (RAC 라 런타임 접근성은 내장 우위) · mesh gradient 정확도 (양 경로 모두 근사 + 알고리즘 상이 — Skia 2×2 SkSL bilinear vs DOM SVG 4코너 → 시각 불일치 잠재).

---

## 2. composition 이 Figma 를 앞서는 것

격차 해소 우선순위 판단의 근거가 되는 강점:

1. **진짜 웹 시맨틱** — 산출물이 그림이 아니라 React Aria 기반 실 DOM. ARIA/키보드/포커스가 디자인 단계부터 내장 (Figma Sites 는 접근성 부실이 공론화된 약점).
2. **실 CSS 레이아웃 엔진** — 자체 Rust WASM flex/grid/block (ADR-916). Figma auto layout 은 CSS 근사인 반면 composition 캔버스는 브라우저와 동일 규칙으로 배치.
3. **이벤트/액션 시스템** — 25종 액션 + WHEN→IF→THEN/ELSE 조건 분기 + debounce/throttle/delay + 변수 바인딩 (`events.registry.ts`, `eventBlockTypes.ts`) — Figma 프로토타이핑의 조건 로직을 능가. 단 publish 런타임은 8종으로 축소되는 내부 격차 존재 (`packages/shared/src/runtime/ActionExecutor.ts`).
4. **데이터 계층** — DataTable/REST API/변수 바인딩 + form 액션 (`useDataSource.ts`, `useCollectionData`) — Sites CMS 보다 범용적 방향. Supabase/GraphQL 데이터소스는 스텁.
5. **컴포넌트 인스턴스 모델** — origin/instance + pencil 3-mode descendants override (속성 patch/노드 교체/children 교체) + nested ref + reset (`instanceActions.ts`) — Figma override 모델과 대등 이상.
6. **AI 에이전트** — tool-calling 루프로 캔버스 요소 직접 CRUD, 26종 컴포넌트 + fills + dataBinding 설정 (`GroqAgentService.ts`).
7. **.pen 양방향 어댑터** — canonical format == pencil format (`adapters/pencil/`) — 디자인 파일 생태계 연동 기반.
8. **RAC 컴포넌트 카탈로그 폭** — binding 115개 / palette 노출 ~61종 (7 카테고리).

---

## 3. 축별 상세 인벤토리 (실측 근거)

### 3-1. 시각 스타일 편집

| 영역          | 완전 지원 (Skia+DOM 대칭)                                                                                          | 부분                                                                                                                             | 없음                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Fill          | solid / linear·radial·angular gradient (oklab 보간) / image fill (fill·fit·stretch)                                | mesh gradient (양쪽 근사, 알고리즘 상이) · 다중 fill (편집 스택만, 렌더 1개) · fill blendMode (저장만) · image tile (CSS 경로만) | diamond gradient · video fill · image crop 모드              |
| Stroke        | 단일 border 8 style + dash                                                                                         | arc 전용 strokeCap (UI 없음)                                                                                                     | per-side · inside/outside 위치 · 다중 stroke · cap/join 편집 |
| Effects       | drop shadow (다중 렌더/프리셋 편집) · inner shadow · spread · layer blur · backdrop blur · CSS filter 7종 (렌더만) | text-shadow (렌더만)                                                                                                             | texture/noise · 이펙트 전용 편집 UI (blur/filter)            |
| Blend/opacity | 요소 blend 18종 + opacity (렌더만)                                                                                 | —                                                                                                                                | 요소 blend/opacity 전용 편집 UI                              |
| Radius        | 균일 radius 편집 + per-corner 렌더                                                                                 | per-corner 편집 UI 없음 (단일값 입력만)                                                                                          | squircle smoothing                                           |
| Mask/Clip     | overflow clip 편집 · clip-path 4종 렌더                                                                            | mask-image (Skia 합성기 배선만, ingress·편집기 없음)                                                                             | 벡터 마스크                                                  |
| Typography    | family(커스텀 폰트)/weight/size/lh/spacing/transform/decoration(4 style)/align/wrap/vertical-align/italic          | OpenType (fontVariant 렌더만) · variable font (Skia wght 축만) · word-spacing/text-indent (렌더만)                               | text-on-path · 텍스트 그라디언트/스트로크 · justify          |
| Transform     | 2D 전체 렌더 (translate/rotate/scale/skew/matrix + origin)                                                         | —                                                                                                                                | 편집 UI (rotate/scale/skew/flip 입력 컨트롤) · 3D (Skia)     |
| 색상 도구     | HSB 피커 + Hue/Alpha + HEX/RGBA/CSS 입력 + eyedropper + oklch/lab/lch/color-mix ingress 파싱                       | HSL/HSB 입력 (구현 후 숨김) · `$--` 변수 바인딩 감지                                                                             | OKLCH 피커 · 문서 색상/스와치 라이브러리                     |

### 3-2. 레이아웃·반응형·캔버스 도구

| 영역          | 지원                                                                                                             | 부분                                                  | 없음                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| 레이아웃 모드 | flex/block 완전 편집 UI (direction/align 3×3/justify/wrap/gap)                                                   | grid·absolute·sticky·fixed — **엔진 완비, UI 미노출** | position 모드 토글 · grid-template 편집기             |
| 반응형        | min/max W/H · % · vw/vh 단위                                                                                     | rem (min/max 만) · breakpoint (타입 완비, orphan)     | fluid 타이포 (clamp) · breakpoint 스위처              |
| Constraints   | Size Mode (Fixed/Fill/Fit, ADR-026) + Self Align 3×3                                                             | —                                                     | Figma 식 pin/scale constraints                        |
| 페이지        | 다중 페이지 + per-page history + 멀티 아트보드 병렬 배치 (horizontal/vertical/zigzag) + 레이아웃 구조 프리셋 9종 | —                                                     | 디바이스 크기 프리셋                                  |
| 캔버스 UX     | zoom (0.1–5, 커서 기준)/pan/단축키 · align 6종+distribute H/V · marquee 다중 선택                                | snap-to-grid 만                                       | smart guides · ruler/가이드 · 거리 측정               |
| 드로잉        | —                                                                                                                | —                                                     | shape/pen/boolean/freehand 전부 (도구 상태 자체 없음) |
| 요소 조작     | group/ungroup(=Frame, Cmd+G) · z-reorder (LayerTree DnD) · duplicate · copy/paste style·properties               | —                                                     | 에디터 lock/hide                                      |
| 레이어 패널   | 가상화 트리 + DnD reparent + auto-expand + Collapse All                                                          | —                                                     | 레이어 검색                                           |

### 3-3. 컴포넌트·디자인 시스템

| 항목                        | 판정     | 요점                                                                                                       |
| --------------------------- | -------- | ---------------------------------------------------------------------------------------------------------- |
| origin/instance 모델        | **지원** | 3-mode descendants override + nested ref + detach + reset + 영향 관리 ("Impacts N instances")              |
| variants/component property | 부분     | 고정 테마 룰 (catalog) 만 — 사용자 저작 variant set·property 패널 없음. slot fill 이 swap 근접             |
| 컴포넌트 라이브러리 공유    | 없음     | 문서 scope 한정. 팀 라이브러리/게시/버전 0건                                                               |
| 디자인 토큰 (ADR-110)       | 부분     | 타입·엔진·모드·alias 지원 + ThemesPanel — 토큰 CRUD 저작 UI 없음, write-through 는 env flag 게이트         |
| 명명 스타일 프리셋          | 없음     | `figma.types.ts` 타입 스캐폴드만 (Figma Variables/스타일 import·export·충돌해결까지 타입 설계, 런타임 0건) |
| 카탈로그 폭                 | **지원** | binding 115 / palette ~61 (7 카테고리)                                                                     |
| 아이콘/에셋                 | 부분     | Lucide 피커 + 폰트 업로드 지원 / 이미지 에셋 라이브러리·업로드 없음                                        |
| AI 생성                     | **지원** | Groq tool-calling 루프 (create/update/delete/batch_design, 26종 + fills + dataBinding)                     |
| .pen 연동                   | **지원** | import/export/schemaMap + roundtrip 테스트                                                                 |

### 3-4. 인터랙션·퍼블리시·협업·데이터

| 항목                | 판정     | 요점                                                                                                                                         |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 이벤트/액션         | **지원** | RAC 계열 이벤트 + 25종 액션 + WHEN→IF→THEN/ELSE + 15 연산자 + 안전 평가 (FORBIDDEN_PATTERNS/timeout) + debounce/throttle/delay + 실행 디버거 |
| Publish 런타임 액션 | 부분     | builder 25종 ≫ publish 8종 (NAVIGATE/ALERT/OPEN_URL/SET_STATE/CONSOLE_LOG/API_CALL) — 내부 격차                                              |
| 애니메이션          | 부분     | 상태 스타일 (hover/pressed 색상 emit 은 hover/disabled 한정 — ADR-070) + press-scale. transition/keyframe/scroll 저작 UI 전무                |
| 퍼블리시            | 부분     | JSON export (Zod 검증 + 마이그레이션) + Static HTML (JS 임베드) + SSG 빌드 모드. 실배포·도메인·SEO·@media 출력 없음                          |
| 데이터/CMS          | **지원** | Tables/APIs/Variables 3탭 + REST 바인딩 (transform 포함) + form 액션 + `useCollectionData` 단일 진입. Supabase/GraphQL 소스는 스텁           |
| 협업                | 없음     | auth 만. 실시간 공동 편집·코멘트·공유·권한 0건                                                                                               |
| 버전                | 부분     | undo/redo 50 (페이지별, IndexedDB 백업) + jump-to-index. 명명 버전 없음                                                                      |
| 코드 export         | 없음     | React/JSX codegen 0건                                                                                                                        |
| 플러그인            | 없음     | 서드파티 확장 API 0건                                                                                                                        |

---

## 4. 우선순위 권고

격차 심각도 × 해소 비용 × 기존 백로그 교차:

| 순위 | 작업                                                                        | 근거                                                                                                           |
| ---- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1    | **breakpoint 배선** (C1)                                                    | CRITICAL 인데 타입/유틸 완비 + orphan 에디터 존재 — 배선 비용만 남음. 웹사이트 도구 정체성의 최소 요건         |
| 2    | **스타일 편집 UI 노출 일괄** (H2+H4)                                        | 렌더 대칭이 이미 검증돼 리스크 최소 — Inspector 섹션 추가가 대부분. 체감 기능 폭이 단번에 Figma 근접           |
| 3    | **다중 fill 합성 + fill blendMode 소비** (H3)                               | 편집기·모델 완성 — 렌더 소비부 2곳만 스택 순회로 확장                                                          |
| 4    | **smart guides + 거리 측정 + lock/hide + 레이어 검색** (H1)                 | 순수 신규지만 디자인 생산성 체감 1순위. 기존 boundsMap 인프라 재사용 가능                                      |
| 5    | **publish 실배포 경로** (C2+C3)                                             | 아키텍처 투자 필요 — SSG 빌드 모드 기반으로 정적 출력 + 호스팅 연동부터 단계적 접근                            |
| 6    | **모션** (H5) — transition 편집 UI 부터 (엔진 존재), scroll 애니메이션 후속 | ADR-150 (hover/pressed Skia threading) 과 방향 일치                                                            |
| 7    | **토큰 CRUD UI** (H6) → 명명 스타일 (M4) → variant 저작 (M2)                | 디자인 시스템 축 — ADR-110 write-through flag 해제가 선행 조건                                                 |
| 8    | **협업** (C4)                                                               | 효과는 크지만 단독 최대 투자 (Supabase realtime presence 이상 수준 판단 필요) — 제품 타깃 (enterprise) 확정 후 |

벡터 도구 (M1) 는 "Figma Draw 를 따라갈 것인가" 자체가 제품 정체성 결정이므로 순위 밖 — 컴포넌트 조립형 정체성을 유지한다면 SVG import + 이미지 에셋 라이브러리 (M3) 우회가 정합적.

**기존 Proposed ADR 백로그와의 접점**: ADR-150 ↔ H5 · ADR-152 ↔ 데이터 계층 심화 · ADR-015 (캔버스 계층 선, 2026-09-07 Deprecated — C3 SEO `sitemap.xml`과는 다른 주제) · ADR-134 (AI) ↔ AI 강점 심화. **C1 (breakpoint)·H2 (편집 UI 노출)·H1 (캔버스 도구) 은 대응 ADR 이 없어** 신규 결정이 필요한 영역.

---

## 출처 (Figma 기준선)

- [Figma Sites 소개 — Figma Blog](https://www.figma.com/blog/introducing-figma-sites/)
- [Explore Figma Sites — Help Center](https://help.figma.com/hc/en-us/articles/31230436657815-Explore-Figma-Sites)
- [Sites 반응형 가이드 — Help Center](https://help.figma.com/hc/en-us/articles/33257143505175-Tips-for-creating-a-responsive-webpage-in-Figma-Sites)
- [Code layers — Figma Blog](https://www.figma.com/blog/introducing-code-layers/)
- [Config 2025 recap — Figma Blog](https://www.figma.com/blog/config-2025-recap/)
- [Config 2025 발표 정리 — Figma Forum](https://forum.figma.com/product-updates-3/let-s-talk-about-the-new-features-we-announced-at-config-2025-40301)
