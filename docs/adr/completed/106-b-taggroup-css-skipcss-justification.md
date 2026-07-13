# ADR-106-b: TagGroup.css skipCSSGeneration 정당화 + @sync 주석 4건 해소

## Status

Implemented — 2026-04-21

## Context

### 배경 — ADR-106 Charter §G2 슬롯 + ADR-105 F4 연동

ADR-106 (skipCSSGeneration 감사 Charter, Implemented 2026-04-21) §G2 "RAC unstyled primitive 수동 재정의 정당" 슬롯에 **TagGroup** 이 배정되었다. Charter 매트릭스 항목:

> TagGroup | `TagGroup.css` (106 token var lines) | ADR-093 TagGroup SSOT — 수동 CSS 가 spec 토큰 파생 (단, `@sync` 주석 ADR-105 F4 연동)

동시에 ADR-105 (@ sync 주석 감사 Charter) §F4 "CSS-to-spec/generator 참조" 에 TagGroup.css 2건이 배정되어 있다:

| 라인 | 주석 원문                                                           | 참조 대상                |
| ---- | ------------------------------------------------------------------- | ------------------------ |
| 148  | `@sync Button.css size variants — padding/fontSize/lineHeight 동일` | Button.css size variants |
| 150  | `@sync ButtonSpec.sizes — padding 동일`                             | ButtonSpec.sizes         |

추가로 ADR-105 §F2 "spec-to-CSS 참조" 에 Tag.spec.ts 2건이 배정되어 있으며, TagGroup.css 가 G2 확정되면 자연 해소 경로가 열린다:

| 라인 | 주석 원문                                           | 참조 대상                  |
| ---- | --------------------------------------------------- | -------------------------- |
| 57   | `@sync TagGroup.css .react-aria-Tag 기본 색상`      | TagGroup.css 기본 색상     |
| 65   | `@sync TagGroup.css .react-aria-Tag[data-selected]` | TagGroup.css selected 색상 |

본 ADR 의 목표는 **TagGroup 이 G2 (정당) 임을 실측으로 확증 + `@sync` 4건 해소** 이다.

### D3 Domain 판정

**D3 (시각 스타일) 전용 작업**. TagGroup.css 의 색상/크기/레이아웃이 Spec SSOT 에서 파생되어야 한다는 원칙(ADR-036/ADR-059/ADR-063). D1(DOM/접근성) — RAC 가 `TagGroup`, `TagList`, `Tag` 내부 DOM 구조 전체를 제공; 본 ADR 은 D1 비침범. D2(Props/API) — 영향 없음.

### Hard Constraints

