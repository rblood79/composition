import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("style hooks canonical read contract", () => {
  it("reuses style context for fill and transform reads", async () => {
    const fillSource = await readFile(
      resolve(__dirname, "useFillValues.ts"),
      "utf-8",
    );
    const transformSource = await readFile(
      resolve(__dirname, "useTransformValues.ts"),
      "utf-8",
    );

    expect(fillSource).toContain("useElementStyleContext(selectedId)");
    expect(fillSource).not.toContain("s.elementsMap.get(selectedId)");
    expect(transformSource).toContain("isBodyType(type)");
    expect(transformSource).not.toContain("s.elementsMap.get(id)?.type");
  });

  it("reads fill action state from the canonical node index", async () => {
    // The Fill actions read through the Styles host (the old store host went with 4e-9 C).
    const actions = await readFile(
      resolve(__dirname, "useFillActions.ts"),
      "utf-8",
    );
    expect(actions).toContain("host.readFills");
  });

  it("uses canonical property element for transform parent and size reads", async () => {
    // The size-mode hooks read the parent through the Styles host.
    const hooks = await readFile(
      resolve(__dirname, "useTransformAuxiliary.ts"),
      "utf-8",
    );

    expect(hooks).toContain("useStylesHost().useParentLayout");
    expect(hooks).not.toContain("s.elementsMap.get");
    expect(hooks).not.toContain("state.elementsMap.get(parentId)");
  });
});
