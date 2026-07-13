# ADR-091: utils.ts + cssResolver.ts Record<string, number> 해체 — Class A/B/C 3-분류 sweep

## Status

Implemented — 2026-04-21

## Context

composition SSOT 체인 (ADR-036/063) 은 시각 metric 을 Spec SSOT 로 복귀시키는 중. ADR-086 G4 가 `implicitStyles.ts` 의 `Record<string, number>` 를 0건 달성했으나 감사 누락으로 **`utils.ts` (11건) + `cssResolver.ts` (1건) = 12건 잔존** 확인됨 (2026-04-21 재감사).

### D3 domain 판정 ([ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md))

**D3 (시각 스타일) symmetric consumer 의 대칭 복구**. 단 12건 중 `FONT_STRETCH_KEYWORD_MAP` (CSS font-stretch 키워드→percentage 변환 표준) 은 D3 Spec SSOT 적용 대상이 아닌 **CSS 표준 상수**로 별도 판정.

### 실측 — 12건 소비 경로 감사

| ID  | 위치                 | 내용                                 | 소비처                                          | SSOT source                                                          |
| --- | -------------------- | ------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------- |
| R1  | `cssResolver.ts:181` | FONT_STRETCH_KEYWORD_MAP (9 keyword) | `cssResolver.ts:208`                            | **CSS 표준 (Spec 외)**                                               |
| R2  | `utils.ts:450`       | DEFAULT_ELEMENT_WIDTHS (tag→px)      | `utils.ts:1405` default width fallback          | **Spec.sizes 외** (tag-level default)                                |
| R3  | `utils.ts:842`       | ICON_SIZE_MAP (size→px)              | 지역 scope 소비                                 | **IconSpec.sizes 이미 동일 metric 존재** (Icon.spec.ts:50) → Class A |
| R4  | `utils.ts:1420`      | TABS_BAR_HEIGHT                      | `utils.ts:2379` + `implicitStyles.ts:926/1029`  | **이미 TabsSpec.sizes 파생** (`Object.fromEntries`)                  |
| R5  | `utils.ts:1423`      | TABS_PANEL_PADDING                   | `utils.ts:2381` + `implicitStyles.ts:43/44`     | **이미 Spec 파생**                                                   |
| R6  | `utils.ts:1427`      | DEFAULT_ELEMENT_HEIGHTS              | `utils.ts:2653`                                 | **Spec.sizes 외** (tag-level default)                                |
| R7  | `utils.ts:1527`      | ICON_SIZE_MAP (중복 선언)            | 지역 scope 소비                                 | R3 과 DRY 위반 + IconSpec.sizes (Icon.spec.ts:50) → Class A          |
| R8  | `utils.ts:1791`      | TRIGGER_CONTENT_HEIGHTS              | `utils.ts:1798` (parentSize lookup)             | 부모 Spec.sizes 이관 가능                                            |
| R9  | `utils.ts:1960`      | headerHeights (Calendar)             | 지역 scope                                      | CalendarHeader.spec.sizes 이관 가능                                  |
| R10 | `utils.ts:1968`      | inputHeights (DateInput intrinsic)   | `utils.ts:1965` `if (tag === "dateinput")` 분기 | DateInput.spec.sizes 이관 가능                                       |
| R11 | `utils.ts:2029`      | dfHeights (DateField)                | 지역 scope                                      | DateField.spec.sizes 이관 가능                                       |
| R12 | `utils.ts:2037`      | COMBOBOX_INPUT_HEIGHTS               | `utils.ts:2086/2209`                            | ComboBox.spec.sizes 이관 가능                                        |

### 3-Class 분류

- **Class A (spec.sizes 이관, size-indexed)** — R3 / R7 / R8 / R9 / R10 / R11 / R12 — 해당 Spec.sizes 에 필드 추가 후 `specSizeField` lookup 전환 (ADR-086 G4 패턴 재사용). **R3/R7 ICON_SIZE_MAP 은 IconSpec.sizes (Icon.spec.ts:50) 에 xs~xl metric 이 이미 존재** → Codex round 2 지적 반영 (Class C 재분류)
- **Class B (이미 Spec 파생 — 중간 캐시 해체)** — R4 / R5 — `TABS_BAR_HEIGHT` 는 `Object.fromEntries(TabsSpec.sizes)` 이미 파생. 소비처가 직접 `TabsSpec.sizes[size].height` 참조하면 중간 export 제거 가능
- **Class C (Spec SSOT 외 — primitives/ 분리)** — R1 — CSS 표준 상수 (`FONT_STRETCH_KEYWORD_MAP` 9 keyword→percentage). `packages/specs/src/primitives/font.ts` 로 이관