1. **CSSGenerator 자식 selector emit 지원 여부** 사전 판정 의무 (ADR-106 Charter §Context, 반복 패턴 체크 #2)
2. **BC 0%** — `element.tag` 변경 없음, CSS 경로 변경 없음. `skipCSSGeneration: true` 유지 (반복 패턴 체크 #3)
3. **ADR-059 Tier 3 예외 등록** — 본 ADR Implemented 시 ADR-059 B4 Tier 3 표에 TagGroup 이 이미 등재되어 있으므로 추가 등록 불필요. 단 `@sync` 해소 상태와 근거 ADR 필드 갱신 필요
4. **testing 기준선** — type-check 3/3 + specs PASS + builder PASS

### 소비 코드 경로 (반복 패턴 체크 #1 — 5건 이상 grep 가능 경로)

| 경로                                                         | 역할                                                     | TagGroup 관련           |
| ------------------------------------------------------------ | -------------------------------------------------------- | ----------------------- |
| `packages/specs/src/renderers/CSSGenerator.ts:146`           | `if (spec.skipCSSGeneration && !_embedMode) return null` | TagGroup emit 전면 차단 |
| `packages/specs/src/components/TagGroup.spec.ts:72`          | `skipCSSGeneration: true` 선언                           | —                       |
| `packages/specs/src/components/Tag.spec.ts:57,65`            | `@sync TagGroup.css` 2건                                 | F2 연동 해소 대상       |
| `packages/shared/src/components/styles/TagGroup.css:148,150` | `@sync Button.css / ButtonSpec.sizes` 2건                | F4 직접 해소 대상       |
| `packages/specs/src/components/TagList.spec.ts:13`           | `skipCSSGeneration: true` — G1 정당 (childSpecs 경로)    | 본 ADR scope 밖         |

### CSSGenerator 자식 selector emit 지원 여부 판정 (CRITICAL — 반복 패턴 체크 #2)

ADR-106-a 에서 확정된 CSSGenerator 지원 범위:

| emit 기능                                                                                   |    지원 여부     |
| ------------------------------------------------------------------------------------------- | :--------------: |
| `.react-aria-{Name}` root selector                                                          |        ✅        |
| `[data-variant][data-size]` attribute selector                                              |        ✅        |
| `[data-state]` (hover/pressed/disabled/focusVisible)                                        |        ✅        |
| `composition.staticSelectors` (고정 자식 selector)                                          |        ✅        |
| `composition.sizeSelectors` (per-size 자식 selector)                                        |        ✅        |
| `composition.rootSelectors` (root pseudo selector)                                          |        ✅        |
| `childSpecs` inline embed emit                                                              |        ✅        |
| RAC 내부 구조체 selector (`.react-aria-Tag`, `.react-aria-TagList`, `.tag-list-wrapper` 등) |        ❌        |
| pseudo-element (`::after`, `::before`)                                                      |        ❌        |
| `color-mix(in srgb, ...)` CSS 함수 내 변수                                                  | ❌ (CSS 값 자체) |

**TagGroup.css 핵심 구조 분석**:

TagGroup.css 는 307줄로 아래 구조를 포함한다:

1. `.react-aria-TagGroup` — root container (flexDirection/gap/font)
2. `.tag-list-wrapper` — 커스텀 래퍼 클래스 (flex wrap)
3. `.react-aria-TagList` — RAC 내부 구조체 (display: contents)
4. `.react-aria-Tag` — RAC 내부 구조체 (기본/hover/focus/selected 상태)
5. `.react-aria-Tag[data-href]` — RAC 내부 구조체 (링크 패턴)
6. `.react-aria-Tag[data-disabled]` — RAC 내부 구조체 (비활성)
7. `.react-aria-TagGroup[data-tag-variant="*"] .react-aria-Tag` — parent-delegated 색상 variants (5종)
8. `.react-aria-TagGroup[data-tag-size="*"] .react-aria-Tag` — parent-delegated size variants (5종)
9. `.tag-show-all-btn` — 커스텀 버튼 클래스
10. `[slot="description"]`, `[slot="errorMessage"]` — RAC slot selector

이 중 #3~#10은 **CSSGenerator 미지원 패턴** (RAC 내부 구조체, 커스텀 클래스, slot selector, nested parent-child selector). CSSGenerator 가 `composition.sizeSelectors` 를 지원하더라도 `.react-aria-TagGroup[data-tag-size="*"] .react-aria-Tag` 2단계 parent-child selector 는 emit 불가.

**컴포넌트 판정**:

| 컴포넌트     | CSS 핵심 구조                                                                                               | Generator 지원? | 판정                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------- | :-------------: | ------------------------------------------------ |
| **TagGroup** | RAC `.react-aria-Tag` / `.react-aria-TagList` nested + `[data-tag-size] .react-aria-Tag` 2단계 parent-child | ❌ 복합 미지원  | G2 정당 (spec token 파생 + RAC 구조 수동 재정의) |

### TagGroup.css spec token 파생 전수 조사 매트릭스 (Phase 0)

전수 조사 결과 307줄 중 모든 CSS 값이 spec token(`var(--*)`) 또는 CSS 함수 파생이다.

| CSS 선언                                                  | 값                                  | spec token 파생? | 근거              |
| --------------------------------------------------------- | ----------------------------------- | :--------------: | ----------------- |
| `gap: var(--spacing-xs)`                                  | `{spacing.xs}`                      |        ✅        | spacing token     |
| `font-size: var(--text-sm)`                               | `{typography.text-sm}`              |        ✅        | typography token  |
| `color: var(--fg)`                                        | `{color.neutral}`                   |        ✅        | color token       |
| `--tag-color: var(--bg-overlay)`                          | `{color.layer-1}`                   |        ✅        | color token       |
| `--tag-text: var(--fg)`                                   | `{color.neutral}`                   |        ✅        | color token       |
| `--tag-border: var(--border)`                             | `{color.border}`                    |        ✅        | color token       |
| `border-radius: var(--radius-md)`                         | `{radius.md}`                       |        ✅        | radius token      |
| `padding: var(--spacing-xs) var(--spacing-md)` (md)       | `{spacing.xs}`, `{spacing.md}`      |        ✅        | spacing token     |
| `font-size: var(--text-sm)` (md)                          | `{typography.text-sm}`              |        ✅        | typography token  |
| `line-height: var(--text-sm--line-height)` (md)           | `{typography.text-sm--line-height}` |        ✅        | typography token  |
| `color-mix(in srgb, var(--tag-color) 92%, black)` (hover) | token 파생 CSS 함수                 |        ✅        | spec token 사용   |
| `outline: 2px solid var(--accent)` (focus)                | `{color.accent}`                    |        ✅        | color token       |
| `--tag-color: var(--accent)` (selected)                   | `{color.accent}`                    |        ✅        | color token       |
| `--tag-text: var(--fg-on-accent)` (selected)              | `{color.on-accent}`                 |        ✅        | color token       |
| `--tag-border: var(--accent)` (selected)                  | `{color.accent}`                    |        ✅        | color token       |
| `border-color: var(--border-disabled)` (disabled)         | `{color.border-disabled}`           |        ✅        | color token       |
| `color: var(--fg-disabled)` (disabled)                    | `{color.neutral-disabled}`          |        ✅        | color token       |
| `--tag-color: var(--color-purple-600)` (tertiary variant) | Named color token                   |        ✅        | named color token |
| `--tag-color: var(--negative)` (error variant)            | `{color.negative}`                  |        ✅        | color token       |
| `outline: 2px solid var(--focus-ring)` (.tag-remove-btn)  | `{focus.ring.default}`              |        ✅        | focus token       |
| `--label-font-size: var(--text-2xs)` (xs size label)      | `{typography.text-2xs}`             |        ✅        | typography token  |

**독자 수치 없음** — TagGroup.css 307줄 전체가 spec token 파생이거나 CSS 함수 파생. `--cp-*` 류의 독립 로컬 변수 없음. ADR-106-a ColorPicker 대비 **완전 정당**.

### Button.css ↔ TagGroup.css size variants 동일성 검증

**Button.css** `[data-size]` 블록:

| size | padding                  | font-size   | line-height              |
| ---- | ------------------------ | ----------- | ------------------------ |
| xs   | `spacing-3xs spacing-xs` | `text-2xs`  | `text-2xs--line-height`  |
| sm   | `spacing-2xs spacing-sm` | `text-xs`   | `text-xs--line-height`   |
| md   | `spacing-xs spacing-md`  | `text-sm`   | `text-sm--line-height`   |
| lg   | `spacing-sm spacing-lg`  | `text-base` | `text-base--line-height` |
| xl   | `spacing-md spacing-xl`  | `text-lg`   | `text-lg--line-height`   |

**TagGroup.css** `.react-aria-TagGroup[data-tag-size="*"] .react-aria-Tag` 블록:

| size | padding                  | font-size   | line-height              |
| ---- | ------------------------ | ----------- | ------------------------ |
| xs   | `spacing-3xs spacing-xs` | `text-2xs`  | `text-2xs--line-height`  |
| sm   | `spacing-2xs spacing-sm` | `text-xs`   | `text-xs--line-height`   |
| md   | `spacing-xs spacing-md`  | `text-sm`   | `text-sm--line-height`   |
| lg   | `spacing-sm spacing-lg`  | `text-base` | `text-base--line-height` |
| xl   | `spacing-md spacing-xl`  | `text-lg`   | `text-lg--line-height`   |

**결론: 5개 size 전부 1:1 완전 동일.** `@sync` 주석이 경고한 것처럼, Button.css 와 TagGroup.css 의 size variants 는 spacing/typography token 레벨에서 동일하다. 이는 의도된 설계 — Tag(chip)는 버튼과 동일한 크기 체계를 사용한다.

### ButtonSpec.sizes ↔ TagSpec.sizes 동일성 검증

**ButtonSpec.sizes** (xs~xl):

| size | paddingX          | paddingY          | fontSize    |
| ---- | ----------------- | ----------------- | ----------- |
| xs   | 4 (`spacing-xs`)  | 1 (`spacing-3xs`) | `text-2xs`  |
| sm   | 8 (`spacing-sm`)  | 2 (`spacing-2xs`) | `text-xs`   |
| md   | 12 (`spacing-md`) | 4 (`spacing-xs`)  | `text-sm`   |
| lg   | 16 (`spacing-lg`) | 8 (`spacing-sm`)  | `text-base` |
| xl   | 24 (`spacing-xl`) | 12 (`spacing-md`) | `text-lg`   |

**TagSpec.sizes** (xs~xl):

| size | paddingX | paddingY | fontSize    |
| ---- | -------- | -------- | ----------- |
| xs   | 4        | 1        | `text-2xs`  |
| sm   | 8        | 2        | `text-xs`   |
| md   | 12       | 4        | `text-sm`   |
| lg   | 16       | 8        | `text-base` |
| xl   | 24       | 12       | `text-lg`   |

**결론: paddingX/paddingY/fontSize 5개 size 전부 1:1 완전 동일.** `@sync ButtonSpec.sizes` 주석이 경고한 것처럼, Tag spec sizes 와 Button spec sizes 의 padding 체계는 동일하다. borderRadius 는 Tag 가 xl 에서 `radius-lg` (Button 은 `radius-xl`) 로 1개 차이 — 의도적 차이 (Tag 는 더 둥근 형태 불필요).

이 동일성은 `@sync` 주석의 경고가 정확히 실현되고 있음을 확인한다. 단, 두 spec 이 독립적으로 진화할 가능성이 있으므로 `@sync` 제거 후에는 설명 주석으로 교체가 필요하다.

### BC 영향 수식화 (반복 패턴 체크 #3)

- `skipCSSGeneration: true` → 유지 (수동 CSS 정당화, Generator 전환 불가). BC 영향: **0%**
- `element.tag` 변경 없음, CSS 파일 구조 변경 없음 → Preview/Canvas 시각 결과 변화 없음
- `@sync` 주석 → 설명 주석 교체는 코드 로직 변경 아님 → BC 0%
- 영향 사용자: **0%** (주석 + 문서 변경만)

### Phase 분리 가능성 (반복 패턴 체크 #4)

4건이 모두 주석 교체로 처리 가능 → 단일 Phase 로 충분. 단, ADR-059 Tier 3 표 갱신은 별도 파일 수정. Phase 분리 불필요.

### Soft Constraints

- ADR-059 B4 Tier 3 표에 `TagGroup` 이 이미 등재됨 (`근거 ADR: —`). 본 ADR 이 공식 근거 ADR 로 갱신 필요
- ADR-105 F4 TagGroup.css 2건 (105-d 슬롯) — 본 ADR Proposed 후 105-d 착수 시 "이미 해소됨" 상태로 skip 처리
- ADR-105 F2 Tag.spec.ts 2건 (105-c 슬롯) — TagGroup.css 가 G2 확정되면 "TagGroup.css 는 spec token 파생 정당 CSS" 설명 주석으로 교체 가능 (수동 CSS 독립 정의 아님 확증 후)
- Tag.spec.ts `@sync` 색상 참조는 **TagGroup.css 가 정당임이 전제** → 본 ADR 완료 후 F2 자연 해소 가능

## Alternatives Considered

### 대안 A: 수동 CSS 정당화 + @sync 4건 설명 주석 교체 (선정)

- 설명: TagGroup.spec.ts 의 `skipCSSGeneration: true` 를 유지하되, 수동 CSS 가 spec token 파생임을 문서화. TagGroup.css 2건과 Tag.spec.ts 2건의 `@sync` 주석을 설명 주석으로 교체. ADR-059 Tier 3 표에 근거 ADR 갱신. 코드 로직 변경 없음.
  - 장점: 구현 비용 최소. CSSGenerator 미지원 RAC 내부 구조체 selector를 강제 변환하지 않음. `@sync` 4건이 설명 주석으로 D3 debt 해소. Button↔Tag size 동일성 관계를 코드베이스에서 명시적으로 문서화
  - 단점: Button.css와 TagGroup.css의 size variants가 장기적으로 drift 가능성 유지 (의도적 동일성이 주석으로만 보호됨)
- 위험:
  - 기술: LOW — 기존 동작 완전 유지
  - 성능: LOW — N/A
  - 유지보수: LOW — 설명 주석으로 drift 감지 의무 명시. `@sync` 삭제보다 drift 위험이 낮음 (설명 주석이 의도 문서화)
  - 마이그레이션: LOW — BC 변경 없음

### 대안 B: TagGroup.css size variants 를 Button.css CSS 변수로 통합

- 설명: `.react-aria-TagGroup[data-tag-size="*"] .react-aria-Tag` 블록을 삭제하고, TagGroup 이 Button.css 의 `--btn-padding` / `--btn-font-size` / `--btn-line-height` CSS 변수를 직접 상속하도록 구조 변경. size variant 정의를 Button.css 단일 소스로.
  - 장점: size 값 중복 제거. Button CSS 변경 시 TagGroup 자동 반영.
  - 단점: TagGroup 의 CSS 설계가 Button.css 에 강하게 결합됨. TagGroup Tag 가 Button 이 아닌 다른 크기 체계로 진화하면 결합 해제 비용이 큼. CSS 변수 스코프가 `.react-aria-Button` 에 한정될 수 있어 상속 경로가 보장되지 않음
- 위험:
  - 기술: **HIGH** — CSS 변수 스코프 확인 + 상속 경로 확인 필요. `--btn-padding` 은 Button 내부 scoped 변수 — TagGroup 이 직접 사용하려면 변수 호이스팅 필요. `.react-aria-TagGroup` 스코프에서 `.react-aria-Button` 변수 참조 불가
  - 성능: LOW
  - 유지보수: **HIGH** — Button 과 TagGroup 이 강하게 결합됨. Button 크기 변경 시 TagGroup 자동 영향. 의도적 독립 진화 불가
  - 마이그레이션: MEDIUM — TagGroup.css 구조 변경 → `/cross-check` 필요

### 대안 C: ButtonSpec/TagSpec 공유 sizes primitives 추출 (ADR-105-a 패턴)

- 설명: `packages/specs/src/primitives/` 에 `chipSizes.ts` 를 신설하고 ButtonSpec 과 TagSpec 이 동일 상수를 import. `@sync` 주석 근본 원인 해소. TagGroup.css size variants 도 primitives 상수 참조로 전환.
  - 장점: spec 레벨 SSOT 확립. `@sync` 주석 근본 제거.
  - 단점: ButtonSpec 과 TagSpec 의 sizes 가 5개 중 borderRadius 1개 차이 (xl: `radius-xl` vs `radius-lg`). 완전 동일하지 않으므로 primitives 공유 후 override 필요 → 복잡성 추가. TagGroup.css 는 CSS token 레벨 변수를 사용하므로 primitives 추출이 CSS 파일에는 자동 적용 불가
- 위험:
  - 기술: **HIGH** — ButtonSpec.sizes 에 borderRadius 예외 처리 필요. TagGroup.css 는 CSS 파일이므로 primitives TypeScript 상수 추출이 CSS 값에 직접 영향 없음. CSS 측은 여전히 별도 `@sync` 주석 관리 필요
  - 성능: LOW
  - 유지보수: MEDIUM — primitives 추출이 spec 파일 경계를 추가함. CSS 파일은 변경 없음 → @sync CSS 2건 여전히 잔존
  - 마이그레이션: LOW — element.tag 변경 없음

### Risk Threshold Check

| 대안                       | 기술  | 성능 | 유지보수 | 마이그레이션 | HIGH+ 수 | 판정     |
| -------------------------- | :---: | :--: | :------: | :----------: | :------: | -------- |
| A: 정당화 + 설명 주석 교체 |   L   |  L   |    L     |      L       |    0     | **PASS** |
| B: CSS 변수 통합           | **H** |  L   |  **H**   |      M       |    2     | 기각     |
| C: primitives 추출         | **H** |  L   |    M     |      L       |    1     | 기각     |

**반복 패턴 선차단 체크** (adr-writing.md Top 1~4):

- [x] **#1 코드 경로 인용**: Context "소비 코드 경로" 표에 5건 grep 가능 파일:라인 명시
- [x] **#2 Generator 확장 여부**: CSSGenerator 미지원 구조 (RAC 내부 selector / 2단계 parent-child selector) 를 매트릭스로 판정
- [x] **#3 BC 훼손 수식화**: element.tag 변경 없음, CSS 구조 변경 없음 → BC 0%, 영향 사용자 0%
- [x] **#4 Phase 분리 가능성**: 4건 모두 주석 교체 → 단일 Phase. 단, ADR-059 표 갱신 별도 파일 수정 포함. Phase 분리 불필요 수준

대안 A 만 HIGH+ 없음. ADR-106-a Color family 정당화 선례 재사용.

## Decision

**대안 A (수동 CSS 정당화 + @sync 4건 설명 주석 교체)** 채택.

**선택 근거**:

1. **실측 결과 G2 정당 확증**: TagGroup.css 307줄 전체가 spec token 파생. 독자 수치 0개. ADR-059 §Tier 3 허용 패턴("수동 CSS가 spec 토큰 파생이면 D3 대칭 consumer 준수") 완전 충족. ADR-106-a ColorPicker 보다 더 완전한 정당 케이스.
2. **CSSGenerator 구조적 미지원**: `.react-aria-TagGroup[data-tag-size="*"] .react-aria-Tag` 2단계 parent-child selector, `.react-aria-Tag` / `.react-aria-TagList` RAC 내부 구조체 selector, `.tag-list-wrapper` / `.tag-show-all-btn` 커스텀 클래스 — 이 구조들은 Generator 지원 범위 밖. 강제 전환 시 Generator 대규모 확장 필요 (ADR-078 이상 복잡도)
3. **Button↔Tag size 동일성 명시화**: `@sync` 주석이 경고한 것처럼 두 컴포넌트 size variant 는 token 레벨에서 동일. 이는 의도된 설계 (chip = button sized). 설명 주석으로 전환하면 이 의도가 코드베이스에 명시적으로 문서화됨
4. **ADR-105 F4/F2 연동 해소**: TagGroup.css G2 확정 → F4 2건 "해소됨" 상태. Tag.spec.ts F2 2건은 TagGroup.css 가 정당 CSS 임이 확증됐으므로 "TagGroup.css 는 spec token 파생 정당" 설명 주석으로 교체 가능

**기각 사유**:

- **대안 B 기각**: HIGH 2개. CSS scoped 변수(`--btn-padding`)를 TagGroup 이 직접 참조하려면 CSS 설계 대규모 변경 필요. Button 과 TagGroup 의 강한 결합은 독립 진화를 막음 — Tag 가 독자적 크기 체계로 진화할 때 Button 종속성이 장애물이 됨
- **대안 C 기각**: HIGH 1개. TypeScript primitives 추출이 CSS 파일에 자동 적용되지 않으므로 TagGroup.css `@sync` 2건이 여전히 잔존. borderRadius 1개 불일치 예외 처리 추가 복잡성. ADR-105-a (F3 primitives 이관) 완료 후 재평가가 더 적절

> 구현 상세: [106-b-taggroup-css-skipcss-justification-breakdown.md](../../adr/design/106-b-taggroup-css-skipcss-justification-breakdown.md)

## Risks

| ID  | 위험                                                                                                                | 심각도 | 대응                                                                                                |
| --- | ------------------------------------------------------------------------------------------------------------------- | :----: | --------------------------------------------------------------------------------------------------- |
| R1  | Button.css size variants 와 TagGroup.css size variants 가 미래에 drift — 설명 주석으로만 보호됨                     |  LOW   | 설명 주석에 drift 감지 의무 명시. Button spec 크기 변경 시 TagGroup.css 동반 확인 체크리스트 포함   |
| R2  | Tag.spec.ts F2 2건 (105-c 슬롯) 해소가 본 ADR 완료 후에도 지연될 가능성                                             |  LOW   | 본 ADR Implemented 후 105-c 착수 시 Tag.spec.ts @sync 주석 설명 주석 교체를 105-c 체크리스트에 명시 |
| R3  | ADR-059 B4 Tier 3 표에서 `TagGroup` 행의 근거 ADR 필드가 `—` 에서 `ADR-106-b` 로 갱신되지 않으면 Charter 추적 stale |  LOW   | Phase 3 에서 ADR-059 breakdown Tier 3 표 갱신 수행                                                  |

잔존 HIGH 위험 없음.

## Gates

잔존 HIGH 위험 없음 — Gate 테이블 생략.

본 ADR 검증 기준:

| 검증 항목                                  | 시점               | 통과 조건                                                      |
| ------------------------------------------ | ------------------ | -------------------------------------------------------------- |
| G1: TagGroup.css spec token 파생 전수 조사 | ADR Proposed       | 307줄 전체 매트릭스에서 독자 수치 0개 확인 (breakdown Phase 0) |
| G2: CSSGenerator 미지원 구조 판정          | ADR Proposed       | RAC 내부 selector / 2단계 parent-child 미지원 매트릭스 기록    |
| G3: @sync 주석 교체                        | ADR Implemented 시 | TagGroup.css 2건 + Tag.spec.ts 2건 = 4건 설명 주석 교체 완료   |
| G4: ADR-059 Tier 3 표 갱신                 | ADR Implemented 시 | `TagGroup` 행 `근거 ADR: ADR-106-b` 갱신                       |
| G5: type-check                             | 각 변경 완료 시    | type-check 3/3 PASS                                            |

**본 ADR Implemented 전환 조건**: G3 + G4 + G5 모두 충족 시 (구현 Phase 완료 기준).

## Consequences

### Positive

- **ADR-106 Charter G2 TagGroup 슬롯 완결**: 106-b 가 G2 정당화의 두 번째 sub-ADR 로서 Charter 슬롯을 채움. G2 정당 케이스가 9 → 10건으로 확정
- **@sync 4건 해소**: ADR-105 F4 TagGroup.css 2건 + F2 Tag.spec.ts 2건이 본 ADR Implemented 로 D3 consumer-to-consumer coupling 주석 해소
- **Button↔Tag size 동일성 의도 문서화**: 두 컴포넌트의 size 체계 공유가 의도된 것임을 코드베이스에 명시. 향후 개발자가 "왜 동일한가" 질문 불필요
- **ADR-059 Tier 3 표 완결성 향상**: TagGroup 행에 `ADR-106-b` 근거 ADR 등록 → 추적 가능성 확보
- **ADR-106-a 선례 패턴 재사용**: ColorPicker/Slider/Wheel/SwatchPicker 와 동일한 G2 정당화 경로 — 유사 케이스 처리 패턴 확립

### Negative

- **size variants drift 잔존**: Button.css 와 TagGroup.css size 값이 독립 관리됨. primitives 통합 없이 설명 주석만으로 drift 예방 — Token 레벨 의존성이 암묵적
- **Tag.spec.ts F2 2건 별도 처리 필요**: TagGroup.css G2 확정이 전제이므로 본 ADR Implemented 후 105-c 착수 시 처리. 즉시 해소 불가
- **수동 CSS 파일 유지**: TagGroup.css 가 계속 수동 관리됨. Skia + CSS 양쪽 수정 시 이중 편집 가능성 존재 (단, ADR-106-a 와 동일한 수준)

## 참조

- [ADR-059](059-composite-field-skip-css-dismantle.md) — Tier 3 예외 표 정본 (B4 실행 결과 TagGroup 등재)
- [ADR-063](063-ssot-chain-charter.md) — SSOT 체인 D3 금지 패턴 3번 정본
- [ADR-093](093-synthetic-merge-containers-spec.md) — TagList spec skipCSSGeneration:true G1 정당화
- [ADR-097](097-taggroup-items-ssot-hybrid.md) — TagGroup items SSOT
- [ADR-105](105-sync-annotation-audit-charter.md) — @sync 주석 감사 Charter (F4 TagGroup.css 2건, F2 Tag.spec.ts 2건)
- [ADR-106](106-skipcssgeneration-audit-charter.md) — skipCSSGeneration 감사 Charter G2 슬롯 정의
- [ADR-106-a](106-a-color-family-skipcss-dismantle.md) — G2 정당화 선례 (Color family 4건)
- [ssot-hierarchy.md](../../../.claude/rules/ssot-hierarchy.md) — D3 domain §6 금지 패턴 3번, §7 허용 패턴
