# ADR-106: skipCSSGeneration 감사 Charter (G 카테고리 27 spec 분류)

## Status

Implemented — 2026-04-21 (첫 후속 sub-ADR 106-a Proposed 발행으로 Gate 충족)

## Addendum 1 — 2026-04-21: G3 → G2 재판정 (106-a 조사 결과)

ADR-106-a (Color family skipCSSGeneration 해체) §Context 의 "CSSGenerator 자식 selector emit 지원 여부 판정" 결과, **G3 5건 중 Color family 4건이 G2 로 재분류**됨.

**재판정 근거**:

- CSSGenerator 는 RAC 내부 구조체 selector (`.react-aria-ColorThumb`, `.react-aria-ColorWheelTrack`, `.react-aria-ColorSwatchPickerItem`), pseudo-element (`::after`), orientation 분기 emit 을 **미지원** (ADR-078 인프라 범위 밖)
- 4 CSS 파일 (`ColorPicker.css` / `ColorSlider.css` / `ColorWheel.css` / `ColorSwatchPicker.css`) 의 대부분 값이 `var(--bg-raised)` / `var(--shadow-sm)` / `var(--radius-lg)` / `var(--focus-ring)` 등 **spec token 파생** — ADR-059 §Tier 3 허용 패턴
- 단 `ColorPicker.css` 의 `--cp-*` 로컬 CSS 변수는 일부 독자 수치 포함 → 정당화 범위 내 부분 debt 유지

**변경된 분류 (2026-04-21 이후)**:

| 분류 | 이전 | 이후 | 비고                                  |
| ---- | :--: | :--: | ------------------------------------- |
| G1   |  10  |  10  | 변경 없음                             |
| G2   |  9   |  13  | Color family 4건 추가 (+ 기존 9)      |
| G3   |  5   |  1   | Label 만 잔존 (Color family 4건 이동) |
| G4   |  3   |  3   | 변경 없음                             |
| 합계 |  27  |  27  | 재분류만                              |

**후속 sub-ADR 로드맵 조정**:

- 106-a 는 G3 → G2 정당화 전환 (CSS 해체 없음, Tier 3 예외 공식 등록)
- 106-c (Label CSS SSOT 복귀) 는 **잔존 G3 유일한 sub-ADR** 로 우선순위 P1 로 상향
- 106-b (TagGroup.css @sync, G2 정당화) 는 ADR-105 F4 연동 유지
- 106-d (G4 조사) 는 ADR-105 체인 연동 후 착수 (P3 유지)

## Addendum 3 — 2026-04-21: G4 재조사 + Charter 총계 재조정 (27 → 26)

ADR-106-d (G4 미분류 3건 최종 분류) Implemented 완결로 **G4 debt 완전 청산** + Charter 총계 조정.

**3건 최종 분류**:

| spec        | 재분류           | 근거                                                                                                                                                                                           |
| ----------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tag         | G2 (106-b 완결)  | `@sync TagGroup.css` 2건 이미 설명 주석 교체 완료. 추가 작업 없음                                                                                                                              |
| SearchField | **G4 제외**      | `skipCSSGeneration: false` 재확증. line 296 주석 오매칭이 원인                                                                                                                                 |
| Field       | G2 (신규 정당화) | Field.css 가 `.react-aria-FieldGroup/.react-aria-DataField` 독립 구조 유틸리티 selector — FieldSpec `.react-aria-Field` scope 와 분리. CSS 변수 5건 spec token 파생. ADR-059 §Tier 3 예외 등록 |

**Charter 총계 조정**:

| 분류 | Addendum 1 | Addendum 2 | **Addendum 3** | 비고                        |
| ---- | :--------: | :--------: | :------------: | --------------------------- |
| G1   |     10     |     10     |       10       | 변경 없음                   |
| G2   |     13     |     14     |     **15**     | Field +1 (Label, Color4 외) |
| G3   |     1      |     0      |       0        | 완전 청산 유지              |
| G4   |     3      |     3      |     **0**      | **완전 청산** (2→제외+1→G2) |
| 합계 |     27     |     27     |     **26**     | SearchField 제외 조정       |

