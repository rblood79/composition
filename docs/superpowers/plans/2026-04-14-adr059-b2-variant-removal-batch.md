# ADR-059 v2.1 Phase 4 — B2 Variant Removal Batch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** ADR-059 v2.1 Phase 4 재설계의 B2 batch 수행 — (i-a)/(i-b) 5 컴포넌트의 wrapper variant prop + Spec variants + 수동 CSS 일괄 정리. ADR-062 Field 선례 방법론 복제.

**Architecture:** 각 컴포넌트 원자적 commit (Spec + CSS + renderer + 타입 + Storybook 수정 모두 포함). Card는 (i-a+b)로 `primary/secondary/tertiary` 제거 + `isQuiet` prop 추가(ADR-062 Field isQuiet 구현 패턴 직접 복제).

**Tech Stack:** TypeScript 5, pnpm monorepo, React Aria Components, CSSGenerator.

**Source ADR:** [059-composite-field-skip-css-dismantle.md](../../adr/completed/059-composite-field-skip-css-dismantle.md) § "Phase 4 재설계 (v2.1 amendment)"
**Source breakdown:** [059-composite-field-skip-css-dismantle-breakdown.md](../../adr/design/completed/059-composite-field-skip-css-dismantle-breakdown.md) § "B1 실행 결과" + Per-Component 표
**선례 ADR:** [062-field-spec-rsp-conformance.md](../../adr/completed/062-field-spec-rsp-conformance.md) — 11 Field variant 제거 + isQuiet 보강 방법론
**B0.2 결과 (commit b1badff3)**: 5 컴포넌트 분기 판정 완료

---

## 대상 5 컴포넌트 + B0.2 판정

| #    | Component      | B0.2 분기             | RSP 대체 prop                   | Spec.variants 현                   | Wrapper prop 현                                 | 수동 CSS         |
| ---- | -------------- | --------------------- | ------------------------------- | ---------------------------------- | ----------------------------------------------- | ---------------- |
| B2.1 | **DropZone**   | (i-a) 순수 제거       | data-drop-target(render state)  | `default/accent`                   | yes (`variant` prop 전달 FormRenderers.tsx:944) | `DropZone.css`   |
| B2.2 | **Disclosure** | (i-a) 순수 제거       | isExpanded/isDisabled           | `default/accent/surface`           | yes (`data-variant` 전달)                       | `Disclosure.css` |
| B2.3 | **Menu**       | (i-a) 순수 제거       | selectionMode/autoFocus         | `primary/secondary/accent`         | yes                                             | `Menu.css`       |
| B2.4 | **Dialog**     | (i-a) 순수 제거       | size(S/M/L)/isDismissable       | `accent/negative`                  | yes                                             | `Dialog.css`     |
| B2.5 | **Card**       | (i-a+b) 제거 + rename | size(S/M/L)/isQuiet/orientation | `primary/secondary/tertiary/quiet` | yes                                             | `Card.css`       |

---

## 공통 해체 템플릿

각 컴포넌트에 공통 적용되는 표준 시퀀스 — Task 내부에서 이 번호를 참조합니다.

```
[T-A] 현 상태 스냅샷: Spec variants keys / Wrapper variant prop 전달 지점 / 수동 CSS 라인 수 / consumer JSX grep
[T-B] Spec 편집:
      - B-1. skipCSSGeneration: true → false
      - B-2. variants 필드 dead 키 제거 또는 전체 제거
      - B-3. render.shapes 내부 variants 참조 상수화 (Slot B1.8 선례)
      - B-4. Props interface의 variant 필드 제거
      - B-5. defaultVariant 제거
[T-C] Renderer 편집 (해당 파일):
      - C-1. <Component variant={...}> 또는 data-variant={...} 속성 제거
      - C-2. element.props.variant 참조 제거
[T-D] 수동 CSS 삭제:
      - D-1. git rm packages/shared/src/components/styles/{Name}.css
      - D-2. packages/shared/src/components/{Name}.tsx 의 import 경로 './styles/{Name}.css' → './styles/generated/{Name}.css' (Slot.tsx 선례)
      - D-3. packages/shared/src/components/styles/index.css 의 해당 @import 라인 경로 갱신 (generated/ 프리픽스)
[T-E] Consumer sweep:
      - E-1. grep -rn "{ComponentName}.*variant=" apps/ packages/ → JSX 호출지 수정
      - E-2. grep -rn "variant.*default.*{component-values}" apps/ packages/ → Skia/renderer/Inspector/type 정의
      - E-3. ADR-062 선례의 58건 소비자 분류(Skia renderer/hooks/renderers/validators/Shared renderers/Properties panel/builder types) 참조
[T-F] 검증:
      - F-1. pnpm build:specs → generated CSS 확인 (shell 또는 base 수준)
      - F-2. pnpm type-check → 에러 0
      - F-3. generated/{Name}.css 파일 존재
[T-G] Commit (atomic per component)
```

