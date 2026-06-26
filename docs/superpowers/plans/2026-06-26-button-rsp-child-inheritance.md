# Button 조합 RSP 자식 상속 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미 RSP 구조(`<Button><Icon/><Text/></Button>`)로 조합된 Button 의 자식 Icon/Text 가 Button color 를 상속하게 하고(CSS+Skia), display 를 RSP immutable 로 고정한다.

**Architecture:** D3 시각만 변경. CSS(Preview)는 `.button-base > *` 직계 자식 `color: inherit` 으로 상속, Skia(Builder)는 부모=Button 일 때 자식 node 에 Button color 명시 전파. display 는 Button.css 고정 + Calendar override 한정 이관.

**Tech Stack:** CSS (`@layer components`), Skia/CanvasKit (`buildSpecNodeData.ts`), React (CanonicalNodeRenderer DOM class).

## Global Constraints

- 응답 한국어, 코드/기술 용어 영어 유지.
- D1(DOM 구조)/D2(props) 무변경 — D3 시각만.
- generated CSS (`generated/*.css`, "DO NOT EDIT MANUALLY") 무편집 — 방식 ①.
- `.button-base` 적용 컴포넌트(Button/ToggleButton) 한정.
- git: web PR 금지, `git add` → `git commit` → push 는 사용자 명시 요청 시만.
- 완료 기준: type-check PASS 단독 불가 — Chrome MCP live exercise 필수.
- type-check baseline 69 (builder), 회귀 0 유지.

---

## File Structure

- `packages/shared/src/components/styles/Button.css` — 그룹 A(자식 color inherit) + 그룹 B(display 고정).
- `packages/shared/src/components/styles/CalendarCommon.css` — 그룹 B(Calendar Button display override 한정 이관).
- `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` — 그룹 C(Skia 자식 color 전파).

---

## Task 1: CSS 자식 color 상속 (그룹 A)

**Files:**

- Modify: `packages/shared/src/components/styles/Button.css` (`.button-base` 블록 또는 `.react-aria-Button` 블록 내 자식 selector 추가)

**Interfaces:**

- Consumes: `.button-base { color: var(--button-text) }` (utilities.css:18, 기존). DOM class `react-aria-${type} button-base` (CanonicalNodeRenderer:414).
- Produces: `.button-base > *` 직계 자식이 Button color 상속. 후속 Task 없음(독립).

- [ ] **Step 1: Button.css 에 자식 color inherit selector 추가**

`packages/shared/src/components/styles/Button.css` 의 `.react-aria-Button` 블록(`@layer components` 내부) 끝, size variants 앞에 추가:

```css
/* RSP 정합: 직계 자식(Icon/Text)이 Button color 상속.
       leaf 의 color: var(--fg) 명시를 자식결합자 우위로 override.
       Icon SVG 는 stroke="currentColor" → inherit 따라감.
       standalone leaf 는 영향 없음(.button-base 컨텍스트 한정). */
& > * {
  color: inherit;
}
```

- [ ] **Step 2: dev 서버에서 Preview 확인 (CSS 즉시 반영)**

빌더 탭에서 Button(primary, 검은 배경) 안 Icon/Text 가 흰색으로 보이는지 확인.
Run (확인용): dev 서버 실행 중 가정. Preview iframe 에서 Button 자식 텍스트/아이콘 색 = 흰색(--button-text).
Expected: 검은 배경 위 Icon "settings" + Text 가 흰색으로 표시.

> specificity 충돌(자식 leaf 가 안 따라옴) 시: `.react-aria-Button > *` 직접 selector 로 강화 (자식결합자 + 클래스 = 0,1,0 + combinator > leaf 단일 0,1,0, cascade 후순위 우위). 그래도 안 되면 leaf 가 `:where()` 밖 명시인지 재확인.

- [ ] **Step 3: type-check**

Run: `pnpm type-check`
Expected: `TYPE-CHECK PASS — no new violations (baseline: 69 known errors)` (CSS 변경이라 영향 없음).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/components/styles/Button.css
git commit -m "feat(button): RSP 자식 color 상속 — .button-base > * { color: inherit }

Button 조합(<Button><Icon/><Text/>)의 자식이 Button color(--button-text)
상속. leaf color: var(--fg) 명시를 자식결합자로 override. standalone 무영향.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: display RSP 고정 + Calendar override 이관 (그룹 B)