### tag-level default 남은 debt

R2 `DEFAULT_ELEMENT_WIDTHS` + R6 `DEFAULT_ELEMENT_HEIGHTS` 는 tag→px mapping (size 축 무관). 해체하려면 `ComponentSpec` 에 `defaultWidth?: number` / `defaultHeight?: number` 필드 신설 필요 = **Schema 확장 + 62 spec 재검토**. 본 ADR 에서는 **scope 외** 로 판정 — 후속 ADR 후보 (Addendum 1) 로 명시.

### Hard Constraints

1. Class A 이관 시 각 Spec.sizes 필드 추가가 **BC 유지** — optional 필드로 추가, 기존 spec 영향 0
2. Class B 해체 시 `TABS_BAR_HEIGHT` / `TABS_PANEL_PADDING` import 경로가 소비처 2-3 곳에 흩어져 있음 — 전부 `specSizeField` 또는 직접 spec 참조로 전환 누락 방지
3. Class C 이관 시 `primitives/` 경로가 기존 shared constants 위치와 일치해야 — `packages/specs/src/primitives/` 에 저장
4. `pnpm type-check` 3/3 + specs 166/166 + builder 217/217 PASS
5. 최종: `rg "Record<string, number>" apps/builder/src/builder/workspace/canvas/layout/engines/{utils,cssResolver}.ts` 결과가 **2건** 로 축소 (R2/R6 scope 외 남음, 후속 ADR 대상)

### Soft Constraints

- R3/R7 ICON_SIZE_MAP 중복 해결 부산물: IconSpec.sizes direct consumption 으로 통합 (Codex 재분류)
- Phase 분할: Class C → B → A 순서 (독립성 높은 것부터)

## Alternatives Considered

### 대안 A: 3-Class 분할 sweep — Class C → B → A 순차 (선정)

- 설명: 12건을 3-Class 로 분류 후 순서대로 Phase 해체. Class A 는 spec.sizes 이관, Class B 는 중간 캐시 제거, Class C 는 primitives/ 분리. R2/R6 (tag-level default) 는 scope 외 후속 ADR
- 근거: ADR-086 G4 선례 패턴 재사용 가능 (Class A). 각 Class 독립 진행 가능
- 위험:
  - 기술: LOW — 기존 `specSizeField` 헬퍼 재사용
  - 성능: LOW
  - 유지보수: LOW — SSOT 복귀
  - 마이그레이션: LOW — BC 0

### 대안 B: 12건 전체 단일 Phase 해체 + `ComponentSpec.defaultWidth/Height` Schema 확장 포함

- 설명: tag-level default (R2/R6) 도 Schema 확장으로 포함. 12건 0건 달성
- 근거: 완전 해체 한 번에
- 위험:
  - 기술: **MEDIUM** — Schema 확장 + 62 spec 감사 (어떤 spec 이 defaultWidth 를 갖고 있어야 하는지 판정)
  - 성능: LOW
  - 유지보수: LOW
  - 마이그레이션: **MEDIUM** — 기존 프로젝트 데이터 영향 검사 필요 (사용자 저장 layout 에 default 의존 있을 수 있음)

### 대안 C: 현 상태 유지

- 설명: 12건 잔존 유지
- 근거: 범위 축소
- 위험:
  - 기술: LOW
  - 성능: LOW
  - 유지보수: **HIGH** — SSOT 위반 debt 영구화. implicitStyles 분기 0 달성에도 `utils.ts` 대형 고립
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안                             | HIGH+ 수 | 판정                             |
| -------------------------------- | :------: | -------------------------------- |
| A: 3-Class 순차 (R2/R6 scope 외) |    0     | PASS                             |
| B: 전체 sweep + Schema 확장      |    2     | (BC 검증 복잡 → 기각, 분리 권장) |
| C: 현 상태 유지                  |    1     | (debt 영구화 → 기각)             |

대안 A 가 HIGH+ 0 — threshold pass.

## Decision

**대안 A 채택**. 3-Phase 순차 해체. R2/R6 (DEFAULT_ELEMENT_WIDTHS/HEIGHTS) 는 Schema 확장 필요로 **Addendum 1 후속 ADR** 로 분리.

### Phase 구성

