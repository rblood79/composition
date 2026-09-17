# ADR-222 구현 설계: 캔버스 Padding·Gap 직접 편집

정본: [ADR-222](../completed/222-canvas-padding-gap-direct-manipulation.md)

작성일: 2026-09-17. 같은 날 Phase 0~3 실행 완료 (§5 결과 열). 신규 심볼의 실제 파일명은 §5 아래 "구현 파일" 절.

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
Framer 는 Shift 를 "4변 동일" 로 쓰지만 채택하지 않는다 — 기존 element drag 의 Shift 관습
(축 고정·큰 nudge) 과 충돌한다. 클릭 입력에도 같은 수정키를 적용한다: Option/Alt+클릭은
양쪽, Option/Alt+Shift+클릭은 4변을 한 입력으로 편집한다 (Figma 문서 정합).

### 1.2 상태 머신

2026-09-17 개정 — ADR §Context 표 (Figma·Framer 실측 조합) 와 1:1. "입력 없는 여백
영역 선택" 상태는 없다.

| 상태/이벤트                                    | 시각 결과                                                          | 데이터·입력                                |
| ---------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------ |
| owner 선택 전 또는 지원 불가                   | spacing UI 없음                                                    | 기존 선택/패널 동작                        |
| 지원 컨테이너 선택 (idle)                      | padding 4변 + 지원 gap 띠에 얇은 핸들 상시 (0값 합성 핸들 포함)    | 핸들 기하는 revision 캐시, 저장 없음       |
| idle → 띠 hover                                | 그 띠 전체 사선 + 핸들 강조 + 현재 값 배지                         | 저장 없음                                  |
| 띠/핸들 pointerdown                            | 사선 제거, 핸들 강조 유지                                          | spacing owner claim, 기준값 캡처           |
| 이동 임계값 미만 pointerup (= 클릭)            | 인라인 숫자 입력 열림 + 패널 해당 필드 강조                        | RAC 입력 포커스, 값 변경 전에는 저장 없음  |
| 임계값 이상 이동                               | dragging, 사선 없음, 핸들·실시간 값 배지, 패널 해당 필드 동기 강조 | 프레임별 presentation publish              |
| dragging pointerup                             | 최종 배치를 반영한 핸들, 포인터가 띠 위면 hover 사선·배지로 복귀   | 마지막 좌표 반영 후 finish 1회             |
| 인라인 입력 Enter/blur                         | 입력 닫힘, 패널 강조 해제, 핸들 유지                               | 값이 바뀌었을 때만 commit 1회              |
| Escape/pointercancel/capture 상실/blur/unmount | 사선·배지·입력 제거, 핸들은 선택이 유효한 동안 유지                | cancel, history 0                          |
| 포인터 out (조작 없음)                         | 사선·배지 제거, 핸들 유지                                          | 저장 없음                                  |
| owner/프로젝트/페이지/문서/편집 문맥 변경      | spacing 핸들·입력 제거, 새 owner 가 지원되면 그 핸들로 교체        | 기존 세션 취소, 새 대상에 쓰지 않음        |
| 다른 띠 hover                                  | 그 띠만 사선·배지; 나머지는 얇은 핸들만                            | 활성 target 교체 (드래그·입력 중에는 차단) |

드래그 임계값은 기존 element drag의 화면 px 기준을 공유한다. 드래그·인라인 입력 중에는
hover에 의한 사선 재등장과 다른 띠 재타깃을 차단한다. 선택한 요소 ID는 유지하고 별도의
비영속 `activeSpacingTarget`(hover/drag/input 중인 띠 하나) 으로 활성 띠를 표현한다 —
선택 상태가 아니라 조작 상태이며, 조작이 끝나면 비워진다.

Padding 파랑은 `semanticOverlayColors`의 기존 파랑, gap 분홍은 같은 정본에서
theme/palette 파생으로 정의한다. Figma HEX를 임의 복제하지 않는다. 상·하 padding과
세로 gap은 가로 핸들, 좌·우 padding과 가로 gap은 세로 핸들로 조절 축을 구분한다.
상시 핸들 12×2 화면 px (hover·drag 시 12×3 강조), hit 영역 최소 12×12 화면 px, 사선 간격
4 화면 px, 값 배지는 핸들 위 8 화면 px 를 초기 제안값으로 두고 G5에서 실측한다. Framer 의
단색 tint 는 채택하지 않는다 — 기존 자식 요소 hover 강조와 구분되지 않는다. 색상만으로
구분하지 않고 입력 이름과 값 배지를 함께 쓴다.

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

