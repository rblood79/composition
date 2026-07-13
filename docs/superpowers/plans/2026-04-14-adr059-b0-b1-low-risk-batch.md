# ADR-059 v2.1 Phase 4 — B0 + B1 Low-Risk Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ADR-059 v2.1 Phase 4 재설계의 저위험 선행 batch 두 묶음을 완수 — B0(RSP 대조 + cell verify 해제) + B1(dead/desync ≈11개 해체).

**Architecture:** 4-Cell 매트릭스 판정(SSOT 정본 `.claude/rules/ssot-hierarchy.md` D2/D3 축 분리) 기반. B0는 데이터 수집+breakdown 갱신만, B1는 dead variant 삭제 + wrapper variant prop 제거 + skipCSSGeneration:false 전환 + 수동 CSS 정리. ADR-062 Field 선례와 동일한 해체 패턴.

**Tech Stack:** TypeScript 5, pnpm monorepo, Vite, CSSGenerator auto-emit (`packages/specs/src/renderers/CSSGenerator.ts`), React Aria Components, Skia WASM.

**Source ADR:** [docs/adr/059-composite-field-skip-css-dismantle.md](../../adr/completed/059-composite-field-skip-css-dismantle.md) § "Phase 4 재설계 (v2.1 amendment)"
**Source breakdown:** [docs/adr/design/059-composite-field-skip-css-dismantle-breakdown.md](../../adr/design/completed/059-composite-field-skip-css-dismantle-breakdown.md) § "Per-Component Target 표"

---

## 공통 개념

### 해체 표준 시퀀스 (B1 각 컴포넌트에 적용)

```
[Step A] Read spec — skipCSSGeneration/variants/wrapper props 현 상태 확인
[Step B] Edit spec — variants dead 삭제 + skipCSSGeneration: false
[Step C] Edit renderer — wrapper의 variant prop/data-variant 제거 (해당 시)
[Step D] Delete manual CSS — packages/shared/src/components/styles/{Name}.css (존재 시)
[Step E] Edit styles/index.css — 해당 import 제거 (존재 시)
[Step F] Run: pnpm build:specs && pnpm type-check
[Step G] Run: pnpm dev (Storybook/Preview 실측 검증)
[Step H] Commit
```

### 대상 컴포넌트 재확인 (breakdown 표 발췌)

| #   | Component         | Cell              |         수동 CSS         |    Wrapper variant     | 처리          |
| --- | ----------------- | ----------------- | :----------------------: | :--------------------: | ------------- |
| 1   | Slot              | (i-dead)          |       ✅ Slot.css        | SlotProps.variant 타입 | D,E,C         |
| 2   | TabList           | (i-dead)          |            ❌            | TabList renderer check | C             |
| 3   | Tab               | (iii-dead)        |            ❌            |           —            | B만           |
| 4   | Tabs              | (iii-dead)        |       ✅ Tabs.css        |           —            | B,D,E         |
| 5   | Breadcrumb        | (iii-dead→iv)     |            ❌            |           —            | B만           |
| 6   | ToggleButtonGroup | (iii-dead verify) | ✅ ToggleButtonGroup.css |         verify         | B0,B,C,D,E    |
| 7   | Accordion         | (iv)              |            ❌            |           —            | B만           |
| 8   | DisclosureHeader  | (iv)              |            ❌            |           —            | B만           |
| 9   | TailSwatch        | (iv)              |            ❌            |           —            | B만           |
| 10  | Modal             | (iv verify)       |       ✅ Modal.css       |         verify         | B0,B,D,E,(C?) |
| 11  | TabPanels         | (ii verify)       |            ❌            |         verify         | B0,C          |

### Verify 필요 항목 (B0에서 해제)

- Slot wrapper variant 노출 경로 정밀 확인 (SlotProps.variant 타입 정의 + renderSlot 미전달 → 실제 JSX 노출 여부 판정)
- Modal wrapper variant prop (agent: no / memory: yes)
- ToggleButtonGroup wrapper variant prop (agent: no / memory: data-togglebutton-variant)
- TabPanels wrapper variant prop (agent: yes / spec.variants: 없음 — (ii) cell 확정 여부)

---

## Phase B0 — RSP 대조 + Verify 해제

