# Chromium·Blink 대조 통합 — Composition Canvas 정확도·지원 범위·실행 계획

> 작성일: 2026-10-17 (2026-10-16 조사 통합)
>
> 상태: 분석·계획 통합 완료. 이 문서의 구현 및 제품 gate는 미착수.
>
> 통합 시 Composition HEAD: `a6ce961a407975d5082196839fbfbfc2db8a6281`
>
> 원 조사 Composition 기준: `45026d1d84bdeceb61b5df7ef3f09ed0ac5e5693`
>
> Chromium 참조 기준: `33688427bc1a316cecb28d5651ad25208ba9ab53`
>
> 증거 범위: 원문 종합, 핵심 production 연결 경로 및 공식 소스 대조. 이번 통합에서 Builder/Preview 재현·성능 측정은 실행하지 않았다.

## 1. 목적과 분석 출처

이 문서는 다음 세 분석의 결함 후보, 구현 참조, 지원 범위와 검증 절차를 하나의 실행 계획으로 통합한 독립 문서다. 별도 원본 문서 없이 읽고 실행 근거를 추적할 수 있다.

| 원문                         | 작성 주체   | 통합한 내용                                                                  |
| ---------------------------- | ----------- | ---------------------------------------------------------------------------- |
| Blink LayoutNG 대조          | Claude Code | B/F/G/X 후보 ID, 엔진 입력 누락, 레이아웃 알고리즘 차이, 재현 fixture        |
| Chromium cc·Blink paint 대조 | Claude Code | 페인트·이미지·폰트 후보, 기존 구조 대응, 성능 가설, 추가된 Codex 교차 검증   |
| HTML·CSS Canvas Phase Plan   | Codex       | 지원 manifest, 원문 추적·이식 절차, 독립 oracle, bounds·갱신 계약, 완료 gate |

필요한 후보·함수·코드 위치·fixture·검증 계약은 본문과 §12~§13에 수록했다. 원본 문서 3개는 별도로 보존할 필요가 없으며 표의 제목과 작성 주체는 분석 출처 표시다. 원 분석의 모든 수치·재현 예측을 새로 검증했다는 뜻은 아니다. 페인트 분석은 통합 당시 커밋되지 않은 교차 검증 수정본도 반영했고, 채택한 판단과 근거를 이 문서에 남겼다.

### 1.1 통합 결론

1. 가장 먼저 다룰 대상은 현재 저작 가능한 기능의 입력 누락과 재현된 정확도 결함이다. 엔진에 필드나 함수가 있다는 사실은 production 지원을 증명하지 않는다.
2. 기존 command stream·picture cache·damage redraw·spatial culling·event-driven RAF를 재사용한다. 새 구조는 기존 기능으로 해결할 수 없는 계약이나 측정된 병목에 한정한다.
3. Claude의 구체적인 결함 후보를 Codex의 feature ledger와 검증 gate에 연결한다. 같은 조사를 처음부터 반복하지 않고, 부족한 증거만 추가한다.
4. 기존 기능 수리, 지원 확장, 성능 최적화를 별도 작업 단위로 진행한다. 작은 Grid 결함의 수리가 float/table 전체 구현을 기다리지 않게 한다.
5. Chromium은 구현 참고이고, 표준은 의미 기준이며, 실제 Preview는 제품 비교 대상이다. 브라우저 버그·플래그·backend 차이를 공통 계약으로 자동 채택하지 않는다.
6. 문서 생성은 제품 구현, 새 ADR 작성·승격, commit/push 승인을 뜻하지 않는다.

### 1.2 권위와 수정 경계

- 문서 정본은 `CatalogGraph`다. 변경은 catalog 명령 → `workspace.execute`로 수행한다.
- DOM·접근성은 React Aria, Props는 Spectrum 참조와 custom 계약, 시각 값은 catalog + theme/tokens가 담당한다. Canvas와 Preview는 대등한 소비자다.
- paint bounds·property state·index·cache는 파생 상태다. 저장 문서나 명령의 쓰기 원본으로 사용하지 않는다.
- 기존 renderer 수리는 D3 consumer 내부에서 우선 해결한다. 새 HTML 요소·DOM 구조·public prop·저장 키가 필요하면 D1/D2 및 schema 영향까지 해당 작업에 명시한다.
- layout은 Rust 엔진, 입력 직렬화는 shared `compositionRoot.ts`가 담당한다. TS 위치 보정으로 엔진 결함을 숨기지 않는다.
- 이미 resolve된 catalog 경로에 별도의 범용 CSS cascade 엔진을 중복 삽입하지 않는다.

## 2. 범위와 판정 방법

### 2.1 세 작업 범위

| 범위           | 대상                                                                          | 기본 처리                                                    |
| -------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| 현재 기능 수리 | catalog·Styles 패널·generated CSS·문서 상태·기존 import가 실제 내보내는 값    | 최소 fixture로 재현하고 우선 수리                            |
| 지원 확장      | 아직 저작·저장·DOM/Canvas 표현이 연결되지 않은 HTML/CSS 기능                  | manifest에 남기고 기능별 제품 범위와 의존성을 확정한 뒤 진행 |
| 성능 최적화    | 정확한 동작을 유지하며 layout/binding/record/raster·메모리 비용을 줄이는 작업 | 같은 조건의 기준선과 수정본을 비교해 채택                    |

CSS 선언이 없다는 것은 전체 제품에서 영구히 불필요하다는 뜻이 아니다. Styles·instance override·상태·import 입력도 확인한다. 반대로 미래 지원표에 포함됐다는 이유만으로 현재 구현의 선행 조건이 되지 않는다.

Canvas는 저작 surface다. 문서가 보유한 selected·disabled·isPending 등의 표시와, Preview에서 발생하는 hover·pressed·focus·시간 기반 animation을 구분한다. 기존 state preview가 제공하는 범위는 검증하되, 모든 DOM 상호작용을 Canvas에서 실행하는 기능은 자동으로 추가하지 않는다. 드래그 중간 preview와 commit의 정합은 현재 편집 기능이므로 수리 범위에 포함한다.

### 2.2 지원 상태와 증거 수준

지원 상태와 증거 수준은 서로 다른 필드로 기록한다.

| 지원 상태                | 의미                                                       |
| ------------------------ | ---------------------------------------------------------- |
| `unverified`             | 입력·출력 또는 현재 지원 여부를 판정하지 못함              |
| `planned`                | 구현할 범위를 정했으나 미구현                              |
| `implemented-unverified` | 경로는 존재하지만 해당 조합의 제품 검증이 없음             |
| `divergent`              | 기준과 다른 계약 또는 결과를 확인함. 증거 수준을 함께 기록 |
| `verified`               | 명시한 환경·fixture·상태의 완료 gate를 통과함              |
| `unsupported`            | 현재 지원하지 않으며 이유와 대체 표현이 명시됨             |
| `deferred`               | 비용·수요·의존성 때문에 보류하며 재개 조건이 명시됨        |

| 증거 수준         | 의미                                                                     |
| ----------------- | ------------------------------------------------------------------------ |
| `source-reported` | 원문 분석에서 보고했으나 이번 통합에서 독립 재검증하지 않음              |
| `code-confirmed`  | 현재 production 연결이나 분기를 직접 대조함. 화면 결과까지 증명하지 않음 |
| `reproduced`      | 환경·입력·기대값·실제값을 가진 실행 artifact가 있음                      |
| `gate-passed`     | 해당 기능의 정확도·수명·필요 성능 gate를 통과함                          |

`verified`는 속성명 전체가 아니라 값·상태·조합 단위다. 같은 알고리즘을 공유하는 단위 테스트, grep 결과, 구현 필드의 존재만으로 올리지 않는다. 원문 표현인 “확정 결함”도 근거가 코드 대조라면 `code-confirmed`로 기록한다.

### 2.3 집계 원칙

레이아웃 원문의 상세 표는 **B 8 + F 11 + G 18 + X 14 = 51개 후보 행**이다. 요약의 “36건”, “흔한 12건 + 드문 24건”은 상세 ID와의 대응이 명시되지 않아 사용하지 않는다. 우선순위 표의 12개는 여러 ID를 묶은 작업군이다.

51개 모두를 독립적인 확정 버그로 세지 않는다. 조건부·미검증·의도적 제한·중복 원인을 분류하고 feature ID를 기준으로 집계한다. 예를 들어 F6/G12, B4/X10은 공통 원인이나 구현을 공유할 수 있다. 미지원 항목을 분모에서 제거해 지원률을 높이지 않으며, manifest 버전·분모·검증 환경을 함께 보고한다.

## 3. 교차 검증에서 정리한 사항

| 쟁점                                                    | 통합 판정                                                                                                       | 실행에 미치는 영향                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| baseline·strut가 구현돼 있으므로 지원됨                 | Rust 입력·소비는 있으나 현재 `styleOf`의 `lineHeight`·`leafBaseline`·`strutBaseline` 공급 누락을 코드에서 확인  | B1/B2를 입력 연결 수리로 우선 처리. 실폰트 측정·증분 갱신까지 확인                        |
| fixed·sticky가 지원됨                                   | `itemLayout`이 relative/absolute만 내보내는 것을 확인. 입력 전달만으로 sticky/fixed 전체 구현이 완성되지는 않음 | X8을 sticky와 fixed의 별도 feature로 나누고 scroll owner·containing block·paint 연결 확인 |
| Grid intrinsic/fit-content 미구현                       | 레이아웃 원문은 해소 경로가 있다고 보고함. 페인트 표의 미구현 판정과 충돌                                       | 헤더·필드 이름 대신 production 입력과 계산 분기를 기준으로 재분류                         |
| Grid areas 구현됨                                       | 레이아웃 원문은 parser와 production 전달의 불일치를 보고함                                                      | parser 지원과 저작·저장·engine 지원을 분리                                                |
| `ctx.fontVariantNumeric`으로 측정                       | 표준 Canvas 2D API에 해당 속성이 없음                                                                           | 제안 폐기. Paragraph feature 계약과 fallback 측정 전략으로 해결                           |
| Canvas 2D가 production 텍스트 측정의 단일 oracle        | catalog 측정은 CanvasKit 준비 후 Paragraph 우선이고, paint의 Canvas 2D 줄바꿈 hint는 별도 경로                  | 측정·shaping·hint·렌더·편집 overlay를 함께 대조                                           |
| `image-rendering:auto`는 항상 linear+mipmap             | 페인트 수정본도 크기·배율·상태에 따른 분기를 인정함                                                             | 고정 Chromium 호출 사슬과 설치 CanvasKit의 실제 API를 확인하고 값별 fixture 사용          |
| `forceFull`이 독립 fresh oracle                         | 현재 함수는 content invalidation이며 catalog/layout/command fresh build를 보장하지 않음                         | 기존 디버그 기능을 재사용하되 독립성의 부족분을 보강                                      |
| damage rect 내부 비교면 무효화 누락 검출                | 너무 작은 damage 바깥의 잔상과 damage 자체가 없는 경우를 놓침                                                   | 독립 기준 surface 전체 또는 독립적으로 정한 검사 영역을 비교                              |
| 기존 damage/culling이 있으므로 paint bounds 작업 불필요 | unsafe → full fallback과 실제 paint 영역·effect 입력 추적은 다른 능력                                           | 기존 정확성 fallback을 보존하면서 남은 범위만 기능별 확장                                 |
| property node만 갱신하면 이동 전체가 O(1)               | 명령 재기록은 줄어도 bounds/index/hit/overlay·자원 비용이 남음                                                  | 전체 동작의 비용과 수명으로 평가                                                          |
| 과거 기준선은 무조건 재사용 또는 무조건 재측정          | HEAD·관련 diff·fixture·환경·resource·계측 조건이 맞는 증거만 재사용                                             | 불일치한 범위만 재측정. 이전 ADR 종결 자체를 취소하지 않음                                |

