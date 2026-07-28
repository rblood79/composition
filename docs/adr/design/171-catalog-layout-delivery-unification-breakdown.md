# ADR-171 구현 상세 — catalog 레이아웃 값의 소비자 비대칭 해소

> 본 문서는 [ADR-171](../171-catalog-layout-delivery-unification.md) 의 구현 상세다. 결정·위험·Gate 는 ADR 본문에 있다.

## 1. Fork checkpoint 4 질문 lock-in

본 ADR 은 ADR-912 Phase 3-A-3b 가 명시적으로 이연한 영역(`implicitStyles.ts:318` — "composition 부재 base 보강은 3-A-3b 별도 영역")을 이어받으므로 fork 게이트 대상이다.

| #   | 질문                       | 판정                                                                                                                                                                                                                                                                  |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | base / 응용 분류           | **본 ADR = 응용**. base 는 ADR-142(D3 SSOT = catalog) · ADR-912(spec → catalog cutover). 본 ADR 은 그 SSOT 를 **소비자에게 전달**하는 층만 다룬다 — 새 SSOT 를 만들지 않는다                                                                                          |
| 2   | schema 직교성              | **직교**. catalog schema(`structure.containerStyles` / `containerStyles`) 는 그대로 두고 resolver 와 CSS import 배선만 바꾼다. 단 §3 Phase 1 의 9종은 **값 정정**이라 schema 가 아닌 데이터 변경                                                                      |
| 3   | 선행 ADR 전제 reverse 검증 | ADR-912 의 보류 사유는 "`structure.composition` base 가 leaf 44 type 에 신규 진입 = surface-minimization 위반" 이었다. **그 전제는 유효하다** — 그래서 본 ADR 은 경로 B 게이트를 그냥 제거하지 않고, 실효값 정합화(Phase 1)를 선행 조건으로 둔다. 의존 방향 반전 없음 |
| 4   | codex 3차까지 미루지 않음  | fork 시점(본 문서) 에 1~3 lock-in 완료                                                                                                                                                                                                                                |

사용자 explicit confirm: 2026-07-28 세션 — 실측 4회(정적 격차 / 실효 computed / import 여부 / 라이브 주입) 후 "adr 작성해".

## 2. Phase 0 인벤토리 (착수 전 필수 — 실측으로 목록 확정)

ADR 본문 Context 의 수치는 2026-07-28 실측이다. 아래 3건은 **목록 크기**만 바꾸고 방향은 바꾸지 않는다 (`adr-writing.md` M3 — 추정↔실측 gap 은 Phase 0 흡수).

| I   | 인벤토리                                 | 방법                                                                                                              | 산출물                           |
| --- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| I1  | 미import 30종의 실제 스타일 공급원       | grep 불가(composite factory 가 자식 생성) → 각 컴포넌트를 빈 페이지에 배치 후 store `props.style` + Skia box 실측 | 30종 × {인라인 보유 / 미도달} 표 |
| I2  | 비대칭 21종의 팔레트 등록·도달 범위      | `entryUniverse.ts` + 팔레트 등록 목록 대조                                                                        | 실사용 도달 가능 부분집합        |
| I3  | 수기 배선 18종의 값 ↔ 실효 CSS 일치 여부 | `applyImplicitStyles` 분기별 값 ↔ §4 실효 computed 대조                                                           | 일원화 대상 편입 여부            |

I1~I3 결과로 Phase 2·3 의 대상 목록을 확정한다. **결과가 Decision 을 뒤집으면 그때만 ADR 재검토** (그 외에는 목록만 갱신).

## 3. Phase 분해

### Phase 1 — 실효값 ↔ catalog 정합화 (9종)

생성 CSS root 선언이 수동 CSS 에 덮이는 9종. **실효 computed 값이 정본**이고 catalog 를 그 값으로 정정한다.

| 컴포넌트    | 생성 CSS root                             | 실효 computed (정본)                                             |
| ----------- | ----------------------------------------- | ---------------------------------------------------------------- |
| Slider      | `position:absolute` · `alignItems:center` | `display:grid` · `position:static` · `alignItems:normal`         |
| Pagination  | `inline-flex` · `justifyContent:center`   | `flex` · `justifyContent:space-between` · `gap:8px`              |
| Meter       | gap 토큰 3종 혼재                         | `display:grid` · gap `4px`                                       |
| ProgressBar | 〃                                        | `display:grid` · gap `4px`                                       |
| Popover     | `position:fixed` · pad 16 · gap 12        | + `display:flex` · `flexDirection:column`                        |
| TabPanel    | pad 12                                    | + `display:flex` · `flexDirection:column`                        |
| TableView   | `justifyContent:center`                   | + `display:flex` · `flexDirection:column` · `alignItems:stretch` |
| Dialog      | `position:fixed` · pad 40 · gap 12        | + `overflow:auto`                                                |
| Tab         | pad 4/12 · inline-flex · center           | + `position:relative`                                            |