### Task B0.1: B1 verify 4종 wrapper 노출 경로 재확인

**Files:**

- Read: `packages/specs/src/components/Slot.spec.ts` (이미 확인 — SlotProps.variant: "default", renderSlot 미전달)
- Read: `packages/shared/src/renderers/LayoutRenderers.tsx:1000-1100` (renderModal)
- Read: `packages/shared/src/renderers/LayoutRenderers.tsx:272-330` (renderTabPanels)
- Read: `packages/shared/src/renderers/CollectionRenderers.tsx:645-750` (renderToggleButtonGroup)
- Read: `packages/specs/src/components/Modal.spec.ts`, `TabPanels.spec.ts`, `ToggleButtonGroup.spec.ts` (props 인터페이스 variant 타입 존재 여부)

- [ ] **Step 1: Modal renderer + spec 확인**

Run:

```bash
grep -n "variant\|data-variant" packages/shared/src/renderers/LayoutRenderers.tsx | sed -n '1,200p'
```

확인: `renderModal` 함수 내부 JSX에 `variant=` 또는 `data-variant=` 속성이 존재하는가? Modal.spec.ts의 props interface에 `variant?:` 타입이 존재하는가?

예상 결과: Modal은 variant prop 전달 없음 (iv 확정). 존재 시 (ii) 재분류 및 breakdown 갱신.

- [ ] **Step 2: TabPanels renderer + spec 확인**

Run:

```bash
grep -n "variant" packages/shared/src/renderers/LayoutRenderers.tsx | grep -i "tabpanel"
grep -n "variant" packages/specs/src/components/TabPanels.spec.ts
```

예상 결과: spec에 variants 없음 + renderer 미전달 → (iv) 재분류. Agent의 "wrapper_variant=yes" 보고 반증.

- [ ] **Step 3: ToggleButtonGroup renderer 확인**

Run:

```bash
grep -n "variant\|data-togglebutton-variant" packages/shared/src/renderers/CollectionRenderers.tsx | sed -n '1,50p'
grep -n "data-togglebutton-variant" apps/builder/src packages/shared/src -r
```

확인: 메모리 기록 "data-togglebutton-variant (primary/secondary/tertiary/error/surface)" 가 실제 renderer/CSS에 존재하는가? Spec.ToggleButtonGroup.variants는 "default" 단일 — 존재하면 desync.

- [ ] **Step 4: Slot 노출 경로 판정 최종 확정**

Slot은 SlotProps.variant: "default" 타입 선언 + renderSlot 미전달 상태. 사용자 JSX(`<Slot variant="default"/>`)에서 접근 가능하지만 renderer에서 주입 없음 → 실질 "dead type declaration".

판정: (i-dead) 유지. B1에서 spec variants 제거 + props interface variant 타입 제거 양측 삭제.

- [ ] **Step 5: Verify 결과 breakdown 갱신**

Edit `docs/adr/design/059-composite-field-skip-css-dismantle-breakdown.md` Per-Component 표에서 Modal/TabPanels/ToggleButtonGroup cell 칸의 "verify" 표기를 실제 판정 결과로 치환.

- [ ] **Step 6: Commit**

```bash
git add docs/adr/design/059-composite-field-skip-css-dismantle-breakdown.md
git commit -m "docs(adr-059): B0 verify — Modal/TabPanels/ToggleButtonGroup cell 확정

- Modal: (iv) 확정 (wrapper prop 없음)
- TabPanels: (iv) 재분류 (Agent 오보 정정)
- ToggleButtonGroup: [결과에 따라]
- Slot: (i-dead) 유지 (SlotProps.variant 타입 dead declaration)"
```

### Task B0.2: (i) cell 10개 RSP 공식 props 대조

**Scope:** (i) 셀 컴포넌트의 RSP 공식 props 수집. 이번 B0 범위에서는 **B1 실행에 영향 없음** (B1는 dead/desync 전용). **B2+ 진입 전 필수** 데이터.

대상: Card, Dialog, Disclosure, DropZone, Label, Menu, Slider, ColorWheel, ColorSlider, ColorPicker

- [ ] **Step 1: WebFetch — Card RSP props**