리뷰 수리로 추가된 필수 변경 경계:

| 현재 파일                                                              | 구현 책임                                                          |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `presentation/editorPresentationLayoutLane.ts`                         | §4.3 used-size 기반 spacing 부모 승격과 형제 publication 집합      |
| `presentation/skiaEditorPresentationLayoutBridge.ts`                   | 확장 plan의 계산 문맥, §4.2 성공/거부 receipt, 모든 실패 경로 연결 |
| `presentation/editorPresentationRuntime.ts` 및 spacing session adapter | applied와 소비 완료 구분, 최종 revision 대기·취소·단일 finish      |

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
사선·상시 핸들·값 배지까지 가시 영역 clip을 따른다(요소 resize box와 구분).

### 3.3 Gap

실제 layout 순서의 in-flow 자식 margin-box 사이에 **설정된 gap 폭만** 표시한다.
display:none/absolute/fixed는 제외한다. margin·정렬 여유를 gap에 포함하지 않는다.
reverse에서도 저장 속성은 동일하고 포인터 진행 방향만 반전한다. 동일 주축 gap의
여러 띠는 같은 owner/property를 공유한다. 선택 중에는 모든 띠에 얇은 핸들을 상시 두고
(Figma 는 hover 시, Framer 는 선택 시 — 같은 속성이 여러 곳을 바꾼다는 신호), hover·drag
중인 활성 띠 하나만 사선·강조 핸들·숫자 배지를 갖는다. drag 중 다른 띠는 얇은 핸들만
유지하고 사선은 모두 끈다.

0 gap은 실제 이웃 margin-box 경계의 합성 핸들로 제공한다. 0 padding은 border 안쪽
경계의 합성 핸들로 제공한다. 0 면적을 사선으로 부풀려 그리지 않는다. 클릭 영역만
화면 px 최소 크기를 사용하고 최상위 page/ancestor clip 밖으로 확장하지 않는다.

### 3.4 우선순위

기존 active owner → Space/중간 버튼 pan → DOM 페이지 헤더/텍스트 입력 → 기존
코너 resize 핸들 → spacing 중앙 핸들 → spacing visible 띠 → 기존 요소 선택/이동.
핸들과 띠는 같은 결과를 낸다 (클릭 = 인라인 입력, 드래그 = 값 조절) — 띠가 넓을 때
핸들을 정확히 맞출 필요가 없게 하기 위한 것이며, 자식 요소 위는 띠가 아니다.
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
5. overlay 값과 패널은 §4.2의 **layout publication 성공 receipt**에 연결된 descriptor를
   읽는다. runtime의 `session.applied`는 계산 요청일 뿐 화면 반영 성공이 아니다.
   pending 값은 먼저 표시하지 않는다. Preview는 기존 frame ordering을 따른다.
6. Pointerup 마지막 위치를 flush하고 finalizing으로 전환한다. 최종 descriptor와 같은
   revision의 성공 receipt를 받은 경우에만 최종 px patch를 한 번 finish한다.
   실제 값이 시작 effective 값과 같으면 raw override를 새로 만들지 않고 cancel/no-op 처리한다.
   canonical key 부재와 상속 상태도 보존한다. 변경 완료는 기존 canonical runner→history→persist.
7. Escape·pointercancel·capture 상실·window blur·unmount·선택/문서 변경은 cancel한다.
   최종 적용 실패도 overlay/session을 정리하고 오류를 알린다. 기존 문서를 강제 복원하여
   다른 작업의 변경을 덮지 않는다. pointer owner 해제는 finally에서 정확히 한 번 한다.

카메라 조작은 활성 spacing drag 동안 억제한다. 외부 zoom/page 위치 변경이 발생하면
캡처 좌표계를 계속 사용하지 않고 취소한다. 이미 시작한 spacing owner가 Space를 나중에
눌렀다고 pan owner로 바뀌지 않는다.

### 4.2 Layout publication 완료와 실패 계약 (m2 수리)

