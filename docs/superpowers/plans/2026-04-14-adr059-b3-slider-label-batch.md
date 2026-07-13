# ADR-059 v2.1 Phase 4 — B3 Slider Family + Label Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. 이번 plan은 B1/B2 선례 검증된 inline 실행 권장(agent truncation 반복 회피).

**Goal:** ADR-059 v2.1 Phase 4 재설계의 B3 batch — Slider family(4 컴포넌트) + Label (1 컴포넌트) wrapper variant prop + 수동 CSS 해체. B0.2 판정 전부 (i-a) 순수 제거.

**Architecture:** Slider family 원자적 commit (parent + 3 compound children), Label 독립 commit. B1/B2 선례 동일 패턴.

**Tech Stack:** TypeScript 5, pnpm monorepo, CSSGenerator.

**Source ADR:** [059 §Phase 4 재설계](../../adr/completed/059-composite-field-skip-css-dismantle.md)
**Source breakdown:** [059 breakdown](../../adr/design/completed/059-composite-field-skip-css-dismantle-breakdown.md) Per-Component 표
**선행 선례:** B1 PR #208 (11 컴포넌트), B2 PR #207 (5 컴포넌트, Card isQuiet)

---

## 대상 + B0.2 판정

| #     | Component           | B0.2 분기     | RSP 대체                                      | Spec.variants          | Wrapper                                  | 수동 CSS                   |
| ----- | ------------------- | ------------- | --------------------------------------------- | ---------------------- | ---------------------------------------- | -------------------------- |
| B3.1a | **Slider** (parent) | (i-a)         | isFilled/fillOffset/trackGradient/orientation | default/accent/neutral | yes (SelectionRenderers.tsx:1264)        | Slider.css (index.css:159) |
| B3.1b | **SliderTrack**     | (i-a) inherit | —                                             | default/accent/neutral | inherit                                  | (부모 Slider.css)          |
| B3.1c | **SliderOutput**    | (i-a) inherit | —                                             | default/accent/neutral | inherit                                  | (부모 Slider.css)          |
| B3.1d | **SliderThumb**     | (i-a) inherit | —                                             | default/accent/neutral | inherit                                  | (부모 Slider.css)          |
| B3.2  | **Label**           | (i-a)         | (RSP 없음, native `<label>`)                  | default/accent/neutral | yes (FormRenderers.tsx:430 data-variant) | Label.css (index.css:75)   |

---

## 공통 해체 템플릿 ([T-A]~[T-G])

B1/B2에서 검증된 시퀀스:

```
[T-A] 스냅샷: spec variants, wrapper variant prop, manual CSS lines
[T-B] Spec 편집:
      - skipCSSGeneration: true → false
      - variants 필드 제거 (또는 dead default 1개만 유지)
      - Props.variant 타입 제거
      - defaultVariant 제거
      - render.shapes 내 variants 참조 상수화 (Slot B1.8 / Dialog B2.4 선례)
[T-C] Renderer 편집: JSX variant/data-variant 속성 전달 제거
[T-D] 수동 CSS 삭제:
      - git rm packages/shared/src/components/styles/{Name}.css
      - {Name}.tsx 또는 index.css import 경로 './generated/{Name}.css'로 전환
[T-E] Consumer sweep: unified.types.ts variant union 제거, JSX 호출지
[T-F] pnpm build:specs + pnpm type-check
[T-G] Commit (원자적)
```

---

## Phase B3.0 — Worktree

- [ ] **Step 1: 현재 main 최신 pull**

```bash
cd /Users/admin/work/composition
git checkout main && git pull
```

- [ ] **Step 2: worktree 생성**

```bash
git worktree add .worktrees/adr-059-b3-slider-label -b feature/adr-059-b3-slider-label
cd .worktrees/adr-059-b3-slider-label
pnpm install 2>&1 | tail -3
pnpm type-check 2>&1 | tail -5
```

PASS 기대.

---

## Task B3.1: Slider family 해체 (parent + 3 compound children 원자적)

