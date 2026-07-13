# ADR-105-c Breakdown: @sync F2 spec-to-CSS 해소 구현 상세

> **ADR**: [105-c-sync-spec-to-css-resolution.md](../completed/105-c-sync-spec-to-css-resolution.md)
> **스냅샷 날짜**: 2026-04-21

---

## 1. 항목별 처리 매트릭스

| ID   | 파일:라인                  | @sync 원문                                                | 처리 방법      | Phase |
| ---- | -------------------------- | --------------------------------------------------------- | -------------- | ----- |
| F2-1 | `Tag.spec.ts:57`           | `@sync TagGroup.css .react-aria-Tag 기본 색상`            | 완전 해소      | P0    |
| F2-2 | `Tag.spec.ts:65`           | `@sync TagGroup.css .react-aria-Tag[data-selected]`       | 완전 해소      | P0    |
| F2-3 | `SelectValue.spec.ts:47`   | `@sync Select.css font-size per size`                     | 단순 주석 교체 | P1    |
| F2-4 | `ListBox.spec.ts:218`      | `@sync containerStyles.background = {color.raised}`       | 단순 주석 교체 | P1    |
| F2-5 | `ListBox.spec.ts:238`      | `@sync CSS container padding = --spacing-xs = 4`          | 단순 주석 교체 | P1    |
| F2-6 | `GridListItem.spec.ts:107` | `@sync GridList.css padding/gap/border-radius`            | 실질 작업      | P2-a  |
| F2-7 | `ListBoxItem.spec.ts:132`  | `@sync sz.lineHeight = {typography.text-sm--line-height}` | 실질 작업      | P2-b  |

---

## 2. Phase별 작업 상세

### P0: 자연 해소 재확증 (코드 변경 없음)

**대상**: F2-1, F2-2 (Tag.spec.ts)

ADR-106-b에서 TagGroup.css와 Tag.spec.ts 사이의 @sync 2건이 이미 제거됐음을 grep 0건으로 재확증.

```bash
# 검증 명령
rg "@sync" packages/specs/src/components/Tag.spec.ts
# 예상: 0건
```

작업: 없음. Charter 매트릭스에서 F2-1/F2-2를 "ADR-106-b 완결" 상태로 표기 업데이트.

---

### P1: 단순 주석 교체 (주석 수정만, 로직 변경 없음)

#### F2-3: SelectValue.spec.ts:47

**현재**:

```typescript
// @sync Select.css font-size per size
sizes: {
  xs: { ... fontSize: "{typography.text-2xs}" ... },
```

**교체 후**:

```typescript
// Select.spec.ts `composition.sizeSelectors` prefix="select-btn" 이 per-size `--select-btn-font-size` 를 emit.
// `composition.staticSelectors` childSelector=".react-aria-SelectValue" 에서 `font-size: var(--select-btn-font-size)` 연결.
// → CSSGenerator 가 size별 SelectValue font-size 를 자동 emit 중 — @sync 불필요 (ADR-078 childSpec emit 확인).
sizes: {
  xs: { ... fontSize: "{typography.text-2xs}" ... },
```

**근거**: `Select.spec.ts:501,507,513,519,525` 에서 per-size `--select-btn-font-size` emit. `Select.spec.ts:567` 에서 `.react-aria-SelectValue { font-size: var(--select-btn-font-size) }` 연결. SelectValue.spec.ts 의 sizes 는 Skia 렌더링 경로 전용이며 CSS는 Select.spec emit에서 파생됨.

#### F2-4: ListBox.spec.ts:218

**현재**:

```typescript
// @sync containerStyles.background = {color.raised}
// Generator CSS 와 Skia render.shapes 가 동일한 컨테이너 배경(raised)을 사용해야 ...
variants: {
  default: {
    background: "{color.raised}" as TokenRef,
```

**교체 후**:

```typescript
// containerStyles.background = {color.raised} (line 88) — ADR-076/079 완결로 Spec SSOT 선언됨.
// Generator CSS 와 Skia render.shapes 가 동일한 컨테이너 배경(raised)을 사용해야 ...
variants: {
  default: {
    background: "{color.raised}" as TokenRef,
```

**근거**: `ListBox.spec.ts:88` — `containerStyles: { background: "{color.raised}" }` 이미 선언. ADR-076 Phase 2 완결 사실을 확인.

#### F2-5: ListBox.spec.ts:238

**현재**:

```typescript
// @sync CSS container padding = `--spacing-xs` = 4 (containerStyles.padding 과 일치)
// 프로젝트 관례 (Menu/MenuItem/Select): ...
sizes: {
  md: {
    ...
    paddingX: 4,
    paddingY: 4,
```

**교체 후**:

```typescript
// containerStyles.padding = {spacing.xs} = 4 (line 93) — ADR-078 Phase 3 완결로 Spec SSOT 선언됨.
// 프로젝트 관례 (Menu/MenuItem/Select): ...
sizes: {
  md: {
    ...
    paddingX: 4,
    paddingY: 4,
```

**근거**: `ListBox.spec.ts:93` — `containerStyles: { padding: "{spacing.xs}" }` 이미 선언. ADR-078 Phase 3 SSOT 완결.

---

### P2-a: GridListItem borderRadius 삼자 정합 (실질 작업)

**현재 불일치**:
| 경로 | 값 | 변수/참조 |
|---|---|---|
| `GridListItemSpec.sizes.md.borderRadius` | `{radius.sm}` = **4px** | Spec 선언 |
| `resolveGridListItemMetric(fontSize>12).cardBorderRadius` | **8** (하드코딩) | Skia/layout 소비 |
| `GridList.css .react-aria-GridListItem border-radius` | `var(--radius-md)` = **6px** | CSS preview 소비 |

**목표**: 세 경로 모두 **8px** (`{radius.lg}`) 기준으로 통일.

이유: resolver가 실제 렌더링에 오랫동안 8px을 사용해왔고 사용자가 기대하는 시각이 8px 수준임. Spec은 초기 선언 오류(`{radius.sm}`=4px).

**변경 파일**:

1. `packages/specs/src/components/GridListItem.spec.ts` — Spec borderRadius 수정

   ```typescript
   // Before
   borderRadius: "{radius.sm}" as TokenRef,

   // After
   borderRadius: "{radius.lg}" as TokenRef,
   ```

2. `packages/specs/src/components/GridListItem.spec.ts` — 파일 주석 오류 수정

   ```typescript
   // Before (line 38)
   *   - borderRadius {radius.sm} = 8px (fontSize=14 기준. fontSize>14 분기는 resolver 내부 12px).

   // After
   *   - borderRadius {radius.lg} = 8px (fontSize=14 기준. fontSize>14 분기는 resolver 내부 12px).
   ```

3. `packages/specs/src/components/GridListItem.spec.ts` — @sync 제거 + 설명 주석 교체

   ```typescript
   // Before (line 107)
   * @sync GridList.css `.react-aria-GridListItem` padding/gap/border-radius (fontSize=14 경로 동기화).

   // After
   * fontSize=14 기준값: sizes.md.paddingX/Y = CSS `var(--spacing-md)/var(--spacing-lg)` (12/16) 정합.
   * gap=2 = CSS `var(--spacing-2xs)` 정합. borderRadius={radius.lg}=8px = CSS `var(--radius-lg)` 정합.
   * fontSize>14/>12 분기는 resolveGridListItemMetric 내부에서 처리 (cardBorderRadius 12/8/8).
   ```

4. `packages/shared/src/components/styles/GridList.css` — CSS border-radius 수정

   ```css
   /* Before */
   border-radius: var(--radius-md);

   /* After */
   border-radius: var(--radius-lg);
   ```

**검증**:

```bash
rg "@sync" packages/specs/src/components/GridListItem.spec.ts
# 예상: 0건

rg "radius-md" packages/shared/src/components/styles/GridList.css
# 예상: 0건 (border-radius 부분만 변경, 다른 radius-md 사용 없음 확인)
```

---

### P2-b: ListBoxItem resolver Spec 소비 전환 (실질 작업)

**현재 구조**:

```typescript
// packages/specs/src/components/ListBoxItem.spec.ts:77
sizes: {
  md: {
    lineHeight: "{typography.text-sm--line-height}" as TokenRef,  // Spec SSOT 존재
    ...
  },
},

// line 131-134 (resolver)
const sz = ListBoxItemSpec.sizes.md;
// @sync sz.lineHeight = {typography.text-sm--line-height} — fontSize 기반 resolve
const lineHeight =
  fontSize <= 12 ? 16 : fontSize <= 14 ? 20 : fontSize <= 16 ? 24 : 28;  // 하드코딩
```

**문제**: `sz.lineHeight`를 선언해두고 실제로는 하드코딩 분기를 사용. fontSize 기반 분기가 typography 토큰과 맞는지 수동으로 확인해야 하는 구조.