새 `SpacingLayoutReceipt`(제안)는 `sessionId`, `descriptorRevision`,
`baseCanonicalRevision`, `rootKey`, `layoutPublicationRevision`과 결과
`published | rejected`를 묶는다. canonical schema나 iframe 메시지가 아니라
Builder 내부의 presentation 소비 완료 신호다. 기존 runtime `applied`의 의미는
변경하지 않고 spacing session adapter가 이 별도 신호를 소비한다.
`layoutPublicationRevision`은 성공 시 필수이며, 거부 시에는 없을 수 있다.
거부 결과에는 실패 사유와 요청 descriptor revision을 반드시 포함한다.

- 성공 발행 위치는 `skiaEditorPresentationLayoutBridge`의 targeted 계산,
  publication 생성, `applySubtreeCommandPatch` 성공, geometry/bounds를 읽는
  소비자 갱신까지 완료된 경계다. `onPatched` 호출만으로 완료가 보장되는지는
  Phase 0에서 실제 caller를 추적하며, 비동기 소비라면 그 완료 지점까지 신호를 늦춘다.
- Canvas 값 배지·패널·spacing hit geometry는 성공 receipt에 해당하는 descriptor와
  geometry를 함께 교체한다. scene layout revision과 session descriptor revision은
  서로 다른 카운터이므로 숫자만 비교하지 않고 위 키로 대응시킨다. 이전 성공 값은
  다음 결과가 pending인 동안만 유지한다. 취소하면 canonical 표시로 복귀한다.
- 계산 null, target/span/context 소실, canonical revision 불일치, publication 생성
  실패, command patch 거부는 모두 `rejected`로 귀결시킨다. 현재 bridge의 조용한
  early return을 spacing 요청에 대해서는 terminal 실패로 연결한다. **세션 전체를
  취소하고 임시 layout·패널·Preview를 복원하며 commit은 금지**한다.
- 세션 취소/교체 뒤 도착한 receipt와 이전 descriptor receipt는 무시한다.
  동일 descriptor는 한 번만 소비하며, coalescing으로 생략된 중간 revision을 기다리지 않는다.
- Pointerup에는 pointer capture/gesture owner를 해제하되 finalizing session의 target과
  최종 descriptor를 고정한다. 새 편집·selection/context 변경은 finalizing을 먼저 취소한다.
  matching receipt 이후에도 document/target 문맥을 재검사한 뒤 finish한다.
- 성공 신호 누락으로 무한 대기하지 않도록 최종 publish 뒤 1초를 실패 제한으로 제안한다.
  제한 초과·탭 비활성화·unmount는 취소하고 마지막 성공 값으로 임의 commit하지 않는다.
  final descriptor가 시작 effective 값과 같으면 receipt 대기 없이 no-op 취소한다.
- 인라인 입력의 Enter/정상 blur도 같은 final publish→receipt→finish 경로를 사용한다.
  window blur에 따른 취소와 입력 focus 이동에 따른 정상 blur는 별도 이벤트로 구분한다.
- Preview는 기존 bridge/protocol의 순서와 terminal cancel을 재사용한다. 이 receipt는
  iframe paint ACK가 아니며, Preview 도착 지연까지 동시 프레임이라고 주장하지 않는다.
  Preview 최종 값·취소 복원 정합은 G3/G5에서 별도로 확인한다.

### 4.3 Spacing의 used-size 영향 범위 (h1 수리)

`createPresentationLayoutPlan`의 현행 `containerSpacingMutation` 무조건 승격 차단은
본 기능의 재사용 전제에서 제외한다. 현재는 자식 존재만 검사하여 hug/auto에서도
자기 서브트리만 반환한다. **본 ADR 구현에 planner 확장을 포함한다.**

1. Spacing patch의 영향을 받는 축을 registry에서 해석하고 기존 used-size 부모 전파
   규칙과 연결한다. padding은 내부 폭 변화→텍스트 줄바꿈→높이 변화까지 고려한다.
   한 축 고정만으로 전체 크기가 고정됐다고 판정하지 않는다.
2. 대상의 외부 used size가 불변임을 증명한 경우만 자기 서브트리로 제한한다.
   단순 width/height 키 존재는 증명이 아니다. percentage/intrinsic/min-max/aspect와
   border+padding 하한을 검토한다. 증명하지 못하면 안전하게 부모로 승격한다.
