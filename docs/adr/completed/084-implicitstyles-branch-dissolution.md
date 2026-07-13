# ADR-084: implicitStyles 하드코딩 분기 해체 — 4 spec (Calendar/RangeCalendar/SelectTrigger/Breadcrumbs) parent container primitive 해체

## Status

Implemented — 2026-04-20 (**Revision 3** 기반 land: `1b2cf60c` P0 flexWrap schema / `3a8510f0` P1 Calendar / `049e830c` P3+P4 SelectTrigger + Breadcrumbs parent. 4 spec (Calendar/RangeCalendar/SelectTrigger/Breadcrumbs) parent container primitive 해체 완료. Phase A2 ProgressBar/Meter 는 후속 ADR. Rev 3 = Codex Round 4 LOW 3건 반영: scope 숫자 정합성 정리 + breakdown flexWrap 설명을 Phase A4 Breadcrumbs 단일로 축소. Rev 2 = Codex Round 3 Phase A2 scope 분리. Rev 1 = Codex Round 2 제목 축소 + R5 + R3-A.)

## Context

### D3 domain 판정 (ADR-063 SSOT 체인)

본 ADR 은 [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) **D3 (시각 스타일) symmetric consumer 의 대칭 복구**. ADR-083 Phase 0 이 `applyImplicitStyles` 진입부에 공통 선주입 layer 를 구축하여 Spec.containerStyles 를 parentStyle 에 자동 주입하도록 했으나, 5 spec (Calendar / ProgressBar / Meter / SelectTrigger / Breadcrumbs) 의 하드코딩 분기가 **직접 할당 override** 로 Phase 0 효력 무효화. Skia 와 CSS 간 실제 레이아웃 값 불일치 상태.

### 현재 비대칭 구조

| spec                | archetype              | CSS 최종값            | Skia 실제값 (분기 override)          | 대칭 상태 |
| ------------------- | ---------------------- | --------------------- | ------------------------------------ | --------- |
| Calendar            | `grid`                 | `display:grid`        | `display:flex; flexDirection:column` | ❌ 비대칭 |
| ProgressBar / Meter | `grid`                 | `display:grid`        | `display:flex; flexDirection:row`    | ❌ 비대칭 |
| SelectTrigger       | `button` (inline-flex) | `display:inline-flex` | `display:flex; flexDirection:row`    | ❌ 비대칭 |
| Breadcrumbs         | `simple` (inline-flex) | `display:inline-flex` | `display:flex; flexDirection:row`    | ❌ 비대칭 |

ADR-083 Phase 4/8/10/11 실행 시 각 spec 의 containerStyles 에 `display: "grid"` 또는 `display: "inline-flex"` 를 archetype 기준으로 리프팅했으나, 분기의 직접 할당이 이를 무시 → Skia 에는 archetype/spec 값이 반영되지 않는 비대칭 지속.

### Scope (Revision 2 — Codex Round 3 반영으로 재정렬)

본 ADR 은 아래 **4 spec (5 분기 중 4 분기)** 의 parent container (effectiveParent) primitive 만 해체한다:

- Phase A1 — Calendar / RangeCalendar 분기 (`implicitStyles.ts:1850`)
- Phase A3 — SelectTrigger 분기 (`implicitStyles.ts:1256`)
- Phase A4 — Breadcrumbs parent 분기 (`implicitStyles.ts:914-976` — parent effectiveParent 만)

### Scope 외 — 별도 후속 ADR 분리

