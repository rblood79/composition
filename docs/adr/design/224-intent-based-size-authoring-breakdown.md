# ADR-224 구현 설계 — 기존 Size 격자와 Fill 전용 의미 보강

> [ADR-224](../224-intent-based-size-authoring.md), Accepted — 2026-09-18 (부분 구현 후 크리티컬 오류로 실행 중단). Round 1 수리 반영. 아래 타입·함수는 목표 계약이며 구현 결과가 아니다.

최신 실행: 기본 `fit-content` 보존 + 콘텐츠 측정 분리로 기존 Fill 차단을 수리했고 실제 Builder 13/13을 통과했다. Ratio 후보의 Canvas 높이 30px / Preview 154.328~295.664px 발산으로 다시 중단했다. Ratio 후보는 로컬 evidence 패치로 분리, Fill 수리는 유지, 전체 Phase는 미완료다. 이후 그 발산을 엔진 경계 (flex 커널 aspect 슬롯 22 + leaf 전송값 content-box 보고) 로 확정·수리했다 — 실제 Builder 17/17, Chrome oracle fixture 20/20. §4 Ratio 계약의 UI·복합 명령도 반영했다 (live 22/22) — 잠금·해제의 tier 쓰기는 **자기 상태가 있는 tier 만** (없는 tier 는 base 상속; 후보의 전 tier 쓰기는 해제를 항상 막았다). 남은 것은 Absolute/Free · 실제 resize pointer 경로 · G5/G6. Canvas 핸들 resize는 현재 중앙 pointer handler에서 비활성으로 확인했으며 helper 수정만으로 완료할 수 없다.

## 1. 범위

Width/Height 한 상자의 선택·입력 개선, 축별 Fill 가중치 보존, 그에 필요한 저장·projection·전이만 구현한다. 다섯 mode 통합 schema, 독립 Size panel, 복원 history 필드, sibling 가중치 정규화는 제외한다. Min/Max·Ratio·Overflow의 현행 격자는 유지한다.

메뉴 열기+Fill 항목 선택은2 activation, **항목 선택 이후 추가 입력0**이다. 기존 코드에도 Fill→grow1 쓰기는 있다. G0는 첫 선택과 이후 숫자 편집을 나눠 재현하고 사용자 보고의 원인을 기록한다.

## 2. 기존 Size UI 유지 (h1·l1)

### 2.1 격자와 한 상자

`TransformSection.tsx`의 Width | Height + 28px constraints 액션 행을 유지한다. fieldset legend는 위, 입력과 내부 트리거는 한 상자다. 기존 28/32px 높이·token·간격·2열·action 열을 사용한다. 다음은 각 상자의 **내용만** 표현한 예다.

```text
Width                  Height
[ 1      채우기 ▾ ]    [ 264  내용 맞춤 ▾ ]  [제약]

Min W                  Min H                 ← 기존 펼침 영역
[ …             ]      [ …             ]
Max W                  Max H
[ …             ]      [ …             ]

Ratio [ 16:9                         ▾ ]    [잠금]
Overflow [ 기존 선택                  ▾ ]
```

계산 크기 전용 행·축별 세로 행·별도 mode Select를 추가하지 않는다. 컨트롤 외형은 PropertyUnitInput을 재사용한다. 그룹 메뉴/숫자 의미 계약은 Size 소비처의 opt-in이며 Padding 등 다른 PropertyUnitInput 소비처의 단위 동작을 바꾸지 않는다.

