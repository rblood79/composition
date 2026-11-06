# S2 1.8.2 Label 자식 편집과 여러 줄 배치

2026-11-06. 구현 기준은 설치된 S2 1.8.2다. 기존 Library 계약 61과 실제 Label 자식 구조를 유지한다.
이번 작업은 첫 단계의 부분 완료이며, 아래 남은 기본 시각 차이를 의도적 차이로 분류하지 않는다.

## 2026-11-07 baseline 후속 수정

- Canvas 콘텐츠는 Skia 직접 렌더를 유지한다. DOM overlay와 text-box-trim은 적용하지 않았다.
- CSS 줄 상자의 baseline을 보이지 않는 측정 요소에서 읽어 캐시한다. 서체별 위치 상수 없이 family·weight·size·style·line-height·locale·DPR 및 FontCollection 세대를 구분하며 폰트 로딩 완료 시 무효화한다. 같은 typography 1,000회 측정은 geometry 조회 2회 이내로 제한하는 회귀를 둔다.
- `height * 0.8` fallback 세 곳을 공통 메트릭 경로로 교체했다. native 측정이 없으면 font box, 측정기가 제공한 firstBaseline, 기존 상자 하단 기준 순으로 사용한다. normal 줄 높이를 임의의 1.2로 대체하지 않는다.
- Rust fragment의 baseline·실제 폭을 paint로 전달한다. inline paint는 일반 텍스트의 ±1px 제한을 통하지 않으며, fragment의 maxWidth에 100,000px을 넣지 않는다. 기존 일반 paragraph 내부의 nowrap 구현과 다른 컴포넌트용 보정은 별도 범위다.
- 실제 CJK 14px/21px baseline은 Canvas·DOM 모두 16.5px로 맞았다. Pretendard·Inter와 굵기 변경도 각자의 native 메트릭을 사용한다. TextField의 전체 Label pixelmatch는 같은 threshold 0.1에서 2,475/57,728 → 1,254/57,728이며 여전히 FAIL이다.
- 진단용 ±2 device-pixel 이동 비교에서 이전 화면의 최소 오차는 y=1, 수정 후는 x=0/y=0이었다. 이 진단은 배치 원인 확인용이며 전체 Label 픽셀 검사의 마스크·허용 오차를 변경하지 않는다. 남은 차이의 최종 원인을 특정 backend로 확정하지 않는다.

현재 실행 기록: `.agent/runs/20261107-002834-dom-overlay-label-glyph-baseline/`.

- 최종 브라우저 회귀: 376 PASS, DPR 2 전용 17 PASS. 인접 unit 31 PASS, typecheck 6 tasks PASS, 등록 검사 6 PASS.
- 실제 Builder: 13개 필드의 전체 편집 검사를 실행한 뒤 최종 코드의 빠른 흐름을 다시 실행해 131 PASS / raster 13 FAIL, console/pageerror 0을 확인했다. 실제 별도 Publish 앱의 Label 조립도 13개 PASS다.
- 같은 typography의 DOM/Canvas baseline 표본은 52/52 일치했다. 중간 TextField raster는 1,194였고 최종 재실행값은 1,254다. 전체 Label 비교 기준 threshold 0.1과 허용 비율 0.001은 유지했다.
- 전체 preflight는 보호 파일 검사를 통과한 뒤 기존 공용 `.agent/task-state.json` 포맷 경고로 중단했다. 다른 작업 subtree를 포맷하거나 gate를 완화하지 않았다.

## 수정

좁은 폭에서 `necessity-label` Text가 flex 축소되어 문구 안에서 줄바꿈했다.
S2 `Field.tsx`의 표시 wrapper는 `whiteSpace: nowrap`이다.

- 공용 Label catalog의 해당 slot에 `white-space: nowrap`, `flex-shrink: 0`을 선언했다.
- `rulePartRules.ts`가 `white-space`를 typed visual로 컴파일한다. DOM과 Canvas가 같은 자식 규칙을 읽는다.
- 자식의 명시적인 `whiteSpace: normal`·폭 편집은 기본값보다 우선하며 Reset으로 복원된다.
- 표시를 가상 glyph나 문자열 suffix로 합치지 않았다. `necessity-space`, Icon, Text는 기존 작성 자식이다.

