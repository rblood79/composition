/**
 * @fileoverview ADR-236 Phase 3 — 구조 변경 store 액션 진입부 가드 ratchet (G3 · R7).
 *
 * 표면 (메뉴 · 단축키 · Layers · AI) 이 판정을 따로 두면 한쪽만 막힌다 (Phase 0 인벤토리 §3.4).
 * 그래서 구조 변경 store 액션은 진입부에서 같은 판정 (`canOperate` 계열) 이나 편집 영향 게이트
 * (`confirmOriginImpact*`) 를 **첫 변경보다 먼저** 부른다. 이 테스트가 두 가지를 고정한다:
 *
 * 1. 목록의 각 액션 본문에서 가드 호출이 첫 변경 호출보다 앞선다 (AST).
 * 2. stores 안에서 canonical 변경 래퍼 (`*CanonicalPrimary` · `runCanonicalMutation`) 를 부르는 함수
 *    집합이 아래 표와 같다 — 새 함수가 래퍼를 부르면 가드 목록에 넣거나 사유와 함께 허용 목록에 둔다.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const STORES = resolve(__dirname, "../../stores");

const GUARD_CALL =
  /^(canOperate|guardStoreOperation|filterOperable|guardCreationParent|resolveMoveTarget|confirmOriginImpactIfNeeded|confirmOriginImpactForIds)$/;
const MUTATION_CALL =
  /^(set|executeRemoval|applyElementSnapshotBatch|runCanonicalMutation|[a-zA-Z]+CanonicalPrimary|sync[A-Za-z]*ToCanonical|updateNode|buildDetachSnapshot)$/;

/** 진입부 가드가 있어야 하는 구조 변경 액션 — `파일 :: 액션 이름`. */
const GUARDED_ACTIONS: readonly string[] = [
  "utils/elementRemoval.ts :: createRemoveElementAction",
  "utils/elementRemoval.ts :: createRemoveElementsAction",
  "elements.ts :: moveElementToContainer",
  "elements.ts :: reorderElementWithinParent",
  "elements.ts :: moveElementToSiblingEdge",
  "utils/instanceActions.ts :: detachInstance",
  "utils/instanceActions.ts :: toggleComponentOrigin",
  "utils/elementUpdate.ts :: createUpdateElementPropsAction",
  "utils/elementUpdate.ts :: createUpdateElementAction",
  "utils/elementUpdate.ts :: createBatchUpdateElementPropsAction",
  "inspectorActions.ts :: updateAndSave",
  "utils/elementCreation.ts :: createAddElementAction",
  "utils/elementCreation.ts :: createAddComplexElementAction",
];

/**
 * store 액션을 거치지 않는 구조 쓰기 (E8) — 쓰기 호출마다 그것을 감싼 함수 중 하나가 가드를 먼저
 * 부른다. 경로는 `apps/builder/src/builder` 기준.
 */
const BYPASS_WRITES: readonly {
  file: string;
  write: RegExp;
  guard: RegExp;
}[] = [
  {
    // 캔버스 드래그 — adapter 의 canonical 이동을 직접 부른다.
    file: "workspace/canvas/hooks/useDragBridge.ts",
    write: /^(moveElementToCanonicalTarget|moveElementsToCanonicalTarget)$/,
    guard: /^resolveDragMoveTarget$/,
  },
  {
    // factory 생성 — useStore.setState 를 직접 부른다.
    file: "factories/utils/elementCreation.ts",
    write: /^runCanonicalMutation$/,
    guard: /^guardCreationParent$/,
  },
];

/**
 * canonical 변경 래퍼를 부르는 stores 함수 → 분류. `guarded` 는 위 액션이 부르는 내부 함수,
 * `allowed` 는 구조 변경이 아닌 축 (사유 필수).
 */
const WRAPPER_CALLERS: Readonly<Record<string, string>> = {
  "elements.ts :: moveElementToSiblingEdge": "guarded",
  "elements.ts :: reorderElementWithinParent": "guarded",
  "elements.ts :: performCanonicalMove": "guarded — moveElementToContainer 안",
  "elements.ts :: canonical": "guarded — 이동 액션의 runCanonicalMutation 인자",
  "utils/elementRemoval.ts :: syncRemovedElementsToCanonical":
    "guarded — 삭제 액션 뒤",
  "utils/elementUpdate.ts :: syncLocationUpdatedElementToCanonical":
    "guarded — updateElement 뒤 (영향 게이트)",
  "utils/instanceActions.ts :: syncInstanceElementsToCanonical":
    "guarded — detach · toggle 뒤",
  "utils/elementCreation.ts :: mergeCreatedElementsIntoCanonicalDocument":
    "guarded — addElement · addComplexElement 진입부 (guardCreationParent)",
  "elements.ts :: applyCanonicalDataBindingPatch":
    "allowed — props 축 (데이터 바인딩), 구조 변경 아님",
  "elements.ts :: applyCanonicalExtensionPatch":
    "allowed — props 축 (확장 필드), 구조 변경 아님",
  "utils/reusableLayoutActions.ts :: deleteReusableLayout":
    "allowed — 페이지 레이아웃 (layout 축) 삭제, 요소 구조 변경 아님",
};

