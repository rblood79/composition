# ADR-105-b: @sync F1 spec-to-spec 참조 primitives 공유

## Status

Implemented — 2026-04-21

## Context

### SSOT 체인 domain 판정

**D3 (시각 스타일) 전용 작업**. F1 @sync 10건은 모두 크기(height/padding/iconSize/fontSize) 동기화 경고이므로 D3 domain. D1(DOM/접근성) / D2(Props/API) 침범 없음.

spec-to-spec import 중립 판정: `ssot-hierarchy.md` §4.2의 consumer-to-consumer 금지 패턴은 **CSS↔CSS 참조**를 대상으로 한다. Spec 파일 간 직접 import는 Spec → Spec 관계이며, 두 파일 모두 D3 domain SSOT의 생산자이므로 구조적 금지 대상이 아니다. 다만 컴포넌트 spec 간 강결합(Button.spec → TextField.spec 직접 import 등)은 독립 진화 가능성을 차단하므로 primitives 추상화가 우선 검토된다.

정본: [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) / 공식 결정: [ADR-063](063-ssot-chain-charter.md)

### 배경 — ADR-105 Charter F1 슬롯

ADR-105 (@sync 주석 감사 Charter, Implemented 2026-04-21) 가 37건 @sync 주석을 F1~F5로 분류했다. ADR-105-a (F3+F5, 6건, Implemented 2026-04-21) 에서 `BUTTON_FAMILY_HEIGHTS` primitives 인프라가 확립되었다. 본 ADR은 **F1 (spec-to-spec 참조 10건)** 를 처리한다.

### 실측 — 소비 코드 경로 10건 (#1 반복 패턴 체크)

| ID  | 파일                  | 라인          | @sync 원문                                                                          | 현재 참조 대상                         |
| --- | --------------------- | ------------- | ----------------------------------------------------------------------------------- | -------------------------------------- |
| S1  | `ComboBox.spec.ts`    | 259           | `@sync Select.spec.ts sizes — CSS height = lineHeight + paddingY×2 + borderWidth×2` | Select.spec.ts sizes                   |
| S2  | `NumberField.spec.ts` | 7 (파일 주석) | `@sync ComboBox.spec.ts — 동일한 컨테이너/버튼 패턴`                                | ComboBox.spec.ts 전체 구조             |
| S3  | `NumberField.spec.ts` | 389           | `@sync ComboBox.spec.ts sizes — 동일한 height/padding/iconSize`                     | ComboBox.spec.ts sizes                 |
| S4  | `NumberField.spec.ts` | 439           | `@sync ComboBox.spec.ts composition — 동일한 컨테이너/버튼 패턴`                    | ComboBox.spec.ts composition           |
| S5  | `NumberField.spec.ts` | 928           | `@sync ComboBox chevron: 배경 없이 아이콘만`                                        | ComboBox 아이콘 렌더링 패턴            |
| S6  | `NumberField.spec.ts` | 941           | `@sync ComboBox chevron: 배경 없이 아이콘만`                                        | ComboBox 아이콘 렌더링 패턴            |
| S7  | `SelectIcon.spec.ts`  | 44            | `@sync Select.spec.ts sizes.iconSize — Select/ComboBox 동일 아이콘 크기`            | Select.spec.ts sizes.iconSize          |
| S8  | `Tab.spec.ts`         | 63            | `TabsSpec.sizes와 동기화 (@sync Tabs.spec.ts)`                                      | Tabs.spec.ts sizes                     |
| S9  | `Tabs.spec.ts`        | 140           | `@sync Button.spec.ts padding/fontSize 패턴 + Tabs.css`                             | Button.spec.ts + Tabs.css (F1+F2 혼합) |
| S10 | `TextField.spec.ts`   | 256           | `@sync Button.spec.ts sizes — Input height = Button height`                         | Button.spec.ts sizes                   |

### 실측 비교 — 값 일치 여부 검증

P0 사전 조사 결과:

**ComboBox ↔ Select ↔ NumberField sizes** (S1, S3):

| size | height | paddingX | paddingY | iconSize |
| ---- | ------ | -------- | -------- | -------- |
| xs   | 20     | 4        | 1        | 10       |
| sm   | 22     | 8        | 2        | 14       |
| md   | 30     | 12       | 4        | 18       |
| lg   | 42     | 16       | 8        | 22       |
| xl   | 54     | 24       | 12       | 28       |

ComboBox.spec.ts, Select.spec.ts, NumberField.spec.ts — height/paddingX/paddingY/iconSize **3파일 완전 일치**.

**SelectIcon.spec.ts iconSize ↔ Select.spec.ts iconSize** (S7): xs:10, sm:14, md:18, lg:22, xl:28 — **완전 일치**. SelectIcon의 `height` 값은 iconSize와 동일 (아이콘 전용 height).

