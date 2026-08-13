# ADR-181: 눈금자(Ruler) + 수동 가이드 — 뷰포트 chrome 과 페이지 귀속 가이드 라인

## Status

Accepted — 2026-08-13 (리뷰 round 1 승인 — 이슈 0건, `docs/adr/reviews/181.md`)

- **Phase 0 (inventory freeze) Implemented 2026-08-13** — 계약 표 C1~C11 실측 freeze. 판정 3건 확정: C9 가이드 좌표는 **breakpoint 별** (페이지 크기가 breakpoint 별이라 공유 시 rect 밖 가이드가 스냅에만 참여) / C10 `showRulers` 기본 `false` + 가이드 **표시는 ruler 와 독립, 조작은 ruler ON 한정** (R1 노출면 축소 → G2 강화) / C11 ruler 는 전용 카운터 불요, 가이드는 `overlayVersion` 만 bump(`invalidateContent` 불요). 비-element 히스토리 kind 소비 지점은 초안 3곳 → **실측 6곳** 으로 확대 (breakdown §2 C4).

- **Phase 1 (Ruler) 1차 구현 → 재설계 2026-08-13** — Skia 오버레이 렌더(`rulerRenderer.ts`)로 1차 구현해 동작까지 확인했으나 **HC1(a) 미달**(`render.frame` 0.40ms → 1.21ms = 예산 4.9%, 기준 1%)이 남았다. 최적화 4단계(틱 Path 배칭 → TextBlob 캐시 → `Path.MakeFromCmds` → Picture 캐시)로 2.87ms 에서 1.21ms 까지 낮췄으나 잔여분은 **래스터화 비용**이라 같은 계열로는 더 줄지 않는다. 사용자 판정(2026-08-13)으로 **렌더 표면을 DOM 레이어로 전환** — 아래 §Alternatives 축 2 참조. 1차 구현에서 확보한 실측 2건(캔버스 full-bleed 인셋 / 페이지 0개일 때 프레임 skip)은 DOM 경로에도 유효해 승계한다.

- **Phase 1 (Ruler, DOM) Implemented 2026-08-14** — `RulerOverlay.tsx` + `rulerMetrics.ts`(카메라 순수 함수) + `Workspace.css` 눈금 스트립. 눈금선은 한 주기짜리 `linear-gradient` 타일링이라 팬은 `background-position` 위상 이동만으로 처리되고(도트 배경 승계), 라벨만 span 풀 재사용으로 갱신한다. **HC1(a) 해소** — `render.frame` 증가분 0 (Skia 프레임 예산 미사용). Skia 구현물(`rulerRenderer.ts` + `clearFrameWithChrome`)은 되돌렸고, 인셋 모듈은 `components/canvasViewportInset.ts` 로 이동해 승계. 유닛 20건(9건은 Skia 테스트에서 이관 — 렌더 표면 무관 로직).

- **Phase 2 (가이드 document 필드) Implemented 2026-08-14** — `pageGuides` canonical additive root 필드(`Record<pageId, Partial<Record<breakpoint, PageGuideLine[]>>>`) + `setPageGuides` (`setPagePositions` 동형 — 목록 전체 교체 / lazy write / 빈 목록은 entry·페이지 키 제거). **persist·hydrate 는 추가 작업 0** — 문서 전체를 저장하는 구조라 additive 필드가 자동으로 실리고, C9 가 "entry 부재 = 빈 목록" 으로 정해 둬 폴백 로직이 불요했다. 유닛 9건 + live 왕복(새로고침 후 값 동일, `version` 불변).

- **Phase 3 (히스토리 편입) Implemented 2026-08-14** — `page-guide` entry kind + **C4 6곳 전부 대응**. `page-position` 과 갈리는 지점 둘: (a) **스토어 미러가 없어** canonical 만 되돌린다, (b) 목록 **전체**가 before/after 라 생성·이동·삭제가 한 어법이다. 화면 갱신은 개정 카운터(`pageGuideRevision`) → `overlayVersion` 만 bump (C11 — `invalidateContent` 미호출). 기록 진입점 `commitPageGuideChanges` 제공(Phase 5 호출 예정). 유닛 17건 + 정적 가드 5건 + live undo/redo/패널 점프 왕복.