**Files:**

- Modify: `packages/specs/src/components/Slider.spec.ts`
- Modify: `packages/specs/src/components/SliderTrack.spec.ts`
- Modify: `packages/specs/src/components/SliderOutput.spec.ts`
- Modify: `packages/specs/src/components/SliderThumb.spec.ts`
- Modify: `packages/shared/src/renderers/SelectionRenderers.tsx:1264` (renderSlider variant 제거)
- Delete: `packages/shared/src/components/styles/Slider.css`
- Modify: `packages/shared/src/components/styles/index.css:159` (Slider import 갱신 또는 제거)
- Consumer sweep: `apps/builder/src/types/builder/unified.types.ts` Slider family variant union

**이유 원자적**: Slider 4 컴포넌트가 compound family (children renderer 없음, 부모 propagation). 분리 commit 시 중간 상태에서 시각 비대칭.

### Step 1: [T-A] 스냅샷

```bash
cd /Users/admin/work/composition/.worktrees/adr-059-b3-slider-label
for name in Slider SliderTrack SliderOutput SliderThumb; do
  echo "=== $name ==="
  grep -n "skipCSSGeneration\|variants\|defaultVariant" packages/specs/src/components/$name.spec.ts | head -8
done
wc -l packages/shared/src/components/styles/Slider.css
grep -n "Slider" packages/shared/src/components/styles/index.css
grep -n "import.*Slider" packages/shared/src/components/Slider.tsx 2>/dev/null
grep -rn "Slider.*variant=\|SliderProps\|SliderTrackProps\|SliderOutputProps\|SliderThumbProps" apps/builder/src/types/ --include="*.ts" | head
```

### Step 2: [T-B] 4 Spec 편집 (순차)

각 4개 spec 파일에서:

1. `skipCSSGeneration: true` → `false`
2. Props interface `variant?:` 타입 제거
3. `defaultVariant: "default"` 제거
4. `variants: { default, accent, neutral }` 처리:
   - render.shapes에서 variants 참조하는 경우 → 상수 치환 (`const SLIDER_DEFAULTS = {...}`)
   - 참조 없는 경우 → 직접 제거

### Step 3: [T-C] renderSlider 편집

`packages/shared/src/renderers/SelectionRenderers.tsx:1264-1266`:

```diff
-      variant={
-        (element.props.variant as "default" | "accent" | "neutral") || "default"
-      }
```

해당 3줄 제거. 다른 props(orientation/size/value 등)는 유지.

### Step 4: [T-D] 수동 CSS 삭제

```bash
git rm packages/shared/src/components/styles/Slider.css
```

index.css:159 `@import "./Slider.css"` → `@import "./generated/Slider.css"` (또는 주변 주석 제거 포함).

Slider family children(SliderTrack/Output/Thumb)은 별도 manual CSS 없음(Slider.css에 통합) — generated가 새로 등장할 수 있음. index.css에 생성 여부 따라 추가 import 필요성 확인.

### Step 5: [T-E] Consumer sweep

```bash
grep -rn "variant=.*default.*accent.*neutral\|variant\?:.*default.*accent.*neutral" apps/builder/src/types/ --include="*.ts"
grep -rn "Slider.*variant=" apps/ packages/ --include="*.tsx"
```

unified.types.ts의 Slider/SliderTrack/SliderOutput/SliderThumb variant union 발견 시 제거. JSX 호출지 수정.

### Step 6: [T-F] 검증

```bash
pnpm build:specs 2>&1 | tail -5
pnpm type-check 2>&1 | tail -5
ls packages/shared/src/components/styles/generated/{Slider,SliderTrack,SliderOutput,SliderThumb}.css
```

4 generated CSS 존재 확인.

### Step 7: [T-G] Commit