Fetch: `https://react-spectrum.adobe.com/s2/Card.html` (또는 검색 기반)
기록 위치: breakdown 표의 Card 행 Wrapper API target 열에 RSP 공식 prop 목록 appends. 예: "RSP: variant 없음, size/density 있음".

- [ ] **Step 2~10: 나머지 9개 동일 패턴 반복**

각 컴포넌트마다 RSP 공식 페이지 fetch → breakdown의 Wrapper API target 열 업데이트.

- [ ] **Step 11: Commit — B0.2 완료**

```bash
git add docs/adr/design/059-composite-field-skip-css-dismantle-breakdown.md
git commit -m "docs(adr-059): B0 — (i) cell 10 컴포넌트 RSP props 대조 완료"
```

---

## Phase B1 — Dead/Desync 해체 (≈11 컴포넌트)

### 공통 사전 체크

- [ ] **Step: worktree 진입 확인**

Run: `git worktree list && git branch --show-current`
예상: `feature/adr-059-b1-low-risk` 브랜치 (없으면 생성)

```bash
git checkout -b feature/adr-059-b1-low-risk
```

### Task B1.1: Breadcrumb 해체 (iv 기준, 최소 회귀)

**Files:**

- Modify: `packages/specs/src/components/Breadcrumb.spec.ts:36` — `skipCSSGeneration: true` → `false`
- Modify: `packages/specs/src/components/Breadcrumb.spec.ts:38-49` — dead variant 정리 (`default` 1개 유지 — 시각 토큰 참조 필요 시)

- [ ] **Step 1: Read 현재 상태**

```bash
grep -n "skipCSSGeneration\|variants\|defaultVariant" packages/specs/src/components/Breadcrumb.spec.ts
```

확인: `skipCSSGeneration: true` (line 36), variants.default 단일 키.

- [ ] **Step 2: Edit spec — skipCSSGeneration 전환**

Edit `packages/specs/src/components/Breadcrumb.spec.ts`:

- `skipCSSGeneration: true,` → `skipCSSGeneration: false,`

variants는 render.shapes에서 token 참조에 사용되므로 유지.

- [ ] **Step 3: build:specs 실행 + generated CSS 검토**

```bash
pnpm build:specs
ls packages/shared/src/components/styles/generated/Breadcrumb.css
cat packages/shared/src/components/styles/generated/Breadcrumb.css
```

생성된 CSS가 `.react-aria-Breadcrumbs` 또는 유사 셀렉터에 대한 background/color 룰을 올바르게 포함하는지 확인.

- [ ] **Step 4: type-check**

```bash
pnpm type-check
```

PASS 기대.

- [ ] **Step 5: Preview 실측 검증**

```bash
pnpm dev
```

브라우저에서 Builder 페이지 → Breadcrumb 추가 → 시각적 회귀 없음 확인 (텍스트 색상, hover 상태).

- [ ] **Step 6: /cross-check (Skia ↔ CSS 대칭)**

Run: `/cross-check Breadcrumb`

통과 기대: Skia 렌더와 Preview CSS 시각 일치.

- [ ] **Step 7: Commit**

```bash
git add packages/specs/src/components/Breadcrumb.spec.ts packages/shared/src/components/styles/generated/Breadcrumb.css
git commit -m "refactor(adr-059): B1 Breadcrumb skipCSSGeneration:false

- Breadcrumb spec → spec-generated CSS
- D3 대칭 복귀 (수동 CSS 0건)
- Cell (iv): wrapper variant prop 없음, dead variants 삭제 불필요"
```

### Task B1.2: Accordion 해체 (iv)

**Files:**

- Modify: `packages/specs/src/components/Accordion.spec.ts` — `skipCSSGeneration: true` → `false`

- [ ] **Step 1~6: Task B1.1 시퀀스 (Step 2~7) 동일 반복 — Accordion 대상**

구체:

1. `grep -n "skipCSSGeneration\|variants" packages/specs/src/components/Accordion.spec.ts`
2. Edit: `skipCSSGeneration: true` → `false`
3. `pnpm build:specs` + generated CSS 검토
4. `pnpm type-check`
5. `pnpm dev` 실측
6. `/cross-check Accordion`
7. Commit: `refactor(adr-059): B1 Accordion skipCSSGeneration:false`

