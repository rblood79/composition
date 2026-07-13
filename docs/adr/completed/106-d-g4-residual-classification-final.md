# ADR-106-d: G4 잔존 3건 최종 분류 확정 — Tag 자연 해소 / Field G2 정당화 / SearchField 제외

## Status

Implemented — 2026-04-21

## Context

### 배경 — ADR-106 Charter §G4 마지막 sub-ADR

ADR-106 (skipCSSGeneration 감사 Charter, Implemented 2026-04-21) 은 `skipCSSGeneration: true` 선언 27건을 G1~G4 로 분류하고 sub-ADR 4개 슬롯(106-a~d)를 정의했다.

- 106-a (G3→G2 Color family 4건) ✅ Implemented 2026-04-21
- 106-b (G2 TagGroup.css 정당화 + @sync 4건 해소) ✅ Implemented 2026-04-21
- 106-c (G3→G2 Label 정당화) ✅ Implemented 2026-04-21
- **106-d (G4 잔존 3건 최종 분류)** ← 본 ADR

Charter §G4 "미분류 / 추가 조사 필요" 로 배정된 3건은 다음이다:

| spec        | Charter 조사 포인트                                                         |
| ----------- | --------------------------------------------------------------------------- |
| Tag         | `@sync TagGroup.css` 2건 — ADR-106-b 에서 해소 여부 확인                    |
| Field       | `Field.css` FieldGroup/DataField 구조 CSS — spec SSOT 범위 및 G 분류 명확화 |
| SearchField | `skipCSSGeneration: false` 실측 재확인 — G4 목록 제외 확정 후보             |

본 ADR은 **3건 각각의 최종 분류를 확정하고 Charter 총계를 조정**한다. 코드 변경은 없음.

### D3 Domain 판정

**D3 (시각 스타일) 전용 작업**. `skipCSSGeneration` 플래그와 수동 CSS 파일이 Spec SSOT에서 파생되어야 한다는 원칙(ADR-036/ADR-059/ADR-063). D1(DOM/접근성) — RAC 내부 DOM 구조 비침범. D2(Props/API) — 영향 없음.

### Hard Constraints

1. **코드 변경 0** — 분류 확정 + 문서화만. 실제 CSS 해체/spec 전환은 코드 변경 없이 분류 판정만.
2. **선행 grep 확증** — 스냅샷에 의존하지 않고 Phase 0 에서 실측 grep 으로 3건 상태 확인 후 판정.
3. **ADR-105 @sync 우선권** — Tag 관련 `@sync` 주석은 ADR-105 에 우선권. 본 ADR 은 `skipCSSGeneration` 분류만 판정.
4. **testing 기준선 유지** — 코드 변경 없으므로 type-check 영향 없음. 문서 변경만.

### Phase 0: 3건 실측 grep 결과 (선행 조사)

#### P0-1: Tag @sync 자연 해소 확증

ADR-106-b §Decision에서 Tag.spec.ts `@sync TagGroup.css` 2건(line 57, 65)을 ADR-106-b scope 내 설명 주석으로 교체했다. 본 ADR 착수 시 재확인:

```bash
rg "@sync" packages/specs/src/components/Tag.spec.ts
# 결과: 0건 (No matches found)
```

**판정: Tag @sync 2건 자연 해소 완료 확증.** ADR-106-b Implemented 상태에서 이미 해소됨.

#### P0-2: SearchField skipCSSGeneration 재확인

```bash
rg "skipCSSGeneration" packages/specs/src/components/SearchField.spec.ts
# 결과:
#   89:  skipCSSGeneration: false,
#   296: // (skipCSSGeneration: true 유지 — 이 단계는 prefix/selector 선언만, CSS 출력 변화 없음)
```

**판정: SearchField.spec.ts:89 `skipCSSGeneration: false`** — 실효 플래그는 `false`. line 296의 주석은 과거 ADR-059 작업 당시 주석이며 현재 플래그 값에 영향 없음. G4 목록 제외 확정.