**변경 방향**: `sz.lineHeight`는 TokenRef(`{typography.text-sm--line-height}`)이므로 `resolveToken()`으로 변환 후 사용. 단, `resolveListBoxItemMetric`은 fontSize 기반으로 다중 lineHeight를 계산하는 구조 — `sz.lineHeight`는 md 기준 하나의 값만 있으므로 완전 대체는 불가. 대신 @sync 주석 제거 + 설명 주석으로 구조를 명확히 서술.

```typescript
// Before
const sz = ListBoxItemSpec.sizes.md;
// @sync sz.lineHeight = {typography.text-sm--line-height} — fontSize 기반 resolve
const lineHeight =
  fontSize <= 12 ? 16 : fontSize <= 14 ? 20 : fontSize <= 16 ? 24 : 28;

// After
const sz = ListBoxItemSpec.sizes.md;
// fontSize 기반 lineHeight 분기: CSS `var(--text-{size}--line-height)` 기본값 매핑.
// xs(≤12)→16 / sm(≤14)→20 / base(≤16)→24 / lg(>16)→28.
// sz.lineHeight ({typography.text-sm--line-height}) 는 md 고정 참조 — Spec SSOT 확인용.
// fontSize 다중 분기가 필요하므로 resolver 내부 하드코딩 유지 (Spec에서 fontSize별 lineHeight 미선언).
const lineHeight =
  fontSize <= 12 ? 16 : fontSize <= 14 ? 20 : fontSize <= 16 ? 24 : 28;
```

**참고**: 완전한 Spec 소비(resolver 하드코딩 제거)를 위해서는 `ListBoxItemSpec.sizes`에 xs/sm/base/lg 다중 lineHeight 선언이 필요. 이는 ADR-105-d 또는 별도 ADR에서 처리. 본 P2-b는 @sync 경고 제거 + 현황 문서화에 집중.

**검증**:

```bash
rg "@sync" packages/specs/src/components/ListBoxItem.spec.ts
# 예상: 0건
```

---

## 3. 전체 실행 순서

```
P0: Tag.spec.ts grep 재확증 (0건 — 코드 변경 없음)
  ↓
P1: SelectValue.spec.ts:47 + ListBox.spec.ts:218,238 주석 교체 (3건)
  ↓
P2-a: GridListItem borderRadius 삼자 정합 (Spec + CSS + 주석)
  ↓
P2-b: ListBoxItem resolver 설명 주석 교체 (@sync 제거 + 현황 서술)
  ↓
검증: type-check 3/3 + specs PASS + builder PASS + /cross-check GridList
```

---

## 4. 검증 체크리스트

```bash
# F2 전체 @sync 0건 확인
rg "@sync" packages/specs/src/components/Tag.spec.ts
rg "@sync" packages/specs/src/components/SelectValue.spec.ts
rg "@sync" packages/specs/src/components/ListBox.spec.ts
rg "@sync" packages/specs/src/components/GridListItem.spec.ts
rg "@sync" packages/specs/src/components/ListBoxItem.spec.ts

# 빌드 통과
pnpm type-check
pnpm build:specs

# GridListItem Skia ↔ CSS 시각 정합 확인 (border-radius 8px 일치)
# /cross-check GridListItem 실행 권장
```

---

## 5. Charter 매트릭스 업데이트 필요 항목

ADR-105 구현 완료 후 `docs/adr/design/105-sync-annotation-audit-charter-breakdown.md` §4 자연 해소 후보 표에 아래 추가:

| #   | 파일:라인                  | 완결 ADR  | 완결 날짜  | 상태                        |
| --- | -------------------------- | --------- | ---------- | --------------------------- |
| 16  | `Tag.spec.ts:57`           | ADR-106-b | 2026-04-21 | 완전 해소                   |
| 17  | `Tag.spec.ts:65`           | ADR-106-b | 2026-04-21 | 완전 해소                   |
| 15  | `SelectValue.spec.ts:47`   | ADR-105-c | 2026-04-21 | 자연 해소 확증 + 주석 교체  |
| 12  | `ListBox.spec.ts:218`      | ADR-105-c | 2026-04-21 | 자연 해소 확증 + 주석 교체  |
| 13  | `ListBox.spec.ts:238`      | ADR-105-c | 2026-04-21 | 자연 해소 확증 + 주석 교체  |
| 11  | `GridListItem.spec.ts:107` | ADR-105-c | 2026-04-21 | 삼자 정합 + @sync 삭제      |
| 14  | `ListBoxItem.spec.ts:132`  | ADR-105-c | 2026-04-21 | @sync 삭제 + 설명 주석 교체 |