### Task B1.3: DisclosureHeader 해체 (iv)

**Files:**

- Modify: `packages/specs/src/components/DisclosureHeader.spec.ts` — `skipCSSGeneration: true` → `false`

- [ ] Task B1.1 동일 시퀀스 — DisclosureHeader 대상.

Commit msg: `refactor(adr-059): B1 DisclosureHeader skipCSSGeneration:false`

### Task B1.4: TailSwatch 해체 (iv)

**Files:**

- Modify: `packages/specs/src/components/TailSwatch.spec.ts` — `skipCSSGeneration: true` → `false`

- [ ] Task B1.1 동일 시퀀스 — TailSwatch 대상.

Commit msg: `refactor(adr-059): B1 TailSwatch skipCSSGeneration:false`

### Task B1.5: Tab 해체 (iii-dead)

**Files:**

- Modify: `packages/specs/src/components/Tab.spec.ts` — `skipCSSGeneration: true` → `false`, dead `variants.default` 단일 키 유지 (render.shapes 참조).

- [ ] Task B1.1 동일 시퀀스 — Tab 대상.

Commit msg: `refactor(adr-059): B1 Tab skipCSSGeneration:false (dead variants unchanged)`

### Task B1.6: TabList 해체 (i-dead — wrapper variant prop 제거)

**Files:**

- Modify: `packages/specs/src/components/TabList.spec.ts` — `skipCSSGeneration: true` → `false`
- Modify: `packages/shared/src/renderers/LayoutRenderers.tsx:261-270` — `renderTabList` 내부 `variant` prop 전달 제거 (grep으로 확인 후)

- [ ] **Step 1: Read — renderTabList wrapper 검사**

```bash
sed -n '261,290p' packages/shared/src/renderers/LayoutRenderers.tsx
```

variant prop 전달 지점 확인.

- [ ] **Step 2: Edit renderer — variant prop 제거**

해당 JSX 라인에서 `variant={...}` 또는 `data-variant={...}` 속성 제거.

- [ ] **Step 3~7: Task B1.1 Step 2~7 시퀀스 (spec 전환 + 빌드 + cross-check + commit)**

Commit msg: `refactor(adr-059): B1 TabList — wrapper variant prop 제거 + skipCSSGeneration:false`

### Task B1.7: Tabs 해체 (iii-dead + 수동 CSS 삭제)

**Files:**

- Modify: `packages/specs/src/components/Tabs.spec.ts` — `skipCSSGeneration: true` → `false`
- Delete: `packages/shared/src/components/styles/Tabs.css`
- Modify: `packages/shared/src/components/styles/index.css:153` — `@import "./Tabs.css"` 라인 제거

- [ ] **Step 1: Read 현재 상태 3곳**

```bash
grep -n "skipCSSGeneration" packages/specs/src/components/Tabs.spec.ts
wc -l packages/shared/src/components/styles/Tabs.css
grep -n "Tabs.css" packages/shared/src/components/styles/index.css
```

- [ ] **Step 2: Edit spec** — `skipCSSGeneration: false`

- [ ] **Step 3: build:specs — generated Tabs.css 등장 확인**

```bash
pnpm build:specs
ls packages/shared/src/components/styles/generated/Tabs.css
diff -u packages/shared/src/components/styles/Tabs.css packages/shared/src/components/styles/generated/Tabs.css | head -100
```

diff 출력으로 generated가 manual에 준하는 내용(최소 base .react-aria-Tabs 룰)을 갖는지 확인.

- [ ] **Step 4: Delete manual CSS**

```bash
rm packages/shared/src/components/styles/Tabs.css
```

- [ ] **Step 5: Edit index.css** — `@import "./Tabs.css"` 라인 삭제

- [ ] **Step 6: type-check + cross-check + 실측 + commit**

- [ ] **Step 7: Commit**

```bash
git add packages/specs/src/components/Tabs.spec.ts packages/shared/src/components/styles/index.css packages/shared/src/components/styles/generated/Tabs.css
git rm packages/shared/src/components/styles/Tabs.css
git commit -m "refactor(adr-059): B1 Tabs — 수동 CSS 삭제 + skipCSSGeneration:false"
```

### Task B1.8: Slot 해체 (i-dead — wrapper dead type + 수동 CSS + renderer)

