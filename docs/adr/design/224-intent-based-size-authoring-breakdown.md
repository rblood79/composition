# ADR-224 구현 설계 — 의도 기반 크기 편집

> 상위 결정: [ADR-224](../224-intent-based-size-authoring.md). 상태: Proposed, 2026-09-18. 아래 타입·함수는 목표 계약이며 현재 존재하는 API를 뜻하지 않는다.

## 1. 범위와 목표 과업

설계 대상은 Width/Height 저작 경험과 그 의미를 유지하는 canonical/렌더 경계다. 컴포넌트의 XS–XL, Grid track 편집, 부모 Layout 도구 전체 개편, 신규 AI 추천, 임의 CSS 에디터 신설은 범위 밖이다. 기존 코드는 통합 위치와 데이터 보존을 확인하는 자료이며 새 UX의 제약이 아니다.

ADR-116이 기반이고 이 ADR은 응용이다. ADR-026 크기 영역과 schema가 겹치므로 그 후속 대체이며 별도 mirror를 만들지 않는다. 의존 방향은 document → sizing → 소비처다. 사용자의 2026-09-18 새 ADR 설계 지시를 근거로 작성한다. 기존 ADR의 다른 영역이나 상태는 변경하지 않는다.

| 과업                            | 사용자 동작                 | 완료 결과                                             |
| ------------------------------- | --------------------------- | ----------------------------------------------------- |
| 로고 옆 본문으로 남은 폭 채우기 | 본문 Width → 채우기         | 비율1로 즉시 채움; 로고/부모 무변경                   |
| 두 카드로 균등 분배             | 두 카드 선택 → Width 채우기 | 두 대상 factor1; 선택하지 않은 형제 유지              |
| 카드 하나에 더 많은 공간 주기   | 해당 카드의 비율을2로 편집  | mode는 Fill 유지; 다른 Fill1과 2:1 가중치             |
| 텍스트 늘어날 때 높이 늘리기    | Height → 내용 맞춤          | 폭은 유지하고 줄바꿈 결과로 높이 재계산               |
| 정확한 배너 높이                | Height → 고정 → 240 입력    | 240px 요청값; Min/Max 제약이 있으면 실제 값 별도 표시 |
| 화면의 절반 폭                  | Width → 부모 비율 → 50 입력 | authored50%, 부모 기준 변화에 반응                    |

마우스 메뉴 열기를 포함하면 Fill 완료는 메뉴 열기+항목 선택 2 activation이다. HC1의 “1회”는 **Fill 항목 활성화 이후 추가 단계0**을 뜻한다. 키보드는 메뉴 열기→방향 이동→Enter, Enter 직후 완료한다.

## 2. UI 계약

### 2.1 mode와 값의 역할 분리

각 축 행은 축 label + mode control + 문맥별 값 control로 구성한다. mode/값 두 영역은 동일한 chrome control 높이28px를 사용한다. 행 액션은 기존28px action cell, 확장 header는32px를 사용한다. Styles 내부의 기존 grid/token을 재사용하며 Properties의 컴포넌트 Size control과 합치지 않는다.

```text
크기
너비  [채우기 ▾]     [비율 1   ]
높이  [내용 맞춤 ▾]  [264 px   ]  ← 읽기 전용
계산된 크기 816 × 264 px          ← 읽기 전용
```

Flex 교차축/Grid/Flow Fill의 값 영역은 계산된 px를 읽기 전용으로 보여준다. 비율 입력 영역을 빈 editable 숫자 필드로 남기지 않는다. 읽기 전용 값은 textbox로 위장하지 않고 보조 텍스트/output 의미를 사용한다. Fill 주축에서 `2` 입력은 **비율2**이며 Fixed2px로 전환하지 않는다. Fixed 선택 후 입력한 `2`만2px다.

메뉴 순서는 안정적으로 유지한다.

| 그룹 | 표시                    | 값 영역                     | 설명                       |
| ---- | ----------------------- | --------------------------- | -------------------------- |
| 기본 | 고정 / Fixed            | 숫자 + px                   | 지정한 크기                |
| 기본 | 채우기 / Fill           | 주축 비율 또는 읽기 전용 px | 사용할 수 있는 공간 채우기 |
| 기본 | 내용 맞춤 / Fit Content | 읽기 전용 px                | 내용에 맞춰 크기 변경      |
| 보조 | 부모 비율 / Relative    | 숫자 + %                    | 기준 영역 크기의 비율      |
| 보조 | 화면 기준 / Viewport    | 숫자 + 축별 viewport 단위   | 페이지 화면 기준 크기      |