Canvas 2D의 `fontVariantCaps`와 numeric feature는 같은 API 표면이 아니다. [HTML 표준의 CanvasTextDrawingStyles](https://html.spec.whatwg.org/multipage/canvas.html#canvastextdrawingstyles)를 기준으로 구분한다. 현재 catalog 측정은 `apps/builder/src/builder/catalogRuntime/textMeasure.ts`, 렌더는 `nodeRendererText.ts`를 함께 확인한다.

## 4. 이미 있는 구조와 남은 작업

| 기존 Composition 자산                          | Chromium의 대응 개념                | 재사용 및 보강                                                 |
| ---------------------------------------------- | ----------------------------------- | -------------------------------------------------------------- |
| `renderCommands.ts` command stream             | display list·paint record           | 명령 포맷 전면 교체보다 정확도·갱신 경로를 우선 검증           |
| `nodePictureCache.ts`                          | display item cache                  | identity·resource·style 변경의 무효화 검증                     |
| `subtreeCommandPatch`·`subtreeTranslate`       | subsequence 갱신·property 변화      | 기존 patch를 유지하고 이동·clip 비용을 계측                    |
| pending damage·full fallback·ping-pong surface | raster invalidation                 | conservative bounds와 effect 의존성 확보 후 unsafe 범위를 줄임 |
| Rust spatial index·실행기 AABB 컬링            | interest rect·재생 후보 검색        | hit index와 paint index의 역할을 분리할 필요 확인              |
| camera blit·viewport 크기 content surface      | 기존 raster 재사용                  | 카메라 정착·DPR·zoom 정확도 검증, 타일은 조건부                |
| dirty + rAF                                    | scheduling                          | 브라우저 전체 compositor scheduler 복제는 기본 대상 아님       |
| image cache·byte budget                        | image decode/resource cache         | sampling 의미를 먼저 수리하고 해상도별 캐시는 비용 측정 후     |
| ADR-156 차등 oracle·G3·ADR-263/264 live 도구   | WPT·reftest·under-invalidation 검사 | feature ID와 연결하고 실제 우회 범위·negative test를 확인      |

구조가 비슷하다는 이유로 동일한 지원 범위·복잡도·정확성을 가정하지 않는다. `setDamageOff`·`setLinearOnly`·`forceFull`의 각 기능을 조사해 새 하니스에 재사용하되, 공유하는 stale scene이나 picture cache가 있는지 별도로 확인한다.

`damageUnsafeElementIds`와 `hasTextPaintOverflow`는 안전한 full fallback의 근거다. 이들은 glyph·shadow·filter의 실제 paint bounds나 backdrop 입력 의존성을 모두 계산한다는 뜻이 아니다. `renderCommands.ts`의 hit bounds 기반 후보 검색과 실행기 내부 컬링을 함께 검증해야 한다.

## 5. 레이아웃 후보 통합 목록

아래 ID는 레이아웃 원문과 동일하다. **B1/B2와 X8의 입력 누락은 이번 대조에서 `code-confirmed`; 나머지 행의 상세 결과는 별도 표시가 없으면 `source-reported`**다. fixture는 검증 입력 또는 가설이며, 표의 존재가 실제 Chrome 재현을 뜻하지 않는다. 상세 함수·코드 위치와 수치 fixture는 §12에 수록했다. 착수 시 현재 SHA와 symbol을 ledger에 고정한다.

### 5.1 Block·inline·baseline — B1~B8

| ID  | 후보와 원인                                              | 최소 검증 입력·판정                                    |
| --- | -------------------------------------------------------- | ------------------------------------------------------ |
| B1  | 컨테이너 strut용 `lineHeight` 미전송                     | line-height 24px block 안 12px atomic inline의 줄 높이 |
| B2  | `leafBaseline`·`strutBaseline` 공급 누락                 | 크기가 다른 inline Button의 baseline과 부모 줄 높이    |
| B3  | `line-height:normal`의 font metrics·line gap·반올림 차이 | 명시 line-height 없는 Text, 폰트별 normal 높이         |
| B4  | `vertical-align:middle`에 x-height 보정 없음             | 부모 16px 폰트와 40px inline-block의 수직 위치         |
| B5  | atomic inline line box의 `text-align` 경로 부족          | block 안 inline-flex Button의 center/end 정렬          |
| B6  | block inline 배치의 `white-space:nowrap` 전달·wrap 억제  | 100px 부모 안 50px inline item 세 개                   |
| B7  | first/last baseline을 하나의 값으로 취급                 | flex baseline 정렬에 다중 줄 Text block 배치           |
| B8  | scroll container baseline clamp 차이                     | overflow:hidden·height 10px 안 24px 줄                 |

B1/B2는 이전 파이프라인 복사만으로 닫지 않는다. 현재 catalog의 font family·feature·line-height 의미와 측정 결과에 맞춰 연결한다. 입력 변경 → 엔진 dirty → Canvas/DOM → 저장/재로드까지 검증한다.

### 5.2 Flex — F1~F11

| ID  | 후보와 원인                                                              | 최소 검증 입력·판정                                        |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------------------- |
| F1  | flex factor 합 < 1일 때 initial free space 대신 매 라운드 remaining 사용 | grow .3 두 항목과 한 항목의 max-width 제한                 |
| F2  | 음수 여유에서도 main auto margin이 justify를 막음                        | 부모 100px, item 300px, auto margin + center               |
| F3  | `align-content:space-evenly` 분기 누락                                   | definite 높이 wrap 컨테이너의 두 줄                        |
| F4  | definite row item의 content size suggestion 측정 생략                    | 좁은 row에서 고정 폭·자식 보유 item의 min-content 하한     |
| F5  | column intrinsic 기여에서 마지막 자식 bottom margin 누락 가능            | 자식 높이와 bottom margin이 있는 definite-height item      |
| F6  | row-gap percentage를 폭 기준으로 해소                                    | 400×200 wrap 컨테이너의 row-gap 10%                        |
| F7  | flex-basis intrinsic 키워드의 auto/max-content 근사                      | min-content·max-content·fit-content별 줄바꿈 가능한 텍스트 |
| F8  | start/end/left/right와 reverse 결합 해석                                 | row-reverse + start, column + left/right                   |
| F9  | last baseline을 first 그룹으로 처리                                      | 한 줄·두 줄 항목의 last baseline 정렬                      |
| F10 | indefinite 기준의 percentage min-size가 auto로 복귀                      | max-height만 있는 column의 percentage min-height           |
| F11 | f32·epsilon과 Blink layout unit의 반올림 차이                            | 100px 안 동등한 flex 세 개의 총합과 경계                   |

F4는 기존 ADR-204의 측정 생략 이유를 확인한다. 정확도를 복원하면서 새 intrinsic 순회·측정량을 계측하고 ADR-246 관련 ratchet와 비교한다. 허용치를 사후 완화해 통과시키지 않는다.

### 5.3 Grid — G1~G18

| ID  | 후보와 원인                                                   | 최소 검증 입력·판정                                          |
| --- | ------------------------------------------------------------- | ------------------------------------------------------------ |
| G1  | 명시 min-width:0에도 min-content 기여가 남음                  | 1fr 두 열, 긴 텍스트에 min-width:0                           |
| G2  | scroll container의 automatic minimum 처리 부족                | G1 입력의 overflow:hidden 변형                               |
| G3  | definite 축에서 flexible track을 지나는 span 기여를 일괄 제외 | 600px·3개 1fr 열, span 2의 폭 400/500px 경계 비교            |
| G4  | span 추가 기여를 고정·intrinsic 트랙에 균등 분배              | 100px auto 열과 30px auto 행의 spanning item                 |
| G5  | 역순 grid line의 swap 처리 부족                               | grid-column:3 / 1                                            |
| G6  | 없는 named line을 auto placement로 처리                       | 없는 이름을 start로 지정한 item                              |
| G7  | 양축 확정과 행 확정 item의 배치 순서·행별 커서 차이           | 행만 고정한 선행 item과 같은 행·열을 지정한 후행 item        |
| G8  | definite column이 cursor보다 앞설 때 다음 행 이동 누락        | 3열에서 auto, column 3, column 2 순서                        |
| G9  | 음수 여유에서 unsafe content alignment를 start로 처리         | 300px container 안 400px track + center                      |
| G10 | 단일 track의 space-between을 center로 처리                    | 300px container 안 100px 단일 track                          |
| G11 | safe·left·right 정렬 해석 부족                                | positive/negative free space의 right·safe center             |
| G12 | row-gap percentage 축 오류                                    | definite 400×200 grid의 row-gap 10%                          |
| G13 | auto-fit 빈 트랙 collapse가 열 축에 한정                      | definite 높이·auto-fit rows·두 item                          |
| G14 | indefinite 축에서 definite min/max 기반 auto-repeat 계산 부족 | min-width가 있는 auto-fill grid                              |
| G15 | 0fr를 1fr로 fallback                                          | 1fr 0fr 두 열                                                |
| G16 | aspect-ratio와 implicit stretch 우선순위 차이                 | 200×300 셀 안 ratio 2 item, normal/explicit stretch 비교     |
| G17 | intrinsic size 0인 item의 강제 stretch                        | 빈 item + justify-self:start. 기존 의도적 fallback 여부 확인 |
| G18 | fractional track·잔여 크기 반올림 차이                        | fractional fr·gap·DPR별 총합과 경계                          |

G3/G4 수정은 최근 span 수리의 반대 회귀를 만들지 않아야 한다. 폭 400px item이 span 2를 차지하는 경우와 500px인 경우를 모두 고정한다. `1fr`와 `minmax(0,1fr)`도 구분한다. span은 기존 cell을 점유하는 범위이며 track 병합이 아니다. drag preview·commit·resize·guide·hit-test의 현재 제품 계약을 함께 검증한다.

### 5.4 Box·position·단위 — X1~X14

| ID  | 후보와 원인                                                          | 최소 검증 입력·판정                                                         |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| X1  | relative 가로 percentage inset의 containing block 기준 오류          | padding과 definite width를 가진 부모, left:50%                              |
| X2  | auto-height 부모를 relative 세로 percentage의 definite 기준으로 사용 | auto-height 부모, top:50%                                                   |
| X3  | absolute static position에 flex/grid 정렬 미반영                     | inset 없는 absolute 자식과 center 정렬 부모                                 |
| X4  | absolute static position에서 선행 형제 bottom margin 누락            | 높이 50px·margin-bottom 30px 형제 뒤 absolute                               |
| X5  | absolute 가로 auto margin의 음수 여유를 균등 분배                    | 양 inset 0, 부모보다 넓은 자식, 양 margin auto                              |
| X6  | aspect-ratio 자동 최소 높이가 leaf에 미적용                          | 120px Text, ratio 4, 세 줄 콘텐츠                                           |
| X7  | aspect-ratio의 반대 축 min/max 전송 부족                             | auto width·ratio 2·max-height 100px                                         |
| X8  | sticky/fixed 직렬화 누락, sticky 보정 생산자 연결 부족               | sticky header 스크롤과 fixed viewport 기준을 별도 검증                      |
| X9  | em 고정 기준 및 ch/ex 근사                                           | font-size 24px·width 2em, 서로 다른 폰트의 ch/ex                            |
| X10 | vertical-align 확장 키워드·길이·percentage 미지원                    | sub/super/text-top/text-bottom/-6px/%                                       |
| X11 | 엔진 초기값 표의 border/outline 값 차이                              | production 호출 여부부터 확인. dormant라면 제품 결함으로 집계하지 않음      |
| X12 | 엔진 상속 표 누락                                                    | catalog resolver의 실제 상속을 먼저 추적. dormant 표 확장으로 해결하지 않음 |
| X13 | publish CSS reset 범위 차이로 UA 값 잔존 가능                        | button/input/textarea/list별 generated CSS와 최종 computed style            |
| X14 | aspect-ratio 전송 크기의 padding/border 하한 부족                    | 작은 definite 높이·ratio·큰 가로 padding                                    |

추가 미확인 항목은 부모 px/숫자 line-height 상속, absolute containing block 생성, block content 정렬·auto margin·min/max 상세다. X8 fixed, X10, G17처럼 기존 미지원 계약과 겹친 항목은 결함 수리와 기능 확장을 분리한다.

### 5.5 보존할 기존 동작

원문은 margin collapse·BFC·shrink-to-fit, flex freeze loop와 기본 auto minimum 처리, fr 가상 크기 루프·auto-repeat 일부, min/max clamp·absolute inset 해소 등의 일치도 보고했다. 이는 엔진 전면 교체의 근거가 아니다. 관련 기존 회귀 테스트를 보존하고 변경한 조건의 반례를 추가한다. “같음 확인” 역시 모든 입력 조합에 대한 완전한 지원 증명으로 확대하지 않는다.

## 6. 페인트·이미지·텍스트 후보 통합 목록

이 문서는 레이아웃 G ID와 페인트 원문의 G4/G5가 충돌하지 않도록 별도 `C01~C12`를 사용한다. 원문의 rich inline은 확장 E01, table은 E02에 연결한다.

| ID  | 대상                                  | 현재 근거·한계                                                                         | 작업과 검증                                                          |
| --- | ------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| C01 | box-shadow·text-shadow sigma          | `/2.355` 변환을 현재 코드에서 확인. Blink radius×0.5와 다름                            | outer/inset·다중 shadow·spread·모서리·외부 픽셀 비교                 |
| C02 | filter drop-shadow sigma              | 같은 변환이 적용된 코드를 확인. CSS 입력은 표준편차 의미                               | C01과 파서 의미를 분리하고 실제 filter 출력·bounds 검증              |
| C03 | 이미지 sampling                       | 기본 `drawImageRect` 호출을 확인. installed CanvasKit 0.42.0의 기본 sampling 경로 사용 | auto/pixelated/crisp-edges, 축소·확대·crop·DPR·zoom 별 정책 검증     |
| C04 | font variant·feature                  | numeric/caps/feature settings의 production 전달을 끝까지 확인해야 함                   | catalog→측정→render→cache key→font loading 연결, 실제 font의 폭 비교 |
| C05 | synthetic italic/bold                 | face 요청만으로 합성 여부를 판정할 수 없음                                             | face 유무·font-synthesis 정책·Paragraph 실제 출력 검증 후 결정       |
| C06 | border style·corner·dash              | solid/dashed/dotted 외 값과 변별 corner 처리의 차이 보고                               | 사용 값부터 port, 폭·색·alpha·miter·dash endpoint·radius 비교        |
| C07 | outline style·offset                  | 항상 solid인 경로와 상태 스타일의 차이 보고                                            | explicit style·음수 offset·focus 표현의 해당 consumer 검증           |
| C08 | 개별 translate/rotate/scale           | transform 함수와 별도 속성의 소비 누락 보고                                            | translate→rotate→scale→transform 결합과 origin·hit·clip 검증         |
| C09 | decoration thickness·underline offset | 폰트 기반 배수와 CSS 길이 의미를 구분해야 함                                           | auto/from-font/명시 값·wavy·baseline·paint overflow 비교             |
| C10 | background·clip/mask·stacking         | 구현된 부분과 background origin/clip/repeat 등 미소비 후보 혼재                        | 값별 지원표, 그림 순서·반투명 그룹·effect 입력·clip 조합 확인        |
| C11 | object-fit/position·SVG·대체 콘텐츠   | Image binding과 실제 src/dst 기하까지 확인 필요                                        | intrinsic size·ratio·crop·viewBox·fallback·비동기 갱신 검증          |
| C12 | 속성→소비자 coverage                  | grep 0이나 선언 수는 지원 여부의 단독 근거가 아님                                      | typed contract·예외 사유·동적 fixture를 연결한 정적 누락 방지        |

### 6.1 Shadow

box/text shadow의 CSS blur radius와 filter drop-shadow의 표준편차 입력을 분리한다. Blink의 [ShadowData](https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/core/style/shadow_data.h)는 radius×0.5를 제공한다. filter 입력은 parser부터 실제 filter 생성 호출까지 추적하여 값의 변환 위치를 확인한다.

상수 변경 뒤 상자 가장자리만 비교하지 않는다. 퍼진 그림자의 외부 영역, inset, 음수 spread, alpha, DPR·fractional 위치를 포함한다. paint bounds를 별도로 좁히는 최적화와 동시에 묶지 않는다.

### 6.2 이미지

페인트 수정본의 보간 호출 사슬은 조사 입력으로 재사용한다. `ComputedStyle`의 품질 선택 → `ComputeInterpolationQuality` → sampling options → decode/raster 경로를 고정 revision에서 추적한다. 이미지 크기·상태에 따른 분기가 있으므로 모든 입력에 같은 mipmap 정책을 넣지 않는다. [Chromium graphics context](https://github.com/chromium/chromium/blob/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/platform/graphics/graphics_context.cc)

설치 버전의 `drawImageRectOptions`·mipmap API·source rectangle constraint를 확인한다. 정적 zoom 1 parity와 Canvas 카메라 확대·축소 품질을 구분한다. `표시 크기×DPR×2`는 이 문서의 확정 decode 규칙이 아니며 화질·재확대·메모리를 검증할 후보 정책이다. 원본 해제는 retained command·picture·snapshot의 소유권과 사용 종료 시점을 확인한 뒤 수행한다.

### 6.3 텍스트

`ctx.fontVariantNumeric` 제안은 사용하지 않는다. feature 전달 누락과 실제 폭 차이는 구분한다. 글꼴의 기본 숫자가 이미 고정폭이면 한 fixture에서 차이가 없을 수도 있다.

측정과 paint는 font family·weight/style/stretch·variation·OpenType feature·synthesis·white-space·break 정책을 공유해야 한다. Canvas 2D hint가 사용되는 조건과 Paragraph 단독 경로를 모두 검증한다. 브라우저 API로 폭을 측정한다는 이유만으로 DOM의 line breaking 전체를 실행한 것으로 취급하지 않는다.

합성 italic은 실제 결함을 재현한 뒤 다룬다. paragraph 전체 skew는 글리프 합성 외에 origin·줄 배치·decoration·paint bounds에도 영향을 줄 수 있으므로 단순 대체로 확정하지 않는다. 측정용 Paragraph 전역 캐시를 도입하지 않고, 렌더 Paragraph의 노드 소유·공유 FontCollection·지연 해제 계약을 유지한다.

## 7. 전체 지원 범위와 확장 목록

HTML 지원은 catalog·DOM의 의미와 Canvas 표현을 대응시키는 작업이다. Canvas 픽셀로 접근성·탐색·브라우저 스크립트 실행을 대체하지 않는다. CSS3는 단일 규격이 아니므로 CSS Snapshot과 모듈별 버전을 manifest에 고정한다.

| 기능군            | 현재 수리·검증                                                   | 확장 또는 범위 결정                                                                             |
| ----------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 값·상속           | 단위·percentage basis·computed/used value·currentColor·Reset     | arbitrary stylesheet parser·specificity·cascade layer·revert-layer는 실제 import 요구가 있을 때 |
| HTML 구조         | 현재 catalog 요소·slot·anonymous text·default display            | 신규 semantic element·generated wrapper                                                         |
| Box·flow·position | block/inline-block·BFC·margin·min/max·relative/absolute·sticky   | fixed의 제품 좌표계, float/clear·writing-mode·fragmentation                                     |
| Flex·Grid         | F/G 후보·intrinsic sizing·placement·span                         | subgrid·dense·baseline·앞쪽 implicit track·areas 연결 범위                                      |
| 텍스트·폰트       | baseline·line-height·feature·bidi·fallback·wrapping·편집 overlay | rich inline·다중 run·line clamp·추가 decoration                                                 |
| 배경·테두리       | shadow·border·outline·gradient·다중 layer                        | border-image·추가 repeat/origin/clip·collapsed table border                                     |
| 이미지·SVG        | sampling·object-fit·intrinsic ratio·load/error·viewBox           | animation image·video·외부 canvas/iframe·색 프로필별 정책                                       |
| 합성              | z-index·opacity·2D transform·clip/mask·filter·backdrop 입력      | 3D/perspective·top layer·추가 SVG filter·wide-gamut 출력                                        |
| 상태·반응형       | 문서 상태·breakpoint·기존 state preview·font/image 완료          | Canvas에서 새 상호작용·timeline 실행, container query 등 신규 저작 기능                         |
| 표·목록           | 현재 Table·list 관련 실제 DOM과 Canvas 차이                      | 완전한 CSS table·colspan/rowspan·marker/counter                                                 |
| 브라우저 서비스   | 기존 Preview/DOM 위임과 fallback                                 | print/speech·navigation·권한이 필요한 embedded content는 별도 제품 범위                         |

| 확장 ID | 범위                                            | 선행 결정·검증                                                                    |
| ------- | ----------------------------------------------- | --------------------------------------------------------------------------------- |
| E01     | mixed inline·rich text·anonymous fragment       | catalog 콘텐츠 모델·style run·shaping·선택/IME·저장 모델                          |
| E02     | CSS table·list·marker/counter                   | 기존 Table 계약·ADR-257과의 경계, DOM 행/셀 구조·intrinsic sizing·border-collapse |
| E03     | float/clear·writing-mode·multicol/fragmentation | 저작 수요·logical axis·containing block·pagination 범위                           |
| E04     | Grid 추가 기능·fixed 완성                       | 현재 노출 여부, parser→engine 연결, viewport·scroll owner 계약                    |
| E05     | 신규 HTML 요소·video/canvas/iframe/object/embed | 직접 렌더·리소스 프레임·DOM 위임·미지원 중 전략, CORS·격리                        |
| E06     | arbitrary CSS/HTML import                       | 실제 진입 경로·parser·cascade·validation·round-trip 범위                          |
| E07     | 신규 상호작용·animation·3D·색 공간              | Canvas와 Preview 책임, 시간·hit geometry·resource 정책                            |

확장 항목은 삭제하지 않고 `planned/unsupported/deferred`와 이유를 남긴다. 기존 저작 기능에서 같은 문제가 재현되면 해당 부분은 현재 기능 수리로 옮긴다. CSS table 전체 확장을 보류해도 현재 Table 사용자의 정확도 결함까지 보류하는 것은 아니다.

## 8. 통합 실행 단계와 기존 Phase 대응

기존 P0~~P15와 혼동하지 않도록 통합 단계는 **U0~~U8**로 표기한다. 모든 단계는 계획 상태다. 기존 기능의 구현·검증 기록과 이번 단계의 착수 상태를 혼동하지 않는다. 이 의존성은 병렬 에이전트 실행 지시가 아니다.

| 단계 | 결과                                              | 기존 Phase 대응            | 의존성                                               |
| ---- | ------------------------------------------------- | -------------------------- | ---------------------------------------------------- |
| U0   | 후보·지원 manifest·source ledger·증거 재사용 판정 | P0, P2/P3의 인벤토리       | 없음                                                 |
| U1   | 기존 oracle 연결과 독립성 보강                    | P1                         | U0의 해당 fixture·환경                               |
| U2   | 현재 입력 누락·작은 페인트 결함 수리              | P2, P4/P5 일부, P7/P8 일부 | 해당 입력 계약과 U1의 필요한 비교 경로               |
| U3   | 레이아웃·텍스트·합성 정확도 수리                  | P4~P9의 현재 기능          | 기능별 U2 및 관련 oracle. 다른 확장 전체 완료 불필요 |
| U4   | paint bounds·effect 의존성과 증분 경로 보강       | P10/P11                    | U1 독립성 및 해당 paint 의미 확정                    |
| U5   | 상태·자원·저장·편집 흐름 통합                     | P12                        | 각 U2~U4 작업과 함께 검증, 종합 시 재점검            |
| U6   | 선택한 HTML/CSS 지원 확장                         | P2~P9/P12의 확장 부분      | 기능별 제품 범위·schema·consumer 계약                |
| U7   | 측정 기반 property state·자원 최적화              | P13, 조건부 P15            | 관련 정확도·수명 gate와 유효한 병목 증거             |
| U8   | 선택한 범위의 종결·지원표·후속 작업               | P14                        | 완료 대상으로 선택한 작업의 gate                     |

권장 첫 묶음은 U0/U1의 필요한 부분 → B1/B2·C01/C02 → X8 sticky·C03/C04 → G1/G2·F4·G3/G4/G7/G8이다. 정확한 순서는 최소 재현과 사용자 영향으로 정한다. C01의 작은 상수 수리에 전체 HTML manifest나 모든 최적화 하니스를 선행시키지 않는다. U4의 부분 렌더링 활성화에는 독립 fresh oracle이 필요하다.

### U0 — 후보와 증거 고정

- [ ] B/F/G/X 51행과 C/E 항목을 ledger에 등록하고 중복·의도적 제한·실제 노출 여부를 표시한다.
- [ ] authoring→catalog→resolver→engine/paint→DOM/Canvas 소비자를 속성·값·상태별로 적는다.
- [ ] Chromium SHA와 실제 Chrome 버전·OS·DPR·font·CanvasKit/backend를 별도로 고정한다. 최초 `main` 분석을 고정 SHA에서 재검증한 것처럼 기록하지 않는다.
- [ ] 기존 ADR-156·189·246·263~265의 fixture·artifact·HEAD·관련 diff·측정 모드를 확인한다.
- [ ] 유효한 증거는 재사용하고 누락·변경된 부분만 재현한다. baseline·목표·노이즈 판정을 구현 전에 정한다.

**완료 조건:** 모든 선택 항목에 owner 모듈·입력·상태·증거 수준·의존성·완료 기준이 있다. 구체 결함 후보를 “추후 조사”로 되돌려 누락시키지 않는다.

### U1 — 기존 하니스와 독립 oracle

- [ ] ADR-156 DOM geometry, G3 화면 비교, ADR-263/264 render-path 도구를 feature ID로 묶는다.
- [ ] 동일 authored document·resource generation에서 fresh catalog/layout/binding/command를 구성한다.
- [ ] picture·surface cache, spatial 후보 제한, 실행기 AABB 컬링을 각각 우회하는지 확인한다.
- [ ] 비교 기준은 수정본이 산출한 damage에 종속되지 않는다. visible surface 전체 또는 독립적으로 산출한 범위를 비교한다.
- [ ] damage 누락으로 렌더 프레임이 없는 경우도 scene/resource 변경 후 명시 checkpoint에서 검출한다.
- [ ] stale cache·누락 invalidation·잘못된 bounds·누락 후보를 주입해 각 검사가 실패하는지 확인한다.
- [ ] 최초로 다른 geometry·command·paint 단위를 찾는 진단 출력을 남긴다.

**완료 조건:** 이미 있는 비교 기능과 새로 보강한 독립성을 구분해 기록한다. full repaint만 실행한 결과를 full rebuild라고 부르지 않는다. 같은 backend의 결정적 비교와 DOM의 AA·폰트 차이를 분리한다.

### U2 — 입력 연결과 작은 정확도 수리

- [ ] B1/B2에 필요한 line-height·font baseline을 현재 측정 계약으로 전달한다.
- [ ] X8은 sticky/fixed를 나눠 직렬화·scroll owner·engine·paint 소비를 추적한다. 키 전달만으로 완료 처리하지 않는다.
- [ ] C01/C02의 입력 의미를 구분해 수리하고 외부 shadow 영역까지 비교한다.
- [ ] C03의 sampling을 입력별로 검증한다. 해상도별 decode cache 최적화는 별도 작업으로 둔다.
- [ ] C04를 font feature의 측정·렌더·무효화 계약으로 연결한다.
- [ ] 값 변경·Reset·Undo/Redo·재로드에서 수리 경로가 유지되는지 확인한다.

**완료 조건:** 원래 실패 fixture가 통과하고, 원복 RED 또는 동등한 원인 분리 검증이 있다. 수정은 같은 원인과 gate를 공유하는 범위로 묶는다. 커밋 수를 기계적으로 늘리지는 않는다.

### U3 — 레이아웃·텍스트·합성

- [ ] G1/G2의 minimum contribution, F4의 content suggestion을 실제 입력과 성능 조건으로 수리한다.
- [ ] G3/G4 span 기여, G7/G8 placement 순서·커서를 기존 성공 fixture와 함께 검증한다.
- [ ] X1~X7/X9/X14의 percentage·static position·ratio·font-relative 단위를 기능별로 처리한다.
- [ ] B3~B8/X10/F9의 line metrics·baseline·vertical-align을 측정·renderer·overlay와 연결한다.
- [ ] C05~C11은 실제 노출 값부터 처리하고 radius·stacking·clip·filter의 적용 순서를 고정한다.
- [ ] 남은 F/G 후보는 드물다는 이유만으로 미노출로 단정하지 않는다. authoring 재현 가능성에 따라 우선순위를 정한다.

**완료 조건:** 선택한 기능의 full/incremental layout이 같고 DOM geometry·text·paint가 기준과 일치한다. drag preview·commit·span·selection·IME 및 관련 저장 흐름에서 회귀가 없다.

### U4 — 실제 Paint Bounds와 증분 갱신

- [ ] layout/hit/self paint/subtree paint bounds를 분리한다. bounds는 empty/known/unknown, invalidation은 clean/partial/full로 표현한다.
- [ ] glyph·decoration·shadow·filter·overflow 자식의 영역과 transform·clip·effect 순서를 반영한다.
- [ ] 변경 전/후 영역, 그룹 isolation·순서 변경·backdrop 입력·mask/image 자원 의존성을 추적한다.
- [ ] 먼저 renderer 선택을 유지한 채 metadata를 계산·대조하고 정확성 확인 뒤 선택적으로 활성화한다.
- [ ] full/subtree/self build, preview/commit patch, translate/placeRegion, 삭제·reorder·reparent·page root·theme/breakpoint·font/image·context restore·dispose를 연결한다.
- [ ] hit index와 독립된 paint 후보·ID 수명을 정의한다. Rust index 인스턴스 재사용 가능성을 먼저 확인한다.
- [ ] 바깥 spatial 후보 검색과 안쪽 실행기 컬링을 함께 갱신하고 조상 state·합성 그룹·원래 paint 순서를 보존한다.
- [ ] command·bounds·index·resource가 같은 revision을 나타내게 한다. pending full·ping-pong 동기화·실패 시 full·flush 뒤 해제를 유지한다.

**완료 조건:** fresh 결과와 동치이며 화면 밖 상자의 shadow, 부모 밖 자식, 삭제·투명화·축소·clip 이동의 잔상/누락이 없다. unknown을 빈 영역으로 취급하지 않는다. 정확한 bounds가 있어도 effect closure를 구하지 못하면 fallback을 유지한다. 효과 포함 fixture에서 fallback 감소와 총비용을 함께 판정한다.

### U5 — 상태·자원·저장 통합

- [ ] 문서 상태·기존 state preview·breakpoint·theme·viewport·resource 완료의 적용 범위를 검증한다.
- [ ] 편집 preview→commit→Reset→Undo/Redo→autosave→IndexedDB→load→session read model→Canvas/DOM 경로를 확인한다.
- [ ] font/image 완료, source 교체·실패/재시도, context loss에서 사용자 편집 없이 다시 그려지는지 확인한다.
- [ ] 텍스트 편집 시작/종료·focus·selection·IME와 Canvas geometry를 대조한다.
- [ ] Preview iframe은 기존 origin 검증·postMessage 동기화를 사용한다.

**완료 조건:** 중간 표시 상태와 최종 저장 상태가 각각 맞고 재로드 후 같은 authored state가 복원된다. 파생 bounds/cache를 문서에 저장하지 않는다. 기본 상태 검증을 U5 종합 단계까지 미루지 않는다.

### U6 — 선택한 지원 확장

- [ ] E01~E07 중 구현 범위를 기능·값·조합으로 선택하고 미선택 항목의 이유·후속 조건을 남긴다.
- [ ] 새 schema·validation·default·migration·CSS generator·Canvas binding·DOM/RAC 영향이 있으면 함께 설계한다.
- [ ] 실제 authoring·저장·로드가 가능한 fixture로 검증한다. 엔진에만 값을 주입해 통과한 것을 제품 지원 완료라고 부르지 않는다.
- [ ] external content는 직접 paint·위임·fallback·unsupported 중 계약을 명시한다.

**완료 조건:** 선택한 확장 범위의 기능 gate를 통과한다. 부분 구현을 HTML/CSS 전체 지원으로 표현하지 않는다. 이 단계 전체는 현재 기능 수리의 공통 선행 조건이 아니다.

### U7 — 측정 기반 최적화

| 후보                           | 착수 근거                                                                   | 필수 확인                                                                                      |
| ------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| property-state 참조            | subtree translate·clip 복제·rect diff·index 갱신이 유의미한 병목            | local bounds·누적 transform·draw/hit/overlay 동기화, 비용이 pick/다음 프레임으로 이동하지 않음 |
| scale별 이미지 자원            | decode/upload·원본 해상도·live-set의 비용                                   | DPR/zoom별 품질·eviction·mip·자원 수명·재확대                                                  |
| tile raster cache              | viewport surface 이후에도 raster/flush가 주요 병목                          | seam·scale 전환·효과 경계·GPU 메모리                                                           |
| OffscreenCanvas/Worker         | Canvas 작업이 입력을 막거나 다른 main-thread 작업이 Canvas 표시를 막는 증거 | 메시지·atomic publish·overlay/input 지연·context 복구. React/RAC 자체 비용 감소와 구분         |
| Rust geometry/command planning | 관련 계산과 WASM 경계 비용이 production 상위                                | TS/Rust 동치·직렬화·소유권·번들 크기                                                           |
| 명령 바이너리화                | 기록·해석·전송의 독립적인 병목                                              | 버전·검증·디버깅·전송 계약                                                                     |

기존 성능 기록의 nested edit·zoom 재바인드·React/RAC selection 비용은 별도 원인으로 유지한다. property tree가 모든 꼬리를 해결한다고 가정하지 않는다. 관련 gate 이후에도 유효한 기준선을 사용하고 A/B로 개선을 판정한다.

**완료 조건:** 사전 목표를 충족하며 정확도·메모리·수명·번들 gate를 유지한다. 효과가 작거나 복잡성이 더 크면 근거를 남기고 보류한다. 조건부 최적화 미실행은 정확도 작업의 종결을 막지 않는다.

### U8 — 범위별 종결

- [ ] 선택한 기능을 verified/divergent/unsupported/deferred 등으로 정리하고 검증된 조합을 적는다.
- [ ] Canvas↔DOM, optimized↔fresh, full layout↔incremental layout의 세 축을 확인한다.
- [ ] 실제 Builder의 추가·편집·drag preview·resize·scroll·zoom·텍스트·Undo/Redo·저장/재열기를 영향 범위에 맞춰 확인한다.
- [ ] 해당 로컬 gate·성능·메모리·번들 결과와 실패·예외·미검증 범위를 보고한다.
- [ ] 지원표·source ledger·출처/notice·필요 CHANGELOG·후속 조건을 갱신한다.

**완료 조건:** 정확도 완료, 성능 목표, 미지원 범위를 독립적으로 판정한다. ADR-263~265의 기존 종결을 이 문서로 취소하거나 새 범위의 완료 증거로 확대하지 않는다.

## 9. 공통 검증 계약

### 9.1 세 비교축

| 비교                              | 검출 대상                                  | 한계                                                 |
| --------------------------------- | ------------------------------------------ | ---------------------------------------------------- |
| 최적화 Canvas ↔ 독립 fresh Canvas | cache·patch·bounds·culling·resource 누락   | 같은 CSS 의미 오류는 공유할 수 있음                  |
| Canvas ↔ DOM Preview              | layout·text·paint·합성 차이                | OS·font·AA·색 공간·backend 조건 통제 필요            |
| 구현 ↔ 표준·Chromium/WPT 사례     | 알고리즘 의미·edge case·브라우저 특이 동작 | catalog로 번역한 fixture 통과는 원본 WPT 통과가 아님 |

geometry·computed/used value·line metrics·픽셀·편집 결과를 함께 본다. 넓은 tolerance로 줄바꿈·위치·잔상을 숨기지 않는다. animation time·font/image readiness·DPR·zoom을 고정하고 기준 tolerance를 구현 후 유리하게 넓히지 않는다.

### 9.2 영향별 시나리오

- 값: 기본/비기본·유효/무효·단위·상속·Reset, standalone/group/instance/slot 내부.
- 레이아웃: 자식 있음/없음·definite/indefinite·nested flex/grid·span·overflow·fractional geometry.
- 페인트: light/dark·DPR 1/2·fractional zoom/위치·viewport 경계·그림자만 보이는 요소·clip/transform/filter 조합.
- 합성: 그룹 opacity/blend·배경 변경·mask 로딩·delete/reorder/reparent·페이지 이동.
- 텍스트: 한글/영문/emoji/RTL·긴 URL·variable font·fallback·loading 전후·좁은 폭·IME.
- 자원·상태: font/image 완료·실패/재시도·context restore·page 왕복·Undo/Redo·저장/재열기.

모든 작은 수정에 모든 조합을 반복하지 않는다. 수정의 의미·무효화·자원 수명에 닿는 항목을 선택하고 생략 이유를 기록한다.

### 9.3 성능

- 같은 production build 조건·fixture·resource 상태에서 기준선과 수정본을 교대로 측정한다.
- wall-clock profile과 call-count 계측은 별도 실행한다. flat/nested 600·5k를 기본 후보로 하고 필요할 때 10k를 추가한다.
- p95/p99·dropped frames·long task와 layout/binding/record/flush·후보 수·명령 수·index 갱신·cache miss·메모리를 구분한다.
- 기존 `p99 ≤ 20 ms`, `drop < 1%`는 같은 scenario일 때만 승계한다. 전체 HTML/CSS의 공통 budget으로 확장하지 않는다.
- cold/warm·WebGL/software를 구분한다. JS flush 호출 시간을 실제 GPU 실행 시간으로 보고하지 않는다.
- ratchet PASS·warning·lowerable·예외를 별도로 기록한다. 정확도 개선과 성능 미달은 각각 보고한다.

### 9.4 로컬 gate

- repo root에서 pnpm 스크립트를 사용한다.
- 변경 모듈의 인접 Vitest, TS 변경 시 `pnpm run codex:typecheck`.
- Rust 변경 시 관련 engine test와 `pnpm run wasm:build:engine`, 필요한 차등 gate.
- UI·상태·layout·paint 변경 시 foreground Builder와 Preview의 해당 흐름 확인.
- 기본 완료 gate는 `pnpm run codex:preflight`. 동시 변경이 있으면 `.agents/README.md`에 따라 소유 파일의 format check·guard 및 영향 검사만 수행한다.
- 포맷은 검사하고 무관한 dirty 파일을 수정하지 않는다. 문서 통합 자체에는 제품 typecheck·브라우저 실행 결과를 요구하거나 통과로 기록하지 않는다.
- commit/push는 별도 명시 요청이 있을 때만 수행한다.

## 10. 원문 추적·이식과 산출물

### 10.1 기능별 절차

1. 요소·속성·값·상태·단위·상속·viewport·font/resource 조건을 최소 fixture로 고정한다.
2. 고정 Chromium에서 parser/resolver→used value→layout/painter→Skia 호출까지 필요한 경로를 읽는다.
3. 인접 테스트와 WPT에서 정상·경계·실패 입력을 선택하고 revision·test ID를 기록한다.
4. 차이를 미노출·저장 누락·값 해석·layout·paint·invalidation·backend 제한으로 분류한다.
5. 독립 수식은 TS/Rust로 이식하고, Blink 객체 모델에 결합된 부분은 계약·테스트를 추출한다. CanvasKit 기존 API가 충분하면 그 API를 연결한다.
6. authoring부터 실제 consumer·history·저장/로드까지 연결하고 fixture·negative test로 증명한다.
7. 순회·할당·GPU layer·cache·resource 수명의 변화를 측정하고 지원표·출처를 갱신한다.

Chromium 전체를 단일 라이선스로 취급하지 않는다. 코드·테스트를 재사용할 때 파일별 license·third-party 의존성·notice를 확인한다. “상수와 분기만 옮기면 검토가 불필요하다”는 규칙은 두지 않는다. 이식 기록은 source ledger에 남긴다.

### 10.2 Feature ledger

```yaml
feature_id: layout.inline.baseline
source_candidates: [B1, B2]
scope: current-repair
support_status: divergent
evidence_level: code-confirmed
element_property_value_state: "block parent / atomic inline / mixed sizes"
spec_module_and_section: "착수 시 고정"
chromium_commit_path_symbol_test: "SHA / path / symbol / test ID"
license_and_notice: "파일별 확인"
composition_revision_and_diff: "HEAD / 관련 diff 또는 artifact"
producer_resolver_layout_paint_dom: "각 소비 경로와 owner 모듈"
port_strategy_and_differences: "입력 연결 / 계약 재구현 / API 연결 / 테스트 이식"
invalidation_and_resources: "font generation / layout / paint / cache"
fixture_and_negative_test: "최소 입력 / 원복 RED 또는 오류 주입"
geometry_text_pixel_live_evidence: "artifact / 환경 / 판정"
performance_memory_bundle_evidence: "기존 재사용 근거 또는 새 실측"
known_limits_and_reopen_trigger: "미검증 조합 / 후속 조건"
```

ledger의 파일 또는 typed registry 위치는 U0에서 기존 체계와 맞춰 정한다. 이 문서의 예시를 이미 존재하는 API나 완료된 데이터로 취급하지 않는다.

### 10.3 주요 수정 경계

| 축             | Composition 소유 모듈                                                                     | Chromium 탐색 시작점                                |
| -------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 입력·요소·상속 | shared catalog bindings/rules/resolution, `runtime/compositionRoot.ts`, generated CSS     | `core/html`, `core/css`, `core/style`               |
| Layout         | `packages/engine/src/{block,flex,grid,tree,display,style,cascade}.rs`                     | `core/layout`, `inline`, `flex`, `grid`, `table`    |
| Text           | catalog `textMeasure.ts`, `nodeRendererText.ts`, paragraph key, 편집 overlay              | `platform/fonts`, shaping, inline, text painter     |
| Paint          | `canvas/styleConversion/styleConverter.ts`, `skia/nodeRendererBorders.ts`, shapes/effects | box/outline/decoration painter, shadow data         |
| Image          | `nodeRendererImage.ts`, `imageCache.ts`                                                   | image painter, graphics sampling, `cc/tiles`        |
| Incremental    | Canvas binding, command patch/translate, renderer, spatial index                          | geometry mapper, raster invalidator, property state |

## 11. 참조와 종결 범위

- §5~§7: 후보와 지원 범위. §8~§10: U0~~U8 실행·검증 계약 및 기존 P0~~P15 대응. §12~§13: 함수 단위 근거와 수치 fixture.
- [Chromium 고정 snapshot](https://github.com/chromium/chromium/tree/33688427bc1a316cecb28d5651ad25208ba9ab53), [Blink layout](https://github.com/chromium/chromium/tree/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/core/layout), [Blink paint](https://github.com/chromium/chromium/tree/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/core/paint): 알고리즘·호출 순서·인접 테스트 참조.
- [Paint artifact·invalidation](https://github.com/chromium/chromium/tree/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/renderer/platform/graphics/paint), [Blink web tests](https://github.com/chromium/chromium/tree/33688427bc1a316cecb28d5651ad25208ba9ab53/third_party/blink/web_tests): U1/U4 검증과 사례 추출.
- [CSS 2.1](https://www.w3.org/TR/CSS2/), [CSS Snapshot 2025](https://www.w3.org/TR/css-2025/), [HTML Living Standard](https://html.spec.whatwg.org/multipage/): 의미·기능군 분류. 구현 착수 시 해당 절·버전·조회일 고정.
- [CanvasKit 문서](https://skia.org/docs/user/modules/canvaskit/), [CanvasKit 0.42.0 bindings](https://github.com/google/skia/blob/canvaskit/0.42.0/modules/canvaskit/canvaskit_bindings.cpp): 공개 API와 설치 타입·실행 결과 대조.
- [ADR-263](../../adr/completed/263-render-command-patch-execute-cost.md), [ADR-264](../../adr/completed/264-moved-subtree-translate-page-grid-rebind.md), [ADR-265](../../adr/completed/265-document-layer-edit-select-cost.md): 기존 종결 범위·측정·재개 조건.

이 통합본이 완료한 것은 후보 정리, 상충 판정의 조정, 범위·의존성·검증 계약의 작성이다. 제품 결함 수리, 전체 51행의 실행 재현, 성능 개선 및 확장 기능 지원은 이 문서 작성으로 완료되지 않았다.

## 12. 레이아웃 함수 단위 근거와 수치 fixture

이 절은 2026-10-16 초기 레이아웃 분석의 상세 근거를 보존한다. **표의 Chrome/엔진 수치와 노출 가능성은 당시 분석의 보고이며, 이번 통합에서 실행한 결과가 아니다.** yes/가능은 초기 분석의 입력 노출 판정이다. 현재 지원 상태·실행 증거 수준은 §2~§5를 따른다. 오류나 조건 누락이 확인되면 수치도 수정하며, 초기 분석에 있었다는 이유로 oracle로 채택하지 않는다.

파일 약칭은 다음 경로를 기준으로 한다. 줄 번호는 초기 조사 시점의 탐색 힌트이며 symbol과 호출부를 우선 확인한다.

- Rust: packages/engine/src/의 block.rs, flex.rs, grid.rs, tree.rs, style.rs, cascade.rs, display.rs.
- 직렬화: packages/shared/src/catalog/runtime/compositionRoot.ts의 styleOf·itemLayout.
- Builder: apps/builder/src/builder/workspace/canvas/의 layout/, utils/textMeasure.ts, skia/renderCommands.ts.
- catalog 측정: apps/builder/src/builder/catalogRuntime/textMeasure.ts. Canvas 2D fallback과 구분한다.
- Blink: third_party/blink/renderer/core/layout/ 기준. computed_style.cc는 core/style/, 폰트 metrics는 platform/fonts/, css_properties.json5는 core/css/, UA 시트는 core/html/resources/.
- Blink 최초 대조는 당시 main에 대한 보고다. 고정 SHA에서도 같은 코드인지 확인하기 전까지 해당 줄 번호를 고정 revision의 직접 증거로 표시하지 않는다.

### 12.1. Block·inline·baseline

| #   | 축                                | composition                                                                                                                                                                                                    | Blink                                                                                                                                                                                                            | fixture                                                                                                      | 재현    |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------- |
| B1  | strut (컨테이너 line-height 하한) | `block.rs:440-455` `strut_line_height >= 0` 일 때만 참여. production 은 `styleOf` 가 `lineHeight` 를 엔진 키로 안 내보내 (`compositionRoot.ts` — 텍스트 binding `:743` 에만) `tree.rs:4053` → -1 → **strut 0** | `inline_box_state.cc:346-353 OnBeginPlaceItems` 모든 line box 에 strut (`ComputeTextMetrics` + `CalculateLeadingSpace`, ascent 쪽 leading `Floor()` `line_utils.cc:35-44`)                                       | `display:block; line-height:24px` 안 `inline-block` 12px → Chrome 24 / 엔진 12                               | **yes** |
| B2  | atomic inline 의 baseline         | `tree.rs:2248-2255` `leaf_baseline` 입력에서만; 생산 지점은 `layoutTypes.ts:197` 타입 선언뿐 (`78469745d` 가 `f1ec24e53` · `3a1b3200d` 공급 삭제) → `block.rs:269` bottom margin edge 폴백                     | `line_breaker.cc:3130-3133` atomic inline `kInlineBlock` baseline · `block_layout_algorithm.cc:3802-3860` 마지막 line box / block 자식 baseline 전파 · `logical_box_fragment.cc:59-63` 없을 때만 margin box 바닥 | block frame 안 size S Button (h24 · baseline ≈17) + size L (h40 · ≈27) → Chrome 글자선 정렬 / 엔진 바닥 정렬 | **yes** |
| B3  | `line-height: normal` 값          | Canvas2D 폴백 `textMeasure.ts:438-452` `fontBoundingBoxAscent + Descent` (lineGap 없음 · 반올림 없음) · CanvasKit 경로 `paragraph.height`                                                                      | `computed_style.cc:2417-2421` → `FontMetrics::LineSpacing()` = `lroundf(ascent) + lroundf(descent) + lroundf(line_gap)` (`simple_font_data.cc:176-178`)                                                          | 자기 · 조상 모두 lineHeight 없는 Text                                                                        | unknown |
| B4  | `vertical-align: middle`          | `block.rs:463-468 · 497-501` margin box 중심을 baseline 에 (x-height 0)                                                                                                                                        | `inline_box_state.cc:1339-1346` `(ascent − descent)/2 − xHeight/2`                                                                                                                                               | 16px 폰트 부모 안 `inline-block; height:40px; vertical-align:middle` → Chrome ≈4px 위                        | **yes** |
| B5  | line box `text-align`             | `block.rs:191 · 288-303` 왼쪽 고정, `NodeStyle` 에 `text_align` 없음                                                                                                                                           | `inline_layout_algorithm.cc:373 · 937-963` `ApplyTextAlign`                                                                                                                                                      | block frame `textAlign:center` + inline-flex Button                                                          | unknown |
| B6  | `white-space: nowrap` 줄바꿈 억제 | `block.rs:272` 무조건 wrap; `whiteSpace` 는 경계에서 버림 (`tree.rs:397`)                                                                                                                                      | `line_breaker.cc:1183-1188` `if (!auto_wrap_) return false`                                                                                                                                                      | width 100 nowrap frame 에 50px inline-flex 셋                                                                | unknown |
| B7  | first vs last baseline            | `NodeLayout.baseline` 하나 = last (`tree.rs:4110-4168`), flex `align-items: baseline` 도 이 값 (`:6366`)                                                                                                       | `block_layout_algorithm.cc:3808-3810` `SetFirstBaseline` + `SetLastBaseline` 분리                                                                                                                                | flex row baseline 안 2줄 Text block                                                                          | unknown |
| B8  | scroll container baseline clamp   | `tree.rs:4143-4155` 자식 baseline 그대로 전파                                                                                                                                                                  | `logical_box_fragment.h:49-52 · 66-69` `IsScrollContainer` 면 `clamp(0, BlockSize)`                                                                                                                              | `overflow:hidden; height:10px` 안 24px 줄                                                                    | unknown |

### 12.2. Flex

| #   | 축                                           | composition                                                                                                                                                                                                 | Blink                                                                                                                                                                            | fixture                                                                                                   | 재현                                                    |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| F1  | §9.7 flex factor 합 < 1                      | `flex.rs:758-762` **매 라운드 remaining** × grow_sum, 크기 비교 없음 (shrink `:776-780` 동형)                                                                                                               | `line_flexer.cc:99-104` `fractional = initial_free_space × total_flex_factor; if (abs(fractional) < abs(free_space)) free_space = fractional` — **initial free space** · 작은 쪽 | width 100 > A `flex:.3 1 0; max-width:10px` · B `flex:.3 1 0` → Blink B 30 / 엔진 27                      | 가능 (Styles `flexGrow` 소수) · 드묾                    |
| F2  | §8.1 main auto margin + 음수 여유            | `flex.rs:1153-1155` auto margin 하나라도 있으면 부호 무관 justify 무효                                                                                                                                      | `flex_layout_algorithm.cc:1877-1888` `main_axis_auto_margin_count && free_space > 0` 일 때만; 음수면 justify center/end 동작                                                     | width 100 `justify-content:center` > `width:300px; margin-left:auto` → Blink x −100 / 엔진 0              | 가능                                                    |
| F3  | `align-content: space-evenly`                | `tree.rs:5610-5623` arm 없음 → 0 = stretch (`flex.rs:205-216` 상수 없음)                                                                                                                                    | `:1717-1736` `kSpaceEvenly: free / (n + 1)`                                                                                                                                      | wrap · height 200 · space-evenly · 2줄 × 50 → Blink y 33.3 / 116.7 · 엔진 줄 높이 100                     | 가능 (`layout.alignContent` 텍스트)                     |
| F4  | §4.5 row definite item 의 content suggestion | `flex.rs:376-394` definite 주축 item 은 스칼라 (off 19) 가 있을 때만 floor; `tree.rs:3148-3151` 2-b 가 `data[off+1] != -1` 이면 min-content 측정 생략 (ADR-204 perf 이연 주석) → 자식 보유 item 자동 최소 0 | `:1027-1109` 모든 non-scroll item 에 `specified_size_suggestion` · `content_size_suggestion` 둘 다 구해 `min`                                                                    | width 200 > `div{width:200px}` ×2 각 min-content 150 → Blink 150/150 (넘침) / 엔진 100/100                | **가능** — 고정 폭 Button/Frame 이 좁은 row 에서 shrink |
| F5  | §4.5 column definite item 범위               | `tree.rs:3225-3241` 자식 border-box 아래만 (bottom margin 제외, 주석 "보수적")                                                                                                                              | `:936-947` `IntrinsicBlockSize()` = BFC root content 높이 (마지막 자식 bottom margin 포함)                                                                                       | column height 100 > item `height:80` ⊃ `height:60; margin-bottom:30` · item 80 → Blink 80/20 · 엔진 60/40 | 가능 · 드묾                                             |
| F6  | `row-gap` `%` 기준 축                        | `tree.rs:2901-2902` 둘 다 content **폭**                                                                                                                                                                    | `:156-160 · 186-190` row-gap 은 **block** 크기                                                                                                                                   | wrap 400×200 `row-gap:10%` → Blink 20 / 엔진 40                                                           | 어려움 (`visual.gap` 은 px)                             |
| F7  | `flex-basis` intrinsic 키워드                | `tree.rs:7197-7200` `fit-content` → CONTENT(max-content), `min-content`/`max-content` → auto                                                                                                                | `:1009-1016` → `length_utils.cc:113-117` `kMinContent` = min · `kFitContent` = clamp                                                                                             | `flex-basis:min-content; flex-shrink:0` "aaa bbb" → Blink 30 / 엔진 60                                    | 가능 · 드묾                                             |
| F8  | `justify-content: start/end/right` + reverse | `tree.rs:5502-5513` start = flex-start 로 접은 뒤 reverse 를 기하 반사                                                                                                                                      | `:1693-1704` `kStart` 는 reverse 무시 · `:228-236` column 의 `left/right` → start                                                                                                | `row-reverse; justify-content:start` → Blink x 0 / 엔진 200                                               | 가능 · 드묾                                             |
| F9  | `last baseline`                              | `tree.rs:5528 · 5559` first 그룹으로 접음, 슬롯 21 은 first baseline 뿐                                                                                                                                     | `:376-399` `LastBaselineOrSynthesize` · `BlockSize − baseline` · `:1997-2006` minor 그룹 cross-end                                                                               | `align-items:last baseline` 2줄 + 1줄                                                                     | 가능 · 드묾                                             |
| F10 | `%` min-size + indefinite base               | `tree.rs:5236-5243` −1 센티넬 × % → 음수 → `None` → AUTO → §4.5 켜짐                                                                                                                                        | `length_utils.cc:200-213` `kMin` 이면 base 0 → min 0 · `HasAuto()` false 라 자동 최소 없음                                                                                       | column `max-height:100px` > item ×2 content 80 `min-height:10%` → Blink 50/50 / 엔진 80/80                | 가능 · 드묾                                             |
| F11 | 반올림                                       | f32 · `RESOLVE_EPS 0.5` (`tree.rs:3323 · 3570 · 3639`)                                                                                                                                                      | `LayoutUnit` 1/64 px · `LayoutUnitDiffuser` 나머지 흩뿌림                                                                                                                        | `flex:1` ×3 in 100 → Blink 33.328/33.344/33.328 · 엔진 33.333 ×3                                          | 서브픽셀만                                              |

### 12.3. Grid

| #   | 축                                             | composition                                                                                                        | Blink                                                                                                                                                                                                 | fixture                                                                                                          | 재현                                                         |
| --- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| G1  | 최소 기여 — 명시 `min-width: 0`                | `tree.rs:1356-1357` `w = w.max(mn)` 올리기만; `col_contribution` (`:1458-1461`) 은 min-content 를 base 로          | `grid_layout_utils.cc` `CalculateIntrinsicMinimumContribution`: `!min_length.HasAuto()` 면 **min-width 를 그대로 해소** (0 이면 0 + pad/border/margin)                                                | `width:200px; 1fr 1fr` · A `min-width:0` + 텍스트 min-content 150 · B 50 → Blink 100/100 / 엔진 150/50           | **yes** — 1fr 열 텍스트 말줄임 표준 패턴                     |
| G2  | 최소 기여 — scroll container                   | `measure_intrinsic_width` (`:1687~`) 에 overflow 판정 없음                                                         | 같은 함수 `is_track_scroll_container` (`IsOverflowValueScrollableInline`) → auto min = 0                                                                                                              | 위 A 를 `overflow:hidden` 으로                                                                                   | **yes**                                                      |
| G3  | span 아이템이 fr 트랙을 지날 때 (§12.5 step 3) | `tree.rs:6024` `.filter(!any(flex))` — 기여 자체를 버림 (정해진 축)                                                | `ResolveIntrinsicTrackSizes` 가 flex 를 지나는 아이템을 마지막에 처리 · `DistributeExtraSpaceToSets` 가 flex factor 비례로 fr base 를 키움 → `ExpandFlexibleTracks` 가 base > 몫 트랙을 inflexible 로 | 600 · `repeat(3,1fr)` · `width:500px; span 2` → Blink 250/250/100 / 엔진 200/200/200 (넘침)                      | **yes** — 2026-10-16 「grid 칸이 늘어난다」 수정이 반대 극단 |
| G4  | span 기여를 고정 트랙에도 균등 분배            | `tree.rs:6036-6037 · 6081-6082` `sizes[i] += extra / count` px 포함 (정해진 축은 몫 증발 · 미결정 축은 px 가 커짐) | `IsContributionAppliedToSet`: intrinsic minimum 은 `HasIntrinsicMinTrackBreadth()` 세트에만 · growth limit 먼저                                                                                       | `100px auto` + span-2 300 → Blink auto 200 / 엔진 100 · rows `30px auto` + span-2 100 → Blink 30/70 / 엔진 65/35 | **yes**                                                      |
| G5  | 역순 라인 `3 / 1`                              | `grid.rs:947` `(Some(s), Some(e)) => (Some(s), (e−s).max(1))` → 라인 3 · span 1                                    | `grid_line_resolver.cc` `if (end < start) swap`                                                                                                                                                       | `grid-column: 3 / 1` → Blink 1~2열 / 엔진 3열 1칸                                                                | **yes**                                                      |
| G6  | 없는 라인 이름                                 | `tree.rs:5194-5200` · `grid.rs:144` → `None` → auto 배치                                                           | `LookAheadForNamedGridLine` — 명시 grid 다음 암묵 라인으로                                                                                                                                            | `[a] 1fr [b] 1fr` · `grid-column-start: zzz` → Blink 3열 / 엔진 1열                                              | yes (손 입력)                                                |
| G7  | 배치 step 1 ↔ 2 순서 · 행별 minor 커서         | `grid.rs:1190-1205` source 순서로 양축 · 행 확정 아이템 섞음 · `first_free_col` (`:996`) 항상 1열부터              | `grid_placement.cc` `PlaceNonAutoGridItems` → `PlaceGridItemsLockedToMajorAxis` 행별 `minor_cursors`                                                                                                  | child1 `grid-row:1`, child2 `grid-row:1; grid-column:1` → Blink child1 2열 / 엔진 둘 다 1열 **겹침**             | **yes**                                                      |
| G8  | 커서 — definite col < cursor → 다음 행         | `grid.rs:1260-1266` 규칙 없음 (`:1178` 주석은 있다고 적음)                                                         | `AutoPlacementCursor::MoveToMinorLine` `if (minor < current) ++major`                                                                                                                                 | 3열 [auto, `grid-column:3`, `grid-column:2`] → Blink 셋째 (2행,2열) / 엔진 (1행,2열)                             | **yes**                                                      |
| G9  | content 정렬 overflow (unsafe 기본)            | `grid.rs:1318` `free <= 0.5` → start                                                                               | `ComputeFirstSetGeometry` `kSafe` 아니면 음수 허용 → center `free/2`                                                                                                                                  | 300 · `400px` · `justify-content:center` → Blink x −50 / 엔진 0                                                  | **yes**                                                      |
| G10 | `space-between` 단일 트랙                      | `grid.rs:1328` `(free/2, 0)` center                                                                                | `if (track_count < 2 …) return` — start                                                                                                                                                               | 300 · `100px` · space-between → Blink 0 / 엔진 100                                                               | **yes**                                                      |
| G11 | `safe …` · `left` · `right`                    | `grid.rs:1340` `_ => (0, 0)`                                                                                       | left/right → start/end · safe 는 clamp 만                                                                                                                                                             | `justify-content:right` 여유 200 → Blink 200 / 엔진 0                                                            | yes                                                          |
| G12 | `row-gap` `%` 축                               | `tree.rs:4323` 폭 기준                                                                                             | `CalculateGutterSize` row 는 block                                                                                                                                                                    | 400×200 `row-gap:10%` → 20 / 40                                                                                  | yes (% gap)                                                  |
| G13 | 행 축 auto-fit collapse                        | `tree.rs:4371` 범위 버림 · `:4390` collapse 는 col 만                                                              | `GridRangeBuilder::FinalizeRanges` 양축                                                                                                                                                               | `height:300px; repeat(auto-fit,50px)` rows · 아이템 2 · `align-content:end`                                      | 드묾                                                         |
| G14 | auto-repeat — 미결정 축 + definite min/max     | `grid.rs:287 · tree.rs:4355` 컨테이너 ≤ 0 → 1                                                                      | `CalculateAutomaticRepetitions` indefinite 면 `min_available_size`                                                                                                                                    | flex row 안 `min-width:450px; repeat(auto-fill,100px)` → Blink 5 / 엔진 1                                        | 드묾                                                         |
| G15 | `0fr`                                          | `grid.rs:208 · tree.rs:5917` → 1fr 폴백                                                                            | factor 0 세트는 inflexible, base 그대로                                                                                                                                                               | `1fr 0fr` → Blink 300/0 / 엔진 150/150                                                                           | 드묾                                                         |
| G16 | aspect-ratio 아이템 + implicit stretch         | `tree.rs:4905-4912 · 6581 · 6845` 양축 stretch                                                                     | `length_utils.cc` `ComputeBlockSizeForFragmentInternal`: explicit stretch → ratio → implicit stretch 순                                                                                               | cols 200 rows 300 · `aspect-ratio:2` → Blink 200×100 / 엔진 200×300                                              | **yes** (ADR-224)                                            |
| G17 | intrinsic 0 아이템 강제 stretch                | `tree.rs:6581` `\|\| real_size <= 0`                                                                               | `AxisEdgeFromItemPosition` start 그대로 (폭 0)                                                                                                                                                        | 빈 div `justify-self:start`                                                                                      | yes — ADR-156 §Residual 의도적 폴백                          |
| G18 | 반올림                                         | f32 · 여유 ≤ 0.5 무시                                                                                              | `LayoutUnit` + `leftover_size` 이월                                                                                                                                                                   |                                                                                                                  | 서브픽셀만                                                   |

### 12.4. Box·position·단위

| #   | 축                                                                 | composition                                                                                                                                                                                                                                                                                        | Blink                                                                                                                                                                           | fixture                                                                                                      | 재현                                                               |
| --- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| X1  | relative `%` inset 기준 (가로)                                     | `tree.rs:2332 · 2470` `ctx_for(avail_w)` = 부모에게서 받은 available (= 조부모 content 폭)                                                                                                                                                                                                         | `relative_utils.cc:18-40` containing block (부모) content box                                                                                                                   | 부모 `width:200px; padding:50px` 가 content 1000 조상 안 · 자식 `relative; left:50%` → Chrome 50 / 엔진 ≈500 | 가능 (Styles `position` + `left`)                                  |
| X2  | relative `%` inset 기준 (세로 · auto 높이)                         | `tree.rs:2471` `ctx_for(container_h)` — 배치 끝난 `ch` 라 항상 definite                                                                                                                                                                                                                            | `:33-35` `HasPercent && size == kIndefinite → nullopt` (0)                                                                                                                      | auto 부모 (내용 400) 안 `relative; top:50%` → Chrome 0 / 엔진 200                                            | 가능                                                               |
| X3  | absolute static position — flex/grid 부모                          | `tree.rs:2568-2590` 부모 display 무관 block 근사 (`static_x = pb_start_x` · 선행 형제 누적 하단)                                                                                                                                                                                                   | `flex_layout_algorithm.cc:509-600` `HandleOutOfFlowPositionedItems` — justify/align 으로 "sole flex item" 위치, 형제 무관                                                       | flex center 400×200 + 형제 h50 + absolute 40×40 → Chrome (180, 80) / 엔진 (0, 50)                            | 가능 (Styles `absolute`, inset 없음)                               |
| X4  | absolute static position — 선행 형제 margin-bottom                 | `tree.rs:2585` border-box 하단만                                                                                                                                                                                                                                                                   | `block_layout_algorithm.cc:1696-1703` `+= margin_strut.Sum()`                                                                                                                   | 형제 `height:50; margin-bottom:30` 뒤 absolute → Chrome y 80 / 엔진 50                                       | 가능                                                               |
| X5  | absolute 양측 inset + 명시 크기 + `margin:auto` · 음수 잉여 (가로) | `tree.rs:7003-7012` 부호 무관 반분                                                                                                                                                                                                                                                                 | `absolute_utils.cc:299-313` 가로 음수면 start 0                                                                                                                                 | cb 200 · `left:0; right:0; width:300px; margin:0 auto` → Chrome x 0 / 엔진 −50                               | 가능 (`margin: 0 auto` 텍스트)                                     |
| X6  | aspect-ratio 자동 최소 높이 (§5.2.2) — leaf                        | `tree.rs:2160-2172` `floor_applies = !children.is_empty() && …` → leaf 는 content 하한 없음 (`:2232-2236`)                                                                                                                                                                                         | `length_utils.cc:845-862 · 886` 자식 유무 조건 없음 — `MinIntrinsic`                                                                                                            | Text `width:120px; aspect-ratio:4` 3줄 (content 60) → Chrome 60 / 엔진 30                                    | 가능 (Styles `aspectRatio`)                                        |
| X7  | aspect-ratio 전송 min/max (§5.2.1)                                 | 없음 — `tree.rs:2088-2095` 자기 축 min/max 만 · `:2164 · 2177` 크기만 전송                                                                                                                                                                                                                         | `length_utils.cc:695-735` `ComputeTransferredMinMaxInlineSizes/BlockSizes`                                                                                                      | block leaf `width:auto (400); aspect-ratio:2; max-height:100px` → Chrome 200×100 / 엔진 폭 400               | 가능 (`maxHeight`)                                                 |
| X8  | `position: sticky` · `fixed`                                       | `compositionRoot.ts:1265-1270` `relative` · `absolute` 만 전송 → sticky/fixed 는 in-flow static. Canvas 보정 `renderCommands.ts:1644-1700` 이 읽는 `isSticky · stickyTop` 은 **생산자 0** (`stickyResolver.ts` 타입뿐). 보정이 돌아도 top/left 만 · `containerBottom = parent.height` (border-box) | `layout_box_model_object.cc:596-690` containing block = padding box − padding (content) · sticky 요소 margin 제외 · 양쪽 inset · 공간 부족 시 `max_inset += free`               | `overflow:auto; height:200px; padding-bottom:40px` 안 `sticky; top:0` 헤더 → Preview 고정 / Canvas 흘러감    | **yes** — rule 2건 (`componentRulesTable.ts:5599 · 6903`) + Styles |
| X9  | `em` · `ch` · `ex`                                                 | `tree.rs:5236-5244` `parent_size: None, root_font_size: None` → `style.rs:349-355` `em` = 16 고정 · `rem` 16 · `ch/ex` = fontSize × 0.5                                                                                                                                                            | `em` = 자기 computed font-size (font-size 만 부모) · `ch` = "0" advance · `ex` = x-height · `rem` = root                                                                        | `fontSize:24` `width:2em` → Chrome 48 / 엔진 32 · `10ch` → ≈9x / 80                                          | 가능 (`width` 텍스트 통과 — `maxWidth` 의 `ch` 만 측정)            |
| X10 | `vertical-align` 키워드 범위                                       | `tree.rs:6903-6910` top · middle · bottom 외 전부 baseline                                                                                                                                                                                                                                         | `css_properties.json5` `sub · super · text-top · text-bottom · <length> · <percentage>`                                                                                         | `vertical-align: text-bottom` / `-6px`                                                                       | 가능 (`verticalAlign` ITEM_LAYOUT)                                 |
| X11 | 초기값 표 (`outline-color` · `border-*-color/width`)               | `cascade.rs:81-134` `borderColor #000 · borderWidth 0 · outlineColor invert`                                                                                                                                                                                                                       | `currentColor` · `3 (medium)` · `currentColor`                                                                                                                                  | `border-color: initial`                                                                                      | 낮음 — dormant 표 (production 호출 0)                              |
| X12 | 상속 표 누락                                                       | `cascade.rs:57-78` 17종 — `textShadow · cursor · userSelect · tabSize · direction · writingMode · hyphens · fontFeatureSettings · …` 없음                                                                                                                                                          | 전부 `inherited: true`                                                                                                                                                          | 부모 `text-shadow` 자식 Text                                                                                 | 낮음 — dormant (상속은 catalog resolver)                           |
| X13 | UA 시트 — publish 리셋 범위                                        | `apps/publish/src/styles/index.css:17-24` `box-sizing` + `margin: 0` 만 (padding · border 리셋 없음)                                                                                                                                                                                               | `html.css:876-889 button padding 1px 6px · border 2px outset` · `:488-500 input` · `:463-476 textarea` · `:1221 select` · `:320 ul padding-inline-start 40px` · `:396 fieldset` | 생성 CSS 가 padding · border 를 덮지 않는 `<button>` · `<input>` 등이 publish 에 있으면 UA 값이 남는다       | 조건부 — publish 한정, 요소별 미확인                               |
| X14 | aspect-ratio 전송값의 pad/border 하한                              | `tree.rs:2164 · 2177` 하한 없음                                                                                                                                                                                                                                                                    | `length_utils.cc:281-290` `max(border_padding, …)`                                                                                                                              | `height:20; aspect-ratio:.5; padding:0 20px` → Chrome 40 / 엔진 10                                           | 낮음                                                               |

### 12.5. 초기 분석에서 일치한다고 보고한 경로

다음은 변경 시 보존할 회귀 범위다. 함수 대조 결과이며 모든 입력 조합의 제품 검증을 뜻하지 않는다.

**Block·inline·baseline**

margin collapse 집합 (`margin_strut.cc:22-33` ↔ `block.rs:524-557`) · 부모-자식 top collapse 차단 (block-start border/padding · 새 FC — `block_layout_algorithm.cc:905-915` ↔ `tree.rs:3963`) · bottom 차단 (padding · 새 FC · definite block-size · min/max 바인딩 — `:1316-1377 · 1471-1483` ↔ `tree.rs:3981-3982 · 4185-4194`) · self-collapsing 판정 · 위치 (`:1497-1506 · 3134-3150` ↔ `tree.rs:4252-4258` · `block.rs:329`) · BFC 자식의 margin 은 형제 · 부모와 collapse (`:1895-1902 · 2953-3006` ↔ `block.rs:359-381`) · line box 가 margin 을 끝냄 (`inline_layout_algorithm.cc:1504-1509` ↔ `block.rs:280-286`) · atomic inline 은 margin box 로 참여 · scroll container inline-block → block-end margin edge, clip 제외 (`:3851-3857` + `physical_box_fragment.h:170-174` ↔ `tree.rs:3999-4003 · 6281-6284`) · vertical-align top/bottom (`inline_box_state.cc:1448-1458` ↔ `block.rs:461-476`) · inline-block auto 폭 = shrink-to-fit (`tree.rs:1795-1803`) · 인접 atomic inline 사이 break 기회 · quirks 무관 (`<!doctype html>`).

**Flex**

flex-basis 해소 순서 (명시 → width → aspect 전송 → content · `%` + indefinite → content) · §4.5 scroll container → 0 (`:423-452` ↔ `flex.rs:371-375` + `tree.rs:6273-6283`) · max-main clamp (`length_utils.cc:779-782` ↔ `flex.rs:403`) · §9.7 동결 기계 전부 (방향 · inflexible · shrink 가중 · violation · min 이 max 를 이김) · §9.3 라인 수집 (`flex_line_breaker.cc:276-285 · 413-415` ↔ `flex.rs:853-862`) · align-content (nowrap 무효 · stretch 는 여유 ≥ 0 · space-* 음수 폴백) · stretch 조건 (cross auto · 미해소 `%` 는 stretch 아님 csswg #4312 · 단일 라인 definite cross) · cross 축 auto margin · main 축 auto margin (양의 여유) · `%` main + indefinite · baseline 그룹 (first) · safe 접두 · 음수 grow/shrink → 0.

**Grid**

fr 가상 크기 루프 (`grid.rs:455-584` ↔ `ExpandFlexibleTracks`) · 단독 `fr` = `minmax(auto, fr)` · 미결정 축 fr · auto 트랙 min/max + §6.6 clamp (Chrome 실측 4줄 일치) · §12.6 maximize · §12.8 stretch auto · auto-fill/auto-fit 개수 식 · 열 축 auto-fit collapse · 미결정 컨테이너 `%` 트랙 → auto · `%` gap 미결정 → 0 · column gap 포함 · 라인 해소 (`-1` · `span N / span M` · `auto / N` · `N / N` · 라인 0) · 명시 크기 · intrinsic 키워드가 stretch 를 이김 · auto margin safe · 셀 넘침 미절단 · 암묵 트랙 순환 · fully-auto sparse 커서 · §12.1 순서.

**Box·position·단위**

min/max clamp 순서 (`min_max_sizes.h:52-54` ↔ `tree.rs:2102-2109 · 6641-6650 · 6990-6999`) · `%` 블록 크기 + 미확정 cb (`length_utils.cc:200-220` ↔ `resolve_dimension_opt`) · `%` 인라인 + 미확정 · `min-width/height: auto` = 0 (block) · `fit-content` 공식 · absolute 양측 inset + auto 크기 → stretch · clamp 순서 · 한쪽 auto margin 흡수 · over-constrained start 유지 · 양측 inset auto → static · absolute cb = padding box · relative 충돌 해소 · blockify (`style_adjuster.cc:773-777 · 251-300` ↔ `display.rs:132-139`) · BFC 원인 · box-sizing (Preview · publish 가 `*` 에 border-box · Styles 에 `boxSizing` 키 없음 → content-box 문서 불가 → 결과 동일) · `display: none · contents` · atomic inline 판정 · 초기값 (`line-height normal · white-space · overflow · position · z-index · display inline`).

### 12.6. 초기 미지원·제한 보고와 추가 확인

현재 지원 판정은 기능별 ledger에서 정한다. 아래는 초기 코드 헤더와 조사에서 나온 제한이며, §5의 후보와 겹치는 항목은 실제 노출 여부로 재분류한다.

- block: float · clear · writing-mode · 다단 (`block.rs:34-37`) · 순수 `inline` 혼합 (`tree.rs:6845-6849` "S4 까지") · `vertical-align` 확장 키워드 (`tree.rs:6901-6902` "capability matrix seed") · strut 실폰트 채널 "S4/Phase 5" (`block.rs:426-428`).
- flex: `transfer_aspect_basis_from_stretch` 의 wrap 제외 (`flex.rs:634-639`) · column 방향 baseline 그룹 (`:584`) · `order` (`layout-engine.md` — `NodeEntry.children` 이 정본) · content-box (`tree.rs:6322-6329` 전역 border-box 계약) · `contain: size` · `flex-wrap: balance` (NodeStyle 부재).
- grid: subgrid · dense 역채움 · baseline 정렬 (`grid.rs:25-29`) · 명시 grid 앞쪽 암묵 트랙 (`grid.rs:906`) · 암묵 라인 이름 · `grid-template-areas` (파서는 있으나 `tree.rs` 가 `""` 로 넘김 — NodeStyle 에 area 필드 없음) · `MAX_GRID_LINE` 10,000.
- box: `position: fixed` viewport 기준 (`layout-engine.md:67` — 단, 실제는 absolute 근사가 아니라 in-flow static) · absolute 조상 체인 (위치 미지정 부모) · `vw/vh` = page 크기 (`set_viewport`) · table · list-item display → block 폴백 (`display.rs:71-93`).

추가 확인 항목:

- 부모 line-height:24px와 자식의 다른 font-size 조합: 길이 상속과 숫자 배율 상속을 구분한다. Styles 저장 표현과 DOM 출력까지 확인한다.
- Blink AlignBlockContent, ResolveInlineAutoMargins, ConstrainByMinMax는 초기 조사에서 호출 위치만 확인한 부분이다.
- absolute containing block의 조상 체인과 Blink ContainingBlockInfo 생성부를 확인한다.
- publish reset은 요소별 generated CSS가 padding/border를 덮는지 실제 computed style로 확인한다.
- flex.rs의 aspect-ratio/align-self/auto margin 미구현 헤더, grid.rs의 intrinsic track 미구현 헤더, tree.rs의 auto-repeat·line-height 전송 주석, fixed를 absolute 근사라고 적은 규칙은 현재 코드와 대조해 정리한다. 주석 정정은 기능 수리 완료의 증거가 아니다.

## 13. 페인트 참조 지도와 기존 검증 진입점

### 13.1 함수·알고리즘별 이식 경계

Blink 경로는 `third_party/blink/renderer/` 기준이며 `cc/`는 Chromium 저장소 루트 기준이다. 아래는 고정 소스에서 확인할 구현 지점과 초기 조사에서 추출한 알고리즘 후보다. §3의 교차 검증 정정과 §6의 값별 검증 조건을 함께 적용한다.

| 후보                 | Chromium 파일·함수                                                                                                                                                                                                                                                                               | 보존할 알고리즘·확인할 조건                                                           | Composition 연결                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| C01 shadow           | `core/style/shadow_data.h:BlurRadiusToStdDev`, `core/paint/box_painter_base.cc:PaintNormalBoxShadow/PaintInsetBoxShadow`                                                                                                                                                                         | box/text radius×0.5. outer의 clip-out·spread RRect, inset의 inner clip·hole·blur 영역 | `styleConversion/styleConverter.ts` → `skia/nodeRendererBorders.ts:renderBoxShadows/renderInnerBoxShadows` |
| C02 drop-shadow      | `core/paint/filter_effect_builder.cc`의 drop-shadow 처리와 실제 filter 호출부                                                                                                                                                                                                                    | 표준편차 입력의 parser 변환 위치. box-shadow와 같은 상수로 일괄 변환하지 않음         | `styleConverter.ts`의 filter 파서 → `skia/effects.ts` 및 실제 filter consumer                              |
| C03 sampling         | `core/style/computed_style.cc:GetInterpolationQuality`, `platform/graphics/graphics_context_types.cc:GetDefaultInterpolationQuality`, `graphics_context.cc:ComputeInterpolationQuality`, `graphics_context.h:ComputeSamplingOptions`, `cc/paint/paint_flags.cc:FilterQualityToSkSamplingOptions` | src/dest 크기·로딩·quality flag·sampling 경로를 연속 추적                             | `nodeRendererImage.ts:drawImageRect` → 설치 CanvasKit bindings·image cache                                 |
| C04 font feature     | `platform/fonts/font_description.cc`와 shaping feature 전달부                                                                                                                                                                                                                                    | numeric/caps/feature settings의 우선순위와 실제 font 지원                             | catalog typography → `catalogRuntime/textMeasure.ts`·`nodeRendererText.ts`·paragraph key                   |
| C05 synthesis        | `platform/fonts/font_platform_data.cc:CreateSkFont`, font matching·synthesis 조건                                                                                                                                                                                                                | `setSkewX(-0.25)`·`setEmbolden`의 적용 조건. face 요청과 합성 실행을 구분             | font manager·Paragraph font style. 전체 paragraph skew를 자동 대체로 채택하지 않음                         |
| C06 border           | `core/paint/box_border_painter.cc:ComplexBorderInfo`, `DrawDoubleBoxSide`, `DrawRidgeOrGrooveBoxSide`, `CalculateInsetOutsetColor`, `ComputeMiter`                                                                                                                                               | 변별 alpha/style 순서·corner clip·두께 분할·색·dash endpoint                          | `nodeRendererBorders.ts`·border geometry, `drawDRRect`·`clipPath`·`PathEffect.MakeDash`                    |
| C07 outline          | `core/paint/outline_painter.cc`                                                                                                                                                                                                                                                                  | style·auto focus ring·음수 offset·radius와 겹침 처리                                  | outline 데이터 → border renderer의 outline 분기                                                            |
| C08 transform        | `core/style/`의 computed transform과 paint property builder                                                                                                                                                                                                                                      | 개별 translate/rotate/scale과 transform의 순서·origin·누적 좌표                       | `styleConverter.ts:convertToTransform`, command·bounds·hit·overlay                                         |
| C09 decoration       | `core/paint/text_decoration_info.cc`, `decoration_line_painter.cc:ComputeWavyPattern`                                                                                                                                                                                                            | auto/from-font·underline position·offset·wavy geometry                                | Paragraph decoration 배수와 CSS 길이 환산, 필요 시 별도 path와 bounds                                      |
| C10 background       | `core/paint/background_image_geometry.cc`, `box_background_paint_context.cc`                                                                                                                                                                                                                     | contain/cover·percentage position·space/round repeat·clip/origin 상자                 | `nodeRendererFillLayers`·배경 geometry                                                                     |
| C10 clip·order       | `core/paint/clip_path_clipper.cc`, `core/style/basic_shapes.cc`, `paint_layer_paint_order_iterator.cc`, `paint_phase.h`, `computed_style.cc:IsStackingContext`                                                                                                                                   | shape reference box·fill rule·CSS paint 순서·stacking context 생성                    | clip/mask·`isStackingContext`·render commands                                                              |
| C11 replaced content | `core/paint/image_painter.cc`, `core/layout/layout_replaced.cc:ComputeObjectFit` 및 인접 코드                                                                                                                                                                                                    | object-fit/position·intrinsic ratio·src/dst crop                                      | Image binding·layout 입력·`nodeRendererImage.ts`                                                           |
| C12 coverage         | `core/css/css_properties.json5`, 현재 catalog typed fields·generated CSS                                                                                                                                                                                                                         | 선언 존재와 production 소비를 분리, 미지원·위임 예외 명시                             | typed consumer coverage·정적 누락 검사·동적 fixture                                                        |
| U1/U4 검증·bounds    | `platform/graphics/paint/paint_under_invalidation_checker.cc`, `raster_invalidator.cc`, `geometry_mapper.h`                                                                                                                                                                                      | 독립 재생·영역 변환·invalidation·effect 입력 의존성                                   | 기존 render-path debug·fresh build·paint metadata·index                                                    |
| U7 property state    | Blink paint property builder·paint chunk, `cc/trees/` property trees                                                                                                                                                                                                                             | 로컬 기록과 transform/clip/effect/scroll 상태 참조의 분리                             | command patch/translate·bounds·index·renderer·hit·overlay                                                  |

### 13.2 초기 페인트 알고리즘 추출 기록

다음 상수·분기는 구현 착수 시 고정 revision의 호출부·단위·반올림과 함께 확인한다. 값만 복사하여 정합을 가정하지 않는다.

- Shadow: 초기 분석은 inset의 EvenOdd hole·상자 clip·약 3σ 여유 영역이 기존 경로와 유사하다고 보고했다. spread에 따른 corner radius는 단순 `max(0,r+spread)`로 충분한지 실제 분기·작은 radius·음수 spread fixture까지 확인한다. 기존 방식의 유사성과 픽셀 일치는 별도 증거다.
- Border: double 두께 분할 `(t+1)/3`, ridge/groove의 반분과 inset/outset 교대, 상대 휘도 기반 색 계산이 보고됐다. 색 계산 후보 상수는 `0.0144`, `0.8308`, 최소 edge contrast `1.75`다. alpha 그룹·soft/hard miter·변별 clip을 함께 보존해야 한다.
- Dashed/dotted border: 초기 조사에서 path length의 `%4`·`%6` 보정과 `EnforceDotsAtEndpoints`, 굵은 dotted의 zero-length dash·round cap을 보고했다. 단순한 균등 dash 배열과 같은 결과라고 가정하지 않는다.
- Decoration: 폰트 underline thickness/position을 우선 확인하고, 초기 분석의 fallback `font-size/10`은 적용 조건을 검증한다. SkParagraph `decorationThickness`는 배수이므로 CSS px와 직접 대입하지 않는다.
- Sampling: 페인트 교차 분석은 default Medium과 Low 품질 flag, 같은 크기·작은 이미지·한 축 확대·미세 크기 변화·부분 로딩에 따른 품질 하향을 보고했다. 작은 이미지의 비정수 목적 크기 등 예외도 포함한다. `None→Nearest/None`, `Low→Linear/None`, 해당 Medium 경로의 `Linear/Linear`를 실제 호출 사슬에서 확인한다. `image-rendering` 값·backend·확대/축소에 대한 하나의 보편 규칙으로 확장하지 않는다.
- Image 자원: mip의 통상적인 추가 용량 근사와 실제 GPU/cache live-set은 구분한다. decode 상한·원본 해제·mip 생성은 각각 화질·수명·메모리 gate가 필요하다.

### 13.3 테스트·측정 진입점

아래 이름은 기존 자산 또는 초기 조사에서 제안한 탐색 지점이다. 실행 전에 파일·옵션·fixture와 현재 production 경로의 연결을 확인한다. 존재하지 않는 경로를 통과한 테스트로 기록하지 않는다.

| 검증 축        | 기존 자산·탐색 지점                                                                                                          | 용도와 한계                                                                   |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 엔진↔DOM       | ADR-156, `adr923ChromeDifferential.browser.test.ts`                                                                          | computed style·rect·baseline의 차등 입력. 원본 WPT 실행과 번역 fixture를 구분 |
| Canvas↔Preview | Builder parity/G3 하니스, `approvedDifferences.ts`                                                                           | geometry·pixels·승인된 차이. 새 결함을 예외에 추가해 우회하지 않음            |
| render path    | `apps/builder/scripts/adr263-render-path-live.mjs`                                                                           | linear/full 비교·scroll·zoom. fresh scene·cache 우회 여부는 U1에서 확인       |
| subtree 이동   | `apps/builder/scripts/adr264-subtree-translate-live.mjs`                                                                     | 이동 patch·명령·geometry·pixels 회귀                                          |
| 성능·카운트    | ADR-246 ratchet, ADR-263~265, `apps/builder/scripts/perf-baseline.mjs`                                                       | 동일 fixture·환경·계측 모드의 기존 기준선 재사용 여부 판정                    |
| 폰트 축        | `scripts/generate-text-axis-matrix.mjs`, `textAxisGate.static` 관련 검사                                                     | 지원표 갱신·누락 방지. 실제 font와 측정/paint 동치를 대신하지 않음            |
| WPT layout     | `third_party/blink/web_tests/external/wpt/css/` 아래 CSS2·css-flexbox·css-grid·css-inline·css-position·css-sizing·css-tables | auto minimum·spanning·placement·relative/static position·ratio의 사례 추출    |

이 문서에서 정의한 ledger·U0~U8·후보 ID를 실행 기록의 식별자로 사용한다. 삭제된 원본 문서의 절 번호나 표를 찾아야만 작업을 진행할 수 있는 의존성은 두지 않는다.
