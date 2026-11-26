# ADR-311: RAC anatomy와 catalog 기반 SVG 자산 미리보기 — 가이드라인·hover·종류 확장·버전관리

## Status

Proposed — 2026-11-15

- 사용자 요청: `/create-adr`에 해당하는 ADR 작성 요청 (2026-11-15).
- 방향을 정한 사용자 원문: 「RAC anatomy와 catalog 기반 SVG 생성, Nexvyn 방식의 가이드라인·hover 표현으로 설계 정리하고 ADR 작성해줘. components, blocks, layouts, templates 확장과 버전관리도 포함해」.
- 앞서 확정한 전제: 「drawing primitives 는 어차피 composition도 catalog -> canvas 로 컨버팅」, 「Nexvyn 패턴의 컴퍼넌트 요소들의 가이드라인 anatomic 표현한것 그게 중심」, 「그부분은 adobe의 react-aria-components 레퍼런스에 나와있다」.
- 사용자가 이미 답한 범위: 기본 화면의 중심은 anatomy 설명, SVG 기하는 catalog에서 유도, hover는 구조 설명에서 완성된 모습으로 전환, 자산 종류는 `component / block / layout / template`, 목록 section 변경과 자산 변경을 모두 추적. Navigator의 기존 Layouts를 포함한다.
- 이번 산출물은 설계 문서다. 제품 구현·성능 통과·설계 리뷰 승인·commit/push를 뜻하지 않는다. 별도 판정이 필요한 향후 제품 동작은 Decision의 「사용자 결정」에 모았다.
- 2026-11-15 목표와 판정: 사용자가 Nexvyn 구조 분석 (공유 대화, References) 을 목표 결과로 지정하고 시안을 판정했다 — 열 수 (가), 가이드는 본체와 구분되게, 치수선은 뜻이 전달되게. 이에 맞춰 진입 연출·hover 700ms·계층 6종·가로형 카드·컴포넌트 전용 연출을 채택했다 ([breakdown §2.2](design/311-catalog-anatomy-svg-asset-previews-breakdown.md)).
- 2026-11-15 보완: Nexvyn 갤러리를 브라우저에서 실측하고 (Context §Nexvyn 실측 요약, [breakdown §2.1](design/311-catalog-anatomy-svg-asset-previews-breakdown.md)) 설계 공백을 채웠다 — 대안 B′, 가이드 어휘, 카드 폭 단계, 생성 실행 환경, 노드 안 부품 key, 외부 기준 gate, 버전 필드의 소비자.
- 2026-11-26 착수 전 보완. coss Particles의 접합 표현을 Decision §1에 반영하고, G2에 공유 경계와 간격을 구별하는 검사를 추가했다.

## Context

Components 패널의 90종 정적 SVG 제작물은 존재하지만 현재 카드는 아이콘과 이름을 사용한다. 정적 SVG에 애니메이션을 덧붙이는 접근만으로는, RAC가 설명하는 구성 요소와 catalog가 실제 그리는 모습을 함께 추적할 수 없다. 목표는 **구성 요소의 경계·간격·정렬 관계를 설명하고 hover/focus에서 완성된 모습을 보여주는 목록**이다.

### 정본과 범위

| 영역           | 권위와 이 ADR의 사용 방식                                                                                                                     |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 구조·접근성 | 설치된 RAC와 공식 anatomy/API/slot 레퍼런스. 문서의 역할을 현재 catalog 부품에 연결한다. RAC 문서의 예제 CSS를 치수 정본으로 채택하지 않는다. |
| D2 Props/API   | 기존 Spectrum/RAC/custom 계약을 그대로 사용한다. 미리보기 때문에 사용자 컴포넌트의 prop을 추가하지 않는다.                                    |
| D3 시각        | catalog + theme/tokens + 기존 layout/paint 계산. SVG는 이 결과의 추가 소비자다.                                                               |
| Builder chrome | Grid 카드, 가이드선 배치와 공개 순서, hover/focus 연출. anatomy 메타데이터는 기하·문서 구조의 두 번째 정본이 아니다.                          |
| 사용자 문서    | `CatalogGraph`가 계속 정본이다. 미리보기와 캐시는 저장하지 않으며, 삽입·레이아웃 적용만 기존 명령 → `workspace.execute` 경로를 쓴다.          |

선행 관계: [ADR-248](completed/248-unified-catalog-document.md)의 graph/runtime과 [ADR-305](completed/305-builder-chrome-component-css-separation.md)의 chrome 경계를 소비하는 응용 ADR이다. [ADR-309](completed/309-date-value-authoring.md)의 날짜 모델과 [ADR-310](completed/310-collection-item-repeat-marker.md)의 collection 구조를 재사용한다. [ADR-304](304-app-frame-layout-presets.md)의 새로운 App frame preset과 [ADR-306](completed/306-chart-36-types-recharts-size-removal.md)의 Chart 확대를 기다리지 않고 시작할 수 있으며, 나중에 추가되는 항목은 같은 등록·coverage gate에 들어온다. 이 ADR은 기존 ADR의 미완료 Phase를 이전하거나 [ADR-921](completed/921-render-scene-backend-integration.md)을 재개하지 않는다.