- **Phase 4 (가이드 렌더) Implemented 2026-08-14** — `guideRenderer.ts` + `buildPageGuideTargets`. 색은 시안 **#59A8D7** — 스냅 웜 레드 재사용을 기각한 이유는 두 표식이 동시에 보이는 순간이 정확히 드래그 중이라, 같은 색이면 "기준선이 있다" 와 "지금 흡착 중" 이 구분되지 않기 때문이다. 클립은 **두 겹**이고 잡는 것이 다르다 — 페이지 rect(stroke 번짐 + breakpoint 축소 후 범위 밖 좌표)와 `withPageOcclusionClip`(페이지끼리는 조상 관계가 아니라 앞의 클립이 못 잡는다, §8.5). 읽기는 활성 breakpoint 만(C9)이고 `pageGuides` 부재 경로는 **할당 0**. **HC1(a) 실측**: `render.frame` p50 4.100 → 4.175ms (**+0.45%**, 순서 교대 4쌍) — 단발 A/B 의 +1.26% 는 노이즈였다.

## Context

캔버스 정렬 보조는 [ADR-179](completed/179-snap-alignment-guides.md) (Implemented 2026-08-12) 로 **객체 스냅** (드래그 순간의 정렬선·등간격) 까지 도달했지만, 사용자가 **미리 놓아두는 고정 기준선** 이 없다 — Figma/Pen 의 ruler + 수동 가이드에 해당하는 표면이 0 이다 (2026-08-13 실측: `ruler`/`guide` 렌더·문서 필드 grep 0건, `snapGuides.ts` 후보는 rect 전용).

두 산출물은 성격이 갈린다:

- **Ruler (눈금자)**: 순수 뷰포트 chrome — 문서 데이터 없음, `panOffset`/`zoom` 의 함수. 토글 상태만 빌더 UI 설정. 씬 콘텐츠와 공간적으로 묶이지 않는다.
- **수동 가이드**: 페이지(아트보드) 귀속 **문서 데이터** — 저장·복원되고 undo 대상이어야 한다. [ADR-177](completed/177-page-position-document-data.md) 이 페이지 위치로 확립한 5계층 (document 필드 / persist·hydrate / 히스토리 canonical entry / 소비 UI / 검증) 과 동형 문제다.

이 성격 차이가 **렌더 표면까지 가른다** — 가이드는 페이지 rect 클립·페이지 간 occlusion·콘텐츠와 함께 컬링돼야 하므로 씬을 아는 Skia 층이어야 하고, ruler 는 카메라만 알면 되므로 그럴 필요가 없다 (§Alternatives 축 2).

**3-domain**: D1/D2/D3 무관 — builder-system 축 (catalog/spec/Generator 무접촉). 가이드는 canonical authoring 데이터지만 Preview/Publish 산출물에 영향 없음 (Figma 와 동일 — 문서 데이터지만 배포 무관, ADR-177 과 같은 분류).

### Hard Constraints

1. **성능 무영향 (사용자 요구 2026-08-13)** — 60fps 계약 유지. 정량 기준: (a) **Skia 오버레이 패스 증가분이 프레임 예산(16.7ms) 1% 이하** — ruler 는 DOM 레이어라 이 축의 증가분이 **0** 이고, 측정 대상은 가이드 렌더다 (ADR-179 G2 어법 — 정렬선 판정 0.011% 실측 전례), (a′) ruler DOM 레이어는 팬·줌 중 **리페인트 없이 컴포지터 변환만** (반복 패턴 위상 이동 — `DotBackground` 어법) + 상시 `will-change` 금지 (ADR-047), (b) 스냅 후보 확장은 **드래그당 1회 수집** 상한 유지 (ADR-179 R1 계약 승계), (c) 가이드 드래그 중 canonical write·히스토리·persist **각 0** — finish 1회 (ADR-176/177 계약 승계), (d) layoutVersion·레이아웃 엔진 경로 무접촉, (e) per-frame 신규 할당 최소화.
2. **BC 0%** — canonical additive 필드 + 필드 부재 문서 폴백 (가이드 없음 = 현행 동일), lazy write, 로드 시 재직렬화 0 (ADR-177 HC3 동형).
3. **undo 일원화** — 기존 히스토리 파이프라인 편입 (per-page 50 depth, jump-to-index). 별도 undo 스택 금지 (ADR-177 HC4 동형).
4. **ADR-179 스냅 계약 보존** — `SNAP_THRESHOLD_SCREEN_PX` 단일 임계, 축별 독립 최근접, 기존 rect 후보 판정 무변경 (기존 유닛 GREEN 유지).
5. **기존 pointer 체인 회귀 0** — ruler OFF + 가이드 0 상태에서 선택/드래그/더블클릭/페이지 타이틀 경로 무변경.
6. **카메라 단일 소스** — ruler DOM 레이어와 Skia 씬은 이미 **같은 출처**를 쓴다: `ViewportController.notifyUpdateListeners()` 가 한 동기 블록에서 `viewportState`(SkiaCanvas RAF 가 읽는 mutable ref — `SkiaCanvas.tsx:515-517`) 갱신과 `publishViewportPresentation(state)`(DOM 레이어 구독) 을 **둘 다** 수행한다 (`ViewportController.ts:298-306`). 별도 카메라 상태 사본 금지.