- 정합화 방향은 **catalog → 실효값**이다. 반대(수동 CSS 를 catalog 에 맞춤)는 DOM 시각을 바꾸므로 금지.
- 정정 후 생성 CSS 를 재빌드하고, 실효 computed 가 **변하지 않았는지** 재측정한다(수동 CSS override 가 여전히 이기면 정정이 무의미).
- 산출물: catalog 9종 + `pnpm build:specs` 재생성 CSS.

### Phase 2 — 미import 30종 판정 (I1 결과 소비)

생성 CSS 94개 중 62개만 `index.css` 에 import 됨. 나머지 32개(그중 layout 값 보유 30종)는 DOM 도 못 받는다.

| 판정                                                                            | 처리                                                                                     |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 수동 CSS 가 이미 담당 (`.react-aria-X` 존재 — FieldError/Input/GridListItem 등) | 생성 CSS 파일 **삭제 또는 미import 유지 명문화** + catalog 값을 수동 CSS 실효값으로 정정 |
| 어느 채널도 없음                                                                | import 추가 → DOM·엔진 동시 도달                                                         |
| factory 인라인이 유일 공급원                                                    | Phase 4 의 인라인 제거 대상에 편입                                                       |

- **판정 없이 일괄 import 금지** — 수동 CSS 와 충돌하면 DOM 시각이 바뀐다.

### Phase 3 — 전달 경로 일원화 (21종 + I2·I3 편입분)

- `resolveContainerStylesFallback`(`implicitStyles.ts`)의 경로 A/B 2분기를 **단일 판정**으로 통합: catalog 의 top-level `containerStyles` 와 `structure.containerStyles` 를 같은 우선순위 체인에서 읽는다.
- 경로 B 의 `structure.composition` 게이트 제거는 **Phase 1 완료 후에만** 허용 (게이트가 지금 잘못된 값의 유출을 막고 있다).
- `CONTAINER_STYLES_FALLBACK_KEYS` 확장 필요 여부는 I2·I3 결과로 판정.
- 수기 배선(`containerTag === "..."` 18분기) 중 catalog 로 대체 가능한 것은 제거 — 대체 불가(size 의존 padding 등)는 사유를 주석으로 남긴다.
- **기존 계약 테스트가 필연적으로 RED 가 된다** (R8): `resolveContainerStylesFallback.test.ts` 는 47 케이스가 `toEqual` 로 반환값을 통째로 고정한다(ADR-080 G1). 특히 `listboxitem`/`gridlistitem` → `{}` lock(102~110행)은 Phase 3 이 바꾸려는 동작 그 자체다. 케이스별로 **새 기대값이 실효 CSS 와 일치함**을 근거로 갱신한다 — 통째 삭제·`skip` 금지.

### Phase 4 — factory 인라인 제거

- catalog 가 도달하면 factory 의 layout 인라인(`display`/`flexDirection`/`alignItems`/`justifyContent`/`gap`/`padding` 계열)은 중복이다. 제거해야 catalog 가 SSOT 로 실효를 갖는다(`resolveContainerStylesFallback` 은 `parentStyle[key] !== undefined` 면 catalog 를 건너뛴다).
- 제거 전후 Skia box 가 **불변**임을 Phase 5 fixture 로 확증한 뒤 제거한다.
- **Inspector baseline 을 같은 phase 에서 함께 정리한다** (R7): `useResetStyles.ts` 는 factory 인라인을 손으로 미러한 dirty/reset baseline 을 갖고 있다(`StylesPanel.tsx:96` — "factory 가 주입한 layout default 는 제외"). 인라인만 빼고 baseline 을 두면 "수정 N" 뱃지와 reset 목적지가 어긋난다 — 반대 방향(인라인만 넣고 baseline 누락)의 회귀 이력이 이미 있다(`useResetStyles.ts:292`). 종료 조건은 Skia box 불변 **＋** 패널 표시값·dirty·reset live 확인.
- `width`/`height` 같은 layout-context 인라인은 대상 아님(요소별 저작 값).

### Phase 5 — end-to-end parity 오라클 신설

