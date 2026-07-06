# Taffy 완전 제거 (ADR-916 endgame) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Taffy 3-crate 중 2개(`composition-layout` / `composition-wasm`)와 Taffy 소비 JS(로더/폴백/worker/dual-run leg)를 전면 물리 삭제하고, 자체 엔진(`composition-engine`) 단독 운영으로 전환한다.

**Architecture:** 재배선 → 삭제 순서로 파손 구간을 최소화한다. (1) 타입 소스 이전(`LayoutResult` → `compositionEngine.ts`, `TaffyStyle` 계열 → 신규 `layoutTypes.ts`)을 가장 먼저 수행해 `taffyLayout.ts` 삭제가 live 파일을 깨지 않게 하고, (2) live 경로 재배선(layoutBridge 폴백 제거 / bootstrap·fullTreeLayout 게이트 심볼 치환 / init·featureFlags 정리)을 끝낸 뒤, (3) JS 본체 `git rm`, (4) Rust crate + pkg 산출물 물리 삭제, (5) build 스크립트 정리, (6) 전수 grep + type-check + cargo + **live behavior exercise** 로 종결한다. 매 태스크 종료 시점에 type-check 는 green(baseline 초과 0)을 유지한다.

**Tech Stack:** TypeScript (Vite + React 19), Rust (wasm-pack / wasm-bindgen), Vitest, cargo test, Chrome MCP (live 검증).

**Source spec:** [docs/superpowers/specs/2026-07-06-taffy-complete-removal-design.md](../specs/2026-07-06-taffy-complete-removal-design.md)

## Global Constraints

- **Git 정책 (CRITICAL)**: 모든 commit 은 `main` 직접 + `git push origin main`. PR / branch 분기 / `gh pr create` 절대 금지. 파일 삭제는 전부 `git rm` (히스토리 복구 가능 유지). 모든 commit 메시지 말미에 `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>` 필수.
- **type-check baseline**: `pnpm -F @composition/builder type-check` (baseline wrapper, 현 baseline 69건 소스 전용) — **신규 위반 0** 이어야 통과. 매 태스크 종료 시 실행.
- **완료 기준 (CRITICAL)**: type-check / cargo test / vitest PASS 단독으로 종결 금지 — Task 7 의 Chrome MCP **live behavior exercise** (builder 실부팅 + `[ADR-916] composition-engine WASM initialized` 로그 + Canvas↔CSS 시각 정합) 통과 전에는 push / 완료 선언 불가.
- **보존 파일 (삭제 금지)**: `layout/engines/TaffyFlexEngine.ts` / `TaffyBlockEngine.ts` / `TaffyGridEngine.ts` (이름만 Taffy — 순수 JS element→style 변환기, `fullTreeLayout.ts:41-43` live import, 자체 엔진이 이 변환 결과를 소비) + `persistentTaffyTree.ts` (파일명 rename 은 본 scope 밖).
- **존치 대상**: `packages/composition-engine/` (자체 엔진 crate), 루트 `wasm:build:engine` 스크립트, `prepare:wasm` 스크립트(CanvasKit 전용 — Taffy 무관), `UNIFIED_ENGINE_FLAGS.USE_RUST_LAYOUT_ENGINE` key (제거 시 `isUnifiedFlag("USE_RUST_LAYOUT_ENGINE")` 호출부가 union 타입에서 빠져 컴파일 에러 — key 유지가 최소 변경).
- **폴백 신규 작성 금지 (설계 Q1=B)**: Taffy 폴백 제거 후 JS 폴백 등 대체 폴백 코드를 새로 작성하지 않는다. 기존 15초 폴링/재시도 부트스트랩 구조가 그대로 보상 수단.
- 태스크당 commit 1개 (총 7 commit). push 는 Task 7 live exercise 통과 후 일괄 1회.

## 실측 보정 (spec 대비 확장 — 2026-07-06 planning 세션)

spec R3 은 `LayoutResult` 재배치만 명시했으나, 실측 grep 결과 `taffyLayout.ts` 의 타입 소비처가 더 넓다. **보존 파일들이 `TaffyStyle` / `TaffyNodeHandle` 을 import 중** — 아래 4곳이 Task 1 에 추가 흡수됐다:

| 파일                                    | 라인  | import 심볼                       | 재배선 대상                               |
| --------------------------------------- | ----- | --------------------------------- | ----------------------------------------- |
| `layout/engines/TaffyFlexEngine.ts`     | 13    | `TaffyStyle`                      | 신규 `layoutTypes.ts`                     |
| `layout/engines/TaffyBlockEngine.ts`    | 14    | `TaffyStyle`                      | 신규 `layoutTypes.ts`                     |
| `layout/engines/fullTreeLayout.ts`      | 15    | `TaffyStyle`                      | 신규 `layoutTypes.ts`                     |
| `layout/engines/persistentTaffyTree.ts` | 29-32 | `TaffyNodeHandle`, `LayoutResult` | `layoutTypes.ts` + `compositionEngine.ts` |

추가 실측 2건도 계획에 반영됨:

- `fullTreeLayout.ts:16` 이 `isRustWasmReady` 를 **live layout 게이트**(line 2188 `if (!isRustWasmReady()) return null;`)로 사용 중 → Task 2 에서 `isCompositionEngineReady` 로 치환 (누락 시 rustWasm.ts 삭제로 컴파일 파손, 치환 누락 시 layout 전면 미실행).
- `wasm-bindings/pkg/` 는 `.gitignore` 1개만 git 추적 — 452K WASM 산출물은 untracked 라 `git rm -r` + `rm -rf` 병행 필요 (Task 5). `apps/builder/tsconfig.app.json:17-18` 의 exclude 2건도 삭제 대상 경로 참조라 함께 정리.

---

### Task 1: Layout 타입 소스 이전 (LayoutResult / TaffyStyle 계열 / TaffyNodeHandle)

`taffyLayout.ts` 가 삭제되기 전에, 그 안의 **순수 타입 정의**를 존치 파일로 옮기고 모든 live 소비처의 import 를 재배선한다. 이 태스크가 끝나면 `taffyLayout.ts` 를 import 하는 live 파일은 `layoutBridge.ts` 의 `TaffyLayout` class import 1건(Task 2 처리)만 남는다.

**Files:**

- Create: `apps/builder/src/builder/workspace/canvas/wasm-bindings/layoutTypes.ts`
- Modify: `apps/builder/src/builder/workspace/canvas/wasm-bindings/compositionEngine.ts`
- Modify: `apps/builder/src/builder/workspace/canvas/wasm-bindings/layoutBridge.ts:12`
- Modify: `apps/builder/src/builder/workspace/canvas/layout/engines/persistentTaffyTree.ts:24,29-32`
- Modify: `apps/builder/src/builder/workspace/canvas/layout/engines/TaffyFlexEngine.ts:13`
- Modify: `apps/builder/src/builder/workspace/canvas/layout/engines/TaffyBlockEngine.ts:14`
- Modify: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts:15`

**Interfaces:**

- Consumes: `taffyLayout.ts` 의 기존 타입 정의 (원문 복사 소스 — 이 태스크에서는 **삭제하지 않음**, 삭제는 Task 4)
- Produces:
  - `compositionEngine.ts` → `export interface LayoutResult { x: number; y: number; width: number; height: number; }` (Task 2 의 layoutBridge, Task 4 이후 persistentTaffyTree 가 이 소스에서 import)
  - `layoutTypes.ts` → `export interface TaffyStyle`, `export type TaffyNodeHandle = number` 외 스타일 타입 alias 전부

- [ ] **Step 1: 원문 대조 — taffyLayout.ts 의 타입 정의 정독**

`apps/builder/src/builder/workspace/canvas/wasm-bindings/taffyLayout.ts` 의 **13-176행**을 Read 로 정독한다. 아래 Step 2/3 의 코드는 2026-07-06 실측 원문이지만, 구현 시점에 반드시 파일 원문과 대조 후 **verbatim 복사**한다 (필드 추가/삭제가 있었다면 원문이 정본).

- [ ] **Step 2: layoutTypes.ts 신규 생성**

`apps/builder/src/builder/workspace/canvas/wasm-bindings/layoutTypes.ts` 를 아래 내용으로 생성한다 (타입 본문은 taffyLayout.ts 13-163행 + 175-176행 verbatim — PostToolUse Prettier hook 이 인용부호를 정규화할 수 있으며 이는 무해):

```ts
/**
 * Layout 스타일/핸들 타입 정의 (구 taffyLayout.ts 에서 이전)
 *
 * ADR-916 Taffy 완전 제거 (2026-07-06): TaffyLayout wrapper 삭제 후에도
 * element→style 변환기(TaffyFlexEngine/TaffyBlockEngine)와 fullTreeLayout /
 * persistentTaffyTree 가 소비하는 순수 TypeScript 타입만 본 파일에 보존한다.
 * "Taffy" 접두 네이밍은 스타일 스키마 계보 표기로 유지 — 자체 엔진
 * (composition-engine) 의 Rust `StyleInput` 스키마와 1:1 대응한다.
 */

