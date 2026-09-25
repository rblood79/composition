# ADR-222: 캔버스 Padding·Gap 직접 편집

## Status

Implemented — 2026-09-17 (Proposed 09-17 → [reviews/222.md](../reviews/222.md) round 1 h1·m2 fixed / l3 LOW deferred → 사용자 `/execute-adr 222` · Phase 0~~3 / G0~~G5 종결, 같은 날)

설계 요청: 사용자 지정 ADR-222. 실행 기록은 아래 `### 실행 기록` 과 breakdown §5 표의 결과 열, live 근거는 `### Live Exercise`.

### 실행 기록

- **Phase 0 (2026-09-17, G0)**: resolved spacing 공급원 = 엔진이 마지막으로 소비한 style record
  (`readPersistentEngineStyle`, `"Npx"` 정규화 · catalog implicit · border 포함) — canonical raw 값이 없어도
  effective 값에서 시작한다. capability 표 (`editorPresentationSpacingCapability.ts`, 순수 코어 16 케이스) ·
  h1 planner 확장 (`isSpacingSizeInvariant` — hug/auto 는 부모 승격 + 외부 형제 포함, px 상자도 padding 합이
  넘으면 승격) · m2 receipt 채널 (`editorPresentationLayoutReceipt.ts`, bridge 의 모든 early return 이 rejected
  사유) · targeted compute 의 available size 를 root 별 실제 계산 문맥으로 교체 (§4.3-5) · commit adapter 2변
  padding 원자 patch 허용 · UI 독립 세션 어댑터 (`editorPresentationSpacingSession.ts`: setDelta/setValues → 프레임당
  publish → receipt 확정값 → finish 1 commit · 시작값 복귀 no-op · rejected/1초 초과 cancel). first-nail 6 케이스
  (padding/gap/2변/rejected/timeout/Escape). 실제 엔진·Preview·Undo 대조는 Phase 3 live 로 미룬다.
- **Phase 1 (2026-09-17, G1/G2 1차)**: 순수 기하 `interaction/spacingGeometry.ts` (padding-box inset · 상하 띠 코너
  소유 · gap 은 설정값 폭만 · 0값 두께 0 띠 + 합성 핸들 · 핸들 12×2/12×12 히트 · 축·부호, 9 케이스) · transient
  `interaction/spacingPresentation.ts` (owner/hover/active + `resolveSpacingBands` 가 히트와 그리기의 같은 입력,
  가시 영역 `hitBoundsMap` clip) · `skia/spacingOverlayRenderer.ts` (상시 핸들 · hover 사선 4px · 값 배지, padding
  OVERLAY_BLUE / gap OVERLAY_PINK = pink-500) · `CanvasGestureSession` "spacing" mode (element→spacing 원자 승격,
  요소 상호작용·hover 억제) · `hooks/useSpacingInteraction.ts` (owner 동기화 · RAF hover · pointerdown capture 선판정
  — 코너 resize 뒤·엣지 resize 앞 · Option/Alt 양쪽 · Option/Alt+Shift 4변 · Shift 10px step · Escape capture
  가로채기로 선택 유지). **live (headed Playwright `adr222-spacing-live.mjs`, 12/12)**: frame(flex column ·
  padding 16 · gap 12 · width 320) + Button 2 자식 + following 형제 — 선택 즉시 띠 5 (엔진 소비값 16/12) · hover
  padding:top + ns-resize · 드래그 중 canonical 무변경 + 확정값 40 · pointerup canonical paddingTop 40px + 다른 변
  16 보존 + history +1 · **layout 자식 y +24 · hug 높이 +24 · following y +24 (h1 반증)** · Cmd+Z 1회 16 복원 ·
  gap +10 → rowGap 22 (columnGap 12 보존) · **Preview DOM Button 간격 22** · Escape 취소 (canonical·history 무변경 ·
  선택 유지) · 클릭 무변경 · page error 0. 함정: Chrome MCP hidden 탭은 부트 95% 정지 → headed Playwright ·
  새 프로젝트 템플릿은 카메라가 요소 밖 → `__composition_APPLY_VIEWPORT__` 로 focus · Compare 토글 후 재focus.