**106 Charter 후속 sub-ADR 최종**:

- 106-a ✅ Implemented (G3→G2 Color family 4건)
- 106-b ✅ Implemented (G2 TagGroup.css 정당화)
- 106-c ✅ Implemented (G3→G2 Label)
- 106-d ✅ Implemented (G4 재조사 + 총계 조정)

**ADR-106 Charter sub-ADR 체인 완결 — skipCSSGeneration 감사 사이클 전체 종료.**

## Addendum 2 — 2026-04-21: G3 debt 완전 청산 (1 → 0)

ADR-106-c (Label skipCSSGeneration 정당화) Implemented 완결로 **G3 debt 완전 청산**.

**재판정 근거 (Label → G2 이동)**:

- Label `skipCSSGeneration: true` 는 `base.css` `var(--label-font-size)` CSS 상속 메커니즘 보존을 위해 필수 (CSSGenerator `font-size` 직접 선언이 CSS specificity 로 상속 패턴 파괴)
- 22개 부모 컴포넌트가 `--label-font-size` 변수 의존 → spec SSOT 복귀 시 전체 회귀 위험 HIGH
- Label.css 주요 값 (containerStyles/sizes/states) 은 spec token 파생 상태 — D3 대칭 준수
- 시나리오 B (G2 재판정, 수동 CSS 정당화) 채택, ADR-059 §Tier 3 예외 등록

**최종 분류 (2026-04-21 Addendum 2 이후)**:

| 분류 | Addendum 1 | Addendum 2 | 비고                       |
| ---- | :--------: | :--------: | -------------------------- |
| G1   |     10     |     10     | 변경 없음                  |
| G2   |     13     |     14     | +1 Label                   |
| G3   |     1      |   **0**    | **완전 청산** (Label 이동) |
| G4   |     3      |     3      | 변경 없음 (106-d 스코프)   |
| 합계 |     27     |     27     | 재분류만                   |

**후속 sub-ADR 로드맵 최종**:

- 106-a (G3→G2 Color family) ✅ Implemented 2026-04-21
- 106-b (G2 TagGroup.css 정당화) ✅ Implemented 2026-04-21
- 106-c (G3→G2 Label) ✅ Implemented 2026-04-21
- 106-d (G4 3건 조사: Tag @sync / Field / SearchField 재확인) — 유일 잔존 sub-ADR

## Context

### 배경 — ADR-036 우회로 + ADR-059 해체 원칙

ADR-036 (Spec-First Single Source, Implemented 2026-03-16) 은 `CSSGenerator` 를 통한 Spec → CSS 자동 생성을 D3 시각 스타일 SSOT 구현 메커니즘으로 확립했다. 당시 Container/Composite 컴포넌트(구조가 복잡하거나 RAC DOM에 의존하는)는 자동 생성 경로를 우회하기 위해 `skipCSSGeneration: true` 를 선언하고 수동 CSS 파일로 스타일을 유지하도록 설계되었다.

ADR-059 (Composite Field CSS SSOT 확립, Implemented 2026-04-15) 는 이 우회로가 낳은 문제의 핵심을 규명했다: **수동 CSS 파일이 Spec 에서 파생되지 않고 독립적으로 유지될 때 D3 대칭 consumer 원칙이 깨진다.** ADR-059 는 Composite Field 7개의 수동 CSS 독자 진실을 제거했고, `skipCSSGeneration: true` 잔존 Tier 3 예외 9개를 확정했다. 그 이후 추가 ADR 체인 (ADR-068/071/076/078/092/093/094/095) 을 통해 신규 `skipCSSGeneration: true` 선언이 추가되었다.

[`ssot-hierarchy.md` §6 금지 패턴 3번](../../../.claude/rules/ssot-hierarchy.md) 은 이를 명시한다:

> ❌ 수동 CSS가 Spec에서 파생 아님 (D3 위반) — ADR-059