function collectSources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "__tests__") out.push(...collectSources(full));
      continue;
    }
    if (name.endsWith(".ts") && !/\.(test|spec|bench)\.ts$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
}

function isFunctionLike(node: ts.Node | undefined): boolean {
  return !!node && (ts.isArrowFunction(node) || ts.isFunctionExpression(node));
}

/** 이름 있는 가장 가까운 함수 (선언 · 메서드 · 함수를 담은 속성/변수). */
function enclosingName(node: ts.Node): string {
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      (ts.isFunctionDeclaration(parent) || ts.isMethodDeclaration(parent)) &&
      parent.name
    ) {
      return parent.name.getText();
    }
    if (
      ts.isPropertyAssignment(parent) &&
      ts.isIdentifier(parent.name) &&
      isFunctionLike(parent.initializer)
    ) {
      return parent.name.text;
    }
    if (
      ts.isVariableDeclaration(parent) &&
      ts.isIdentifier(parent.name) &&
      isFunctionLike(parent.initializer)
    ) {
      return parent.name.text;
    }
  }
  return "(top)";
}

function calleeName(call: ts.CallExpression): string | null {
  const callee = call.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return null;
}

/** 액션 이름으로 본문 노드를 찾는다 (함수 선언 · 속성 · 변수). */
function findAction(sourceFile: ts.SourceFile, name: string): ts.Node | null {
  let found: ts.Node | null = null;
  const visit = (node: ts.Node) => {
    if (found) return;
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      found = node;
    } else if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      isFunctionLike(node.initializer)
    ) {
      found = node.initializer;
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      isFunctionLike(node.initializer)
    ) {
      found = node.initializer!;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

/** 본문에서 처음 나오는 가드 호출 · 변경 호출 위치 (소스 순서). */
function firstCalls(body: ts.Node): {
  guard: number | null;
  mutation: number | null;
} {
  let guard: number | null = null;
  let mutation: number | null = null;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const name = calleeName(node);
      if (name && GUARD_CALL.test(name)) {
        guard =
          guard === null ? node.getStart() : Math.min(guard, node.getStart());
      }
      if (name && MUTATION_CALL.test(name)) {
        mutation =
          mutation === null
            ? node.getStart()
            : Math.min(mutation, node.getStart());
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(body);
  return { guard, mutation };
}

describe("ADR-236 구조 변경 store 액션 진입부 가드", () => {
  it.each(GUARDED_ACTIONS)("%s — 가드가 첫 변경보다 먼저", (entry) => {
    const [file, name] = entry.split(" :: ");
    const action = findAction(parse(join(STORES, file)), name);
    expect(action, `${entry} 를 찾지 못했다`).not.toBeNull();
    const { guard, mutation } = firstCalls(action!);
    expect(guard, `${entry} 에 가드 호출이 없다`).not.toBeNull();
    if (mutation !== null) expect(guard!).toBeLessThan(mutation);
  });

  it.each(BYPASS_WRITES)(
    "store 우회 쓰기 $file — 쓰기마다 감싼 함수가 가드를 먼저 부른다 (E8)",
    ({ file, write, guard }) => {
      const sourceFile = parse(resolve(STORES, "..", file));
      const writes: ts.CallExpression[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          const name = calleeName(node);
          if (name && write.test(name)) writes.push(node);
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      expect(writes.length).toBeGreaterThan(0);
      const unguarded = writes.filter((call) => {
        for (let parent = call.parent; parent; parent = parent.parent) {
          if (
            !ts.isFunctionDeclaration(parent) &&
            !ts.isArrowFunction(parent) &&
            !ts.isFunctionExpression(parent)
          ) {
            continue;
          }
          let guarded = false;
          const find = (node: ts.Node) => {
            if (guarded) return;
            if (ts.isCallExpression(node)) {
              const name = calleeName(node);
              if (
                name &&
                guard.test(name) &&
                node.getStart() < call.getStart()
              ) {
                guarded = true;
                return;
              }
            }
            ts.forEachChild(node, find);
          };
          find(parent);
          if (guarded) return false;
        }
        return true;
      });
      expect(
        unguarded.map(
          (call) =>
            `${file}:${sourceFile.getLineAndCharacterOfPosition(call.getStart()).line + 1}`,
        ),
      ).toEqual([]);
    },
  );

  it("canonical 변경 래퍼를 부르는 stores 함수 집합이 표와 같다 (새 경로는 가드 목록 또는 사유 등재)", () => {
    const callers = new Set<string>();
    for (const file of collectSources(STORES)) {
      const sourceFile = parse(file);
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
          const name = node.expression.text;
          if (/^(runCanonicalMutation|[a-zA-Z]+CanonicalPrimary)$/.test(name)) {
            callers.add(`${relative(STORES, file)} :: ${enclosingName(node)}`);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
    }
    expect([...callers].sort()).toEqual(Object.keys(WRAPPER_CALLERS).sort());
  });
});