```bash
git add packages/specs/src/components/{Slider,SliderTrack,SliderOutput,SliderThumb}.spec.ts \
        packages/shared/src/renderers/SelectionRenderers.tsx \
        packages/shared/src/components/styles/index.css \
        packages/shared/src/components/styles/generated/{Slider,SliderTrack,SliderOutput,SliderThumb}.css \
        apps/builder/src/types/builder/unified.types.ts

git rm packages/shared/src/components/styles/Slider.css 2>/dev/null || true  # 이미 삭제됨

git commit -m "$(cat <<'EOF'
refactor(adr-059): B3.1 Slider family — variant prop 제거 + 수동 CSS 삭제

- 4 컴포넌트 (Slider + SliderTrack + SliderOutput + SliderThumb) 일괄 해체
- Spec.variants 제거 (default/accent/neutral), Props.variant 타입 제거, defaultVariant 제거
- render.shapes variants 참조 → SLIDER_DEFAULTS 상수 치환
- renderSlider variant prop 전달 제거 (SelectionRenderers.tsx:1264)
- 수동 Slider.css 삭제 → 4 generated CSS 신규
- unified.types.ts Slider family variant union 제거
- Cell (i-a, B0.2): RSP 공식 isFilled/fillOffset/trackGradient/orientation만 존재, variant 개념 없음

Visual change: default/accent/neutral 색상 변형 제거 → default 단일 스타일. 사용자 custom color는 theme accent 활용.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task B3.2: Label 해체

**Files:**

- Modify: `packages/specs/src/components/Label.spec.ts`
- Modify: `packages/shared/src/renderers/FormRenderers.tsx:403+` renderLabel (span fallback data-variant + 정상 Label path)
- Delete: `packages/shared/src/components/styles/Label.css`
- Modify: `packages/shared/src/components/styles/index.css:75` (manual Label.css import 제거, generated/Label.css는 이미 74번 import됨)
- Consumer sweep

### Step 1: [T-A] 스냅샷

```bash
grep -n "skipCSSGeneration\|variants\|defaultVariant" packages/specs/src/components/Label.spec.ts | head -8
wc -l packages/shared/src/components/styles/Label.css
grep -n "Label" packages/shared/src/components/styles/index.css | head
grep -n "variant\|data-variant" packages/shared/src/renderers/FormRenderers.tsx | grep -iE "label|^4[0-5][0-9]" | head
grep -rn "<Label.*variant=\|LabelProps\|LabelElementProps" apps/ packages/ --include="*.tsx" --include="*.ts" | head
```

### Step 2: [T-B] Spec 편집 — 주의: Label은 LABEL_SIZE_STYLE 등 canvas-rendering 규칙 참조

rules/canvas-rendering.md "Label size delegation" 섹션 준수:

- LabelSpec 단일 소스 (lineHeight 포함 유지)
- LABEL_DELEGATION_PARENT_TAGS 전파 경로 유지
- variants 제거하되 render 토큰 참조는 상수화

편집:

- `skipCSSGeneration: true` → `false`
- `LabelProps.variant?:` 제거
- `defaultVariant` 제거
- `variants` 블록 제거 → render.shapes에서 상수 치환

### Step 3: [T-C] Renderer 편집

FormRenderers.tsx renderLabel:

- span fallback의 `data-variant={...}` 라인 제거 (line ~430)
- 정상 Label 반환 path에도 동일하게 `data-variant` 또는 `variant` 전달 있으면 제거

grep으로 두 지점 모두 확인 후 제거.

### Step 4: [T-D] 수동 CSS 삭제

```bash
git rm packages/shared/src/components/styles/Label.css
```

index.css:

```diff
 @import "./generated/Label.css";
-@import "./Label.css";
```

(generated 이미 등록됐으므로 manual 라인만 제거)

### Step 5: [T-E] Consumer sweep

unified.types.ts 에서 `LabelElementProps.variant` 또는 관련 union 제거. JSX `<Label variant=...>` 호출지 제거.

### Step 6: [T-F] 검증

```bash
pnpm build:specs 2>&1 | tail -5
pnpm type-check 2>&1 | tail -5
ls packages/shared/src/components/styles/generated/Label.css
```

### Step 7: [T-G] Commit

```bash
git commit -m "$(cat <<'EOF'
refactor(adr-059): B3.2 Label — variant prop 제거 + 수동 CSS 삭제

