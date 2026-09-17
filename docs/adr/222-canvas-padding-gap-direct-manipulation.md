# ADR-222: 캔버스 Padding·Gap 직접 편집

## Status

Proposed — 2026-09-17

설계 요청: 사용자 지정 ADR-222. 구현·Accepted 승격·commit/push는 포함하지 않는다.

## Context

현재 Styles 패널에서 padding과 gap을 편집할 수 있으나, 실제 여백 위치에서
조절할 수 있는 캔버스 편집기가 필요하다. 사용자가 확정한 동작은 다음과 같다.

| 상태      | 영역                               | 핸들·값                                    |
| --------- | ---------------------------------- | ------------------------------------------ |
| Hover     | 해당 여백 전체에 사선 배경         | 중앙의 짧은 핸들                           |
| 영역 선택 | 사선 제거, 여백 영역 selection box | 중앙 핸들 유지                             |
| 드래그    | 시작 즉시 사선 제거                | 변경 중인 값 표시, 패널 값과 실시간 동기화 |

Padding은 파란색, gap은 분홍색이다. 이 표의 선택 박스는 여백 영역의 표식이며
요소 자체를 크기 조절하는 기존 selection box와 의미가 다르다.

### 도메인과 선행 결정

- **D3**: 기존 catalog + theme/tokens에서 해석한 padding·gap을 편집한다.
  Canvas와 Preview는 같은 값의 대등한 소비자다.
- **D1**: 인라인 숫자 입력·포커스·키보드는 기존 RAC 입력을 재사용한다.
  캔버스 핸들은 Builder 편집 도구이며 제품 컴포넌트의 hover 상태를 흉내 내지 않는다.
- **D2**: 새 public prop이나 canonical 저장 필드를 만들지 않는다.
  기존 `props.style` longhand와 기존 responsive 쓰기 정책을 보존한다.
- [ADR-176](completed/176-canvas-authoring-gesture-and-page-position-optimization.md)의
  제스처 소유권과 [ADR-187](completed/187-editor-presentation-transaction-and-typed-invalidation.md)의
  presentation transaction을 소비하는 응용 설계다. 기존 ADR의 미완료 범위를
  분리하는 문서가 아니며 저장 schema 마이그레이션도 없다.
- [ADR-221](completed/221-canvas-page-header-dom-layer.md)의 DOM 페이지 헤더와
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

### Hard constraints

- 드래그 도중 canonical/history/DB 쓰기 **0회**, 유효한 변경 완료 시 history **1개**.
  취소·무이동·원래 값 복귀는 history **0개**. 새 저장 필드·기존 문서 일괄 변환 **0개**.
- Canvas geometry·여백 값 배지·우측 패널은 같은 presentation revision을 소비한다.
  Preview는 기존 origin 검증·presentation bridge 경로를 사용한다.
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
- 2026-09-17 [사용자 Figma 파일](https://www.figma.com/design/35H3BXbY4Cdz83c2VUVX0a/-v11--Carbon-Design-System--Community-?node-id=17537-265990)의
  `Border Colors → Content`에서 **도구로 관찰**: 상단 padding 152의 파란 사선·중앙 핸들,
  클릭 입력 152, 세로 gap 40의 분홍 핸들·선택 경계·클릭 입력 40. 원본 값 변경 없음.
- **사용자 관찰로 확정**: hover 사선, 선택 시 사선 제거+selection box+핸들,
  드래그 시작 시 사선 제거와 값 실시간 동기화, gap에도 동일 상태 적용.
  Figma 드래그/Undo/0값/Auto 처리의 도구 실측으로 격상하지 않는다.

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

> 구현 상세: [222-canvas-padding-gap-direct-manipulation-breakdown.md](design/222-canvas-padding-gap-direct-manipulation-breakdown.md)

**대안 B를 제안한다.** 기존 gesture·overlay·presentation·canonical mutation 경로를
연결한다. 매 드래그마다 새 문서 상태나 별도 레이아웃 엔진을 만들지 않는다.
사용자 확정 상태표를 시각 계약으로 삼고, 선택한 단일 컨테이너의 여백을 편집한다.

최초 구현 범위는 **desktop/base의 직접 편집 가능한 canonical 컨테이너**에서
padding 4변과 **단일 행/열 flex의 numeric gap**이다. catalog 기본 numeric 값과
미지정 0도 읽어서 편집할 수 있어야 한다. 인라인 값이 없다는 이유만으로 배제하지 않는다.
Padding도 targeted layout이 안전한 non-grid 영역에 한정한다.

Grid·wrap·분배 정렬·responsive 편집·ref/projected descendants·회전/비축정렬 대상,
단위/변수 바인딩을 깨야 하는 값은 첫 범위에서 조작 핸들을 제공하지 않는다.
기존 우측 입력 경로는 유지한다. 이는 제안 범위이지 Figma의 제한을 의미하지 않는다.
지원 확장은 동일 ADR의 판정 갱신과 관련 Gate 통과 후 수행한다.

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

| Gate    | 시점                        | 통과 조건                                                                                                                                                   | 실패 시 대안                                                   |
| ------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| G0      | 구현 착수 시                | supported/unsupported 표와 실제 resolved spacing 공급원 확인, 대표 padding·gap 각 1개 end-to-end first-nail                                                 | 공급 계약 보강 후 진행; 암묵 canonical fallback 금지           |
| G1 (R1) | geometry/overlay 연결 후    | 비대칭·border·margin·0·역방향·zoom·스크롤·페이지 가림에서 표시/히트 오차 ≤1 화면 px, padding과 gap oracle 구분                                              | 잘못된 지원 항목 비활성화 후 기하 수정                         |
| G2 (R2) | 입력 연결 후                | hover/선택/drag 상태표 일치, pan/resize/페이지 헤더 충돌 0, cancel·capture 상실·unmount 후 owner 잔류 0                                                     | 핸들 비활성화 후 session 연결 수정                             |
| G3 (R3) | commit/패널/Preview 연결 후 | move 중 canonical/history/DB 0, 완료 history 1, 취소/no-op 0; Undo/Redo·refresh·선택 전환·문서 교체에서 값/대상 정합                                        | 출시 보류, transaction/읽기 연결 수리                          |
| G4      | 기능 완성 후                | 동일 fixture의 패널 연속 편집 대비 frame p95 증가 ≤2ms, 100자식 기준 p95 ≤16.7ms 목표; affected 범위 밖 layout 재수집 0                                     | 영향 범위 최적화·지원 상한 명시 후 재판정; 수치 자동 완화 금지 |
| G5      | 완료 판정 시                | foreground Builder에서 padding·gap 각 전체 흐름, 실제 Preview geometry 대조, 인라인 입력·키보드·한글 이름·취소 검증, 인접 테스트/typecheck/범위별 gate PASS | 미검증 범위를 명시하고 Proposed/진행 상태 유지                 |

## Consequences

### Positive

- 사용자가 여백의 위치와 변경 결과를 보면서 편집한다.
- 기존 style 저장 형태와 Undo 계약을 유지하며 Figma 관찰 상태를 명시적으로 재현한다.
- 여백 기하·핸들 히트·패널 값이 같은 편집 문맥을 사용한다.

### Negative

- 기하·presentation 읽기·제스처 소유권 연결이 추가되며 단순 장식 변경보다 검증 비용이 크다.
- 첫 제공에서는 Grid 등 미지원 컨텍스트에 직접 조작 핸들이 없다.
- 숫자 입력 DOM과 Skia 표시 사이 포커스·카메라 전환 수명 관리가 필요하다.