### 확인된 구현 경계

- `catalogRuleShapes()`는 노드의 `Shape[]`를 생성한다. `catalogRuleNodeData()`는 이후 텍스트 보정·Skia 변환·outline 처리를 더한다. 따라서 `Shape[]`의 단순 XML 직렬화만으로 기존 Canvas와 같다고 할 수 없다.
- `Shape`는 rect/roundRect/circle/arc/text/shadow/border/container/gradient/image/line/path/icon을 표현하고 `PathShape.d`는 이미 SVG path 문자열이다. 토큰, `auto` 치수, 자식 배치, clip, paint 순서는 해소가 필요하다.
- `canvasBinding.ts`에는 노드 바깥의 scene 구성과 합성 paint도 있다. 재사용 경계는 **해소된 layout·도형·clip·paint 순서**이고 CanvasKit 객체나 `SkPicture`가 아니다.
- 현재 생성기는 palette TypeScript를 정규식으로 읽고, 검증기는 manifest의 ID 순서를 비교한다. 이름·section·노출 조건만 바뀐 경우를 모두 검출하는 버전 계약은 없다.
- 일반 SVG 출력 consumer와 anatomy 연결·연출 계약은 현재 구현되지 않았다. 기존 CSS 생성기는 DOM selector/variant를 생성하지만 anatomy 앵커나 SVG 상태 쌍을 출력하지 않는다. 이번 변경에는 별도의 SVG emitter와 연결 검증이 필요하다.
- layout은 Rust wasm 엔진이, 글자 측정은 CanvasKit과 Pretendard가 준비된 뒤에만 값을 낸다 (`catalogRuntime/textMeasure.ts`). 생성기는 이 둘 없이 장면을 만들 수 없다.
- `ShapeBase`의 식별자는 border/shadow 대상용 `id`뿐이다. Chart 계열·달력 셀처럼 한 노드의 `Shape[]` 안에서 그려지는 부품은 template/slot 경로로 짚을 수 없다.
- 즐겨찾기·최근 사용은 palette `type` 문자열을 localStorage에 저장한다 (`hooks/useFavoriteComponents.ts`).

### Nexvyn 실측 요약 (2026-11-15)

- **Grid**: 폭 기준으로 1/2/3열을 고정한다. 3열에서 카드 391×260px, 도면은 `viewBox 0 0 220 140`을 1.25배 (275×175px) 로 표시한다. 컴포넌트를 거의 실제 크기로 그린다. Composition 카드는 현재 102×100px이다.
- **SVG**: inline SVG 한 벌이다. idle은 속이 빈 윤곽선과 가이드, hover/focus-visible은 같은 도형에 실제 칠을 입히고 가이드를 숨긴다. 색은 `currentColor`와 CSS 변수 (가이드는 accent) 다. SVG당 요소는 중앙값 48·최대 217, 66개 카드 합계 3,533이다.
- **가이드 어휘 4종**: 외곽과 모서리 손잡이 4개, 안쪽 여백 점선, 치수선과 숫자, 도면 아래 사양 메모 1–2줄. 숫자와 메모는 화면에 글자로 보인다.
- **Hover**: 카드의 `:hover`·`:focus-visible` CSS만으로 전환한다. JS 상태가 없다. 개별 동작 (press·pending) 은 66개 중 10개에만 있다.
- **따르지 않는 것**: idle 반복 애니메이션, 실제 글자 (제약 2의 막대 유지), 클릭으로 예시 상태를 유지하는 동작 (카드 클릭은 삽입), 2×2 특수 카드. 진입 연출과 가로형 카드는 2026-11-15 목표 지정으로 채택했다 — 내보내는 파일은 300×300 그대로다 (제약 1).

코드·목록·브라우저 관찰 근거와 파일 경계는 [breakdown §2](design/311-catalog-anatomy-svg-asset-previews-breakdown.md)에 기록한다. 기존 SVG 90은 작성 당시 manifest 수이며 영구 상수가 아니다.

### 제약

1. 내보내기 `300×300`, `viewBox="0 0 300 300"`, 투명 배경, 무채색, 비율 유지. 기본 도형·path·gradient·filter만 사용하고 raster·외부 리소스·`foreignObject`·실행 script를 넣지 않는다.
2. 콘텐츠 글자는 짧은 막대로 단순화한다. `/`·`:`는 벡터 기호로 유지한다. anatomy 이름과 실제 측정값은 메타데이터/접근성 설명에서 제공하며 기본 SVG에 설명 문장을 넣지 않는다.
3. DateField 구분자 중심, TimeField 균등 간격, DatePicker 입력/달력 좌우 일치, DateRangePicker 2개월·입력/달력 너비 일치·단일 달력 대비 2배, RangeCalendar 날짜 중심/선택 범위 정렬을 fixture와 좌표 검사로 보존한다. 일반 사용자 문서의 날짜 레이아웃을 이 비율로 강제하지 않는다.
4. hover/focus/카드 재생성으로 graph revision·Undo·autosave·외부 데이터 요청이 발생하면 실패다. live 문서와 미리보기는 독립 입력을 사용한다.
5. anatomy 선택자를 배열 index·임의 DOM child 순서로 연결하지 않는다. 같은 역할의 반복 부품과 여러 카드 인스턴스를 구별할 수 있어야 한다.
6. `CatalogGraph` 영속 스키마와 `LIBRARY_CONTRACT_VERSION` 변경 0, 기존 문서 재직렬화 0을 목표 계약으로 한다. 새로 정의하는 manifest는 파생 자산용 형식이며 문서 저장 형식이 아니다.
7. Nexvyn은 표현 원리의 참고다. 해당 SVG·TSX·drawing primitives·고유 도안·CSS를 복사하지 않는다. 수치·기하는 Composition에서 계산하고 연출 코드는 자체 작성한다.