**Files:**

- Modify: `packages/shared/src/components/styles/Button.css:14-15` (변수 → 고정)
- Modify: `packages/shared/src/components/styles/CalendarCommon.css:20-21` (변수 설정 → Button 한정 selector 이관)

**Interfaces:**

- Consumes: `--btn-display`/`--btn-justify` 설정처 = CalendarCommon.css:20-21 (유일), 소비처 = Button.css:14-15 (유일). 다른 의존처 0건(grep 확인).
- Produces: Button display = inline-flex 고정. Calendar Button = `.react-aria-Calendar .react-aria-Button` 한정 flex.

- [ ] **Step 1: Button.css display/justify 변수 → 고정**

`packages/shared/src/components/styles/Button.css:14-15`:

```css
/* 변경 전 */
display: var(--btn-display, inline-flex);
justify-content: var(--btn-justify, center);
/* 변경 후 */
display: inline-flex;
justify-content: center;
```

- [ ] **Step 2: CalendarCommon.css 의 변수 설정 제거 + Button 한정 override 추가**

`packages/shared/src/components/styles/CalendarCommon.css:19-23` 에서 `--btn-display: flex;` 와 `--btn-justify: center;` 두 줄 제거 (`--btn-radius`/`--btn-padding` 은 유지 — display 무관).

제거 후, Calendar Button 한정 selector(이미 존재하는 `.react-aria-Calendar .react-aria-Button, .react-aria-RangeCalendar .react-aria-Button` 블록, 약 line 43-44)에 display 명시 추가:

```css
.react-aria-Calendar .react-aria-Button,
.react-aria-RangeCalendar .react-aria-Button {
  display: flex; /* ← 이관: Button.css 고정(inline-flex) override */
  justify-content: center; /* ← 이관 */
  /* 기존 속성 유지 */
}
```

> 정확한 기존 블록 내용은 편집 직전 Read 로 확인 후 display/justify 2줄만 추가. 기존 padding/radius 등 보존.

- [ ] **Step 3: Calendar 네비 버튼 시각 확인 (Preview)**

빌더에 Calendar/RangeCalendar 컴포넌트 배치 → prev/next 네비 버튼이 깨지지 않고 정상(flex 가로 중앙) 표시되는지 확인.
Expected: Calendar 네비 버튼 = 변경 전과 동일 레이아웃.

- [ ] **Step 4: type-check**

Run: `pnpm type-check`
Expected: `TYPE-CHECK PASS — no new violations (baseline: 69 known errors)`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/components/styles/Button.css packages/shared/src/components/styles/CalendarCommon.css
git commit -m "refactor(button): display RSP immutable 고정 + Calendar override 한정 이관

Button.css display/justify 변수 → inline-flex/center 고정(RSP immutability).
Calendar 의 --btn-display:flex override 는 .react-aria-Calendar .react-aria-Button
한정 selector 로 이관. --btn-radius/padding 은 변수 유지(display 무관).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Skia 자식 color 전파 (그룹 C)

**Files:**

- Modify: `apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts` (자식 Text/Icon node color 결정 지점)

**Interfaces:**

- Consumes: Button node 의 resolved `--button-text` 색. 부모 판정(부모 type === Button 또는 `.button-base` 컴포넌트).
- Produces: 자식 Text `node.text.color` + Icon stroke 가 Button color. standalone(부모≠Button)은 기존 `--fg` 유지.

- [ ] **Step 1: 부모 Button color 전파 지점 grep 확정**

Run: `grep -n 'node.text.color\|text.color =\|color.*default\|parentDelegated\|resolveColor' apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts | head -20`
Expected: 자식 Text node 의 color 가 채워지는 지점 식별. ElementSprite parentDelegated selector 패턴(Collection Item font 동형) 위치 확인.

> 정확한 구현 위치는 grep 결과로 확정. Collection Item font 패턴(`collection-item-font-pattern` 메모리)을 reference 로 차용 — 부모 Button 의 resolved button-text color 를 자식 Text/Icon node 빌드 시 주입.

- [ ] **Step 2: 부모=Button 일 때 자식 color 주입 구현**

grep 으로 확정한 자식 color 결정 지점에서, 부모가 Button(`.button-base` 컴포넌트)이면 Button 의 resolved `--button-text` 색을 자식 `node.text.color`(Text) / Icon stroke 에 주입. 부모≠Button 이면 기존 `--fg` 유지(context-aware).