### Soft Constraints

- ADR-176 (transient presentation) / ADR-177 (5계층) / ADR-179 (순수 함수 스냅) 패턴 재사용 — 신규 package/의존성 없음.
- 외부 관례 정합: Figma (rulers Shift+R 토글, ruler 드래그로 가이드 생성, frame 귀속 가이드는 frame 과 함께 이동).

## Alternatives Considered

### 축 1 — 가이드 저장 모델

#### 대안 A: ruler = 뷰포트 chrome + 가이드 = 페이지 귀속 canonical 필드 (ADR-177 동형 5계층)

- 설명: ruler 는 렌더 전용 (토글만 설정). 가이드는 `pageGuides` additive root 필드 (페이지-로컬 px) + `page-guide` 히스토리 entry + `resolveSnappedPosition` 라인 입력 확장 + `withPageOcclusionClip` 경유 상시 렌더.
- 근거: Figma 가 동일 구조 — 가이드는 frame(페이지) 귀속 문서 데이터로 frame 과 함께 이동하고 undo 대상. composition 은 페이지가 이동 가능(ADR-177)하므로 페이지 귀속이어야 가이드가 페이지를 추종한다.
- 위험:
  - 기술: M — 히스토리 비-element kind 3번째 (전례 2종으로 패턴 확립 — `history.ts:441`)
  - 성능: L — 오버레이 패스 O(활성 가이드), 프레임 경로 무변경 (HC1 게이트로 확증)
  - 유지보수: M — pointer 체인에 히트 분기 1종 추가 (단일 판정 함수로 격리)
  - 마이그레이션: L — additive + 폴백, BC 0%

#### 대안 B: 에디터 사이드카 저장 (문서 스키마 무침범) + undo 제외

- 설명: 가이드를 IndexedDB 별도 store 에 저장, 히스토리 미편입.
- 근거: ADR-177 대안 B 와 동형 — 스키마 침범 회피가 유일 장점.
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: **H** — undo 불일치 (가이드 조작만 Cmd+Z 제외 — 사용자 모델 파괴, ADR-177 이 기각한 동일 사유) + 문서 이동성 소실 (다른 기기/공유 시 가이드 소실)
  - 마이그레이션: L

#### 대안 C: 캔버스 전역(scene) 가이드 — 페이지 무귀속

- 설명: 가이드를 페이지가 아닌 scene 전역 좌표의 무한 라인으로 저장.
- 근거: 일부 데스크톱 도구(Photoshop 단일 캔버스) 관례.
- 위험:
  - 기술: L
  - 성능: L
  - 유지보수: **H** — 페이지 이동(ADR-177 로 일상 조작) 시 가이드가 따라가지 않아 정렬 기준 상실. 다중 페이지 캔버스에서 어느 페이지의 기준선인지 불명. Figma 도 frame 귀속으로 이 문제를 회피.
  - 마이그레이션: L

### 축 2 — Ruler 렌더 표면 (대안 A 채택 후 하위 결정, 2026-08-13 실측 후 판정)

가이드는 페이지 rect 클립·페이지 간 occlusion·콘텐츠 컬링이 필요해 Skia 로 고정된다. ruler 만 표면 선택지가 있다.

#### 대안 A-Skia: 오버레이 패스에서 CanvasKit 드로우

