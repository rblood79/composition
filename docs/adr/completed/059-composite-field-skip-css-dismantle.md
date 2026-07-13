# ADR-059: Composite Field CSS SSOT 확립 — 대칭 파이프라인 복귀

## Status

Implemented — 2026-04-15 (Phase 5 B5 ToggleButton indicator SSOT 완결)
Implemented — 2026-04-14 (Phase 4 B1~B4 + Phase 5 closure 완료)
Proposed (v2.1 amendment) — 2026-04-14 (Phase 4 D2+D3 통합 재설계)
Proposed (v2) — 2026-04-13 (선행 조사 결과 반영 재작성, v1: 2026-04-11)

## 원칙 — Spec SSOT / Symmetric Consumers

**Spec이 SSOT**이다. typography 토큰을 포함한 spec 정의가 유일한 source이며, **Preview/Publish (DOM/CSS)와 Builder (Skia)는 대등한 consumer**다. 어느 consumer도 다른 consumer의 기준이 아니다.

CSS와 Skia는 symmetric pipeline:

```
typography 토큰 ─┬─→ CSS 변수 ─→ browser CSS engine ─→ Preview/Publish
                │
                └─→ spec shapes() ─→ Skia ─────────────→ Builder Canvas
```

**ADR-059의 본질**: Composite Field에서 CSS consumer가 spec 외부에 독자 진실(수동 CSS 파일 + `@sync` 주석 + 비선언 네이밍 + 복제 delegation)을 보유한 상태를 해체하여, 두 pipeline이 spec을 대등하게 소비하는 상태로 복귀시킨다. **"수동 CSS를 자동 CSS로 교체"가 아니라 "CSS consumer의 비-spec 진실 제거"**이다.

ADR-057/058/060/061의 공통 패턴을 계승: 비-spec 진실을 유지한 채 자동화를 끼워넣는 방식을 기각하고, **비-spec 진실 자체를 삭제**한다.

## Context

### v1 전제의 실측 반증 (2026-04-13)

v1(2026-04-11) breakdown은 "Field 7개가 TextField와 구조적으로 유사해 패턴 복제로 해체 가능"을 가정했다. 선행 조사 결과 이 가정이 4축에서 파손:

| #   | SSOT 위반 축          | 실측 내용                                                                                                                                |
| --- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Delegation 미선언** | SearchField/ColorField/DateField/TimeField 4개 Field가 `composition.delegation` **자체 없음** — spec이 CSS consumer 구조를 선언하지 않음 |
| 2   | **비-spec 네이밍**    | CSS 변수 prefix (`--tf-*`, `--nf-*`) spec 외부에서 결정. **TimeField ↔ TextField 가 동일 `--tf-*` prefix 충돌**                          |
| 3   | **복제 SSOT**         | NumberField의 `@sync` 주석 8개가 ComboBox 참조 — NumberField의 실제 SSOT는 ComboBox. Phase 1 단순 해체 불가                              |
| 4   | **암묵 공유 SSOT**    | `BUTTON_SIZE_CONFIG` 7개 spec이 `@sync` 주석으로 참조 연명                                                                               |
| 5   | **일관성 위반**       | TextArea만 `skipCSSGeneration: false` + delegation 없음 — spec/CSS 양쪽에 불완전 구조                                                    |

### 기존 예외 상태

| 경로                       | 현상태                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------- |
| **Spec sizes**             | `spec.sizes.md = { height: 30, paddingX: 12, ... }` — Skia consumer만 소비              |
| **수동 CSS**               | `packages/shared/src/components/styles/TextField.css` — CSS consumer 독자 진실          |
| **composition.delegation** | `variables.md["--tf-input-padding"] = "8px 16px"` — 수동 CSS 매핑용 (spec.sizes와 독립) |
| **CSSGenerator**           | `if (spec.skipCSSGeneration) return null;` — CSS consumer 전체 우회                     |
| **@sync 주석**             | 13개 파일 23개소 — 비대칭 drift를 주석으로 연명                                         |

결과: `sizes.md.paddingX = 12`가 `--tf-input-padding: 8px 16px`와 수치 일치할 구조적 보장 없음. 두 consumer의 기준값이 독립 source에서 편집됨.

### 선행 ADR 완료 패턴 (계승 대상)