3. 승격한 부모의 재배치에 참여하는 형제와 자손을 publication 집합에 포함한다.
   부모의 외부 used size도 변할 수 있으면 반복해서 올리고, 불변 경계 또는 layout
   root에서 멈춘다. 컨테이너의 고정 크기만으로 충분하지 않은 intrinsic contribution
   의존도 같은 경계 판정에 포함한다. TS에서 CSS 배치를 재구현하지 않고 엔진이 계산한다.
4. 수정된 plan을 capability 검사, targeted 계산, command subtree 교체, spacing 기하,
   rollback에 동일하게 사용한다. 확대된 **affected 집합 전체**의 Grid/지원 불가 소비자를
   검사한다. Grid가 형제 서브트리에 있어도 첫 범위에서는 시작 차단한다.
5. 엔진 available size는 승격된 root가 속한 실제 계산 문맥에서 공급한다. 현재 bridge의
   `rootLayout.width/height`를 persistent tree 입력으로 그대로 넘기는 방식이 맞는지
   확인하고, owner의 이전 크기를 부모 available size로 오인하지 않도록 분리한다.
6. 각 publish 뒤에도 plan의 안전성을 유지해야 한다. 새 값으로 불변 증명이 깨지면
   영향 범위를 다시 계산해 원자 publication하거나 요청을 reject/cancel한다.
   영향 집합 밖 형제 위치를 이전 값으로 둔 채 성공 receipt를 내보내지 않는다.

G1 필수 반증은 `column root → [hug, following]`, `hug → [a,b]`이다.
paddingTop 10→30 또는 rowGap 10→30이면 두 고정 높이 자식의 hug 높이가 20px 늘고
following의 y도 20px 이동해야 한다(마진·shrink 0, 충분한 root 높이).
중첩 hug 2단, 가로 방향, width 고정/height auto에서 padding 증가로 텍스트가 줄바꿈되는
경우를 추가한다. 드래그 중·commit 후·Undo/Redo에 실제 Preview DOM rect와 대조한다.
반대로 외부 크기/기여 불변이 증명된 컨테이너는 외부 형제를 재수집하지 않는 대조군이다.

현재 planner의 누락을 확인한 리뷰 probe는 새 구현의 PASS 근거가 아니다.
G1/G3 통과 전 hug/auto 직접 편집을 활성화하지 않으며 지원 목표 자체는 유지한다.

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
- 인라인 입력이 열리면 패널의 같은 필드를 강조하고 (Framer 의 핸들 클릭 → 패널 포커스
  대응 학습 효과), 입력이 닫히면 강조를 푼다. 패널 필드에 포커스를 옮기지는 않는다.
- 키보드만으로도 우측 패널의 같은 값을 편집할 수 있다. 접근성 이름은 예: `상단 padding`,
  `가로 gap`이다. 캔버스 핸들의 키보드 포커스 순회는 첫 범위가 아니다.

## 5. 구현 순서와 검증

Phase 0 first-nail에는 §4.3의 hug→외부 형제 반증과 §4.2의 후속 publish 실패를
포함한다. Phase 1에서 planner/bridge 영향 집합을 구현하고, Phase 2에서 receipt 기반
패널 표시·finalizing·finish를 연결한다. 기존 경로의 단순 재사용으로 이 작업을 생략하지 않는다.

| Phase | 산출물                                                                                 | 완료 조건                                              | 결과 (2026-09-17)                                                                                                                                                                                                                           |
| ----- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | 현재 HEAD 재대조, capability 표·resolved metric 원천·기준 성능, padding/gap first-nail | G0; 시작값→publish→panel→Preview→finish/Undo 경로 증명 | 코드 단위 완료 — 공급원 `readPersistentEngineStyle` · capability 16 · planner h1 5 · receipt m2 1 · 2변 commit 1 · 세션 first-nail 6 (mock 엔진). panel/Preview/Undo 는 Phase 3 live                                                        |
| 1     | spacing geometry/state/Skia overlay, clipping·hit·gesture owner                        | G1/G2, 선택 핸들·hover 사선·drag 상태 고정             | 완료 — geometry 9 · gesture 2 · 수정키 2 · live 12/12 (선택 핸들 · hover 사선/배지/커서 · drag · Undo · Escape 선택 유지 · Preview gap 22). zoom 25/200% · 스크롤 clip · 페이지 가림 · pan 충돌은 Phase 3 G5                                |
| 2     | 공통 spacing transaction, 패널 read, 인라인 입력·수정키                                | G3, 2변/4변 원자 patch와 취소/무이동 검증              | 완료 — 패널 read/강조/read-only (useSpacingSession) · Gap 축 (gapAxis 2) · 인라인 입력 (RAC NumberField) · 2변 원자 commit (session first-nail) · live 16/16 (드래그 중 패널 40·active · Gap 22 · 클릭→입력→Enter commit 1 · Escape 무변경) |
| 3     | foreground 통합 검증·성능·문서/CHANGELOG                                               | G4/G5, 증거와 실제 지원표 기록 후 상태 판정            | 완료 — G4 A/B Δp95 +0.6ms (2.6 vs 2.0, 100 자식) · G5 live 22/22 (zoom 25/200 · 코너 우선 · Space pan · overflow clip · 접근 이름) · ADR Live Exercise · README · CHANGELOG · Implemented                                                   |