export type TaffyDisplay = "flex" | "grid" | "block" | "none";
export type TaffyPosition = "relative" | "absolute";
export type TaffyOverflow = "visible" | "hidden" | "clip" | "scroll";
export type TaffyFlexDirection =
  | "row"
  | "column"
  | "row-reverse"
  | "column-reverse";
export type TaffyFlexWrap = "nowrap" | "wrap" | "wrap-reverse";
export type TaffyJustifyContent =
  | "flex-start"
  | "flex-end"
  | "center"
  | "space-between"
  | "space-around"
  | "space-evenly"
  | "start"
  | "end"
  | "stretch";
export type TaffyAlignItems =
  | "flex-start"
  | "flex-end"
  | "center"
  | "stretch"
  | "baseline"
  | "start"
  | "end";
export type TaffyAlignContent =
  | "flex-start"
  | "flex-end"
  | "center"
  | "stretch"
  | "space-between"
  | "space-around"
  | "space-evenly"
  | "start"
  | "end";
export type TaffyAlignSelf =
  | "auto"
  | "flex-start"
  | "flex-end"
  | "center"
  | "stretch"
  | "baseline"
  | "start"
  | "end";
export type TaffyGridAutoFlow = "row" | "column" | "row-dense" | "column-dense";
export type TaffyJustifyItems =
  | "start"
  | "end"
  | "center"
  | "stretch"
  | "baseline"
  | "flex-start"
  | "flex-end";
export type TaffyJustifySelf =
  | "auto"
  | "start"
  | "end"
  | "center"
  | "stretch"
  | "baseline"
  | "flex-start"
  | "flex-end";

/** CSS-like dimension value: "100px", "50%", "auto", plain number (treated as px). */
export type TaffyDimensionValue = string | number;

/** Grid track definition: "1fr", "100px", "auto", "minmax(100px, 1fr)". */
export type TaffyTrackValue = string;

/** Grid placement: "1", "span 2", "auto", or a number. */
export type TaffyGridPlacement = string | number;

/**
 * Taffy style input matching the Rust `StyleInput` schema.
 * All fields are optional — unset fields use Taffy's Style::DEFAULT.
 */
export interface TaffyStyle {
  // Display & position
  display?: TaffyDisplay;
  position?: TaffyPosition;
  overflowX?: TaffyOverflow;
  overflowY?: TaffyOverflow;

  // Flex container
  flexDirection?: TaffyFlexDirection;
  flexWrap?: TaffyFlexWrap;
  justifyContent?: TaffyJustifyContent;
  justifyItems?: TaffyJustifyItems;
  alignItems?: TaffyAlignItems;
  alignContent?: TaffyAlignContent;

  // Flex item
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: TaffyDimensionValue;
  alignSelf?: TaffyAlignSelf;
  justifySelf?: TaffyJustifySelf;
  order?: number;

  // Grid container
  gridTemplateColumns?: TaffyTrackValue[];
  gridTemplateRows?: TaffyTrackValue[];
  gridAutoFlow?: TaffyGridAutoFlow;
  gridAutoColumns?: TaffyTrackValue[];
  gridAutoRows?: TaffyTrackValue[];

  // Grid item
  gridColumnStart?: TaffyGridPlacement;
  gridColumnEnd?: TaffyGridPlacement;
  gridRowStart?: TaffyGridPlacement;
  gridRowEnd?: TaffyGridPlacement;

  // Size
  width?: TaffyDimensionValue;
  height?: TaffyDimensionValue;
  minWidth?: TaffyDimensionValue;
  minHeight?: TaffyDimensionValue;
  maxWidth?: TaffyDimensionValue;
  maxHeight?: TaffyDimensionValue;

  // Margin
  marginTop?: TaffyDimensionValue;
  marginRight?: TaffyDimensionValue;
  marginBottom?: TaffyDimensionValue;
  marginLeft?: TaffyDimensionValue;

  // Padding
  paddingTop?: TaffyDimensionValue;
  paddingRight?: TaffyDimensionValue;
  paddingBottom?: TaffyDimensionValue;
  paddingLeft?: TaffyDimensionValue;

  // Border
  borderTop?: TaffyDimensionValue;
  borderRight?: TaffyDimensionValue;
  borderBottom?: TaffyDimensionValue;
  borderLeft?: TaffyDimensionValue;

  // Inset (position offsets)
  insetTop?: TaffyDimensionValue;
  insetRight?: TaffyDimensionValue;
  insetBottom?: TaffyDimensionValue;
  insetLeft?: TaffyDimensionValue;

  // Gap
  columnGap?: TaffyDimensionValue;
  rowGap?: TaffyDimensionValue;

  // Aspect ratio
  aspectRatio?: number;
}

/** Opaque handle to a layout node. (구 TaffyNodeHandle — 자체 엔진 handle 과 동일 규약) */
export type TaffyNodeHandle = number;
```

주의: `LayoutResult` 는 이 파일에 넣지 **않는다** — Step 3 에서 `compositionEngine.ts` 로 이전 (설계 R3 결정).

- [ ] **Step 3: compositionEngine.ts — LayoutResult 정의 이전 + stale import 제거**

`compositionEngine.ts` 의 import 블록(27-32행)을 수정한다. `LayoutResult` 본문은 taffyLayout.ts **165-171행** 원문에서 verbatim 복사 (실측 shape: x/y/width/height 4필드 number).

Before:

```ts
import {
  getCompositionEngineWasm,
  isCompositionEngineReady,
  type RawCompositionLayoutEngine,
} from "./compositionEngineWasm";
import type { LayoutResult } from "./taffyLayout";
```

After:

```ts
import {
  getCompositionEngineWasm,
  isCompositionEngineReady,
  type RawCompositionLayoutEngine,
} from "./compositionEngineWasm";

/**
 * Computed layout result for a single node.
 * (구 taffyLayout.ts:166 — ADR-916 Taffy 완전 제거로 본 파일이 타입 소스)
 */