또한 Charter breakdown §1 매트릭스에서 SearchField가 이미 "제외 (skipCSSGeneration: false)" 로 별도 행에 기록되어 있음을 확인.

#### P0-3: Field skipCSSGeneration 상태 + Field.css 구조 분석

```bash
rg "skipCSSGeneration" packages/specs/src/components/Field.spec.ts
# 결과:
#   27:  skipCSSGeneration: true,
```

`FieldSpec.render.shapes = () => []` — 빈 배열. FieldSpec은 시각 렌더링 없는 구조 유틸리티 컴포넌트.

**Field.css 전문 분석**:

```
packages/shared/src/components/styles/Field.css (65줄):
  .react-aria-FieldGroup { display: flex; flex-direction: column; gap: var(--spacing-sm); }
  .react-aria-DataField  { display: flex; align-items: center; gap: var(--spacing-2); font-size: var(--text-sm); }
  .react-aria-DataField .label { font-weight: 600; }
  .react-aria-DataField .value {}
  .react-aria-DataField .value-empty { font-style: italic; }
  .react-aria-DataField .value-boolean { font-weight: 600; font-size: var(--text-base); }
  .react-aria-DataField .value-number { font-variant-numeric: tabular-nums; }
  .react-aria-DataField .value-email { text-decoration: none; } / :hover { underline }
  .react-aria-DataField .value-url { text-decoration: none; } / :hover { underline }
  .react-aria-DataField .value-image { width: 40px; height: 40px; border-radius: var(--radius-sm); object-fit: cover; }
```

CSS 변수 5건: `--spacing-sm`, `--spacing-2`, `--text-sm`, `--text-base`, `--radius-sm` — 모두 spec token 파생.

**하드코딩 값**: `40px × 40px` (DataField image 고정 크기) — spec `sizes.md` 에 미선언된 독립 수치.

**Field.css 특이 구조**:

- `index.css:57` 주석: `@import "./Field.css"; /* 구조 유틸리티 — Spec 없음 */`
- `.react-aria-FieldGroup` — RAC 공식 미존재 composition 고유 컨테이너 (Group 역할)
- `.react-aria-DataField` — composition 고유 데이터 표시 컴포넌트 (RAC 공식 미존재)
- FieldSpec selector 와 무관: FieldSpec 의 element 는 `"div"` (일반 div), `containerStyles: { display: "inline-flex" }`. Field.css 의 selector 는 FieldSpec 이 emit 하는 `.react-aria-Field` 루트 selector 와 다름.

**판정**: Field.css 는 FieldSpec 의 CSS 파생물이 아닌 **독립 구조 유틸리티 CSS** — FieldSpec 의 `skipCSSGeneration: true` 와 Field.css 는 서로 다른 scope. 상세는 §결론 매트릭스.

### 소비 코드 경로 (반복 패턴 체크 #1 — 5건 이상 grep 가능 경로)

| 경로                                                   | 역할                                                      | 3건 관련                             |
| ------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------ |
| `packages/specs/src/renderers/CSSGenerator.ts:146`     | `if (spec.skipCSSGeneration && !_embedMode) return null`  | Field emit 차단 (SearchField 미차단) |
| `packages/specs/src/components/Field.spec.ts:27`       | `skipCSSGeneration: true` 선언                            | Field — 확인 완료                    |
| `packages/specs/src/components/SearchField.spec.ts:89` | `skipCSSGeneration: false` 선언                           | SearchField 제외 확증                |
| `packages/specs/src/components/Tag.spec.ts` (전체)     | `@sync` 0건 (grep 결과)                                   | Tag @sync 해소 완료                  |
| `packages/shared/src/components/styles/Field.css`      | FieldGroup/DataField 구조 CSS — `index.css:57`에서 임포트 | Field.css 분리 구조 확인             |
| `packages/shared/src/components/styles/index.css:57`   | `@import "./Field.css"; /* 구조 유틸리티 — Spec 없음 */`  | Field.css scope 판정 근거            |
| `packages/shared/src/components/Field.tsx`             | `import "./styles/Field.css"` + RAC 유틸리티 컴포넌트     | Field.css 소비자 확인                |