## 검증 범위

대상은 TextField, TextArea, NumberField, SearchField, ColorField, DateField,
TimeField, DatePicker, DateRangePicker, CheckboxGroup, RadioGroup, Select, ComboBox다.

`apps/builder/scripts/s2-label-children-live.mjs`는 별도 scratch 프로젝트에서 팔레트 → Layers →
Property로 본문·Icon·필수 문구 자식을 편집한다. 문서 변경에 store 직접 조작이나 테스트용 명령 삽입을
사용하지 않는다. workspace 조회는 결과·geometry·history 확인에만 사용한다.

- 본문 자식 편집과 Reset, Undo/Redo.
- Icon을 check로 바꾸고 Undo로 S2 Asterisk 복원.
- 필수 표시를 label 모드로 바꾸고 Text 자식 편집.
- 좁은 폭의 문구 한 줄 유지 및 저장·재로드.

회귀는 `s2FieldText.browser.test.ts`에 있다. 새 13개 검사는 수정 전 모두 실패했고,
수정 후 관련 브라우저 검사 159개가 통과했다. 사용자 줄바꿈·폭 override와 Reset을 포함한다.
TypeScript 6개 패키지와 등록 계약 6개가 통과했다.

실행·스크린샷·중간 실패 구분은 로컬 run의 `report.md`에 기록한다:
`.agent/runs/20261106-191452-s2-1-8-2-label-13-builder-canvas-preview/`.

## 아직 일치하지 않는 기본 시각

`s2-label-oracle.browser.mjs`는 실제 S2를 별도 iframe에 렌더한다. Builder chrome CSS를 격리하고,
동일한 Preview reset과 로드된 FontFace를 사용한다. catalog leg는 실제 공유 CSS·Rust 엔진·
Canvas text measurer를 사용한다. 이것은 Builder UI 편집 검증과 별개의 자동 geometry 대조다.

208px, M, ko-KR, 같은 긴 Label에서 13개 필드 × icon/label 26개 경우의 측정을 완료했다.
양쪽 필드 폭과 글자 크기는 각각 208px·14px다.

| 항목                      | nowrap 보완 직후 catalog              | S2 1.8.2                     | 판정                |
| ------------------------- | ------------------------------------- | ---------------------------- | ------------------- |
| 필수 문구 내부 줄바꿈     | 기본 nowrap, 명시 편집 가능           | 기본 nowrap                  | 이번 수정 범위 통과 |
| 여러 줄 뒤 Icon/Text 위치 | flex의 별도 열, 본문 전체 높이에 정렬 | 본문 마지막 줄의 inline 흐름 | FAIL                |
| ko-KR Label 줄 높이       | 18px (후속 보완으로 21px)             | 21px (`:lang(ko)`의 1.5)     | 줄 높이 정렬        |

26개 결과를 전체 raster pixelmatch 또는 Publish 검증으로 확대하지 않는다. S2 inline Label의
bounding rect와 catalog flex box는 형태가 다르므로 전체 상자 크기만으로 일치를 판정하지 않는다.
다음 검증은 마지막 텍스트 줄과 표시의 상대 좌표·baseline 및 같은 상태의 픽셀을 함께 비교해야 한다.

## CJK 줄 높이 후속 보완

2026-11-06 후속 run `.agent/runs/20261106-195814-s2-cjk-label-override-inline/`에서 아래를 구현했다.

- 공용 Label rule의 `localeTypography`에 ja·ko·zh의 단위 없는 `lineHeight: 1.5`를 선언했다.
- runtime의 host locale 해석과 Library 기본값 표시가 같은 값을 읽는다. 기본값을 저작 override로
  오인하지 않으며, Label·자식·Library의 명시 값과 Theme의 paired line-height 토큰을 우선한다.
- Theme snapshot의 `explicitTypography`가 seed와 같은 명시 값도 보존한다. 예를 들어 Theme의
  명시 18px은 기본 CJK 21px보다 우선한다. Theme를 해제하면 locale 기본값으로 돌아간다.
- Canvas font box가 FontMgr 내부 alias로 Typeface 저장소를 조회하던 결함도 수정했다. 실제 등록된
  family와 weight/style을 사용하며, 내부 이름이 다른 실제 폰트 두 변형으로 회귀를 검증했다.
