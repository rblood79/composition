/**
 * ADR-196 Phase 1 — `COMMAND_META` 정적 게이트 5조항 + 민감도 (breakdown §3-2, G1).
 *
 * 조항 1~4 는 `validateCommandMeta` 가 표를 읽어 판정한다 — 민감도 테스트는 표의
 * 사본을 한 칸씩 어긋나게 만들어 RED 가 실제로 뜨는지 본다 (게이트가 vacuous 하지
 * 않다는 증거). 조항 5 는 adapter 파일의 export 표면을 소스로 검사한다.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SHORTCUT_DEFINITIONS, type ShortcutId } from "./keyboardShortcuts";
import type { ShortcutDefinition } from "../types/keyboard";
import {
  COMMAND_META,
  agentCallableIds,
  validateCommandMeta,
  type CommandMeta,
} from "./commandMeta";
import { AGENT_COMMANDS } from "../../services/agent/agentCommands";

const IDS = Object.keys(SHORTCUT_DEFINITIONS) as ShortcutId[];
const DEFS = SHORTCUT_DEFINITIONS as Record<ShortcutId, ShortcutDefinition>;
const adapterIds = () => new Set(Object.keys(AGENT_COMMANDS) as ShortcutId[]);

/** Phase 0 확정 allowlist 40 (breakdown §2 Phase 0 실측 결과). */
const ALLOWLIST: ShortcutId[] = [
  "undo",
  "redo",
  "zoomIn",
  "zoomOut",
  "zoomToFit",
  "zoom100",
  "zoom200",
  "toggleNavigator",
  "toggleComponents",
  "toggleDatatable",
  "toggleTheme",
  "toggleProperties",
  "toggleStyles",
  "toggleEvents",
  "toggleHistory",
  "toggleRulers",
  "openSettings",
  "copy",
  "paste",
  "cut",
  "bringToFront",
  "bringForward",
  "sendBackward",
  "sendToBack",
  "duplicate",
  "toggleComponentOrigin",
  "detachInstance",
  "selectAll",
  "delete",
  "group",
  "ungroup",
  "alignLeft",
  "alignHCenter",
  "alignRight",
  "alignTop",
  "alignVCenter",
  "alignBottom",
  "distributeH",
  "distributeV",
  "toggleFocusMode",
];

function cloneMeta(): Record<ShortcutId, CommandMeta> {
  const out = {} as Record<ShortcutId, CommandMeta>;
  for (const id of IDS) out[id] = { ...COMMAND_META[id] };
  return out;
}

describe("COMMAND_META 정적 게이트 (ADR-196 §3-2)", () => {
  it("72 정의 전부 metadata 가 있고 정의 밖 id 는 없다", () => {
    expect(Object.keys(COMMAND_META).sort()).toEqual([...IDS].sort());
  });

  it("allowlist 는 Phase 0 확정 40 과 정확히 일치한다 (HC2 상한 40)", () => {
    const ids = agentCallableIds(COMMAND_META);
    expect(ids.length).toBeLessThanOrEqual(40);
    expect([...ids].sort()).toEqual([...ALLOWLIST].sort());
  });

  it("실제 표는 조항 1~4 위반 0", () => {
    expect(validateCommandMeta(COMMAND_META, adapterIds(), DEFS)).toEqual([]);
  });

  it("조항 1 민감도 — allowlist id 의 adapter 를 빼면 RED", () => {
    const ids = adapterIds();
    ids.delete("alignLeft");
    const v = validateCommandMeta(COMMAND_META, ids, DEFS);
    expect(v).toContainEqual(
      expect.objectContaining({ rule: 1, id: "alignLeft" }),
    );
  });

  it("조항 1 민감도 — agentCallable:false 인 id 에 adapter 가 있어도 RED (역방향)", () => {
    const ids = adapterIds();
    ids.add("openProject");
    const v = validateCommandMeta(COMMAND_META, ids, DEFS);
    expect(v).toContainEqual(
      expect.objectContaining({ rule: 1, id: "openProject" }),
    );
  });

  it("조항 2 민감도 — 되돌릴 수 없는 document 명령을 confirm:false 로 두면 RED", () => {
    const meta = cloneMeta();
    meta.alignLeft = {
      ...meta.alignLeft,
      undo: "irreversible",
      confirm: false,
    };
    const v = validateCommandMeta(meta, adapterIds(), DEFS);
    expect(v).toContainEqual(
      expect.objectContaining({ rule: 2, id: "alignLeft" }),
    );
  });

  it("조항 3 민감도 — external id 를 agentCallable:true 로 두면 RED", () => {
    const meta = cloneMeta();
    meta.openProject = { ...meta.openProject, agentCallable: true };
    const ids = adapterIds();
    ids.add("openProject"); // 조항 1 과 분리해 조항 3 만 본다
    const v = validateCommandMeta(meta, ids, DEFS);
    expect(v).toContainEqual(
      expect.objectContaining({ rule: 3, id: "openProject" }),
    );
  });

  it("조항 4 민감도 — palette:false 정의를 agentCallable:true 로 두면 RED", () => {
    const meta = cloneMeta();
    meta.treeNavDown = { ...meta.treeNavDown, agentCallable: true };
    const ids = adapterIds();
    ids.add("treeNavDown");
    const v = validateCommandMeta(meta, ids, DEFS);
    expect(v).toContainEqual(
      expect.objectContaining({ rule: 4, id: "treeNavDown" }),
    );
  });

  it("external 은 전부 agentCallable:false 이고 openProject 뿐이다", () => {
    const external = IDS.filter(
      (id) => COMMAND_META[id].mutation === "external",
    );
    expect(external).toEqual(["openProject"]);
    expect(external.every((id) => !COMMAND_META[id].agentCallable)).toBe(true);
  });

  it("조항 5 — adapter 파일은 AGENT_COMMANDS 만 값으로 export 한다 (executor 밖 우회 경로 0)", async () => {
    const source = await readFile(
      resolve(__dirname, "../../services/agent/agentCommands.ts"),
      "utf-8",
    );
    const valueExports = [
      ...source.matchAll(
        /^export (?:const|function|let|class|async function) (\w+)/gm,
      ),
    ].map((m) => m[1]);
    expect(valueExports).toEqual(["AGENT_COMMANDS"]);
    expect(source).not.toMatch(/^export \{/m);
    expect(source).not.toMatch(/^export default/m);
  });
});