- **Phase A2 — ProgressBar / Meter 분기** (`implicitStyles.ts:1566`): `ProgressBar.css` 가 `grid-template-areas: "label value" "bar bar"` + `grid-template-columns: 1fr auto` + 자식 `grid-area` 로 배치 중. spec.containerStyles.display 를 `grid → flex` 변경 시 template 무효화 + 자식 grid-area 무효 → Preview 배치 **구조적 깨짐 HIGH**. **`ContainerStylesSchema` 에 `grid-template-areas`/`grid-template-columns` 미지원**. 본 ADR 에서는 완전 제외, **별도 후속 ADR** (Schema 확장 + emitContainerStyles 확장 + Phase A2 실행) 대상. 본 ADR 의 Risk Threshold / Risks / Gates 는 Phase A2 를 포함하지 않음
- **Breadcrumb child 주입** (`implicitStyles.ts:955-971`) — `width/minWidth`=`itemWidth(measureTextWidth)`, `height/minHeight`=`breadcrumbsHeight(spec size)`, `flexShrink: 0`, `flexGrow: 0`. 비즈니스 로직(텍스트 측정 + size 기반) → 대안 C 경로 후속 ADR (본 ADR 은 Breadcrumbs parent container 만)
- **size-based padding/gap** (Calendar/ProgressBar/Meter/Breadcrumbs) — spec.sizes 모델 확장 필요 → 대안 C 경로 후속 ADR

### 감사 결과 (40 분기 중 본 ADR 4 분기 + 후속 ADR 1 분기)

`implicitStyles.ts` 의 `containerTag === "..."` 분기 총 40 매치 중:

- **약 15 분기**: `parentStyle.X ?? "값"` 패턴 — Phase 0 선주입 후 자연 호환 (spec 값 우선)
- **약 20 분기**: 비즈니스 로직 (orientation/size 조건부, children 처리, selectedKey 등) — 단순 해체 불가, scope 외
- **5 분기** 총 직접 할당 override 발견 — ADR-083 Phase 0 효력 무효화:
  - **4 분기 (본 ADR scope)**: Calendar/RangeCalendar (`:1850`), SelectTrigger (`:1256`), Breadcrumbs parent (`:914-976`)
  - **1 분기 (별도 후속 ADR)**: ProgressBar/Meter (`:1566`) — grid-template cascade 위험으로 scope 분리 (Revision 2)

### Hard Constraints

1. **기존 시각 결과 변화 없음** — 현재 Skia 가 flex 로 렌더링 중이며 사용자는 이에 익숙. Spec 값을 실제 값(flex)에 맞춰 변경 → CSS cascade 재검증 필요
2. **ADR-083 Phase 0 인프라 유지** — `LOWERCASE_TAG_SPEC_MAP`, `applyImplicitStyles` 공통 선주입 layer, `CONTAINER_STYLES_FALLBACK_KEYS` 보존
3. **type-check 3/3 + builder 217/217 + specs 166/166 회귀 0**
4. **archetype table 무변경** — `CSSGenerator.ts:50-116 ARCHETYPE_BASE_STYLES` 수정 없음 (ADR-083 유지 원칙)
5. **각 분기의 비즈니스 로직 보존** — size-based padding/gap/height, children 처리, selectedKey 필터 등

### Soft Constraints

- Chrome MCP 실측 환경 제약 (background chrome 가용성) → cascade 검증 + CSS diff 로 대체 가능
- 후속 35 분기 (scope 외) 는 별도 ADR 로 이어갈 수 있음
- `ContainerStylesSchema` 에 `flexWrap` 미지원 — Phase 0 선행 확장 필요 (Phase A4 Breadcrumbs 가 `flexWrap:"nowrap"` 요구)

## Alternatives Considered

### 대안 A: archetype 재분류 (Calendar/ProgressBar/Meter 를 "flex-column" archetype 으로 이동)

