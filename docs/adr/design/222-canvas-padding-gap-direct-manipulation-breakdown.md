# ADR-222 구현 설계: 캔버스 Padding·Gap 직접 편집

정본: [ADR-222](../222-canvas-padding-gap-direct-manipulation.md)

작성일: 2026-09-17. **설계만 작성, 구현 미착수.** 아래 신규 심볼명은 제안이며
현재 존재하는 기능으로 읽지 않는다. 모든 구현 Gate는 UNVERIFIED다.

## 1. 범위와 사용자 동작

### 1.1 최초 제공 범위

| 조건                                                                      | 첫 구현 판정                                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| 단일 선택, 직접 canonical 노드, desktop/base, non-grid 컨테이너           | padding 4변                                                                       |
| flex/inline-flex, nowrap, row/column 및 reverse, in-flow 자식 2개 이상    | 해당 주축 gap                                                                     |
| 고정 크기·hug/auto, catalog numeric 기본값·미지정 0·명시 numeric/px       | 지원, effective 값에서 시작                                                       |
| 자식 없는 컨테이너                                                        | padding 지원, gap 없음                                                            |
| Grid 대상 또는 affected layout ancestry 안 Grid                           | 미지원: targeted 계산이 거부하므로 시작 차단                                      |
| Wrap·space-between/around/evenly·auto margin으로 gap 판정 불명확          | gap 미지원, padding은 별도 capability 판정                                        |
| 비-desktop breakpoint, responsive 쓰기 문맥                               | 최초 제공 제외, base로 조용히 우회 금지                                           |
| ref/instance·projected descendant·read-only subpart·page/frame projection | 최초 제공 제외, master로 우회 쓰기 금지                                           |
| 다중 선택·회전/skew·비축정렬 변환·fixed/sticky·잠금                       | 미지원                                                                            |
| %, rem/em, calc, 변수/토큰 binding 등 원문 보존이 필요한 값               | 자동 px 변환 금지, 기존 패널에서 편집                                             |
| 음수 gap                                                                  | CSS gap 계약에 따라 새로 만들지 않음, Figma의 음수 간격을 CSS gap에 복제하지 않음 |

가로 flex는 `columnGap`, 세로 flex는 `rowGap`을 쓴다. 하나의 gap 핸들은 해당
부모의 같은 주축 간격 모두를 바꾼다. 자식별 margin이나 위치값으로 변환하지 않는다.
Gap 축의 별도 값은 보존한다. non-container의 padding 직접 편집은 첫 범위가 아니다.

숫자 편집·1변 드래그는 필수. Option/Alt 양쪽과 Option/Alt+Shift 전체 padding도
본 ADR 구현 범위에 포함하되, 현재 commit adapter의 2변 patch 허용 확장이 필요하다.
Shift 단독은 기본 10px step으로 제안한다(일반 1px). 프로젝트에 사용자 nudge 설정이
있으면 그 값을 재사용하는지 Phase 0에서 확정한다. Figma 설정과 동일하다고 주장하지 않는다.

### 1.2 상태 머신

| 상태/이벤트                                    | 시각 결과                                            | 데이터·입력                               |
| ---------------------------------------------- | ---------------------------------------------------- | ----------------------------------------- |
| owner 선택 전 또는 지원 불가                   | spacing UI 없음                                      | 기존 선택/패널 동작                       |
| idle → 영역 hover                              | 해당 영역 전체 사선+중앙 핸들                        | 저장 없음                                 |
| 영역/핸들 pointerdown                          | 사선 제거, 영역 selection box+핸들                   | spacing owner claim, 기준값 캡처          |
| 이동 임계값 미만 pointerup                     | selected 유지                                        | history 0                                 |
| 핸들 클릭 완료                                 | selected+숫자 입력                                   | RAC 입력 포커스, 값 변경 전에는 저장 없음 |
| 임계값 이상 이동                               | dragging, 사선 없음, 중앙 핸들·현재값                | 프레임별 presentation publish             |
| dragging pointerup                             | 최종 배치를 반영한 selected box+핸들                 | 마지막 좌표 반영 후 finish 1회            |
| Escape/pointercancel/capture 상실/blur/unmount | 임시값 제거, 유효한 기존 선택 표시 복귀              | cancel, history 0                         |
| owner/프로젝트/페이지/문서/편집 문맥 변경      | spacing 선택·입력 제거                               | 기존 세션 취소, 새 대상에 쓰지 않음       |
| 다른 영역 hover                                | 그 영역만 hover 사선; 기존 selected 영역은 사선 없음 | 같은 owner 내 보조 선택만 변경 가능       |