| 상태                  | 숫자 영역                | 내부 트리거               | 계산 px 제공                                                       |
| --------------------- | ------------------------ | ------------------------- | ------------------------------------------------------------------ |
| 고정                  | 현재 CSS 수치 편집       | PX                        | 기존 tooltip/접근 설명                                             |
| 부모 비율             | CSS % 수치 편집          | %                         | tooltip/접근 설명                                                  |
| 화면 기준             | CSS 수치 편집            | 기존 VW/VH 등 단위        | tooltip/접근 설명                                                  |
| Fill 주축             | 가중치 편집, 기본1       | 채우기                    | 값이 있으므로 placeholder에 의존하지 않고 tooltip/aria-describedby |
| Fill 교차축/Grid/Flow | 실제 값은 비워 읽기 전용 | 채우기                    | 계산 px를 placeholder로 표시; 미측정 —                             |
| Fit                   | 실제 값은 비워 읽기 전용 | 내용 맞춤                 | 계산 px placeholder                                                |
| Ratio 종속 축         | 읽기 전용                | 자동(비율), disabled 사유 | 계산 px placeholder/접근 설명                                      |
| CSS 기본/복합 값      | 현재 값/기본 표시 규칙   | 기존 표현                 | 새로운 “기존 값” mode를 추가하지 않음                              |

읽기 전용 placeholder를 authored 숫자로 파싱하거나 저장하지 않는다. tooltip은 키보드 focus에서도 제공한다. 부재 placeholder만으로 접근 이름을 대체하지 않는다.

트리거 메뉴는 기본 `고정 / 채우기 / 내용 맞춤`, 구분선 뒤 `부모 비율 / 화면 기준`이다. 기존 Reset 기능·위치는 유지하고 새로운 행 액션을 추가하지 않는다. viewport 단위의 범위는 기존 지원을 유지하며 dvh/svh/lvh 신규 지원은 이 ADR에서 확대하지 않는다.

### 2.2 가중치 편집·다중 선택

- CSS `fr`를 선택하거나 입력할 필요가 없다. 주축 Fill 숫자2는 가중치2이며 mode는 Fill이다.
- 신규 Fill 가중치1. 기존 Fill 재선택은 **단일/다중 모두 대상별 값 보존**. 혼합 selection은 비Fill 대상만1로 진입하고 기존 Fill2는2를 유지한다. 선택 대상 전체를1로 만들려면 가중치 입력을 명시적으로1로 commit한다.
- 신규 factor 범위는 유한한1~1000, step1, 직접 소수 입력 허용. 1.5:3처럼1 이상 가중치로 분수를 표현한다. 1 미만/NaN/빈 값은 commit하지 않고 기존값을 유지한다.
- 기존 CSS grow가1 미만이면 값을 그대로 읽고 렌더한다. 열기/재선택으로 재저장하거나1로 강제 변환하지 않는다. 해당 값을 새 가중치로 직접 편집할 때만 범위 검증 후 새 Fill marker를 기록한다.
- 소수 grow 합계1 미만 문제를 피하므로 factor 합계/최솟값 계산이나 sibling authored/derived grow 정규화는 없다.
- 교차축/Grid에는 numeric drag·가중치 편집이 없다. 숫자 영역이 잠겨도 mode 트리거는 문맥이 허용하는 다른 선택을 제공한다.
- 다중 selection의 mode는 사용 가능성 교집합이다. 가중치가 다른 경우 혼합 표시, 명시 숫자 입력은 선택한 Fill 대상에만 한 transaction으로 적용한다.
- 접근 이름은 `Width 채우기 가중치`, `Width 크기 방식`, `Height 자동(비율)`로 구별한다. 기존 Ratio label은 유지한다.
- Enter/blur commit, Escape 취소, 스크럽은 presentation 후 Undo1회. 값 변경 중 selection/context가 달라지면 대상 identity 재검증 후 취소한다.

Fill의 가중치는 남은 공간의 분배 가중치다. padding/border/Min/Max가 다르면 외곽 크기의 정확한2:1을 약속하지 않는다.

### 2.3 Min/Max와 기존 행

제약 toggle·값이 있으면 펼침·MinW|MinH/MaxW|MaxH 배치·Ratio/Overflow 위치를 그대로 유지한다. Min/Max 값과 단위는 기존 CSS 정본이다. 비교 가능한 동일 기준에서 min>max인 신규 입력은 오류로 commit을 막고, 서로 다른 단위·수식은 단순 parseFloat로 비교하지 않는다. 기존 충돌값을 자동 수정하지 않는다. constraint 때문에 Fill이 max에 머물면 기존 tooltip/접근 설명에 원인을 표시한다.

## 3. Fill 전용 데이터 (h2·h3)

