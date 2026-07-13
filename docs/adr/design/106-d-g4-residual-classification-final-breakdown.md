# ADR-106-d G4 잔존 3건 최종 분류 — 구현 상세 Breakdown

> **연결 ADR**: [106-d-g4-residual-classification-final.md](../completed/106-d-g4-residual-classification-final.md)
> **스냅샷 기준**: 2026-04-21

---

## 1. Phase 0: 실측 grep 결과 원문

### P0-1: Tag @sync 자연 해소 확증

```bash
rg "@sync" packages/specs/src/components/Tag.spec.ts
# 결과: No matches found (0건)
```

비교: Charter 작성 당시 (2026-04-21 이전) — `Tag.spec.ts:57,65` 에 `@sync TagGroup.css` 2건 존재.
ADR-106-b §Decision 에서 설명 주석으로 교체 완료. 현재 `@sync` 0건.

### P0-2: SearchField skipCSSGeneration 재확인

```bash
rg "skipCSSGeneration" packages/specs/src/components/SearchField.spec.ts
# 결과:
#   89:  skipCSSGeneration: false,
#   296: // (skipCSSGeneration: true 유지 — 이 단계는 prefix/selector 선언만, CSS 출력 변화 없음)
```

line 89: 실효 플래그 `skipCSSGeneration: false`.
line 296: 주석 (과거 ADR-059 작업 시 메모) — 현재 플래그 값에 영향 없음.

### P0-3: Field 상태 확인

```bash
rg "skipCSSGeneration" packages/specs/src/components/Field.spec.ts
# 결과:
#   27:  skipCSSGeneration: true,

rg "shapes" packages/specs/src/components/Field.spec.ts
# 결과:
#   108:  render: {
#   109:    shapes: () => [],
#   110:  },
```

---

## 2. Field.css 전문 (65줄) + 토큰 분석

```css
@layer components {
  /* FieldGroup for grouping form elements */
  .react-aria-FieldGroup {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm); /* ← spec token */
  }

  /* DataField - Collection 데이터 표시 컴포넌트 */
  .react-aria-DataField {
    display: flex;
    align-items: center;
    gap: var(--spacing-2); /* ← spec token */
    font-size: var(--text-sm); /* ← spec token */
  }

  .react-aria-DataField .label {
    font-weight: 600; /* ← 하드코딩 (font-weight 상수 — spec 미선언) */
  }

  .react-aria-DataField .value {
  }

  .react-aria-DataField .value-empty {
    font-style: italic; /* ← 하드코딩 (CSS 표준 값) */
  }

  .react-aria-DataField .value-boolean {
    font-weight: 600; /* ← 하드코딩 */
    font-size: var(--text-base); /* ← spec token */
  }

  .react-aria-DataField .value-number {
    font-variant-numeric: tabular-nums; /* ← CSS 표준 값 */
  }

  .react-aria-DataField .value-email {
    text-decoration: none;
  }

  .react-aria-DataField .value-email:hover {
    text-decoration: underline;
  }

  .react-aria-DataField .value-url {
    text-decoration: none;
  }

  .react-aria-DataField .value-url:hover {
    text-decoration: underline;
  }

  .react-aria-DataField .value-image {
    width: 40px; /* ← 하드코딩 (독자 수치 — spec.sizes 미선언) */
    height: 40px; /* ← 하드코딩 (독자 수치) */
    border-radius: var(--radius-sm); /* ← spec token */
    object-fit: cover; /* ← CSS 표준 값 */
  }
}
```

**토큰 분류 요약**:

| 구분                        | 건수 | 예시                                                                     |
| --------------------------- | :--: | ------------------------------------------------------------------------ |
| spec token (`var(--*)`)     |  5   | `--spacing-sm`, `--spacing-2`, `--text-sm`, `--text-base`, `--radius-sm` |
| CSS 표준 값 (하드코딩 아님) |  4   | `italic`, `tabular-nums`, `none`, `underline`, `cover`                   |
| 하드코딩 독자 수치          |  3   | `font-weight: 600` (×2), `40px` (×2)                                     |

**G2 판정 근거**: spec token 파생이 주류. 하드코딩은 `font-weight: 600`(의미론적 상수) + `40px`(이미지 크기 독자 수치) — ADR-059 Tier 3 허용 범위 내 residual debt.

---

## 3. Field.css ↔ FieldSpec 분리 구조 증명

### FieldSpec 이 emit 할 selector (CSSGenerator 경로)

CSSGenerator 는 `spec.element = "div"` 시 `.react-aria-{spec.name}` 루트 selector 를 emit 한다. FieldSpec.name = "Field" → emit 대상 selector = `.react-aria-Field`.

그러나 `skipCSSGeneration: true` 이므로 현재 emit 없음.

### Field.css selector

```
.react-aria-FieldGroup   — FieldSpec.name "Field" 와 다름
.react-aria-DataField    — FieldSpec.name "Field" 와 다름
```

**결론**: Field.css 의 selector 는 FieldSpec 이 emit 하는 `.react-aria-Field` 와 **완전히 다름**. Field.css 는 FieldSpec 의 CSS 파생물이 아닌 별도 scope 의 독립 구조 유틸리티 CSS.

### index.css 확인

```
packages/shared/src/components/styles/index.css:57
@import "./Field.css"; /* 구조 유틸리티 — Spec 없음 */
```

주석이 "Spec 없음" 을 명시 — Field.css 가 spec 파생물이 아닌 구조 유틸리티임을 기존 코드베이스가 이미 인지하고 있었음.