- 설명: Calendar/ProgressBar/Meter 의 archetype 을 실제 구조에 맞는 새 archetype 또는 기존 `collection` (flex column) 로 변경
- 근거: archetype 의 정의 = "유사 구조 공유 컴포넌트의 CSS base" 이므로 실제 구조와 일치해야 의미있음
- 위험:
  - 기술: MED — archetype table 변경이 CSSGenerator 에 영향 (`packages/specs/src/renderers/CSSGenerator.ts:50-116 ARCHETYPE_BASE_STYLES` + `:534-549 generateBaseStyles` archetype lookup 2곳)
  - 성능: LOW — CSS 재생성만
  - 유지보수: **HIGH** — archetype 의 의미가 약화 (실제 구조 ≠ archetype 허용 시 classification 체계 붕괴). **구체 영향**: Calendar/ProgressBar/Meter 를 `collection` 으로 이동 시 `collection` 기존 소비자 6 spec(`ListBox.spec.ts:69 archetype:"collection"`, `Menu.spec.ts:~60`, `Autocomplete.spec.ts:21`, `TabPanel.spec.ts:26`, `TabPanels.spec.ts:20` — Phase 6 확인) 와 의미 혼재. `grid` archetype 의 실질 소비자는 `ProgressCircle.spec.ts:54`, `SliderTrack.spec.ts:38`, `SliderThumb.spec.ts:34` 3 spec 만 남음 → archetype 정의 불안정화
  - 마이그레이션: MED — 3 spec 의 CSS 변화 → Preview/Publish 전수 회귀 검증

### 대안 B: spec containerStyles 를 실제 구조 값으로 선언 (archetype 유지, 분기 해체)

- 설명: 각 spec.containerStyles 에 실제 Skia 값(flex/flex-direction/flexWrap)을 선언하고 archetype table 은 유지. 분기의 style 직접 할당 부분만 제거, 비즈니스 로직은 유지.
- 근거: ADR-083 의 SSOT 원칙 — spec 이 실제 구조를 선언. CSSGenerator 는 containerStyles 를 archetype 다음 cascade 순서로 emit 하므로 spec 값이 최종 승리. Phase 6 Menu (archetype=collection + containerStyles.display=flex) 의 선례 재사용.
- 위험:
  - 기술: LOW — 이미 Phase 6 Menu + Phase 8 SelectTrigger 등 containerStyles override 선례 존재
  - 성능: LOW — CSS 1-3 라인 추가 (double-emit but cascade 동일)
  - 유지보수: LOW — spec 중심 일관성 복구, archetype 은 "기본값" 역할 명확화
  - 마이그레이션: LOW — 각 spec 개별 변경, 독립 커밋, 롤백 쉬움

### 대안 C: implicitStyles 분기 완전 해체 + 비즈니스 로직 spec 이관

- 설명: Calendar 분기의 padding/gap (size-based), ProgressBar/Meter 의 rowGap/columnGap, Breadcrumbs 의 크기 계산 등 비즈니스 로직도 spec.sizes 나 spec.render 로 이관하여 분기 자체 삭제
- 근거: 완전 SSOT 복귀 — implicitStyles 에 layout 값 전멸
- 위험:
  - 기술: **HIGH** — spec 모델 확장 필요. **구체 이관 대상 3곳**: (1) `implicitStyles.ts:1566-1665` PROGRESSBAR_TAGS 분기의 `autoFormattedValue` 계산 + `ProgressBarTrack/Value/Label` children map, (2) `implicitStyles.ts:914-976` Breadcrumbs 분기의 `crumbFontWeight` / `measureTextWidth` / `itemWidth` 계산, (3) `implicitStyles.ts:1850-1897` Calendar 분기의 CalendarHeader/Grid `whiteSpace` 주입 + size-based padding 테이블. 이들을 spec 모델로 이관하려면 `packages/specs/src/types/spec.types.ts:98 ComponentSpec` 에 size-indexed layout 필드 / children filter hook / value format / text measure 등 신규 필드 추가 필수
  - 성능: LOW
  - 유지보수: MED — spec 모델 복잡화
  - 마이그레이션: **HIGH** — 각 분기의 비즈니스 로직을 spec 으로 이관 → 대규모 리팩토링, 후속 ADR 체인 필요

### Risk Threshold Check

> Scope 기준: **4 spec** (Calendar/RangeCalendar/SelectTrigger/Breadcrumbs parent container). Phase A2 (ProgressBar/Meter) 는 본 ADR scope 외 — 별도 후속 ADR.