- Spec.variants 제거 (default/accent/neutral), LabelProps.variant 타입 제거
- render.shapes variants 참조 → LABEL_DEFAULTS 상수 치환 (canvas-rendering.md §Label 규칙 준수)
- renderLabel data-variant 속성 제거 (span fallback + 정상 path)
- 수동 Label.css 삭제 (generated/Label.css 이미 index.css 등록됨)
- unified.types.ts LabelProps variant 제거
- Cell (i-a, B0.2): RSP/RAC Label에 variant 개념 없음 (native label 래퍼)

Visual change: text color 3변형 제거 → default (neutral) 단일 스타일.

LabelSpec 단일 소스 규칙(LABEL_SIZE_STYLE, lineHeight, DELEGATION_PARENT_TAGS) 유지.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task B3.3: Gate + PR

### Step 1: 지표 검증

```bash
grep -rn "skipCSSGeneration:\s*true" packages/specs/src/components/ --include="*.ts" | wc -l
# 기대: B2 머지 후 main 기준 -5 감소
ls packages/shared/src/components/styles/{Slider,Label}.css 2>&1
# 모두 "No such file"
ls packages/shared/src/components/styles/generated/{Slider,SliderTrack,SliderOutput,SliderThumb,Label}.css
# 5개 전부 존재
pnpm type-check 2>&1 | tail -3
```

### Step 2: breakdown docs 갱신

`docs/adr/design/059-composite-field-skip-css-dismantle-breakdown.md`에 "B3 실행 결과" 섹션 추가(B1/B2 섹션 사이 또는 B2 뒤).

내용:

- 2 commits (Slider family, Label)
- skipCSSGeneration -5, 수동 CSS 2개 삭제, generated 5개 신규
- Visual regressions: Slider 색상 3변형 / Label 색상 3변형 → default 통합

### Step 3: Commit docs + push

```bash
git add docs/adr/design/059-composite-field-skip-css-dismantle-breakdown.md
git commit -m "docs(adr-059): B3 실행 결과 표기"
git push -u origin feature/adr-059-b3-slider-label
```

### Step 4: PR 생성 (수동, 브라우저)

**Title**: `ADR-059 v2.1 B3 — Slider family + Label variant 제거`

**Body 핵심**:

- Summary (지표)
- Components Dismantled 테이블 (5개)
- Visual regressions (Slider/Label 색상 3변형 통합)
- Breaking API (`<Slider variant=...>` / `<Label variant=...>` 호출지 정리)
- Refs (ADR/breakdown/plan/B1 PR#208/B2 PR#207)
- Next: B4 (Container/Display composite ~12개)

---

## Self-Review

- [x] Spec coverage: 5 컴포넌트 전부 (Slider parent + 3 children + Label)
- [x] Placeholder 없음
- [x] File paths 확정 (discovery 결과 기반)
- [x] Atomic commit 정책 (Slider family 1 commit, Label 1 commit)
- [x] Gate 측정 가능

### 알려진 공백

- Slider children (Track/Output/Thumb) manual CSS가 Slider.css에 통합돼 있으므로 generated 생성 여부 실측 필요
- Label의 LABEL_SIZE_STYLE / DELEGATION 규칙 보존 — render.shapes 상수화 시 세부 변형 조심
- B2 merge 후 main의 index.css 상태에서 Label 이미 `./generated/Label.css` import됨 → Manual만 제거

---

## 실행 옵션

**1. Inline execution (권장)** — B1/B2에서 agent truncation 30 tool_use 제한 반복 문제로 inline 마감이 더 효율. 2 tasks × ~6 steps = 12단계.

**2. Subagent-Driven** — 필요 시 Slider family(복잡) 1 agent + Label(단순) 1 agent.

**어느 쪽으로 진행할까요?**