보조 그룹도 같은 메뉴에서 직접 선택한다. “고급 설정” 모달이나 두 번째 패널로 이동하지 않는다. 기본3개는 항상 같은 자리에 두고 불가 항목을 disabled+설명으로 표시한다. 예: “자유 배치에서는 채우기를 사용할 수 없습니다”, “부모 높이가 내용에 따라 정해집니다”. disabled 항목 이유는 키보드 접근 가능한 메뉴 설명에도 제공하며 hover tooltip에만 의존하지 않는다.

`기본값 복원`은 행 액션으로 해당 scope의 authored override를 제거한다. 상속/catalog 값이면 mode 옆 `기본` 표시와 읽기 전용 결과를 제공한다. 뜻이 불분명한 기존 CSS는 `기존 값` 상태에서 원래 값을 표시한다. 이는 신규 mode 목록에 추가하지 않는 호환 상태다.

### 2.2 기본값·입력·빈 상태

- 다른 mode→Fill: factor1. Fill→Fill: 현재 factor 유지. `비율 초기화`는1로 돌아가는 행 액션이며 별도 모드가 아니다.
- Fixed 진입: 유효한 현재 used border-box 크기를 px로 채운다. 표시 반올림이 저장 정밀도를 깎지 않으며 사용자가 값을 편집했을 때만 입력 정밀도를 적용한다. 측정이 없으면 빈 입력으로 명시 숫자를 받으며 임의0을 commit하지 않는다.
- Relative 진입: percentage basis가 확정되면 현재 크기/basis 비율로 geometry를 최대한 보존한다. 기준0이면 자동값을 만들지 않고 명시 입력을 받는다. Viewport 진입도 같은 방식으로 현재 크기를 변환한다.
- Viewport 기본 단위는 Width=`vw`, Height=`dvh`. Height의 `vh/svh/lvh`는 값 control의 단위 메뉴에서 변경 가능하다. Canvas page frame과 Preview iframe/publish viewport 대응은 §5를 따른다.
- 비율은 유한한 양수, 입력 범위0.01~1000, step1, 소수 직접 입력 가능. 빈 값/NaN/0/음수는 commit하지 않고 기존 값 유지+inline 오류. Enter/blur commit, Escape 취소. 스크럽은 presentation 후1 transaction.
- 계산 결과가 없으면 `—`, 콘텐츠 자원이 준비 중이면 `측정 중`. `0px`는 실제0일 때만 표시한다.
- `min > max` 입력은 commit 전에 오류로 거부한다. 기존 CSS 충돌은 원문을 보존하고 제약 상태로 표시한다.
- Fill이 max에 도달해 공간이 남으면 “최대 너비640px 적용 중”처럼 실제 원인을 표시한다. 클릭이 실패한 것처럼 무반응으로 남기지 않는다.
- `균등/2:1`은 동일한 box 장식·제약 조건에서 기대하는 결과다. 서로 다른 padding/border/min/max가 있으면 최종 외곽 폭의 정확한 비가 아닌 분배 가중치라는 설명을 비율 control에 제공한다.

### 2.3 선택·접근성

다중 선택은 mode의 교집합을 사용한다. 하나라도 Fill이 불가능하면 전체 Fill은 비활성화하고 원인을 요약한다. 혼합값은 `혼합`이며 factor1로 잘못 표시하지 않는다. 사용자의 Fill 선택은 선택한 대상 각각에 factor1을 한 transaction으로 적용한다. 기존 Fill만 재선택한 단일 대상은 비율 유지.

RAC Select/Menu/NumberField 계약을 사용한다. 접근 이름은 `너비 크기 방식`, `너비 채우기 비율`, `계산된 너비`처럼 구분한다. mode 선택 후 focus가 사라지지 않는다. 계산된 px는 매 프레임 aria-live로 읽지 않고 commit 결과만 요약한다. 혼합 selection/선택 해제/문맥 변경 중 열린 입력은 대상 identity를 재검증한다.

