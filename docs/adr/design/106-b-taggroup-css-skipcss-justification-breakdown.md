# ADR-106-b Breakdown: TagGroup.css skipCSSGeneration 정당화 — 구현 상세

> 본 파일은 [ADR-106-b](../completed/106-b-taggroup-css-skipcss-justification.md) 의 구현 상세 분리 문서.
> ADR 본문에는 `> 구현 상세: [링크]` 포인터만 기록함.

## 결론 요약

TagGroup.spec.ts 의 `skipCSSGeneration: true` 는 **G2 (RAC unstyled primitive 수동 재정의 정당)** 로 확증됨.

- TagGroup.css 307줄 전체가 spec token 파생 — 독자 수치 0개
- `.react-aria-Tag`, `.react-aria-TagList` 등 RAC 내부 구조체 selector 포함 → CSSGenerator emit 구조적 불가
- Button.css 와 TagGroup.css size variants 는 token 레벨에서 1:1 완전 동일 (의도된 설계)
- `@sync` 주석 4건 (TagGroup.css:148,150 + Tag.spec.ts:57,65) 이 설명 주석으로 교체되어 D3 consumer-to-consumer coupling 해소

**총 변경**: 2개 파일, 주석 교체만. 코드 로직 변경 없음. ADR-059 Tier 3 표 갱신 1개 파일.

---

## Phase 0: 선행 조사 (DONE — 본 ADR 작성 시 완료)

### 목적

CSSGenerator 지원 범위 조사 + TagGroup.css spec token 파생 여부 전수 조사 + Button↔Tag size 동일성 검증.

### 결과 요약

#### TagGroup.css 구조 분석

파일: `packages/shared/src/components/styles/TagGroup.css` (307 lines)

```
구조:
1. .react-aria-TagGroup           root container (flex/gap/font)
2. .tag-list-wrapper              커스텀 래퍼 (flex wrap)
3. .react-aria-TagList            RAC 내부 구조체 (display: contents)
4. .react-aria-Tag                RAC 내부 구조체 (기본/hover/focus/selected)
5. .react-aria-Tag[data-href]     RAC 내부 구조체 (링크)
6. .react-aria-Tag[data-disabled] RAC 내부 구조체 (비활성)
7. .react-aria-TagGroup[data-tag-variant="*"] .react-aria-Tag   2단계 parent-child
8. .react-aria-TagGroup[data-tag-size="*"] .react-aria-Tag      2단계 parent-child
9. .tag-show-all-btn              커스텀 버튼 클래스
10. [slot="description"], [slot="errorMessage"]  RAC slot selector
```

CSSGenerator 미지원 패턴: #3~#10 전부.

#### spec token 파생 전수 조사 — 독자 수치 없음

TagGroup.css 내 모든 CSS 값을 전수 조사한 결과:

| 범주         | 사용 token                                                                                                       |      파생 여부       |
| ------------ | ---------------------------------------------------------------------------------------------------------------- | :------------------: |
| gap, spacing | `--spacing-xs`, `--spacing-sm`, `--spacing-md`, `--spacing-lg`, `--spacing-xl`, `--spacing-2xs`, `--spacing-3xs` |          ✅          |
| typography   | `--text-2xs`, `--text-xs`, `--text-sm`, `--text-base`, `--text-lg` + 각 `--line-height`                          |          ✅          |
| color        | `--fg`, `--fg-on-accent`, `--fg-disabled`, `--fg-base`, `--fg-emphasis`, `--fg-muted`                            |          ✅          |
| background   | `--bg-overlay`, `--bg-inset`, `--accent-subtle`                                                                  |          ✅          |
| border       | `--border`, `--border-hover`, `--border-disabled`                                                                |          ✅          |
| accent       | `--accent`, `--accent-subtle`                                                                                    |          ✅          |
| named colors | `--color-purple-600`, `--color-white`, `--negative`                                                              |          ✅          |
| focus        | `--focus-ring`                                                                                                   |          ✅          |
| radius       | `--radius-sm`, `--radius-md`, `--radius-lg`                                                                      |          ✅          |
| CSS 함수     | `color-mix(in srgb, var(--tag-color) 92%, black)`                                                                | ✅ (token 파생 함수) |