- **Phase 2 (2026-09-17, G3 1차)**: 패널 read `presentation/useSpacingSession.ts` (useSyncExternalStore — 세션
  확정값만, 세션 snapshot 참조 안정화) → Styles Spacing 의 BoxModelEditor 가 세션 소유 변을 확정값으로 표시 +
  `data-active` 강조 + read-only (§4.1) · Gap 필드는 단일 행/열 flex 에서 주축 longhand (`utils/gapAxis.ts`:
  row → columnGap · column → rowGap) 를 읽고 쓴다 (wrap/grid/block 은 종전 shorthand 계약, 2 케이스) · 인라인 숫자
  입력 `overlay/spacing/SpacingInlineInput.tsx` (RAC NumberField, 클릭 = 임계값 미만 pointerup 이 세션을 열린 채
  input 모드로 넘김 · Enter/blur 는 값이 바뀌었을 때만 finish → commit 1 · Escape cancel · 선택 변경·
  세션 종료 시 닫힘 · 카메라 이동은 **따라간다** — 2026-09-20 갱신: 종전 "카메라 이동 시 닫힘" 은 React mirror 구독이라
  제스처 종료에만 동작해 팬 중 입력이 옛 자리에 남았다; Skia 프레임 카메라 채널로 핸들을 프레임마다 추종, 값은
  숫자라 카메라가 무효화하지 않는다). **live 16/16** (위 12 + 드래그 중 패널 Padding Top 40·data-active·readOnly · Gap 필드 22 ·
  클릭 → 입력 열림 (16 · 포커스 · mode input) → 24 Enter → canonical paddingBottom 24px + history +1 · 입력
  Escape 무변경). 함정: Compare Mode 는 캔버스 반폭 + Styles 패널이 우측에 떠 있어 focus 점을 캔버스 폭 25% 로.
- **Phase 3 (2026-09-17, G4/G5)**: G4 `adr222-spacing-frame-ab.mjs` (100 자식 flex column · DPR 2 · CPU throttle 1 ·
  visible · 3쌍 순서 교대 · 60 스텝 33ms) — 캔버스 gap 핸들 드래그 render.frame **p95 2.6ms (p50 2.3)** vs 패널
  연속 편집 (`updateSelectedStylePreview`, ADR-219 G4 정의) p95 2.0 → **Δ +0.6ms ≤ 2 · ≤ 16.7 PASS**, longtask 0.
  대조군 함정: PropertyUnitInput ▲▼ 는 value prop 기준 base±1 이라 값이 둘뿐 → runtime dedup 으로 프레임 6개 —
  대조군이 못 된다 (기록). "affected 범위 밖 재수집 0" 은 targeted publication 계약 (ADR-188 G0 가드) 으로 성립.
  G5 live 22/22 (`adr222-spacing-live.mjs`): 위 16 + zoom 25% (화면 5px → +20) · zoom 200% (화면 20px → +10) ·
  코너 resize 핸들 우선 (세션 0) · Space+띠 드래그 = pan (세션 0 · canonical 무변경) · overflow:hidden 조상 밖
  bottom 띠 hover·pointerdown 없음 (clipRect 44px) · 인라인 입력 접근 이름 "Top padding". 사용자 지적 반영: 드래그
  중 값 배지는 **잡은 띠 하나** 에만 (같은 속성의 다른 gap 띠 · Option 양쪽 변은 핸들 강조만 — Figma·Framer 동형).
- **후속 — instance 루트 확장 (2026-09-26, 사용자 승인 "넓혀")**: 사용자 신고 "padding·gap 드래그가 동작하지 않는다".
  원인 — 팔레트 배치 요소 대부분이 origin instance (`type: "ref"`, ADR-148·228·233·234·237) 가 됐는데 capability
  바인딩이 `node.type` ("ref") 과 store `childrenMap` (instance 자식은 synthetic 이라 비어 있다) 을 읽어
  `not-container` / `fewer-than-two-children` 으로 띠 0개였다 (breakdown 지원표의 "ref/instance 최초 제공 제외" 가
  명시 사유 없이 우연 차단으로 남아 있었다). 수정 — `resolveSpacingOwnerStructure` 가 instance 의 판정 입력을
  origin 타입 (ref 사슬 끝) + 엔진 배치 자식 (`getSharedFilteredChildrenMap`, synthetic id) 으로 만든다. 쓰기는
  instance 자신의 `props.style` 이라 origin 우회 쓰기 금지 원칙은 그대로다. instance 안쪽 synthetic 자식
  (`ref-descendant`) 은 여전히 범위 밖. live: Card instance padding top 16→36 · gap 12→22 (gap 띠 3 · 높이 322→372)
  · origin `component-card` style 무변경 · Undo 2 회 원복 · 팔레트 17 종 판정 (Card·Form·Tabs·ListBox·TextField·
  Select 등 지원, GridList grid · Button leaf 는 기존 규칙대로 차단) · 기존 하니스 26/27 (Preview 간격 1 항목은
  Compare Mode 비개방으로 제외 — 캔버스 쪽 rowGap 22 PASS).