## Alternatives Considered

| 대안 | 방식                                                                                                                                             | 기술   | 성능   | 유지보수 | 마이그레이션 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------ | -------- | ------------ |
| A    | 기존 90 SVG를 수작업 레이어로 나누고 개별 가이드·hover를 추가                                                                                    | LOW    | LOW    | HIGH     | LOW          |
| B    | 각 카드에서 RAC/Canvas를 실제 mount하고 DOM 측정 또는 Canvas export로 도면 생성                                                                  | MEDIUM | HIGH   | MEDIUM   | MEDIUM       |
| B′   | 빌드 때만 Preview DOM을 띄워 `getBoundingClientRect`·computed style을 읽고 SVG로 변환                                                            | MEDIUM | LOW    | HIGH     | LOW          |
| C    | 범용 scene/backend를 전면 통합한 뒤 모든 Canvas 명령을 SVG로 변환                                                                                | HIGH   | HIGH   | HIGH     | HIGH         |
| D    | 기존 layout·paint 계산의 필요한 공통 경계를 추출하고, RAC anatomy 앵커와 SVG emitter를 연결; 정적 자산은 빌드 생성, 프로젝트 정의는 요청 시 생성 | MEDIUM | MEDIUM | MEDIUM   | LOW          |

외부 근거: RAC 문서는 구성 트리와 slot을 제공한다. Nexvyn은 inline SVG 한 벌에서 같은 도형의 칠만 바꾸고 가이드 묶음을 숨기며, 갤러리 카드 자체가 링크다. Composition은 이미 catalog 도형과 삽입 명령을 갖고 있으므로 D가 두 근거를 기존 경계에 맞게 결합한다. [RAC DatePicker](https://react-aria.adobe.com/DatePicker#api), [RAC DateRangePicker](https://react-aria.adobe.com/DateRangePicker#api), [Nexvyn 갤러리](https://ui.nexvyn.dev/components).

### Risk per Alternative

- A: 추가·변경마다 손그림과 catalog가 갈라진다. kinds가 늘수록 중복 비용이 증가하고 실제 구조와 무관한 치수선을 사실처럼 표시할 수 있다.
- B: 카드별 layout/폰트/portal/state/runtime 비용이 생긴다. 테이블·달력·블록의 반복 mount와 이벤트가 실제 문서나 외부 요청에 닿을 위험이 있다.
- B′: runtime 비용은 없고 RAC의 slot·data 속성이 anatomy 역할을 그대로 준다. 그러나 computed style을 벡터로 바꾸는 변환기는 catalog 도형에 이은 두 번째 paint 해석기가 되고, 프로젝트 정의의 요청 시 생성에는 쓸 수 없어 경로가 둘로 갈린다.
- C: 현재 Skia에 결합된 후처리와 모든 효과를 한 번에 분리해야 한다. 미리보기 요구가 Canvas 전체 교체로 확대되고 회귀·rollback 범위가 커진다.
- D: 일부 공통 계산 추출과 anatomy 앵커 검증은 필요하다. 지원하지 않는 도형을 숨기지 않는 coverage gate, 정적 사전 생성, 동적 생성 한도, 기존 아이콘으로 돌아가는 기능 전환으로 범위를 제어할 수 있다.

### Risk Threshold Check

| 대안 | HIGH 이상                    | 판정                                                                       |
| ---- | ---------------------------- | -------------------------------------------------------------------------- |
| A    | 유지보수                     | catalog와 구조·치수를 중복 소유하므로 기각                                 |
| B    | 성능                         | 카드마다 실제 runtime을 띄우지 않음                                        |
| B′   | 유지보수                     | 생성 경로로는 기각. 같은 fixture의 DOM 측정은 G2의 외부 기준으로 채택      |
| C    | 4축                          | 전체 backend 재설계는 이 요청의 해결 범위를 넘으므로 기각                  |
| D    | 대안 수준 HIGH/CRITICAL 없음 | 채택. 공통 경계 추출·연결 오류의 구체적인 실패 조건은 R1–R11과 gate로 관리 |

HIGH 회피 대안 D가 있으므로 추가 대안 루프는 필요하지 않다. 잔존 위험 때문에 별도 ADR로 분리하지 않고, 하나의 미리보기 계약 아래 단계별로 확인한다. 사용자 요청 밖의 문서 스키마 변경은 이 ADR의 통상 구현 판단으로 넣을 수 없다.

## Decision

**대안 D를 채택한다. RAC anatomy를 의미 기준으로, catalog·layout을 기하 기준으로 삼고, 자체 SVG 출력기에 anatomy 가이드와 hover 표현을 더한다.**

### 1. Anatomy가 기본 화면이다

기본 상태에서 외곽·part 경계·선택한 간격/정렬 가이드를 보여준다. hover와 키보드 focus에서는 가이드가 물러나고 완성된 무채색 컴포넌트가 드러난다. 모든 항목에 로딩 spinner를 넣거나 실제 동작을 실행하지 않는다. 상태 변화가 유용한 항목만 catalog 상태를 사용한 짧은 예시를 추가한다.

RAC anatomy 역할은 현재 catalog의 template/slot/primitive identity에 연결한다. 구조 트리를 별도 복제하지 않는다. 직접 대응하지 않는 Composition custom 요소는 existing catalog 계약으로 출처를 명시하고 RAC에 있는 것처럼 표시하지 않는다. 블록·레이아웃·템플릿의 상위 구조는 해당 구성의 의미에서, 하위 컴포넌트 anatomy는 RAC에서 가져온다.

가이드의 값은 layout bounds에서 산출한다. 표시 대상·밀도·주석 위치·공개 순서만 presentation profile이 선택한다. 프로필에 padding/height의 복제 숫자를 저장하지 않는다. 작은 카드에서는 일부 가이드를 생략하며, 보이지 않는 수치를 지어내지 않는다.

**도면은 여섯 계층이다**: 윤곽, 내용 (글자 막대·아이콘), 구조 (외곽·여백과 정렬 점선), 치수 (치수선과 숫자·사양 메모), 손잡이 (모서리 4개), 상태 예시. 숫자와 메모는 layout 값과 rule이 TokenRef로 선언한 토큰 이름에서 만든다. 이 글자는 카드의 chrome 글자 층에만 그리고 내보내는 SVG에는 넣지 않는다 (제약 2). 치수선은 숫자와 함께만 그린다 — 숫자를 놓을 수 없으면 선도 없다. 구조·치수·손잡이는 Canvas 선택 표시 계열의 색으로 칠해 본체와 색·굵기·점선으로 갈린다.

**본체는 도형 한 벌이다.** anatomy 상태는 같은 도형을 칠 없이 윤곽선으로, rendered 상태는 해소된 칠로 그린다. 상태마다 도형을 복제하지 않는다. part가 생기거나 사라지는 경우만 그 part를 따로 둔다.

**복합 부품의 접합부도 anatomy로 설명한다.** 두 part가 완성 상태에서 하나의 경계를 공유하면 anatomy에서 양쪽 역할을 식별할 수 있게 하고, hover/focus에서는 가이드가 물러나 catalog의 외곽과 구분선이 드러나게 한다. 같은 경계를 가이드가 덧그려 선이 두꺼워지지 않게 한다. 실제 gap이 있는 부품은 그 간격을 보존한다. 부품 대응은 semantic part key, 경계선과 모서리의 최종 모양은 해소된 layout·paint에서 가져온다. 목록 카드는 기존 CSS 전환으로 이를 표현한다. [coss 접합 표현과 적용 근거](design/311-catalog-anatomy-svg-asset-previews-breakdown.md#23-coss-particles의-부품-접합)

**표시 밀도는 카드에 그려지는 폭으로 정한다.** 폭 단계 S는 외곽·손잡이와 핵심 치수 하나 (숫자 포함), M은 구조 점선과 치수 숫자, L은 사양 메모까지 보인다. 패널은 최소 카드 폭 160px로 배치한다 (사용자 판정 (가)) — 228px 패널은 1열·M이고 S는 Components 패널에 나오지 않는다.

**카드는 가로형이고 컴포넌트를 실제 크기 근처로 그린다.** inline 미리보기는 같은 장면을 3:2 (overlay가 열린 세로로 긴 항목은 3:4) 로 잘라, 작은 항목은 실제 크기의 1.25–1.85배까지만 키우고 큰 항목은 줄인다. 내보내는 300×300은 같은 기하의 다른 틀이다. 단계 경계와 틀은 시안 2차로 정했고 ([breakdown §3.3·§7](design/311-catalog-anatomy-svg-asset-previews-breakdown.md)), 실제 패널에서의 확인은 G3에 남는다.

**프로필은 기본값을 자동으로 만든다.** origin template의 slot·부품에서 역할을, root의 padding과 첫 gap에서 기본 가이드를 유도한다. 손으로 적는 것은 예외 (overlay·반복 부품·날짜 조건) 뿐이다.

### 2. SVG는 공통 계산 결과의 소비자다

catalog와 기존 layout/paint 로직에서 동일한 입력으로 도형·노드 bounds·clip·paint 순서·semantic part를 구한다. SVG consumer는 해당 결과를 편집 가능한 벡터로 출력한다. Skia의 렌더 루프를 호출하거나 bitmap을 SVG에 넣지 않는다.

공통화는 미리보기에 필요한 순수 계산에 한정한다. 텍스트 측정·outline·token 해소처럼 현재 변환 뒤에 있는 처리를 분리할 때 Canvas의 동일 입력 결과를 회귀 검사한다. 이 중간 표현은 일시적인 출력 계약이며 새 문서 모델이 아니다.

**생성은 브라우저 환경 한 곳에서 한다.** 빌드 생성과 프로젝트 정의의 요청 시 생성이 같은 wasm 엔진·CanvasKit 글자 측정·내장 Pretendard를 쓴다. Node 전용 이식 경로를 따로 만들지 않는다. layout과 글자 측정이 브라우저의 layout이 아니라 wasm이므로 결과는 실행 기기와 무관해야 하며, G0에서 같은 fixture의 layout·측정 결과가 실행마다 같은지 확인하고, 산출물 byte 일치는 G4에서 본다. 엔진 wasm·CanvasKit·폰트 파일의 hash는 정의 digest의 입력이다.

**노드 안 부품에는 part key를 붙인다.** 한 노드의 `Shape[]` 안에서 그려지는 부품 (달력 셀·선택 범위, Chart 계열, 날짜 segment) 은 도형 생성 단계에서 선택 필드로 역할 key를 적는다. Skia 변환은 이 필드를 읽지 않으며 Canvas 결과는 변하지 않아야 한다. key가 없는 부품은 앵커 대상이 아니고 가이드를 그리지 않는다.

정적 배포 항목은 빌드 시 생성하고, 프로젝트 정의는 읽기 전용 snapshot에서 지연 생성한다. 프로젝트 정의의 현재 SVG·해시는 로컬 캐시이며 Git 자산 manifest에 사용자 문서나 데이터를 넣지 않는다. 알려지지 않은 geometry는 등록 누락으로 판정하고 일반 박스로 조용히 대체하지 않는다.

### 3. 네 종류와 section은 독립이다

| 종류        | 의미                                                  | 구성·출처                                           | 활성화 계약                                                |
| ----------- | ----------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------- |
| `component` | 팔레트에서 넣는 개별 항목; 내부가 복합 구조일 수 있음 | 기존 palette item·catalog origin                    | 기존 삽입 plan/명령                                        |
| `block`     | 여러 컴포넌트를 조합한 재사용 구획                    | 등록된 composition recipe 또는 기존 definition 참조 | 지원되는 삽입 adapter가 있는 경우에만 제공                 |
| `layout`    | 페이지/영역의 구조와 콘텐츠 Slot                      | 기존 `usage: "layout"` definition과 preset          | 기존 layout 생성/적용 명령; component 삽입으로 바꾸지 않음 |
| `template`  | layout·block·component를 결합한 페이지 시작 구성      | 등록된 page composition recipe                      | 향후 page 생성/적용 adapter 계약을 충족할 때 제공          |

`kind`는 자산 종류, `sectionId`는 해당 목록의 분류다. Components의 `layout` category와 Navigator Layouts의 definition은 합치지 않는다. 기존 Navigator Layouts 탭은 유지하며 같은 미리보기 consumer를 재사용할 수 있다. 공통 카드가 네 종류를 지원한다는 이유로 모든 종류를 Components 패널의 새 탭으로 즉시 노출하지 않는다.

새 종류의 등록·미리보기·버전 검증은 이 ADR에서 설계하고 fixture로 검증한다. 완성되지 않은 Blocks/Templates의 편집·배포·삽입 기능을 구현 완료로 세지 않는다. 실제 등록 전까지 빈 종류를 제품에 노출하지 않고, activation adapter가 없는 항목은 삽입 버튼을 제공하지 않는다.

### 4. 식별·버전·이력을 분리한다

- 항목의 안정적인 ID는 label/section/배열 위치와 독립이다. Chart 변형은 canonical `Chart`가 아니라 서로 다른 palette ID를 보존한다.
- **형식 버전**은 manifest를 읽는 계약, **목록 revision**은 종류/section/순서/표시 조건/이름, **정의 digest**는 기하·상태 입력과 전이 의존성, **표현 digest**는 anatomy 선택·무채색·motion 설정, **산출물 digest**는 생성 결과를 나타낸다.
- 선언 원본과 현재 generated manifest는 Git에서 관리한다. 배포 기록은 이전/다음 digest와 변경 사유를 append-only로 남긴다. release 식별자는 증가하는 번호를 사용하며 앱 전체의 SemVer나 문서 contract 번호와 결합하지 않는다.
- 이동·이름 변경은 ID를 유지한다. ID 교체에는 명시적인 alias, 삭제에는 tombstone과 사유를 남긴다. alias는 cycle/중복 대상 정책을 검증한다. 저장된 최근 사용·즐겨찾기에는 alias를 적용하지 않는다 (사용자 결정 3). 자산 버전 변경으로 기존 문서 instance를 자동 갱신하지 않는다.
- 같은 선언 입력은 같은 출력 hash를 만든다. 시간·난수·현재 날짜·현재 locale·네트워크 결과를 생성 입력 밖에서 읽지 않는다. source commit은 provenance이며 자기 commit hash를 산출물 입력으로 넣는 순환은 금지한다.
- 버전 필드는 읽는 곳이 있는 것만 둔다. 각 필드의 소비자 (검사 gate·재생성 생략·cache key·배포 일치 확인) 는 [breakdown §5.2](design/311-catalog-anatomy-svg-asset-previews-breakdown.md)에 적는다. 배포 기록은 검사 명령이 읽는다 — manifest가 바뀌었는데 기록 항목이 없으면 실패한다.
- component의 `assetId`는 현재 palette `type` 문자열에서 순수 함수로 만든다. 기존 즐겨찾기·최근 사용 저장값은 변환 없이 그대로 읽힌다.

### 5. 패널·접근성·성능 계약

현재 Section과 검색·최근 사용·즐겨찾기·삽입 동작을 유지한다. Grid는 Section 내부 wrapper에 두고 패널 폭으로 열 수를 결정한다. Builder chrome의 scoped CSS/token을 사용하며 기존 공통 `.list-group` 규칙을 전역 변경하지 않는다.

카드의 SVG는 장식이며 카드 label이 접근성 이름을 제공한다. 별도 파일 SVG는 title/desc를 가진다. hover는 문서 상태를 바꾸지 않고 focus에서도 같은 정보를 제공한다. touch는 hover 없이 삽입할 수 있다. reduced motion에서는 이동·그리기·반복을 끄고 정적 상태를 즉시 표시한다.

상태 전환은 카드의 `:hover`·`:focus-visible` CSS로만 한다. 내장 항목에는 전환용 JS 상태·타이머를 두지 않는다. inline SVG는 고정 색 대신 역할 class를 싣고 chrome token (`currentColor`·accent) 으로 칠해 light/dark를 따른다. 내보내는 SVG만 고정 무채색이고, 두 배경 대비 조건은 내보내는 파일의 필수 경계선에 적용한다.

카드가 처음 그려질 때 진입 연출을 한 번 재생한다 (윤곽 → 구조 → 내용 → 치수 → 손잡이, 카드마다 최대 450ms 지연). hover/focus의 칠 전환은 700ms다. catalog 상태 쌍이 있는 항목은 rendered 뒤에 상태 예시 (누름·pending·선택) 를 이어 보여준다. idle 반복 애니메이션 0, 숨겨진/접힌 카드의 활성 애니메이션 0, 상태 예시를 재생하는 카드는 한 패널에 최대 1을 원칙으로 한다. SVG 하나의 요소 수와 패널 전체의 SVG 요소 수에 상한을 두고 G6에서 잰다. 정적 SVG를 보여주기 위해 CanvasKit을 패널 chunk에 가져오지 않는다. 동적 preview는 취소 가능한 작업 큐와 크기 제한 캐시로 생성하며 live graph에 연결하지 않는다.

### 6. 기존 제작물과 라이선스

`docs/design/component-illustrations/`의 90 SVG는 기존 제작물·시각 비교 자료로 보존한다. 새 emitter가 기존 스타일과 좌표 조건을 검증한 뒤 anatomy 출력의 생성 정본을 전환한다. 기존 Python과 새 생성기가 같은 활성 파일을 번갈아 쓰지 않도록 출력 위치·버전을 구별한다. 루트에 새 자산 폴더를 만들지 않는다.

Nexvyn diagram/공통 drawing primitives는 CC BY-NC 4.0, 다른 소스는 MIT with Commons Clause다. 구현에는 해당 코드를 vendor하지 않고 구체적인 도면을 tracing하지 않는다. Adobe Apache 2.0 소스 또는 기존 아이콘 코드를 실제 재사용하는 경우 해당 라이선스·고지를 보존한다. 아이디어 참고와 구체적 표현 복제의 경계는 산출물을 기준으로 확인하며, 이 ADR은 포괄적인 법적 무위험 보증이 아니다.

### 사용자 결정 3건 — 해당 기능을 제품에 노출하기 전

1. **Blocks 삽입 후 관계**: 권고는 snapshot 조합 삽입을 기본으로 하고, 기존 definition 참조형은 기존 instance 규칙을 따르게 하는 것. 모든 block을 자동으로 새로운 linked definition으로 만들지는 않는다. 실제 Blocks 활성화 단계에서 확정한다.
2. **Templates 적용 대상**: 권고는 새 페이지 생성이 기본이고 현재 페이지 덮어쓰기는 초기 범위에서 제외하는 것. 실제 Templates 활성화 단계에서 확정한다.

3. **ID 교체 때 즐겨찾기·최근 사용 정규화** — **확정 (사용자 confirm 2026-11-15, 권고대로)**: 정규화 코드를 두지 않는다. alias·tombstone은 배포 기록에만 남기고, 저장값 중 모르는 ID는 읽을 때 버린다. 2026-10-14 「개발 단계에서는 옛 값 전환 코드를 넣지 않는다」 지침과 같은 성격이다. 운영 단계에서 정규화가 필요해지면 그때 다시 정한다.

**시안 판정 (사용자 2026-11-15)**: 패널 열 수는 (가) 최소 카드 폭 160px, 가이드는 본체와 구분되게, 치수선은 뜻이 전달되게, 내용 글자는 막대 유지 (제약 2 그대로). 목표 결과는 사용자가 지정한 Nexvyn 구조 분석이다.

이 세 항목은 component SVG·anatomy 생성과 종류별 preview adapter 검증을 막지 않는다. 새 영속 스키마가 필요해지면 이 ADR의 문서 무변경 전제를 조용히 바꾸지 않고 사용자에게 범위 변경을 확인한다.

> 구현 상세: [311-catalog-anatomy-svg-asset-previews-breakdown.md](design/311-catalog-anatomy-svg-asset-previews-breakdown.md)

## Risks

| ID  | 위험                                                                                     | 심각도 | 대응                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| R1  | `ruleShapes` 이후의 보정·outline·합성 paint를 누락해 SVG와 실제 구조가 다름              | HIGH   | 해소 책임표, canonical geometry 대조, 공통 계산 추출 전후 Canvas 회귀; G1                                                     |
| R2  | 잘못된 anatomy 앵커가 다른 part의 간격·치수를 설명                                       | HIGH   | RAC 출처와 catalog 의미 경로 검증, 반복/optional/portal 사례, 수치 자동 산출; G2                                              |
| R3  | panel hover 생성이 graph·autosave·네트워크 또는 runtime 성능에 영향                      | HIGH   | 격리 snapshot·정적 사전 생성·큐 취소·캐시 상한, 실제 Builder 계측; G3/G6                                                      |
| R4  | section/종류/의존성 변경에 stale 미리보기 또는 사용자 즐겨찾기 손실                      | HIGH   | 안정 ID·분리 digest·전이 의존성·alias/tombstone·원자적 배포; G4                                                               |
| R5  | `layout`을 일반 component처럼 삽입하거나 미구현 block/template을 활성화                  | HIGH   | source/activation capability 분리, 기존 layout 명령 회귀; G5                                                                  |
| R6  | 외부 도면/코드 혼입 또는 사용자 데이터의 배포 artifact 포함                              | HIGH   | 출처 목록·라이선스 점검·내장 fixture만 빌드 입력, 동적 preview 로컬 전용; G0/G4                                               |
| R7  | 좁은 카드에서 anatomy가 읽히지 않음 — 가이드 과밀·그림자 잘림·dark 대비·focus/touch 저하 | HIGH   | 최소 카드 폭 160px (시안 판정 완료), 밀도별 가이드 선택, painted bounds 여백, 두 배경·폭·키보드·reduced motion 검증; G0/G2/G3 |
| R8  | 생성 환경 (엔진 wasm·CanvasKit·폰트) 차이로 산출물 byte가 달라짐                         | MEDIUM | 환경 hash를 digest 입력에 포함, 2회 생성 일치; G0/G4                                                                          |
| R9  | part key 추가가 Canvas 도형 생성 결과를 바꿈                                             | MEDIUM | 선택 필드로만 추가, Skia 변환 무변경, 공통 경로 회귀; G1                                                                      |
| R10 | 카드가 커져 목록이 길어짐 — 228px 패널에서 90개 스크롤이 현재의 약 3.2배 (시안 2차 실측) | MEDIUM | 사용자 판정 (가) 로 수용. 검색·최근 사용·즐겨찾기·Section 접기 유지, 실제 패널에서 찾기 흐름 확인; G3                         |
| R11 | 진입 연출이 패널 열기 때 여러 카드에서 함께 재생되어 frame 비용이 늘어남                 | MEDIUM | CSS animation 1회·최대 지연 450ms, reduced motion 제외, 넘으면 화면에 보이는 카드로 제한; G6                                  |

## Gates

모든 gate는 구현 단계의 통과 조건이다. 현재는 미실행이며 문서 작성 검증과 구분한다. 실패를 baseline 갱신으로 숨기지 않는다. 자동 검사는 로컬 명시 명령과 pre-push 또는 `push: main` workflow로 집행한다.

| Gate | 시점         | 통과 조건                                                                                                                                                                                                                                           | 실패 시 대안                                             |
| ---- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| G0   | 착수         | 실행되는 palette 목록/필터와 anatomy 출처 전수표, Shape·후처리·layout 경계 표, 기준 번들/성능, 라이선스 provenance 확정, 같은 fixture의 layout·글자 측정 결과 2회 실행 일치, 폭 단계 S·M·L 시안 3–5종을 실제 패널 폭에서 판독 확인 (사용자 confirm) | 지원 불명 항목을 식별하고 원인 해결 전 전면 전환 금지    |
| G1   | SVG emitter  | 모든 대상 geometry/clip/paint 순서 지원, 미해소 값 0, 300×300·순수 벡터·무채색·instance ID 검증, 공통화된 Canvas 경로 회귀 0, 표현 변환 전 SVG를 래스터한 결과와 같은 fixture의 Canvas 렌더 픽셀 대조                                               | emitter 범위 보강 또는 추출 철회; raster fallback 금지   |
| G2   | Anatomy·상태 | RAC 역할 연결 누락 0, 조건부 part 처리, 앵커 bounds를 같은 fixture의 Preview DOM `getBoundingClientRect`와 대조 (기존 parity 허용 오차), 가이드 오차 ≤ 0.5 source px, 공유 경계·gap 보존, 날짜/시간 조건, 두 배경 필수 경계 대비 ≥ 3:1, 잘림 0      | 가이드 밀도/표현 수정; 측정값 임의 보정 금지             |
| G3   | 실제 패널    | 검색·최근·즐겨찾기·Section·삽입/Undo 보존, hover/focus 중 문서 쓰기·외부 요청 0, 키보드/touch/reduced motion, 중복 SVG ID 0                                                                                                                         | 해당 UI 전환 보류; 기존 아이콘 유지                      |
| G4   | 등록·릴리스  | 동일 입력 재생성 byte 일치, section-only·theme·nested dependency 변경 감지, alias/tombstone 검사, 원자적 manifest/artifact 일치, 사용자 데이터 유출 0                                                                                               | release 생성 실패; 직전 일치하는 release 유지            |
| G5   | 종류 확장    | 네 kind adapter fixture 통과, Navigator Layouts와 apply/Undo 유지, 미지원 activation 비노출, 프로젝트 정의 편집/삭제 시 cache invalidation                                                                                                          | 해당 kind 비활성 유지; component/layout 완료와 분리 보고 |
| G6   | 최종         | G0 대비 비용·현재 ADR-201 번들 gate 통과, cache/재생·SVG 요소 수 상한 준수, 범위별 typecheck/인접 회귀/브라우저 및 `codex:preflight` 통과                                                                                                           | rollout 보류·병목 수정; 예산 변경은 근거와 사용자 결정   |

## Consequences

### Positive

- catalog 구조·토큰 변경을 미리보기에도 반영하며 도형을 별도 손그림으로 유지하지 않는다.
- anatomy 설명과 최종 모습을 같은 기하에서 생성해 카드의 역할을 명확히 한다.
- 새 종류·section 변경·Chart 변형을 안정 ID와 검증된 릴리스 이력으로 추적한다.
- Navigator Layouts와 향후 Blocks/Templates가 하나의 SVG consumer를 공유할 수 있다.

### Negative

- SVG emitter와 해소된 scene 경계를 추가하고 기존 Skia 후처리 일부를 순수 계산으로 정리해야 한다.
- RAC anatomy와 catalog 부품의 대응은 검증 가능한 연결 표가 필요하며 문서만 읽어 모든 연결을 자동 추론하지 않는다.
- 동적 프로젝트 미리보기는 캐시·취소·의존성 추적이 필요하다. 대형 구성에는 명시적인 표본 정책이 필요하다.
- 기존 SVG와 새 anatomy 출력이 비교 기간 동안 공존한다. 활성 정본과 보관 제작물을 명확히 구별해야 한다.
- 카드가 커져 Components 목록이 길어진다 (228px 패널에서 현재의 약 3.2배). 사양 메모는 카드 폭이 충분한 단계에서만 나온다.
- 도형 타입에 선택 필드 (part key) 가 하나 늘고, 빌드 생성이 브라우저 실행 환경을 요구한다.

## References

- [RAC DatePicker API](https://react-aria.adobe.com/DatePicker#api), [DateRangePicker API](https://react-aria.adobe.com/DateRangePicker#api), [TimeField API](https://react-aria.adobe.com/TimeField#api) — 구성 요소·slot 출처. 현재 프로젝트 설치본과 다르면 설치본을 확인한다.
- [Nexvyn ComponentCard](https://github.com/Nexvyn/Nexvyn-ui/blob/master/components/showcase/component-card.tsx), [diagram-parts](https://github.com/Nexvyn/Nexvyn-ui/blob/master/components/diagrams/lib/diagram-parts.tsx) — 패턴 분석 자료; 가져올 구현 소스가 아님.
- [Nexvyn UI — Grid · SVG · Hover Animation 구조 분석](https://chatgpt.com/share/6af964bb-aa08-83ee-b6de-e5ea9c9a7e80) — 사용자가 목표 결과로 지정한 분석 (소스 코드 기준). 항목별 판정은 breakdown §2.2.
- [Nexvyn 갤러리](https://ui.nexvyn.dev/components) — 2026-11-15 Chrome 실측 (grid·viewBox·요소 수·hover CSS). 수치는 breakdown §2.1.
- [Nexvyn 도면 라이선스](https://github.com/Nexvyn/Nexvyn-ui/blob/master/components/diagrams/LICENSE), [일반 라이선스](https://github.com/Nexvyn/Nexvyn-ui/blob/master/LICENSE), [Adobe 라이선스](https://github.com/adobe/react-spectrum/blob/main/LICENSE) — 2026-11-15 확인.
- [Container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_queries), [SVG image context 제한](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image) — 패널 폭 기준 배치와 inline SVG 출력 경계.
