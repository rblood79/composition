# ADR-105-d: @sync F4/F5 최종 종결 — CSS/Builder 잔존 주석 정당화 및 해소

## Status

Implemented — 2026-04-22

## Implementation Summary (2026-04-22)

Phase 0~4 전부 완결. **@sync 잔존 9→0 완전 청산 → ADR-105 Charter 전체 종결 (37→0)**.

- **Phase 0 재grep**: 9건 라인번호 breakdown 일치 확증
- **Phase 1 F4 2건**:
  - `Badge.css:407` → BadgeSpec.sizes 파생 근거 + 수동 갱신 의무 주석
  - `ListBox.css:99` → Generator state selector 미지원 구조적 이유 + 이관 조건 주석
- **Phase 2 F5 factory 2건 (D2 경계 정당화)**:
  - `DateColorComponents.ts:123` → DatePicker 동일 DOM 구조 서술 보존, `@sync` 키워드만 제거
  - `FormComponents.ts:416` → ComboBox 동일 패턴 서술 보존, `@sync` 키워드만 제거
- **Phase 3 F5 builder 5건**:
  - `cssComponentPresets.ts:708` → ToggleButtonSpec.sizes SSOT 명시 + fallback 복제 정당화
  - `implicitStyles.ts:183` → SelectSpec/ComboBoxSpec.sizes SSOT 명시 + 레이어 분리 원칙
  - `utils.ts:1520` → F5-5 자연 해소 확증 (style prop 런타임 소비 중)
  - `utils.ts:1521/1529/1568` → F5-6/7/8 각각 Spec SSOT + 미러링 알고리즘 동기화 의무 주석
- **Phase 4 검증**:
  - `rg "@sync"` 실경고 마커 **0건** (formerly @sync 역사 서술만 잔존)
  - `pnpm -w type-check` → **3/3 PASS** (FULL TURBO cached)
  - specs **205/205 PASS** / builder **227/227 PASS** / shared **52/52 PASS**

BC 영향 0%, 런타임 코드 변경 0, 시각 변경 0. 편집한 파일 7개, +34 / -12 diff.

## Context

### SSOT 체인 domain 판정

**D3 (시각 스타일) 주 작업 + D2 (Props/API) 경계 포함**.

- F4 (CSS 파일 @sync): Badge.css, ListBox.css — D3 시각 값 동기화 경고. Spec SSOT 직접 소비가 아닌 수동 CSS 독립 정의
- F5 (Builder @sync): `utils.ts`, `implicitStyles.ts`, `cssComponentPresets.ts` — D3 Spec 값을 Canvas 레이아웃 계산에 하드코딩. `factory/definitions/` 내 2건은 DOM 구조 서술이므로 **D2 경계 포함** — 시각 값 동기화가 아닌 구조 주석이므로 정당화 허용

정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) / 공식 결정: [ADR-063](063-ssot-chain-charter.md)

### 직전 ADR 맥락

ADR-105 Charter(Implemented 2026-04-21)는 37건 @sync를 F1~F5로 분류하고 sub-ADR 로드맵을 수립했다. 그 후속 실행:

| sub-ADR   | 대상                                                   | 상태                   |
| --------- | ------------------------------------------------------ | ---------------------- |
| ADR-105-a | F3 utils 상수 primitives 이관 4건 + F5-utils 자연 해소 | Implemented 2026-04-21 |
| ADR-105-b | F1 spec-to-spec primitives 공유 10건                   | Proposed 2026-04-21    |
| ADR-105-c | F2 spec-to-CSS 해소 6건                                | Implemented 2026-04-21 |
| ADR-105-d | F4 CSS 2건 + F5 builder 7건 최종 종결                  | **본 ADR**             |

또한 ADR-106-b(TagGroup.css 정당화 주석 교체, Implemented 2026-04-21)에서 `@sync F4` 어노테이션 1건이 이미 처리되어 `(ADR-106-b — formerly @sync F4 annotation)` 형식으로 완결됐다. 본 ADR은 그 형식을 재사용한다.

### 9건 현황 재grep (2026-04-22 기준 — 반복 패턴 체크 #1)