드래그 임계값은 기존 element drag의 화면 px 기준을 공유한다. 드래그 중에는
hover에 의한 사선 재등장과 다른 영역 재타깃을 차단한다. 완료 후 같은 영역 위에
포인터가 있어도 selected가 우선하므로 사선이 즉시 다시 나타나지 않는다.
선택한 요소 ID는 유지하고 별도의 비영속 `activeSpacingTarget`으로 여백 선택을 표현한다.

Padding 파랑은 `semanticOverlayColors`의 기존 파랑, gap 분홍은 같은 정본에서
theme/palette 파생으로 정의한다. Figma HEX를 임의 복제하지 않는다. 상·하 padding과
세로 gap은 가로 핸들, 좌·우 padding과 가로 gap은 세로 핸들로 조절 축을 구분한다.
핸들 12×2 화면 px, hit 영역 최소 12×12 화면 px, 사선 간격 4 화면 px를 초기 제안값으로
두고 G5에서 실측한다. 색상만으로 구분하지 않고 입력 이름과 값 배지를 함께 쓴다.

## 2. 현재 코드 근거와 변경 경계

아래 경로는 `apps/builder/src/builder/` 기준이다. 읽기 확인 HEAD `332a1ab3b`.

| 현재 파일/심볼                                                                              | 확인 사실                                                               | 제안 작업                                                                         |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `workspace/canvas/interaction/canvasGestureSession.ts` / `CanvasGestureSession`             | element/page/pan, `blocksPointerDown`, `endPointer`                     | spacing owner와 원자 승격/해제, suppression 정책 확장                             |
| `workspace/canvas/hooks/useCentralCanvasPointerHandlers.ts` / `finishElementPointer`        | resize·pendingDrag·pointercancel 처리                                   | spacing 선판정과 공통 수명 연결, 기존 owner 종료가 spacing을 해제하지 않도록 구분 |
| `workspace/canvas/skia/skiaOverlayBuilder.ts` / `buildOverlayNode`, `withPageOcclusionClip` | slot hatch와 콘텐츠성 chrome의 가림 처리                                | spacing target 렌더와 동일 clip 재사용                                            |
| `workspace/canvas/skia/semanticOverlayColors.ts`                                            | 파랑 SSOT                                                               | spacing 색·메트릭 정본                                                            |
| `workspace/canvas/layout/engines/LayoutEngine.ts` / `ComputedLayout`                        | bbox·margin 등, used spacing 전용 필드 없음                             | 필요시 내부 read-only resolved metric 추가, 저장 schema 아님                      |
| `workspace/canvas/layout/engines/fullTreeLayout.ts` / `computePresentationLayoutTargeted`   | numeric spacing patch, Grid ancestry 거부, affected layout 반환         | 지원 probe, spacing geometry와 같은 revision 소비                                 |
| `presentation/editorPresentationLayoutPilot.ts` / `resolveLayoutPresentationPilotTarget`    | 명시 스타일 numeric 검사, canonical-node 한정                           | canonical 원문과 effective 시작값 분리, capability 공통화                         |
| `panels/styles/hooks/useLayoutPresentationActions.ts`                                       | 한 property 중심 owner                                                  | UI 독립 spacing session adapter 추출/공유, 다변 patch 지원                        |
| `presentation/editorPresentationCommitAdapter.ts` / `applyStylePatch`                       | spacing 정규화, documentVersion 확인, history 한 번; 2변 padding 미허용 | 2변 padding 허용, 같은 문맥 commit 가드                                           |
| `presentation/editorPresentationStyleNormalization.ts`                                      | shorthand 정규화·longhand 우선                                          | 그대로 재사용, 반대변/교차축 보존                                                 |
| `panels/styles/hooks/useLayoutValues.ts`, `useElementStyleContext.ts`                       | canonical 값·responsive merge, rowGap 우선 표시                         | spacing 전용 presentation read, gap 축 표시 연결                                  |
| `panels/styles/sections/SpacingSection.tsx`, `components/BoxModelEditor.tsx`                | padding local draft/blur commit                                         | 외부 spacing 소유 중 해당 입력 충돌 방지 및 값 표시                               |
| `stores/utils/responsiveWriteRouting.ts`                                                    | tier override 쓰기 판정                                                 | 현재 범위 desktop/base 검증, 향후 확장 시 동일 정책 사용                          |
| `presentation/editorPresentationPreviewBridge.ts`                                           | Preview presentation transport                                          | 기존 경로 통합 검증; 신규 postMessage 프로토콜 금지                               |