현재 `skipCSSGeneration: true` 선언 spec 은 **27건** 이다. 이 중 ADR-059 이후 정당화된 케이스(childSpecs inline emit, RAC unstyled primitive 수동 재정의)와 D3 위반 debt(수동 CSS 가 spec 토큰 파생 아닌 독립 정의)가 혼재되어 있다.

### D3 domain 판정

**D3 (시각 스타일) 전용 작업**. `skipCSSGeneration` 은 CSSGenerator 가 D3 스타일을 emit 하는지 여부를 결정하는 플래그이므로 D3 영역. D1 (DOM/접근성) 과 D2 (Props/API) 침범 없음.

단 수동 CSS 가 레이아웃 구조 서술을 포함하는 경우 D3 경계 내 구조 vs 시각 스타일 판단이 필요하며, 후속 sub-ADR 착수 시 개별 판정 필수.

### 실측 — 27건 분포 (2026-04-21 스냅샷)

```
rg -l 'skipCSSGeneration: true' packages/specs/src/components/*.spec.ts | wc -l
# = 27
```

예상 분류:

| 분류                                          |  건수  | 설명                                                              |
| --------------------------------------------- | :----: | ----------------------------------------------------------------- |
| G1. childSpecs inline emit (정당)             |   10   | 부모 spec childSpecs 경로로 inline emit — 독립 CSS 파일 불필요    |
| G2. RAC unstyled primitive 수동 재정의 (정당) |   9    | 수동 CSS 가 spec 토큰 파생이면 D3 대칭 consumer 준수              |
| G3. 수동 CSS 독립 정의 (debt)                 |   5    | 수동 CSS 가 spec 에서 파생되지 않은 독립 진실 — ADR-059 해체 대상 |
| G4. 미분류 / 추가 조사 필요                   |   3    | spec 토큰 파생 여부 + `@sync` 주석 연동 조사 필요                 |
| **합계**                                      | **27** |                                                                   |

상세 분류 매트릭스 (spec 이름 / 부모 spec 유무 / 수동 CSS 파일 / G1~G4)는 breakdown 참조.

### Hard Constraints

1. **본 Charter scope = 감사 + 로드맵만** — 코드 변경 0. 후속 sub-ADR (106-a, 106-b, ...) 이 실제 해체 수행.
2. **Step F/G 비충돌** — ADR-103 (CheckboxItems/RadioItems 정당화, Step F) / ADR-104 (Card 계열 정당화, Step G) 이미 Implemented. 해당 케이스는 G1 정당 분류로 확정됨.
3. **ADR-094 expandChildSpecs 인프라 활용** — `packages/specs/src/runtime/tagToElement.ts` 의 `expandChildSpecs` 가 G1 childSpecs 케이스를 자동 등록. G1 케이스는 이 인프라로 이미 정당화됨.
4. **ADR-105 @sync 체인과 연계** — G3/G4 케이스 중 `@sync` 주석 동반 시 ADR-105 F2/F4 카테고리와 중복 가능. 후속 sub-ADR 착수 전 ADR-105 진행 상태 확인 필수.
5. **testing 기준선 유지** — 후속 sub-ADR 각각 type-check 3/3 + specs PASS + builder PASS 의무.

### 소비 코드 경로 (grep 가능 5건 이상 — 반복 패턴 체크 #1)

