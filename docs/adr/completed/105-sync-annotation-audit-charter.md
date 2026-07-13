# ADR-105: @sync 주석 체계적 감사 Charter (F 카테고리 consumer-to-consumer debt 해소 로드맵)

## Status

Implemented — 2026-04-21 (첫 후속 sub-ADR 105-a Proposed 발행으로 Gate 충족)

## Context

### 배경 — ADR-063 SSOT 체인 위반 패턴

ADR-063 (SSOT 체인 Charter, Accepted 2026-04-21) 은 composition 의 3-domain 분할 구조를 명문화했다. 그 중 **D3 (시각 스타일) 영역에서의 핵심 금지 패턴**은 [`ssot-hierarchy.md` §4.2](../../../.claude/rules/ssot-hierarchy.md):

> `@sync` 주석으로 CSS↔CSS 참조는 consumer-to-consumer 금지 패턴.

`@sync`는 "이 값을 다른 파일과 손으로 맞춰야 한다"는 경고 마커다. 그 존재 자체가 Spec을 거치지 않는 직접 consumer-to-consumer 의존성을 의미한다. 이 debt는 개별 ADR 진행 중 각자 scope 밖으로 미뤄진 것들이 누적된 결과다.

### 실측 — 37건 분포

```
packages/specs/src/components/  : 24건 (23 라인 + 1 파일 주석)
packages/shared/src/             :  4건 (CSS 파일)
apps/builder/src/                :  9건 (factory + implicitStyles + utils + cssComponentPresets)
합계                             : 37건
```

상세 파일별 현황:

- `NumberField.spec.ts`: 5건 (ComboBox.spec.ts 참조 다수)
- `Tag.spec.ts`: 4건 (TagGroup.css / Button.css 참조)
- `Select.spec.ts` + `SelectTrigger.spec.ts` + `Input.spec.ts`: 각 1건 (BUTTON_SIZE_CONFIG 참조)
- `utils.ts` (builder): 5건 (ListBoxSpec / TagList.spec / Select.spec 참조)

### D3 domain 판정

**D3 (시각 스타일) 전용 작업**. `@sync` 주석 대부분이 크기/패딩/색상 값 동기화 경고이므로 D3 영역. D1 (DOM/접근성) 과 D2 (Props/API) 침범 없음.

단 factory 파일 내 `@sync`는 컴포넌트 구조 서술인 경우가 있어 D2 경계 포함 가능성 존재. 후속 sub-ADR 착수 시 개별 판정 필수.

### Hard Constraints

1. **본 Charter scope = 감사 + 로드맵만** — 코드 변경 0. 후속 sub-ADR (105-a, 105-b, ...) 이 실제 이관 수행.
2. **Step F/G 비충돌** — ADR-103 (CheckboxItems/RadioItems, Step F) / ADR-104 (Card 계열, Step G) 가 현재 병행 진행 중. 관련 spec 파일 `@sync`는 해당 ADR 완결 후 재평가.
3. **후속 sub-ADR 선행 타당성** — 각 sub-ADR 착수 전 해당 spec 값이 Spec SSOT 로 이미 승격 가능한지 재검증 (ADR-098 Addendum 1 패턴).
4. **testing 기준선 유지** — 후속 ADR 각각 type-check 3/3 + specs PASS + builder PASS 의무.

### 소비 코드 경로 (grep 가능 5건 이상 — 반복 패턴 체크 #1)