- **후속 — padding 드래그 부호 = 움직이는 가장자리 (2026-09-26)**: 사용자 신고 "bottom 만 정상이고 나머지는 반대".
  09-17 의 "4변 바깥 = +" 는 크기 방식을 보지 않았다 — 고정 폭 · hug 높이 Card 에서 top 을 늘리면 안쪽
  가장자리가 아래로, right 를 늘리면 (폭 고정) 안쪽 가장자리가 왼쪽으로 움직이는데 부호는 반대였다.
  수정 — capability 가 축별 성장 여부 (`resolvePaddingGrowth`: 명시 크기 · flex 주축 grow/basis · 교차축
  stretch · block 흐름) 를 싣고, 띠 부호는 상·좌 안쪽 +, 하·우는 hug 면 바깥 + / 고정이면 안쪽 +. live:
  Card (100% · hug) · frame (320 · 200 고정) · frame (hug · hug) × 4변 = 12 조합 모두 부호 = 값 +20 시
  띠 가장자리 실측 이동 방향, 부호 방향 드래그 16→31. 하니스 방향 6 곳 갱신 (코너 resize 뒤 고정 높이
  bottom = 위 +) 26/27 (Preview 1 항목 `ADR222_NO_COMPARE` 로 제외).
- **후속 — 드래그 대상 = 핸들만 (2026-09-26, 사용자 지시)**: 종전에는 padding·gap 띠 영역 전체가 드래그 · 클릭
  (인라인 입력) 대상이었다. `hitTestSpacingHandles` (핸들 12px 정사각) 만 pointerdown 을 받고, 띠 영역 press 는
  요소 선택 · 이동으로 흘린다. 띠 영역 hover 는 사선 · 배지 표시만 남기고 resize 커서는 핸들 위에서만. live 하니스
  +2 (핸들 hover 커서 · 띠 영역 press 세션 0) → 28/29 (Preview 1 항목 제외).
- **후속 — 핸들 = 포인터 · 핸들은 값의 절반 위치 (2026-09-26, 사용자 규칙)**: 신고 "핸들 위치와 드래그 중 마우스
  위치가 일치하지 않는다" — 값이 포인터 1:1 이고 핸들은 띠 중앙이라 절반 속도였다 (실측 마우스 +40 → 핸들 +20).
  첫 수리 (`31c576e80` — 드래그 중에만 핸들을 가장자리 쪽으로 옮김) 는 놓으면 핸들이 절반만큼 튀어 사용자가
  규칙을 확정했다: **마우스와 핸들은 같은 위치, 핸들은 padding · gap 값의 절반 위치**. 그래서 핸들 위치는 그대로
  두고 값 변화량을 바꾼다 — delta = 포인터 이동 / rate (rate = 값 +1 당 핸들 중심 이동). 한 변은 ±0.5 (값 =
  포인터 2배), Alt 양쪽 hug 뒤쪽 변 1.5, gap k 번째 k+0.5 로 추정해 시작하고 드래그 중 그려진 띠에서 실측
  (`measureSpacingHandleRate`) 으로 갱신한다. 핸들이 값에 따라 안 움직이는 배치 (|rate| < 0.1 — 가운데 정렬 부모 안
  hug 박스) 는 따라갈 수 없어 종전 1:1. live: frame · Card instance (gap 3) · frame+Alt × padding 4 + gap 14 경우
  드래그 중 · 놓은 뒤 편차 ≤ 0.5px (정수 반올림) · 가운데 정렬 4변 = 핸들 정지 · 값 1:1 확인 · 하니스 드래그 거리
  갱신 (zoom 25% 는 임계값 이상 화면 5px) 29/30 (Preview 1 항목 제외).

## Context

현재 Styles 패널에서 padding과 gap을 편집할 수 있으나, 실제 여백 위치에서
조절할 수 있는 캔버스 편집기가 필요하다. 사용자가 확정한 동작은 다음과 같다
(2026-09-17 개정 — Figma·Framer 실측 후 "발견성은 Framer, 피드백은 Figma" 조합으로 확정.
근거는 §외부 리서치).

| 상태                                                     | 영역                       | 핸들·값                                                         |
| -------------------------------------------------------- | -------------------------- | --------------------------------------------------------------- |
| 컨테이너 선택                                            | 표시 없음                  | padding 4변·지원 gap 띠에 **얇은 핸들 상시** (0값 포함)         |
| 띠 hover                                                 | 해당 여백 전체에 사선 배경 | 핸들 강조 + **현재 값 배지**                                    |
| 드래그                                                   | 시작 즉시 사선 제거        | 실시간 값 배지, 패널 해당 필드 동기 강조                        |
| 핸들 클릭 (띠 영역은 드래그·클릭 대상 아님 — 2026-09-26) | 사선 제거                  | 인라인 숫자 입력 + 패널 해당 필드 강조 (입력 닫히면 둘 다 해제) |
| out / Escape                                             | 사선·배지·입력 해제        | 핸들은 선택이 유지되는 동안 남음                                |