### CSSGenerator 지원 여부 (반복 패턴 체크 #2)

ADR-106-a/b 에서 확정된 CSSGenerator 지원 범위가 본 ADR에 그대로 적용된다. Field.css 의 `.react-aria-FieldGroup` / `.react-aria-DataField .value-*` 자식 selector 는 CSSGenerator **미지원** (RAC 내부 구조체 + 자식 타입 selector). 단, Field.css 자체가 FieldSpec 파생물이 아니므로 CSSGenerator 전환 가능성 판정이 본 ADR scope 밖.

### BC 영향 (반복 패턴 체크 #3)

본 ADR은 코드 변경 없음 — 분류 문서화만. BC 영향 **0%**.

## Alternatives Considered

### 대안 A: 3건 즉시 최종 분류 확정 (선정)

- 설명: Phase 0 실측 결과를 바탕으로 3건을 다음과 같이 확정한다:
  - **Tag**: @sync 2건 자연 해소 확증 → G4 제외, G2 확정 (ADR-106-b 에서 완결)
  - **Field**: FieldSpec `skipCSSGeneration: true` = G2 정당 + Field.css = 독립 구조 유틸리티 분리 판정
  - **SearchField**: `skipCSSGeneration: false` 확증 → G4 목록에서 공식 제외, Charter 총계 27→26 조정

  추가 코드 작업 없음. 분류 확정 + Charter 총계 조정 + ADR-059 Tier 3 예외 목록에 Field 추가.
  - 위험:
    - 기술: LOW — 코드 변경 0. 분류 문서화만.
    - 성능: LOW — N/A.
    - 유지보수: LOW — 분류 확정으로 G4 "미분류" 상태 해소. 후속 작업 0건.
    - 마이그레이션: LOW — BC 영향 0%.

### 대안 B: Field skipCSSGeneration: true → false 전환 (CSSGenerator 자동 생성 경로)

- 설명: FieldSpec.render.shapes 가 빈 배열(`() => []`)이므로 `skipCSSGeneration: false` 로 전환하면 CSSGenerator 가 빈 CSS를 emit한다. Field.css 는 별도 구조 유틸리티로 유지.

  이론적으로 FieldSpec `skipCSSGeneration: false`가 맞는 상태이나, 현재 emit 결과가 빈 CSS 파일이 되므로 실질적 변화 없음. 코드 변경 1건 (`skipCSSGeneration: true → false`).
  - 위험:
    - 기술: LOW — spec 변경 1행. pnpm build:specs PASS 예상.
    - 성능: LOW — 빈 emit 으로 CSS 크기 영향 없음.
    - 유지보수: MEDIUM — `skipCSSGeneration: false` 가 의미하는 "CSSGenerator emit 허용" 상태가 맞으나, 현재 FieldSpec.render.shapes = `() => []` 이므로 emit 내용이 빈 containerStyles 뿐. 향후 FieldSpec 에 shapes 추가 시 자동 emit 경로가 활성화되므로 오히려 올바른 상태.
    - 마이그레이션: LOW — 빈 emit 이므로 Preview 무변화.

  단, 본 ADR 의 범위(코드 변경 없음)를 벗어남.

### 대안 C: Field G3 분류 + 별도 sub-ADR(106-e) 발행