### 3.1 정본과 상속

```ts
type Axis = "width" | "height";
type FillIntent = { factor: number }; // 유한한 1..1000
type FillAxes = Partial<Record<Axis, FillIntent | null>>;

// canonical node의 새 직접 필드
type NodeFillSizing = { sizing?: FillAxes };
// breakpoint의 새 전용 분기: 기존 styles와 섞지 않음
type ResponsiveFillSizing = {
  sizing?: Partial<Record<"tablet" | "mobile", FillAxes>>;
};
```

`CanonicalNode.sizing.width={factor:2}`는 Width Fill이다. Fixed/%/viewport/fit-content는 기존 `props.style.width/height`와 `responsive.styles`에 그대로 둔다. mode enum/value/unit/5-mode version marker를 만들지 않는다. Min/Max와 aspectRatio도 이동하지 않는다.

| 위치/값                           | 의미                                                                      |
| --------------------------------- | ------------------------------------------------------------------------- |
| base에서 axis 부재                | CSS 소유                                                                  |
| tier 또는 ref patch에서 axis 부재 | 상위 scope를 상속                                                         |
| tier/ref의 axis=null              | 상속된 Fill을 명시 해제, 이 scope의 CSS를 사용                            |
| axis={factor}                     | 이 scope의 Fill                                                           |
| base의 null                       | CSS 소유와 동등; 일반 node에서는 생략 가능, ref의 origin 차단 의미는 보존 |

ref/origin merge 후 base→tablet→mobile 순으로 **축 객체 전체**를 cascade한다. null을 undefined로 지우거나 factor를 leaf merge하지 않는다. tier에서 Fill→Fixed는 null+CSS width를 함께 기록한다. Reset은 해당 scope의 marker/null과 그 scope에 해당하는 W/H override를 지워 상위 값을 상속한다. 다른 축·Min/Max는 Reset 대상이 아니다.

`responsive.sizing` object는 CSS scalar emitter에 직접 넣지 않는다. Zod는 factor/null을 검증하고 `PENCIL_NODE_FIELDS`에 sizing을 직접 등록한다. Element mirror는 read-only 전달용이며 쓰기 정본은 canonical이다. DB payload/ref patch/복제/Pencil import-export가 이 작은 필드를 보존하는 것이 G2다.

### 3.2 Fill과 CSS 경계

mode 전체용 compiler를 만들지 않고 `resolveFillProjection(effectiveFill, effectiveStyle, parentContext)`을 shared에 둔다. marker가 없는 노드는 기존 CSS 경로를 그대로 사용한다.

Fill 활성화 명령은 해당 축 CSS dimension과 현 문맥의 Fill 제어 속성 충돌을 정리한 뒤 factor를 기록한다. Fill 해제는 marker 해제+기존 `resolveFixed/resolveFit` 방식의 CSS 편집을 같은 transaction으로 수행한다. factor만 변경하면 CSS 정본으로 grow를 다시 쓰지 않는다. 생성한 grow/stretch/reset은 derived 출력이다.

flexGrow/flexBasis/flexShrink/alignSelf/justifySelf는 두 축이 공유할 수 있으므로 명령은 **변경 전후 두 축**을 함께 본다. Width 변경이 활성 Height Fill의 main grow를 지우면 실패다. 기존 하위 inline 값이나 catalog 값이 derived Fill을 다시 덮지 않게 projection의 최종 우선순위와 dimension auto를 명시한다.

순수 CSS 문서를 일괄 역추론/migration하지 않는다. 명시100%는 부모 비율로 보여주고 자동 Fill marker로 만들지 않는다. 기존 CSS Fill 패턴은 기존 resolver의 제한된 읽기를 재사용하며, 첫 가중치 편집 시 해당 축을 Fill marker로 전환한다. 복합 calc/rem/import 값은 기존 입력 경로로 유지한다. 대규모 legacy passthrough 모델이나 새 “기존 값” UI를 도입하지 않는다.