- **ADR-057/058** (Text): buildTextNodeData 폐지 — CSS/Skia가 spec 직접 소비
- **ADR-060** (indicator): 6개 매직 테이블 → `spec.sizes.*.indicator` SSOT
- **ADR-061** (focus ring): 50개 리터럴 → `{focus.ring.*}` TokenRef. `StateEffect.outline` 완전 제거. 상태별 스타일도 spec 소비

세 ADR의 공통 원리: **비-spec 진실 "제거"**, "동기화" 아님.

### Hard Constraints

1. Preview DOM 구조 불변 (React Aria hooks 생성 트리)
2. CSS consumer와 Skia consumer가 **spec만** 소비 — 수동 CSS 파일 0, `@sync` 주석 0이 최종 상태
3. 두 consumer 시각 결과 교차 일치 (`/cross-check`)
4. 60fps / <500KB 번들 유지
5. ADR-042 Spec Dimension Injection 무회귀
6. Phase 경계 rollback 가능

### Soft Constraints

- 네이밍 규약이 spec 내부 선언에서 파생 (prefix도 spec이 결정)
- 상태별 스타일(`:hover/:focus/[data-invalid]`)은 ADR-061 패턴(`spec.states`)을 Composite로 확장

## 의존성

- **ADR-036 Phase 4** 선행 완료 (composition.delegation 메타데이터)
- **ADR-057/058** 선행 완료 (해체 패턴 참조)
- **ADR-060/061** 선행 완료 (spec.states/indicator SSOT 확장 근거)
- **ADR-056** 병행 권장 (Base Typography SSOT)

## Alternatives Considered

### 대안 A: 현상 유지

- 설명: 59개 `skipCSSGeneration: true` 유지
- 위험: 기술 L / 성능 L / 유지보수 **CRIT** / 마이그레이션 L
  - SearchField/ColorField/DateField/TimeField는 delegation 없이 수동 CSS만 살아있음 — SSOT 위반 심화
  - TimeField `--tf-*` prefix 충돌 영구화
  - ADR-036 재승격 체인 미완결

### 대안 B: 2층 구조 (generated + 수동 override)

- 설명: CSSGenerator가 자동 생성 CSS 파일을 만들고, 기존 수동 CSS는 "React Aria 상태별 override 전용"으로 축소 유지
- 위험: 기술 M / 성능 L / 유지보수 **H** / 마이그레이션 L
  - CSS consumer를 "2차 권위"로 승격 — 대칭 파이프라인 원리 위반
  - 수동 override 파일 잔존 시 `@sync` 구조도 부분 잔존
  - v1 ADR-059 암묵 방향 — **본 v2에서 기각**

### 대안 C: CSS consumer 비-spec 진실 완전 제거, 점진 전환 (본 제안)

- 설명:
  1. **Naming SSOT** — `composition.delegation.prefix` 명시 선언 필드 도입. 기존 prefix(`--tf-*` 등) spec 내부에서 확정. TimeField → 충돌 없는 prefix로 리네임
  2. **Delegation 완전성** — 4개 Field에 delegation 신설. CSS consumer 구조 100% spec이 선언
  3. **공유 SSOT 승격** — `BUTTON_SIZE_CONFIG` → spec 참조 표준화. NumberField=ComboBox 복제 관계 명시화 (Phase 2 선행 처리)
  4. **States 확장** — `spec.states.*`를 Composite에 확장 (ADR-061 패턴). React Aria `:hover/:focus/[data-invalid]` 상태 스타일이 spec 소비
  5. **Auto-derivation** — CSSGenerator가 위 선언에서 100% 생성
  6. **수동 CSS 파일 삭제** — override 층 없이 완전 제거
- 위험: 기술 M / 성능 L / 유지보수 L / 마이그레이션 M
  - CSSGenerator 스키마 확장 (prefix, states, shared refs) — ADR-061이 focusRing 단일 축에서 실증한 패턴의 다축 확장
  - Phase 경계 = "대상 컴포넌트 수동 CSS 파일 삭제 단위" 로 rollback 시점 명확

### 대안 D: 단일 시험대 (TextField 1개만 해체)