```
rg "@sync" packages/shared/src/components/styles/Badge.css
rg "@sync" packages/shared/src/components/styles/ListBox.css
rg "@sync" apps/builder/src/builder/workspace/canvas/layout/engines/utils.ts
rg "@sync" apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts
rg "@sync" apps/builder/src/builder/workspace/canvas/utils/cssComponentPresets.ts
rg "@sync" apps/builder/src/builder/factories/definitions/FormComponents.ts
rg "@sync" apps/builder/src/builder/factories/definitions/DateColorComponents.ts
```

| ID   | 파일                     | 라인 | @sync 원문 (요약)                                            | 현재 상태                                                                   | 처리 방향                             |
| ---- | ------------------------ | ---- | ------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------- |
| F4-1 | `Badge.css`              | 407  | `BadgeSpec.sizes — Button과 동일한 height/padding/fontSize`  | `skipCSSGeneration: false` + BadgeSpec에 sizes 선언됨                       | **정당화 주석 교체**                  |
| F4-2 | `ListBox.css`            | 99   | `Generator [data-disabled] emit opacity:0.38`                | Generator가 현재 opacity emit 미지원 (수동 CSS 유지 필요)                   | **정당화 주석 교체**                  |
| F5-1 | `DateColorComponents.ts` | 123  | `DateRangePicker 복합 컴포넌트 (@sync DatePicker 동일 구조)` | factory DOM 구조 서술 주석 — D2 경계 (시각 값 동기화 아님)                  | **D2 경계 정당화 주석 교체**          |
| F5-2 | `FormComponents.ts`      | 416  | `CSS DOM 구조 (@sync ComboBox)`                              | factory DOM 구조 서술 주석 — D2 경계 (시각 값 동기화 아님)                  | **D2 경계 정당화 주석 교체**          |
| F5-3 | `cssComponentPresets.ts` | 708  | `@sync ToggleButton.css padding 값과 일치해야 함`            | TOGGLE_BUTTON_FALLBACKS 하드코딩 — ToggleButtonSpec.sizes 선언됨            | **정당화 주석 교체**                  |
| F5-4 | `implicitStyles.ts`      | 183  | `@sync Select.css / ComboBox.css size variants`              | SPEC_PADDING 테이블이 Spec과 중복 — Select/ComboBoxSpec.sizes 선언됨        | **정당화 주석 교체**                  |
| F5-5 | `utils.ts`               | 1520 | `@sync ListBoxSpec.sizes.md — paddingY=4, gap=2`             | paddingY/gap이 style prop에서 읽힘 (이미 런타임 Spec 소비)                  | **자연 해소 확증 + 주석 교체**        |
| F5-6 | `utils.ts`               | 1521 | `@sync containerStyles.borderWidth=1`                        | `borderWidth = 1` 하드코딩 — ListBoxSpec.containerStyles.borderWidth 선언됨 | **read-through 전환 가능하나 정당화** |
| F5-7 | `utils.ts`               | 1529 | `@sync ListBoxSpec.render.shapes entries 루프`               | 레이아웃 계산 공식이 shapes 루프 구조 미러링 — 알고리즘 동기화 경고         | **정당화 주석 교체**                  |
| F5-8 | `utils.ts`               | 1568 | `@sync TagList.spec.ts shapes() wrap 시뮬레이션`             | 레이아웃 계산이 spec shapes wrap 로직 복제 — 알고리즘 동기화 경고           | **정당화 주석 교체**                  |

**반복 패턴 체크 #2 (Generator 지원 여부)**: F4-2 ListBox.css disabled opacity는 Generator가 현재 `[data-state]` selector emit 미지원으로 확인됨 — 수동 CSS 유지가 정당화됨.

**반복 패턴 체크 #3 (BC 영향)**: 주석 교체 전용 작업 → 코드 변경 0 → 0% 사용자 영향.

**반복 패턴 체크 #4 (Phase 분리)**: 9건 모두 주석 교체 또는 정당화로 처리 가능 → 추가 Phase 분리 불필요. HIGH+ 위험 없음.