- 설명: `rulerRenderer.ts` 가 `skiaOverlayBuilder` 오버레이 패스 말미에서 스트립·틱·라벨을 그린다 (화면 좌표를 씬 좌표로 역산 — 미니맵 어법).
- 근거: 선택 박스·미니맵 등 기존 오버레이 chrome 과 같은 층 — 단일 렌더 표면 유지.
- 위험:
  - 기술: L — 1차 구현 완료로 실증됨
  - 성능: **H** — **실측**: `render.frame` mean 0.40ms(off) → 2.87ms(초안) → 최적화 4단계 후 **1.21ms** (증가분 예산 4.9%). Picture 는 display list 만 캐시하므로 틱 ~350 세그먼트 + 라벨 ~58 글리프가 **매 프레임 재래스터** — HC1(a) 1% 를 같은 계열 최적화로는 도달 불가. 오프스크린 Image blit 로 가야 하나 픽셀 정렬·surface 수명 관리가 새로 붙는다.
  - 유지보수: M — 씬 없는 프레임(보이는 페이지 0개)에 별도 chrome 경로 필요 (`clearFrameWithChrome`)
  - 마이그레이션: L

#### 대안 A-DOM: 캔버스 위 DOM 레이어 (채택)

- 설명: `.canvas-container` 위 절대 배치 스트립 2개. 눈금선은 `repeating-linear-gradient` 반복 패턴 + 위상 이동(`pan mod gap`), 라벨은 절대 배치 span 풀. 카메라는 `subscribeViewportPresentation` 구독.
- 근거: **같은 기법이 이 코드베이스에서 이미 동작 중** ([ADR-902](completed/902-workspace-dot-background-layer.md) Implemented) — `DotBackground.tsx` + `Workspace.css` 가 캔버스 **뒤**에서 도트 패턴을 `--dot-gap`/`--dot-tx` (=`positiveModulo(pan, gap)`) 로 이동시키며, 주석이 위상을 "Skia 의 `pan + world * zoom` 과 같도록" 보정한다고 명시한다. Skia 와의 팬 정합이 이미 확립·테스트(`DotBackground.test.ts`, `viewportPresentation.test.tsx`)되어 있다. Figma 는 캔버스 내부에 그리지만, composition 은 빌더 chrome 이 이미 DOM (ADR-163 패널 구조) 이고 캔버스 위 DOM 오버레이 전례도 있다 (`TextEditOverlay`).
- 위험:
  - 기술: L — 참조 구현 존재. 도트 배경에 없는 것은 **라벨(값이 팬에 따라 변함)** 하나 — span 풀 `textContent` 갱신
  - 성능: L — Skia 프레임 증가분 **0**. 팬은 컴포지터 변환 (리페인트 없음), `will-change` 는 팬 중에만 (ADR-047 규율 승계)
  - 유지보수: M — ruler(DOM) 와 가이드(Skia) 가 다른 층에 존재. 단 본 ADR 의 핵심 구분(뷰포트 chrome ↔ 페이지 귀속 데이터)과 같은 선이라 정합적
  - 마이그레이션: L — 1차 Skia 구현 되돌림 (토글·단축키·설정 스위치·인셋 모듈은 그대로 재사용)
- 부수 이득 (정정 2026-08-13): pointer 가드가 **소멸하지는 않는다** — 캡처 리스너가 캔버스가 아니라 `.canvas-container` 에 붙어 있고(`BuilderCanvas.tsx:1155`, `capture: true`) hover 는 `window` 에 붙어 있어(`useElementHoverInteraction.ts:550`) DOM 층위가 조상 캡처를 막지 못한다. 달라지는 것은 **판정의 성격**이다: 기하 우선순위 경쟁(포인트를 zoom/pan/inset 으로 환산해 스트립 rect 판정 후 씬 히트와 경쟁 — §8.7/§8.8 실수 유형에 노출)에서 **소속 조기 반환**(`rulerRoot.contains(event.target)`, 좌표 무관)으로 축소된다. 같은 어법의 선례가 인접에 있다 (`handleCanvasContextMenu:791` 의 `target.closest(...)`).

#### 선행 결정과의 관계 — [ADR-902](completed/902-workspace-dot-background-layer.md) 축 2 대안 V1 (기각) 재검토

ADR-902 (Implemented 2026-04-25) 는 도트 배경을 두면서 **같은 질문**을 이미 다뤘고, "DOM 레이어를 캔버스 **위로** 얹기"(축 2 대안 V1, `:108-114`) 를 **기각**했다. 본 ADR 이 그 배치를 채택하므로 기각 사유가 전이되는지 먼저 판정한다.