**Files:**

- Modify: `packages/specs/src/components/Slot.spec.ts:19` — `SlotProps.variant?: "default"` 타입 제거
- Modify: `packages/specs/src/components/Slot.spec.ts:35` — `skipCSSGeneration: true` → `false`
- Modify: `packages/specs/src/components/Slot.spec.ts:37` — `defaultVariant: "default"` 제거 (render.shapes 내 참조도 간단화 필요)
- Modify: `packages/specs/src/components/Slot.spec.ts:40-48` — `variants.default` 제거 (render.shapes에서 `SlotSpec.variants!.default` 참조 → 직접 토큰 상수로 치환)
- Delete: `packages/shared/src/components/styles/Slot.css`
- Modify: `packages/shared/src/components/styles/index.css:152` — `@import "./Slot.css"` 라인 제거

- [ ] **Step 1: Read Slot.spec.ts 및 Slot.css**

```bash
cat packages/specs/src/components/Slot.spec.ts
cat packages/shared/src/components/styles/Slot.css
grep -n "Slot.css" packages/shared/src/components/styles/index.css
```

- [ ] **Step 2: render.shapes 내 variant 참조 리팩터링**

현재 render.shapes는 `SlotSpec.variants![...].background` 형태로 variant 참조. variant 제거 후에는 shapes 함수 상단에 토큰 상수 직접 선언:

```typescript
// 기존: const variant = SlotSpec.variants![...];
// 신규:
const DEFAULTS = {
  background: "{color.base}" as TokenRef,
  backgroundHover: "{color.layer-2}" as TokenRef,
  backgroundPressed: "{color.layer-2}" as TokenRef,
  text: "{color.neutral-subdued}" as TokenRef,
  border: "{color.border}" as TokenRef,
};
// ... bgColor = props.style?.backgroundColor ?? DEFAULTS.background;
```

- [ ] **Step 3: Edit spec — variants/defaultVariant/props.variant 제거 + skipCSSGeneration:false**

- [ ] **Step 4: build:specs + generated 확인**

```bash
pnpm build:specs
ls packages/shared/src/components/styles/generated/Slot.css
```

- [ ] **Step 5: Delete manual CSS + remove import**

```bash
rm packages/shared/src/components/styles/Slot.css
# index.css에서 @import "./Slot.css" 라인 삭제
```

- [ ] **Step 6: type-check**

```bash
pnpm type-check
```

SlotProps.variant 제거로 인한 consumer 파손 있으면 해당 파일 수정 (JSX `<Slot variant=...>` 호출지 grep):

```bash
grep -rn "Slot variant=\|SlotProps" apps/ packages/
```

- [ ] **Step 7: /cross-check Slot + 실측**

- [ ] **Step 8: Commit**

```bash
git add packages/specs/src/components/Slot.spec.ts packages/shared/src/components/styles/index.css packages/shared/src/components/styles/generated/Slot.css
git rm packages/shared/src/components/styles/Slot.css
git commit -m "refactor(adr-059): B1 Slot — SlotProps.variant dead type 제거 + 수동 CSS 삭제

- SlotProps 인터페이스에서 variant 타입 제거 (renderer 미전달 dead)
- variants/defaultVariant 필드 제거, render.shapes 내 상수로 치환
- 수동 Slot.css 삭제 (generated 전환)
- Cell (i-dead): wrapper 타입 선언만 있던 dead D2 부채 해제"
```

### Task B1.9: Modal 해체 (iv/verify — 수동 CSS 삭제 중심)

**Files:**

- Modify: `packages/specs/src/components/Modal.spec.ts` — `skipCSSGeneration: true` → `false`
- Delete: `packages/shared/src/components/styles/Modal.css`
- Modify: `packages/shared/src/components/styles/index.css:129` — `@import "./Modal.css"` 라인 제거
- (B0.1에서 wrapper variant prop 확인 결과 "yes"면) Modify: `packages/shared/src/renderers/LayoutRenderers.tsx` renderModal variant prop 제거

- [ ] **Step 1: B0.1 Step 1 결과 재확인**

Modal cell 판정이 (iv) 확정이면 renderer 수정 스킵. (ii)로 재분류됐다면 wrapper prop 제거 추가.

