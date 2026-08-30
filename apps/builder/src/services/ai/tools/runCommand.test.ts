/**
 * ADR-196 Phase 3 — `run_command` 도구 + DEV 진입점이 executor 를 그대로 지난다 (G3 정적 부분).
 *
 * 도구 정의의 enum 이 `COMMAND_META` allowlist 에서 파생되는지, 실행이 executor 를
 * 경유하는지 (도구가 store 를 직접 만지지 않는지) 를 본다. 실제 문서 변화는 live (G3).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { listAgentCommands } from "../../agent/executeAgentCommand";
import { createDevAgentEntry } from "../../agent/devAgentEntry";
import { buildRunCommandToolDefinition, runCommandTool } from "./runCommand";
import { createToolRegistry, getToolDefinitions } from "./index";
import { localizedStrings } from "@/i18n/translations";
import type { PromptTranslate } from "../promptTranslate";
import type { ToolTranslate } from "@/types/integrations/ai.types";

const executeAgentCommand = vi.hoisted(() =>
  vi.fn(async (id: string) => ({
    status: id === "openProject" ? "denied" : "ok",
    id,
    ...(id === "openProject"
      ? { reason: "external" }
      : { undoable: true, historyIndex: 3 }),
    durationMs: 1,
  })),
);
const executeAgentCommands = vi.hoisted(() =>
  vi.fn(async (requests: Array<{ id: string }>) =>
    requests.map((r) => ({
      status: "ok",
      id: r.id,
      undoable: false,
      durationMs: 1,
    })),
  ),
);

vi.mock("../../agent/executeAgentCommand", async (orig) => {
  const actual = await orig<typeof import("../../agent/executeAgentCommand")>();
  return { ...actual, executeAgentCommand, executeAgentCommands };
});

/** ko-KR 카탈로그에 묶은 해소기 (ADR-200 후속). */
const tr: PromptTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

/** ko-KR 카탈로그에 묶은 도구 오류 해소기 (ADR-200 후속). */
const tt: ToolTranslate = (key, params) => {
  const message = localizedStrings["ko-KR"][key];
  if (typeof message === "function") return message(params);
  return message ?? key;
};

describe("run_command 도구 정의", () => {
  it("enum 은 allowlist 와 정확히 같다 (external·연속키 없음)", () => {
    const definition = buildRunCommandToolDefinition(tr);
    const ids = listAgentCommands().map((c) => c.id);
    const parameters = definition.parameters as {
      properties: {
        id: { enum: string[] };
        ids: { items: { enum: string[] } };
      };
    };
    expect(parameters.properties.id.enum).toEqual(ids);
    expect(parameters.properties.ids.items.enum).toEqual(ids);
    expect(ids).toHaveLength(40);
    expect(ids).not.toContain("openProject");
    expect(ids).not.toContain("escape");
  });

  it("설명에 승인 필요 명령이 표시된다", () => {
    const description = buildRunCommandToolDefinition(tr).description;
    expect(description).toContain("delete:");
    expect(description).toContain("사용자 승인 필요");
  });

  it("도구 레지스트리·정의 목록에 run_command 가 포함된다 (기존 9종 유지)", async () => {
    const registry = createToolRegistry();
    expect(registry.has("run_command")).toBe(true);
    expect(registry.size).toBe(10);
    const names = (await getToolDefinitions(tr)).map((d) => d.name);
    expect(names).toContain("run_command");
    expect(names).toHaveLength(10);
  });

  it("레지스트리의 run_command 는 지연 로딩 executor 다 (초기 번들 분리 — HC6)", async () => {
    const registry = createToolRegistry();
    const result = await registry
      .get("run_command")!
      .execute({ id: "zoomIn" }, tt);
    expect(result.success).toBe(true);
    expect(executeAgentCommand).toHaveBeenCalledWith(
      "zoomIn",
      undefined,
      expect.objectContaining({ host: "ai-panel" }),
    );
  });
});

describe("run_command 실행 — executor 경유", () => {
  beforeEach(() => {
    executeAgentCommand.mockClear();
    executeAgentCommands.mockClear();
  });

  it("id 1건 → executeAgentCommand(host: ai-panel)", async () => {
    const result = await runCommandTool.execute({ id: "alignLeft" }, tt);
    expect(executeAgentCommand).toHaveBeenCalledWith(
      "alignLeft",
      undefined,
      expect.objectContaining({ host: "ai-panel" }),
    );
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ status: "ok", undoable: true });
  });

  it("거부된 명령은 success:false + reason", async () => {
    const result = await runCommandTool.execute({ id: "openProject" }, tt);
    expect(result).toMatchObject({ success: false, error: "external" });
  });

  it("ids 배열 → executeAgentCommands 순서 실행", async () => {
    const result = await runCommandTool.execute(
      {
        ids: ["zoomIn", "alignLeft"],
      },
      tt,
    );
    expect(executeAgentCommands).toHaveBeenCalledWith(
      [{ id: "zoomIn" }, { id: "alignLeft" }],
      expect.objectContaining({ host: "ai-panel" }),
    );
    expect(result.success).toBe(true);
  });

  it("id/ids 둘 다 없으면 오류", async () => {
    await expect(runCommandTool.execute({}, tt)).resolves.toMatchObject({
      success: false,
    });
  });
});

describe("window.__compositionAgent (DEV 진입점)", () => {
  it("run 은 host chrome-mcp 로 executor 를 지나고, list 는 allowlist 를 돌려준다", async () => {
    const entry = createDevAgentEntry();
    await entry.run("zoomIn");
    expect(executeAgentCommand).toHaveBeenCalledWith(
      "zoomIn",
      undefined,
      expect.objectContaining({ host: "chrome-mcp" }),
    );
    expect(entry.list()).toHaveLength(40);
    expect(entry.hasConfirmHost()).toBe(false);
  });
});