- 설명: TextField만 해체해 패턴 실증. 나머지 6개 방치
- 위험: 기술 L / 성능 L / 유지보수 **H** / 마이그레이션 L
  - ADR-036 "Fully Implemented" 재승격 불가
  - TimeField prefix 충돌 방치
  - v2 본문에서는 "Phase 1 시험대"로 흡수 (독립 대안 자격 없음)

### 대안 E: 일괄 전환 (59개 동시)

- 설명: 단일 Phase에서 59개 동시 해체
- 위험: 기술 **H** / 성능 M / 유지보수 L / 마이그레이션 **H**

### 대안 F: 검증 도구만 추가 (v1의 대안 D)

- 설명: CSSGenerator 유지, build-time lint가 수동 CSS ↔ spec.sizes 수치 불일치 감지
- 위험: 기술 M / 성능 L / 유지보수 **H** / 마이그레이션 L
  - 두 source 유지한 채 일치 검증 — 대칭 파이프라인 원리 위반 (CSS가 준-SSOT)

### Risk Threshold Check

| 대안                 | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ |
| -------------------- | :---: | :--: | :------: | :----------: | :---: |
| A 현상 유지          |   L   |  L   | **CRIT** |      L       |   1   |
| B 2층 구조           |   M   |  L   |  **H**   |      L       |   1   |
| **C 완전 제거 점진** | **M** |  L   |    L     |    **M**     |   0   |
| D 단일 시험대        |   L   |  L   |  **H**   |      L       |   1   |
| E 일괄               | **H** |  M   |    L     |    **H**     |   2   |
| F 검증만             |   M   |  L   |  **H**   |      L       |   1   |

루프 판정: 대안 C만 HIGH+ 없고 SSOT 목적 달성. B/F는 "두 source 유지" = 대칭 원리 위반. A/D는 위반 영속/확산. E는 회귀 추적 불가.

## Decision

**대안 C: CSS consumer 비-spec 진실 완전 제거, 점진 전환**을 선택한다.

### 기각 사유

- **A**: CRIT 유지보수 위험. 4개 Field delegation 부재 + TimeField 충돌 방치
- **B**: CSS consumer를 준-SSOT로 승격 — 원칙 위반. v1 breakdown이 이 방향으로 기울었음 → v2에서 명시 기각
- **D**: 목적(ADR-036 재승격) 미달성
- **E**: 회귀 추적 불가
- **F**: 두 source 병존은 동기화 자동화일 뿐 SSOT 단일화 아님

### 위험 수용 근거

- 기술 M: CSSGenerator 3축 확장(prefix / states / shared refs)은 ADR-061 focusRing 단일 축 실증 패턴의 연장. DTS 빌드 위험은 `as const` narrowing 규약으로 관리 (ADR-061 학습)
- 마이그레이션 M: Phase 경계를 **"대상 컴포넌트 수동 CSS 파일 삭제 단위"** 로 확정 — rollback 시점은 파일 단위로 이진 명확

### Pre-Phase 4 sub-phase 분해

v1 breakdown의 단일 Pre-Phase 0(auto-derivation 메커니즘)을 **의존성 순서로 4단계 분해**:

- **Pre-Phase 0-A (Naming SSOT)** — `composition.delegation.prefix` 선언 필드 추가, 기존 prefix spec 내부 확정, TimeField prefix 충돌 제거
- **Pre-Phase 0-B (Delegation 완전성)** — SearchField/ColorField/DateField/TimeField 4개 delegation 신설, TextArea 일관성 회복
- **Pre-Phase 0-C (공유 SSOT + 복제 해체)** — `BUTTON_SIZE_CONFIG` 참조 표준화, NumberField↔ComboBox 복제를 Phase 2 선행 전제로 명시
- **Pre-Phase 0-D (States + Auto-derivation)** — CSSGenerator 확장 (sizes + states + prefix → 100% 생성). 기존 53개 simple 컴포넌트 무회귀 검증

### Phase 배열

- **Phase 1** — TextField 시험대 (1개 완전 해체, 수동 CSS 파일 삭제, `@sync` 제거, `/cross-check` 대칭성 검증)
- **Phase 1.5** — SearchField/ColorField/DateField/TimeField/TextArea 5개 해체 (NumberField 제외)
- **Phase 2** — Select/ComboBox/NumberField 해체. ADR-047 Popover 무회귀
- **Phase 3** — DatePicker/DateRangePicker 해체. ADR-050 overflow clipping 무회귀
- **Phase 4** — 잔존 Composite ~48개 Archetype 그룹 전환
- **Phase 5** — `@sync` 잔존 grep 0, `utils/fieldDelegation.ts` 폐지, ADR-036 재승격