Padding은 파란색, gap은 분홍색이다. "입력 없는 여백 영역 선택" 상태는 두지 않는다 —
Figma·Framer 어느 쪽에도 없는 상태이며, 상시 핸들 + hover 피드백이 그 역할을 대신한다.
핸들은 요소 크기를 조절하는 기존 resize 핸들과 별개이며 변 중앙에만 둔다.

### 도메인과 선행 결정

- **D3**: 기존 catalog + theme/tokens에서 해석한 padding·gap을 편집한다.
  Canvas와 Preview는 같은 값의 대등한 소비자다.
- **D1**: 인라인 숫자 입력·포커스·키보드는 기존 RAC 입력을 재사용한다.
  캔버스 핸들은 Builder 편집 도구이며 제품 컴포넌트의 hover 상태를 흉내 내지 않는다.
- **D2**: 새 public prop이나 canonical 저장 필드를 만들지 않는다.
  기존 `props.style` longhand와 기존 responsive 쓰기 정책을 보존한다.
- [ADR-176](176-canvas-authoring-gesture-and-page-position-optimization.md)의
  제스처 소유권과 [ADR-187](187-editor-presentation-transaction-and-typed-invalidation.md)의
  presentation transaction을 소비하는 응용 설계다. 기존 ADR의 미완료 범위를
  분리하는 문서가 아니며 저장 schema 마이그레이션도 없다.
- [ADR-221](221-canvas-page-header-dom-layer.md)의 DOM 페이지 헤더와
  입력 우선순위·페이지 가림 경계를 보존한다.

### 현재 코드에서 확인한 제약

기준 HEAD: `332a1ab3b` (2026-09-17). 상세 경로는 breakdown §2에 기록한다.

1. `CanvasGestureSession`은 element/page/pan 소유권을 관리한다. spacing 전용
   소유권은 아직 없다. 기존 중앙 pointer 처리와 독립 리스너를 경쟁시키면 안 된다.
2. `useLayoutPresentationActions`와 `editorPresentationLayoutPilot`은 numeric px
   spacing을 지원하지만 canonical-node·명시값 중심이다. Grid 대상과 affected
   ancestry의 Grid는 targeted layout 경로에서 제한된다.
3. `useLayoutValues → useElementStyleContext`는 canonical/responsive 값을 읽는다.
   캔버스 드래그 중 값 표시를 위해 presentation 읽기 연결이 추가로 필요하다.
   현재 Gap 표시는 rowGap 우선이므로 가로 레이아웃의 columnGap 편집을 그대로
   연결하면 잘못된 값이 표시될 수 있다.
4. `editorPresentationCommitAdapter`는 style patch를 한 번 커밋하고 history를
   기록한다. 현재 padding 2변 patch는 허용하지 않으며 responsive tier를 직접
   라우팅하지 않는다. 반면 Inspector는 `shouldWriteBreakpointOverride`를 사용한다.
5. `ComputedLayout`은 위치·크기를 제공하지만 사용된 padding·gap 영역을 완전하게
   제공하지 않는다. 인접 자식의 사각형 차이를 곧바로 CSS gap으로 간주할 수 없다.
6. `createPresentationLayoutPlan`은 현재 자식 있는 spacing 대상의 부모 승격을
   무조건 차단한다. hug/auto 지원에는 used-size 기반 승격과 외부 형제 publication
   확장이 필요하며 본 ADR의 필수 구현 범위다.
7. runtime `session.applied`는 descriptor 등록이지 Skia 반영 성공이 아니다.
   layout bridge의 계산/patch 성공을 확인한 receipt를 별도로 소비해야 한다.

### Hard constraints

- 드래그 도중 canonical/history/DB 쓰기 **0회**, 유효한 변경 완료 시 history **1개**.
  취소·무이동·원래 값 복귀는 history **0개**. 새 저장 필드·기존 문서 일괄 변환 **0개**.
- Canvas geometry·여백 값 배지·우측 패널은 같은 presentation revision을 소비한다.
  Preview는 기존 origin 검증·presentation bridge 경로를 사용한다.
- 그 revision은 실제 layout publication 성공 receipt와 대응해야 한다. 계산·반영 실패는
  세션 취소와 commit 금지로 처리한다. 최종 descriptor의 성공 확인 없이 finish하지 않는다.
- 한 pointer의 owner는 **1개**. 여백 드래그가 요소 이동·페이지 이동·resize를 함께 시작하지 않는다.
- 클립·스크롤·페이지 가림 이후 보이지 않는 여백은 hover·pointerdown 대상이 아니다.
- 첫 제공 범위에서도 0값·비대칭 padding·zoom 25/100/200%를 검증한다.
  성능과 시각 정합 수치는 아직 **UNVERIFIED**다.

### 외부 리서치와 근거 수준