Canvas resize·AI/style 명령·Layout preset이 marker 있는 축의 width를 쓰려면 같은 Fill 해제 경로를 거친다. raw CSS와 marker를 동시에 쓰기 정본으로 남기지 않는다. Alignment/auto margin과 Fill이 충돌하면 사용자가 명시한 속성을 조용히 삭제하지 않고 사용 불가 사유를 표시한다.

### 3.3 저장 변경 비용·호환

원본 corpus의 문서수D·노드수N·실제 편집 Fill 노드수F를 Phase0에서 집계한다. 전 문서 backfill0, Fill 미편집 노드 값 변경0, 열기/resize/단순 breakpoint 전환 저장0. schema 변경량은 FillAxes와 nullable tier/ref 해제에 한정한다.

신규 필드를 보존하지 않는 구버전 writer와의 혼용은 검증 없이 안전하다고 선언하지 않는다. 배포 시 sizing 필드를 통과시키는 import/export/DB reader를 먼저 갖추고 원본 백업으로 복구 가능해야 한다. 별도 전 문서 version 차단 시스템 신설은 제외한다. 구버전 편집 지원을 약속하지 않으며 구버전 왕복이 필수 요구로 드러나면 출시 전에 해당 호환 경계에서 해결한다.

`x-composition.sizingRestore`와 이전 semantic 복원 필드는 **신설하지 않는다**. Ratio 해제·Absolute→Flow는 과거 모드를 되살리지 않는다. Undo가 원본 CSS·factor·위치·tier를 복원한다.

## 4. Ratio 계약 (h4)

### 4.1 기존 행, 새 명시 조작

현행 `buildAspectRatioStyleUpdates`는 두 축의 명시 크기에 따라 height:auto를 만든다. 이 helper만 호출해서는 Height Fill marker와 stretch가 남는다. Ratio Select와 lock 버튼을 **같은 복합 명령**으로 통합한다. 새 Ratio 조작의 기준 축은 Width, 종속 축은 Height다.

잠금 동작:

1. 현재 유효한 layout으로 ratio preset 또는 W/H를 확정한다. 측정 없거나 H=0이면 임의1:1을 저장하지 않고 선택 가능한 preset 입력 또는 재측정을 안내한다.
2. Width CSS/Fill은 보존한다. Height Fill을 해제하고 CSS height:auto, aspectRatio를 기록한다.
3. Height가 flex cross/grid에서 stretch되어 ratio가 무시되지 않도록 해당 축의 alignment를 non-stretch로 derived 처리한다. Column의 Width Fill을 위한 alignSelf stretch는 유지한다. Width와 Height의 문맥을 함께 해석한다.
4. Height 상자는 `자동(비율)` 읽기 전용이다. 고정/Fill/Fit/%/viewport 선택을 disabled로 두고 “Ratio 잠금을 해제하면 높이를 직접 편집할 수 있습니다”를 제공한다. 새 sizing mode는 저장하지 않는다.

aspectRatio는 기존 정책대로 전역이다. 새 잠금은 모든 tier의 Width 실효값을 보존하고 Height를 auto로 정규화하는 명시 복합 동작이다. Height의 명시 tier override/Fill은 해당 tier에서 auto/null로 바꾸며 임의 삭제로 상속 Fill이 살아나지 않게 한다. Ratio control 설명에 전역 잠금 범위를 표시한다. 이 전체가 Undo1회다.

### 4.2 잠금 해제·기존 문서

새 잠금을 해제하면 aspectRatio를 지우고 각 영향 tier의 직전 used Height를 기존 CSS px로 고정한다. 이전 Fill/Fit은 복원하지 않는다. 필요한 geometry가 아직 없으면 해제를 commit하지 않고 재측정한다. 높이 고정과 Ratio 제거는 한 transaction이다. UI는 기존 고정값/PX 표시로 복귀한다.