> 구현 상세: [059-composite-field-skip-css-dismantle-breakdown.md](../design/completed/059-composite-field-skip-css-dismantle-breakdown.md) — v2 재작성 필요

## Gates

**검증 원칙 변경**: v1의 "기존 수동 CSS ↔ generated CSS byte diff 0" Gate는 **폐기**. 기존 수동 CSS는 오염된 consumer 상태이며 reference 자격 없음. v2는 **spec을 source로 하는 두 consumer의 대칭 검증**으로 대체.

| Gate                | 시점          | 통과 조건                                                                                                                                                                                                                                          | 실패 시 대안         |
| ------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Prefix 충돌 제거    | Pre-Phase 0-A | `composition.delegation.prefix` 미선언 Field 0, 동일 prefix 재사용 0, TimeField `--tf-*` 참조 0                                                                                                                                                    | prefix 스키마 재설계 |
| Delegation 완전성   | Pre-Phase 0-B | Field 7개 모두 delegation 선언, 필수 selector(Label/Input/Button/FieldError) 누락 0                                                                                                                                                                | delegation 재설계    |
| 공유 SSOT 표준화    | Pre-Phase 0-C | `BUTTON_SIZE_CONFIG` `@sync` 주석 0, NumberField Phase 2 의존성 명시                                                                                                                                                                               | 공유 토큰 재설계     |
| CSSGenerator 무회귀 | Pre-Phase 0-D | 기존 53개 simple 컴포넌트 CSS 생성 byte diff 0 (확장 자체의 회귀 없음)                                                                                                                                                                             | 확장 롤백            |
| Phase N 대칭성      | 각 Phase 완료 | 대상 컴포넌트: 수동 CSS 파일 **삭제**, `@sync` 0, **`/cross-check` Preview ↔ Builder 시각 일치**                                                                                                                                                   | Phase 롤백           |
| 60fps / 번들        | 각 Phase      | 60fps, 번들 <500KB                                                                                                                                                                                                                                 | Phase 롤백           |
| Popover 무회귀      | Phase 2       | ADR-047 드롭다운 시각 일치                                                                                                                                                                                                                         | Phase 2 롤백         |
| Calendar 무회귀     | Phase 3       | ADR-050 overflow clipping 무회귀                                                                                                                                                                                                                   | Phase 3 롤백         |
| 최종 SSOT 순도      | Phase 5       | `skipCSSGeneration:true` 건수 = Tier 3 예외 전수(breakdown `B4 실행 결과` 표 9개 + Label §4 + Color family 등), 각 예외는 breakdown에 구조적 사유 명시. `@sync` 0은 Composite Field 한정(Tag의 TagGroup.css consumer coupling 등 Tier 3 예외 제외) | 잔존 개별 해체       |

## Consequences

### Positive

- **대칭 파이프라인 복귀** — 59개 Composite가 spec-only consumer 상태
- **수동 CSS 파일 제거** — React Aria 상태 override 포함 완전 제거. CSS consumer의 비-spec 진실 0
- **`@sync` 주석 23개 소멸** — 수동 동기화의 구조적 원인 제거
- **네이밍 규약 spec 흡수** — prefix 충돌 구조적 불가능
- **공유 SSOT 명시화** — 암묵 참조(`BUTTON_SIZE_CONFIG` 7회) 정리
- **ADR-036 "Fully Implemented" 재승격** — Phase 5 완료 시 체인 완결

### Negative

- **CSSGenerator 스키마 확장 범위 증가** — prefix/states/shared refs 3축 (v1 대비 확장)
- **Pre-Phase 4 sub-phase** — 조사/설계 기간 증가
- **검증 방식 전환 학습 비용** — byte diff → cross-check, 수동 Storybook 병행
- **Playwright visual regression 부재** — 자동화 부족, 별도 ADR 후보

### 후속 작업

- `utils/fieldDelegation.ts` 완전 폐지 — Phase 5
- ADR-036 상태 재평가 — Phase 5 완료 시 "Fully Implemented" 재승격
- Playwright visual regression 도입 검토 (별도 ADR 후보)