## 3. 문맥과 사용 가능성

`ParentSizingContext`는 authored parent mode만 보고 만들지 않는다. effective catalog/layout + responsive cascade + ref 확장 + out-of-flow 위치 + logical axis 매핑을 사용한다. Free는 `display` 부재의 별칭이 아니며 편집기의 자유 배치 의미다. 일반 block/inline-block Flow와 명시적으로 구분한다.

| 부모/자식 문맥                 | Width Fill                                   | Height Fill                  | 비율     |
| ------------------------------ | -------------------------------------------- | ---------------------------- | -------- |
| Flex Row, in-flow              | main fraction                                | line cross stretch           | Width만  |
| Flex Column, in-flow           | line cross stretch                           | main fraction                | Height만 |
| Grid, in-flow                  | 할당 cell/area stretch                       | 할당 cell/area stretch       | 없음     |
| 일반 Block Flow, in-flow       | block의 가용 inline 영역 채우기              | 미지원                       | 없음     |
| inline/inline-block Flow child | 초기 범위 Fill 미지원, 이유 표시             | 미지원                       | 없음     |
| Free 또는 Absolute/Fixed child | 미지원                                       | 미지원                       | 없음     |
| Page root                      | 자식 Fill 문맥이 아님; 페이지 크기 계약 사용 | 페이지 콘텐츠 높이 계약 사용 | 없음     |

표는 horizontal writing-mode 예시다. row-reverse/column-reverse는 같은 주/교차축을 사용한다. writing-mode가 달라지면 physical Width/Height와 inline/block 축을 매핑하며, 지원하지 않는 engine 조합은 enabled로 거짓 표시하지 않는다. wrap에서 비율 분배는 각 line 내부, 교차축 stretch도 line 높이 기준이다.

사용 가능성은 다음처럼 반환한다. “선택 가능”과 “저장된 intent의 현재 해석 상태”를 분리한다.

```ts
type SizingAvailability = {
  mode: PublicSizeMode;
  enabled: boolean;
  reason?: string; // 번역 키
};
type SizeResolutionStatus =
  | "resolved"
  | "pending-measurement"
  | "indefinite-basis"
  | "unsupported-context";
```

새 Fill 선택은 main 가용 공간 또는 cross line/area가 독립적으로 정해질 수 있을 때 허용한다. 부모가 Fit이고 자식 Fill과 순환한다면 disabled다. 이미 저장된 Fill의 문맥이 일시적으로 indefinite가 되면 intent를 유지하고 native intrinsic fallback으로 배치하되 `indefinite-basis`를 표시한다. 자동으로 부모·조상 크기를 Fixed로 바꾸지 않는다.

Relative 기준은 단순 부모의 used px가 아니라 **해당 자식·축·계산 단계의 percentage basis**다. out-of-flow의 containing block과 Grid area를 반영한다. 현재 엔진이 지원하지 않는 containing-block 조상 체인에 UI만 새로운 지원을 선언하지 않는다. `resolvedPx`, `percentageBasisPx`, `isDefiniteForPercentage`, `layoutVersion`을 구분한다.

Fit capability는 catalog의 축별 계약으로 정의한다. Text/일반 Flow·Flex·Grid 컨테이너/자연 크기 이미지/자체 측정 component는 후보이며 primitive rectangle에는 노출하지 않는다. 컨테이너의 마지막 자식 삭제나 이미지 loading은 capability 삭제가 아니다. 빈 컨테이너는 padding/border/min으로, 이미지 loading은 pending 상태로 해석한다. absolute-only 자식은 intrinsic 기여에서 제외한다. Free 컨테이너의 absolute 자식 bbox를 암묵적으로 Hug하는 기능은 만들지 않는다.

## 4. Canonical 데이터와 소유권

### 4.1 저장 위치

목표 저장 위치는 `CanonicalNode.sizing`이다. `fills`와 같은 노드 수준 시각 authored 필드로 제안하며 `props.size`나 임의 metadata로 저장하지 않는다. breakpoint는 `CanonicalNode.responsive.sizing` 전용 분기에 두어 기존 CSS scalar emitter에 object가 흘러가지 않게 한다. 타입·Zod·Pencil direct fields·ref override·DB document payload를 동시에 확장한다. 이 필드는 현재 구현되어 있지 않다.