### 특이 사항

- **Card (B2.5) isQuiet 추가**: ADR-062의 TextField isQuiet 구현을 참조.
  - Props interface `isQuiet?: boolean` 추가
  - Spec에 `containerVariants: { quiet: {...} }` 또는 `states.isQuiet` 추가 (Field 선례 따라)
  - Renderer가 isQuiet prop을 받아 `data-quiet` 속성으로 전달
  - 기존 `variant="quiet"` 호출지 → `isQuiet={true}` 마이그레이션
- **Menu**: `primary/secondary/accent` → 전부 제거. 사용자가 custom color 원하면 theme `--accent` 변수 활용 (현 체계 유지)
- **Disclosure `surface`**: semantic 배경 — 제거 시 default 배경에 흡수. 시각 차이 스토리에서 확인

### ADR-062 선례의 58 소비자 지점 (참조)

Field 11개 대상이었던 범위. B2 5개는 비Field이므로 다음 중 일부만 해당:

| 계층                                                   | Field에서의 역할                   | B2 컴포넌트에서의 예상                                  |
| ------------------------------------------------------ | ---------------------------------- | ------------------------------------------------------- |
| Skia 렌더러 3파일 (buildSpecNodeData/specTextStyle 등) | variant 기반 색상 lookup           | Field 외에는 Skia 소비 없음 추정 — 컴포넌트별 grep 확인 |
| useSpecRenderer 훅                                     | 공용 variant 전달                  | 대부분 없음                                             |
| ReactRenderer/PixiRenderer/CSSGenerator                | variant 없으면 "default" fallback  | 안전, 변경 불필요                                       |
| validate-specs/validate-tokens                         | variants 객체 부재 시 오류         | ADR-062에서 완화됨 — 재확인만                           |
| FormRenderers/LayoutRenderers/CollectionRenderers      | data-variant 속성 출력             | **대상** — 각 render 함수 수정                          |
| SpecField.tsx (Properties 패널)                        | Object.keys(spec.variants) UI 옵션 | **대상** — 각 컴포넌트에서 variant 드롭다운 사라짐      |
| unified.types.ts                                       | Field variant? union 타입          | **대상** — 5 컴포넌트 타입 정의 제거                    |

---

## Phase B2 사전 준비

### Task B2.0: Worktree 생성 + 셋업

**Files:** N/A (git operation)

- [ ] **Step 1: main 최신 pull**

```bash
cd /Users/admin/work/composition
git checkout main
git pull
```

- [ ] **Step 2: worktree 생성**

```bash
git worktree add .worktrees/adr-059-b2-variant-removal -b feature/adr-059-b2-variant-removal
cd .worktrees/adr-059-b2-variant-removal
```

- [ ] **Step 3: 의존성 설치 + 타입 체크 베이스라인**

```bash
pnpm install 2>&1 | tail -5
pnpm type-check 2>&1 | tail -5
```

PASS 기대.

---

## Phase B2 — 컴포넌트별 해체 (원자적 commit)

각 Task는 공통 템플릿 [T-A]~[T-G]를 따릅니다. Task 본문에는 컴포넌트별 구체 경로/차이점만 기록.

### Task B2.1: DropZone 해체

**Files:**

- Modify: `packages/specs/src/components/DropZone.spec.ts` (variants/Props/defaultVariant/skipCSS)
- Modify: `packages/shared/src/renderers/FormRenderers.tsx:927` 주변 (renderDropZone 내부 `variant` prop 전달 제거)
- Modify: `packages/shared/src/components/DropZone.tsx` import 경로 generated/
- Modify: `packages/shared/src/components/styles/index.css` 해당 import 경로 갱신
- Delete: `packages/shared/src/components/styles/DropZone.css`
- grep + modify: `apps/builder/src/types/builder/unified.types.ts`에서 DropZone 관련 `variant?: "default" | "accent"` 제거
- grep + modify: JSX `<DropZone variant=...>` 호출지 (없을 가능성 — Storybook/demo)

- [ ] **Step 1: [T-A] 스냅샷**