---

## Phase 4 재설계 (v2.1 amendment — 2026-04-14)

> **변경 요약**: 원 ADR-059 v2의 Phase 4("잔존 Composite ~48개 Archetype 그룹 전환")는 **D3 대칭 복원**만 스코프였음. 2026-04-14 실측 결과 잔존 38 컴포넌트 중 다수가 D2 부채(RSP 미규정 custom variant)를 수반하여 D3-only 해체로는 SSOT 체인 완결 불가. Phase 4를 **D2+D3 통합 재설계**로 확장한다.

### Context (amendment)

#### 원 ADR-059 v2의 Phase 4 전제 파손

v2 Phase 4는 "skipCSSGeneration:true → false 전환 + 수동 CSS 삭제" (D3 축) 만으로 정의됐다. ADR-062(Field variant 제거) 완료 후 잔존 컴포넌트 38개를 실측한 결과:

| 발견                                     | 규모                                           | 원 전제에서 누락  |
| ---------------------------------------- | ---------------------------------------------- | ----------------- |
| Spec.variants에 RSP 미규정 keys 보유     | 약 22개 (확인 필요)                            | D2 축 판정 없음   |
| Wrapper가 variant prop 노출              | 다수 (확인 필요)                               | D2 축 판정 없음   |
| Wrapper/Spec variant desync              | 최소 3개 (Modal/SearchField/ToggleButtonGroup) | v2에서 감지 안 됨 |
| Custom-extension 컴포넌트 (RAC/RSP 부재) | 최소 1개 (Panel)                               | D2 경계 모호      |

_(정확한 수치는 § 분류 매트릭스 audit 결과로 확정)_

D3 해체만 수행 시 Spec의 RSP 미규정 variants 필드가 잔존 → CSSGenerator가 그 variant를 CSS로 emit → 사용자 API의 D2 위반이 Spec SSOT에 구조적으로 박힘. Phase 5 재승격 시점에 D2 부채 추가 정리 불가피 → 2-pass 회귀 비용.

#### SSOT 정본과의 정렬 의무

`.claude/rules/ssot-hierarchy.md` §1 D2 + §6 금지 패턴: "Spec에 RSP 미규정 prop 도입 (D2 위반) — ADR-062". ADR-062는 Field family 한정. 본 amendment는 잔존 38 컴포넌트에 동일 원칙을 **D3 해체와 동시** 적용한다.

핵심 구분 (§1 D2 문구 정밀 해석):

- **Spec.variants 필드 = D3 내부 시각 스위치** — wrapper가 사용자 API로 노출하지 않는 한 D2 위반 아님
- **Wrapper의 variant prop = D2 사용자 API** — RSP 미규정이면 §6 위반

#### Hard constraints (amendment)

1. 원 v2의 hard constraints 6개 전부 승계 (DOM 불변 / spec-only consumer / cross-check / 60fps / ADR-042 / Phase rollback)
2. **추가**: Wrapper의 variant prop 중 RSP 미규정은 전부 제거 또는 ADR에 "composition 고유 확장" 정당화 명시
3. **추가**: Spec.variants 필드 잔존 시 사용자 API 미노출 (wrapper level에서 소비하지 않음) 필수

### Alternatives Considered (amendment)

#### 대안 α: D3만 먼저 해체, D2 별도 후속 ADR

- 설명: 원 v2 Phase 4 그대로 진행 (skipCSS 해체만), D2 부채는 Phase 5 후 ADR-062b 신설로 처리
- 위험: 기술 L / 성능 L / 유지보수 **H** / 마이그레이션 **H**
  - 동일 컴포넌트 2회 수정 → 회귀 검증 2배
  - Spec 중간 상태(skipCSS:false + RSP 미규정 variants 잔존)가 main 머지 → 재승격 시 ADR-036 "Fully Implemented" 조건 미달
  - ADR-062 완료 + ADR-059 D3 + ADR-062b D2 = 3개 ADR로 파편화

#### 대안 β: D2+D3 통합 재설계 (본 amendment)