```ts
type AxisSize =
  | { mode: "fixed"; value: number; unit: "px" }
  | { mode: "relative"; value: number; unit: "%" }
  | { mode: "fill"; factor: number }
  | { mode: "fit-content" }
  | {
      mode: "viewport";
      value: number;
      unit: "vw" | "vh" | "svh" | "lvh" | "dvh";
    };

type NodeSizing = {
  version: 1;
  width?: AxisSize;
  height?: AxisSize;
};
// 예: node.sizing.width = { mode: "fill", factor: 1 }
// node.responsive.sizing.tablet.width = { mode: "fixed", value: 320, unit: "px" }
```

축 객체는 leaf merge하지 않고 mode/value/unit/factor를 한 단위로 교체한다. base는 기본이며 tier override는 기존 명시 opt-in을 따른다. tablet→mobile cascade는 축 객체 전체를 상속한다. Reset은 해당 tier 축을 삭제하여 상속하고, 모든 breakpoint를 동시에 지우지 않는다.

schema는 discriminated union을 실제로 검증한다. Fixed/Relative/Viewport 값은 유한한0 이상이며 Relative100% 초과는 허용한다. Fill factor는0.01~1000, fit-content에는 불필요한 value/unit을 저장하지 않는다. 지원하지 않는 imported unit/formula는 손실 변환하지 않고 legacy payload로 유지한다. unknown sizing version은 편집 전에 거부한다.

Min/Max와 aspect ratio는 기존 canonical `props.style`/responsive style의 정본을 유지한다. semantic sizing은 이 제약을 입력으로 소비하며 동일값을 새 필드에 중복 저장하지 않는다. geometry와 `isDefinite`는 runtime 결과로 DB에 저장하지 않는다.

### 4.2 CSS·semantic 이중 정본 방지

- semantic 축이 존재하면 그 scope에서 해당 축 width/height와 문맥에 따른 flex/align 출력을 compiler가 소유한다. CSS 출력은 derived이며 authored style로 재저장하지 않는다.
- 소유 속성은 axis별 고정 목록으로 따로 지우지 않는다. 두 축의 최종 intent와 parent context를 한 번에 받아 `width/height/flexGrow/flexShrink/flexBasis/alignSelf/justifySelf`의 combined ownership mask와 출력을 만든다. 공유 flex 속성을 반대 축 편집이 삭제하지 않게 한다.
- 신규 mode commit은 해당 scope의 충돌 CSS를 canonical transaction에서 제거하고 semantic intent를 기록한다. 반대 축의 실효 동작을 먼저 계산해 보존하며, 알 수 없는 legacy CSS를 추정 삭제하지 않는다. 모호한 공유 속성이 있으면 그 속성을 포함한 보존 payload를 planner가 유지하고 G2에서 검증한다.
- catalog/origin의 기존 size CSS가 뒤에서 다시 이기지 않도록 compiler 출력은 같은 scope에서 우선 적용한다. “삭제했으므로 auto일 것”에 의존하지 않고 필요한 reset CSS를 명시한다. inherited base semantic과 더 구체적인 tier CSS의 충돌도 effective cascade에서 판정한다.
- 외부 import/raw CSS/AI/resize/Layout preset 등 기존 쓰기 진입점도 semantic owner를 통과한다. semantic 축에 raw width 쓰기를 조용히 무시하거나 두 값 모두 active로 두지 않는다. 지원값은 명시 intent edit으로 정규화하고, 표현 불가 CSS는 해당 축 semantic을 해제하는 명시 legacy 전환으로 처리한다.
- Alignment 편집이 Fill stretch를 해제해야 하면 해당 축을 현재 px의 Fixed로 바꾸는 크기 영향이 control 설명에 드러나야 하며 한 transaction으로 처리한다. 자동 margin 같은 별도 authored 제약을 Fill 선택이 조용히 삭제하지 않는다. 채우기와 양립 불가하면 사용 불가 사유를 먼저 표시한다.

### 4.3 기존 문서·마이그레이션

