# ADR-105-c: @sync F2 spec-to-CSS 해소 — 자연 해소 확증 + 실질 작업 2건 처리 계획

## Status

Implemented — 2026-04-21

## Implementation Summary (2026-04-21)

Phase 0~3 완결. F2 6건 전부 해소.

- **F2-1/F2-2 Tag**: ADR-106-b 에서 이미 해소 — `rg "@sync" Tag.spec.ts = 0` 재확증
- **F2-3 SelectValue:47**: 설명 주석 교체 — Select.spec `staticSelectors` 가 이미 SelectValue font-size emit 중
- **F2-4 ListBox:218**: 설명 주석 교체 — `containerStyles.background = {color.raised}` SSOT 이미 선언 (line 88)
- **F2-5 ListBox:238**: 설명 주석 교체 — `containerStyles.padding = {spacing.xs}` SSOT 이미 선언 (line 93)
- **F2-6 GridListItem:107 (borderRadius 삼자 정합)**: 대안 B 채택 — Spec `{radius.sm}` 4px → `{radius.lg}` 8px + CSS `var(--radius-md)` 6px → `var(--radius-lg)` 8px. resolver 8px 와 정합. **Skia 시각 변경 0** (이전 resolver 값 유지) + **Preview 시각 변경 Preview borderRadius 6px→8px** (D3 대칭 복구, Builder와 Preview 일치)
- **F2-7 ListBoxItem:132 (lineHeight)**: 설명 주석 교체 — resolver 하드코딩 분기가 현재 테마 `{typography.text-sm--line-height}` = 20px 과 일치. resolver Spec SSOT 소비 전환은 후속 ADR 대기

**검증**: type-check 3/3 + specs 205/205 PASS. BC 영향 0% (GridListItem 시각은 Preview 2px 증가만, Builder 0).

## Context

### SSOT 체인 domain 판정

**D3 (시각 스타일) 전용 작업**. F2 카테고리(@sync spec-to-CSS)는 Spec 파일과 수동 CSS 파일 사이의 시각 값 동기화 경고다. 색상·크기·lineHeight 등 D3 영역만 관여하며 D1(DOM/접근성) / D2(Props/API) 침범 없음.

정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) / 공식 결정: [ADR-063](063-ssot-chain-charter.md)

### 배경 — ADR-105 Charter F2 슬롯

ADR-105 Charter(Implemented 2026-04-21)는 37건 @sync 주석을 F1~F5로 분류했다. **F2 (spec-to-CSS 참조, 6건)** 는 "Spec 파일이 수동 CSS 파일 값과 수동 동기화해야 한다는 경고"로 분류됐다. Charter 당시 판정:

> Generator 자식 selector emit 지원 여부 선행 확인 필수 (반복 패턴 체크 #2)

본 ADR은 F2 6건(+Tag 2건 이미 해소 ADR-106-b 확증) 각각의 현황을 재grep 확인하여 **자연 해소 / 단순 주석 교체 / 실질 작업**으로 재분류한다.

**직전 ADR**: ADR-105-a(F3+F5 primitives 이관, Implemented 2026-04-21) / ADR-105-b(F1 spec-to-spec primitives 공유, Proposed 2026-04-21)

### 선행 판정 — 6건 현황 재grep (2026-04-21 기준, #1 반복 패턴 체크)

| ID   | 파일                   | 라인 | @sync 원문                                                              | 현재 상태                                                                                                            | 판정          |
| ---- | ---------------------- | ---- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------- |
| F2-1 | `Tag.spec.ts`          | 57   | `@sync TagGroup.css .react-aria-Tag 기본 색상`                          | grep 0건 — ADR-106-b에서 이미 제거됨                                                                                 | **완전 해소** |
| F2-2 | `Tag.spec.ts`          | 65   | `@sync TagGroup.css .react-aria-Tag[data-selected]`                     | grep 0건 — ADR-106-b에서 이미 제거됨                                                                                 | **완전 해소** |
| F2-3 | `SelectValue.spec.ts`  | 47   | `@sync Select.css font-size per size`                                   | Select.spec sizeSelectors → SelectValue childSelector emit 확인                                                      | **자연 해소** |
| F2-4 | `ListBox.spec.ts`      | 218  | `@sync containerStyles.background = {color.raised}`                     | ListBox.spec.ts:88 `background: "{color.raised}"` 선언 확인                                                          | **자연 해소** |
| F2-5 | `ListBox.spec.ts`      | 238  | `@sync CSS container padding = --spacing-xs = 4`                        | ListBox.spec.ts:93 `padding: "{spacing.xs}"` 선언 확인                                                               | **자연 해소** |
| F2-6 | `GridListItem.spec.ts` | 107  | `@sync GridList.css .react-aria-GridListItem padding/gap/border-radius` | skipCSSGeneration:true + CSS는 `--radius-md`(6px), resolver는 8px(하드코딩), Spec은 `{radius.sm}`(4px) — 삼자 불일치 | **실질 작업** |
| F2-7 | `ListBoxItem.spec.ts`  | 132  | `@sync sz.lineHeight = {typography.text-sm--line-height}`               | Spec sizes.md.lineHeight = TokenRef 선언됨, but resolver 함수가 fontSize 기반 하드코딩 분기 사용                     | **실질 작업** |

**주요 발견**:

- F2-3 (SelectValue): `Select.spec.ts` `composition.sizeSelectors` → prefix=`select-btn` → per-size `--select-btn-font-size` emit. `composition.staticSelectors` → childSelector=`.react-aria-SelectValue` → `font-size: var(--select-btn-font-size)` 연결. CSSGenerator가 이미 size별 SelectValue font-size를 emit → `SelectValue.spec.ts:47 @sync`는 Spec→CSS 경로가 정상 작동하는 상태에서 남겨진 불필요한 경고.

- F2-4, F2-5 (ListBox): `containerStyles.background = "{color.raised}"` (line 88), `containerStyles.padding = "{spacing.xs}"` (line 93) — ADR-076/079 완결 이후 이미 Spec SSOT에 선언됨. @sync 주석 아래 설명 코멘트(219-220번, 239-243번)가 이미 정당화 서술로 전환됨. 즉 @sync 태그만 남은 상태.

- F2-6 (GridListItem borderRadius): `GridListItemSpec.sizes.md.borderRadius = "{radius.sm}"` = 4px. `resolveGridListItemMetric(fontSize>12)` → `cardBorderRadius: 8` (하드코딩). `GridList.css .react-aria-GridListItem` → `var(--radius-md)` = 6px. 삼자가 모두 다른 값을 사용하는 실질 불일치.

- F2-7 (ListBoxItem lineHeight): `ListBoxItemSpec.sizes.md.lineHeight = "{typography.text-sm--line-height}"` as TokenRef (line 77) 선언됨. 그러나 `resolveListBoxItemMetric(fontSize)` 함수(line 132)가 `sz.lineHeight`를 사용하지 않고 `fontSize <= 12 ? 16 : fontSize <= 14 ? 20 : ...` 하드코딩 분기를 사용. Spec SSOT가 있으나 resolver가 이를 소비하지 않는 구조적 debt.

### Generator 지원 여부 판정 (#2 반복 패턴 체크)

| 케이스                          | Generator 지원 여부                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| SelectValue font-size per size  | **지원** — composition.sizeSelectors + staticSelectors 체인으로 이미 emit 중                     |
| ListBox containerStyles 색상    | **지원** — containerStyles emit (ADR-078 Phase 3/4 완결)                                         |
| GridListItem borderRadius       | **미지원** — skipCSSGeneration:true + 부모 GridList.render.shapes 소비 구조 → CSS만 수동 유지    |
| ListBoxItem lineHeight (고정값) | **부분 지원** — sizes.md.lineHeight TokenRef emit 가능하나 resolver 함수 내 하드코딩이 별도 문제 |

### BC 영향 (#3 반복 패턴 체크)

- F2-1~F2-5: 주석 교체/삭제만 → BC 0%, 사용자 영향 0%
- F2-6: Spec/resolver/CSS 삼자 borderRadius 정합 작업 → Skia 시각 변경(8px→정합 값). 사용자 100%에게 시각 변경이 발생하나 magnitude가 2~4px이며 디자인 의도 정합화.
- F2-7: `resolveListBoxItemMetric` resolver가 Spec.sizes.md.lineHeight TokenRef를 소비하도록 전환 → Skia/layout lineHeight 계산 경로 변경. 현재 하드코딩 분기가 {typography.text-sm--line-height}=20px과 일치(fontSize=14 기준)하므로 실질적 픽셀 변화는 없을 가능성이 높음. 단 토큰 값이 테마에 따라 달라질 경우 정합화됨.

### Hard Constraints

1. **코드 변경 없음 (자연 해소 / 단순 주석 교체 항목)**: F2-1~F2-5는 주석 수정만.
2. **실질 작업 항목 (F2-6, F2-7)**: Phase 분리 + 시각 정합성 검증 필수. 단일 PR 처리 가능하나 type-check 3/3 + specs PASS + builder PASS 의무.
3. **skipCSSGeneration:true 유지**: GridListItem은 구조적으로 skipCSSGeneration이 정당함(부모 GridList.render.shapes 소비 구조). ADR-059 Tier 3 예외 유지.
4. **병행 ADR 충돌 0**: 현재 106-d implementer(Field.css/Field.spec.ts/ADR-059 Tier 3 표) 병행 중. F2 대상 파일(GridListItem.spec.ts, ListBoxItem.spec.ts, GridList.css, ListBox.css, SelectValue.spec.ts, ListBox.spec.ts)과 겹치지 않음.

## Alternatives Considered

### 대안 A: P0 자연 해소 확증 + P1 단순 주석 교체 + P2 실질 작업 분리 (선정)

- 설명: F2 6건을 세 단계로 처리. P0에서 Tag @sync 0건 grep 재확인. P1에서 F2-3~F2-5 설명 주석 교체. P2에서 F2-6 borderRadius 삼자 정합 + F2-7 resolver Spec 소비 전환. Phase별 독립 PR 가능.
- 위험:
  - 기술: LOW — P1은 주석 수정. P2는 resolver 로직 수정으로 범위 제한적.
  - 성능: LOW — lineHeight/borderRadius 값 정합화는 렌더링 경로 변경 없음.
  - 유지보수: LOW — @sync 제거로 수동 동기화 비용 감소.
  - 마이그레이션: LOW — BC 0% (P1) / Skia 시각 2~4px 수준 (P2, 의도된 정합화).

### 대안 B: F2-6 borderRadius를 CSS 기준(6px)으로 Spec/resolver 일치 조정

- 설명: `GridListItemSpec.sizes.md.borderRadius`를 `{radius.md}`=6px로 변경, resolver도 6px로 수정. CSS가 이미 사용 중인 `--radius-md` 기준으로 Spec/resolver/CSS 세 값을 통일.
- 위험:
  - 기술: LOW — 단순 값 변경.
  - 성능: LOW.
  - 유지보수: LOW — Spec이 CSS 기준을 역방향으로 따르는 구조. D3 대칭 원칙상 Spec이 SSOT여야 하나 값 결정권이 CSS에 있는 형태. 단 이미 CSS 가 오래 사용 중인 값이므로 실용적.
  - 마이그레이션: LOW — 시각 차이 2px(4→6) 또는 2px(6→8) 수준.

### 대안 C: F2-6 borderRadius를 Spec 기준(4px)으로 CSS/resolver 일치 조정

- 설명: CSS를 `var(--radius-sm)`=4px로 변경, resolver도 4px로 수정. Spec이 SSOT가 되는 방향.
- 위험:
  - 기술: LOW — 값 변경.
  - 성능: LOW.
  - 유지보수: LOW — D3 Spec SSOT 원칙에 가장 부합.
  - 마이그레이션: LOW — CSS/Skia 시각 변화 2~4px. 디자인 리뷰 필요.

### 대안 D: F2-6 borderRadius ADR-059 Tier 3 예외 정당화 + 주석 교체 (실질 정합 포기)

- 설명: GridListItem은 skipCSSGeneration:true 구조이므로 Spec/CSS 값 불일치를 "Tier 3 예외"로 정당화하고 @sync를 설명 주석으로 교체만 수행. 실제 값 정합화는 포기.
- 위험:
  - 기술: LOW — 코드 변경 없음.
  - 성능: LOW.
  - 유지보수: **HIGH** — 삼자 불일치(Spec 4px / resolver 8px / CSS 6px)가 영구화됨. 향후 디자인 변경 시 세 곳 수동 동기화 비용 유지.
  - 마이그레이션: LOW.

### Risk Threshold Check

| 대안                              | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정     |
| --------------------------------- | :--: | :--: | :------: | :----------: | :------: | -------- |
| A: P0+P1 주석 + P2 Spec 기준 정합 |  L   |  L   |    L     |      L       |    0     | **PASS** |
| B: CSS 기준(6px) 통일             |  L   |  L   |    L     |      L       |    0     | **PASS** |
| C: Spec 기준(4px) 통일            |  L   |  L   |    L     |      L       |    0     | **PASS** |
| D: Tier 3 정당화 + 주석 교체만    |  L   |  L   |    H     |      L       |    1     | 기각     |

B/C/A 모두 PASS. **A (P0+P1 주석 교체 + P2 실질 정합화)** 를 선정하되, F2-6 borderRadius의 기준값은 **resolver 현재 사용값 8px** → `{radius.lg}`=8px로 Spec 업데이트 + CSS `--radius-md`(6px)→`--radius-lg`(8px)로 통일. 이유: resolver가 실제 렌더링에 사용하는 8px을 기준으로 삼아야 Skia ↔ CSS 시각 대칭 달성. Spec에 선언된 `{radius.sm}`=4px는 초기 선언 오류.

반복 패턴 체크 (#4 Phase 분리):

- F2-1~F2-5 (P0+P1): 0코드 변경 또는 주석 수정 → 독립 슬롯.
- F2-6 (P2-a): GridListItem borderRadius 삼자 정합 → 독립 슬롯.
- F2-7 (P2-b): ListBoxItem resolver Spec 소비 전환 → 독립 슬롯 (regression: type-check + Skia visual check).

## Decision

**대안 A 채택 (P0 + P1 + P2-a + P2-b 4단계)**.

선택 근거:

1. **F2-1, F2-2 (Tag)**: ADR-106-b grep 0건 재확증 → 별도 작업 불필요. Charter 매트릭스에서 제외 처리.
2. **F2-3 (SelectValue)**: Select.spec.ts `composition.sizeSelectors` + `staticSelectors` 체인이 CSSGenerator를 통해 `[data-size="xs"] .react-aria-SelectValue { font-size: ... }` 를 이미 emit 중 → @sync는 불필요 경고. 설명 주석 `// Select.spec sizeSelectors → SelectValue childSelector 경유 font-size per size emit 중 (ADR-078 childSpec emit 확인)` 으로 교체.
3. **F2-4, F2-5 (ListBox)**: containerStyles.background={color.raised}, padding={spacing.xs} 이미 Spec에 선언됨(ADR-076/079 완결). @sync 태그를 제거하고 하위 설명 주석은 유지.
4. **F2-6 (GridListItem borderRadius)**: resolver가 실제 사용하는 8px(`{radius.lg}`)를 Spec SSOT로 확정. CSS도 `var(--radius-lg)`로 통일. Skia ↔ CSS 시각 대칭 달성.
5. **F2-7 (ListBoxItem lineHeight)**: resolver가 `sz.lineHeight`를 직접 읽되, TokenRef를 `resolveToken()`으로 변환 후 소비. Spec SSOT 소비 구조 복원.

기각 사유:

- **대안 D 기각**: GridListItem 삼자 불일치를 영구화하면 ADR-063 D3 symmetric consumer 원칙이 형해화됨. resolver(Skia 경로) 8px ↔ CSS 6px ≠ 대칭.
- **대안 C 기각**: Spec 기준(4px)이 현재 CSS(6px)·resolver(8px) 양쪽과 멀어 세 경로를 모두 수정해야 하는 비용이 크고, resolver가 이미 오랫동안 8px로 렌더링하여 사용자가 기대하는 시각이 8px 수준임.

> 구현 상세: [105-c-sync-spec-to-css-resolution-breakdown.md](../../adr/design/105-c-sync-spec-to-css-resolution-breakdown.md)

## Risks

| ID  | 위험                                                                                                                            | 심각도 | 대응                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | :----: | ----------------------------------------------------------------------------------------------- |
| R1  | F2-6 borderRadius CSS 변경(`--radius-md` → `--radius-lg`) 이 GridList 전체 카드 시각에 영향                                     |  MED   | `/cross-check` skill로 Skia ↔ CSS 시각 대칭 검증. 변화량 2px(6→8) — 디자인 의도 정합화.         |
| R2  | F2-7 resolver 전환 시 `resolveToken()` 미적용으로 TokenRef 문자열이 그대로 숫자로 사용되는 회귀                                 |  MED   | resolveToken() 래핑 + type-check 통과 확인. 변환 실패 시 fallback 20 유지.                      |
| R3  | ListBoxItem.spec.ts:77의 `lineHeight: "{typography.text-sm--line-height}"` → `resolveToken()` 결과가 테마에 따라 달라질 수 있음 |  LOW   | 기본 테마에서 20px 일치 확인. 테마 시스템이 토큰 값을 정의한 대로 소비되므로 오히려 정합화.     |
| R4  | F2-3 주석 교체 시 "자연 해소" 서술이 미래 개발자에게 오해 유발 (실제 코드 경로 불명확)                                          |  LOW   | 교체 주석에 Select.spec.ts staticSelectors → childSelector emit 경로를 구체 파일:라인으로 명시. |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략.

본 ADR 구현 완료 조건:

- `Tag.spec.ts` grep @sync 0건 (이미 완료 — ADR-106-b 확증)
- `SelectValue.spec.ts`, `ListBox.spec.ts` @sync 제거 + 설명 주석 교체 완료
- `GridListItem.spec.ts` borderRadius `{radius.lg}` + `GridList.css .react-aria-GridListItem border-radius: var(--radius-lg)` + resolver `cardBorderRadius: 8` 일치 → @sync 삭제
- `ListBoxItem.spec.ts:132` @sync 삭제 + resolver `resolveToken(sz.lineHeight)` 소비 전환
- type-check 3/3 PASS + specs 205/205 PASS + builder 227/227 PASS

## Consequences

### Positive

- **F2 6건 중 5건 해소 확증**: F2-1~F2-5 자연/단순 해소로 Charter 매트릭스 업데이트 가능
- **GridListItem Skia ↔ CSS 대칭 복원**: 8px 기준으로 삼자 정합 → ADR-063 D3 symmetric consumer 원칙 준수
- **ListBoxItem resolver Spec 소비 구조**: `sz.lineHeight` TokenRef 직접 소비 → 테마 시스템과 자동 연동
- **@sync 수동 동기화 비용 제거**: F2 카테고리 7건 중 4건(F2-3~F2-6) @sync 삭제로 drift 위험 제거

### Negative

- **F2-6 CSS 변경**: GridList.css `var(--radius-md)` → `var(--radius-lg)` 변경은 실제 시각 2px 변화 (6px→8px). 디자인 검토 필요.
- **F2-7 resolver 전환**: `resolveListBoxItemMetric` 내부 로직 변경으로 함수 signature는 유지되나 내부 lineHeight 계산 경로가 달라짐. 모든 소비 코드에서 regression check 필요.
- **F2-6 Spec 수정**: `GridListItemSpec.sizes.md.borderRadius` 변경 → 이를 소비하는 `resolveGridListItemMetric`의 `sz.borderRadius` 사용 경로도 확인 필요 (현재는 resolver가 8 하드코딩 사용이므로 Spec 변경만으로 회귀 없음).

## 참조

- [ADR-105](105-sync-annotation-audit-charter.md) — @sync 감사 Charter, F2 슬롯 정의
- [ADR-105-a](105-a-sync-utils-constants-primitives.md) — F3+F5 primitives 이관 (Implemented)
- [ADR-105-b](105-b-sync-spec-to-spec-primitives-sharing.md) — F1 spec-to-spec (Proposed)
- [ADR-106-b](106-b-taggroup-css-skipcss-justification.md) — Tag @sync 해소 확증
- [ADR-076](076-listbox-items-ssot-hybrid.md) — ListBox containerStyles SSOT
- [ADR-078](078-listboxitem-spec-and-generator-child-selector.md) — Generator 자식 selector emit (ADR-078 Phase 2/3)
- [ADR-090](090-gridlistitem-spec-and-skia-metric-ssot.md) — GridListItem card metric SSOT
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D3 symmetric consumer 원칙