| 경로                                                 | 역할               | skipCSSGeneration 관련                                                                          |
| ---------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| `packages/specs/src/renderers/CSSGenerator.ts`       | CSS 자동 생성 엔진 | `if (spec.skipCSSGeneration) return null` — 27건 emit 차단                                      |
| `packages/specs/src/runtime/tagToElement.ts:234`     | TAG_SPEC_MAP 빌드  | `expandChildSpecs(BASE_TAG_SPEC_MAP)` — G1 childSpecs 케이스 자동 등록                          |
| `packages/specs/src/components/TagGroup.spec.ts:364` | TagGroup spec      | `childSpecs: [TagListSpec]` — G1 TagList skipCSSGeneration 정당화 근거                          |
| `packages/specs/src/components/ListBox.spec.ts`      | ListBox spec       | `childSpecs: [ListBoxItemSpec, HeaderSpec]` — G1 ListBoxItem/Header 정당화                      |
| `packages/specs/src/components/Card.spec.ts`         | Card spec          | `childSpecs: [CardHeaderSpec, CardContentSpec, CardFooterSpec]` — G1 Card 계열 정당화 (ADR-104) |
| `packages/specs/src/components/Tag.spec.ts:57,65`    | Tag spec           | `@sync TagGroup.css` 2건 — G3/G4 판정 대상 (ADR-105 F2 연동)                                    |
| `packages/shared/src/components/styles/Table.css`    | Table 수동 CSS     | 147 token var lines — G2/G3 분류 필요                                                           |

### Generator 자식 selector emit 지원 여부 (반복 패턴 체크 #2)

G1 케이스(childSpecs inline emit)는 CSSGenerator 가 부모 spec emit 시 자식 spec 을 함께 inline emit 하는 인프라(ADR-078/071 확장) 를 사용한다. G3 해체 시 CSSGenerator 가 해당 컴포넌트의 selector/variant emit 을 지원하는지 후속 sub-ADR 에서 개별 확인 필수.

### BC 영향 (반복 패턴 체크 #3)

`skipCSSGeneration: true` → `false` 전환은 **CSS 경로 변경** 이지 `element.tag` 리네이밍이 아니므로 저장 데이터 migration 불필요. BC 영향 0% 예상. 단 수동 CSS 삭제 시 Preview 시각 회귀 가능성이 있으므로 `/cross-check` 또는 `parallel-verify` 로 양쪽 consumer 동일성 검증 필수.

### Soft Constraints

- ADR-059 Tier 3 예외 9개 확정 문서는 `skipCSSGeneration: true` 의 **당시 기준**. 이후 추가 케이스는 ADR-059 원칙 재적용으로 재평가.
- ADR-105 @sync Charter (Proposed 2026-04-21) 와 G3/G4 케이스 일부 중복. 후속 sub-ADR 착수 순서 조율 필요.

## Alternatives Considered

### 대안 A: Charter + 후속 분류별 sub-ADR 분할 (선정)

- 설명: 본 ADR 은 27건 분류 매트릭스 + G1~G4 카테고리별 정당화 근거 / 해체 방법론 + 후속 sub-ADR 우선순위만 제공. 실제 spec `skipCSSGeneration: true` → `false` 전환, 수동 CSS 해체, CSSGenerator 확장은 후속 sub-ADR (106-a~d) 에서 개별 수행.
- 위험:
  - 기술: LOW — 감사는 문서 작업. 코드 변경 0.
  - 성능: LOW — N/A.
  - 유지보수: LOW — 개별 ADR 분할이 각 카테고리의 복잡도 격리. G3 debt 가 범위 초과 단일 PR 내 혼합 방지.
  - 마이그레이션: LOW — 본 ADR 은 migration 수행 안 함.

### 대안 B: 단일 대형 ADR 에서 27건 일괄 해체

- 설명: 본 ADR 에서 G1~G4 전체를 한 번에 처리. spec 전환 + 수동 CSS 해체 + CSSGenerator 확장 일괄 진행.
- 위험:
  - 기술: **HIGH** — G3 케이스마다 CSSGenerator 자식 selector emit 지원 여부 + spec shapes 확인이 필요. 27 spec 동시 변경 시 10+ CSS 파일 + 27 spec 파일 + CSSGenerator 동시 수정 → 병렬 회귀 위험 상승. `/cross-check` 27 spec 동시 검증 불가.
  - 성능: LOW.
  - 유지보수: **HIGH** — G3 해체에는 ADR-078 수준(ListBoxItem.spec 신설 + Generator 자식 selector emit 확장)의 인프라 설계가 필요한 케이스 포함 가능. 단일 거대 PR 롤백 불가.
  - 마이그레이션: LOW — 저장 데이터 migration 불필요.