기존 문서 전체를 CSS 패턴으로 일괄 변환하지 않는다. 특히 `100%`는 Relative100인지 Fill인지 확정할 수 없고 `auto`는 mode가 아니다. legacy reader는 기존 값을 그대로 소비한다. UI에서는 명시 px/%/viewport/fit-content만 안전하게 표시하고 애매한 조합은 `기존 값`으로 남긴다. read 과정에서 저장하지 않는다.

사용자가 mode를 선택하면 그 축·scope의 소유권만 새 모델로 이전한다. 변경 전 원본은 기존 Undo inverse에 보존한다. 미편집 문서/노드의 정규화 외 재직렬화0, 무관한 필드 값 변경0을 gate로 고정한다. migration 비용은 corpus 문서수 D, 노드수 N, legacy sizing 노드수 L, 편집 전환 노드수 E를 실측하여 보고한다. 기존 사용자의 영향률은 아직 미측정이며0%라고 주장하지 않는다. 최초 일괄 backfill 없음, 편집 전환 비용은 affected node/parent의 범위다.

새 schema marker가 있는 문서를 구버전 editor가 수정하면 sizing 유실 위험이 있다. 출시 gate는 지원 버전 검사와 원본 보존/읽기 전용 오류를 포함한다. canonical migration은 순수·멱등 형식 변환만 수행하고 DOM/Canvas를 측정하지 않는다. roll-back은 릴리스 전 원본 백업과 지원 reader를 전제로 하며 feature flag off만으로 구버전 writer를 안전하다고 간주하지 않는다.

## 5. 공통 해석과 계산

```text
canonical + ref/origin + catalog + responsive scope
  → effective authored intent / parent context
  → resolveSizingContract (순수 shared 계약)
      ├─ available modes + status → 패널
      ├─ CSS declarations / tier rules → Preview · publish
      └─ normalized layout style → Rust engine → Canvas
  → used rect + constraint reason → 계산된 크기 표시
```

Rust와 TypeScript가 같은 함수 본문을 실행한다는 뜻은 아니다. **semantic 해석은 shared TypeScript**, 실제 CSS layout은 브라우저/Rust가 담당한다. panel과 renderer가 서로 다른 availability 표를 만들지 않는다. publish가 Builder store나 런타임 geometry에 의존하지 않게 한다.

### 5.1 mode별 배치 계약

| mode/context              | 목표 해석                                                                                                 |
| ------------------------- | --------------------------------------------------------------------------------------------------------- |
| Fixed, Flex 주축          | px 요청값 + `flex: 0 0 auto`; 암묵 shrink로 “고정”이 줄어들지 않음. overflow는 기존 정책으로 처리         |
| Relative                  | 해당 percentage basis의 `%`; Flex 주축에서는 명시 크기처럼 shrink0. 부모보다 큰 합이면 임의 축소하지 않음 |
| Viewport                  | 페이지 화면 기준 단위; Flex 주축 shrink0                                                                  |
| Fill, Flex 주축           | 정규화 grow, shrink1, basis=`0px`; 기존 width/height를 무효화하는 명시 auto/reset 포함                    |
| Fill, Flex 교차축         | 해당 dimension auto + align-self stretch; line에 맞춤                                                     |
| Fill, Grid                | dimension auto + 해당 justify-self/align-self stretch; track 정의 무변경                                  |
| Fill, Block Flow inline축 | 정상 block의 auto stretch-fit 의미, margin/padding을 고려; 단순100% 치환 금지                             |
| Fit Content               | CSS fit-content 의미를 채택. 가용 공간·min/max-content를 반영; Flex 주축 grow0, shrink1, basis auto       |

주축 Fill은 content 자동 최소 크기로 채우기가 막히지 않도록 **명시 Min이 없는 해당 주축**의 기본 min을0으로 투영한다. explicit Min/Max는 우선한다. 긴 내용의 줄바꿈/overflow는 해당 component 계약을 유지한다. 교차축/Grid/replaced intrinsic image는 무조건 min0으로 덮지 않고 fixture로 검증한다.