신규 코드는 `workspace/canvas/interaction/spacing*`(상태·기하·히트),
`workspace/canvas/skia/spacingOverlay*`(그리기),
`workspace/canvas/overlay/spacing*`(RAC 숫자 입력),
`presentation/*Spacing*`(UI 독립 세션/읽기 어댑터)로 응집한다.
정확한 파일 수는 Phase 0에서 확정하며 이 표를 전 파일 변경 의무로 해석하지 않는다.

## 3. 기하·히트 계약

### 3.1 데이터 원천

`SpacingTarget`(제안)은 owner canonical identity, render ID, pageId, axis/side,
write property, raw value/provenance, effective numeric value, geometry revision,
원본 영역과 visible 영역을 가진다. read-only 파생값이며 document/DB에 저장하지 않는다.

Effective style은 catalog/default → 기존 style 해석 → layout에 실제 전달한 값에서
읽는다. 새 CSS 파서를 만들거나 Figma처럼 보이도록 자식 위치를 보정하지 않는다.
기존 resolver에서 필요한 정보를 얻을 수 없다면 내부 layout snapshot에 numeric
padding/border/gap metric을 전달한다. 구현 전 G0에서 공급원을 증명한다.

### 3.2 Padding

원본 border-box에서 실제 border 두께를 빼 padding-box를 구하고 그 안의 4개 띠를
만든다. 자식 위치와 부모 경계의 거리에는 alignment 여유가 섞이므로 padding 값으로
쓰지 않는다. 상·하 띠가 코너를 소유하고 좌·우 띠는 그 사이 구간을 소유해 히트를
결정적으로 만든다. 자식 없는 상자·padding 합이 큰 경우도 동일한 박스 모델로 계산한다.

화면 변환은 기존 scene→screen 경로를 한 번만 적용한다. ancestor scroll·clip과
페이지 paint-order 가림은 inset 계산 뒤 적용한다. spacing은 내용 자리를 가리키므로
여백 selection box까지 가시 영역 clip을 따른다(요소 resize box와 구분).

### 3.3 Gap

실제 layout 순서의 in-flow 자식 margin-box 사이에 **설정된 gap 폭만** 표시한다.
display:none/absolute/fixed는 제외한다. margin·정렬 여유를 gap에 포함하지 않는다.
reverse에서도 저장 속성은 동일하고 포인터 진행 방향만 반전한다. 동일 주축 gap의
여러 띠는 같은 owner/property를 공유하며 활성 띠 하나가 핸들·숫자 배지를 갖는다.
drag 중 같은 속성에 영향을 받는 다른 띠는 얇은 경계로 표시하고 사선은 모두 끈다.

0 gap은 실제 이웃 margin-box 경계의 합성 핸들로 제공한다. 0 padding은 border 안쪽
경계의 합성 핸들로 제공한다. 0 면적을 사선으로 부풀려 그리지 않는다. 클릭 영역만
화면 px 최소 크기를 사용하고 최상위 page/ancestor clip 밖으로 확장하지 않는다.