종속 축 판독은 raw CSS만 보지 않고 effective Fill도 함께 본다. Width Fill marker+Height auto는 Width가 driver이고, Width의 derived CSS가 auto라는 이유로 양축 auto로 오판하지 않는다. 기존 문서를 읽는 것만으로 Ratio를 Width 기준으로 재작성하지 않는다. 기존 CSS에서 Width가 독립 크기이고 Height auto라면 종속 Height, Width auto+Height가 독립 크기라면 종속 Width로 표시한다. 둘 다 명시된 기존 ratio는 CSS preferred ratio 동작을 그대로 유지하며 독립 크기를 잠금으로 위장하지 않는다. 둘 다 auto라서 driver가 명확하지 않으면 기존 CSS 표시를 유지한다. 사용자가 Ratio preset/lock을 새로 적용할 때 위 Width 기준 계약으로 전환한다.

기존 잠금에서 종속 Width인 경우의 해제도 그 종속 축의 before used px만 고정한다. 모든 tier의 기존 driver가 다르면 tier별 CSS 상태로 판단하고 한 transaction으로 처리한다. 새 driver field나 복원 필드 없이 effective CSS+aspectRatio로 종속 여부를 판정한다.

### 4.3 Fill/Fit·resize·제약

- Width는 유효한 Fill/Fit/Fixed/%/viewport를 계속 선택할 수 있다. 단 자체 가용 공간이 없거나 ratio와 순환하는 문맥은 disabled 사유를 제공한다. Height는 독립 모드를 갖지 않는다.
- 새로운 Width 기준 잠금에서 Canvas 가로 resize는 Width를px로 바꾸고 Height auto+ratio를 유지한다. 세로 resize는 목표H×ratio로 Width를px로 바꾼다. 코너 resize도 최종 driver Width 하나만 commit한다. 기존 Height 기준 잠금은 대칭 적용한다. driver Fill은 명시 resize로 해제되고 한 Undo로 돌아온다.
- Min/Max는 CSS 우선순위로 ratio보다 강할 수 있다. 최종 geometry가 ratio를 만족하지 못하면 기존 control 설명에 “최소/최대 크기 제한 적용 중”을 표시한다. constraint를 삭제하거나 다른 axis 모드를 암묵 수정하지 않는다.
- Ratio 없는 한 축 edit은 반대 authored 축을 바꾸지 않는다. Ratio lock/resize는 두 축의 관계를 사용자가 명시한 예외다.

## 5. Fill 해석·Min 정책 (m1·l1)

### 5.1 사용 문맥

| 문맥                               | Fill 해석                             | 가중치   |
| ---------------------------------- | ------------------------------------- | -------- |
| Flex row/row-reverse in-flow       | Width main grow / Height line stretch | Width만  |
| Flex column/column-reverse in-flow | Height main grow / Width line stretch | Height만 |
| Grid in-flow                       | cell/area stretch                     | 없음     |
| Block Flow inline축                | auto stretch-fit, 단순100% 치환 아님  | 없음     |
| Free/Absolute/Fixed position       | 사용 불가                             | 없음     |

표는 horizontal writing-mode 예시이며 실제 physical axis 매핑을 사용한다. 지원하지 않는 writing-mode/containing-block 조합은 enabled로 위장하지 않는다. parent display 부재를 Free로 간주하지 않는다. 부모가 Fit이라 가용 공간과 순환하면 Fill 선택을 막고 사유를 제공한다. 부모를 자동 Fixed로 만들지 않는다. wrap 분배/교차 stretch는 line 내부다. Grid track fr 편집은 기존 부모 Layout 소관이다.

Fill main은 grow=factor, shrink1, basis0px, dimension auto를 projection한다. 모든 새 factor≥1이므로 공통 배율·minFactor·sibling 재compile 경로를 추가하지 않는다. 형제 변화에 따른 정상 엔진 배치는 그대로 필요하다.

### 5.2 명시 Min의 범위와 두 leg

“명시 Min”은 inline만 의미하지 않는다. **활성 catalog/theme variant → reusable origin → instance/descendant → authored base → responsive tier**의 기존 유효값 우선순위를 거친 최종 Min이다. 이 순서는 임의 새 cascade가 아니라 기존 effective style resolver의 결과·출처를 재사용한다.