**Tab.spec.ts sizes ↔ Tabs.spec.ts sizes** (S8): sm:{height:21, paddingX:8, paddingY:2}, md:{height:29, paddingX:12, paddingY:4}, lg:{height:41, paddingX:16, paddingY:8} — **완전 일치**. xs/xl 없음.

Tab height 공식: `paddingY×2 + lineHeight + borderWidth×1` (단면 border 적용). Button과 공식이 다름.

**TextField.spec.ts ↔ BUTTON_FAMILY_HEIGHTS** (S10): TextField xs:18, Button xs:20 — **불일치**. sm:22 이상은 동일. TextField xs height가 독립 진화했음. "Input height = Button height" 주석은 xs에서 더 이상 사실이 아님.

**Tabs.spec.ts ↔ Button.spec.ts** (S9): Button.spec.ts의 height 필드가 모두 `0` (런타임에 lineHeight+paddingY×2+borderWidth×2로 계산). Tab height 공식과 Button height 공식은 별개. Tabs.css는 CSSGenerator 자동 생성 파일 (generated/Tabs.css) — F1 처리 범위 내.

**NumberField.spec.ts composition** (S4): `layout: "flex-column", gap: "var(--spacing-xs)"` 등 기본 구조는 ComboBox와 동일하나, `containerVariants.disabled` 처리 방식이 다름. 구조 서술적 주석.

**NumberField.spec.ts 아이콘 렌더링** (S5, S6): Skia 렌더링 코드 내 주석. 실제 공유 값 없음 — 렌더링 패턴 서술.

### 항목별 처리 분류

| ID  | 처리 방법                                 | 근거                                                                                          |
| --- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| S1  | Option A (primitives)                     | ComboBox/Select sizes 완전 일치 → FIELD_FAMILY_SIZES 공유 상수                                |
| S2  | Option C (설명 주석)                      | 파일 수준 구조 서술, 구체 값 없음                                                             |
| S3  | Option A (primitives)                     | NumberField sizes = ComboBox sizes 완전 일치 → 동일 primitives 재사용                         |
| S4  | Option C (설명 주석)                      | composition 구조 유사하나 세부 다름, 독립 유지 타당                                           |
| S5  | Option C (설명 주석)                      | 렌더링 패턴 서술 주석, 공유 값 없음                                                           |
| S6  | Option C (설명 주석)                      | 렌더링 패턴 서술 주석, 공유 값 없음                                                           |
| S7  | Option A (primitives)                     | SelectIcon.iconSize = Select.iconSize 완전 일치 → primitives 재사용                           |
| S8  | Option A (primitives)                     | Tab.sizes = Tabs.sizes 완전 일치 → TABS_SIZE_CONFIG primitives 신설                           |
| S9  | Option A (F1 부분) + 105-c 위임 (F2 부분) | Button.spec 참조: Tab 공식 명시 (primitives 재사용 또는 설명 주석). Tabs.css 참조: F2 → 105-c |
| S10 | Option C (설명 주석)                      | TextField xs:18 ≠ Button xs:20 → 독립 진화. @sync 주석이 사실과 불일치 → 설명 주석으로 교체   |

### Hard Constraints