### 대안 C: 현 상태 유지 — skipCSSGeneration: true 방치

- 설명: ADR 을 발행하지 않고 각 컴포넌트 수정 시 자연적으로 해소될 때까지 방치.
- 위험:
  - 기술: LOW (현재 동작에 영향 없음).
  - 성능: LOW.
  - 유지보수: **HIGH** — D3 위반 debt 가 영구화됨. ADR-059 §Tier 3 확정 이후 추가 `skipCSSGeneration: true` 케이스가 검토 없이 늘어날 수 있음. ADR-063 §6 금지 패턴 3번이 코드베이스 27건에 잔존. 각 컴포넌트 수정 시 수동 CSS 동기화 비용 발생.
  - 마이그레이션: LOW.

### Risk Threshold Check

| 대안                      | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정     |
| ------------------------- | :--: | :--: | :------: | :----------: | :------: | -------- |
| A: Charter + 분할 sub-ADR |  L   |  L   |    L     |      L       |    0     | **PASS** |
| B: 단일 일괄 ADR          |  H   |  L   |    H     |      L       |    2     | 기각     |
| C: 현 상태 유지           |  L   |  L   |    H     |      L       |    1     | 기각     |

대안 A 가 HIGH+ 0 + ADR-098/105 Charter (감사 + 후속 분할 sub-ADR) 선례 성공 확인 — threshold PASS.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- ✅ **#1 코드 경로 인용**: Context "소비 코드 경로" 표에 5건 이상 grep 가능 파일:함수 명시.
- ✅ **#2 Generator 확장 여부**: G3 해체 시 CSSGenerator 자식 selector emit 지원 여부를 Context 에 선언. 후속 sub-ADR (106-a) 에서 개별 판정 의무.
- ✅ **#3 BC 훼손 수식화**: `skipCSSGeneration` 전환은 CSS 경로 변경이지 element.tag 변경 아님 → BC 0% 예상. 수동 CSS 삭제 시 `/cross-check` 검증 의무로 재확인.
- ✅ **#4 Phase 분리 가능성**: G1~G4 카테고리 × 서로 다른 정당화/해체 메커니즘 → 후속 sub-ADR 3개 이상 예상. 단일 ADR 불가 판정.

## Decision

**대안 A (Charter + 후속 sub-ADR 분할) 채택**.

선택 근거:

1. **ADR-098/105 Charter 패턴 재사용** — RSP 네이밍 감사(098) 및 @sync 주석 감사(105) 에서 Charter + 분할 sub-ADR 패턴이 안정적으로 작동함. 동일 패턴 재사용.
2. **카테고리별 해체 메커니즘 차이** — G1 (childSpecs 정당) 은 ADR-094 인프라로 이미 정당화됨. G2 (RAC primitive 수동 재정의) 는 spec 토큰 파생 정당화 문서만 필요. G3 (수동 CSS 독립 정의) 은 CSSGenerator 확장 또는 spec shapes 신설이 필요한 케이스 포함 → 각각 다른 설계가 필요하므로 분할 필수.
3. **ADR-105 @sync 체인 비충돌** — G3/G4 케이스 중 `@sync` 동반 케이스는 ADR-105 F2/F4 와 중복 가능하므로 scope 격리를 위해 Charter 수준에서 연계만 명시하고 실제 처리는 sub-ADR 에서 ADR-105 진행 상태 확인 후 착수.
4. **감사 우선** — 27건 중 G1/G2 정당 케이스가 과반으로 예상되므로 분류 매트릭스 확정이 선행 조건.

기각 사유:

- **대안 B 기각**: HIGH 2 초과. G3 케이스마다 CSSGenerator 확장 설계가 다르고, ADR-078 수준의 인프라 작업이 포함될 수 있음. 27 spec 동시 `/cross-check` 검증은 현실적으로 불가능.
- **대안 C 기각**: ADR-059 이후 정립된 D3 원칙을 27건 debt 로 방치하면 ADR-063 §6 금지 패턴이 형해화됨. 추가 `skipCSSGeneration: true` 선언 시 정당화 검토 기준도 모호해짐.