### Hard Constraints

1. **시각 변경 0**: 주석 교체 작업은 런타임 코드 수정 없음. F5-5/F5-6 `utils.ts` 값도 변경하지 않음
2. **@sync 잔존 0건 목표**: 본 ADR 완결 후 F4/F5 카테고리 @sync 전부 소거
3. **D2 경계 보존**: factory 구조 주석은 DOM 구조 서술로서 D2 허용 범위 — 제거만 하고 내용 변경 없음
4. **testing 기준선**: type-check 3/3 + specs 205/205 + builder PASS 의무

## Alternatives Considered

### 대안 A: 전건 주석 제거 (설명 없이 삭제)

- 설명: @sync 주석을 단순히 삭제. 새 주석 작성 없음.
- 위험:
  - 기술: **MEDIUM** — 주석 없이 하드코딩 값이 남아 있으면 미래 개발자가 왜 이 값인지 추적 불가. 동기화 경고가 사라지면 의도치 않은 drift가 발생할 때 감지 수단이 없어짐
  - 성능: LOW — 주석 삭제는 런타임 영향 없음
  - 유지보수: **MEDIUM** — 값의 출처가 Spec에 있다는 정보가 소실됨. ADR-063 준수 여부 추적 불가
  - 마이그레이션: LOW — 코드 변경 없음

### 대안 B: read-through 전환 (Spec 값을 런타임에 직접 읽기)

- 설명: F5-6 utils.ts borderWidth=1 등을 `ListBoxSpec.containerStyles.borderWidth` import로 전환. 하드코딩 제거.
- 위험:
  - 기술: **MEDIUM** — `utils.ts`가 Spec 패키지를 import하면 의존성 방향이 바뀜. builder 레이아웃 엔진이 specs 패키지에 직접 의존 → 번들 size 영향 가능성. Spec 빌드 타이밍 의존성 추가
  - 성능: **MEDIUM** — specs 패키지 전체 import가 번들에 포함될 경우 초기 번들 < 500KB 기준 영향 가능. tree-shaking 동작 확인 필요
  - 유지보수: LOW — 이관 성공 시 long-term debt 완전 해소
  - 마이그레이션: **MEDIUM** — Spec import 경로 변경이 다른 파일로 전파될 수 있음. utils.ts 변경 시 consumer 회귀 테스트 필요

### 대안 C: 정당화 주석 교체 — Hybrid 처리 (선정)

- 설명:
  - **F4 CSS 2건**: `@sync` → `(ADR-105-d — formerly @sync F4 annotation)` 형식으로 교체. 값 유지 이유를 인라인 문서화
  - **F5 factory 2건 (D2 경계)**: `@sync` 키워드 제거 + 구조 서술 주석 유지 — D2 허용 패턴
  - **F5 utils/implicitStyles/presets 5건**: `@sync` → 정당화 주석으로 교체. 값/알고리즘은 변경 없음
  - **F5-5 utils.ts:1520 (자연 해소)**: 주석이 이미 런타임에서 style prop을 읽는 코드를 가리키므로 @sync 경고 자체가 의미 없음 → 설명 주석으로 교체
- 위험:
  - 기술: LOW — 런타임 코드 변경 없음. 주석만 변경
  - 성능: LOW — 주석 변경은 번들/FPS 영향 없음
  - 유지보수: LOW — 정당화 주석이 미래 개발자에게 값의 출처와 동기화 의무를 명시적으로 전달
  - 마이그레이션: LOW — BC 영향 0%

### Risk Threshold Check

| 대안                 | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정          |
| -------------------- | :--: | :--: | :------: | :----------: | :------: | ------------- |
| A: 단순 삭제         |  M   |  L   |    M     |      L       |    0     | 수용 가능     |
| B: read-through 전환 |  M   |  M   |    L     |      M       |    0     | 수용 가능     |
| C: 정당화 주석 교체  |  L   |  L   |    L     |      L       |    0     | **PASS 선정** |

모든 대안이 HIGH+ 0으로 임계치 내. 대안 C가 4축 전체 LOW로 최저 위험.