| 경로                                                                                                 | 역할                 | @sync 관련                                             |
| ---------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------ |
| `packages/specs/src/components/NumberField.spec.ts:7,389,439,928,941`                                | NumberField spec     | ComboBox.spec 구조 참조 5건                            |
| `apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts:1520,1521,1529,1568,1815`         | Canvas 레이아웃 계산 | ListBoxSpec / TagList.spec / Select.spec 참조 5건      |
| `packages/specs/src/components/Tag.spec.ts:57,65,74,75`                                              | Tag spec             | TagGroup.css / Button.css 참조 4건                     |
| `packages/specs/src/components/Select.spec.ts:296` + `SelectTrigger.spec.ts:94` + `Input.spec.ts:82` | Trigger/Input spec   | BUTTON_SIZE_CONFIG (utils.ts) 참조 — Spec→utils 역방향 |
| `packages/shared/src/components/styles/TagGroup.css:148,150` + `Badge.css:407` + `ListBox.css:99`    | CSS 파일             | Spec / Generator 참조 4건                              |

### Soft Constraints

- ADR-098 Charter의 감사 + 후속 분할 패턴이 RSP 네이밍 8개 카테고리에서 성공했음 — 동일 패턴 재사용
- Step F/G 완결 후 일부 `@sync` 항목이 자연 해소될 가능성 존재 (재감사 필요)

## Alternatives Considered

### 대안 A: Charter + 후속 sub-ADR 분할 (선정)

- 설명: 본 ADR은 37건 분류 매트릭스 + 카테고리별 이관 방법론 + 후속 sub-ADR 우선순위만 제공. 실제 spec 값 이관, 상수 primitives 이동, CSS 제거는 후속 sub-ADR (105-a~d) 에서 개별 수행.
- 위험:
  - 기술: LOW — 감사는 문서 작업. 코드 변경 0.
  - 성능: LOW — N/A.
  - 유지보수: LOW — 개별 ADR 분할이 각 카테고리의 복잡도 격리.
  - 마이그레이션: LOW — 본 ADR은 migration 수행 안 함.

### 대안 B: 단일 대형 ADR 에서 37건 일괄 이관

- 설명: 본 ADR에서 F1~F5 전체를 한 번에 처리. spec 값 이관 + utils 상수 primitives 이동 + CSS 해체 + builder 경로 수정 일괄 진행.
- 위험:
  - 기술: **HIGH** — F1 spec-to-spec 참조에는 Spec 상속 메커니즘 설계 필요. F2 spec-to-CSS 에는 Generator 자식 selector 확장 필요 (ADR-078/099 수준). F3~F5 포함 시 5+ spec 파일 + 3+ CSS 파일 + 5+ builder 파일 동시 변경. 병렬 회귀 위험 상승.
  - 성능: LOW.
  - 유지보수: **HIGH** — Step F/G 진행 중 spec 파일 동시 편집 → 충돌 위험. 단일 거대 PR 롤백 불가.
  - 마이그레이션: LOW — 저장 데이터 migration 불필요 (@sync는 값 참조 주석, element.tag 무관).

### 대안 C: 현 상태 유지 — @sync 주석 방치

- 설명: ADR을 발행하지 않고 각 컴포넌트 수정 시 자연적으로 해소될 때까지 방치.
- 위험:
  - 기술: LOW (현재 동작에 영향 없음).
  - 성능: LOW.
  - 유지보수: **HIGH** — D3 consumer-to-consumer 의존성이 영구화됨. ADR-063 §4.2 금지 패턴이 코드베이스에 37건 잔존. 각 수정마다 수동 동기화 비용 발생 + drift 감지 불가.
  - 마이그레이션: LOW.

### Risk Threshold Check

| 대안                      | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정     |
| ------------------------- | :--: | :--: | :------: | :----------: | :------: | -------- |
| A: Charter + 분할 sub-ADR |  L   |  L   |    L     |      L       |    0     | **PASS** |
| B: 단일 일괄 ADR          |  H   |  L   |    H     |      L       |    2     | 기각     |
| C: 현 상태 유지           |  L   |  L   |    H     |      L       |    1     | 기각     |