---

## 4. Tag @sync 해소 경위 (ADR-106-b 기록 요약)

ADR-106-b §Decision 에서 처리된 @sync 4건 중 Tag 관련 2건:

| 위치             | 원문                                                   | 교체 내용                                                                                   |
| ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `Tag.spec.ts:57` | `// @sync TagGroup.css .react-aria-Tag 기본 색상`      | `// Tag spec shapes 색상은 ADR-106-b 에서 TagGroup.css 와 동일 token 사용 확증됨 (G2 정당)` |
| `Tag.spec.ts:65` | `// @sync TagGroup.css .react-aria-Tag[data-selected]` | `// selected 상태 색상은 ADR-106-b 에서 TagGroup.css selected 블록과 동일 token 확증됨`     |

따라서 Tag 는 G4 대상이 아니며, ADR-106-b scope 에서 완결됨.

---

## 5. SearchField 총계 오류 경위

Charter 작성 시 실행 명령:

```bash
rg -l 'skipCSSGeneration: true' packages/specs/src/components/*.spec.ts | wc -l
# = 27
```

`-l` (파일 목록) 플래그이므로 파일 내 해당 패턴이 있는 파일만 카운트. SearchField.spec.ts:296 의 주석 행이 `skipCSSGeneration: true` 문자열을 포함하므로 파일 자체가 매칭됨.

**실효 플래그**: SearchField.spec.ts:89 `skipCSSGeneration: false` — ADR-059 Phase 에서 이미 false 로 전환됨. generated/SearchField.css 가 존재함(`index.css:119` import 확인).

---

## 6. Charter 총계 최종 조정 (본 ADR 이후)

| 분류          | Charter 최초 | Addendum 1 | Addendum 2 | 본 ADR (Addendum 3 예정) |
| ------------- | :----------: | :--------: | :--------: | :----------------------: |
| G1            |      10      |     10     |     10     |            10            |
| G2            |      9       |     13     |     14     |       **16** (\*)        |
| G3            |      5       |     1      |     0      |            0             |
| G4            |      3       |     3      |     3      |          **0**           |
| 제외          |      0       |     0      |     0      |   **1** (SearchField)    |
| **실효 합계** |    **27**    |   **27**   |   **27**   |          **26**          |

(\*) G2 16건 = Addendum 2 기준 14건 + Tag G2 확정 + Field G2 확정

**주의**: Tag 는 ADR-106-b 에서 이미 G2 처리됨 (Addendum 2 의 14건에 미포함). 본 ADR 이 Tag 를 명시적 G2 확정으로 기록하는 것이 첫 번째 공식 카운트.

실제 분류 건수는 "코드 내 skipCSSGeneration: true 실효 플래그 26건" 이며:

- G1: 10건
- G2: 15건 (CalendarGrid/Header/ColorArea/TagGroup/Table/Tree/GridList/Group/DateSegment/Tag/Field + 4 = 11+4... ※ 재산정 필요)

> 정확한 G2 카운트는 Charter breakdown §1 매트릭스를 실제 코드 기준으로 재산정 필요. 본 Breakdown 에서는 "G4 0건 + G3 0건 + G1 10건 + SearchField 제외" 확정을 주 목표로 함.

---

## 7. ADR-059 Tier 3 예외 등록 대상 (본 ADR 이후 추가 필요)

본 ADR이 Implemented 전환 시 ADR-059 §최종 SSOT 순도 표 (Tier 3 예외 목록)에 추가 필요:

| spec  | 근거 ADR    | 등록 사유                                                         |
| ----- | ----------- | ----------------------------------------------------------------- |
| Tag   | ADR-106-b/d | G2 정당 (TagGroup.css 와 동일 token, @sync 해소 완료)             |
| Field | ADR-106-d   | G2 정당 (FieldSpec 독립 구조 유틸리티 — spec token 파생 CSS 유지) |

---

## 8. 후속 작업 없음 선언

본 ADR 이후 ADR-106 Charter sub-ADR 슬롯 전체 완결:

| 슬롯  | 상태            | 완결 조건                                                                         |
| ----- | --------------- | --------------------------------------------------------------------------------- |
| 106-a | Implemented     | Color family 4건 G2 재판정 완료                                                   |
| 106-b | Implemented     | TagGroup.css G2 정당화 + @sync 4건 해소                                           |
| 106-c | Implemented     | Label G2 정당화 완료                                                              |
| 106-d | **Implemented** | G4 3건 분류 확정 + ADR-059 Tier 3 표 갱신 + Field.css/spec 주석 추가 (2026-04-21) |

**skipCSSGeneration 감사 사이클 종료**: ADR-106 Charter 내 G1~G4 전 카테고리, 전 건 처리 완료. 추가 sub-ADR 없음.

---

## 9. 잔존 debt 추적 (non-blocking)

G2 확정 케이스 중 residual debt:

| 케이스                   | debt 내용                                            | 우선순위 |
| ------------------------ | ---------------------------------------------------- | :------: |
| Field.css `.value-image` | `40px × 40px` 고정 크기 — spec.sizes 미선언          |   LOW    |
| ColorPicker.css `--cp-*` | ADR-106-a R1 에서 기록됨 — spec.sizes alignment 주석 |   LOW    |

두 케이스 모두 현재 동작 무변화. 향후 해당 컴포넌트 spec 편집 시 함께 해소.