| ADR-902 V1 기각 사유 (`:184`, `:114`)                        | ADR-181 ruler 로 전이되는가                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "사용자 콘텐츠 위에 도트가 덧씌워지는 **semantic mismatch**" | **아니오.** 도트는 뷰포트 전면을 덮는 **배경 텍스처**라 콘텐츠 위에 오면 의미가 뒤집힌다. 눈금자는 뷰포트 **가장자리 20px 스트립**이고 콘텐츠 위에 있는 것이 정의 그대로다 (Figma/Pen 동일). 덮는 면적·의미가 다르다.                                                                                                                    |
| "테마별 `mix-blend-mode` 튜닝 부담"                          | **아니오.** V1 이 blend 를 요구한 건 전면 텍스처를 콘텐츠와 합성해야 했기 때문이다. 눈금자는 스트립 영역을 **불투명하게 점유**하므로 blend 불요 — 시맨틱 토큰(`--bg-raised`/`--border`/`--fg-muted`) 직접 사용.                                                                                                                          |
| HC#4 "**pointer-events 무간섭**" (`:26`)                     | **부분 전이 — 본 ADR 이 명시적으로 완화한다.** 도트는 이벤트를 절대 받지 않아야 하지만(그래서 `pointer-events: none`), 눈금자 스트립은 Phase 5 에서 드래그 진입점이라 `auto` 가 필요하다. 대신 컨테이너 이벤트 체인과의 충돌을 **소속 조기 반환 2곳**으로 국한한다 (아래 A-DOM 부수 이득 / Decision 5). 스트립 **밖**은 종전대로 `none`. |

승계할 계약: z-index 스택은 ADR-902 `:41` 기준 — skia canvas = 2, DotBackground = 0/1 이므로 **RulerOverlay = 3**. `will-change` 상시 금지(ADR-047 → ADR-902 `:277` 재확인) 도 동일 적용.

### Risk Threshold Check

| 축  | 대안      | 기술 | 성능  | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| --- | --------- | ---- | ----- | -------- | ------------ | :--------: |
| 1   | A         | M    | L     | M        | L            |     0      |
| 1   | B         | L    | L     | **H**    | L            |     1      |
| 1   | C         | L    | L     | **H**    | L            |     1      |
| 2   | A-Skia    | L    | **H** | M        | L            |     1      |
| 2   | **A-DOM** | L    | L     | M        | L            |     0      |

루프 판정: 축 1 은 대안 A, 축 2 는 대안 A-DOM 이 각각 HIGH 0 으로 통과 — 추가 대안 불요. 축 2 의 A-Skia HIGH 는 추정이 아니라 **구현 후 실측**이며, 최적화 4단계를 소진한 뒤의 값이다.

## Decision

**축 1 = 대안 A (ruler 는 뷰포트 chrome, 가이드는 페이지 귀속 문서 데이터) + 축 2 = 대안 A-DOM (ruler 는 DOM 레이어).**

1. **Ruler**: 캔버스 위 DOM 오버레이 (`RulerOverlay`) — `DotBackground` 어법 승계 (반복 패턴 + `positiveModulo(pan, gap)` 위상 + `subscribeViewportPresentation` 단일 카메라 채널 + 팬 중 한정 `will-change`). 문서 데이터 없음 — 토글은 `canvasSettings.showRulers` + **설정 패널 on/off 스위치 노출** (기존 Grid/스냅 설정과 같은 곳 — 사용자 지정 2026-08-13) + 보조 단축키 Shift+R. Skia 프레임 비용 0.
2. **가이드**: `pageGuides` canonical additive root 필드 (breakpoint 별 페이지-로컬 px — 페이지 이동 자동 추종) + `page-guide` 히스토리 entry (ADR-177 early-branch 패턴) + finish-only commit.
3. **스냅**: `resolveSnappedPosition` 에 축별 라인 입력 추가 — **정렬선 판정에만** 참여 (등간격 이웃 아님), 소비처 2곳이 드래그 세션 시작 시 1회 주입.
4. **가이드 렌더**: Skia 오버레이 — 상시 표시 콘텐츠성 chrome, 페이지 rect 클립 + `withPageOcclusionClip` 경유 (canvas-rendering.md §8.5. 스냅 정렬선의 "조작 표식 미적용" 판정과 다름).
5. **인터랙션**: ruler 스트립(DOM) 드래그로 생성 — `setPointerCapture` 로 캔버스 위까지 이어 받는다. 기존 캔버스 pointer 경로는 **소속 조기 반환 2곳**으로 분리한다 (컨테이너 pointerdown 캡처 `:1155` / hover `window` pointermove `:550` — 둘 다 `rulerRoot.contains(target)`). 씬 안의 가이드 이동·삭제는 캔버스 히트 판정 순수 함수 단일 진입점, 미스 시 기존 pointer 체인 무변경 통과.