현행 `apps/builder/tests/parity/**` 918 케이스는 전부 generic `box` + 인라인 style 이다(`harness.ts` — "노드 type 은 특수 분기(catalog/spec) 없는 generic block 컨테이너 `box`"). catalog 전달 축 fixture 는 **0건**.

- 신규 fixture: 컴포넌트를 **생성 CSS 로 렌더한 DOM** ↔ **같은 컴포넌트의 Skia/엔진 box** 대조.
- DOM leg 은 `packages/shared/src/components/styles/index.css` 번들을 iframe 에 주입하고 `getComputedStyle`/`getBoundingClientRect` 로 측정(본 ADR 실측에 쓴 방법과 동일).
- **Phase 4 보다 뒤에 둘 수 없다** — 인라인이 살아 있으면 전부 GREEN 이 나와 아무것도 증명하지 못한다. 순서는 Phase 3 → 5(도입) → 4(인라인 제거, fixture 가 감시).

### Phase 6 — origin 재저작 + components 페이지 재구축

- 사용자 승인(2026-07-28: "components page내에 컴퍼넌트들은 전면 재작성되어도 상관없다") 범위.
- catalog 만으로 서는지 확인하는 **최종 live 게이트**.

## 4. 실측 근거 (2026-07-28)

| 측정              | 방법                                                           | 결과                                                         |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| 정적 전달 격차    | 생성 CSS root 92종 ↔ `resolveContainerStylesFallback(tag, {})` | 값 기준 실질 격차 69종, 수기 배선 제외 51종                  |
| import 여부       | `index.css` 의 `generated/*.css` 참조                          | 94개 중 **62개** import (unique `@import` 기준)              |
| 실효 computed     | 번들 CSS 를 iframe 에 주입 후 `getComputedStyle`               | 21종 중 **9종**이 root 선언 ≠ 실효값                         |
| 라이브 주입       | MenuItem 에 8키 주입 후 Skia box 재측정                        | 390×96 → **280×32**, 자식 x=12/44/121/199 — CSS 값 정확 재현 |
| catalog 경로 분포 | `componentRulesTable.ts` brace 매칭 스캔 (소문자 키 포함)      | 총 **123** · A 24 · B 25 · 미보유 **74**                     |
| factory 인라인    | `factories/definitions/*.ts` layout 키 grep                    | layout 축 141 선언 / **7 파일** (+ width 89 · height 15)     |

## 5. 파일 변경 예상

| 영역                   | 파일                                                                                                                                                     | Phase |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| catalog 값 정정        | `packages/shared/src/catalog/**` (9종 + Phase 2 판정분)                                                                                                  | 1·2   |
| 생성 CSS               | `packages/shared/src/components/styles/generated/*.css` (재빌드) · `index.css` (import 판정 — publish 도 `components/index.css` 경유로 같은 번들을 쓴다) | 1·2   |
| 전달 경로              | `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts` · `packages/specs/src/runtime/containerStylesFallback.ts`                   | 3     |
| **기존 계약 테스트**   | `apps/builder/src/builder/workspace/canvas/layout/engines/resolveContainerStylesFallback.test.ts` (47 케이스 `toEqual` lock — **의도된 갱신 대상**, R8)  | 3     |
| factory 인라인         | `apps/builder/src/builder/factories/definitions/*.ts` (layout 키 보유 **7 파일**: DateColor/Display/Form/Group/Navigation/Overlay/Selection)             | 4     |
| **Inspector baseline** | `apps/builder/src/builder/panels/styles/hooks/useResetStyles.ts` (factory 인라인 미러 baseline — R7)                                                     | 4     |
| fixture                | `apps/builder/tests/parity/catalogComponentBox.browser.test.ts` (신규)                                                                                   | 5     |

## 6. 체크리스트

- [ ] Phase 0 — I1/I2/I3 인벤토리 확정
- [ ] Phase 1 — 9종 catalog 정정 + 재빌드 + 실효값 불변 재측정 (G1)
- [ ] Phase 2 — 미import 30종 판정 표 확정 + 처리
- [ ] Phase 3 — resolver 단일 판정 통합 + 수기 배선 정리 + `resolveContainerStylesFallback.test.ts` 47 케이스 갱신 (G2)
- [ ] Phase 5 — parity fixture 신설 (**Phase 4 앞**) + Phase 3 일시 되돌림으로 RED 확인 (G3)
- [ ] Phase 4 — factory 인라인 제거 + `useResetStyles` baseline 동시 정리 (fixture GREEN + 패널 live 확인, G4)
- [ ] Phase 6 — origin 재저작 + components 페이지 live 확인 (G5)