**독자 수치 없음** — ADR-106-a ColorPicker (`--cp-dialog-min-width: 192px` 등) 대비 **완전 정당**.

#### Button.css ↔ TagGroup.css size variants 1:1 동일 확인

`packages/shared/src/components/styles/Button.css` `[data-size]` 블록 vs
`packages/shared/src/components/styles/TagGroup.css` `[data-tag-size="*"] .react-aria-Tag` 블록:

| size | Button.css padding       | TagGroup.css padding     | 동일? |
| ---- | ------------------------ | ------------------------ | :---: |
| xs   | `spacing-3xs spacing-xs` | `spacing-3xs spacing-xs` |  ✅   |
| sm   | `spacing-2xs spacing-sm` | `spacing-2xs spacing-sm` |  ✅   |
| md   | `spacing-xs spacing-md`  | `spacing-xs spacing-md`  |  ✅   |
| lg   | `spacing-sm spacing-lg`  | `spacing-sm spacing-lg`  |  ✅   |
| xl   | `spacing-md spacing-xl`  | `spacing-md spacing-xl`  |  ✅   |

font-size / line-height 도 동일 (5/5 size).

#### ButtonSpec.sizes ↔ TagSpec.sizes paddingX/paddingY/fontSize 동일 확인

| size | Button paddingX | Tag paddingX | Button paddingY | Tag paddingY | fontSize     |
| ---- | --------------- | ------------ | --------------- | ------------ | ------------ |
| xs   | 4               | 4            | 1               | 1            | text-2xs ✅  |
| sm   | 8               | 8            | 2               | 2            | text-xs ✅   |
| md   | 12              | 12           | 4               | 4            | text-sm ✅   |
| lg   | 16              | 16           | 8               | 8            | text-base ✅ |
| xl   | 24              | 24           | 12              | 12           | text-lg ✅   |

borderRadius: xl 만 1개 차이 (Button: `radius-xl`, Tag: `radius-lg`) — 의도적 차이.

---

## Phase 1: TagGroup.css @sync 주석 교체 (F4 해소)

**목표**: TagGroup.css 2건의 `@sync` 주석을 설명 주석으로 교체.

**대상 파일**: `packages/shared/src/components/styles/TagGroup.css`

### 변경 내용

**현재 (lines 147–151)**:

```css
/* ===== Parent-delegated Size Variants ===== */
/* @sync Button.css size variants — padding/fontSize/lineHeight 동일 */

/* @sync ButtonSpec.sizes — padding 동일 */
```

**변경 후**:

```css
/* ===== Parent-delegated Size Variants ===== */
/* Tag size variants use the same padding/fontSize/lineHeight scale as Button.
   * Intentional: chips share button sizing. If Button.css [data-size] changes,
   * update here too. (ADR-106-b — formerly @sync F4 annotation) */
```

**이유**: `@sync` 주석은 "이 값을 손으로 맞춰야 한다"는 경고 마커(D3 consumer-to-consumer coupling 신호). TagGroup.css 가 G2 정당 CSS 임이 확증된 상태에서 `@sync` 는 D3 위반 경고가 아니라 의도된 설계 관계를 서술하는 설명 주석으로 교체하는 것이 적절.

**예상 작업량**: 1개 파일, 주석 2줄 → 4줄로 교체.

---

## Phase 2: Tag.spec.ts @sync 주석 교체 (F2 해소)

**목표**: Tag.spec.ts 2건의 `@sync TagGroup.css` 주석을 설명 주석으로 교체.

**대상 파일**: `packages/specs/src/components/Tag.spec.ts`

### 변경 내용

**현재 (lines 55–70)**:

```typescript
  variants: {
    default: {
      // @sync TagGroup.css .react-aria-Tag 기본 색상
      background: "{color.layer-1}" as TokenRef, // --overlay-background
      backgroundHover: "{color.layer-1}" as TokenRef,
      backgroundPressed: "{color.layer-1}" as TokenRef,
      text: "{color.neutral}" as TokenRef, // --text-color
      border: "{color.border}" as TokenRef, // --border-color
    },
    selected: {
      // @sync TagGroup.css .react-aria-Tag[data-selected]
      background: "{color.accent}" as TokenRef, // --highlight-background
```

**변경 후**:

```typescript
  variants: {
    default: {
      // Colors match TagGroup.css .react-aria-Tag --tag-color/--tag-text/--tag-border defaults.
      // TagGroup.css is spec-token-derived (ADR-106-b G2) — this is intentional alignment.
      background: "{color.layer-1}" as TokenRef, // --overlay-background
      backgroundHover: "{color.layer-1}" as TokenRef,
      backgroundPressed: "{color.layer-1}" as TokenRef,
      text: "{color.neutral}" as TokenRef, // --text-color
      border: "{color.border}" as TokenRef, // --border-color
    },
    selected: {
      // Colors match TagGroup.css .react-aria-Tag[data-selected] --tag-color/--tag-text/--tag-border.
      // TagGroup.css is spec-token-derived (ADR-106-b G2) — this is intentional alignment.
      background: "{color.accent}" as TokenRef, // --highlight-background
```

**이유**: TagGroup.css 가 G2 정당 CSS 임이 확증됨. Tag.spec.ts 의 `@sync TagGroup.css` 는 "TagGroup.css 가 독립 정의이므로 spec 과 수동 동기화 필요" 경고였으나, 이제 "TagGroup.css 는 spec token 파생 + spec 과 정렬됨" 관계 서술로 전환. ADR-105 F2 카테고리 (spec-to-CSS coupling) 해소.

**예상 작업량**: 1개 파일, 주석 2건 교체.

---

## Phase 3: ADR-059 Tier 3 표 근거 ADR 갱신

**목표**: ADR-059 B4 실행 결과 Tier 3 예외 표의 `TagGroup` 행에 `근거 ADR: ADR-106-b` 추가.

**대상 파일**: `docs/adr/design/completed/059-composite-field-skip-css-dismantle-breakdown.md`

### 현재 Tier 3 표 TagGroup 행

```markdown
| TagGroup | 306L 복합 CSS — .react-aria-Tag까지 포함 | — |
```

### 변경 후

```markdown
| TagGroup | 복합 CSS — `.react-aria-Tag`/`.react-aria-TagList` RAC 내부 구조체 + 2단계 parent-child selector 포함. 전체 307줄이 spec token 파생 (독자 수치 없음). ADR-105 F4/F2 @sync 4건 설명 주석 교체 완료. | ADR-106-b |
```

**예상 작업량**: 1개 파일, 1행 갱신.

---

## Phase 4: type-check 확인

**목표**: 코드 변경 없음(주석만 교체) → type-check 3/3 자동 통과 예상.

```bash
pnpm type-check
# 기대: 3/3 PASS (주석 변경만, 로직 무변경)
```

---

## @sync 해소 매트릭스

| #   | 파일           | 라인 | 원래 @sync                                          | ADR-105 카테고리 | 해소 방법      | Phase   |
| --- | -------------- | ---- | --------------------------------------------------- | ---------------- | -------------- | ------- |
| 1   | `TagGroup.css` | 148  | `@sync Button.css size variants`                    | F4               | 설명 주석 교체 | Phase 1 |
| 2   | `TagGroup.css` | 150  | `@sync ButtonSpec.sizes`                            | F4               | 설명 주석 교체 | Phase 1 |
| 3   | `Tag.spec.ts`  | 57   | `@sync TagGroup.css .react-aria-Tag 기본 색상`      | F2               | 설명 주석 교체 | Phase 2 |
| 4   | `Tag.spec.ts`  | 65   | `@sync TagGroup.css .react-aria-Tag[data-selected]` | F2               | 설명 주석 교체 | Phase 2 |

**총 @sync 해소**: 4건 (F4 2건 + F2 2건)

---

## 컴포넌트별 작업 매트릭스