- **Phase 1 (Class C, 15분)**: `FONT_STRETCH_KEYWORD_MAP` → `packages/specs/src/primitives/font.ts` 신설 + export. `packages/specs/src/primitives/index.ts` 에 font re-export 추가 (기존 colors/radius/shadows/spacing/typography 관행 동일). **ICON_SIZE_MAP 은 Phase 3 로 이동** (Codex round 2 재분류)
- **Phase 2 (Class B, 1시간)**: `TABS_BAR_HEIGHT` / `TABS_PANEL_PADDING` export 유지하되 내부를 `TabsSpec.sizes[size].height` 직접 참조로 전환 (소비처는 그대로). 또는 export 제거 후 4 소비처 `specSizeField` 전환. 순환 의존 없음 — `utils.ts:36` 이 이미 `import { TabsSpec, TabPanelsSpec } from "@composition/specs"` 중
- **Phase 3 (Class A, 1-2시간)**: R3/R7/R8/R9/R10/R11/R12 각각 해당 Spec.sizes lookup 전환:
  - R3/R7 ICON_SIZE_MAP 2곳 → `specSizeField("icon", sizeName, "width")` 또는 `iconSize` 필드 (Icon.spec 검증 후 결정)
  - R8 TRIGGER_CONTENT_HEIGHTS → 부모 Spec.sizes
  - R9 headerHeights → CalendarHeader.spec.sizes
  - **R10 inputHeights → DateInput.spec** (DateField 아님 — `utils.ts:1965` `if (tag === "dateinput")` 분기)
  - R11 dfHeights → DateField.spec.sizes
  - R12 COMBOBOX_INPUT_HEIGHTS → ComboBox.spec.sizes
  - 모두 지역 Record 선언 제거
- **검증**: 매 Phase 마다 type-check 3/3 + specs 166/166 + builder 217/217 PASS

### Addendum 1 후속 ADR 후보

- **ADR-091-A1**: `ComponentSpec.defaultWidth?: number` / `defaultHeight?: number` Schema 확장 + `DEFAULT_ELEMENT_WIDTHS/HEIGHTS` (R2/R6) 해체. 62 spec 감사 + BC 검증 필요 — 별도 세션 권장

## Risks

| ID  | 위험                                                                       | 심각도 | 대응                                                                                                                |
| --- | -------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------- |
| R1  | Class B 소비처 전환 누락 → TABS_BAR_HEIGHT import 살아있는데 내부 비어있음 |  LOW   | rg 로 import 경로 전수 확인, 단계적 전환. 순환 의존 없음 확증 (`utils.ts:36` 이미 TabsSpec/TabPanelsSpec import 중) |
| R2  | Class A Spec.sizes 필드 추가 시 기존 spec snapshot 변동                    |  LOW   | `pnpm test -u` 정식 갱신, 변동 내용 리뷰                                                                            |
| R3  | R2/R6 (DEFAULT_ELEMENT_WIDTHS/HEIGHTS) 해체 미진행 → 본 ADR "완결" 오인    |  LOW   | Addendum 1 후속 ADR 명시 + README 에 명시                                                                           |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략. 검증 기준:

- type-check 3/3 PASS ✅ (2026-04-21 확인)
- specs 166/166 PASS ✅
- builder 227/227 PASS ✅ (ADR-094 영향 유지)
- Phase 1 완료 후 `rg "Record<string, number>" cssResolver.ts utils.ts` = **11건** (R1 제거됨) ✅
- Phase 2 완료 후 **9건** (R4/R5 제거) ✅
- Phase 3 완료 후 **3건** ✅ — R2/R6 (Addendum 1) + **R11 (Addendum 2 신규 이관)** 잔존. R3/R7/R8/R9/R10/R12 = 6 건 Class A spec.sizes 로 이관 완료.

## 구현 결과 (2026-04-21)