- [ ] **Step 2~8: Task B1.7 (Tabs) 시퀀스 동일 — Modal 대상**

특이: Modal.css 내 `mymodal-*` keyframes demo leak + `.react-aria-TextField` nested cross-component leak 존재 (memory 기록) — manual 삭제 시 demo/cross-component 파손 확인 필수.

- [ ] **Step: Commit**

```bash
git commit -m "refactor(adr-059): B1 Modal — 수동 CSS 삭제 + skipCSSGeneration:false"
```

### Task B1.10: ToggleButtonGroup 해체 (iii-dead/verify)

**Files:**

- Modify: `packages/specs/src/components/ToggleButtonGroup.spec.ts` — `skipCSSGeneration: true` → `false`
- Delete: `packages/shared/src/components/styles/ToggleButtonGroup.css`
- Modify: `packages/shared/src/components/styles/index.css:103` — `@import "./ToggleButtonGroup.css"` 라인 제거
- (B0.1 결과 "data-togglebutton-variant" 발견 시) Modify: `packages/shared/src/renderers/CollectionRenderers.tsx:645` renderToggleButtonGroup 에서 data-variant 속성 제거

- [ ] **Step 1: B0.1 Step 3 결과 재확인**

ToggleButtonGroup이 memory 기록대로 wrapper에 `data-togglebutton-variant` 보유 시 Task가 (ii) → wrapper variant prop 제거 범위 확장. Agent 보고대로 미노출이면 (iii-dead) 단순 해체.

- [ ] **Step 2~9: Task B1.7 시퀀스 + (조건부) renderer 수정**

- [ ] **Step: Commit**

```bash
git commit -m "refactor(adr-059): B1 ToggleButtonGroup — 수동 CSS 삭제 + skipCSSGeneration:false"
```

### Task B1.11: TabPanels 해체 ((iv) 재분류 확정 후)

**Files:**

- Modify: `packages/specs/src/components/TabPanels.spec.ts` — `skipCSSGeneration: true` → `false`
- (B0.1 결과 wrapper variant 없음 확정 시) 수동 CSS 없음 → spec 수정만

- [ ] **Step 1~7: Task B1.1 시퀀스 (iv 기본형)**

- [ ] **Step: Commit**

```bash
git commit -m "refactor(adr-059): B1 TabPanels — skipCSSGeneration:false (cell iv 재분류)"
```

---

## Phase B1 완료 검증 Gate

### Task B1.12: B1 Gate 전체 검증

- [ ] **Step 1: skipCSSGeneration:true 카운트 감소 확인**

```bash
grep -rn "skipCSSGeneration:\s*true" packages/specs/src/components/ | wc -l
```

예상: B1 시작 전 38 → B1 완료 후 27 (11 감소).

- [ ] **Step 2: 수동 CSS 파일 삭제 확인**

```bash
ls packages/shared/src/components/styles/{Slot,Tabs,Modal,ToggleButtonGroup}.css 2>&1
```

예상: `ls: cannot access` (모두 삭제).

- [ ] **Step 3: generated CSS 파일 등장 확인**

```bash
ls packages/shared/src/components/styles/generated/{Breadcrumb,Accordion,DisclosureHeader,TailSwatch,Tab,TabList,Tabs,Slot,Modal,ToggleButtonGroup,TabPanels}.css
```

11개 전부 존재.

- [ ] **Step 4: type-check + build:specs 전체 통과**

```bash
pnpm type-check
pnpm build:specs
```

- [ ] **Step 5: 번들 크기 측정**

```bash
pnpm build
# 출력에서 builder/index.*.js gzip 크기 <500KB 확인
```

- [ ] **Step 6: 60fps 회귀 수동 확인**

`pnpm dev` → Builder에서 11개 컴포넌트 모두 페이지에 드롭 → 60fps 유지, hover/focus/disabled 상태 변경 시 시각 회귀 없음.

- [ ] **Step 7: /cross-check 11 컴포넌트 일괄**

Run: `/sweep Breadcrumb Accordion DisclosureHeader TailSwatch Tab TabList Tabs Slot Modal ToggleButtonGroup TabPanels`

통과 기대: 모두 Skia ↔ CSS 시각 일치.