- 최종 Min이 구체 길이/%/intrinsic keyword/calc 등 유효한 선언이면 출처가 catalog여도 그대로 보존한다.
- 최종 값이 부재 또는 auto인 경우에만 신규 semantic Fill의 **주축** min0을 derived projection한다. 명시 auto도 CSS 자동 최소 크기이므로 이 기본0 정책에 포함하며 UI 설명에 드러낸다.
- base의 min240이 tier의 명시 auto로 대체되면 해당 tier에서0이 된다. tier 값 부재는 상속이므로240을 보존한다.
- 교차축·Grid·legacy CSS-only 노드는 이번 main min0 정책으로 바꾸지 않는다.
- DOM과 엔진 입력은 동일한 `resolveFillProjection`의 min 결과를 사용한다. DOM에서만 min-width:0을 추가하거나 엔진에서만 catalog minimum을 제거하지 않는다. static emitter에도 catalog/origin/ref의 effective Min이 전달되어야 한다.

Min/Max는 분배 반복에 참여한다. 장식/간격0, 가용900px, Fill1 세 개 중 첫 max200이면200/350/350이다. 동일 조건의 Fill1.5/3은1:2다. catalog Min240이 있으면 그 이하로 줄어들지 않는 fixture를 두 leg로 검증한다.

### 5.3 Fixed·다른 CSS 모드

기존 `resolveFixed`의 Fill 속성 제거 정책을 재사용한다. **flex:0 0 auto 또는 shrink0을 신규 Fixed 기본값으로 강제하지 않는다.** CSS width는 authored 요청 크기이며 기본 flex shrink나 Min/Max로 실제 폭이 달라질 수 있다는 현행 의미를 유지한다. 구/신규 Fixed가 같은 CSS이면 같은 결과여야 한다.

%/viewport/fit-content도 기존 CSS 의미를 유지한다. 문맥이 바뀌어 cleanup할 Fill 제어 속성은 있을 수 있지만 이들 크기값을 새로운 semantic mode 객체로 옮길 이유는 없다. Fit capability와 계산 준비 상태는 분리하여 빈 자식/이미지 로딩만으로 값을 Fixed로 저장하지 않는다.

## 6. 전이·반응형 출력·cache (h3·m2)

### 6.1 구조 전이

| 동작                            | 결과                                                                          |
| ------------------------------- | ----------------------------------------------------------------------------- |
| Row→Column→Row                  | 축별 factor 보존; CSS projection만 재생성                                     |
| Flow→Absolute / Flex·Grid→Free  | 무효 Fill만 before geometry로 기존 CSS Fixed, 위치/inset 포함, 한 transaction |
| Absolute→Flow / Free→Flex       | 현재 Fixed 유지; 이전 Fill 자동 복원0                                         |
| 위 명령 Undo                    | 기존 CSS·factor·position·tier 전체 복원                                       |
| viewport resize/breakpoint 전환 | authored 쓰기0                                                                |
| marker 축 직접 resize/고정 선택 | 해당 Fill 해제+CSS px, 다른 축 Fill 보존                                      |

geometry는 node/ref path·document revision·layoutVersion·tier·viewport가 일치하는 변경 전 snapshot이다. zoom/DPR/회전된 screen AABB를 저장하지 않는다. base 구조 변경은 영향 tier별 geometry를 준비하며 숨긴 tier가 미측정이면 결정론적 layout을 먼저 계산한다. 미확정이면 commit하지 않는다. 한 화면 px를 모든 tier에 복사하지 않는다. Relative가 구조 변경 후에도 유효하면 기존 CSS를 유지하며 무관한 % 전면 전환은 하지 않는다.

### 6.2 parent-aware CSS 계약

현행 `buildResponsiveElementCss(elementId, baseStyle, responsive)`에는 부모 문맥이 없다. 세 인자 함수 안에서 store를 조회하는 방식으로 보완하지 않는다. collector 단계에서 트리/ref를 해석하여 **base/tablet/mobile별 effective Fill projection과 parent signature**를 만든 뒤, 해당 per-node emitter의 명시 입력(추가 인자 또는 typed input)으로 전달한다.