- 설명: Field.css 의 `40px × 40px` 이미지 고정 크기와 `font-weight: 600` 하드코딩을 G3 debt로 판정하고, 별도 sub-ADR 106-e 에서 spec.sizes alignment 작업을 수행.
  - 장점: Charter 정의와 정합성 — G3 = "수동 CSS 독립 정의 debt".
  - 단점: Field.css 는 FieldSpec 파생물이 아닌 독립 구조 유틸리티이므로 G3 debt 분류가 부정확. FieldSpec 의 `skipCSSGeneration: true` 는 FieldSpec CSS 자동 생성 차단이지, Field.css 의 `40px` 를 spec 으로 흡수하는 작업과 별개임. 별도 sub-ADR 발행이 과잉.
  - 위험:
    - 기술: LOW.
    - 성능: LOW.
    - 유지보수: **MEDIUM** — Field.css 와 FieldSpec 의 scope 를 혼동하는 분류 구조가 향후 혼란 초래.
    - 마이그레이션: LOW.

### Risk Threshold Check

| 대안                     | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정      |
| ------------------------ | :--: | :--: | :------: | :----------: | :------: | --------- |
| A: 즉시 최종 분류 확정   |  L   |  L   |    L     |      L       |    0     | **PASS**  |
| B: FieldSpec false 전환  |  L   |  L   |    M     |      L       |    0     | PASS (\*) |
| C: Field G3 + 106-e 발행 |  L   |  L   |    M     |      L       |    0     | 기각      |

(\*) 대안 B 는 HIGH+ 없이 PASS 이나 본 ADR scope (코드 변경 0) 밖. 별도 세션에서 Field spec cleanup 시 자연 해소 가능.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- [x] **#1 코드 경로 인용**: Context 소비 코드 경로 표에 7건 grep 가능 파일:라인 명시. Phase 0 grep 명령 및 결과 3건 포함.
- [x] **#2 Generator 확장 여부**: Field.css 가 FieldSpec 파생물이 아님을 선언. CSSGenerator 전환 여부 판정이 본 ADR scope 밖임을 명시.
- [x] **#3 BC 훼손 수식화**: 코드 변경 0 → BC 0%. 저장 데이터 migration 불필요.
- [x] **#4 Phase 분리 가능성**: 3건이 각각 즉시 분류 확정 가능(Tag 해소, SearchField 제외, Field G2) → Phase 분리 불필요. 단일 ADR로 완결.

대안 A 만 HIGH+ 없음 + scope 내. ADR-106 Charter 대안 A 패턴 재사용.

## Decision

**대안 A (3건 즉시 최종 분류 확정) 채택**.

### 3건 최종 분류 매트릭스

| spec            | Phase 0 grep 결과                                         | 최종 분류                    | 처리 결과                                      |
| --------------- | --------------------------------------------------------- | ---------------------------- | ---------------------------------------------- |
| **Tag**         | `@sync` 0건 (ADR-106-b 에서 해소 완료)                    | **G2 확정** (ADR-106-b 완결) | G4 제외. 후속 작업 없음.                       |
| **SearchField** | `skipCSSGeneration: false` (line 89)                      | **G4 공식 제외**             | Charter 총계 27 → **26** 조정. 후속 작업 없음. |
| **Field**       | `skipCSSGeneration: true` (line 27) + Field.css 독립 구조 | **G2 확정** (아래 상세)      | G4 제외. 후속 작업 없음. ADR-059 Tier 3 등록.  |

### Field 분류 상세 판정 (G2 정당화)

FieldSpec 의 `skipCSSGeneration: true` 가 G2 정당인 근거:

1. **FieldSpec.render.shapes = `() => []`** — spec 에 시각 shapes 없음. CSSGenerator 를 통해 emit 할 시각 스타일이 없는 구조 유틸리티 spec.
2. **Field.css scope 분리**: Field.css 는 `.react-aria-FieldGroup` / `.react-aria-DataField` 를 위한 구조 유틸리티 CSS이지, FieldSpec 의 CSS 파생물이 아님. `index.css` 주석 `/* 구조 유틸리티 — Spec 없음 */` 이 이를 명시.
3. **Field.css token 파생 비율**: CSS 변수 5건 (`--spacing-sm`, `--spacing-2`, `--text-sm`, `--text-base`, `--radius-sm`) 모두 spec token 파생. 예외: `40px × 40px` 이미지 고정 크기(DataField image 전용) — 독립 수치이나 spec 내 sizes 미선언 도메인.
4. **RAC 구조체 자식 selector**: `.react-aria-DataField .value-*` 자식 selector 는 CSSGenerator 미지원 패턴 (106-a/b 판정 기준 재사용). 수동 CSS 유지 구조적 정당.
5. **ADR-059 Tier 3 허용 패턴 해당**: 수동 CSS 가 spec 토큰 파생 + RAC/composition 구조체 자식 selector 구조 → G2 정당.

**`skipCSSGeneration: true` 유지 근거**: FieldSpec.render.shapes 가 빈 배열이므로 CSSGenerator emit 결과가 빈 containerStyles(`display: inline-flex; align-items: center;`)뿐이 됨. 현재 이 값이 실제로 필요한지 불명확하므로 `true` 유지가 안전. 향후 FieldSpec 에 shapes 추가 시 `false` 전환 고려.

**SearchField 제외 확정 — Charter 총계 조정**:

Charter 최초 작성(2026-04-21) 시 `rg -l 'skipCSSGeneration: true'` 명령이 `SearchField.spec.ts:296` 의 주석 행(`// skipCSSGeneration: true 유지 — ...`)을 매칭하여 27건에 포함됨. 실효 플래그는 `skipCSSGeneration: false`(line 89). Charter breakdown §1 매트릭스에서 이미 "제외" 행으로 기록되어 있었으나, Charter 본문 G4 항목에는 잔존했음.

**본 ADR 이후 확정 총계**: `skipCSSGeneration: true` 실효 spec = **26건**.

| 분류          | 최종 건수 | 변경                                                       |
| ------------- | :-------: | ---------------------------------------------------------- |
| G1            |    10     | 변경 없음                                                  |
| G2            |    14     | +2 (Tag G2 확정 + Field G2 확정, Addendum 2의 14건에 포함) |
| G3            |     0     | Addendum 2 기준 이미 0                                     |
| G4            |     0     | **완전 청산** (3건 모두 분류 확정)                         |
| 제외          |     1     | SearchField 공식 제외                                      |
| **실효 합계** |  **26**   | 27→26 (SearchField 제외)                                   |

**기각 사유**:

- **대안 B 기각**: scope 초과 (본 ADR = 코드 변경 0). FieldSpec `false` 전환은 별도 FieldSpec cleanup 세션에서 shapes 추가와 함께 자연 처리 가능.
- **대안 C 기각**: Field.css 와 FieldSpec 의 scope 혼동으로 부정확한 G3 분류 발생. 독립 구조 유틸리티 CSS를 spec debt 로 오분류하면 향후 판정 기준 오염.

> 구현 상세: [106-d-g4-residual-classification-final-breakdown.md](../../adr/design/106-d-g4-residual-classification-final-breakdown.md)

## Risks

| ID  | 위험                                                                                                                           | 심각도 | 대응                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------ | :----: | ------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Field.css `40px × 40px` 이미지 고정 크기가 spec.sizes 와 장기 drift — DataField image 크기가 spec 에 미선언된 채로 유지됨      |  LOW   | G2 정당화 내 residual debt 로 분류. 향후 FieldSpec 에 sizes.md.imageSize 선언 시 Field.css 와 alignment 검토. 현재 동작 무변화 |
| R2  | Charter ADR-106 본문 G4 항목이 "3건 완전 청산" 으로 Addendum 3 갱신이 main session 에 위임됨 — 본 ADR 발행 후 갱신 지연 가능성 |  LOW   | 본 ADR Proposed 완료 후 main session 이 Charter Addendum 3 추가 (총계 조정 + G4 완전 청산 상태 기록). 수일 내 처리 예정        |
| R3  | FieldSpec `skipCSSGeneration: true` 가 향후 FieldSpec shapes 추가 시 CSSGenerator emit 누락 원인이 될 수 있음                  |  LOW   | 향후 FieldSpec shapes 추가 ADR 에서 `skipCSSGeneration: false` 전환을 hard constraint 로 포함. 현재 shapes 없으므로 무해       |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략.