| 대안 |   기술   | 성능 | 유지보수 | 마이그레이션 | HIGH+ 개수 |
| ---- | :------: | :--: | :------: | :----------: | :--------: |
| A    |   MED    | LOW  | **HIGH** |     MED      |     1      |
| B    |   LOW    | LOW  |   LOW    |     LOW      |   **0**    |
| C    | **HIGH** | LOW  |   MED    |   **HIGH**   |     2      |

**루프 판정**: 대안 B 는 HIGH+ 0개 (4 spec scope 기준) → 루프 불필요, 대안 B 선정.

대안 A 는 "classification 체계 붕괴" 위험이 결정적. 대안 C 는 scope 확대로 후속 ADR 체인 강제. **Phase A2 가 본 ADR 에서 제외된 이유**: ProgressBar/Meter grid-template cascade 는 Schema 확장(`grid-template-areas`/`grid-template-columns`) 선행이 필요한 "기술 HIGH" 위험. 4 spec scope 유지를 위해 별도 ADR 로 분리.

## Decision

**대안 B (spec containerStyles 로 실제 구조 선언, archetype 유지)** 를 선택한다.

### 선택 근거

1. **위험 수용**: 4축 모두 LOW — ADR-083 Phase 1-11 과 동일 패턴의 반복 적용 (Menu 선례 확장)
2. **점진적 실행**: 4 spec (Calendar/RangeCalendar/SelectTrigger/Breadcrumbs) 각 독립 커밋, 문제 발생 시 개별 revert 가능
3. **archetype 의미 보존**: `CSSGenerator.ts ARCHETYPE_BASE_STYLES` 수정 없음 → 다른 컴포넌트 무영향. archetype 은 "기본 템플릿", spec containerStyles 는 "개별 override" 라는 명확한 역할 분담 유지
4. **ADR-083 연속성**: Phase 0 공통 선주입 layer 의 의도된 작동 — spec 값이 parentStyle 에 선주입되고 분기가 이를 spread 로 보존
5. **Chrome MCP 대안**: cascade 검증(CSS diff) + type-check 로 회귀 0 확증 가능, 실측은 보완

### 기각 사유

- **대안 A (archetype 재분류)**: archetype=grid 를 flex column 으로 변경하면 "grid archetype" 의 실질 소비자가 ProgressCircle/SliderTrack/SliderThumb 만 남음 → archetype 의미 약화. Calendar/ProgressBar/Meter 를 `collection` 으로 이동 시 `collection` 의 의미도 오염 (listbox-style 과 progress-style 이 공존). Classification 체계 유지 비용이 spec containerStyles 2-3 라인 추가보다 큼.
- **대안 C (완전 해체)**: ProgressBar 분기의 `autoFormattedValue` 계산, Breadcrumbs 의 Breadcrumb child width 측정, Calendar 의 CalendarHeader/Grid 자식 whiteSpace 주입 등은 "layout primitive" 범위를 넘어선 비즈니스 로직. spec.render / spec.sizes 모델 확장은 별도 설계 필요 (본 ADR scope 외).

> 구현 상세: [084-implicitstyles-branch-dissolution-breakdown.md](../../adr/design/084-implicitstyles-branch-dissolution-breakdown.md)

## Risks