선택 근거 (위험 수용): 축 1 잔존 위험이 전 축 M 이하이고, M 2건 (히스토리 kind 확장 / pointer 체인 분기) 은 각각 ADR-177 확립 패턴과 단일 판정 함수 격리로 상쇄된다. 축 2 는 A-Skia 의 성능 HIGH 가 실측으로 확정됐고 그 해소책(Image blit)이 새 machinery 를 요구하는 반면, A-DOM 은 참조 구현이 이미 있어 기술 위험이 낮고 성능 문제 자체를 소멸시킨다.

기각 사유 — **B**: undo 불일치가 사용자 모델(Cmd+Z 일원)을 깨고 문서 이동성을 잃는다 (ADR-177 대안 B 기각과 동일 논거). **C**: 페이지 이동이 일상 조작인 캔버스에서 가이드가 페이지를 추종하지 못하면 기준선 기능 자체가 무너진다. **A-Skia**: 프레임 예산 1% 를 4.9배 초과하고, 남은 비용이 래스터화라 오프스크린 Image 캐시(픽셀 정렬·surface 수명 관리) 없이는 도달 불가 — 같은 결과를 참조 구현이 있는 DOM 경로가 비용 0 으로 낸다.

> 구현 상세: [181-ruler-manual-guides-breakdown.md](design/181-ruler-manual-guides-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                    | 심각도 | 대응                                                                                                                                                                                                                                                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | pointer 체인 경합 — 가이드 히트 분기가 기존 캡처 체인 (`BuilderCanvas.tsx:1013` onPointerDownCapture / `resolveSelectionDragIntent` / 페이지 타이틀 paint-rank guard / `usePageDrag.ts` / `useDragBridge.ts`) 을 오탈취 |  HIGH  | ruler 영역은 **소속 조기 반환 2곳** 으로 분리 (컨테이너 pointerdown 캡처 / hover window pointermove — `rulerRoot.contains(target)`. 조상 캡처·window 리스너라 DOM 층위만으로는 안 막힌다). 씬 안 가이드 히트는 순수 함수 단일 진입점 (±4 screen px 한정, 미스 시 무변경 통과) + 기존 인터랙션 유닛 전수 GREEN (G2) |
| R2  | 스냅 계약 오염 — rect 전제 (`snapGuides.ts:85` rectLines) 에 라인 입력 추가 시 등간격(spacing) 판정 오염 또는 기존 rect 판정 회귀                                                                                       |  MED   | 라인은 정렬선 판정에만 참여 (별도 파라미터 — `projectCandidate` 미통과) + 기존 유닛 GREEN + spacing 미오염 유닛 (G3)                                                                                                                                                                                               |
| R3  | 히스토리 비-element kind 3번째 — 소비 분기 누락 시 undo 에서 무시/크래시                                                                                                                                                |  MED   | ADR-177 확립 패턴 (early-branch + 정적 가드) 재적용 + Phase 0 소비 분기 전수 (**6곳** — breakdown §2 C4)                                                                                                                                                                                                           |
| R4  | occlusion/클립 누락 — 겹친 페이지에서 아래 페이지 가이드가 위 페이지 body 위에 표시                                                                                                                                     |  MED   | `withPageOcclusionClip` (`skiaOverlayBuilder.ts:264`) 경유 + 페이지 rect 클립 (G4)                                                                                                                                                                                                                                 |
| R5  | 성능 회귀 — 가이드 렌더·hover 판정·스냅 후보 확장의 프레임 비용 누적 (ruler 는 DOM 이라 이 축에서 제외)                                                                                                                 |  MED   | HC1(a) 전용 Gate (G5) — Skia 오버레이 증가분 1% 이하 측정 + 드래그 중 write 0 재현                                                                                                                                                                                                                                 |
| R6  | BC — 구 빌드가 `pageGuides` 보유 문서를 거부                                                                                                                                                                            |  LOW   | additive + 폴백 (ADR-177 R2 에서 파서 additive 안전 확정 — 승계), lazy write 재직렬화 0                                                                                                                                                                                                                            |
| R7  | DOM ↔ Skia 팬 어긋남 — ruler DOM 갱신과 캔버스 드로우가 다른 프레임에 커밋되면 눈금과 콘텐츠가 1프레임 밀린다                                                                                                           |  MED   | 카메라 단일 소스 (HC6) — `subscribeViewportPresentation` 구독으로 `DotBackground` 와 동일 경로. 팬 중 스크린샷 대조 + `calculateRulerMetrics` 순수 함수 유닛 (`DotBackground.test.ts` 동형)                                                                                                                        |

## Gates

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                           | 실패 시 대안                                            |
| ---- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| G1   | Phase 7      | live: 토글 → ruler 드래그 생성 → 이동 → ruler 복귀 삭제 → 각 조작 undo/redo 왕복 → 새로고침 유지                                                                                                                                    | 해당 Phase 재작업                                       |
| G2   | Phase 5 직후 | **ruler OFF 이면 가이드 유무와 무관하게** 기존 선택/드래그/더블클릭/타이틀 유닛 전수 GREEN + live 무변경 (C10 진입 게이트)                                                                                                          | 히트 분기 우선순위 재설계 (기존 체인 진입 전 판정 격리) |
| G3   | Phase 6 직후 | 가이드 흡착 live + 기존 rect 스냅 유닛 GREEN + spacing 미오염 유닛                                                                                                                                                                  | 라인 입력을 별도 판정 pass 로 분리                      |
| G4   | Phase 4 직후 | 겹친 페이지 occlusion + 페이지 rect 클립 live + breakpoint 전환 시 타 breakpoint 가이드 미표시 (C9)                                                                                                                                 | 렌더 경로를 §8.5 표 기준 재분류                         |
| G5   | Phase 1·7    | **HC1**: (a) Skia 오버레이 증가분 프레임 예산 1% 이하 — ruler ON/OFF 로 `render.frame` **불변** 확인 포함, (a′) 팬 중 ruler 레이어 리페인트 0 (DevTools), (c) 가이드 드래그 100 move 재현에서 canonical write/히스토리/persist 각 0 | 렌더 캐시 보강 후 재측정                                |
| G6   | 승격 시      | type-check + 신규 유닛·정적 가드 PASS + CHANGELOG                                                                                                                                                                                   | 승격 보류                                               |

## Consequences

### Positive

- 고정 기준선 authoring 이 생겨 스냅 체계 (ADR-179) 가 "미리 계획한 배치" 까지 확장 — Figma/Pen 동등 정렬 워크플로.
- 가이드가 문서 데이터라 undo·재로드·공유에서 다른 편집과 동일하게 동작 (ADR-177 과 같은 데이터 신뢰).
- 비-element 히스토리 entry 패턴이 3번째 적용으로 정착 — 이후 페이지 수준 authoring 데이터 (예: 페이지 색상 라벨) 의 선례 강화.
- ruler 가 DOM 이라 **Skia 프레임 예산을 전혀 쓰지 않는다** — 씬 렌더 비용과 빌더 chrome 비용이 분리되어, 이후 chrome 추가가 캔버스 성능 게이트와 경합하지 않는다.
- 뷰포트 chrome 을 DOM 으로 처리하는 선례가 `DotBackground` (캔버스 뒤) 에서 캔버스 앞까지 확장 — 이후 유사 chrome (예: 페이지 경계 눈금, 측정 오버레이) 의 기준.

### Negative

- ruler(DOM) 와 가이드(Skia) 가 다른 기술 층에 존재 — 두 층의 카메라 동기 계약(HC6)이 유지 의무로 남는다 (R7).
- pointer 캡처 체인에 분기 1종 추가 (씬 안 가이드 히트) — 회귀 감시 표면 증가 (R1 게이트로 상쇄).
- canonical 스키마 표면 +1 필드, 히스토리 kind +1 — 소비 분기 **6곳** 전수 관리 의무 지속.
- Phase 1 의 Skia 구현이 되돌림 대상이 된다 — 다만 그 과정에서 얻은 실측 2건(캔버스 full-bleed 인셋 / 페이지 0개 프레임 skip)과 인셋 모듈은 DOM 경로에 승계된다.