1. **BC 영향 0%**: element.tag 변경 없음. Spec 파일 sizes 값 자체를 변경하지 않음
2. **Generator 미개입**: F1 primitives 이관은 Generator 확장 없음. CSS 자동 생성 경로에 영향 없음 (#2 반복 패턴 체크)
3. **type-check 3/3 + specs PASS + builder PASS** 의무 유지
4. **S9 F2 부분 위임**: `Tabs.spec.ts:140`의 `+ Tabs.css` 부분은 F2(spec-to-CSS) 카테고리 → 105-c에 위임. 본 ADR은 Button.spec.ts 참조 부분만 처리

### Soft Constraints

- ADR-105-a `BUTTON_FAMILY_HEIGHTS` (primitives/buttonSizes.ts) 패턴 재사용
- primitives 파일 신설 시 최소 파일 수 원칙: ComboBox/Select/NumberField 공유 = `fieldSizes.ts`, Tab/Tabs = `tabSizes.ts`

## Alternatives Considered

### 대안 A: 공유 primitives 추출 (신설 primitives 상수)

- 설명: `packages/specs/src/primitives/fieldSizes.ts` 신설 (ComboBox/Select/NumberField 공유 sizes), `tabSizes.ts` 신설 (Tab/Tabs 공유 sizes). 각 Spec 파일이 primitives에서 import 후 @sync 주석 삭제. TextField는 값 불일치로 Option C. NumberField/Tabs composition/@sync 설명 주석 교체.
- 위험:
  - 기술: LOW — ADR-105-a `BUTTON_FAMILY_HEIGHTS` 패턴 그대로. primitives/ 경로 확립됨. 순환 의존 없음 (primitives는 최하단 계층)
  - 성능: LOW — import 경로 변경, 런타임 값 동일
  - 유지보수: LOW — SSOT 실질 복구. sizes 변경 시 1파일만 수정. 소비처 자동 전파
  - 마이그레이션: LOW — BC 0%

### 대안 B: spec-to-spec 직접 import (primitives 신설 없음)

- 설명: ComboBox.spec.ts sizes를 export, NumberField/Select 가 직접 import. Tabs.spec.ts sizes를 export, Tab.spec.ts가 직접 import. Select.spec.ts sizes.iconSize를 SelectIcon.spec.ts가 직접 import. primitives/ 신설 없음.
- 위험:
  - 기술: LOW — TypeScript import. 순환 의존 없음 확인 필요 (ComboBox ↔ Select 양방향 import는 순환 위험)
  - 성능: LOW
  - 유지보수: **MEDIUM** — 컴포넌트 spec 간 강결합. ComboBox.spec.ts 구조 변경이 NumberField/Select에 의도치 않게 전파. primitives 추상화 계층 없음. ComboBox/Select의 경우 어느 쪽이 SSOT인지 불분명 (서로 참조 가능한 대칭 구조)
  - 마이그레이션: LOW

### 대안 C: @sync 주석 설명 주석 교체 (이관 없음)

- 설명: 모든 10건을 값 변경 없이 `@sync` 경고 주석만 설명 주석으로 교체. "이 값은 X와 동일한 의도이나 독립 선언 유지" 명시.
- 위험:
  - 기술: LOW — 코드 변경 없음
  - 성능: LOW
  - 유지보수: **MEDIUM** — 실질 SSOT 복구 없음. 값 drift 방지 메커니즘 없음. ComboBox/Select/NumberField 3파일이 동일 값을 독립 선언 — 한 곳 수정 시 나머지 누락 위험. ADR-063 §4.2 금지 패턴 구조는 개선 없음
  - 마이그레이션: LOW

### Risk Threshold Check

| 대안                           | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정     |
| ------------------------------ | :--: | :--: | :------: | :----------: | :------: | -------- |
| A: primitives 추출             |  L   |  L   |    L     |      L       |    0     | **PASS** |
| B: spec-to-spec 직접 import    |  L   |  L   |    M     |      L       |    0     | PASS     |
| C: @sync 주석 교체 (이관 없음) |  L   |  L   |    M     |      L       |    0     | PASS     |

세 대안 모두 HIGH+ 없음. 대안 A가 유지보수 위험 최소, 실질 SSOT 복구 효과 최대.

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- [x] **#1 코드 경로 인용**: 소비 코드 경로 표에 10건 grep 가능 파일:라인 명시. ComboBox.spec.ts:259, NumberField.spec.ts:7/389/439/928/941, SelectIcon.spec.ts:44, Tab.spec.ts:63, Tabs.spec.ts:140, TextField.spec.ts:256
- [x] **#2 Generator 확장 여부**: F1 primitives 이관은 Generator 확장 없음. S9 Tabs.css 부분(F2)은 105-c 위임으로 격리. 명시 완료
- [x] **#3 BC 수식화**: element.tag 변경 없음 → BC 영향 0%. Spec sizes 값 자체 불변
- [x] **#4 Phase 분리 가능성**: 10건을 S1/S3/S7 (field sizes 그룹), S8/S9 (tab sizes 그룹), S2/S4/S5/S6/S10 (설명 주석 그룹)으로 3그룹 → Phase 3개로 분리 가능. 단일 ADR로 처리 가능 수준

## Decision

**대안 A 채택** (primitives 추출 + 그룹별 처리).

선택 근거:

1. **SSOT 실질 복구**: ComboBox/Select/NumberField가 동일 sizes 값을 3파일에 분산 선언한 상태를 단일 primitives 상수로 통합. 한 곳 수정으로 3파일 전파.
2. **ADR-105-a 선례 확립**: `BUTTON_FAMILY_HEIGHTS` 패턴이 동일 세션에서 검증됨. `fieldSizes.ts`와 `tabSizes.ts` 신설은 동일 패턴 반복.
3. **컴포넌트 spec 간 약결합**: ComboBox가 Select를 직접 import(대안 B)하면 양방향 import 위험 + 어느 쪽이 source인지 불분명. primitives 추상화로 이 문제를 해소.
4. **혼합 처리 명확화**: 값 일치 항목(S1/S3/S7/S8)은 Option A, 구조 서술/값 불일치 항목(S2/S4/S5/S6/S10)은 Option C로 항목별 최적 처리.
5. **S9 F1+F2 분리**: Tabs.spec.ts:140의 Button 참조 부분(F1)은 본 ADR에서 설명 주석으로 처리. Tabs.css 참조 부분(F2)은 105-c에 위임.

기각 사유:

- **대안 B 기각**: ComboBox ↔ Select 양방향 import 가능성 → 순환 의존 위험. 어느 쪽이 SSOT인지 불분명. primitives 추상화 없이 컴포넌트 spec 간 강결합이 유지보수 부담. ADR-105-a에서 primitives 패턴이 이미 확립됐으므로 일관성 우선.
- **대안 C 기각**: drift 방지 메커니즘 없음. ComboBox/Select/NumberField 3파일 중 한 곳에서 sizes 변경 시 나머지 누락 위험이 실질적으로 잔존. 10건 중 4건은 primitives 공유로 해소 가능한데 주석 교체만으로 처리하는 것은 debt 영구화.

> 구현 상세: [105-b-sync-spec-to-spec-primitives-sharing-breakdown.md](../../adr/design/105-b-sync-spec-to-spec-primitives-sharing-breakdown.md)

## Risks

| ID  | 위험                                                                                          | 심각도 | 대응                                                                                                                                                                |
| --- | --------------------------------------------------------------------------------------------- | :----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `fieldSizes.ts` 신설 시 ComboBox/Select/NumberField.spec.ts sizes 와 값 이중 정의 발생 — 혼란 |  MED   | 신설 primitives는 각 spec 파일의 sizes를 대체하지 않음 (값 동일하게 유지). 주석으로 파생 관계 명시. 향후 Spec이 primitives를 직접 참조하는 것은 별도 리팩토링 scope |
| R2  | TextField xs:18 ≠ BUTTON_FAMILY_HEIGHTS xs:20 — "Button height = Input height" 가 사실 아님   |  MED   | TextField:256 @sync 주석을 "Button과 sm~ 일치, xs는 독립 진화" 설명 주석으로 교체. 값 수정 금지 (BC 위험)                                                           |
| R3  | Tab.sizes 공식(단면 border)과 Button.sizes 공식(양면 border)이 혼동될 위험                    |  LOW   | tabSizes.ts에 공식 주석 명시: `paddingY×2 + lineHeight + borderWidth×1`                                                                                             |
| R4  | S9 Tabs.spec.ts:140에서 F1 부분과 F2 부분 분리 처리 시 일부 @sync 주석 잔존                   |  LOW   | F1 처리 후 F2 부분은 명시적으로 105-c 위임 주석 추가                                                                                                                |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략.

검증 기준:

- `rg "@sync Select.spec.ts sizes" packages/specs/src/components/ComboBox.spec.ts` → 0건
- `rg "@sync ComboBox.spec.ts sizes" packages/specs/src/components/NumberField.spec.ts` → 0건
- `rg "@sync Select.spec.ts sizes.iconSize" packages/specs/src/components/SelectIcon.spec.ts` → 0건
- `rg "@sync Tabs.spec.ts" packages/specs/src/components/Tab.spec.ts` → 0건
- `rg "@sync Button.spec.ts sizes" packages/specs/src/components/TextField.spec.ts` → 0건
- `pnpm type-check` 3/3 PASS
- `pnpm build:specs` PASS

## Consequences

### Positive

- **ADR-105 F1 10건 @sync 해소** — 4건 primitives 공유 (SSOT 실질 복구) + 6건 설명 주석 교체 (경고 마커 제거)
- **primitives/ 확장**: `fieldSizes.ts` + `tabSizes.ts` 신설로 Field 계열 및 Tab 계열 metric의 공유 SSOT 위치 확보
- **ComboBox/Select/NumberField sizes 드리프트 방지**: 단일 primitives 상수로 3파일 값 일관성 보장
- **ADR-105 Charter 후속 진행**: F1 슬롯 해소로 105-c (F2) 착수 준비 완료

### Negative

- **primitives/ 파일 2개 추가**: `fieldSizes.ts` + `tabSizes.ts` 신설 (primitives 디렉토리 8 → 10개)
- **Spec sizes 이중 관리 과도기**: 각 spec 파일이 여전히 sizes를 직접 선언하되 primitives 참조 주석 추가. 장기적으로 spec 파일이 primitives를 직접 참조하는 리팩토링은 별도 scope
- **TextField xs 값 불일치 문서화**: xs:18 독립 진화 사실을 주석으로 명시 — 향후 디자인 시스템 정렬 시 고려 사항으로 잔존

## 참조

- [ADR-105](105-sync-annotation-audit-charter.md) — @sync 감사 Charter (본 ADR의 부모)
- [ADR-105-a](105-a-sync-utils-constants-primitives.md) — BUTTON_FAMILY_HEIGHTS primitives 패턴 선례
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 domain 원칙 (consumer-to-consumer 금지)
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — §4.2 @sync 금지 패턴 정본