필수 회귀 fixture:

- h1: 중첩 hug/auto의 padding·gap 변경으로 외부 형제까지 이동, 텍스트 줄바꿈의
  교차축 영향, 고정 크기 불변 대조군, 확대 affected 집합 내 Grid 시작 거부.
- m2: 첫 probe 성공 후 두 번째 계산 null, command patch 거부, document revision
  교체, receipt 역순·중복·누락, pending 중 pointerup/선택 전환. 잘못된 값 표시와
  commit 0, 실패 후 canonical·Preview 복원, 정상 matching receipt에서 history 1.

- padding 0/비대칭/균일·border 포함·empty·fixed/hug, 가로·세로·reverse gap,
  서로 다른 rowGap/columnGap, 자식 margin/absolute/display:none.
- catalog 기본값과 raw key 부재에서 첫 드래그·원점 복귀·Escape 후 override 생성 0.
- zoom 25/100/200%, ancestor scroll/clip, 가려진 페이지, 작은 여백 hit와 코너 resize.
- 선택 즉시 상시 핸들 (0값 포함) → hover 사선/배지 → drag 사선 0/실시간 값 → finish 후
  hover 복귀/Undo/Redo/refresh · 클릭 = 인라인 입력 + 패널 강조, Enter/blur/Escape 로 해제 ·
  out 시 사선·배지만 사라지고 핸들 유지 · 선택 해제 시 핸들 제거.
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

## 7. 구현 파일 (2026-09-17 실행 결과)

| 영역         | 파일                                                                                                                                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 공급원·판정  | `layout/engines/fullTreeLayout.ts` (`readPersistentEngineStyle` · root 별 available size) · `presentation/editorPresentationSpacingCapability.ts`                                                                                                                                                  |
| 세션·receipt | `presentation/editorPresentationSpacingSession.ts` · `presentation/editorPresentationLayoutReceipt.ts` · `skiaEditorPresentationLayoutBridge.ts` (rejected 사유) · `editorPresentationLayoutLane.ts` (`isSpacingSizeInvariant`) · `editorPresentationCommitAdapter.ts` (padding longhand 부분집합) |
| 기하·표시    | `canvas/interaction/spacingGeometry.ts` · `canvas/interaction/spacingPresentation.ts` · `canvas/skia/spacingOverlayRenderer.ts` · `semanticOverlayColors.ts` (`OVERLAY_PINK_RGB`) · `skiaOverlayBuilder.ts` · `SkiaCanvas.tsx` (overlay 무효화)                                                    |
| 입력         | `canvas/interaction/canvasGestureSession.ts` ("spacing") · `canvas/hooks/useSpacingInteraction.ts` · `BuilderCanvas.tsx` (capture 선판정 · 커서 · 인라인 입력 렌더) · `canvas/overlay/spacing/SpacingInlineInput.tsx`                                                                              |
| 패널         | `presentation/useSpacingSession.ts` · `panels/styles/sections/SpacingSection.tsx` · `components/BoxModelEditor.tsx` (`activePaddingSides`) · `panels/styles/utils/gapAxis.ts` · `hooks/useLayoutValues.ts` · `sections/LayoutSection.tsx`                                                          |
| 하니스       | `apps/builder/scripts/adr222-spacing-live.mjs` (G5 22) · `adr222-spacing-frame-ab.mjs` (G4) · dev 전역 `__composition_SPACING_DEBUG__` · `__composition_HISTORY_DEBUG__`                                                                                                                           |