대안 A가 HIGH+ 0 + ADR-098 Charter (RSP 네이밍 8개 카테고리 분할) 선례 성공 확인 — threshold PASS.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- ✅ **#1 코드 경로 인용**: Context "소비 코드 경로" 표에 5건 이상 grep 가능 파일:라인 명시.
- ✅ **#2 Generator 확장 여부**: F2 (spec-to-CSS) 카테고리가 Generator 자식 selector emit 미지원 케이스 포함 가능성을 Context에 선언. 후속 sub-ADR (105-c) 에서 개별 판정.
- ✅ **#3 BC 훼손 수식화**: @sync 주석 해소는 값 이관/상수 이동이므로 element.tag 변경 없음 → BC 영향 0% 예상. 후속 sub-ADR 각각 재확인 의무.
- ✅ **#4 Phase 분리 가능성**: F1~F5 5개 카테고리 × 서로 다른 이관 메커니즘 → 후속 sub-ADR 4개 이상 예상. 단일 ADR 불가 판정.

## Decision

**대안 A (Charter + 후속 sub-ADR 분할) 채택**.

선택 근거:

1. **ADR-098 Charter 5회 분할 선례** — RSP 네이밍 감사 Charter 패턴이 ADR-100/101/102/103 에서 안정적으로 작동함. 동일 패턴 재사용.
2. **Step F/G 비충돌** — CheckboxItems/RadioItems (Step F) 및 Card 계열 (Step G) 진행 중인 spec 파일에 대한 @sync 처리를 해당 ADR 완결 후로 격리.
3. **카테고리별 이관 메커니즘 차이** — F1 (spec-to-spec) 은 Spec 상속/primitives 공유, F2 (spec-to-CSS) 는 Generator 확장, F3 (spec-to-utils) 는 primitives 이관으로 각각 다른 설계가 필요 → 분할이 필수.
4. **감사 우선** — 37건 중 일부는 이미 ADR 진행 중 자연 해소됐거나 Step F/G 후 재평가 필요 → 분류 매트릭스 확정이 선행 조건.

기각 사유:

- **대안 B 기각**: HIGH 2 초과. Step F/G 진행 중 spec 파일 동시 편집 충돌 위험. F1 카테고리는 Spec 상속 메커니즘 설계가 없어 이관 경로 미확정.
- **대안 C 기각**: ADR-063 §4.2 금지 패턴을 37건 방치하면 D3 SSOT 원칙이 코드베이스에서 형해화됨. 각 수정 시 수동 동기화 비용과 drift 위험이 지속적으로 발생.

> 구현 상세: [105-sync-annotation-audit-charter-breakdown.md](../../adr/design/105-sync-annotation-audit-charter-breakdown.md)

## 감사 매트릭스

37건 전체 분류. 상세 파일:라인 + 주석 원문은 breakdown 참조.

### F1. spec-to-spec 참조 (10건)

동일 Spec 파일 내 또는 다른 Spec 파일에서 값을 "수동으로 맞춰야 한다"는 경고.

| 파일                  | 라인          | 참조 대상                       | 비고                             |
| --------------------- | ------------- | ------------------------------- | -------------------------------- |
| `ComboBox.spec.ts`    | 259           | `Select.spec.ts sizes`          | ComboBox ↔ Select 크기 동기화    |
| `NumberField.spec.ts` | 7 (파일 주석) | `ComboBox.spec.ts`              | NumberField ≈ ComboBox 구조 참조 |
| `NumberField.spec.ts` | 389           | `ComboBox.spec.ts sizes`        | height/padding/iconSize          |
| `NumberField.spec.ts` | 439           | `ComboBox.spec.ts composition`  | 컨테이너/버튼 패턴               |
| `NumberField.spec.ts` | 928           | `ComboBox chevron`              | 감소 아이콘 패턴                 |
| `NumberField.spec.ts` | 941           | `ComboBox chevron`              | 증가 아이콘 패턴                 |
| `SelectIcon.spec.ts`  | 44            | `Select.spec.ts sizes.iconSize` | Select/ComboBox 동일 아이콘 크기 |
| `Tab.spec.ts`         | 63            | `Tabs.spec.ts`                  | TabsSpec.sizes와 동기화          |
| `Tabs.spec.ts`        | 140           | `Button.spec.ts`                | padding/fontSize 패턴 참조       |
| `TextField.spec.ts`   | 256           | `Button.spec.ts sizes`          | Input height = Button height     |