### 3.4 우선순위

기존 active owner → Space/중간 버튼 pan → DOM 페이지 헤더/텍스트 입력 → 기존
코너 resize 핸들 → spacing 중앙 핸들 → spacing visible 영역 → 기존 요소 선택/이동.
0 padding 합성 핸들은 코너를 피한 변 중앙에 두며, 변 중앙에서는 일반 edge resize보다
우선한다. 실제 자식/겹친 상위 요소의 hit를 여백의 큰 bbox만으로 가로채지 않는다.
전체 페이지/문서 순회 없이 선택 owner와 직접 자식 geometry를 revision 단위로 캐시한다.

## 4. 드래그 transaction

1. Pointerdown에 project/page/selection/editing context/breakpoint/target/documentVersion,
   raw style와 effective 시작값, 시작 포인터·zoom·조절 축·수정키 범위를 캡처한다.
   `beginPointer`의 element 예약을 spacing으로 원자 승격한다. pan이면 승격하지 않는다.
2. 첫 publish 전 capability와 targeted layout의 affected ancestry를 검사한다.
   계산/소비가 불가능하면 시작을 취소한다. move마다 canonical fallback하지 않는다.
3. client delta를 시작 zoom으로 scene delta로 변환한다. 좌/상 padding은 안쪽 이동이 +,
   우/하는 반대 부호. gap은 주축 진행 방향이 +. 범위는 0 이상, 1px/큰 단위 step.
   시작 fractional 값은 무이동이면 그대로 유지하고 실제 delta에 step을 적용한다.
   수정키 집합은 pointerdown에 고정해 드래그 중 축 확장으로 값이 튀지 않게 한다.
4. 한 RAF에 마지막 patch만 publish한다. 여러 padding 변은 동일 시작 snapshot 기준으로
   각각 같은 delta를 적용해 비대칭 차이를 보존한다(이 정책은 Composition 제안).
   네 변 중 어느 하나가 0에 닿으면 공통 delta를 제한한다. 4회 개별 commit 금지.
5. overlay 값과 패널은 같은 session의 **적용 완료된** descriptor를 읽는다.
   pending 포인터 값만 패널에 먼저 표시하지 않는다. Canvas geometry와 applied revision이
   다르면 낡은 핸들로 새 선택을 시작하지 않는다. Preview는 기존 frame ordering을 따른다.
6. Pointerup 마지막 위치를 flush하고 최종 px patch를 한 번 finish한다.
   실제 값이 시작 effective 값과 같으면 raw override를 새로 만들지 않고 cancel/no-op 처리한다.
   canonical key 부재와 상속 상태도 보존한다. 변경 완료는 기존 canonical runner→history→persist.
7. Escape·pointercancel·capture 상실·window blur·unmount·선택/문서 변경은 cancel한다.
   최종 적용 실패도 overlay/session을 정리하고 오류를 알린다. 기존 문서를 강제 복원하여
   다른 작업의 변경을 덮지 않는다. pointer owner 해제는 finally에서 정확히 한 번 한다.

카메라 조작은 활성 spacing drag 동안 억제한다. 외부 zoom/page 위치 변경이 발생하면
캡처 좌표계를 계속 사용하지 않고 취소한다. 이미 시작한 spacing owner가 Space를 나중에
눌렀다고 pan owner로 바뀌지 않는다.

### 4.1 패널과 숫자 입력

- presentation read는 활성 target의 spacing 필드에만 적용한다. dirty/reset 판정은
  기존 raw canonical 경로를 유지한다. derived 표시값을 저장 원본으로 쓰지 않는다.
- Gap 단일 필드는 지원하는 row/column 문맥에서 각각 columnGap/rowGap을 표시·편집하도록
  읽기와 쓰기를 함께 맞춘다. 이 범위에서 반대축까지 덮던 shorthand 쓰기는 사용하지 않는다.
  기존 기타 레이아웃의 Gap 계약은 유지하며 회귀 검증한다.