> 구현 상세: [106-skipcssgeneration-audit-charter-breakdown.md](../../adr/design/106-skipcssgeneration-audit-charter-breakdown.md)

## 감사 매트릭스 (개요)

27건 전체 분류. 상세 파일별 매트릭스 (spec 이름 / 부모 spec 유무 / 수동 CSS 파일 경로 / spec 토큰 파생 여부 / G1~G4 분류)는 breakdown 참조.

### G1. childSpecs inline emit 정당 (10건)

부모 spec 의 `childSpecs` 배열에 포함되어 부모 generated CSS 에 inline emit 되는 구조. 독립 CSS 파일 불필요. ADR-094 `expandChildSpecs` 인프라 자동 등록 대상.

| spec          | 부모 spec                                    | 정당화 ADR   |
| ------------- | -------------------------------------------- | ------------ |
| CardHeader    | Card.spec (childSpecs)                       | ADR-092/104  |
| CardContent   | Card.spec (childSpecs)                       | ADR-092/104  |
| CardFooter    | Card.spec (childSpecs)                       | ADR-092/104  |
| ListBoxItem   | ListBox.spec (childSpecs)                    | ADR-078      |
| Header        | ListBox/GridList.spec (childSpecs)           | ADR-099      |
| GridListItem  | GridList.spec (childSpecs)                   | ADR-090      |
| TagList       | TagGroup.spec (childSpecs)                   | ADR-093      |
| CheckboxItems | CheckboxGroup.spec (childSpecs)              | ADR-103      |
| RadioItems    | RadioGroup.spec (childSpecs)                 | ADR-103      |
| DateInput     | DateField/TimeField/DatePicker (propagation) | ADR-091 계열 |

### G2. RAC unstyled primitive 수동 재정의 정당 (9건)

독립 CSS 파일이 존재하지만 수동 CSS 가 spec 토큰(`var(--token-...)`) 에서 파생된 케이스. ADR-059 §Tier 3 허용 패턴에 해당. 정당화 문서 작성 + `@sync` 주석 제거로 해소.

| spec           | 수동 CSS 파일                        | 정당화 근거                                                                                |
| -------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| Table          | `Table.css` (147 token var lines)    | RAC Table 복잡 구조 — 수동 CSS 가 spec 토큰 파생 (token var 풍부)                          |
| Tree           | `Tree.css` (83 token var lines)      | RAC Tree 수동 재정의 — spec 토큰 파생                                                      |
| GridList       | `GridList.css` (41 token var lines)  | RAC GridList 컨테이너 — spec 토큰 파생                                                     |
| Group          | `Group.css` (8 token var lines)      | RAC Group minimal CSS — spec 토큰 파생                                                     |
| TagGroup       | `TagGroup.css` (106 token var lines) | ADR-093 TagGroup SSOT — 수동 CSS 가 spec 토큰 파생 (단, `@sync` 주석 ADR-105 F4 연동)      |
| DateSegment    | CSS 파일 없음                        | spec shapes 경로 전용 — CSS 필요 없음                                                      |
| CalendarGrid   | CSS 파일 없음                        | ADR-083 calendar archetype — `skipCSSGeneration:true` 는 implicitStyles/Skia consumer 전용 |
| CalendarHeader | CSS 파일 없음                        | ADR-083 calendar archetype — 동일                                                          |
| ColorArea      | `ColorArea.css` (3 token var lines)  | Color primitive — minimal CSS                                                              |

### G3. 수동 CSS 독립 정의 debt (5건)

수동 CSS 파일이 spec 토큰에서 파생되지 않고 독립적으로 값을 정의하는 케이스. ADR-059 해체 대상. 후속 sub-ADR 에서 CSSGenerator 확장 또는 spec shapes 신설로 해소.