> 구체 코드는 Step 1 grep 으로 본 기존 color 결정 로직 구조에 맞춰 작성. 부모 type 판정 → button color resolve → 자식 주입 분기 추가.

- [ ] **Step 3: type-check**

Run: `pnpm type-check`
Expected: `TYPE-CHECK PASS — no new violations (baseline: 69 known errors)`.

- [ ] **Step 4: Skia(Builder canvas) live 확인 (Chrome MCP)**

빌더 캔버스에서 Button(primary 검은 배경) 안 Icon "settings" + Text 가 **흰색**으로 보이는지 확인(검은 박스에 묻히지 않음).
Expected: Skia 렌더에서 Icon/Text 흰색 표시 → CSS Preview 와 시각 대칭.

- [ ] **Step 5: Commit**

```bash
git add apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts
git commit -m "feat(skia): Button 자식 Icon/Text 에 Button color 전파

Collection Item font 패턴 차용. 부모=Button 일 때 자식 Text node.text.color
+ Icon stroke 에 resolved --button-text 주입. standalone 은 --fg 유지(context-aware).
CSS .button-base > * { color: inherit } 와 시각 대칭.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 양 경로 대칭 검증 (그룹 D) + 종결

**Files:** (검증만 — 코드 변경 없을 수도)

- [ ] **Step 1: /cross-check 실행**

`/cross-check` skill 로 Button 조합(Icon+Text)의 CSS↔Skia 시각 대칭 검증 — color 상속 + display 양쪽.
Expected: 0 CRITICAL/HIGH. color 상속 + display 가 양 경로 동일 시각 결과.

- [ ] **Step 2: Chrome MCP 최종 live exercise**

실증했던 동일 Button(primary, Icon "settings" + Text "Text")에서:

1. Builder canvas: Icon/Text 흰색 (검은 배경에 보임)
2. Preview: 동일하게 흰색
3. variant 를 다른 색(예: outline)으로 바꿔도 자식이 그 색 상속
4. display: variant 바꿔도 가로 중앙 정렬 유지

Expected: 4 항목 모두 PASS. 무엇을 exercise 했는지 기록.

- [ ] **Step 3: CHANGELOG 반영**

`docs/CHANGELOG.md` 최상단에 Bug Fixes 엔트리 추가:

```markdown
## [Button 조합 자식 color 상속 + display RSP 고정] - 2026-06-26

### Bug Fixes

- **Button 자식 Icon/Text color 미상속** (RSP 정합):
  - `<Button><Icon/><Text/></Button>` 조합 시 자식이 Button color(--button-text) 미상속 → 검은 배경 위 검정 Icon/Text 묻힘
  - **Why**: leaf CSS `color: var(--fg)` 명시 + Skia 부모→자식 color 전파 부재
  - 수정: CSS `.button-base > * { color: inherit }` + Skia 부모=Button 시 자식 color 주입(context-aware)
  - 위치: `Button.css`, `buildSpecNodeData.ts`

### Architecture

- **Button display RSP immutable 고정**: `--btn-display`/`--btn-justify` 변수 → Button.css 고정(inline-flex/center). Calendar override 는 `.react-aria-Calendar .react-aria-Button` 한정 이관. 위치: `Button.css`, `CalendarCommon.css`
```

- [ ] **Step 4: Commit**

```bash
git add docs/CHANGELOG.md
git commit -m "docs(changelog): Button 조합 자식 color 상속 + display RSP 고정

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage**: 그룹 A(Task 1) / B(Task 2) / C(Task 3) / D(Task 4) — 스펙 4 그룹 전부 매핑. context-aware 상속(방식 ①) Task 1·3 반영. ✓
- **Placeholder scan**: Task 3 Step 1-2 는 grep 후 확정("buildSpecNodeData 정확 위치는 코드 구조 의존")으로 의도된 위임 — 단, Step 1 에 grep 명령 + Collection Item font reference 명시하여 실행자가 막히지 않게 함. ✓
- **Type consistency**: `--button-text` / `.button-base` / `node.text.color` 심볼 Task 간 일관. ✓
- **신규 발견 반영**: Calendar `--btn-display` 의존(brainstorm 후 발견) → Task 2 에 한정 이관 step 포함. ✓