본 ADR 검증 기준:

| 검증 항목                     | 통과 조건                                                             |
| ----------------------------- | --------------------------------------------------------------------- |
| Tag @sync 해소 확증           | `rg "@sync" Tag.spec.ts` = 0건                                        |
| SearchField 제외 확증         | `rg "skipCSSGeneration: false" SearchField.spec.ts` = 1건 (line 89)   |
| Field G2 근거 문서화          | Context §P0-3 에 FieldSpec.render.shapes + Field.css 분리 구조 기록됨 |
| Charter 총계 조정             | 27 → 26 조정 (SearchField 제외) 근거 본문 포함                        |
| ADR-059 Tier 3 등록 대상 식별 | Field + Tag G2 확정 → 본 ADR 이 Tier 3 등록 근거 ADR 로 기능          |

**본 ADR Implemented 전환 조건**: Charter Addendum 3 추가 + ADR-059 Tier 3 표 갱신 시.

## Consequences

### Positive

- **ADR-106 Charter G4 완전 청산**: 3건 중 2건 G2 확정 + 1건 공식 제외. G4 "미분류" 상태 0건 달성
- **Charter 총계 27 → 26 조정**: SearchField 가 `skipCSSGeneration: true` 목록에 포함된 오류 공식 수정
- **skipCSSGeneration 감사 전체 완결**: ADR-106 Charter sub-ADR 4슬롯(106-a~d) 전부 Proposed 달성 → Charter 감사 사이클 종료
- **Field.css scope 분리 명문화**: Field.css 가 FieldSpec 파생물이 아닌 독립 구조 유틸리티임을 첫 번째로 명문화 — 향후 유사 케이스 판정 기준 제공
- **ADR-059 Tier 3 예외 목록 완성**: G2 확정 케이스 (Tag, Field, Color family 4건, TagGroup, Label) 가 모두 ADR-059 Tier 3 에 공식 등록 대상으로 확인됨

### Negative

- **Field.css `40px` 독자 수치 residual debt**: DataField image 크기가 spec.sizes 와 미연결인 채로 G2 내 부분 debt 유지. 향후 FieldSpec shapes 추가 시 함께 해소 필요
- **Charter Addendum 3 main session 의존**: 총계 조정 및 G4 완전 청산 상태는 Charter 본문 Addendum 3 추가가 main session 에서 이뤄져야 공식 완결

## 참조

- [ADR-059](059-composite-field-skip-css-dismantle.md) — Composite Field CSS SSOT 확립, Tier 3 예외 확정
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 금지 패턴 3번 정본
- [ADR-105](105-sync-annotation-audit-charter.md) — @sync 주석 감사 Charter (Tag @sync 우선권)
- [ADR-106](106-skipcssgeneration-audit-charter.md) — skipCSSGeneration 감사 Charter (G4 슬롯 정의)
- [ADR-106-a](106-a-color-family-skipcss-dismantle.md) — G3→G2 Color family 재판정 (CSSGenerator 지원 범위 확정)
- [ADR-106-b](106-b-taggroup-css-skipcss-justification.md) — G2 TagGroup.css 정당화 + @sync 4건 해소 (Tag @sync 해소 근거)
- [ADR-106-c](106-c-label-skipcss-ssot-recovery.md) — G3→G2 Label 정당화
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D3 domain §6 금지 패턴 3번, §7 허용 패턴