| spec              | 수동 CSS 파일                                         | debt 근거                                             |
| ----------------- | ----------------------------------------------------- | ----------------------------------------------------- |
| ColorPicker       | `ColorPicker.css` (38 token var lines + 독립 값 다수) | 내부 크기/gap 하드코딩 + `--cp-*` 독립 CSS 변수       |
| ColorSlider       | `ColorSlider.css`                                     | 독립 크기 정의                                        |
| ColorSwatchPicker | `ColorSwatchPicker.css`                               | 독립 정의                                             |
| ColorWheel        | `ColorWheel.css`                                      | 독립 크기 정의                                        |
| Label             | `Label.css` (7 token var lines)                       | `--label-font-size` 변수 상속 의존 — spec SSOT 미연결 |

### G4. 미분류 / 추가 조사 필요 (3건)

spec 토큰 파생 여부 + `@sync` 주석 연동 + 부모 관계 명확화 추가 조사 필요.

| spec        | 조사 포인트                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------- |
| Tag         | `@sync TagGroup.css` 2건 (ADR-105 F2 연동) — TagGroup.css 와 Tag spec shapes 색상 동기화 여부 |
| Field       | `Field.css` — FieldGroup/DataField 구조 선언 vs spec SSOT 범위 명확화                         |
| SearchField | `skipCSSGeneration: false` 확인됨 — **이 목록에서 제외 대상** (실측 재확인 필요)              |

> 참고: SearchField 는 `skipCSSGeneration: false` 로 확인됨 (2026-04-21 실측). G4 에 임시 배치했으나 sub-ADR 착수 전 재확인으로 목록에서 제외 가능성 있음. 실제 대상은 26건일 수 있음.

## 후속 sub-ADR 우선순위

| 슬롯      | 카테고리 | 제목 (가칭)                                                             | 우선순위 | 이유                                                                                  |
| --------- | -------- | ----------------------------------------------------------------------- | :------: | ------------------------------------------------------------------------------------- |
| **106-a** | G3       | Color family 4건 (ColorPicker/Slider/SwatchPicker/Wheel) spec SSOT 복귀 |    P1    | 독립 CSS 변수 (`--cp-*`) spec shapes 로 흡수 — 단일 컴포넌트 패밀리, 상호 의존 낮음   |
| **106-b** | G2       | TagGroup.css `@sync` 주석 정당화 (ADR-105 F4 연동)                      |    P1    | ADR-105 F4 카테고리와 중복 — ADR-105-d 완결 후 공동 해소 또는 정당화 문서화           |
| **106-c** | G3       | Label CSS SSOT 복귀                                                     |    P2    | `--label-font-size` 변수 상속 → spec SSOT 연결 (ADR-086 LABEL_SIZE_STYLE 패턴 재사용) |
| **106-d** | G4       | Tag spec + Field spec 조사 + SearchField 목록 제외 확인                 |    P3    | @sync 주석 포함 케이스 ADR-105 체인 연동 후 착수                                      |

각 sub-ADR 착수 전 체크:

- ADR-105 관련 @sync 해소 상태 확인 (F2/F4 카테고리 동반 케이스)
- 해당 spec 의 현재 `skipCSSGeneration` 값 재grep (stale 방지)
- BC 영향 재평가 + `/cross-check` 또는 `parallel-verify` 계획 수립

## Risks