- Design의 자식 Text가 자기 기본값 16px/20px 대신 부모에서 전달받은 14px/21px를 표시한다.
  px 줄 높이 쓰기도 같은 실효 글자 크기로 환산한다. 28px 편집은 `28/14 = 2`로 저장된다.

13개 필드의 S/M/L/XL 줄 높이는 S2 oracle과 같고, 208px·M·ko-KR의 icon/label 26개 재측정에서도
줄 높이는 모두 21px로 일치했다. 관련 브라우저 회귀 181개와 타입 검사 6개 패키지가 통과했다.
실제 Builder에서는 Text 탭의 기본 21px 표시, 28px 편집, Undo/Redo, Reset, 저장·재로드를 확인했다.
13개 필드 자식의 Design 표시·28px 쓰기·Undo/Redo·Reset·20px 글자 크기 override 회귀도 통과했다.
확장한 실제 Builder 하니스도 13개 필드의 Design 값·줄 높이 편집·Undo/Redo·Reset을 포함해
222개 검사를 통과했으며 console/pageerror는 0건이었다.
별도 실제 TextField 자식 편집에서 28px 저장 후 재로드와 Reset 후 21px 재로드까지 확인했다.
기존 `effectiveStyleValues.test.tsx` 전체는 이번 패널 수정 전부터 Button padding 6/7px와
Checkbox weight 500/400 기대값 두 곳에서 실패했다. HEAD 테스트 파일로도 같은 두 실패를
재현했으며, 신규 13개 회귀의 통과와 분리해 기록한다.

**아직 전체 기본 시각 일치가 아니다.** 여러 줄 뒤 표시 배치는 그대로 미완료다. 또한 같은 TextField
Label의 100%·DPR 2 screenshot을 pixelmatch 임계 0.1로 대조했을 때 6,500픽셀 중 241픽셀이 달랐다.
이 한 글리프 영역의 결과를 전체 화면의 오차율로 해석하지 않는다. glyph baseline·raster 차이를
추가로 해결하기 전에는 Canvas↔Preview pixel 일치로 판정하지 않는다.

## 다음 구현의 조건

1. CJK 줄 높이와 명시 override 우선순위는 위 후속 보완으로 정렬했다. 실제 glyph raster 차이는 남았다.
2. 마지막 줄 배치는 실제 자식의 inline 흐름으로 해결한다. 현재 Rust `display.rs`는 순수 inline
   요소와 텍스트의 혼합 흐름을 지원하지 않으며, `block.rs`의 line box는 atomic inline 범위다.
   TS에서 flex wrap·padding·absolute 좌표로 근사하는 경로는 사용하지 않는다.
3. 필요한 텍스트/아이콘 조각 측정과 엔진의 line/fragment 배치, Canvas paint·선택 경계의 소비를
   연결한다. 기존 catalog 자식의 identity와 편집·삭제·Reset·history·저장 계약을 보존한다.
4. 13개 필드마다 긴/짧은 Label, icon/label, S/M/L/XL, 명시 스타일과 복원에서 S2 및
   Canvas↔Preview를 재대조한다. 완료 전 actual Publish와 raster 검증을 남은 게이트로 유지한다.

첫 단계의 완료 판정은 남은 inline 배치·glyph raster 차이의 수정과 실제 편집 재검증 뒤에 한다. 입력·선택 기능의
다음 단계로 넘겨 현재 시각 차이를 완료 처리하지 않는다.

## 실제 inline fragment 구현과 현재 판정

2026-11-06 run: `.agent/runs/20261106-210056-s2-label-inline-fragment-canvas-preview/`.
앞 절의 flex 배치는 아래 구현으로 대체했다. Library 계약 61과 기존 자식 주소는 유지한다.

- Label과 본문·NBSP·필수 문구는 `inline`, Icon은 `inline-flex` + baseline이다.
  중복 `manualBoxRules`의 Label flex 선언을 제거했다.
- TS는 glyph cluster(UTF-16 범위·advance·높이·baseline)만 측정한다. Rust `inline.rs`가
  UAX14, NBSP glue, nowrap과 자식 경계를 함께 처리하여 줄과 fragment를 결정한다.