## Decision

**대안 C (정당화 주석 교체 — Hybrid 처리)** 를 선정한다.

**선정 근거**: 런타임 코드 변경 0으로 시각 변경·BC 영향이 없으면서 @sync 주석 9건을 전부 제거한다. 정당화 주석은 "이 값이 Spec과 중복이지만 read-through 전환 비용 대비 현재 유지가 정당하다"는 아키텍처 결정을 코드 레벨에서 문서화한다. ADR-106-b에서 확립한 `(ADR-105-d — formerly @sync annotation)` 형식을 일관 적용한다.

**기각 근거**:

- 대안 A (단순 삭제): 정당화 없는 삭제는 미래 개발자에게 값의 출처·의도를 전달하지 못함. D3 대칭 검증의 근거가 코드에서 소실됨
- 대안 B (read-through 전환): F5-6 borderWidth=1 처럼 단일 상수 1건을 위해 specs 패키지 import 추가는 번들·의존성 비용 대비 효익이 낮음. 더 넓은 Spec read-through 전환은 별도 ADR(Layout Canvas Spec Consumer 통합) 범위가 적합

> 구현 상세: [105-d-sync-f4-f5-final-closure-breakdown.md](../../adr/design/105-d-sync-f4-f5-final-closure-breakdown.md)

## Risks

잔존 HIGH 위험 없음.

| ID  | 위험                                                          | 심각도 | 대응                                                                             |
| --- | ------------------------------------------------------------- | :----: | -------------------------------------------------------------------------------- |
| R1  | 정당화 주석이 실제 Spec 값과 어긋나 있을 경우 drift 감지 못함 |  LOW   | Phase 0에서 각 항목 Spec 값 재grep 확인. 불일치 발견 시 주석에 현행 Spec 값 명시 |
| R2  | factory D2 주석 수정 시 DOM 구조 서술 내용 유실 우려          |  LOW   | `@sync` 키워드만 제거, 구조 서술 텍스트 전체 보존                                |
| R3  | `utils.ts` 주석 교체 후 shapes/wrap 알고리즘 변경 시 drift    |  LOW   | 정당화 주석에 "Spec shapes() 변경 시 여기도 동기화 필요" 명시로 경고 기능 유지   |

## Gates

잔존 HIGH 위험 없음 → Gate 테이블 생략.

## Consequences

### Positive

- ADR-105 Charter F4/F5 카테고리 @sync 9건 전부 소거 → F 카테고리 완전 종결
- ADR-063 §4.2 금지 패턴(`@sync` consumer-to-consumer) 0건 달성
- 정당화 주석이 코드베이스에 아키텍처 결정 근거를 인라인 문서화 → 미래 개발자 온보딩 비용 감소
- ADR-105 Charter Gate 1 달성: "후속 sub-ADR 착수 시 해당 카테고리 @sync → 0건"

### Negative

- F5-5/F5-6/F5-7/F5-8 utils.ts의 Spec 값 하드코딩은 주석 교체 이후에도 유지됨 → 장기적으로 Layout Canvas Spec Consumer ADR에서 read-through 전환 필요
- factory D2 주석 교체는 `@sync`를 제거하지만 "두 컴포넌트 구조가 동일"이라는 사실 자체는 코드 중복으로 잔존

## 참조

- [ADR-105 Charter](105-sync-annotation-audit-charter.md) — F 카테고리 분류 원본
- [ADR-105-a](105-a-sync-utils-constants-primitives.md) — F3+F5 primitives 이관 (Implemented)
- [ADR-105-b](105-b-sync-spec-to-spec-primitives-sharing.md) — F1 spec-to-spec (Proposed)
- [ADR-105-c](105-c-sync-spec-to-css-resolution.md) — F2 spec-to-CSS (Implemented)
- [ADR-106](106-skipcssgeneration-audit-charter.md) — G 카테고리 charter (skipCSSGeneration debt)
- [ADR-106-b](106-b-taggroup-css-skipcss-justification.md) — TagGroup.css 정당화 주석 형식 선례
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D3 SSOT 정본
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 Charter (Accepted)