```bash
cd /Users/admin/work/composition/.worktrees/adr-059-b2-variant-removal
cat packages/specs/src/components/DropZone.spec.ts | head -60
grep -n "DropZone\|variant" packages/shared/src/renderers/FormRenderers.tsx | sed -n '920,970p'
wc -l packages/shared/src/components/styles/DropZone.css
grep -rn "DropZone.*variant=\|variant.*DropZone" apps/ packages/ --include="*.tsx" --include="*.ts"
grep -rn "accept.*DropZone\|DropZoneProps" apps/builder/src/types/
```

스냅샷 결과를 보고서에 포함.

- [ ] **Step 2: [T-B] Spec 편집**

`packages/specs/src/components/DropZone.spec.ts`:

- `skipCSSGeneration: true` → `false`
- `variants.default/accent` → 삭제 (전체 제거) 또는 `default` 단일 키만 보존(render.shapes token 참조 필요 시)
- `defaultVariant` 제거 (variants 전체 제거 시)
- Props interface `DropZoneProps.variant?: ...` 제거
- render.shapes에서 `DropZoneSpec.variants![...]` 참조 발견 시 → 상수 치환 (Slot B1.8 패턴)

- [ ] **Step 3: [T-C] Renderer 편집**

`packages/shared/src/renderers/FormRenderers.tsx:944` 주변:

```diff
- variant={
-   (element.props.variant as "default" | "primary" | "dashed") || "default"
- }
```

(해당 라인 제거)

- [ ] **Step 4: [T-D] 수동 CSS 삭제**

```bash
git rm packages/shared/src/components/styles/DropZone.css
```

`packages/shared/src/components/DropZone.tsx`에서 `import './styles/DropZone.css'` → `import './styles/generated/DropZone.css'`.

`packages/shared/src/components/styles/index.css`의 DropZone 관련 @import 라인을 `./generated/DropZone.css`로 갱신.

- [ ] **Step 5: [T-E] Consumer sweep**

```bash
grep -rn "DropZone.*variant=" apps/ packages/ --include="*.tsx"
grep -rn "variant.*default.*accent" apps/builder/src/types/ --include="*.ts"
```

발견된 JSX 호출지에서 `variant="..."` 속성 제거. 타입 정의에서 DropZone 관련 variant union 제거.

- [ ] **Step 6: [T-F] 검증**

```bash
pnpm build:specs 2>&1 | tail -5
pnpm type-check 2>&1 | tail -5
ls packages/shared/src/components/styles/generated/DropZone.css
```

- [ ] **Step 7: [T-G] Commit**