입력에는 layout parent id/path, effective display/direction/wrap/position, physical axis, Fill axis/factor/null, Ratio 종속 축, effective Min 출처/값이 포함된다. 필요한 조상은 display:contents를 건너뛴 실제 layout parent·containing-block 의존 경로다. 전체 조상 문서 JSON을 cache key로 넣지 않는다.

child 자체 responsive가 없어도 **parent만 mobile Column으로 바뀌면** child CSS를 emit한다. base main grow가 mobile cross에 남지 않도록 필요한 기본 flex/align 값을 함께 출력한다. tablet/mobile의 null Fill 해제와 기존 style cascade도 같은 projection에서 처리한다.

### 6.3 실제 소비처·signature 변경표

| 경계                                                                                 | 변경 계약                                                                                     |
| ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `packages/shared/src/utils/responsiveCss.ts::buildResponsiveElementCss`              | Fill projection을 명시 입력으로 받음; child responsive 없다는 이유만으로 조기 반환 금지       |
| 같은 파일 `collectResponsiveCss`                                                     | nested walk에 parent/tier effective context 전달; ref가 있으면 정본 resolver의 확장 결과 사용 |
| 같은 파일 `collectResponsiveCssFromElements`                                         | flat 입력에 read-only sizing + parent_id/ref path 운반, index로 parent context 계산           |
| `apps/builder/src/preview/App.tsx`                                                   | canonical/ref resolution 이후 collector 호출, resolved context를 전달                         |
| `apps/publish/src/renderer/PageRenderer.tsx`                                         | flat pageElements에서 parent/sizing 손실 없는 collector 호출                                  |
| `packages/shared/src/utils/export.utils.ts`                                          | static export의 canonical/ref 및 flat 전달 경로 모두 context 유지                             |
| `apps/builder/src/builder/workspace/canvas/scene/layoutCache.ts`                     | native sizing/tier null과 실제 layout parent의 effective context signature 포함               |
| `apps/builder/src/builder/presentation/invalidation/editorMutationEffectRegistry.ts` | semantic sizing/Ratio·Min 입력 및 상위 layout 변경의 영향 분류                                |
| `apps/builder/src/builder/stores/utils/layoutInvalidation.ts`, `elementUpdate.ts`    | Fill 직접 필드 편집의 layoutVersion 트리거 추가, style-only 검사에 의존 금지                  |
| `workspace/canvas/layout/engines`                                                    | common style 이후 동일 Fill projection 입력, 별도 mode 역추론 금지                            |

A(layoutVersion)와 B(signature)를 모두 고친다. node 자신의 factor는 scalar/axis signature로 읽고 parent direction/layout의 변경은 의존한 Fill child를 무효화한다. parent id만 동일하다고 재사용하지 않는다. cache warm 상태에서 parent만 변경하는 negative probe를 G4에 둔다. 형제 factor 정규화를 제거했으므로 sibling 최소 factor용 의존성은 필요 없다.

## 7. 실행 단계

**2026-09-18 재개 후 재중단**: 엔진 최종 입력에서 intrinsic 측정값의 고정 W/H 주입을 확정했다. 스칼라 분리 후보로 기존 Fill 불일치는 해소됐으나 기본 Button Column 폭 900/68px의 신규 크리티컬 회귀가 실제 Builder에서 확인됐다. 후보만 철회하고 WASM 재생성, 진단 getter·회귀 fixture·근거를 보존했다. 기존 G3/G4 오류와 이후 범위는 미완료이며 완료 Phase는 없다. 다음 재개는 inline 부재와 catalog/생성 base의 fit-content·명시/Fill auto를 구별하는 유효 스타일 경계부터다.

**2026-09-18 실행 기록**: G0의 Fill→숫자 편집 증상을 재현하고 Fill 전용 저장·투영·기존 한 상자 UI를 부분 구현했다. 실제 브라우저에서 Row 높이 30/240px, Column Width Fill 69/900px의 Canvas/Preview 불일치가 발생해 사용자 지시에 따라 중단했다. Phase 0의 전체 corpus/비용 기준선, Phase 1의 전체 왕복/출력, Phase 2의 Ratio·Absolute·resize 및 과업/성능 검증은 남아 있다. 아래 Phase 어느 것도 완료 처리하지 않는다. [중단 근거와 재개 경계](../evidence/224-fill-layout-blocker.md).