- [Figma Auto layout 문서](https://help.figma.com/hc/en-us/articles/31289464393751-Use-the-horizontal-and-vertical-flows-in-auto-layout):
  선택한 프레임의 캔버스 핸들 드래그와 클릭 숫자 입력을 설명한다.
- [Figma 단축키](https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout):
  Option/Alt 양쪽 padding, Option/Alt+Shift 전체 padding, Shift 큰 단위 조절.
- [Figma Smart selection](https://help.figma.com/hc/en-us/articles/360040450233-Arrange-layers-with-Smart-selection):
  선택 레이어 간격 편집은 유사한 UI이나 Auto layout 부모 속성 편집과 별도 의미다.
- [Framer 2024-01 update](https://www.framer.com/updates/january-update-2024):
  "Gap and Padding areas become visible on hover", "controls visible when zero",
  Shift 드래그 = 4변 동일. Framer 공식 문서에 핸들 등장 시점·클릭 동작은 없다.
- 2026-09-17 [사용자 Figma 파일](https://www.figma.com/design/35H3BXbY4Cdz83c2VUVX0a/-v11--Carbon-Design-System--Community-?node-id=17537-265990)의
  `Border Colors` 프레임에서 **Chrome MCP 도구 실측** (값 변경 0): 프레임 선택 + 띠 hover 에
  파란 사선·중앙 핸들·**값 배지 115** 즉시 표시, 프레임 내부 어디를 hover 해도 모든 gap 띠에
  분홍 얇은 핸들 표시 (사선은 hover 띠만) · 여백 **영역** 클릭 = 사선 제거 + 영역 box + 인라인
  입력 팝오버 즉시 열림 (box 수명 = 입력 수명) · hover 상태에서 out 하면 전부 사라짐, 입력이
  열려 있으면 box+입력 유지·핸들만 사라짐 · Escape 로 전부 닫힘. gap hover 는 분홍 사선 + 배지 40.
  Figma 드래그/Undo 는 파일 변경을 피해 실측하지 않았다.
- 2026-09-17 [사용자 Framer 프로젝트](https://framer.com/projects/Untitled--iQWvvpywUa44QyheWeuQ-2HYNv?node=augiA20Il)
  세로 Stack (gap 70, padding 0/18/0/18) 에서 **Chrome MCP 도구 실측** (드래그 후 Undo 로 원복,
  최종 변경 0): 요소 **선택만으로** padding 4변 (0값 상·하 포함) + gap 핸들 전부 표시 (hover
  불필요) · 띠 hover 는 연한 단색 tint (사선·값 배지 없음) · out 시 tint 만 사라지고 핸들은 선택
  동안 유지 · gap 핸들 드래그 70→105 는 패널 실시간 동기, Cmd+Z 1회로 70 복원 (드래그 1 =
  history 1) · gap 핸들 클릭은 인라인 입력 없이 우측 패널 Gap 필드 포커스 + 값 선택.
- **조합 판정 (사용자 확정 2026-09-17)**: 두 도구 모두 "입력 없는 여백 영역 선택" 상태가 없다.
  발견성 (선택 즉시 핸들, 0값 핸들) 은 Framer, 식별·값 피드백 (사선·hover 배지·인라인 입력)
  은 Figma 를 따른다 — tint 는 자식 요소 hover 강조와 혼동되고, hover 전용 핸들은 padding 0
  컨테이너에서 hover 할 띠 자체가 없어 기능이 숨는다. Shift 의미는 Figma (큰 단위) 를 채택하되
  프로젝트 기존 Shift 관습과의 정합을 breakdown Phase 0 에서 확정한다. 이전 판 Context 표의
  "영역 선택 (사선 제거 + selection box + 핸들 유지)" 행은 Figma 의 입력 열린 상태와 Framer 의
  선택 유지 핸들을 섞어 읽은 것으로 폐기한다.

## Alternatives Considered

### 대안 A: DOM으로 여백 영역 전체를 덮고 매 pointermove에 canonical 수정

구현이 직관적이고 패널 값이 자연스럽게 갱신된다. 그러나 DOM과 Skia의 기하·클립
중복, 반복 persistence/history, 문서 변경과 취소 복원 경합이 발생한다.

### 대안 B: Skia 편집 오버레이 + 기존 presentation transaction + DOM 숫자 입력

사선·영역 경계·핸들·값은 기존 Skia overlay 단계에서 그린다. 히트와 그리기는 같은
기하 스냅샷을 사용한다. 드래그는 기존 layout presentation을 공급하고 완료 시
canonical commit을 한 번 수행한다. 숫자 입력에만 기존 DOM/RAC 편집층을 쓴다.

### 대안 C: 영역 강조와 클릭 숫자 입력만 제공

패널 편집을 공간에 연결하는 작은 변경이다. 연속 레이아웃 계산 부담은 낮지만
사용자가 요청한 직접 드래그 조절을 충족하지 않는다.

### Risk per Alternative

| 대안 | 기술                              | 성능                           | 유지보수                 | 마이그레이션      |
| ---- | --------------------------------- | ------------------------------ | ------------------------ | ----------------- |
| A    | HIGH — 동시 제스처·취소 복원      | HIGH — move마다 canonical 전파 | HIGH — 기하·상태 이중화  | LOW — schema 유지 |
| B    | HIGH — 기하·transaction·패널 연결 | MEDIUM — 영향 범위 layout 비용 | MEDIUM — 공통 owner 확장 | LOW — schema 유지 |
| C    | LOW — 기존 입력 재사용            | LOW — 이산 편집                | LOW — 제한된 상태        | LOW — schema 유지 |

### Risk Threshold Check

| 대안 | HIGH 이상          | 판정                                 |
| ---- | ------------------ | ------------------------------------ |
| A    | 기술·성능·유지보수 | hard constraint 위반으로 기각        |
| B    | 기술               | R1~R3 대응 Gate로 제한하고 채택 제안 |
| C    | 없음               | 위험은 낮지만 드래그 요구 미충족     |

모든 대안이 HIGH인 경우나 CRITICAL 대안은 없어 추가 대안 루프는 필요하지 않다.
B의 위험은 동일한 입력→presentation→commit 계약에서 검증해야 하므로 별도 ADR로
쪼개지 않는다. 구현 범위를 제한하고 first-nail을 먼저 검증한다.

## Decision

> 구현 상세: [222-canvas-padding-gap-direct-manipulation-breakdown.md](../design/222-canvas-padding-gap-direct-manipulation-breakdown.md)

**대안 B를 제안한다.** 기존 gesture·overlay·presentation·canonical mutation 경로를
연결한다. 매 드래그마다 새 문서 상태나 별도 레이아웃 엔진을 만들지 않는다.
사용자 확정 상태표를 시각 계약으로 삼고, 선택한 단일 컨테이너의 여백을 편집한다.

최초 구현 범위는 **desktop/base의 직접 편집 가능한 canonical 컨테이너**에서
padding 4변과 **단일 행/열 flex의 numeric gap**이다. catalog 기본 numeric 값과
미지정 0도 읽어서 편집할 수 있어야 한다. 인라인 값이 없다는 이유만으로 배제하지 않는다.
Padding도 targeted layout이 안전한 non-grid 영역에 한정한다.

hug/auto는 현행 planner를 그대로 재사용해서 지원하지 않는다. used-size 변화가
영향을 주는 부모·형제를 포함하도록 planner와 publication을 확장한다. 패널 표시와
최종 commit은 layout 소비 성공 receipt에 연결한다. 이 두 확장은 G1/G3 통과가
필수이며, 실패 시 지원한다고 표시한 채 기존 경로로 우회하지 않는다.

Grid·wrap·분배 정렬·ref/projected descendants·회전/비축정렬 대상,
단위/변수 바인딩을 깨야 하는 값은 첫 범위에서 조작 핸들을 제공하지 않는다.
기존 우측 입력 경로는 유지한다. 이는 제안 범위이지 Figma의 제한을 의미하지 않는다.
지원 확장은 동일 ADR의 판정 갱신과 관련 Gate 통과 후 수행한다.

**비-desktop breakpoint (2026-09-17 사용자 승인 — scope 확장, 결정 지점 ④)**: 첫 범위는
desktop/base 만이었으나 (mobile 에서 핸들이 안 뜨는 것을 사용자가 결함으로 보고),
tablet/mobile 에서도 핸들을 연다. 쓰기 목적지는 Inspector 와 같은 판정
`shouldWriteBreakpointOverride` (ADR-154 개정 1 — eligible + 해당 tier 토글 ON → tier
override, 아니면 base 전역) 를 presentation commit 어댑터가 layout patch 키마다 적용한다.
provenance (단위 보존) 도 그 목적지의 raw 값으로 보고, 토글 OFF 인데 상위 tier override 가
cascade 로 덮는 축은 `cascade-shadowed` 로 닫는다 (base 쓰기가 화면에 안 보이는 "편집
가능해 보이는데 아무 일도 없음" 금지 — R5 원칙). effective 값의 원천 (엔진 소비 style) 은
breakpoint 에 관계없이 같다 — layout publisher 가 이미 resolve 된 노드를 엔진에 넣는다.
같은 어댑터 변경으로 Styles 패널 padding 의 presentation 경로도 tier 를 따른다 (종전에는
토글 ON 이어도 base 에 썼다).

위험 수용 근거는 기존 presentation이 실제로 spacing과 history 단일 커밋을 지원하고,
지원하지 않는 경로를 캔버스에서 시작하지 않을 수 있다는 점이다. 다만 패널 표시와
기하 공급 연결은 신규 작업이므로 코드 재사용만으로 검증 완료라고 판단하지 않는다.
A는 쓰기/제스처/클립 계약 위반, C는 핵심 드래그 요구 미충족으로 기각한다.

## Risks

| ID  | 잔존 위험                                                   | 심각도 | 대응                                         |
| --- | ----------------------------------------------------------- | ------ | -------------------------------------------- |
| R1  | padding·gap·margin·분배 여유를 혼동하거나 클립 밖 영역 조작 | HIGH   | 같은 resolved metric+scene geometry 사용, G1 |
| R2  | spacing과 resize/pan/page owner 경합·취소 누락              | HIGH   | 단일 session 소유권과 공통 종료, G2          |
| R3  | 패널/Canvas/Preview 불일치·stale 대상 commit·다중 Undo      | HIGH   | presentation 읽기·문맥 고정·단일 commit, G3  |
| R4  | 큰 컨테이너의 연속 layout 비용                              | MEDIUM | 프레임당 publish 병합, G4                    |
| R5  | 미지원 컨텍스트에서 편집 가능해 보이는 UI                   | MEDIUM | 시작 전 capability 판정·패널 유지, G0/G5     |

## Gates

모두 **UNVERIFIED**. 문서 검증 통과와 구현 Gate 통과는 별개다.

**G1/G3 필수 세부 조건 (리뷰 h1·m2 수리)**:

- G1: 중첩 hug/auto의 padding·gap 변경에 따른 부모·외부 형제 위치를 드래그 중과
  commit 후에 Preview DOM rect와 대조한다. 텍스트 줄바꿈의 교차축 영향과 고정 크기
  불변 대조군을 포함한다. 확대 affected 집합 내 미지원 Grid도 시작 전에 차단한다.
- G3: probe 성공 후 계산 null/patch 거부, receipt 역순·중복·누락과 pointerup 경합을
  주입한다. 실패 시 잘못된 값 노출·canonical/history/DB 쓰기 0, 임시값 복원,
  정상 최종 receipt와 같은 revision에서 finish/history 1을 확인한다.

| Gate    | 시점                        | 통과 조건                                                                                                                                                           | 실패 시 대안                                                   |
| ------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| G0      | 구현 착수 시                | supported/unsupported 표와 실제 resolved spacing 공급원 확인, 대표 padding·gap 각 1개 end-to-end first-nail                                                         | 공급 계약 보강 후 진행; 암묵 canonical fallback 금지           |
| G1 (R1) | geometry/overlay 연결 후    | 비대칭·border·margin·0·역방향·zoom·스크롤·페이지 가림에서 표시/히트 오차 ≤1 화면 px, padding과 gap oracle 구분                                                      | 잘못된 지원 항목 비활성화 후 기하 수정                         |
| G2 (R2) | 입력 연결 후                | 선택/hover/drag/클릭/out 상태표 일치, 상시 핸들이 코너 resize·자식 hit 를 가로채지 않음, pan/resize/페이지 헤더 충돌 0, cancel·capture 상실·unmount 후 owner 잔류 0 | 핸들 비활성화 후 session 연결 수정                             |
| G3 (R3) | commit/패널/Preview 연결 후 | move 중 canonical/history/DB 0, 완료 history 1, 취소/no-op 0; Undo/Redo·refresh·선택 전환·문서 교체에서 값/대상 정합                                                | 출시 보류, transaction/읽기 연결 수리                          |
| G4      | 기능 완성 후                | 동일 fixture의 패널 연속 편집 대비 frame p95 증가 ≤2ms, 100자식 기준 p95 ≤16.7ms 목표; affected 범위 밖 layout 재수집 0                                             | 영향 범위 최적화·지원 상한 명시 후 재판정; 수치 자동 완화 금지 |
| G5      | 완료 판정 시                | foreground Builder에서 padding·gap 각 전체 흐름, 실제 Preview geometry 대조, 인라인 입력·키보드·한글 이름·취소 검증, 인접 테스트/typecheck/범위별 gate PASS         | 미검증 범위를 명시하고 Proposed/진행 상태 유지                 |

### Live Exercise

headed Playwright (dev, 실제 빌더 부팅 — Chrome MCP 는 hidden 탭 RAF 정지로 부트 95% 에서 멈춰 대체) 로 2026-09-17 검증.
하니스 `apps/builder/scripts/adr222-spacing-live.mjs` (22/22 → 비-desktop 확장 후 26/26) · `adr222-spacing-frame-ab.mjs` (G4). 판정은 store canonical
style · `__composition_LAYOUT_DEBUG__` layout rect · `__composition_SPACING_DEBUG__` 띠/세션 · `__composition_HISTORY_DEBUG__`
undo 스택 · Preview(Compare) iframe `getBoundingClientRect` 로 읽었다 (스크린샷은 `/private/tmp/adr222-spacing-live/`).

- **fixture**: 새 프로젝트 · frame (flex column · padding 16 · gap 12 · width 320 · height auto) + Button 2 자식 + following Button 형제.
- **선택/hover**: 선택 즉시 padding 4변 + gap 1 띠, 값 = 엔진 소비값 16/12 (canonical raw 는 shorthand) · 띠 hover → 사선 + 배지 16 + 커서 ns-resize.
- **드래그 (G1/G3)**: paddingTop 핸들 +24 → 드래그 중 canonical 무변경 · 세션 확정값 40 · Styles 패널 Padding Top 40 (data-active · readOnly) → pointerup canonical `paddingTop: "40px"` (다른 변 16 보존) · history +1 · **layout 자식 y +24 · hug 높이 104→128 · following y 104→128** (h1 반증) · Cmd+Z 1회 → 16.
- **gap (G3 Preview 대조)**: gap 핸들 +10 → `rowGap: "22px"` (columnGap 12 보존) · Preview DOM 두 Button 간격 22 · Styles Gap 필드 22 (column 주축).
- **취소/무이동**: Escape 중 확정값 46 → canonical 16 · history 무변경 · 선택 유지 (핸들 잔존) · 핸들 클릭 = 인라인 입력 (16 · 포커스 · aria-label "Top padding") → 24 Enter → `paddingBottom: "24px"` history +1 · 입력 Escape 무변경.
- **G1 zoom/clip · G2 owner**: zoom 25% 화면 5px → +20 · zoom 200% 화면 20px → +10 · 코너 resize 핸들 pointerdown 은 spacing 세션 0 · Space+띠 드래그 = pan (panOffset 변경 · canonical 무변경) · overflow:hidden 조상 (높이 60) 밖 bottom 띠는 hover null · pointerdown 세션 0.
- **G4**: 캔버스 핸들 드래그 p95 2.6ms vs 패널 연속 편집 p95 2.0ms (Δ +0.6 ≤ 2) · 100 자식 p95 ≤ 16.7 · longtask 0 (DPR 2 · throttle 1 · visible).
- **비-desktop breakpoint (2026-09-17 확장, 하니스 26/26)**: mobile 전환 (`setActiveBreakpoint` + `invalidateLayout`, 헤더 토글과 같은 경로) → 토글 OFF 요소에도 padding 4 + gap 1 띠 · bottom 드래그 +8 → base `paddingBottom` +8 · `responsive` 없음 (전역 쓰기) · `setResponsiveStyleOverrideEnabled("padding")` ON → top 드래그 +12 → `responsive.styles.paddingTop.mobile` = base+12 · base 유지 · 띠 값 = override → desktop 복귀 → 띠 값 = base. 사용자 탭 (ToggleButtonGroup · mobile) 에서도 padding 4 + gap 띠 확인. 함정: `setActiveBreakpoint` 만 부르면 layoutVersion 이 안 올라 엔진이 옛 tier 로 남는다 — `invalidateLayout` 동반.
- **padding link (2026-09-17 사용자 지적, 하니스 27/27)**: 패널 `.box-model__link` ON → right 띠 +6 드래그 → 세션 property 4 · canonical 4변 모두 right 시작값+6 (top/bottom 이 다른 값이었어도 같은 값). link 는 `boxModelLink` 모듈 상태를 패널·캔버스가 공유, 세션 `uniformFrom` 이 잡은 변 기준 절대값을 4변에 준다. 함정: headed 창 위에 실제 OS 마우스가 있으면 그 pointermove (소수 좌표) 가 hover 를 지운다 — hover 검사는 2회 시도.
- **미검증 (첫 범위 밖, 지원표대로 핸들 없음)**: Grid · wrap · space-* · ref/projected · 회전 · 단위 보존 값 · cascade-shadowed — capability 순수 코어 21 케이스가 차단을 고정한다.

## Consequences

### Positive

- 사용자가 여백의 위치와 변경 결과를 보면서 편집한다.
- 기존 style 저장 형태와 Undo 계약을 유지하며 Figma·Framer 실측에서 고른 상태표를 명시적으로 재현한다.
- 여백 기하·핸들 히트·패널 값이 같은 편집 문맥을 사용한다.

### Negative

- 기하·presentation 읽기·제스처 소유권 연결이 추가되며 단순 장식 변경보다 검증 비용이 크다.
- 첫 제공에서는 Grid 등 미지원 컨텍스트에 직접 조작 핸들이 없다.
- 선택 중 핸들이 상시 보이므로 자식이 많은 컨테이너에서 gap 핸들 수가 늘어난다 — 얇은 핸들과
  hover 시에만 사선을 그리는 규칙으로 노이즈를 제한하고 G5 에서 실측한다.
- 숫자 입력 DOM과 Skia 표시 사이 포커스·카메라 전환 수명 관리가 필요하다.