| ID  | 위험                                                                                                                                                                                                                                                                                                                                                                                               | 심각도 | 대응                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Calendar 의 size-based padding/gap 은 여전히 implicitStyles 에 잔존 → "부분" SSOT                                                                                                                                                                                                                                                                                                                  |  MED   | scope 명시: layout primitive(display/flex/align/justify/width) 만 리프팅. size-based 값은 후속 ADR (spec.sizes 모델 확장)                                                                      |
| R2  | Chrome MCP 실측 환경 제약 (background chrome 가용성)                                                                                                                                                                                                                                                                                                                                               |  MED   | cascade 검증(CSS diff "double-emit cascade 동일") + builder test 217/217 로 대체. 가용 시 샘플링                                                                                               |
| R3  | **4 spec scope 의 CSS 최종값 변화** (Codex Round 2 반영): (a) SelectTrigger/Breadcrumbs `inline-flex → flex` — 사용처 수식: SelectTrigger `SelectionRenderers.tsx` 1곳 (Select block 내부), Breadcrumbs `LayoutRenderers.tsx` 5곳 + `<nav>` 감쌈 → Preview flow 영향 0 파일. (b) Calendar `grid → flex` — `Calendar.css` grid-template 미사용 → CalendarHeader/Grid 자식 block 배치 유사, 영향 LOW |  LOW   | ADR-083 Phase 8/11 archetype 기준 리프팅과 실제 구현(flex) 의 의도적 불일치를 spec 값 변경으로 대칭 복구. block-level parent 에서만 렌더 → flow 영향 0. Calendar 는 Chrome MCP 샘플링으로 실측 |
| R4  | `flexWrap` Schema 확장이 다른 spec 에 영향 (신규 필드가 기존 spec 에 undefined)                                                                                                                                                                                                                                                                                                                    |  LOW   | TypeScript optional field, 기존 spec 영향 없음. `CONTAINER_STYLES_FALLBACK_KEYS` 확장도 동일 안전                                                                                              |
| R5  | **Breadcrumb child 주입 잔존** (Codex Round 2 반영) — `implicitStyles.ts:955-971` 에서 child Breadcrumb 에 `width/minWidth`=`itemWidth`(measureTextWidth), `height/minHeight`=`breadcrumbsHeight`(spec.size), `flexShrink:0` / `flexGrow:0` 직접 주입. 본 ADR 은 parent container 만 해체 → Breadcrumbs 는 "parent SSOT + child branch-owned" 혼합 상태                                            |  MED   | 제목/Decision 을 "parent container primitive 해체" 로 축소 (Revision 1 완료). child 주입 해체는 대안 C 경로 (text measure hook + size-indexed layout spec 모델 확장) 후속 ADR                  |

**잔존 HIGH 위험 0건** (4 spec scope 기준, Codex Round 3 반영). Phase A2 (ProgressBar/Meter grid-template cascade) 는 본 ADR scope 외 — 별도 후속 ADR 에서 다룸.

## Gates

| Gate | 시점          | 통과 조건                                                                                                                                                                          | 실패 시 대안                                                                                 |
| ---- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| G0   | Phase 0 전후  | `ContainerStylesSchema.flexWrap` + `CONTAINER_STYLES_FALLBACK_KEYS` 확장 + CSSGenerator `emitContainerStyles` 에 flexWrap 처리 추가 (Phase A4 Breadcrumbs `flexWrap: "nowrap"` 용) | 기존 schema 10 필드로 Phase A4 에서 flexWrap 없이 진행 (Breadcrumbs 분기에서 `??` 패턴 유지) |
| G1   | 매 Phase 완료 | `pnpm -w type-check` 3/3 PASS + `pnpm --filter @composition/builder test` 217/217 PASS                                                                                             | 개별 Phase revert                                                                            |
| G2   | 매 Phase 완료 | `pnpm --filter @composition/specs test -u` 166/166 PASS (snapshot 의도된 update)                                                                                                   | 의도 외 snapshot 변화 시 scope 재검토                                                        |
| G3   | 매 Phase 완료 | Generated CSS diff 수동 검토 — double-emit cascade 동일 확증                                                                                                                       | archetype 값과 spec 값이 다를 때 cascade 최종값이 의도한 대로인지 검증, 의도 외 시 revert    |
| G4   | 전체 완료     | Chrome MCP 4 spec 각 1 샘플 실측 — Skia 렌더가 spec 값과 일치 (Calendar/RangeCalendar/SelectTrigger/Breadcrumbs parent). Calendar 는 R3 검증 포함                                  | 환경 제약 시 cascade 검증으로 대체 + 잔존 debt 명시                                          |

## Consequences

### Positive