- **Phase 1 (Class C)**: `packages/specs/src/primitives/font.ts` 신설 + `FONT_STRETCH_KEYWORD_MAP` export. `primitives/index.ts` + 패키지 `src/index.ts` re-export. `cssResolver.ts:181` local 선언 제거 + import 전환. Record 카운트: 12→11.
- **Phase 2 (Class B)**: `utils.ts:1420-1425` `TABS_BAR_HEIGHT` / `TABS_PANEL_PADDING` export 2 건 삭제. `implicitStyles.ts` 3 소비처 (`resolveTabPanelPadding` 함수 내 3 call + `containerTag==="tabs"` 926/1029) → `specSizeField("tabs"|"tabpanels", ...)` 전환. `utils.ts:2379/2381` Tabs intrinsic height → `TabsSpec/TabPanelsSpec.sizes` 직접 참조. Record 카운트: 11→9.
- **Phase 3 (Class A)**: 6 소비처 spec.sizes 이관.
  - R3/R7 `ICON_SIZE_MAP` 2 곳 → `IconSpec.sizes.iconSize` (기존 필드 재사용).
  - R8 `TRIGGER_CONTENT_HEIGHTS` → `SelectTriggerSpec.sizes.contentHeight` (**신규 필드**, SizeSpec 에 `contentHeight?: number` 추가). SelectTrigger ↔ ComboBoxWrapper 는 tagSpecMap 에서 동일 spec 공유.
  - R9 `headerHeights` → `CalendarHeaderSpec.sizes.height`.
  - R10 `inputHeights` → `DateInputSpec.sizes.height`.
  - R12 `COMBOBOX_INPUT_HEIGHTS` 2 소비처 → `ComboBoxSpec.sizes.height` (local `comboBoxHeight` 헬퍼).
  - **R11 (DateField `dfHeights`) Addendum 2 로 이관**: `{sm:32, md:40, lg:48}` 은 Label + gap + DateInput 합산 **파생값** 이며 `DateFieldSpec.sizes.height` (입력 부분 `{sm:22, md:30, lg:42, xl:54}`) 와 값 불일치. spec 에 파생값 저장 = DRY 위반 판단 → 별도 ADR (ADR-091-A2) 에서 Label/Input 분리 lookup + 런타임 합산 or 새 필드 명시적 추가 검토 필요.
  - Record 카운트: 9→3 (R2/R6/R11).

### Addendum 후속 ADR 후보

- **ADR-091-A1**: `ComponentSpec.defaultWidth?/defaultHeight?` Schema 확장 + `DEFAULT_ELEMENT_WIDTHS/HEIGHTS` (R2/R6) 해체. 62 spec 감사 + BC 검증 필요 — 별도 세션 권장

### Addendum 2 — DateField dfHeights SSOT (2026-04-21 완결)

옵션 (a) 채택: `SizeSpec.intrinsicHeight?: number` optional 필드 신규 + `DateFieldSpec.sizes` 에 `sm:32 / md:40 / lg:48 / xl:62` 선언. `utils.ts:2011` `dfHeights: Record<string, number> = { sm: 32, md: 40, lg: 48 }` 해체 → `DateFieldSpec.sizes[sizeName]?.intrinsicHeight ?? 40` 직접 참조.

**결정 근거**: composite 컴포넌트 (Label + gap + DateInput) 의 전체 intrinsic 높이는 컴포넌트 시각 "치수" 이므로 spec 에 표면화하는 것이 자연스러움. `sizes.height` 가 DateInput 부분만 의미하고 `intrinsicHeight` 가 Label 포함 전체 — 의미론적 분리가 명확. 옵션 (b) 런타임 합산은 Label sizes 의존성 + gap 계산 복잡도가 추가 ROI 낮아 기각.

**xl 값**: 기존 `dfHeights` 에 xl 없었음 → 스케일 유추로 `62` 선언 (54 + 8). 실제 xl 사용 시 검증 필요.

Record 카운트: 3→2 건 (R2/R6 DEFAULT*ELEMENT*\* 만 잔존 = ADR-091-A1 scope).

검증: type-check 3/3 + specs 166/166 + builder 227/227 PASS.

## Consequences

### Positive

- SSOT 위반 debt 대부분(10/12) 해소
- `primitives/` 분리로 향후 CSS 표준 상수 추가 시 일관된 위치 확보
- ADR-086 G4 패턴 확장 (utils.ts 까지 커버리지 확대)
- Class A spec 신설 필드는 style panel 자동 편집 가능 (ADR-067 연동)

### Negative

- R2/R6 tag-level default 는 본 ADR 에서 미해결 — Addendum 1 필요 (debt 2건 잔존 명시)
- Phase 3 size-indexed 이관 시 소비처 별 spec reference 라인 증가 (단일 Record lookup vs spec.sizes lookup)

## 참조

- [ADR-086](086-implicitstyles-size-record-dissolution-and-breadcrumb-child.md) — G4 선례 (implicitStyles Record 해체, specSizeField 헬퍼)
- [ADR-088](088-sizespec-columngap-slider-col-gap-dissolution.md) — SizeSpec 필드 확장 선례
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 domain 원칙
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D3 symmetric consumer 정본