- [ ] **Step 8: ADR/breakdown 상태 갱신**

Edit `docs/adr/design/059-composite-field-skip-css-dismantle-breakdown.md` — Per-Component 표에서 B1 대상 11개 row에 "Implemented" 표시.

Edit `docs/adr/059-composite-field-skip-css-dismantle.md` Status → `Proposed (v2.1 amendment, B0+B1 Implemented)` 추가 노트.

- [ ] **Step 9: Commit + PR 생성**

```bash
git add docs/
git commit -m "docs(adr-059): B1 완료 표기 — 11 컴포넌트 D3 해체"
git push -u origin feature/adr-059-b1-low-risk

gh pr create --title "ADR-059 v2.1 B0+B1 — Low-risk 11 컴포넌트 D3 해체" --body "$(cat <<'EOF'
## Summary

ADR-059 v2.1 amendment Phase 4 재설계의 B0(verify + RSP 대조) + B1(dead/desync 11개 해체) 완료.

## Components Dismantled

- (iv) Breadcrumb, Accordion, DisclosureHeader, TailSwatch
- (iii-dead) Tab, Tabs
- (i-dead) TabList, Slot
- (iv verify) Modal, TabPanels
- (iii-dead verify) ToggleButtonGroup

## Metrics

- skipCSSGeneration:true : 38 → 27
- 수동 CSS 파일 삭제 : 4개 (Slot, Tabs, Modal, ToggleButtonGroup)
- D2 부채 해제 : Slot (SlotProps.variant dead type), TabList (wrapper prop)

## Test plan

- [x] pnpm type-check PASS
- [x] pnpm build:specs PASS
- [x] pnpm build 번들 <500KB
- [x] /sweep 11 컴포넌트 cross-check 통과
- [x] 60fps 수동 확인

## Refs

- ADR: docs/adr/059-composite-field-skip-css-dismantle.md §"Phase 4 재설계 (v2.1 amendment)"
- Breakdown: docs/adr/design/059-composite-field-skip-css-dismantle-breakdown.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Checklist (plan 작성자 자가 확인)

- [x] **Spec coverage**: ADR-059 v2.1 amendment의 B0 + B1 항목 전부 task로 매핑 (B0.1 verify + B0.2 RSP 대조 + B1.1~B1.11 11 컴포넌트 + B1.12 Gate)
- [x] **Placeholder scan**: "TBD" / "적절한 처리" / "Similar to Task N" 무. Task B1.2~B1.5는 B1.1 참조하나 명시적 "동일 시퀀스 + 대상만 다름" 표기
- [x] **Type consistency**: skipCSSGeneration / variants 필드명 / renderer 함수명(renderSlot/renderModal 등) 일관. 파일 경로 discovery 결과 기반
- [x] **File paths exact**: 11 컴포넌트 모두 spec 경로 확정. 4개 수동 CSS 경로 확정. index.css import 라인 번호 확인. renderer 함수 위치 확인.
- [x] **Gate 측정 가능**: skipCSSGeneration grep 카운트 38→27, 수동 CSS 파일 삭제 4개, generated CSS 등장 11개, 번들 <500KB, /sweep 통과

### 알려진 공백

- **(i) RSP 대조 10개 Step 2~10은 1-line 요약**: 각 컴포넌트 RSP 페이지 구조/검색 키가 다름 — 실행자 재량 허용 (plan의 "10분 반복 Step" 한계 내).
- **render.shapes 내부 variant 참조 리팩터링(Task B1.8 Slot)**: 코드 블록 제시했으나 정확한 diff는 실제 파일 상태 기반 edit 필요. 실행 시 spec 재읽기 후 변형.

---

## 실행 옵션

**Plan complete and saved to `docs/superpowers/plans/2026-04-14-adr059-b0-b1-low-risk-batch.md`. 두 가지 실행 옵션:**

**1. Subagent-Driven (recommended)** — B0/B1 각 Task별 fresh subagent 실행, Task 간 reviewer agent 검증. ADR-062 선례와 동일 패턴.

**2. Inline Execution** — executing-plans skill로 현 세션에서 일괄 실행, checkpoint별 사용자 리뷰.

**어느 쪽으로 진행할까요?**