```bash
git add packages/specs/src/components/DropZone.spec.ts \
        packages/shared/src/components/{DropZone.tsx,styles/index.css} \
        packages/shared/src/components/styles/generated/DropZone.css \
        packages/shared/src/renderers/FormRenderers.tsx \
        apps/builder/src/types/builder/unified.types.ts

git rm packages/shared/src/components/styles/DropZone.css

git commit -m "$(cat <<'EOF'
refactor(adr-059): B2.1 DropZone — variant prop 제거 + 수동 CSS 삭제

- Spec.variants 제거 (default/accent)
- DropZoneProps.variant 타입 제거
- FormRenderers.renderDropZone variant prop 전달 제거
- 수동 DropZone.css 삭제 → generated 전환
- unified.types.ts DropZone variant union 제거
- Cell (i-a): RSP 공식 data-drop-target(render state)로 대체 가능

RSP 공식 props(Disclosure, DropZone 참조: react-aria.adobe.com)에 variant 개념 없음 → ADR-062 isQuiet 없이 순수 제거 적용.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task B2.2: Disclosure 해체

**Files:**

- Modify: `packages/specs/src/components/Disclosure.spec.ts`
- Modify: `packages/shared/src/renderers/LayoutRenderers.tsx:1705` 주변 (renderDisclosure)
- Modify: `packages/shared/src/components/Disclosure.tsx` import 경로
- Modify: `packages/shared/src/components/styles/index.css` import 경로
- Delete: `packages/shared/src/components/styles/Disclosure.css`
- Consumer sweep: unified.types.ts + JSX 호출지

- [ ] **Step 1-7: Task B2.1 [T-A]~[T-G] 동일 시퀀스 — Disclosure 대상**

특이사항:

- Spec.variants 3개 (`default/accent/surface`). surface는 배경이 미묘하게 다름 — 제거 시 default 배경으로 흡수. B1.12 Gate `/sweep` Disclosure 스토리에서 시각 확인.
- Renderer에서 `data-variant` 속성 제거.

Commit msg: `refactor(adr-059): B2.2 Disclosure — variant prop 제거 + 수동 CSS 삭제`

### Task B2.3: Menu 해체

**Files:**

- Modify: `packages/specs/src/components/Menu.spec.ts`
- Modify: `packages/shared/src/renderers/CollectionRenderers.tsx:781` 주변 (renderMenu)
- Modify: `packages/shared/src/components/Menu.tsx` import 경로
- Modify: `packages/shared/src/components/styles/index.css` import 경로
- Delete: `packages/shared/src/components/styles/Menu.css`
- Consumer sweep

- [ ] **Step 1-7: 동일 시퀀스 — Menu 대상**

특이사항:

- Spec.variants `primary/secondary/accent` → 전부 제거. 기존 시각 차이(배경/테두리 색)는 제거 후 default 단일 스타일로 통합.
- MenuItem도 영향 받을 수 있음 — grep으로 독립 spec인지 확인 후 분리 작업.
- Menu children (MenuItem/MenuTrigger)이 variant 상속받는 구조면 상속 경로도 수정.

Commit msg: `refactor(adr-059): B2.3 Menu — variant prop 제거 + 수동 CSS 삭제`

### Task B2.4: Dialog 해체

**Files:**

- Modify: `packages/specs/src/components/Dialog.spec.ts`
- Modify: `packages/shared/src/renderers/LayoutRenderers.tsx:731` 주변 (renderDialog)
- Modify: `packages/shared/src/components/Dialog.tsx` import 경로
- Modify: `packages/shared/src/components/styles/index.css` import 경로
- Delete: `packages/shared/src/components/styles/Dialog.css`
- Consumer sweep

- [ ] **Step 1-7: 동일 시퀀스 — Dialog 대상**

특이사항:

- Spec.variants `accent/negative` 제거. `accent`는 일반 다이얼로그, `negative`는 파괴적 action dialog로 시각 차이 있음 — 제거 시 사용자는 `role="alertdialog"` 또는 내부 Button variant로 표현해야 함 (RSP 방식).
- 메모리 Dialog demo `mymodal-*` keyframes와 연관 없음 재확인.

Commit msg: `refactor(adr-059): B2.4 Dialog — variant prop 제거 + 수동 CSS 삭제`

### Task B2.5: Card 해체 — variant 제거 + isQuiet 추가 (복합)

**Files:**

- Modify: `packages/specs/src/components/Card.spec.ts` (복합 변경)
- Modify: `packages/shared/src/renderers/LayoutRenderers.tsx:326` 주변 (renderCard)
- Modify: `packages/shared/src/components/Card.tsx` (isQuiet prop 추가 + import 경로)
- Modify: `packages/shared/src/components/styles/index.css` import 경로
- Delete: `packages/shared/src/components/styles/Card.css`
- Reference: `packages/specs/src/components/TextField.spec.ts` (ADR-062 isQuiet 구현 패턴)
- Reference: `packages/shared/src/renderers/FormRenderers.tsx` renderTextField 의 isQuiet 전달 패턴
- Consumer sweep: JSX `<Card variant="quiet">` → `<Card isQuiet>` 마이그레이션

- [ ] **Step 1: [T-A] 스냅샷 + ADR-062 TextField isQuiet 구현 참조**

```bash
cd /Users/admin/work/composition/.worktrees/adr-059-b2-variant-removal
cat packages/specs/src/components/Card.spec.ts | head -100
grep -n "isQuiet\|containerVariants.*quiet" packages/specs/src/components/TextField.spec.ts
grep -n "isQuiet" packages/shared/src/renderers/FormRenderers.tsx | head -20
grep -rn "Card.*variant=\"quiet\"\|Card variant=\"primary\"" apps/ packages/ --include="*.tsx"
wc -l packages/shared/src/components/styles/Card.css
```

TextField 선례:

- Props interface에 `isQuiet?: boolean`
- Spec에 `containerVariants: { quiet: { selector: '[data-quiet=\"true\"]', styles: {...} } }` 또는 유사
- Renderer가 wrapper에 `data-quiet={isQuiet ? "true" : undefined}` 전달

- [ ] **Step 2: [T-B] Spec 편집 (복합)**

`packages/specs/src/components/Card.spec.ts`:

- `skipCSSGeneration: true` → `false`
- variants `primary/secondary/tertiary/quiet` → **전체 제거** (quiet는 containerVariants로 이관)
- Props interface:
  - `variant?: "primary" | "secondary" | "tertiary" | "quiet"` 제거
  - `isQuiet?: boolean` 추가
- defaultVariant 제거
- render.shapes 내 variants 참조 상수화
- **containerVariants 추가** (TextField 패턴 참조):

  ```ts
  containerVariants: {
    quiet: {
      selector: '&[data-quiet="true"]',
      styles: {
        // 기존 variants.quiet의 background/border/shadow 등 여기로 이관
        backgroundColor: 'transparent',
        boxShadow: 'none',
        // ...
      },
    },
  },
  ```

- [ ] **Step 3: [T-C] Renderer 편집**

`packages/shared/src/renderers/LayoutRenderers.tsx:326` 주변 renderCard:

```diff
- variant={(element.props.variant as string) || "primary"}
+ isQuiet={Boolean(element.props.isQuiet)}
```

`data-quiet={isQuiet ? "true" : undefined}` 속성 전달 방식은 Card.tsx에서 처리 가능.

- [ ] **Step 4: Card.tsx Props interface 갱신**

`packages/shared/src/components/Card.tsx`:

- `variant?: ...` prop 제거
- `isQuiet?: boolean` 추가
- JSX 내부에서 `data-quiet={isQuiet ? "true" : undefined}` 속성 부여
- import 경로 `'./styles/Card.css'` → `'./styles/generated/Card.css'`

- [ ] **Step 5: [T-D] 수동 CSS 삭제**

```bash
git rm packages/shared/src/components/styles/Card.css
```

index.css import 갱신.

- [ ] **Step 6: [T-E] Consumer sweep — `variant="quiet"` → `isQuiet`**

```bash
grep -rn "Card.*variant=\"quiet\"\|variant: \"quiet\"" apps/ packages/ --include="*.tsx" --include="*.ts"
```

JSX `<Card variant="quiet">` → `<Card isQuiet>`. Object property `{variant: "quiet"}` → `{isQuiet: true}`.

기타 variant 값(`primary/secondary/tertiary`) 호출지 → 단순 속성 제거.

- [ ] **Step 7: [T-F] 검증**

```bash
pnpm build:specs 2>&1 | tail -5
pnpm type-check 2>&1 | tail -5
cat packages/shared/src/components/styles/generated/Card.css | grep -A5 "data-quiet"
```

generated CSS에 `[data-quiet="true"]` selector 블록 포함 확인.

- [ ] **Step 8: [T-G] Commit**

```bash
git add packages/specs/src/components/Card.spec.ts \
        packages/shared/src/components/{Card.tsx,styles/index.css} \
        packages/shared/src/components/styles/generated/Card.css \
        packages/shared/src/renderers/LayoutRenderers.tsx \
        apps/builder/src/types/builder/unified.types.ts