factor는 canonical에 축별 저장한다. positive decimal을 CSS grow에 그대로 쓰면 합계1 미만일 때 남는 공간을 모두 채우지 못할 수 있으므로 같은 parent/tier의 활성 Fill factor들에 공통 배율을 적용한다: `scale = 1 / min(1, minFactor)`, `grow = factor * scale`. 모든 활성 grow≥1, 비율은 유지한다. wrap의 각 line에서도 공간 채움 조건이 유지된다. 이 sibling 정규화는 derived이며 다른 자식의 authored factor를 바꾸지 않는다. static output에도 해당 tier의 같은 계산을 적용하고 동적 자식 집합 변경은 parent 단위로 다시 compile한다.

legacy grow 자식과 혼합된 경우에는 실효 유한 양수 grow도 공통 배율 집합에 포함해 자유 공간 배분의 상대 비율을 보존한다. legacy의 basis/shrink/Min/Max는 바꾸지 않으며 이 경우 전체 외곽 크기의 factor 비례를 약속하지 않는다. 새 semantic Fill이 하나도 없는 parent는 정규화하지 않아 기존 문서의 동작을 유지한다. grow가 지원하지 않는 수식이면 compiler가 해석 가능한지 먼저 검증하고 미지원 상태를 명시한다. mixed legacy/native fixture도 G2/G3에 포함한다.

분배는 padding/border/margin/gap·고정 형제를 제외한 공간과 box 모델에 따른다. Min/Max는 분배 반복에 참여한다. 예: 가용900px, 장식/간격0, Fill1 세 개 중 첫 항목 max200이면 **200/350/350**. 단순 마지막 clamp인200/300/300은 실패다.

`Fill1/2/1`은 같은 조건에서250/500/250(분배 가능1000px)이 된다. CSS box 장식이 다르면 content 분배와 외곽 크기를 구분한다. 계산 결과 배지는 실제 border-box를 표시한다.

### 5.2 responsive·viewport·미해결 상태

parent direction/layout이 tier에서 달라져도 child의 base factor 객체는 유지한다. emitter는 child 자체 override뿐 아니라 **parent context가 변하는 tier**에도 필요한 child CSS/reset을 생성해야 한다. base Row Width Fill2 + mobile Column에서는 mobile Width stretch, mobile Height Fill factor가 주축을 맡는다. base의 flex-grow가 mobile에 잔존하지 않게 한다.

Viewport는 Builder 브라우저 창이나 zoom된 scene bbox가 아니라 Canvas page viewport와 Preview iframe viewport, publish browser viewport가 기준이다. `dvh`는 동적 viewport 입력을 엔진에 전달한다. `svh/lvh` 실제 차이를 재현할 환경이 없으면 그 단위의 지원/검증 경계를 표시하고 값만 같다고 통과 처리하지 않는다.

중요한 구분: 렌더 중 문맥 변화와 사용자 구조 편집은 다르다. resize/hydration/font/image loading/breakpoint 전환은 authored Fixed 변환을 일으키지 않는다. indefinite percentage는 native fallback으로 해석하고 상태를 노출한다. zero/NaN 또는 이전 breakpoint의 px를 정본에 쓰지 않는다. 계산값을 얻은 뒤에야 eligibility가 변하는 경우 resolution loop를 만들지 않도록 generation 단위로 상태를 갱신한다.

## 6. 상태 전이와 geometry 보존

`planSizingTransition(beforeDocument, operation, beforeLayoutSnapshot, scope)`는 변경 대상과 영향받는 자식·tier를 미리 계산한다. snapshot은 node/ref path, document revision, layoutVersion, breakpoint, viewport/box 기준을 포함한다. 버전이 다르면 재계산 후 계획을 다시 만들며 stale snapshot으로 commit하지 않는다.