- 설명: 38 컴포넌트 각각에 대해 Spec.variants + Wrapper prop + 수동 CSS + skipCSS 4축을 단일 결정 단위로 묶어 batch 해체
- 위험: 기술 M / 성능 L / 유지보수 L / 마이그레이션 M
  - ADR 하나(059)에 판정 일관성 유지
  - 각 컴포넌트 1회 수정 → 회귀 검증 1회
  - Wrapper API breaking change는 ADR-062 선례대로 Phase 경계 단위로 롤백 가능

#### 대안 γ: Phase 5 부분 재승격 + 22 컴포넌트 deferred

- 설명: 현 Phase 4.5a 상태를 "Partial Fully Implemented"로 ADR-036 재승격, 22개 variant 컴포넌트는 영구 예외
- 위험: 기술 L / 성능 L / 유지보수 **CRIT** / 마이그레이션 L
  - ADR-036 완결성 훼손
  - 영구 예외는 사실상 D2 부채 영속화
  - SSOT 정본 §6 위반 용인 선례 — 체인 전체 권위 약화

#### Risk Threshold Check

| 대안          | 기술 | 성능 | 유지보수 | 마이그레이션 | HIGH+ |
| ------------- | :--: | :--: | :------: | :----------: | :---: |
| α D3 선행     |  L   |  L   |  **H**   |    **H**     |   2   |
| **β 통합**    |  M   |  L   |    L     |      M       |   0   |
| γ 부분 재승격 |  L   |  L   | **CRIT** |      L       |   1   |

β만 HIGH+ 없고 SSOT 체인 완결 달성. α는 회귀 검증 2배 + 3 ADR 파편화. γ는 정본 위반 영속화.

### Decision (amendment)

**대안 β: D2+D3 통합 재설계**를 선택한다. 원 Phase 4의 Archetype 그룹 배열은 존속하되, 각 그룹 내부에 **4-cell D2 판정 매트릭스**와 **per-component target 표**를 추가 의무화한다.

#### 기각 사유 (amendment)

- **α**: 유지보수/마이그레이션 양축 HIGH — ADR 파편화가 장기 비용
- **γ**: 유지보수 CRIT — ssot-hierarchy.md §6 위반 용인 선례 생성, 체인 권위 붕괴

#### 4-Cell D2 판정 매트릭스

각 컴포넌트의 현 상태를 (Spec.variants 존재 여부 × Wrapper variant prop 노출 여부)로 4-cell 분류:

|                         | Spec.variants 존재                                                                                   | Spec.variants 없음                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Wrapper prop 노출**   | **(i) 판정 필요** — wrapper prop RSP 대조 후 (i-a)제거/(i-b)RSP rename/(i-c)composition 정당화 3분기 | **(ii) Desync** — wrapper prop 제거 (ADR-062 선례) |
| **Wrapper prop 미노출** | **(iii) D2 준수** — Spec.variants는 내부 시각 스위치로 유지, D3 해체만 수행                          | **(iv) 정상** — D3 해체만 수행                     |

(i) 세부 분기 판정 순서:

1. Wrapper prop 값이 RSP 공식과 **완전 일치** → 정상, D3 해체만
2. Wrapper prop이 RSP에 있으나 **이름/값 다름** → (i-b) RSP 준수 rename + Spec.variants도 정합
3. Wrapper prop이 RSP에 **없음** + RAC+custom으로 달성 가능 → (i-a) 제거 (ADR-062 isQuiet 선례)
4. Wrapper prop이 RSP에 **없음** + composition 고유 필수 (예: Panel slot 구조) → (i-c) ADR에 "composition 연장" 명시 정당화

#### Per-component 분류 요약 (audit 축 1+2 완료 — 2026-04-14)