- BoxModelEditor가 외부 드래그 중 local draft로 이전 값을 다시 덮지 않도록 활성 필드를
  잠시 read-only 표시한다. 다른 속성 변경으로 documentVersion이 바뀌면 세션은 취소한다.
- 인라인 입력은 RAC NumberField 등 기존 입력을 재사용한다. Enter/정상 blur는 1회 commit,
  Escape는 취소. IME 조합 중 Enter는 commit하지 않는다. focus 이동과 캔버스 선택 변경으로
  blur가 겹치면 원래 target 검증을 먼저 한다. unsupported 문맥은 기존 패널 입력을 사용한다.
- 키보드만으로도 우측 패널의 같은 값을 편집할 수 있다. spacing 선택 후 Enter로 인라인
  입력, Escape로 닫기, 접근성 이름은 예: `상단 padding`, `가로 gap`이다.

## 5. 구현 순서와 검증

| Phase | 산출물                                                                                 | 완료 조건                                              |
| ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| 0     | 현재 HEAD 재대조, capability 표·resolved metric 원천·기준 성능, padding/gap first-nail | G0; 시작값→publish→panel→Preview→finish/Undo 경로 증명 |
| 1     | spacing geometry/state/Skia overlay, clipping·hit·gesture owner                        | G1/G2, hover·selected·drag 사선 상태 고정              |
| 2     | 공통 spacing transaction, 패널 read, 인라인 입력·수정키                                | G3, 2변/4변 원자 patch와 취소/무이동 검증              |
| 3     | foreground 통합 검증·성능·문서/CHANGELOG                                               | G4/G5, 증거와 실제 지원표 기록 후 상태 판정            |

필수 회귀 fixture:

- padding 0/비대칭/균일·border 포함·empty·fixed/hug, 가로·세로·reverse gap,
  서로 다른 rowGap/columnGap, 자식 margin/absolute/display:none.
- catalog 기본값과 raw key 부재에서 첫 드래그·원점 복귀·Escape 후 override 생성 0.
- zoom 25/100/200%, ancestor scroll/clip, 가려진 페이지, 작은 여백 hit와 코너 resize.
- hover 사선 → 선택 사선 0/box/handle → drag 사선 0/실시간 값 → finish/Undo/Redo/refresh.
- 선택 A에서 드래그 중 B 선택, 다른 문서/페이지/breakpoint, owner 삭제·unmount·capture 상실,
  기존 pan/pageHeader/element drag. 기존 문서와 새 대상에 쓰기 0.
- 1회 drag의 mutation/history/DB 카운트, 2변·4변 변화 원자성, 정상 commit 뒤 Preview reload.
- non-supported Grid/wrap/ref/breakpoint/variable 값에 핸들 없음, 패널 편집 가능 유지.

검증은 인접 Vitest, TS 변경 시 `pnpm run codex:typecheck`, 실제 Builder/Preview 흐름,
동일 fixture 전후 성능으로 수행한다. 전체 dirty 자동 포맷 위험이 있으면
`.agents/README.md` 범위별 검증을 따른다. 문서만 작성하는 현재 단계에는 제품 테스트나
live 결과를 꾸며 넣지 않으며, 구현 완료 시 사용자 가시 변경을 CHANGELOG에 기록한다.

## 6. 보류 항목과 확장 조건

Grid/wrap의 행·열 경계는 자식 bbox 추측으로 구현하지 않는다. 엔진의 실제 track/line
정보 공급과 targeted layout 검증 후 지원표를 갱신한다. 반응형은 기존 tier 라우팅과
presentation commit의 동등성을 먼저 확보한다. ref/projected 경로는 render ID를
canonical ID로 저장하지 않는 기존 target resolver 계약을 검증한 뒤 연다.

Figma와 pixel-identical 복제, 일반 다중선택 Smart selection, margin 드래그,
새 레이아웃 엔진·새 저장 schema는 본 ADR 범위가 아니다.