- **D3 symmetric consumer 대칭 복구 (4 spec scope)**: Calendar/RangeCalendar/SelectTrigger/Breadcrumbs parent container 의 CSS ↔ Skia 값 일치. ADR-063 SSOT Charter 준수도 개선
- **ADR-083 Phase 0 실효성 확증**: 공통 선주입 layer 가 의도대로 작동 (분기가 방해하지 않을 때)
- **implicitStyles 가독성 향상**: 4 분기 parent container 에서 layout primitive 중복 제거 (약 12-16 라인 감소)
- **Spec = 실제 선언** 원칙 강화: containerStyles 가 실제 구조를 선언하는 것이 기본값, archetype 은 "대다수 기본" 역할로 명확화
- **Phase 6 Menu 선례 일반화**: containerStyles 에 layout primitive override 는 표준 패턴으로 승격

### Negative

- **4 spec scope CSS 최종값 변화** (Codex Round 2 + Round 3 반영):
  - SelectTrigger/Breadcrumbs: `inline-flex → flex` (R3: Preview flow 영향 0 파일)
  - Calendar: `grid → flex` (R3: `Calendar.css` grid-template 미사용, Preview 영향 LOW, Chrome MCP 실측 필요)
- **Breadcrumbs child 주입 잔존** (Codex Round 2 HIGH 반영, R5): `implicitStyles.ts:955-971` 의 child `width/height/flexShrink/flexGrow` 주입 해체는 scope 외. Breadcrumbs 는 본 ADR 이후 "parent SSOT + child branch-owned" 혼합 상태. 완전 SSOT 복귀는 대안 C 경로 후속 ADR (text measure hook + size-indexed layout 모델 확장)
- **Phase A2 (ProgressBar/Meter) scope 외** (Codex Round 3 반영): ProgressBar/Meter grid-template cascade 깨짐 위험으로 본 ADR 에서 완전 분리. 별도 후속 ADR (ContainerStylesSchema `grid-template-areas/columns` 지원 + emitContainerStyles 확장 + Phase A2 실행) 에서 해결. 본 ADR 실행 후에도 ProgressBar/Meter 의 implicitStyles 분기 직접 할당 override 잔존
- **부분 SSOT**: size-based padding/gap, children 처리, 비즈니스 로직은 여전히 implicitStyles 에 잔존 → 완전 SSOT 는 후속 ADR 필요
- **archetype 과 spec 값 불일치 허용**: Calendar archetype=grid vs spec.containerStyles.display=flex 가 공존. cascade 로는 최종 값이 결정되지만 "archetype 의 의미" 가 약해짐 — 향후 ContainerStylesSchema 확장 시 archetype 삭제 검토 가능
- **잔존 분기 40-4=36**: 본 ADR 은 4 분기만 해체. 잔존 36 분기 = Phase A2 (ProgressBar/Meter) 1 + 비즈니스 로직 분기 ~35. 전부 별도 후속 ADR 필요

## References

- ADR-063: SSOT Chain Charter (D3 symmetric consumer 원칙)
- ADR-080: `resolveContainerStylesFallback` export seam — 본 ADR 의 fallback 경로 진입점
- ADR-081: tokenConsumerDrift — C3 계약 유지 필수
- ADR-082: Style Panel Spec Consumer 통합 (containerStyles/composition 3-tier fallback) — 본 ADR 이 consumer 측 완전성 강화
- ADR-083: Layout Primitive 리프팅 (Phase 0 공통 선주입 + Phase 1-11 spec 리프팅) — 본 ADR 의 선행 ADR
- ADR-083 breakdown §하드코딩 분기 감사 (R0) — 본 ADR 의 scope 결정 근거
- `apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts`:
  - `:1850` Calendar / RangeCalendar 분기 진입
  - `:1566` PROGRESSBAR_TAGS (ProgressBar/Meter) 분기 진입 / `:1657` 내부 effectiveParent 설정
  - `:1256` SelectTrigger 분기 진입
  - `:914` Breadcrumbs 분기 진입 / `:976` 내부 effectiveParent 설정
- `packages/specs/src/types/spec.types.ts:59-93` ContainerStylesSchema
- `packages/specs/src/renderers/CSSGenerator.ts:50-116` ARCHETYPE_BASE_STYLES (본 ADR 은 미변경)