git rm packages/shared/src/components/styles/Card.css

git commit -m "$(cat <<'EOF'
refactor(adr-059): B2.5 Card — variant 제거 + isQuiet 보강 (ADR-062 선례 복제)

- Spec.variants 제거 (primary/secondary/tertiary/quiet)
- CardProps: variant prop 제거 + isQuiet?: boolean 추가
- Spec.containerVariants.quiet 신설 (data-quiet="true" selector)
- renderCard: variant → isQuiet 마이그레이션
- 수동 Card.css 삭제 → generated 전환
- JSX 호출지 variant="quiet" → isQuiet 마이그레이션

Cell (i-a+b): RSP S2 Card에 variant 없음, isQuiet 존재. ADR-062 Field isQuiet 구현 패턴 직접 복제.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase B2 완료 검증 Gate

### Task B2.6: B2 Gate 전체 검증 + PR 준비

- [ ] **Step 1: skipCSSGeneration:true 카운트 감소 확인**

```bash
cd /Users/admin/work/composition/.worktrees/adr-059-b2-variant-removal
grep -rn "skipCSSGeneration:\s*true" packages/specs/src/components/ --include="*.ts" | wc -l
```

B1 종료 27개 → B2 종료 22개 기대 (5 감소).

- [ ] **Step 2: 수동 CSS 5개 삭제 확인**

```bash
ls packages/shared/src/components/styles/{DropZone,Disclosure,Menu,Dialog,Card}.css 2>&1
```

모두 "No such file".

- [ ] **Step 3: 5 generated CSS 등장 확인**