| 컴포넌트            | G 분류  | CSS 파일 변경 | spec 파일 변경 | 주석 교체  | CSSGenerator 변경 |
| ------------------- | :-----: | :-----------: | :------------: | :--------: | :---------------: |
| TagGroup            | G2 정당 |  ✅ (주석만)  |       ❌       | ✅ Phase 1 |        ❌         |
| Tag                 |    —    |      ❌       |  ✅ (주석만)   | ✅ Phase 2 |        ❌         |
| (ADR-059 Tier 3 표) |    —    |       —       |       —        | ✅ Phase 3 |         —         |

**총 코드 변경**: 2개 파일 (TagGroup.css 주석 + Tag.spec.ts 주석) + 1개 파일 (ADR-059 breakdown 표 갱신)

---

## 체크리스트 (ADR Implemented 전환 조건)

- [x] **Phase 0**: 선행 조사 완료 — G2 정당 근거 문서화 (본 breakdown)
- [x] **Phase 1**: TagGroup.css 148/150 `@sync` → 설명 주석 교체 완료
- [x] **Phase 2**: Tag.spec.ts 57/65 `@sync TagGroup.css` → 설명 주석 교체 완료 (76/77줄 추가 @sync 2건 포함)
- [x] **Phase 3**: ADR-059 B4 Tier 3 표 TagGroup 행 `근거 ADR: ADR-106-b` 갱신
- [x] **Phase 4**: type-check 3/3 PASS 확인
- [x] **Gate G3**: @sync 6건 교체 완료 확인 (`rg "@sync" packages/specs/src/components/Tag.spec.ts packages/shared/src/components/styles/TagGroup.css` = 0건)
- [x] **Gate G4**: ADR-059 Tier 3 표 TagGroup 행 갱신 확인
- [x] **Gate G5**: type-check 3/3 PASS, specs 205/205 PASS

---

## ADR-105 연동 상태 (ADR Implemented 후 처리)

본 ADR Implemented 시 ADR-105 Charter 슬롯 상태:

| ADR-105 슬롯        | 대상                             | 상태     | 메모         |
| ------------------- | -------------------------------- | -------- | ------------ |
| F4 TagGroup.css:148 | `@sync Button.css size variants` | **해소** | Phase 1 완료 |
| F4 TagGroup.css:150 | `@sync ButtonSpec.sizes`         | **해소** | Phase 1 완료 |
| F2 Tag.spec.ts:57   | `@sync TagGroup.css 기본 색상`   | **해소** | Phase 2 완료 |
| F2 Tag.spec.ts:65   | `@sync TagGroup.css selected`    | **해소** | Phase 2 완료 |

ADR-105-c (F2 처리 sub-ADR) 착수 시 Tag.spec.ts 2건을 "이미 해소됨 (ADR-106-b)" 으로 skip 처리.
ADR-105-d (F4 처리 sub-ADR) 착수 시 TagGroup.css 2건을 "이미 해소됨 (ADR-106-b)" 으로 skip 처리.

---

## 미뤄둔 과제 (본 ADR scope 밖)

| 과제                                                                   | 우선순위 | 이유                                                                                                                                                  |
| ---------------------------------------------------------------------- | :------: | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button.css ↔ TagGroup.css size variants 공유 primitives 추출           |   LOW    | ADR-105-a (F3 primitives 이관) 완료 후 ButtonSpec.sizes 가 primitives 로 이관되면 TagSpec.sizes 와 공유 상수 가능성 재평가. CSS 측은 여전히 별도 관리 |
| TagSpec.sizes xl borderRadius `radius-xl` vs `radius-lg` 불일치 정당화 |   LOW    | Button xl = `radius-xl`, Tag xl = `radius-lg` — 의도적 차이. spec 주석 추가로 명시                                                                    |
| Tag.spec.ts `@sync Button.css/BUTTON_SIZE_CONFIG` 주석 (lines 74–75)   |   LOW    | sizes 동일성 관계 설명 주석으로 이미 유사 처리. ADR-105-b (F1) 에서 공식 처리                                                                         |