| Phase | 범위                                                                                    | 파일/소비처                                                                                                                            | 종료                         |
| ----- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 0     | 현재 Fill 숫자 흐름, Ratio·catalog Min 및 tier 실제 경로 재현                           | TransformSection/PropertyUnitInput/sizeModeResolver/aspectRatio, 기존 document corpus                                                  | G0 및 before UI/비용 기록    |
| 1     | FillAxes/null 타입·schema·canonical mutation·ref/Pencil/DB 왕복, shared Fill projection | shared types/schemas/PENCIL_NODE_FIELDS, builder canonical adapters/store/history, responsiveCss와 §6.3 전체 소비처/cache/invalidation | G2/G3/G4의 저장·출력 fixture |
| 2     | 기존 상자 opt-in 메뉴/가중치, Ratio 복합 명령·전이, 과업/비용 검증                      | TransformSection/PropertyUnitInput, Ratio/resize/position command, 인접 테스트·기존 browser harness·문서                               | G1/G4/G5/G6, 전 gate 증거    |

별도 mode control나 CSS 모드 migration을 위한 Phase는 없다. 실제 파일 수는 Phase0에서 확정한다. 문맥 입력이 필요한 Preview/publish/static export를 “추후 연결”로 남기고 UI만 완료 처리하지 않는다.

## 8. 검증과 완료 조건 (m3)

- G1: 기존 Width|Height, 제약 펼침, Ratio/Overflow screenshot 비교. 행 추가0. Fill 항목 이후0 activation, 가중치2는 같은 상자 숫자 편집으로 완료. 단일/다중 재선택 모두 factor 유지.
- G2: base Fill2, tablet=null+320px, mobile 미지정, ref origin Fill+descendant null 왕복. 순수 CSS Fixed/%/fit/rem/calc 값 보존. 기존0.5 grow 읽기만 할 때 쓰기0. 구/신 Fixed에 동일 CSS를 주고 shrink 결과 비교.
- G3: 1:2/1.5:3, main min auto→0, catalog Min240 보존, tier auto 대체, 서로 다른 padding/border·max 재분배, wrap/Grid/Block. DOM oracle와 Canvas 수치 Δ≤1px.
- G4: parent만 Row→mobile Column, null tier 해제, cache warm 후 direction 변경, Absolute 왕복 시 Fixed 유지·Undo로 Fill 회복. Ratio 새 lock: Width Fill2/Height Fill1→Height auto; unlock→Height px; 가로/세로/코너 resize; legacy Height 기준 ratio 및 양축 명시 CSS 보존.
- G5 blocking: 소유자가 foreground Builder에서 “남은 공간 채우기 / 배분2:1 / Ratio 잠금·해제 / MinMax 제한”을 관찰하고 결과를 확인한다. automation은 activation·canonical read-back·DOM 결과·키보드·접근 이름을 기록한다. 소유자 확인과 자동 결과를 혼동하지 않는다.
- U1 deferred: 신규 사용자5명의 무도움 관찰은 후속 연구이며 Implemented 조건에서 제외한다. 수행하지 않았으면 사용자 일반에 대한 효과 주장은 유보한다.
- G6: 대표 실문서1개+합성100/1,000 형제, 같은 머신·viewport·zoom·DPR·폰트·foreground 상태·워밍업5회 후 각30회. 부모 resize와 factor edit에서 layout+commit p95를 동일 조건 before/after 비교한다. 증가≤max(before10%,1ms), 신규 강제 DOM 측정0. 과거 숫자를 현재 baseline으로 사용하지 않는다.

문서 수리에서는 링크·필수 섹션·review schema·format·guard·diff를 검사한다. 설계 표/정적 문서 assertion은 제품 검증이 아니다. 제품 gate는 구현 단계에 인접 Vitest·typecheck·실제 browser로 검증하며 사용자 가시 변경은 CHANGELOG에 기록한다.
