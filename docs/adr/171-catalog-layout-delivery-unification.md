# ADR-171: catalog 레이아웃 값의 소비자 비대칭 해소

## Status

Accepted — 2026-07-29 (Proposed 2026-07-28 · 리뷰 [round 1](reviews/171.md) 승인 — 이슈 4건 전부 `fixed`, CRITICAL/HIGH 0)

## Context

[ADR-142](completed/142-starter-spec-component-system-cutover.md) 로 D3(시각 스타일) SSOT 는 catalog(`COMPONENT_RULES_TABLE`) + theme/tokens 가 됐다. [ssot-hierarchy.md](../../.claude/rules/ssot-hierarchy.md) 는 그 SSOT 의 두 소비자(Builder/Skia · Preview/Publish DOM)를 **대등(symmetric)** 으로 규정한다 — 대칭의 정의는 "시각 결과의 동일성" 이다.

**본 ADR 의 domain 은 D3 단일**이다. D1(RAC DOM/ARIA) · D2(props/API) 는 건드리지 않는다 — catalog 값이 이미 정해져 있고, 그 값이 두 소비자에게 **도달하는 경로**만 다룬다.

2026-07-28 실측 결과 이 대칭은 성립하지 않는다.

**Hard Constraints** (전부 2026-07-28 실측):

1. **비대칭 21종** — 생성 CSS 가 `index.css` 에 import 되어 DOM 은 값을 받지만, `resolveContainerStylesFallback()` 은 해당 layout 키를 반환하지 않는다. 대표 실측: MenuItem 을 캔버스에 배치하면 Skia `390×96`(세로 스택), CSS 실효값은 `height:32 · inline-flex · padding 4/12 · gap 8`.
2. **그중 9종은 생성 CSS root 선언 ≠ 실효 computed 값** — 수동 CSS 가 덮는다. Slider `position:absolute → static`(실효 `display:grid`), Pagination `justifyContent:center → space-between`. **생성 CSS root 를 그대로 엔진에 실으면 9종이 틀린 값을 받는다.**
3. **생성 CSS 94개 중 62개만 import** — 나머지 32개(layout 값 보유 30종)는 DOM 도 받지 못한다. 이들의 현재 시각은 factory 인라인이 만든다.
4. **catalog 전달 경로가 3갈래** — `COMPONENT_RULES_TABLE` 123 키(PascalCase 121 + `body`/`frame`) 중 경로 A(top-level `containerStyles`) 24종 · 경로 B(`structure.composition` 게이트 뒤 `resolveCatalogContainerBase`) 25종 · **나머지 74종은 어느 쪽도 아님**. 경로 A 가 먼저 return 하므로 두 조건을 모두 만족하는 종(Slider/ToggleButtonGroup 등)은 A 로 집계했다. 여기에 `implicitStyles` 수기 배선 18종이 별도로 얹혀 있다.
5. **엔진 결함은 없다** — MenuItem 에 catalog 8키를 주입하자 `280×32`, 자식 x=`12/44/121/199` 로 CSS 값을 정확히 재현했다. 전달만 끊겨 있다.
6. **검증 오라클 부재** — parity 918 케이스는 전부 generic `box` + 인라인 style 이다(`harness.ts`: "노드 type 은 특수 분기(catalog/spec) 없는 generic block 컨테이너 `box`"). catalog 전달 축 fixture 는 **0건**이라 이 비대칭이 회귀해도 아무 테스트도 red 가 되지 않는다.
7. **인라인 우선 규칙이 catalog 를 항상 이긴다** — `resolveContainerStylesFallback` 은 `parentStyle[key] !== undefined` 면 catalog 를 건너뛴다. factory 가 catalog 값을 인라인으로 복제해 둔 컴포넌트(Card 계열)는 정상으로 보이지만 SSOT 를 우회한 상태다.