| ID  | 위험                                                                                                    | 심각도 | 대응                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------------------------------------------- |
| R1  | Step F/G 완결 후 G1 케이스 일부 변경 가능성 — ADR-103/104 이후 추가 childSpecs 재편이 있으면 분류 stale |  LOW   | sub-ADR 착수 전 대상 spec 재grep 의무. 본 ADR 매트릭스는 2026-04-21 스냅샷                                           |
| R2  | G3 (Color family) CSS 가 실제로는 spec 토큰 파생인 것으로 재판정 → G2 이동 가능성                       |  LOW   | 106-a 착수 시 Color CSS 전수 조사 수행. G2 이동 시 106-a 는 정당화 문서 + `@sync` 제거로 scope 축소                  |
| R3  | ADR-105 F2/F4 (Tag/@sync) 와 G3/G4 중복 처리 — 두 Charter 가 동일 파일 편집 충돌                        |  MED   | 106-b/d 착수 전 ADR-105 해당 슬롯(105-c/d) 완결 여부 확인. 중복 scope 는 ADR-105 에 우선권 부여                      |
| R4  | G3 해체 시 CSSGenerator 확장 불가 케이스 → spec shapes 신설 필요 (ADR-078 수준 작업)                    |  MED   | 106-a 착수 시 CSSGenerator emit 가능 여부 사전 판정. 불가 시 spec shapes 경로 선택 — scope 를 해당 sub-ADR 에서 명시 |
| R5  | 감사만 하고 실행 미착수로 debt "감사됨 + 미해결" 상태 지속                                              |  LOW   | 106-a (Color family G3) 를 Charter 발행 직후 착수 권장. Color family 는 상호 의존 낮아 1-2 세션 내 완결 가능         |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략.

본 ADR 검증 기준:

- 27건 분류 매트릭스 G1~G4 완성 여부 (breakdown 에 상세 기록)
- 각 카테고리별 정당화 근거 / 해체 방법론 기술 여부
- 후속 sub-ADR 우선순위 슬롯 (106-a~d) 제시 여부
- ADR-105 @sync 체인과 G3/G4 중복 scope 식별 여부

**본 ADR Implemented 전환 조건**: 첫 후속 sub-ADR (106-a) Proposed 발행 시.

## Consequences

### Positive

- **ADR-059 원칙 체계화** — skipCSSGeneration: true 27건을 G1~G4 로 분류하여 D3 위반 debt 5건 (+ G4 조사 중 2-3건) 을 명확화
- **후속 sub-ADR 발행 순서 가이드** — G3 (단순 Color family) → G3 (Label) → G4 (Tag/@sync) 순서로 위험 격리하며 점진적 해소
- **ADR-098/105 Charter 패턴 재사용** — 감사 + 분할 sub-ADR 패턴이 RSP 네이밍(098) + @sync(105) 에서 검증됨
- **ADR-059 Tier 3 예외 재평가 기준 확립** — G1/G2 정당 케이스에 대한 명시적 정당화 근거 문서화로 향후 신규 `skipCSSGeneration: true` 추가 시 판정 기준 제공
- **ADR-094 expandChildSpecs 인프라 정당화** — G1 10건이 이 인프라로 구조적으로 정당화됨을 명시

### Negative

- **실행 지연** — 실제 debt 해소는 후속 sub-ADR 3-4개에서 점진적. G3 5건 전부 해소까지 2-4 세션 예상
- **ADR-105 의존성** — G4 착수가 ADR-105 F2/F4 슬롯 완결에 의존. ADR-105 지연 시 G4 착수 지연
- **G4 불확실성** — Tag spec 의 `@sync` 주석이 G3 debt 인지 G2 정당인지 추가 조사 후 판정. 판정 결과에 따라 G3 건수 ±1~2 변동 가능

## 참조

- [ADR-036](036-spec-first-single-source.md) — `skipCSSGeneration` 우회로 원설계 (Spec-First CSS 자동 생성)
- [ADR-059](059-composite-field-skip-css-dismantle.md) — Composite Field CSS SSOT 확립 (해체 원칙 수립 + Tier 3 예외 9개 확정)
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 금지 패턴 3번 선언
- [ADR-078](078-listboxitem-spec-and-generator-child-selector.md) — ListBoxItem.spec + Generator 자식 selector emit 확장 (G1 정당화 인프라)
- [ADR-094](094-childspecs-registry-auto-registration.md) — `expandChildSpecs` 인프라 (G1 자동 등록)
- [ADR-098](098-rsp-naming-audit-charter.md) — 감사 Charter + 분할 sub-ADR 패턴 선례 (RSP 네이밍)
- [ADR-105](105-sync-annotation-audit-charter.md) — @sync 주석 감사 Charter (G3/G4 중복 scope)
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — §6 금지 패턴 3번 정본