**이관 방법**: 공유 값을 `packages/specs/src/primitives/` 에 상수로 추출하거나, Spec 상속 메커니즘 신설.

### F2. spec-to-CSS 참조 (6건)

Spec 파일이 수동 CSS 파일의 값과 수동 동기화해야 한다는 경고.

| 파일                   | 라인  | 참조 대상                                | 비고                                 |
| ---------------------- | ----- | ---------------------------------------- | ------------------------------------ |
| `GridListItem.spec.ts` | 107   | `GridList.css padding/gap/border-radius` | fontSize=14 경로 동기화              |
| `ListBox.spec.ts`      | 218   | `containerStyles.background`             | CSS container와 동기화               |
| `ListBox.spec.ts`      | 238   | `CSS container padding`                  | `--spacing-xs`=4                     |
| `ListBoxItem.spec.ts`  | 132   | `sz.lineHeight`                          | typography token resolve             |
| `SelectValue.spec.ts`  | 47    | `Select.css font-size per size`          | CSS 선택자 값 참조                   |
| `Tag.spec.ts`          | 57,65 | `TagGroup.css`                           | `.react-aria-Tag` 기본/selected 색상 |

**이관 방법**: Generator 확장으로 CSS 값을 Spec에서 파생시키거나, 수동 CSS를 Spec→CSS auto-gen으로 전환. Generator 자식 selector emit 지원 여부 선행 확인 필수 (반복 패턴 체크 #2).

### F3. spec-to-utils 상수 참조 (4건)

Spec 파일이 builder의 utils.ts 상수 (`BUTTON_SIZE_CONFIG` 등) 와 수동 동기화 경고.

| 파일                    | 라인 | 참조 대상                       | 비고                                  |
| ----------------------- | ---- | ------------------------------- | ------------------------------------- |
| `Input.spec.ts`         | 82   | `BUTTON_SIZE_CONFIG (utils.ts)` | Input height = Button height          |
| `Select.spec.ts`        | 296  | `BUTTON_SIZE_CONFIG (utils.ts)` | Select trigger height = Button height |
| `SelectTrigger.spec.ts` | 94   | `BUTTON_SIZE_CONFIG (utils.ts)` | SelectTrigger height = Button height  |
| `DatePicker.spec.ts`    | 49   | `DateInput.spec.ts`             | DateRangePicker 동일 상수 import      |

**이관 방법**: `BUTTON_SIZE_CONFIG` 등 공유 상수를 `packages/specs/src/primitives/` 로 이관 (ADR-091 Class C 패턴). F3가 가장 단순하고 위험이 낮음 — 가장 먼저 착수 권장.

### F4. CSS-to-spec/generator 참조 (4건)

CSS 파일이 Spec 또는 Generator 값을 "손으로 맞춰야 한다"는 경고.

| 파일           | 라인 | 참조 대상                  | 비고                                    |
| -------------- | ---- | -------------------------- | --------------------------------------- |
| `TagGroup.css` | 148  | `Button.css size variants` | padding/fontSize/lineHeight             |
| `TagGroup.css` | 150  | `ButtonSpec.sizes`         | padding 동일                            |
| `Badge.css`    | 407  | `BadgeSpec.sizes`          | Button과 동일한 height/padding/fontSize |
| `ListBox.css`  | 99   | `Generator emit`           | `[data-disabled]` opacity/cursor        |

**이관 방법**: Spec → CSS auto-gen 전환이 이상적이나, `skipCSSGeneration: true` 제거가 전제 조건. ListBox.css #99는 Generator emit과 일치하면 이미 정당 → 주석 제거로 해소 가능.

### F5. builder-to-spec 참조 (9건)

builder 코드 (factory, implicitStyles, utils, cssComponentPresets) 가 Spec 파일 또는 CSS 파일과 수동 동기화 경고.

| 파일                     | 라인 | 참조 대상                                 | 비고                        |
| ------------------------ | ---- | ----------------------------------------- | --------------------------- |
| `DateColorComponents.ts` | 123  | `DatePicker 동일 구조`                    | factory 구조 서술 (D2 경계) |
| `FormComponents.ts`      | 416  | `ComboBox CSS DOM 구조`                   | factory 구조 서술 (D2 경계) |
| `implicitStyles.ts`      | 183  | `Select.css / ComboBox.css size variants` | 크기 파생 경고              |
| `utils.ts`               | 1520 | `ListBoxSpec.sizes.md`                    | paddingY/gap 동기화         |
| `utils.ts`               | 1521 | `containerStyles.borderWidth`             | borderWidth 동기화          |
| `utils.ts`               | 1529 | `ListBoxSpec.render.shapes`               | shapes entries 루프 동기화  |
| `utils.ts`               | 1568 | `TagList.spec.ts shapes()`                | wrap 시뮬레이션 동기화      |
| `utils.ts`               | 1815 | `Select.spec.ts / ComboBox.spec.ts sizes` | trigger 크기 동기화         |
| `utils.ts`               | 1986 | `DateInput.spec.ts INPUT_HEIGHT`          | DateInput intrinsic height  |
| `cssComponentPresets.ts` | 708  | `ToggleButton.css [data-size] padding`    | padding 동기화              |

(9건 목록에 cssComponentPresets.ts 포함 총 10줄이나, 1건은 Step F/G 완결 후 재평가)

**이관 방법**: Spec read-through 패턴 (ADR-079/080/083/086 계열). utils.ts가 Spec을 직접 참조하도록 전환. builder-to-CSS 경우는 CSS가 Spec에서 파생된 후 builder도 Spec을 참조하도록 변경.

### 카테고리 카운트 요약

| 카테고리                  |     건수     | 설명                             |
| ------------------------- | :----------: | -------------------------------- |
| F1. spec-to-spec          |      10      | Spec ↔ Spec 수동 동기화          |
| F2. spec-to-CSS           |      6       | Spec ↔ 수동 CSS 수동 동기화      |
| F3. spec-to-utils 상수    |      4       | Spec ↔ builder 상수 수동 동기화  |
| F4. CSS-to-spec/generator |      4       | CSS ↔ Spec/Generator 수동 동기화 |
| F5. builder-to-spec/CSS   | 9 (+1재평가) | builder ↔ Spec/CSS 수동 동기화   |
| **합계**                  |    **37**    |                                  |

## 후속 sub-ADR 우선순위 테이블

| 슬롯      | 카테고리 | 제목 (가칭)                                                                       | 우선순위 | 이유                                                           |
| --------- | -------- | --------------------------------------------------------------------------------- | :------: | -------------------------------------------------------------- |
| **105-a** | F3       | utils 공유 상수 primitives 이관 (`BUTTON_SIZE_CONFIG` 등)                         |    P1    | 코드 변경 최소, BC 0%, 위험 LOW — 가장 빠른 실질 해소          |
| **105-b** | F1       | spec-to-spec 참조 primitives 공유 (NumberField/ComboBox 5건 등)                   |    P2    | primitives 추출 또는 Spec 상속 메커니즘 설계 필요              |
| **105-c** | F2       | spec-to-CSS Generator 확장 또는 수동 CSS 정당화 (GridListItem/Tag/SelectValue 등) |    P2    | Generator 자식 selector emit 지원 여부 선행 판정 필요          |
| **105-d** | F4 + F5  | CSS-to-spec / builder-to-spec 참조 해소 (TagGroup.css/Badge.css/utils.ts 등)      |    P3    | F3 primitives 이관 완료 후 자연 해소되는 항목 있음 — F3 후착수 |

각 sub-ADR 착수 전 체크:

- Step F/G 관련 spec 파일 완결 여부 확인
- 해당 카테고리 항목 중 이미 자연 해소된 @sync 재감사
- BC 영향 재평가 (element.tag 변경 여부)

## Risks

| ID  | 위험                                                                              | 심각도 | 대응                                                                                                 |
| --- | --------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------- |
| R1  | Step F/G 진행 중 spec 파일 동시 편집 시 @sync 항목이 변경되어 감사 매트릭스 stale |  LOW   | sub-ADR 착수 전 해당 파일 재grep 의무. 본 ADR 매트릭스는 2026-04-21 스냅샷                           |
| R2  | F1 Spec 상속 메커니즘 설계 지연으로 105-b 착수 불가                               |  MED   | F3 (단순 상수 이관) 먼저 착수. F1은 primitives 공유 경로로 대체 가능한지 105-a 완결 후 재평가        |
| R3  | F2 Generator 자식 selector emit 미지원 — spec-to-CSS 이관 경로 없음               |  MED   | 미지원 확인 시 수동 CSS 정당화 + `@sync` 주석 삭제로 해소 (D3 위반 아님 — ADR-059 §Tier 3 허용 패턴) |
| R4  | 37건 중 F5 일부가 factory 구조 서술 (D2 경계) 로 판명 → @sync 정당화 가능         |  LOW   | 해당 항목은 정당화 문서 추가 후 `@sync` 주석 삭제로 해소 (ADR-102 SelectIcon 패턴)                   |
| R5  | 감사만 하고 실행 미착수로 debt "감사됨+미해결" 상태 지속                          |  LOW   | 105-a를 Charter 발행 직후 착수. F3가 단순하므로 1세션 내 완결 가능                                   |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략.

본 ADR 검증 기준:

- 37건 분류 매트릭스 F1~F5 완성 여부
- 각 카테고리별 이관 방법론 기술 여부
- Step F/G 위임 항목 식별 여부
- 권장 후속 sub-ADR 순서 (105-a~d) 제시 여부

**본 ADR Implemented 전환 조건**: 첫 후속 sub-ADR (105-a) Proposed 발행 시.

## Consequences

### Positive

- **ADR-063 §4.2 금지 패턴 체계화** — 37건 consumer-to-consumer 의존성을 F1~F5 카테고리로 분류하여 이관 로드맵 명확화
- **후속 sub-ADR 발행 순서 가이드** — F3 (단순) → F1/F2 (중급) → F4/F5 (복합) 순서로 위험 격리하며 점진적 해소
- **ADR-098 Charter 패턴 재사용** — 감사 + 분할 sub-ADR 패턴이 RSP 네이밍 체인에서 5회 성공 확인됨
- **Step F/G 충돌 방지** — 진행 중인 ADR과 scope 격리로 병행 작업 안전성 확보

### Negative

- **실행 지연** — 실제 @sync 해소는 후속 sub-ADR 4개에서 점진적. 전체 37건 해소까지 3~5 세션 예상
- **매트릭스 유지 비용** — Step F/G 완결 후 일부 항목 stale 가능성 → breakdown 재갱신 필요
- **F2 경로 불확실성** — Generator 자식 selector emit 지원 여부에 따라 spec-to-CSS 6건 중 일부는 수동 CSS 정당화로 방향이 바뀔 수 있음

## 참조

- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 금지 패턴 (`@sync` consumer-to-consumer) 선언
- [ADR-098](098-rsp-naming-audit-charter.md) — 감사 Charter + 분할 sub-ADR 패턴 선례 (RSP 네이밍)
- [ADR-091](091-utils-record-dissolution.md) — utils.ts 상수 primitives 이관 패턴 (Class C)
- [ADR-078](078-listboxitem-spec-and-generator-child-selector.md) — Generator 자식 selector emit 확장 선례
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — §4.2 consumer-to-consumer 금지 패턴 정본