| Trigger                                   | 전이                                       | 보존/복원                                                       |
| ----------------------------------------- | ------------------------------------------ | --------------------------------------------------------------- |
| 고정→채우기                               | Fill factor1                               | 반대 축/형제 authored 불변                                      |
| Fill 비율1→2                              | Fill factor2                               | mode 불변; 한 Undo                                              |
| Row↔Column/reverse                        | authored 불변                              | 축 factor 유지, derived 속성 재생성                             |
| Free→Flex/Grid                            | Fixed/Relative 그대로                      | 자동 Fill·이전 Fill 자동 복원 없음                              |
| Flex/Grid→Free                            | 무효가 된 Fill만 Fixed(before used px)     | 변경 전 geometry+이전 intent 기록                               |
| Flow→Absolute                             | Fill 축 Fixed, 위치는 before geometry 보존 | width/height만이 아니라 x/y/inset 기준도 함께 검증              |
| Absolute→Flow                             | 유효한 이전 intent 복원 후보 적용          | 같은 부모·scope·후속 axis edit 없음 조건                        |
| Absolute에서 Width 수동 수정 후 Flow      | Width 복원 안 함                           | 미편집 Height만 독립 복원 가능                                  |
| Relative 기준이 사용자 구조 변경으로 무효 | 이전 geometry로 Fixed 변환                 | 상대 기준 변경 후 동일%가 다른 크기를 만들면 geometry 보존 우선 |
| runtime 기준 미확정                       | authored 유지                              | pending/indefinite 표시, 영속 쓰기0                             |
| Canvas resize                             | 드래그한 축을 Fixed 결과로 확정            | 반대 축 intent 유지; aspect lock 계산 결과를 별도 취급          |
| Reset                                     | 해당 scope 축 override 삭제                | catalog/inherited 값으로 복귀; 과거 모드의 무조건 부활 금지     |

geometry 보존은 layout border-box와 실제 containing block 좌표를 사용한다. 회전/scale된 화면 AABB를 width/height로 저장하지 않는다. margin/inset/scroll/transform을 포함한 absolute 변환은 기존 위치 계약을 재사용한다. Fixed fallback은 같은 constraints를 유지하되 그 constraints 때문에 보존이 불가능하면 commit 전에 설명하고 계획을 실패시킨다. 조용히 반대 축·constraint를 삭제하지 않는다.

이전 intent 기록은 `CanonicalNode`의 typed editor extension `x-composition.sizingRestore`에 축·scope별 최대1개만 둔다. active sizing과는 별도인 복원용 기록이며 layout 소비자는 읽지 않는다. 내용은 previous intent, 자동 적용한 Fixed 값/위치와 scope fingerprint, parent identity다. manual axis edit/reset/reparent가 기록을 무효화한다. 저장·refresh·Undo/Redo는 이 기록을 포함하고 복제/붙여넣기에서는 parent identity가 달라지므로 폐기한다. 위치 변화만으로 반대 축 기록을 모두 지우지 않는다.

구조 변경이 base 공통이면 영향받는 모든 effective tier의 before geometry를 준비한다. 숨겨진 tier snapshot이 없으면 해당 viewport로 결정론적 layout 계산을 먼저 수행한다. 필요한 측정을 얻지 못하면 구조 변경을 적용하지 않고 “크기를 계산한 뒤 다시 시도” 상태를 보여준다. 현재 화면 px를 모든 breakpoint에 복사하지 않는다. planner가 생성하는 보존용 tier Fixed override도 같은 transaction/Undo에 포함한다.

직접 부모를 바꾸는 reparent는 새 문맥에서 유효한 intent를 우선 유지한다. 무효한 Fill은 이전 geometry로 Fixed가 되며, old parent의 복원 기록은 사용하지 않는다. 사용자가 이전 intent 복원을 명시적으로 요청하는 별도 명령은 초기 범위에 넣지 않는다.

## 7. 구현 순서와 파일 경계

예상 파일 수를 확정 실측처럼 쓰지 않는다. Phase0에서 실제 목록을 확정한다. 아래는 책임 경계이며 새 함수명/파일명은 제안이다.

| Phase | 작업·소유 범위                                                                       | 현재 관련 파일/경로                                                                                                                                                                | 종료 조건                                 |
| ----- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 0     | 사용자 보고 재현·지원 context/capability/corpus 및 비용 baseline 확정                | TransformSection, sizeModeResolver, canonical read/write/DB 경로                                                                                                                   | G0, fixture 명세 확정                     |
| 1     | canonical 타입/schema·legacy reader·semantic compiler·저장 왕복, 비노출 상태로 통합  | `packages/shared/src/types/composition-document.types.ts`, `schemas/project.schema.ts`, `types/responsive.types.ts`, 신규 `sizing/`; `adapters/canonical`, canonical store/history | G2, compiler 단위 fixture                 |
| 2     | 새 Size control·transaction planner·responsive/renderer 소비·typed invalidation 통합 | TransformSection 대체 control, styles hooks, store actions, Preview/publish 출력, `workspace/canvas/layout`, `packages/engine`                                                     | G1/G3/G4, 새 UI 공개 전 세 경로 동일 입력 |
| 3     | foreground 과업·사용성 관찰·비용 실측·문서/legacy cleanup                            | 기존 browser harness, 인접 테스트, CHANGELOG, ADR/README                                                                                                                           | G5/G6 및 전체 gate 증거                   |

