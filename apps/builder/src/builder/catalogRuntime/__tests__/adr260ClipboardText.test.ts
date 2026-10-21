import { describe, expect, it } from "vitest";
import type { CatalogClipboard } from "../../../../../../packages/shared/src/catalog/commands";
import {
  CATALOG_CLIPBOARD_PREFIX,
  parseCatalogClipboard,
  serializeCatalogClipboard,
} from "../clipboardText";

/** ADR-260 Decision 13 (ADR-279: no `origins`) — the system clipboard text carries the paste's facts. */
describe("ADR-260 clipboard text", () => {
  const node = {
    kind: "node",
    id: "project:node:a",
    definitionId: "lib:definition:text",
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  } as const;
  const full: CatalogClipboard = {
    rootIds: ["project:node:a"],
    entries: [node],
    sourceProjectId: "project:project:p",
    definitions: [node],
    tokens: [
      {
        kind: "token",
        id: "project:token:brand",
        name: "brand",
        tokenType: "color",
        value: "#123456",
        source: "user-defined",
      },
    ],
  };

  it("round-trips the source project, definitions and tokens", () => {
    expect(parseCatalogClipboard(serializeCatalogClipboard(full))).toEqual(full);
  });

  it("reads an older copy without them, and drops a malformed field (an ADR-260 `origins` too)", () => {
    const old = { rootIds: full.rootIds, entries: full.entries };
    expect(
      parseCatalogClipboard(CATALOG_CLIPBOARD_PREFIX + JSON.stringify(old)),
    ).toEqual(old);
    expect(
      parseCatalogClipboard(
        CATALOG_CLIPBOARD_PREFIX +
          JSON.stringify({
            ...old,
            origins: { "project:node:a": "project:definition:d" },
            tokens: "x",
          }),
      ),
    ).toEqual(old);
  });
});