```bash
ls packages/shared/src/components/styles/generated/{DropZone,Disclosure,Menu,Dialog,Card}.css
```

- [ ] **Step 4: type-check + build:specs**

```bash
pnpm type-check 2>&1 | tail -5
pnpm build:specs 2>&1 | tail -5
```

PASS 기대.

- [ ] **Step 5: Wrapper variant prop 제거 확인**

```bash
grep -n "data-variant\|variant=" packages/shared/src/renderers/LayoutRenderers.tsx | grep -iE "card|dialog|disclosure" | head
grep -n "variant=" packages/shared/src/renderers/FormRenderers.tsx | grep -i "dropzone" | head
grep -n "variant" packages/shared/src/renderers/CollectionRenderers.tsx | grep -i "menu" | head
```

모두 결과 없거나 (주석 내 historical만) — 실제 JSX variant 속성 전달 0 건.

- [ ] **Step 6: breakdown 문서 갱신**

Edit `docs/adr/design/059-composite-field-skip-css-dismantle-breakdown.md` — 5개 row에 "Implemented (B2)" 표기 + "B2 실행 결과" 섹션 신설 (B1 섹션 구조 복제).

- [ ] **Step 7: Commit docs**

```bash
git add docs/adr/design/059-composite-field-skip-css-dismantle-breakdown.md
git commit -m "docs(adr-059): B2 실행 결과 표기"
```

- [ ] **Step 8: Push + PR**

```bash
git push -u origin feature/adr-059-b2-variant-removal
# PR 본문은 B1 PR 템플릿 복제 — B2 지표 반영
```

PR 제목: `ADR-059 v2.1 B2 — DropZone/Disclosure/Menu/Dialog/Card variant 제거 (5 breaking)`

PR 본문 필수 포함:

- Summary (지표)
- Breaking changes 목록 (JSX `variant` prop 호출지 마이그레이션 가이드)
- Card isQuiet 마이그레이션 가이드
- Test plan (Storybook 5 컴포넌트 시각 확인 reviewer 요청)
- Known risks (surface variant 제거로 Disclosure 배경 통합, Dialog negative 제거 → alertdialog role 권장 등)

---

## Self-Review Checklist

- [x] **Spec coverage**: B0.2 판정 5개 전부 Task로 매핑 (DropZone/Disclosure/Menu/Dialog/Card)
- [x] **Placeholder scan**: "TBD" 없음. 공통 템플릿 [T-A]~[T-G] 참조로 반복 단계 압축. Task 본문은 컴포넌트별 차이점만 기록
- [x] **Type consistency**: 함수명 renderDropZone/renderDisclosure/renderMenu/renderDialog/renderCard 일관. Spec 파일 경로 / unified.types.ts 경로 일관
- [x] **File paths exact**: 5 컴포넌트 전부 spec/renderer/manual CSS/Props/index.css 경로 확정. 라인 번호는 discovery 결과 기반
- [x] **Gate 측정 가능**: skipCSSGeneration 27→22, 수동 CSS 5개 삭제, generated 5개 등장, type-check PASS, variant prop grep 0

### 알려진 공백

- **각 컴포넌트 Spec.variants 내부 구조 실측 미완**: Task 실행 시 Step 1 [T-A]에서 실측 후 상수 치환 범위 결정 (Slot B1.8 패턴 차용)
- **Card isQuiet containerVariants 구체 styles**: 기존 Card.css `[variant=quiet]` 블록 내용을 발췌 + containerVariants 스키마로 이관. Task 실행 시 직접 대조
- **Menu children (MenuItem/MenuTrigger)**: 독립 spec인지 Menu 내장인지 확인 필요 — Task B2.3 Step 1에서 확정
- **JSX 호출지 마이그레이션 규모**: grep 결과에 따라 소규모(demo/Storybook 1-2건)일 수도, 대규모(Builder UI 대량)일 수도. 대규모 시 각 Task 내 Step 6 세부 재설계

---

## 실행 옵션

**Plan complete and saved to `docs/superpowers/plans/2026-04-14-adr059-b2-variant-removal-batch.md`. 두 실행 옵션:**

**1. Subagent-Driven (권장)** — Task별 fresh implementer subagent. 특히 Card(B2.5)는 복합 변경으로 isQuiet 구현 선례 참조 필요하여 단독 subagent 적합.

**2. Inline Execution** — executing-plans 사용. 각 Task 간 checkpoint 리뷰로 breaking change 호출지 확인 필요 시 적합.

**어느 쪽으로 진행할까요?**