Layout cache/invalidation은 `.agents/rules/layout-engine.md`의 A(layoutVersion)/B(signature) 양쪽에 semantic field와 parent context 의존성을 반영한다. 전체 문서를 매 frame 재compile하지 않는다. sibling 집합/순서/display/position/visibility/constraint/factor가 바뀌면 해당 parent/tier를 무효화한다. font/image/capability readiness는 측정 결과를 무효화한다. 삭제된 노드의 cache는 폐기한다.

CSS generator catalog 기본값 변경은 이 ADR의 필수 전제로 삼지 않는다. 신규 authored sizing compiler의 우선순위를 자체 검증한다. 병행 [ADR-223](../223-generated-css-default-archetype-neutralization.md)과는 기본 스타일 잔존 fixture를 공유할 수 있지만 scope를 합치지 않는다.

## 8. 검증 fixture와 evidence

| 축        | 필수 시나리오                                                         | 실패 조건                                      |
| --------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| 과업      | Fixed child→Fill 항목1회, 다른 형제Fixed, 기존 max/긴문자열           | 추가fr 선택 필요, mode만 변하고 layout 미반영  |
| 분배      | 1:1/2:1/1:2:1, 0.1:0.2, 서로 다른 장식, gap, max200                   | 공백 잔존, 단순 clamp, 잘못된 외곽 비율 주장   |
| 문맥      | Row/Column/reverse/wrap, Grid span, Block/Free, Absolute              | cross/Grid 비율 필드, unsupported Fill enabled |
| intrinsic | 빈 컨테이너/자식 삭제, text wrap, 이미지loading, component capability | Fit intent 소실, loading을0으로 저장           |
| 전이      | Row→Column→Row, Flow→Absolute→Flow, 중간 수동 편집, reparent          | 비율 유실, 사용자가 편집한 값 덮음, x/y 점프   |
| tier      | base Row→mobile Column, tier override/reset, 다른 viewport 순회       | authored runtime 쓰기, inherited flex CSS 잔존 |
| 왕복      | DB refresh, import/export, origin/ref/descendant, 복제, history       | sizing/restore 유실, ghost CSS 우선권          |
| UX        | 240/320px 패널, 키보드, 다중 선택, stale focus, disabled 사유         | 잘림, 입력 의미 전환, focus 유실, 숨은 이유    |
| 성능      | 100/1,000 형제 parent, resize/비율 변경30회씩                         | G6 예산 초과, per-frame 전 문서 순회           |

수치 oracle은 실제 DOM 브라우저다. compiler 출력끼리 비교하거나 React 렌더만 보고 픽셀 정합으로 판정하지 않는다. 같은 viewport/폰트/콘텐츠로 Canvas scene rect와 DOM rect를 비교한다. 1px 목표를 넘는 텍스트 fixture는 임의 오차 완화 대신 원인과 지원 경계를 기록한다. negative probe는 Fill을 no-op으로 바꿨을 때 G1/G3 실패, mobile context invalidation을 막았을 때 G4 실패를 확인한다.

G5 사람 대상 시험은 “남은 공간을 채우세요”, “왼쪽 카드에 두 배의 공간을 배분하세요”처럼 UI 정답 단어를 먼저 가르치지 않는 과업으로 진행한다. 참가자는 현재 메뉴 구현을 모르는 사용자5명, 시작 화면/콘텐츠/제약을 통제한다. 브라우저 자동화 성공을 사용성 결과로 대체하지 않는다. 모집/실행이 없으면 그 gate는 UNVERIFIED로 남긴다.

문서 작성 단계에서는 링크·번호·필수 섹션·README·format·guard·diff만 검증한다. 제품 테스트·브라우저·성능·사용성 결과는 아직 없다. 실제 구현 시 인접 Vitest, TS typecheck, scoped preflight를 수행하고 사용자 가시 변경은 CHANGELOG에 반영한다.