export interface LayoutResult {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

- [ ] **Step 4: compositionEngine.ts — 삭제 예정 파일을 가리키는 주석 정리**

같은 파일 header 주석에서 곧 삭제될 파일 참조 3곳을 정리한다.

Before (13-15행):

```ts
 * wrapper 는 이름 매핑 없이 raw 반환(Uint32Array/Float32Array)만 number[]/Map 으로
 * 변환한다. 이는 dualRunEngines.ts `adaptSelfEngine`(테스트 fixture 어댑터)과 동일
 * 로직 — 런타임 wrapper 로 승격.
```

After:

```ts
 * wrapper 는 이름 매핑 없이 raw 반환(Uint32Array/Float32Array)만 number[]/Map 으로
 * 변환한다.
```

Before (23-24행):

```ts
 * @see apps/builder/.../wasm-bindings/taffyLayout.ts (taffy 대응 wrapper)
 * @see apps/builder/.../layout/engines/dualRunEngines.ts (adaptSelfEngine — 동일 변환)
```

After: 두 줄 삭제.

Before (39-40행, `flatToLayoutMap` doc):

```ts
 * `Map<handle, LayoutResult>` 로 재구성한다(taffyLayout.ts::getLayoutsBatch 와 동일
 * 규약 — handle 당 4값).
```

After:

```ts
 * `Map<handle, LayoutResult>` 로 재구성한다(handle 당 4값).
```

참고: 본문 prose 의 "taffy `TaffyLayout` 은 ..." 류 역사 서술(8-12행, 21행)은 삭제 파일을 직접 가리키지 않으므로 유지 허용.

- [ ] **Step 5: layoutBridge.ts — LayoutResult import 소스 교체**

Before (12행):

```ts
import type { LayoutResult } from "./taffyLayout";
```

After:

```ts
import type { LayoutResult } from "./compositionEngine";
```

(11행의 `import { TaffyLayout } from "./taffyLayout";` 은 이 태스크에서 **건드리지 않는다** — Task 2 에서 함수 본문과 함께 제거.)

- [ ] **Step 6: persistentTaffyTree.ts — import 재배선 + 주석 갱신**

Before (29-32행):

```ts
import type {
  TaffyNodeHandle,
  LayoutResult,
} from "../../wasm-bindings/taffyLayout";
```

After:

```ts
import type { LayoutResult } from "../../wasm-bindings/compositionEngine";
import type { TaffyNodeHandle } from "../../wasm-bindings/layoutTypes";
```

Before (24행, header 주석):

```ts
 * @see taffyLayout.ts — TaffyLayout.updateStyleRaw(), TaffyLayout.createNodeRaw()
```

After:

```ts
 * @see compositionEngine.ts — CompositionEngineLayout.updateStyleRaw() / createNodeRaw()
```

- [ ] **Step 7: TaffyFlexEngine / TaffyBlockEngine / fullTreeLayout — TaffyStyle import 소스 교체**

3개 파일에서 동일 패턴 치환 (각 파일 1줄):

`TaffyFlexEngine.ts:13` / `TaffyBlockEngine.ts:14` / `fullTreeLayout.ts:15` Before:

```ts
import type { TaffyStyle } from "../../wasm-bindings/taffyLayout";
```

After:

```ts
import type { TaffyStyle } from "../../wasm-bindings/layoutTypes";
```

(`fullTreeLayout.ts:16` 의 `isRustWasmReady` import 는 이 태스크에서 건드리지 않는다 — Task 2.)

- [ ] **Step 8: 검증 — grep + type-check**

Run:

```bash
grep -rn "wasm-bindings/taffyLayout\|from \"./taffyLayout\"" apps/builder/src --include="*.ts" --include="*.tsx"
```

Expected: 정확히 아래 파일들만 hit (전부 후속 태스크 처리 대상) —

- `wasm-bindings/layoutBridge.ts:11` (`TaffyLayout` class import — Task 2 제거)
- `layout/engines/dualRunEngines.ts` / `dualRunHarness.ts` / `dualRunHarness.test.ts` / `persistentTaffyTree.seam.test.ts` (Task 4 삭제 대상)

Run:

```bash
pnpm -F @composition/builder type-check
```

Expected: exit 0, 신규 위반 0 (baseline 정합).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor(adr-916): endgame 1/7 — layout 타입 소스 이전 (LayoutResult→compositionEngine, TaffyStyle 계열→layoutTypes)

taffyLayout.ts 삭제 선행 조건. 보존 파일(TaffyFlex/BlockEngine,
fullTreeLayout, persistentTaffyTree) 의 타입 import 를 신규 소스로 재배선.
검증: type-check 신규 위반 0 + taffyLayout import 잔존 grep = bridge 1건
+ 삭제 예정 dualRun 계열만.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: 자체 엔진 단독 경로 재배선 (layoutBridge 폴백 제거 + bootstrap/fullTreeLayout 게이트 치환)

live hot path 3파일에서 Taffy 심볼을 제거한다. 이 태스크가 끝나면 **런타임에서 Taffy 코드를 실행할 수 있는 경로가 0** 이 된다 (파일 자체는 Task 4 에서 삭제). R2(부팅 게이트 미스와이어링) 의 핵심 구간 — 심볼 치환 5곳 전부 누락 없이.

**Files:**

- Modify: `apps/builder/src/builder/workspace/canvas/wasm-bindings/layoutBridge.ts` (전면 재작성)
- Modify: `apps/builder/src/builder/workspace/canvas/hooks/useCanvasRuntimeBootstrap.ts:3,23-25,43-44,64,76`
- Modify: `apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts:16,2188`

**Interfaces:**

- Consumes: Task 1 의 `compositionEngine.ts::LayoutResult`, 기존 `compositionEngineWasm.ts::initCompositionEngineWasm / isCompositionEngineReady`
- Produces: `createLayoutEngine(): LayoutEngineAPI` — 자체 엔진 단독 반환 (폴백 없음). `LayoutEngineAPI` interface 는 **변경 없이 유지** (persistentTaffyTree.ts 소비 seam 계약).

- [ ] **Step 1: layoutBridge.ts 전면 재작성**

파일 전체를 아래 내용으로 교체한다. `LayoutEngineAPI` interface 본문은 기존 27-49행 그대로 (계약 불변):

```ts
/**
 * Layout Engine Bridge (ADR-100 / ADR-916)
 *
 * PersistentTaffyTree 의 엔진 주입 지점(factory).
 *
 * **ADR-916 Taffy 완전 제거 (2026-07-06)**: TaffyLayout 폴백 경로 삭제 — 자체
 * 엔진(composition-engine, taffy-free)을 단독 반환한다. WASM 미준비(startup
 * init 전 호출 / 로드 실패) 시에도 폴백 없이 엔진 인스턴스를 반환하며,
 * `isAvailable()` lazy re-init + useCanvasRuntimeBootstrap 의 15초 폴링/재시도가
 * 준비를 담당한다 (설계 Q1=B — 폴백 코드 신규 작성 없음).
 */

import { CompositionEngineLayout } from "./compositionEngine";
import type { LayoutResult } from "./compositionEngine";

/**
 * Common layout engine interface (ADR-916 Phase 0-A seam).
 *
 * PersistentTaffyTree 가 실제로 호출하는 batch 계약을 반영한다.
 * Taffy 완전 제거 후 자체 엔진(CompositionEngineLayout)이 이 계약의 유일 구현.
 *
 * **Why batch 계약** (2026-07-03 실사): 기존 인터페이스는 per-node API
 * (createNode/computeLayout/getLayout) 만 선언했으나, PersistentTaffyTree 는
 * buildTreeBatch/getLayoutsBatch/setChildren/updateStyleRaw 등 batch 메서드를
 * 호출한다. 인터페이스가 실사용과 불일치하면 엔진 주입 시 타입 갭 발생 →
 * seam 이 성립하지 않는다. 실사용 batch 계약으로 정합.
 */
export interface LayoutEngineAPI {
  isAvailable(): boolean;

  // ── batch tree 구축 (PersistentTaffyTree.buildFull 경유) ──
  buildTreeBatch(nodesJson: string): number[];
  buildTreeBatchBinary(data: Uint8Array): number[];
  hasBinaryProtocol(): boolean;

  // ── 증분 갱신 ──
  createNodeRaw(styleJson: string): number;
  updateStyleRaw(handle: number, styleJson: string): void;
  setChildren(handle: number, children: number[]): void;
  markDirty(handle: number): void;
  removeNode(handle: number): void;

  // ── 레이아웃 계산/수집 ──
  computeLayout(root: number, availW: number, availH: number): void;
  getLayoutsBatch(handles: number[]): Map<number, LayoutResult>;

  // ── 상태 ──
  clear(): void;
  nodeCount(): number;
}

/**
 * Layout engine factory — 자체 엔진 단독 반환.
 *
 * WASM 미준비 시에도 엔진 인스턴스를 반환한다: 미준비 상태의 메서드 호출은
 * throw 되고, `isAvailable()` 이 lazy re-init 을 시도하며, 부트스트랩의
 * 15초 폴링/재시도가 준비를 대기한다. Taffy 폴백 없음 (ADR-916 R4 소멸).
 */
export function createLayoutEngine(): LayoutEngineAPI {
  return new CompositionEngineLayout() as unknown as LayoutEngineAPI;
}
```

핵심 diff: `import { TaffyLayout }` / `import { isUnifiedFlag }` 제거, `createLayoutEngine()` 의 flag 분기 + `isAvailable()` 조건 반환 + `new TaffyLayout()` 폴백(구 84행) 제거.

- [ ] **Step 2: useCanvasRuntimeBootstrap.ts — 심볼 치환 5곳 (폴링/재시도 구조는 그대로)**

**구조 변경 금지** — 15초 폴링/backoff/5초 재초기화 로직과 `wasmLayout*` 변수명(자체 엔진 준비 상태 의미)은 전부 유지 (설계 Q1=B). 심볼만 치환한다.

Hunk A — import (3행). Before:

```ts
import { initRustWasm, isRustWasmReady } from "../wasm-bindings/rustWasm";
```

After:

```ts
import {
  initCompositionEngineWasm,
  isCompositionEngineReady,
} from "../wasm-bindings/compositionEngineWasm";
```

Hunk B — useState 초기값 (23-25행). Before:

```ts
const [wasmLayoutReady, setWasmLayoutReady] = useState(() => isRustWasmReady());
```

After:

```ts
const [wasmLayoutReady, setWasmLayoutReady] = useState(() =>
  isCompositionEngineReady(),
);
```

Hunk C — UNIFIED_ENGINE 직접 초기화 effect (43-44행). Before:

```ts
    void initRustWasm().then(() => {
      if (isRustWasmReady()) {
```

After:

```ts
    void initCompositionEngineWasm().then(() => {
      if (isCompositionEngineReady()) {
```

Hunk D — poll 함수 준비 판정 (64행). Before:

```ts
      if (isRustWasmReady()) {
```

After:

```ts
      if (isCompositionEngineReady()) {
```

Hunk E — 5초 재초기화 (76행). Before:

```ts
void initRustWasm();
```

After:

```ts
void initCompositionEngineWasm();
```

편집 후 파일 내 확인: `grep -c "isCompositionEngineReady\|initCompositionEngineWasm"` 결과 **6** (import 2 + 사용 4). `isRustWasmReady`/`initRustWasm` 잔존 0.

- [ ] **Step 3: fullTreeLayout.ts — live layout 게이트 치환 (실측 보정 항목)**

Hunk A — import (16행). Before:

```ts
import { isRustWasmReady } from "../../wasm-bindings/rustWasm";
```

After:

```ts
import { isCompositionEngineReady } from "../../wasm-bindings/compositionEngineWasm";
```

Hunk B — WASM 가용성 게이트 (2188행 부근). Before:

```ts
// WASM 가용성 확인
if (!isRustWasmReady()) return null;
```

After:

```ts
// WASM 가용성 확인 (자체 엔진 — ADR-916 Taffy 완전 제거)
if (!isCompositionEngineReady()) return null;
```

편집 후 파일 내 확인: `grep -n "isRustWasmReady" apps/builder/src/builder/workspace/canvas/layout/engines/fullTreeLayout.ts` → 0건.

- [ ] **Step 4: 검증 — grep + type-check**

Run:

```bash
grep -rn "new TaffyLayout(\|isRustWasmReady\|initRustWasm\|getRustWasm" apps/builder/src --include="*.ts" --include="*.tsx"
```

Expected: hit 가 아래 파일에만 존재 —

- `wasm-bindings/taffyLayout.ts` / `wasm-bindings/rustWasm.ts` (자기 정의부 — Task 4 삭제)
- `wasm-bindings/init.ts` (Task 3 처리)
- `wasm-worker/*` · `layout/engines/dualRun*` · `persistentTaffyTree.seam.test.ts` (Task 4 삭제)

live 재배선 3파일(layoutBridge / useCanvasRuntimeBootstrap / fullTreeLayout)에서 0건이면 통과.

Run:

```bash
pnpm -F @composition/builder type-check
```

Expected: exit 0, 신규 위반 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(adr-916): endgame 2/7 — 자체 엔진 단독 경로 재배선 (Taffy 폴백 제거)

createLayoutEngine() 자체 엔진 단독 반환(폴백 경로 삭제, Q1=B).
bootstrap + fullTreeLayout 게이트 isRustWasmReady→isCompositionEngineReady
치환 5+2곳 — 15초 폴링/재시도 구조는 그대로 유지.
검증: type-check 신규 위반 0 + live 3파일 Taffy 심볼 grep 0.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: init.ts Taffy 로드 경로 제거 + featureFlags 정리

startup 에서 Taffy pkg(rustWasm) 로드와 dead Layout Worker 경로를 제거하고, dead flag 2개를 삭제한다.

**Files:**

- Modify: `apps/builder/src/builder/workspace/canvas/wasm-bindings/init.ts` (전면 재작성)
- Modify: `apps/builder/src/builder/workspace/canvas/wasm-bindings/featureFlags.ts:14-18,36-42`

**Interfaces:**

- Consumes: `compositionEngineWasm.ts::initCompositionEngineWasm / isCompositionEngineReady`, `featureFlags.ts::isUnifiedFlag / WASM_FLAGS`
- Produces: `initAllWasm(): Promise<void>` / `isWasmReady(): boolean` — 시그니처 불변 (호출부 영향 0). `WASM_FLAGS` 에서 `LAYOUT_ENGINE` / `LAYOUT_WORKER` key 소멸. `USE_RUST_LAYOUT_ENGINE` key 는 **유지** (CRITICAL — 제거 시 `isUnifiedFlag("USE_RUST_LAYOUT_ENGINE")` (init.ts) 가 `UnifiedEngineFlag` union 에서 빠져 컴파일 에러. `isUnifiedFlag` 는 `UNIFIED_ENGINE:true` 일 때 어떤 flag 든 true 를 반환하므로(66행) key 존치가 동작 불변 + 최소 변경).

- [ ] **Step 1: init.ts 전면 재작성**

Taffy pkg 로드 블록(구 22-25행)과 LAYOUT_WORKER 블록(구 59-73행)을 제거한다. composition-engine 로드 블록(구 34-48행)과 CanvasKit 블록(구 51-54행)은 유지. 파일 전체를 아래로 교체:

```ts
/**
 * WASM 모듈 통합 초기화
 *
 * composition-engine(자체 layout 엔진 + SpatialIndex)과 CanvasKit 을 병렬로
 * 초기화한다.
 *
 * ADR-916 Taffy 완전 제거 (2026-07-06): Taffy pkg(rustWasm) 로드 블록 +
 * Layout Worker(LAYOUT_WORKER:false, dead) 블록 삭제 — 자체 엔진 단일 로드.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §WASM 초기화 통합
 */

let wasmReady = false;

export async function initAllWasm(): Promise<void> {
  if (wasmReady) return;

  try {
    const { WASM_FLAGS } = await import("./featureFlags");
    const tasks: Promise<void>[] = [];

    // composition-engine(자체 taffy-free 엔진) WASM.
    // createLayoutEngine()(동기)이 전역 캐시를 읽으려면 startup 에서 먼저
    // await 돼 있어야 한다. SpatialIndex(같은 pkg 에 crate 분리 편입) 초기화도
    // 여기서 — 한 번의 로드로 둘 다 준비된다.
    {
      const { isUnifiedFlag } = await import("./featureFlags");
      if (isUnifiedFlag("USE_RUST_LAYOUT_ENGINE")) {
        const { initCompositionEngineWasm, isCompositionEngineReady } =
          await import("./compositionEngineWasm");
        tasks.push(
          initCompositionEngineWasm().then(async () => {
            if (isCompositionEngineReady() && WASM_FLAGS.SPATIAL_INDEX) {
              const { initSpatialIndex } = await import("./spatialIndex");
              initSpatialIndex();
            }
          }),
        );
      }
    }

    // CanvasKit/Skia WASM (메인 렌더러)
    if (WASM_FLAGS.CANVASKIT_RENDERER) {
      const { initCanvasKit } = await import("../skia/initCanvasKit");
      tasks.push(initCanvasKit().then(() => {}));
    }

    await Promise.all(tasks);
    wasmReady = true;
  } catch (error) {
    console.error("[WASM] 초기화 실패:", error);
  }
}

export function isWasmReady(): boolean {
  return wasmReady;
}
```

(구 catch 메시지 "JS 폴백 사용" 은 폴백 소멸에 맞춰 문구 수정.)

- [ ] **Step 2: featureFlags.ts — dead flag 2개 제거**

Before (10-25행):

```ts
export const WASM_FLAGS = {
  /** Phase 1: SpatialIndex WASM 가속 (Rust wasm-pack 빌드 필요) */
  SPATIAL_INDEX: true,

  /** Phase 2: Layout Engine WASM 가속 (TaffyFlexEngine, TaffyGridEngine 의존) */
  LAYOUT_ENGINE: true,

  /** Phase 4: Layout Worker (Rust WASM 초기화 필요) */
  LAYOUT_WORKER: false,

  /** Phase 5: CanvasKit/Skia 렌더러 활성화 */
  CANVASKIT_RENDERER: true,

  /** Phase 6: 이중 Surface 캐싱 + Dirty Rect 렌더링 */
  DUAL_SURFACE_CACHE: true,
} as const;
```

After:

```ts
export const WASM_FLAGS = {
  /** SpatialIndex WASM 가속 (composition-engine pkg — ADR-916 crate 분리 편입) */
  SPATIAL_INDEX: true,

  /** CanvasKit/Skia 렌더러 활성화 */
  CANVASKIT_RENDERER: true,

  /** 이중 Surface 캐싱 + Dirty Rect 렌더링 */
  DUAL_SURFACE_CACHE: true,
} as const;
```

- [ ] **Step 3: featureFlags.ts — USE_RUST_LAYOUT_ENGINE 주석 현행화 (key 는 유지)**

Before (36-42행):

```ts
  // Phase 1: Layout Engine 교체
  // ADR-916 Phase 2-B seam C-2a (2026-07-04): 자체 taffy-free 엔진
  // (composition-engine) 으로 전환. dualRunLive 12/12(실전 대표 8형상 diff 0)
  // proof 확보 후 flip. rollback = 이 값을 false + UNIFIED_ENGINE global override
  // 확인(현재 UNIFIED_ENGINE:true 라 isUnifiedFlag 가 이미 true 반환 → 실제 rollback
  // 은 createLayoutEngine 진입 차단 또는 UNIFIED_ENGINE 조정 필요).
  USE_RUST_LAYOUT_ENGINE: true,
```

After:

```ts
  // Phase 1: Layout Engine — ADR-916 Taffy 완전 제거(2026-07-06) 후 자체 엔진
  // (composition-engine)이 상시 단독 경로. key 자체를 제거하면 init.ts 의
  // isUnifiedFlag("USE_RUST_LAYOUT_ENGINE") 가 UnifiedEngineFlag union 에서
  // 빠져 컴파일 에러 — 소비처 영향 최소화를 위해 key 를 상수 true 로 유지한다.
  USE_RUST_LAYOUT_ENGINE: true,
```

`USE_RUST_LAYOUT_ENGINE: true` 값 자체와 `isUnifiedFlag()` 함수(65-68행)는 **절대 변경 금지**.

- [ ] **Step 4: 검증 — 소비처 grep + type-check**

Run:

```bash
grep -rn "WASM_FLAGS.LAYOUT_ENGINE\|WASM_FLAGS.LAYOUT_WORKER\|LAYOUT_WORKER" apps/builder/src --include="*.ts" --include="*.tsx"
```

Expected: `wasm-worker/index.ts:17` 주석 1건만 (Task 4 에서 디렉토리째 삭제 예정). 그 외 0건 — 다른 소비처 발견 시 **삭제 진행 금지**, 해당 소비처 재배선 먼저.

Run:

```bash
pnpm -F @composition/builder type-check
```

Expected: exit 0, 신규 위반 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(adr-916): endgame 3/7 — init/featureFlags Taffy 로드 경로 제거

startup 의 Taffy pkg(rustWasm) 로드 + dead LAYOUT_WORKER 블록 삭제.
WASM_FLAGS 에서 LAYOUT_ENGINE/LAYOUT_WORKER key 제거.
USE_RUST_LAYOUT_ENGINE key 는 isUnifiedFlag union 정합 위해 상수 true 유지.
검증: type-check 신규 위반 0 + WASM_FLAGS.LAYOUT_* 소비처 grep 0.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Taffy 소비 JS 본체 삭제 (git rm) + 잔존 주석 정리

Task 1-3 재배선으로 참조가 0 이 된 JS 파일 9건 + wasm-worker 디렉토리를 삭제한다. 이 시점 이후 `wasm-bindings/pkg/`(composition_wasm 산출물)를 import 하는 소스는 0 — Task 5 crate/pkg 삭제의 선행 조건 충족.

**Files:**

- Delete: `apps/builder/src/builder/workspace/canvas/wasm-bindings/taffyLayout.ts`
- Delete: `apps/builder/src/builder/workspace/canvas/wasm-bindings/rustWasm.ts`
- Delete: `apps/builder/src/builder/workspace/canvas/wasm-bindings/layoutEngine.ts` (Phase 0-A 폐기 `compositionLayout` — import 소비처 0 실측 확인됨)
- Delete: `apps/builder/src/builder/workspace/canvas/wasm-worker/` 전체 (bridge.ts / index.ts / LayoutScheduler.ts / layoutWorker.ts / protocol.ts)
- Delete: `apps/builder/src/builder/workspace/canvas/layout/engines/dualRunEngines.ts`
- Delete: `apps/builder/src/builder/workspace/canvas/layout/engines/dualRunHarness.ts`
- Delete: `apps/builder/src/builder/workspace/canvas/layout/engines/dualRunHarness.test.ts`
- Delete: `apps/builder/src/builder/workspace/canvas/layout/engines/dualRunLive.test.ts`
- Delete: `apps/builder/src/builder/workspace/canvas/layout/engines/persistentTaffyTree.seam.test.ts`
- Modify: `apps/builder/src/builder/workspace/canvas/wasm-bindings/compositionEngineWasm.ts` (stale 주석 정리)

**Interfaces:**

- Consumes: Task 1-3 완료 상태 (삭제 대상을 import 하는 live 소스 0)
- Produces: 없음 (순수 삭제). `LayoutResult` / `TaffyStyle` / `TaffyNodeHandle` 의 유일 소스가 Task 1 의 새 파일들로 확정됨.

- [ ] **Step 1: 삭제 직전 최종 참조 grep (안전 게이트)**

Run:

```bash
grep -rln "wasm-bindings/taffyLayout\|wasm-bindings/rustWasm\|wasm-bindings/layoutEngine\|wasm-worker\|dualRunEngines\|dualRunHarness" apps/builder/src --include="*.ts" --include="*.tsx" \
  | grep -v -E "taffyLayout.ts|rustWasm.ts|layoutEngine.ts|wasm-worker/|dualRun|persistentTaffyTree.seam.test.ts"
```

Expected: **출력 0건** (삭제 대상 외부에서의 참조 없음). 1건이라도 나오면 삭제 중단 — 해당 파일 재배선 먼저.

- [ ] **Step 2: git rm 실행**

```bash
git rm apps/builder/src/builder/workspace/canvas/wasm-bindings/taffyLayout.ts \
       apps/builder/src/builder/workspace/canvas/wasm-bindings/rustWasm.ts \
       apps/builder/src/builder/workspace/canvas/wasm-bindings/layoutEngine.ts
git rm -r apps/builder/src/builder/workspace/canvas/wasm-worker
git rm apps/builder/src/builder/workspace/canvas/layout/engines/dualRunEngines.ts \
       apps/builder/src/builder/workspace/canvas/layout/engines/dualRunHarness.ts \
       apps/builder/src/builder/workspace/canvas/layout/engines/dualRunHarness.test.ts \
       apps/builder/src/builder/workspace/canvas/layout/engines/dualRunLive.test.ts \
       apps/builder/src/builder/workspace/canvas/layout/engines/persistentTaffyTree.seam.test.ts
```

- [ ] **Step 3: compositionEngineWasm.ts — 삭제된 파일을 가리키는 stale 주석 정리**

Hunk A (4-7행). Before:

```ts
 * Taffy 없는 자체 레이아웃 엔진(`packages/composition-engine`)의 wasm-pack
 * `--target bundler` 산출물(`pkg/`)을 전역 로드한다. taffy `rustWasm.ts` 와 동일
 * 패턴 — 비동기 로드로 전역 캐시를 채우고, 동기 wrapper(`CompositionEngineLayout`)
 * 가 그 캐시에서 `new LayoutEngine()` 을 즉시 생성한다.
```

After:

```ts
 * Taffy 없는 자체 레이아웃 엔진(`packages/composition-engine`)의 wasm-pack
 * `--target bundler` 산출물(`composition-engine-pkg/`)을 전역 로드한다.
 * 비동기 로드로 전역 캐시를 채우고, 동기 wrapper(`CompositionEngineLayout`)
 * 가 그 캐시에서 `new LayoutEngine()` 을 즉시 생성한다.
```

Hunk B (11-15행). Before:

```ts
 * `createLayoutEngine()`(layoutBridge.ts)은 **동기** factory 다 — PersistentTaffyTree
 * 생성자가 동기적으로 엔진을 요구한다. 그러나 WASM 로드는 비동기다. taffy 는 이
 * 갭을 `initRustWasm()`(startup 비동기) → `getRustWasm()`(동기 캐시 read) 으로
 * 해소한다. 자체 엔진도 동일 구조를 따른다: `initCompositionEngineWasm()` 을
 * startup(init.ts)에서 호출해 전역 캐시를 채우고, wrapper 는 캐시에서 즉시 생성.
```

After:

```ts
 * `createLayoutEngine()`(layoutBridge.ts)은 **동기** factory 다 — PersistentTaffyTree
 * 생성자가 동기적으로 엔진을 요구한다. 그러나 WASM 로드는 비동기다. 이 갭은
 * `initCompositionEngineWasm()` 을 startup(init.ts)에서 호출해 전역 캐시를 채우고,
 * wrapper 는 캐시에서 즉시 생성하는 구조로 해소한다.
```

Hunk C (17-24행 — dual-run proof 블록 + @see). Before:

```ts
 * ## dual-run proof 전제 (no-dormant-foundation)
 *
 * 본 배선의 소비 경로(`createLayoutEngine` flag true)는 dualRunLive.test.ts
 * 12/12(B2 4 + C-1 3 + C-2b 5, 실전 대표 8형상 diff 0) proof 확보 후에만 켠다.
 * 배선 존재 ≠ flag 전환 — flag(`USE_RUST_LAYOUT_ENGINE`) flip 은 별도 gate.
 *
 * @see docs/adr/916-unified-rust-engine.md §Status log (C-2a)
 * @see apps/builder/.../wasm-bindings/rustWasm.ts (taffy 대응 패턴)
```

After:

```ts
 * @see docs/adr/916-unified-rust-engine.md §Status log (C-2a)
```

Hunk D (94-98행 주석 — taffy 선례 참조). Before:

```ts
// wasm-pack --target bundler 산출물 — vite-plugin-wasm 이 .wasm 바이너리를
// ES 모듈로 로드하면 import 시점에 자동 초기화된다(taffy 와 동일, __wbg_init
// default export 없음). @vite-ignore 로 정적 분석 우회 + 런타임 동적 로드.
//
// 경로는 apps/builder **내부** 상대 경로(taffy `rustWasm.ts` 의 `./pkg/...`
// 선례 미러링). wasm-pack out-dir 을 `composition-engine-pkg/`(dev 서버 root
```

After:

```ts
// wasm-pack --target bundler 산출물 — vite-plugin-wasm 이 .wasm 바이너리를
// ES 모듈로 로드하면 import 시점에 자동 초기화된다(__wbg_init
// default export 없음). @vite-ignore 로 정적 분석 우회 + 런타임 동적 로드.
//
// 경로는 apps/builder **내부** 상대 경로. wasm-pack out-dir 을
// `composition-engine-pkg/`(dev 서버 root
```

Hunk E (112행 + 127행 — 소멸한 Taffy 폴백 언급). Before:

```ts
            "[composition-engine] WASM 모듈 불완전 — LayoutEngine 미포함, Taffy 폴백",
```

After:

```ts
            "[composition-engine] WASM 모듈 불완전 — LayoutEngine 미포함 (폴백 없음, 부트스트랩 재시도 대기)",
```

Before:

```ts
          "[ADR-916] composition-engine WASM 초기화 실패, Taffy 폴백:",
```

After:

```ts
          "[ADR-916] composition-engine WASM 초기화 실패 (폴백 없음, 부트스트랩 재시도 대기):",
```

- [ ] **Step 4: 검증 — grep 0건 + type-check + vitest**

Run:

```bash
grep -rn "taffyLayout\|rustWasm\|wasm-worker\|dualRun" apps/builder/src --include="*.ts" --include="*.tsx"
```

Expected: **0건** (Task 1-3 에서 주석까지 정리했으므로 code/comment 모두 clean).

Run:

```bash
pnpm -F @composition/builder type-check
```

Expected: exit 0, 신규 위반 0 (삭제 파일 참조 잔존 시 여기서 컴파일 에러로 드러남).

Run:

```bash
pnpm -F @composition/builder exec vitest run src/builder/workspace/canvas/layout/engines
```

Expected: PASS — dualRun 4 test + seam test 는 수집 대상에서 소멸(정상), `fullTreeLayout` 계열 등 잔존 layout test 전부 GREEN.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(adr-916): endgame 4/7 — Taffy 소비 JS 본체 삭제 (taffyLayout/rustWasm/layoutEngine/wasm-worker/dualRun)

git rm 9건 + wasm-worker 디렉토리. compositionEngineWasm stale 주석 정리.
검증: apps/builder/src 내 taffyLayout|rustWasm|wasm-worker|dualRun grep 0건
+ type-check 신규 위반 0 + layout engines vitest PASS.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Rust crate + WASM 산출물 물리 삭제

Taffy crate 2개와 composition_wasm 산출물을 삭제한다. **원본 crate 디렉토리 삭제는 spec 에서 명시 승인 완료 (2026-07-06, 설계 Q2=A)** — 추가 승인 불필요. `wasm-bindings/pkg/` 는 `.gitignore` 1개만 git 추적이라 `git rm -r` 만으로는 untracked 452K 산출물이 디스크에 남는다 → `rm -rf` 병행.

**Files:**

- Delete: `packages/composition-layout/` 전체 (taffy 0.10 — lib.rs / spatial.rs / style.rs + Cargo.toml/lock + tests. 로컬 untracked `pkg/`, `target/`, `Cargo.toml.tmp` 포함)
- Delete: `apps/builder/src/builder/workspace/canvas/wasm/` 전체 (composition-wasm, taffy 0.9 — binary_protocol / block_layout / grid_layout / lib / taffy_bridge.rs, 3,578라인)
- Delete: `apps/builder/src/builder/workspace/canvas/wasm-bindings/pkg/` 전체 (composition_wasm 산출물 452K — tracked 는 `.gitignore` 1개)
- Modify: `apps/builder/tsconfig.app.json:16-19` (삭제 경로 exclude 정리)

**Interfaces:**

- Consumes: Task 4 완료 상태 (crate/pkg 를 참조하는 JS 소스 0)
- Produces: 없음 (순수 삭제). Rust 자산은 `packages/composition-engine/` 단독.

- [ ] **Step 1: git rm + 디스크 잔존물 정리**

```bash
git rm -r packages/composition-layout
rm -rf packages/composition-layout
git rm -r apps/builder/src/builder/workspace/canvas/wasm
rm -rf apps/builder/src/builder/workspace/canvas/wasm
git rm -r apps/builder/src/builder/workspace/canvas/wasm-bindings/pkg
rm -rf apps/builder/src/builder/workspace/canvas/wasm-bindings/pkg
```

(`git rm -r` 은 tracked 파일만 제거 — `target/`·`pkg/` 등 untracked build 산출물은 `rm -rf` 가 정리. `rm -rf` 는 `git rm` 직후 같은 Step 안에서만 실행.)

- [ ] **Step 2: tsconfig.app.json — 삭제 경로 exclude 정리**

Before (15-19행):

```json
  "include": ["src"],
  "exclude": [
    "src/builder/workspace/canvas/wasm/target",
    "wasm-bindings/pkg"
  ]
```

After:

```json
  "include": ["src"],
  "exclude": []
```

- [ ] **Step 3: 검증 — 디렉토리 소멸 + cargo test + type-check**

Run:

```bash
ls packages/composition-layout apps/builder/src/builder/workspace/canvas/wasm apps/builder/src/builder/workspace/canvas/wasm-bindings/pkg 2>&1
```

Expected: 3경로 모두 "No such file or directory".

Run:

```bash
git status --short | grep -v "^D " | head
```

Expected: 삭제 경로 관련 untracked 잔존물 0 (D 상태 외 항목 없음 — tsconfig 수정 M 1건 제외).

Run:

```bash
cd packages/composition-engine && cargo test; cd ../..
```

Expected: 자체 엔진 test 전부 PASS — lib + golden + `tests/tree_golden.rs`(N1~N5 6 test). `#[ignore]` 표기 golden(grid gap offset 승계 버그 표지)은 기존 그대로 ignored. composition-wasm / composition-layout 의 cargo test 는 crate 삭제와 함께 소멸 — 정상 (spec §Testing 2).

Run:

```bash
pnpm -F @composition/builder type-check
```

Expected: exit 0, 신규 위반 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(adr-916): endgame 5/7 — Taffy crate/pkg 물리 삭제 (composition-layout, composition-wasm, pkg 452K)

git rm: packages/composition-layout(taffy 0.10) + canvas/wasm(taffy 0.9,
3578라인) + wasm-bindings/pkg(composition_wasm 산출물). tsconfig exclude 정리.
원본 디렉토리 삭제는 2026-07-06 설계 Q2=A 로 명시 승인 완료.
검증: composition-engine cargo test 전부 PASS + type-check 신규 위반 0.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: build 스크립트 정리 (Taffy wasm-pack 잔재 제거)

**Files:**

- Modify: `/Users/admin/work/composition/package.json:34-38`
- Modify: `apps/builder/package.json:20`

**Interfaces:**

- Consumes: Task 5 완료 상태 (스크립트가 가리키는 crate 경로 소멸)
- Produces: 루트 scripts 에 `wasm:build:engine`(자체 엔진) + `prepare:wasm`(CanvasKit) 만 잔존.

- [ ] **Step 1: 루트 package.json — Taffy 스크립트 4건 제거**

Before (34-38행):

```json
    "build:layout": "cd packages/composition-layout && wasm-pack build --target web --release",
    "wasm:build": "wasm-pack build apps/builder/src/builder/workspace/canvas/wasm --target bundler --out-dir ../wasm-bindings/pkg",
    "wasm:dev": "wasm-pack build apps/builder/src/builder/workspace/canvas/wasm --target bundler --dev --out-dir ../wasm-bindings/pkg",
    "wasm:build:engine": "wasm-pack build packages/composition-engine --target bundler --out-dir ../../apps/builder/src/builder/workspace/canvas/wasm-bindings/composition-engine-pkg",
    "wasm:test": "wasm-pack test --node apps/builder/src/builder/workspace/canvas/wasm",
```

After (`wasm:build:engine` 만 존치):

```json
    "wasm:build:engine": "wasm-pack build packages/composition-engine --target bundler --out-dir ../../apps/builder/src/builder/workspace/canvas/wasm-bindings/composition-engine-pkg",
```

`prepare:wasm` / `postinstall` 은 **변경 금지** (CanvasKit 복사 전용 — Taffy 무관, 실측 확인됨).

- [ ] **Step 2: apps/builder/package.json — wasm:build 제거**

Before (20행):

```json
    "wasm:build": "wasm-pack build src/builder/workspace/canvas/wasm --target bundler --out-dir ../../../../../wasm-bindings/pkg",
```

After: 해당 행 삭제 (앞 행 `"fix:pixi-plan"` 끝의 `,` 정합 확인 — 뒤 행 `"clean"` 이 이어지므로 `,` 유지).

- [ ] **Step 3: 검증 — JSON 정합 + 잔존 grep**

Run:

```bash
node -e "require('./package.json'); require('./apps/builder/package.json'); console.log('JSON OK')"
```

Expected: `JSON OK`.

Run:

```bash
grep -n "composition-layout\|canvas/wasm \|canvas/wasm\"" package.json apps/builder/package.json
```

Expected: 0건 (`wasm:build:engine` 의 composition-engine 경로와 `prepare:wasm` 은 패턴 비매치 — 정상 잔존).

Run:

```bash
pnpm run wasm:build:engine --help >/dev/null 2>&1; echo "script resolvable: $?"
```

Expected: 스크립트 name 해석 정상 (실빌드는 불필요 — 기존 `composition-engine-pkg/` 산출물 그대로).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(adr-916): endgame 6/7 — Taffy build 스크립트 제거 (build:layout, wasm:build/dev/test)

루트 4건 + apps/builder 1건 제거. wasm:build:engine(자체 엔진) +
prepare:wasm(CanvasKit 전용) 존치.
(internal build config, no user-visible change 단독 — CHANGELOG 는 Task 7 에서
endgame 전체 bundle 로 반영)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: 전수 검증 게이트 + live behavior exercise + 문서 반영 + push

**type-check / cargo / vitest PASS 만으로는 종결 불가** (CLAUDE.md 완료 기준, R2 부팅 게이트 미스와이어링은 type-check 미탐지 영역 — live exercise 가 유일 검증). 모든 게이트 통과 후에만 push.

**Files:**

- Modify: `docs/CHANGELOG.md` (Architecture 엔트리 추가)
- Modify: `docs/adr/916-unified-rust-engine.md` (Risks R4 해소 표기)

**Interfaces:**

- Consumes: Task 1-6 의 전체 commit 스택 (로컬, 미push)
- Produces: 검증 완료 상태의 `main` push

- [ ] **Step 1: 전수 심볼 grep — 삭제 심볼 잔존 0**

Run:

```bash
grep -rn "TaffyLayout\b\|initRustWasm\|isRustWasmReady\|getRustWasm\|composition_wasm\|WASM_FLAGS.LAYOUT_ENGINE\|WASM_FLAGS.LAYOUT_WORKER\|dualRun\|wasm-worker" \
  apps/builder/src packages/composition-engine/src --include="*.ts" --include="*.tsx" --include="*.rs"
```

Expected: **0건**. (`PersistentTaffyTree` / `TaffyFlexEngine` 등 보존 심볼은 `TaffyLayout\b` 패턴에 비매치 — 보존 파일이 hit 되면 패턴 오류이므로 파일을 수정하지 말 것.)

- [ ] **Step 2: 역사 언급 grep — 주석 잔존 allowlist 대조**

Run:

```bash
grep -rn "composition-layout\|composition_layout" apps/builder/src packages --include="*.ts" --include="*.tsx" --include="*.rs" --include="*.toml" package.json apps/builder/package.json
```

Expected: `packages/composition-engine/Cargo.toml:3` 의 역사 주석("composition-layout(0.10, Taffy 종속)을 대체할 신규 crate ...") **1건만** — 대체 경위 서술이라 잔존 허용, Step 8 commit 메시지에 명시(flag). 그 외 hit 발견 시 코드 참조인지 판정 — 코드 참조면 제거 후 재검증.

- [ ] **Step 3: 최종 type-check + 전체 vitest**

Run:

```bash
pnpm type-check
```

Expected: exit 0 — 전 workspace 신규 위반 0 (builder baseline 69 소스 전용 초과 0).

Run:

```bash
pnpm -F @composition/builder test
```

Expected: 전체 vitest PASS (dualRun/seam 4+1 test 소멸분 제외한 전 suite GREEN).

- [ ] **Step 4: cargo test 최종 확인**

Run:

```bash
cd packages/composition-engine && cargo test; cd ../..
```

Expected: lib + golden + tree_golden 전부 PASS (`#[ignore]` 1건 기존 유지). 이 결과가 spec §Testing 2 의 "자체 엔진 테스트 무손실" 게이트.

- [ ] **Step 5: live behavior exercise (CRITICAL — Chrome MCP)**

dev 서버 기동:

```bash
pnpm dev
```

(백그라운드 실행, vite 기본 포트 확인 — 통상 `http://localhost:5173`.)

Chrome MCP 로 다음을 순서대로 exercise 한다:

1. builder 진입 (프로젝트 열기까지).
2. **콘솔 확인**: `[ADR-916] composition-engine WASM initialized` 로그 존재 + 콘솔 에러 0. 다음 메시지가 **없어야** 함: `[BuilderCanvas] WASM 로드 실패`, `[composition-engine] WASM 모듈 불완전`, `[ADR-916] composition-engine WASM 초기화 실패`.
3. **layout 계산 exercise**: palette 에서 Button 1개 + 자식 있는 컨테이너(Select 또는 Frame+자식) 1개 drop → Canvas 에서 겹침/(0,0) 뭉침 없이 정상 배치되는지 확인 (신규 컨테이너 full rebuild 경로).
4. **grid 경로 exercise**: grid 컨테이너 1개 생성(`gridTemplateColumns` 2열) → 2열 배치 확인 (grid full rebuild 경로).
5. **Canvas↔CSS 시각 정합**: 동일 요소의 Canvas(Skia 자체 엔진 layout) 렌더와 Preview iframe(CSS) 렌더 스크린샷 비교 — 위치/크기 시각 동일.

Expected: 5항목 전부 통과 = **Taffy 폴백 없이 자체 엔진 단독 부팅 확증** (spec §Testing 4 핵심 게이트, R1/R2 해소 증거).

**실패 시**: push 금지. superpowers:systematic-debugging 으로 root-cause 후 해당 태스크로 복귀 (증상 덮기 수정 금지). 특히 "앱 영구 로딩" 증상이면 R2(게이트 미스와이어링) — Task 2 의 심볼 치환 5+2곳 재점검.

- [ ] **Step 6: CHANGELOG 반영 (트리거: 3+ 파일 아키텍처 변경 + Phase 다단계 완결)**

먼저 drift 확인 (`.claude/rules/changelog.md` §2 — 14일/100커밋 초과 시 catch-up 블록 먼저):

```bash
grep -m1 -oE '^## \[.*\] - [0-9]{4}-[0-9]{2}-[0-9]{2}' docs/CHANGELOG.md
```

이후 `docs/CHANGELOG.md` 최상단에 아래 엔트리 추가 (drift 시 catch-up 뒤):

```markdown
## [Taffy 완전 제거 — ADR-916 endgame] - 2026-07-06

### Architecture

- **Taffy 외부 의존 완전 제거 — 자체 엔진(composition-engine) 단독 운영** (ADR-916 endgame):
  - Rust crate 2종 물리 삭제: `packages/composition-layout`(taffy 0.10, Phase 0-A 폐기 경로) + `apps/builder/.../canvas/wasm`(composition-wasm, taffy 0.9, 3,578라인) + WASM 산출물 `wasm-bindings/pkg`(452K)
  - Taffy 소비 JS 삭제: `taffyLayout.ts`/`rustWasm.ts`/`layoutEngine.ts`/`wasm-worker/` 전체/dual-run 하네스 4종
  - `createLayoutEngine()` 자체 엔진 단독 반환 — Taffy 폴백 경로 소멸 (R4 폴백 이중화 HIGH 위험 해소). 로드 실패 보상은 기존 15초 폴링/재시도 부트스트랩 유지
  - **Why**: ADR-916 Implemented(2026-07-06) + endgame kill criteria 3/3 충족 후 잔존 물리 자산 정리 — 단일 엔진 SSOT 확립 + 번들 감소(이중 WASM 로드 해소)
  - 타입 소스 이전: `LayoutResult` → `compositionEngine.ts`, `TaffyStyle` 계열 → 신규 `layoutTypes.ts` (보존 변환기 TaffyFlex/Block/GridEngine 은 이름만 Taffy — 순수 JS, 자체 엔진이 소비)
  - 검증: type-check baseline 초과 0 / composition-engine cargo test 전부 PASS / Chrome MCP live exercise — `[ADR-916] composition-engine WASM initialized` 부팅 + 컨테이너·grid 배치 + Canvas↔CSS 시각 정합
  - 위치: `apps/builder/src/builder/workspace/canvas/{wasm-bindings,layout/engines,hooks}/`, `packages/composition-engine/`
```

- [ ] **Step 7: ADR-916 Risks R4 해소 표기**

`docs/adr/916-unified-rust-engine.md` 를 Read 로 열어 Risks 표에서 **R4(폴백 이중화)** 행을 찾아, 대응 칸 끝에 아래 문구를 추가한다 (행 삭제 금지 — 이력 보존):

```
→ 해소 (2026-07-06 endgame): Taffy crate/pkg/폴백 경로 물리 삭제 — 폴백 이중화 자체 소멸. 보상: 15초 폴링/재시도 부트스트랩 (Q1=B).
```

(R4 행이 다른 ID 로 표기돼 있으면 "폴백" 키워드로 해당 행을 특정 — 임의 행 수정 금지.)

- [ ] **Step 8: 문서 commit + 일괄 push**

```bash
git add -A
git commit -m "docs(adr-916): endgame 7/7 — Taffy 완전 제거 검증 완료 (live exercise + CHANGELOG + R4 해소)

live behavior exercise 실측: builder 부팅 + composition-engine WASM
initialized 로그 + 콘솔 에러 0 + 컨테이너/grid 배치 + Canvas↔CSS 시각 정합.
전수 grep: 삭제 심볼 0건, 역사 주석 잔존 composition-engine/Cargo.toml:3
1건(허용, 대체 경위 서술).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git push origin main
```

Expected: push 성공. **push 차단 시 branch 자동 우회 절대 금지** — 사용자에게 `! git push origin main` 직접 실행 요청 (`.claude/rules/git-workflow.md` §4).

---

## Self-Review 결과 (계획 작성 시점)

- **Spec coverage**: 그룹 1(crate 삭제)=Task 5 / 그룹 2(JS 삭제)=Task 4 / 그룹 3(재배선)=Task 1-3 / 그룹 4(build 정리)=Task 6 / Testing 1-4=Task 7 / 보존 목록=Global Constraints / Q1=B(재시도 유지)=Task 2 Step 2 구조 보존 명시 / Q2=A(물리 삭제 승인)=Task 5 명시. 누락 없음.
- **Spec 대비 실측 확장**: `TaffyStyle`/`TaffyNodeHandle` 소비처 4곳 + `fullTreeLayout.ts` live 게이트 + tsconfig exclude + pkg untracked 산출물 — 본문 "실측 보정" 절에 근거와 함께 흡수.
- **Type consistency**: `LayoutResult`(x/y/width/height) 소스는 Task 1 이후 `compositionEngine.ts` 단일 — Task 1 Step 3/5/6, Task 2 Step 1 의 import 경로 일치 확인. `LayoutEngineAPI` 는 Task 2 에서 본문 불변 유지 — `persistentTaffyTree.ts` 소비 계약 무파손.
- **Placeholder scan**: 전 태스크 before→after 실코드 / 실명령 / 기대 출력 포함 — "TBD"/"적절히 처리" 류 0건. 유일한 read-first 지시(taffyLayout.ts 원문 대조)는 verbatim 복사 정합성 확보 목적이며 실측 코드가 병기돼 있음.