- grid intrinsic 측정의 snapshot/restore가 fragment를 보존한다. inline solve 완료 후 dirty를
  해제하지 않아 다음 편집이 조상에서 멈추던 증분 회귀를 nested block→grid→Label로 재현·수정했다.
- Canvas는 본문 자식의 union box와 편집용 원문을 유지하고 paint 자식만 fragment별로 그린다.
  기존 rule-text autoCenter가 배치된 줄을 다시 늘리지 않는다. 효과·transform은 원본에서 한 번 적용한다.
- S2 CJK FontFace 비동기 등록을 기다린 후 대조한다. `fonts.ready`만으로 등록 전 값을 재지 않는다.
  Canvas 2D도 같은 locale과 CSS fallback stack을 읽는다. 줄바꿈용 하위 segment cache도 locale별로
  분리하며 측정·paint baseline·장식선 경로가 같은 언어를 전달한다. 언어 전환의 잘못된 폭 재사용을
  RED(16→24 실패)로 재현하고 수정 후 관련 118개 검사를 통과했다.

### 통과한 검증

- S2 실제 DOM × 13개 필드 × S/M/L/XL × icon/label = **104개**에서 줄 수·마지막 줄과 표시의
  상대 좌표·baseline·glyph box를 대조했다. TextField의 긴 Label 기본 필드 폭 대조도 통과했다.
- 관련 브라우저 **286개**, 인접 unit **288개**, Rust **554개**, 타입 검사 6개 패키지,
  등록 검사 6개가 통과했다. Rust 수치는 lib 513 + golden/trace/tree/doc 41이다.
- 실제 Builder에서 TextField의 Canvas 더블클릭 → 실제 본문 자식 편집 → Reset → 저장·재로드를
  확인했다. 편집 상자도 paint 조각의 거대한 측정 폭 대신 실제 여러 줄 폭·높이를 유지했다.
- 실제 Builder 전체 재실행에서 기존 222개 편집·스타일·history·저장 검사가 통과했다. 후속 실행은
  13개 필드 모두의 Canvas 본문 편집과 source box 폭, 저장·재로드를 통과했다.
- 별도 Publish 앱에 같은 문서를 공식 JSON 포맷으로 전달하여 13개 필드 모두의 본문·필수 문구,
  줄 높이·display·nowrap·여러 줄 높이를 Preview와 대조했다. 후속 실행은 131 PASS / raster 13 FAIL,
  console/pageerror 0이었다. 전체 화면 raster나 모든 상태의 Publish 통과로 확대하지 않는다.
- 과거 구조 검사의 plain Label 기준 예제를 실제 Text 자식 조립으로 갱신했다. wrapper 검사의
  필수 표시 탐지도 문자 `*`만이 아닌 실제 Icon/Text slot을 확인한다. aria 링크·control 구조 검증은 유지한다.

### 남은 실패와 완료 조건

**현재 단계 전체는 미완료다.** 같은 production 상태·100%·DPR 2의 긴 TextField Label에서
pixelmatch 임계 0.1로 전체 57,728픽셀 중 2,475픽셀이 달랐다(최종 언어 경로 재실행 기준).
줄 겹침은 수정했지만 glyph의 baseline/래스터 차이는 남았다. 같은 Typekit sfnt subset을
별도 native FontFace에 넣은 대조군에서도 native glyph와 Skia 차이가 관찰됐다. 이것만으로
원인을 특정 플랫폼 backend로 확정하지 않는다. hinting·variation 실험은 해소하지 못해 제품 코드에 남기지 않았다.

- 지원한 직계 inline text + atomic inline 조립을 일반 중첩 IFC, bidi, vertical writing 지원으로 확대하지 않는다.
- glyph raster 실패를 의도적 차이나 통과로 분류하지 않는다. Publish의 13개 Label 조립은 실제 실행했지만 전체 상태·테마 Publish는 미검증이다.
- 현재 단계의 남은 glyph 비교를 마감한 뒤 TextArea·ColorField 값 편집 단계로 자동 진행한다.
  이전 1.8.1 조사 목록을 구현 목록으로 사용하지 않는다.