38 컴포넌트의 전체 per-component target 표(38 row, 축 3 RSP 대조 pending)는 [breakdown 문서 Per-Component Target 표](../design/completed/059-composite-field-skip-css-dismantle-breakdown.md#per-component-target-표-audit-완료--2026-04-14) 참조. Cell 집계:

| Cell 그룹                                   | 개수 | 예시                                                                                                     |
| ------------------------------------------- | :--: | -------------------------------------------------------------------------------------------------------- |
| (i) / (i-a) wrapper prop 제거 + Spec 재판정 |  10  | Card, Dialog, Disclosure, DropZone, Label, Menu, Slider, ColorWheel, ColorSlider, (ColorPicker 후보 i-c) |
| (i-dead) dead + wrapper prop 제거           |  2   | Slot, TabList                                                                                            |
| (ii) verify desync                          |  1   | TabPanels                                                                                                |
| (iii) 내부 스위치 유지, D3 해체만           |  9   | Tree, TagGroup, Tag, Table, ListBox, Group, GridList, ColorSwatchPicker, ColorArea                       |
| (iii-inherit) compound child                |  7   | SliderTrack/Output/Thumb, DateInput/Segment, CalendarGrid/Header                                         |
| (iii-dead / iv-dead) dead 삭제 후보         |  4   | ToggleButtonGroup, Tab, Tabs, Breadcrumb                                                                 |
| (iv) wrapper/spec 둘 다 없음 또는 정상      |  4   | Accordion, DisclosureHeader, TailSwatch, Modal(verify)                                                   |
| defer/virtual                               |  2   | Field(virtual), SearchField(Phase 1.5 완료)                                                              |

Batch 실행 순서는 breakdown의 "Batch 계획" 섹션에서 B1 → B2 → B3 → B4 → B-defer → B-final 로 정의. B1(dead/desync 저위험)과 B2(ADR-062 선례 확장)에 리스크 집중, B3/B4 는 안정된 패턴 반복.

구현 상세 및 batch 계획: [059-composite-field-skip-css-dismantle-breakdown.md](../design/completed/059-composite-field-skip-css-dismantle-breakdown.md) Phase 4 재설계 섹션.

### Gates (amendment — 원 Gates 위에 추가)

| Gate                           | 시점            | 통과 조건                                                                                            | 실패 시 대안                   |
| ------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------ |
| D2 매트릭스 분류 확정          | Phase 4 진입 전 | 38 컴포넌트 전부 (i/ii/iii/iv) cell 판정 + (i) 세부 (a/b/c) 분기 판정                                | audit 재실행                   |
| Wrapper D2 정합                | 각 batch 완료   | 대상 컴포넌트 wrapper의 RSP 미규정 variant prop 0 (또는 ADR에 composition 정당화 명시)               | batch 롤백                     |
| Spec.variants 정합             | 각 batch 완료   | 대상 컴포넌트 Spec.variants가 (a)삭제 / (b)RSP 정합 rename / (c)내부 스위치 유지 중 하나로 판정 완료 | batch 롤백                     |
| Breaking API 마이그레이션      | 각 batch 완료   | wrapper variant prop 제거 시 호출지 수정 완료, type-check 통과                                       | batch 롤백                     |
| composition 고유 정당화 문서화 | (i-c) 해당 시   | 해당 컴포넌트 ADR 본문에 "RAC/RSP 부재 근거 + 시각 대칭 가능 증빙" 기록                              | 대안 설계 (RAC primitive 조합) |

### Consequences (amendment)

#### Positive

- **ADR-036 "Fully Implemented" 재승격 조건 완비** — D2+D3 양축 정리
- **ADR 파편화 방지** — ADR-062b 불필요, ADR-059 단일 체인으로 완결
- **2-pass 회귀 제거** — 각 컴포넌트 1회 수정
- **composition 고유 확장 정책 명시화** — (i-c) 분기가 공식 프로세스로 등록되어 향후 유사 판단 기준 확보

#### Negative

- **Wrapper API breaking change** — (i-a) 경로 컴포넌트는 호출지 수정 필요 (ADR-062 Field 선례 확장 범위)
- **Audit 초기 비용** — 38 × 3축 조사 필수 (Phase 4 진입 전 1회)
- **(i-c) 판단 주관성** — "composition 고유 필수" 기준이 회색지대 가능 → Gate의 "정당화 문서화" 의무로 완화

---

## Phase 5 (B5) — ToggleButton/ToggleButtonGroup indicator SSOT 완결 (2026-04-15)

- `VariantSpec.selected*` / `emphasizedSelected*` 필드 신설 → CSSGenerator가 `[data-selected]` + `[data-emphasized][data-selected]` 룰 자동 emit
- `ComponentSpec.indicatorMode` 서브-스키마 신설 → `[data-indicator="true"]` + `.react-aria-SelectionIndicator` CSS 자동 생성
- `TOGGLE_SELECTED_COLORS` 값이 `ToggleButton.spec.variants.default.selected*` / `emphasizedSelected*`로 이관 (Skia `render.shapes`는 상수 참조 유지 — 후속 과제로 variants 참조 전환 권장)
- 수동 `ToggleButton.css` (141L) 삭제 + `ToggleButton.tsx` import를 generated 경로로 전환
- `@sync` consumer-to-consumer 참조 해소 → SSOT D3 symmetric 복원

관련 commit: a796d1a5, 7ba4c3ad, c13470c9, fdfcbce9, 0a55673a, cd7f002e, a1256596

#### Phase 5 후속 수정 (2026-04-16)

cssEmitMode + `.button-base` protocol 도입 후 시각 검증 과정에서 발견된 누락들 보완:

1. **CSSGenerator 아키텍처 변경** (`c113607a`, `6e22a412`):
   - `ComponentSpec.cssEmitMode?: "direct" | "button-base"` 신설
   - `emitColorLine()` helper로 variant/selected/emphasizedSelected/indicatorMode 전 경로 통일
   - `button-base` 모드: `background/color/border-color` → `--button-color/--button-text/--button-border` custom property emit
   - `.button-base` utility가 color-mix로 hover/pressed 자동 파생하므로 해당 룰 emit 생략
   - Button.spec, ToggleButton.spec에 `cssEmitMode: "button-base"` 적용

2. **shared/ToggleButton.tsx `data-variant="default"` 속성** (`23a62514`):
   - Generated CSS `[data-variant="default"]` 스코프 룰이 매치되려면 DOM에 해당 속성 필요
   - ToggleButton은 기존에 속성을 emit하지 않아 selected/emphasizedSelected 룰 전체가 미적용

3. **ToggleButtonGroup → ToggleButton `isEmphasized` 전파** (`af48c90f`, `fb20ae7a`, `de8d7d08`):
   - **DOM/CSS 측**: `ToggleButtonGroupEmphasizedContext` 신설 → Group의 `isEmphasized`를 자식 ToggleButton Context로 전파 → `data-emphasized` 속성 자동 설정. 기존 `ToggleButtonGroupIndicatorContext` 패턴 재사용.
   - **Skia 측**: ADR-048 `propagation.rules`에 `{parentProp: "isEmphasized", childPath: "ToggleButton"}` 선언 + `apps/builder/src/builder/utils/propagationRegistry.ts`에 `ToggleButtonGroupSpec` 등록. 자식 element props에 전파되어 `render.shapes`가 분기 가능.
   - `size` prop도 동일 메커니즘으로 전파.

4. **RAC 공식 패턴 준수**: `<SelectionIndicator className="react-aria-SelectionIndicator button-base" data-selected />` — RAC 레퍼런스 `ToggleButtonGroup.md` 패턴. indicatorMode rule이 `--button-color: var(--indicator-bg)`을 SelectionIndicator에 emit하고 `.button-base`가 소비하여 SSOT 체인 일관성 유지.

시각 대칭 검증 완료: isEmphasized + selected 조합 CSS/Skia 양쪽 accent 적용, size 전파 양쪽 동작.

---

## 재시작 프롬프트 (v2)

새 세션에서 아래 프롬프트를 그대로 사용:

```text
ADR-059 v2 Composite Field CSS SSOT 확립 작업을 계속합니다.

원칙: Spec=SSOT, CSS/Skia는 대등 consumer, symmetric pipeline.
v2 본문: docs/adr/059-composite-field-skip-css-dismantle.md (2026-04-13 재작성)
v1→v2 변경 핵심: 2층 구조(B안) 기각, 수동 CSS 완전 삭제 + states 확장 결정

Pre-Phase 4단계:
  0-A Naming SSOT (prefix 선언 + TimeField 충돌 제거)
  0-B Delegation 완전성 (4개 Field + TextArea)
  0-C 공유 SSOT (BUTTON_SIZE_CONFIG + NumberField↔ComboBox)
  0-D States + Auto-derivation (CSSGenerator 확장)

선행 조사 결과는 MEMORY.md/adr059-launch-plan.md 및 본 ADR §Context 참조.
breakdown 문서는 v2 기준으로 재작성 필요.

Pre-Phase 0-A 착수 전 worktree 진입 권장 (superpowers:using-git-worktrees).
```