**Generator 지원 범위 선언** (`adr-writing.md` 반복 패턴 선차단 #2): 본 ADR 은 **CSS Generator 스키마를 확장하지 않는다**. 자식 selector / variant emit 능력은 현행 그대로이고, 변경은 ① catalog **값** 정정(9종) ② `index.css` import 판정 ③ resolver 배선뿐이다. Generator 미지원 기능에 의존하는 Phase 는 없다.

**BC 영향 수식화** (#3):

- **저장 스키마 무변경 — BC 0%**. canonical `props.style` / catalog schema 필드가 그대로다.
- 영향은 **렌더 결과**에만 발생한다: Phase 1 이 catalog 9종, Phase 4 가 `factories/definitions/*.ts` 7파일의 layout 인라인 약 260 선언(실측: `width` 86 · `display` 55 · `gap` 31 · `flexDirection` 28 · `alignItems` 19 · `padding` 계열 11 · `justifyContent` 8 · `height` 15)을 대상으로 한다. 그중 layout 축(`width`/`height` 제외)이 제거 후보다.
- 기존 문서 재직렬화 **불요** — 인라인 제거는 factory 정의 변경이라 이미 생성된 요소는 값을 유지한다. 시각 변화는 **신규 생성 요소와 origin 재저작분**에 한정된다.

**Soft Constraints**:

- 개발 단계라 문서 하위 호환 부담이 없다 — 사용자가 components 페이지 전면 재작성을 승인했다(2026-07-28).
- ADR-912 Phase 3-A-3b 가 이 영역을 명시적으로 이연했다(`implicitStyles.ts:318`). 보류 사유("`structure.composition` base 가 leaf 44 type 에 신규 진입 = surface-minimization 위반")는 지금도 유효하다.
- Card 계열처럼 인라인이 가려 주는 구간이 많아, 겉보기 정상이 실제 정상인지 육안으로 구별되지 않는다.

## Alternatives Considered

### 대안 A: 경로 B 게이트 제거 단독

- 설명: `resolveContainerStylesFallback` 의 `if (!resolveCatalogStructure(pascalKey)?.composition) return specOut;` 한 줄을 제거해 `structure.containerStyles` 를 전 컴포넌트에 개방한다. 코드 변경 최소.
- 근거: ADR-912 Phase 3-A-3a 가 이미 같은 resolver 로 field 계열 25종을 도달시킨 선례. 확장은 게이트 제거뿐.
- 위험:
  - 기술: **HIGH** — Hard Constraint 2 로 9종이 틀린 값(Slider `position:absolute` 등)을 받는다. catalog 값이 실효 DOM 과 어긋난 상태에서 전달만 열면 **새로운 비대칭을 만든다**.
  - 성능: LOW — resolver 호출 경로 불변.
  - 유지보수: MEDIUM — 값 불일치가 남아 "왜 이 컴포넌트만 이상한가" 가 반복 조사 대상이 된다.
  - 마이그레이션: LOW — 되돌리기 한 줄.

### 대안 B: 실효값 정합화 → 전달 경로 일원화 → 인라인 제거 (오라클 선행)

- 설명: ① 9종 catalog 를 실효 computed 값으로 정정 ② 미import 30종 판정 ③ resolver 를 단일 판정으로 통합 ④ catalog 컴포넌트 end-to-end parity fixture 신설 ⑤ factory 인라인 제거 ⑥ origin 재저작. fixture 를 인라인 제거 **앞**에 둔다.
- 근거: Chrome 을 차등 오라클로 쓴 [ADR-170](completed/170-engine-basic-axis-conformance-sweep.md) 과 같은 형태 — "무엇이 정답인가" 를 사람 판단이 아니라 실행 가능한 대조로 고정한다. Figma/Pencil 류 에디터도 스타일 해석기를 렌더 타깃마다 따로 두지 않고 단일 resolver 로 모은다.
- 위험:
  - 기술: MEDIUM — 9종 값 정정이 DOM 시각을 바꾸지 않는지 재측정으로 확인해야 한다(수동 CSS override 가 여전히 이기면 정정이 무의미).
  - 성능: LOW — resolver 1회 호출 유지, 인라인 제거는 오히려 store payload 감소.
  - 유지보수: **LOW(개선)** — 3갈래 → 1갈래, 수기 배선 18종 축소, 회귀는 fixture 가 감시.
  - 마이그레이션: MEDIUM — factory 인라인 제거가 기존 문서의 시각을 바꿀 수 있다. 개발 단계 + 페이지 재작성 승인으로 완화.

### 대안 C: 컴포넌트별 수기 배선 확대 (현행 방식 유지)

- 설명: 비대칭이 발견될 때마다 `implicitStyles.ts` 에 `containerTag === "x"` 분기를 추가한다. 지금 18종이 이 방식으로 덮여 있다.
- 근거: 현행 코드의 실제 관행. 즉시 효과, 국소 변경.
- 위험:
  - 기술: MEDIUM — 분기마다 catalog 값을 손으로 옮겨 적으므로 SSOT 사본이 늘어난다.
  - 성능: LOW.
  - 유지보수: **HIGH** — 21종 + 미판정분을 전부 분기로 만들면 40종 근처가 되고, catalog 가 바뀌어도 분기가 따라가지 않는다(현재 18종의 값이 실효 CSS 와 일치하는지도 미검증 — Phase 0 I3).
  - 마이그레이션: LOW.

### 대안 D: 엔진에 CSS 클래스 해석기 도입

- 설명: 엔진/Skia 경로가 생성 CSS 를 직접 파싱해 소비한다. 전달 문제를 원천 제거.
- 근거: 브라우저 엔진의 구조(스타일 해석 → 레이아웃).
- 위험:
  - 기술: **CRITICAL** — CSS 캐스케이드·`@layer`·수동 CSS override 를 엔진이 재구현해야 한다. Hard Constraint 5 가 "엔진 결함 없음" 을 실측했는데 엔진 표면을 대폭 늘린다.
  - 성능: HIGH — 프레임마다 캐스케이드 해석.
  - 유지보수: HIGH — D3 SSOT 가 catalog 인데 소비 경로가 CSS 문자열이 되어 의존 방향이 뒤집힌다.
  - 마이그레이션: HIGH.

### Risk Threshold Check

| 대안 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :--: | :--: | :------: | :----------: | :--------: |
| A    | HIGH | LOW  |   MED    |     LOW      |     1      |
| B    | MED  | LOW  |   LOW    |     MED      |   **0**    |
| C    | MED  | LOW  |   HIGH   |     LOW      |     1      |
| D    | CRIT | HIGH |   HIGH   |     HIGH     |     4      |

루프 판정: 대안 B 가 HIGH+ 0개이므로 추가 대안 탐색 불요. D 는 CRITICAL 1개 이상이라 근본적으로 다른 접근이 필요했고, 그 역할을 B(전달 층에서 해결)가 이미 맡고 있다.

**Phase 분리 검토** (`adr-writing.md` 반복 패턴 선차단 #4): 채택안의 HIGH+ 가 0이라 분리 강제 조건에 해당하지 않는다. 다만 Phase 6(origin 재저작 + components 페이지 재구축)은 **본 ADR 의 검증 게이트로만** 포함한다 — "공통 컴포넌트를 어떤 모습으로 다시 만들 것인가" 라는 저작 설계는 본 ADR 의 전달 계약과 직교하므로, 그 축이 실제로 커지면 별도 ADR 로 분리한다(재개 조건: Phase 6 이 catalog 값 자체의 재설계를 요구할 때).

## Decision

**대안 B: 실효값 정합화 → 전달 경로 일원화 → 인라인 제거 (오라클 선행)** 를 선택한다.

선택 근거:

1. **잔존 위험이 순서로 통제된다** — MEDIUM 2건은 모두 "확증 전에 바꾸지 않는다" 로 흡수된다. 9종 값 정정은 재측정으로, 인라인 제거는 fixture 로 감시한다. HIGH+ 가 0인 유일한 대안이다.
2. **엔진을 건드리지 않는다** — Hard Constraint 5 가 전달만 고치면 된다는 것을 실측했다. 변경 표면이 resolver + catalog 데이터 + factory 인라인으로 한정된다.
3. **fixture 를 인라인 제거 앞에 두는 순서가 본 결정의 핵심**이다. 반대 순서면 인라인이 결과를 가려 fixture 가 전부 GREEN 으로 통과하고 아무것도 증명하지 못한다.
4. ADR-912 의 보류 사유를 무효화하지 않고 **선행 조건을 채워서** 넘는다 — 게이트를 제거하기 전에 값이 옳음을 먼저 세운다.

기각 사유:

- **대안 A 기각**: Hard Constraint 2 의 9종에 틀린 값을 전달한다. "전달만 열면 된다" 는 값이 옳다는 전제 위에서만 성립하는데, 그 전제가 실측으로 반증됐다.
- **대안 C 기각**: SSOT 사본을 40종 규모로 늘린다. ADR-142 가 컴포넌트당 spec 파일을 없앤 이유와 같은 결함을 `implicitStyles` 분기 형태로 재생산한다.
- **대안 D 기각**: 엔진에 CSS 캐스케이드를 재구현하는 것은 실측된 문제(전달 배선)에 비해 표면이 과대하고, D3 SSOT 를 catalog 에서 CSS 문자열로 뒤집는다.

> 구현 상세: [171-catalog-layout-delivery-unification-breakdown.md](design/171-catalog-layout-delivery-unification-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                  | 심각도 | 대응                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | 9종 catalog 정정이 DOM 실효값을 바꿔 Preview/Publish 시각이 변한다                                                                                                                                                                                                                                                                                                                    |  MED   | Phase 1 종료 시 실효 computed 재측정 — 정정 전후 불변이어야 통과 (Gate G1)                                                                                            |
| R2  | factory 인라인 제거가 기존 문서의 시각을 바꾼다                                                                                                                                                                                                                                                                                                                                       |  MED   | Phase 5 fixture 도입 뒤에만 제거. 제거 전후 Skia box 불변 확증 (Gate G4)                                                                                              |
| R3  | Phase 0 인벤토리(I1~I3) 결과로 대상 목록이 크게 늘어 scope 가 팽창한다                                                                                                                                                                                                                                                                                                                |  MED   | 목록 확장은 Phase 진행, **방향 변경 시에만** ADR 재검토. `adr-writing.md` M3 정합                                                                                     |
| R4  | 미import 30종을 일괄 import 하면 수동 CSS 와 충돌해 DOM 이 바뀐다                                                                                                                                                                                                                                                                                                                     |  MED   | Phase 2 는 판정 표를 먼저 확정 — 일괄 import 금지                                                                                                                     |
| R5  | 신설 fixture 가 느려 CI 시간이 늘어난다                                                                                                                                                                                                                                                                                                                                               |  LOW   | 기존 parity browser 러너 재사용, 컴포넌트당 1 케이스                                                                                                                  |
| R6  | 수기 배선 18종 제거 시 size 의존 값(padding 등)이 catalog 로 표현 불가해 회귀                                                                                                                                                                                                                                                                                                         |  MED   | I3 에서 사전 판정 — 대체 불가 분기는 존치 + 사유 주석                                                                                                                 |
| R7  | **인라인 제거가 Inspector 의 dirty/reset baseline 과 어긋난다** — `useResetStyles.ts` 는 factory 인라인을 손으로 미러한 baseline 테이블을 갖고 있고(`StylesPanel.tsx:96` "factory 가 주입한 layout default 는 제외"), 과거 인라인만 넣고 baseline 을 빠뜨린 회귀가 있었다(`useResetStyles.ts:292`). 인라인이 사라지면 그 항목들이 stale 이 되고 "수정 N" 뱃지·reset 목적지가 어긋난다 |  MED   | Phase 4 를 Skia box 불변만으로 종결하지 않는다 — 같은 phase 에서 baseline 테이블의 대응 항목을 동시 정리하고, 패널 표시값·dirty 판정을 live 로 1회 exercise (Gate G4) |
| R8  | Phase 3 의 resolver 통합이 기존 계약 테스트 47 케이스(`resolveContainerStylesFallback.test.ts`, ADR-080 G1)를 필연적으로 RED 로 만든다 — 특히 `listboxitem`/`gridlistitem` → `{}` lock(102~110행)은 Phase 3 이 바꾸려는 바로 그 동작이다                                                                                                                                              |  MED   | 해당 테스트를 **의도된 변경 대상**으로 미리 선언하고(design §5), 케이스별로 "새 기대값이 실효 CSS 와 일치" 를 근거로 갱신 — 통째 삭제·skip 금지                       |

잔존 HIGH 위험 없음.

## Gates

아래는 **실행 순서**대로다 (Phase 1 → 2 → 3 → 5 → 4 → 6 — fixture 가 인라인 제거보다 앞선다).

| Gate | 시점                          | 통과 조건                                                                                                                                              | 실패 시 대안                                         |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| G1   | Phase 1 종료                  | 9종 catalog 정정 후 실효 computed 값이 정정 전과 **불변**                                                                                              | 해당 종은 정정 보류 + 수동 CSS 를 SSOT 로 명문화     |
| G2   | Phase 3 종료                  | 비대칭 21종의 Skia box 가 실효 DOM 값과 일치 (MenuItem `280×32` 등). 기존 `resolveContainerStylesFallback.test.ts` 47 케이스는 갱신 후 GREEN (R8)      | 경로 B 게이트 복원 후 개별 진단                      |
| G3   | Phase 5 도입 (**Phase 4 앞**) | 신설 fixture 를 Phase 3 을 일시 되돌린 상태에서 돌려 **RED** 임을 확인                                                                                 | 오라클이 결함을 못 잡음 → fixture 재설계             |
| G4   | Phase 4 종료                  | factory 인라인 제거 전후 Skia box **불변**(fixture GREEN 유지) **＋** Inspector 의 표시값·"수정 N" 뱃지·reset 결과가 제거 전과 동등 (R7 live exercise) | 해당 컴포넌트 인라인 존치 + catalog 미도달 사유 기록 |
| G5   | Phase 6 종료                  | components 페이지를 catalog 만으로 재저작해 live builder 에서 시각 정상                                                                                | 잔여 인라인 목록화 후 후속 판정                      |

## Consequences

### Positive

- catalog 가 D3 SSOT 로서 **실효**를 갖는다 — 값을 고치면 두 소비자에 함께 반영된다.
- 전달 경로 3갈래(A 24 / B 25 / 수기 18) → 단일 판정. `implicitStyles.ts` 의 컴포넌트별 분기가 축소된다.
- 회귀 감시가 생긴다 — `apps/builder/tests/parity/catalogComponentBox.browser.test.ts` 가 catalog 전달 축을 잠근다(현재 0건).
- reusable / slot / origin / instance 작업의 선행 조건이 해소된다 — origin 이 catalog 를 우회한 인라인을 굳히지 않게 된다.

### Negative

- catalog 데이터 변경이 9종 + Phase 2 판정분에 발생한다 — `packages/shared/src/catalog/**` 와 재생성 CSS 가 함께 움직인다.
- `apps/builder/src/builder/factories/definitions/*.ts` 의 layout 인라인이 대량 제거되어, 기존 문서를 열었을 때 시각이 달라질 수 있다(개발 단계 + 페이지 재작성 승인으로 수용).
- Phase 0 인벤토리(I1)가 grep 으로 불가능해 라이브 배치 실측이 필요하다 — 착수 비용이 앞단에 몰린다.
