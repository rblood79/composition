import "fake-indexeddb/auto";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeId,
} from "../../../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../../../packages/shared/src/catalog/commands";
import { CatalogTextEditor } from "../CatalogTextEditor";
import { newCatalogProjectDocument } from "../../../../catalogRuntime/project";
import { CatalogStorage } from "../../../../catalogRuntime/storage";
import { CatalogWorkspace } from "../../../../catalogRuntime/workspace";
import { nodeLayoutEngine } from "../../../../catalogRuntime/__tests__/support/nodeLayoutEngine";
import { requestCanvasFrame } from "../../skia/frameScheduler";

const subscriptions = vi.hoisted(() => ({ count: 0 }));
vi.mock("../../skia/frameScheduler", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../skia/frameScheduler")>();
  return {
    ...actual,
    subscribeCanvasFrames: (listener: () => void) => {
      subscriptions.count += 1;
      return actual.subscribeCanvasFrames(listener);
    },
  };
});

/**
 * 2026-10-05 감사 LOW — 편집이 밖에서 끝나도 (선택 전환 · reconcile) 입력한 글은 저장되고, 카메라
 * 추적 구독은 프레임마다 다시 붙지 않는다.
 */
const PROJECT = "project:project:text" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const HEADING = "project:node:title" as NodeId;
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:t${++next}` as EntryId<K>;
};

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Text" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-text-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: HEADING,
          definitionId: "lib:definition:heading",
          children: [],
          props: { children: { kind: "set", value: "Hello" } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [HEADING],
      newId: allocator(),
    }),
  );
  const record = workspace.root.recordsOfSource(HEADING)[0];
  const box = { x: 10, y: 20, width: 200, height: 40 };
  const view = render(
    <CatalogTextEditor workspace={workspace} boundsOf={() => box} />,
  );
  const field = () =>
    view.queryByTestId("catalog-text-editor") as HTMLTextAreaElement | null;
  const text = () => {
    const entry = workspace.runtime.graph.getEntry(HEADING);
    return entry?.kind === "node" ? entry.props.children : undefined;
  };
  return { workspace, record, field, text };
}

describe("CatalogTextEditor — 외부 종료 · 프레임 구독", () => {
  it("편집이 밖에서 끝나면 입력한 글을 한 단계로 저장한다", async () => {
    const { workspace, record, field, text } = await open();
    act(() => workspace.session.startTextEdit(workspace.itemOfRecord(record)!));
    fireEvent.change(field()!, { target: { value: "Changed" } });
    act(() => workspace.session.endTextEdit());
    expect(field()).toBeNull();
    expect(text()).toEqual({ kind: "set", value: "Changed" });
  });

  it("카메라 프레임마다 구독을 다시 붙이지 않는다", async () => {
    const { workspace, record } = await open();
    act(() => workspace.session.startTextEdit(workspace.itemOfRecord(record)!));
    const before = subscriptions.count;
    act(() => {
      for (let i = 0; i < 5; i++) requestCanvasFrame();
    });
    expect(subscriptions.count - before).toBe(0);
  });
});
