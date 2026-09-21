import { beforeEach, describe, expect, it } from "vitest";
import type { CompositionDocument } from "@composition/shared";
import { useStore } from "../../../stores";
import { createElementsFromDefinition } from "../elementCreation";
import { getComponentDefinitionCreator } from "../../componentDefinitions";
import { ensureReusableCompositeOrigins } from "../../../components/reusableCompositeOrigins";
import type { ComponentCreationContext } from "../../types";
import {
  getComponentMasterReference,
  isComponentInstanceMirrorElement,
} from "@/adapters/canonical/componentSemanticsMirror";

/**
 * ADR-229 Phase 2 — 생성 경로도 seed 와 같은 규칙: reusable origin 이 없는 complex type 의
 * definition 자식 중 reusable type 은 origin instance (ref) 로 만들어진다.
 */
function seededDocument(): CompositionDocument {
  return ensureReusableCompositeOrigins({
    version: "composition-1.0",
    children: [],
  });
}

function makeContext(doc: CompositionDocument): ComponentCreationContext {
  return { parentElement: null, pageId: "page-home", elements: [], doc };
}

describe("ADR-229 Phase 2 — createElementsFromDefinition 자식 ref 화", () => {
  beforeEach(() => {
    useStore.setState({ elements: [] });
  });

  it("Navigation (root Nav) 의 Link 자식 3 → ref(component-link) + diff props, 자손 0", () => {
    const doc = seededDocument();
    const definition = getComponentDefinitionCreator("Navigation")!(
      makeContext(doc),
    );
    const { parent, children } = createElementsFromDefinition(definition, {
      pageId: "page-home",
      layoutId: null,
      doc,
    });
    expect(parent.type).toBe("Nav");
    expect(children.map((child) => [child.type, (child as { ref?: string }).ref])).toEqual([
      ["ref", "component-link"],
      ["ref", "component-link"],
      ["ref", "component-link"],
    ]);
    expect(children.every((child) => child.parent_id === parent.id)).toBe(true);
    expect(children[0]).toMatchObject({ componentName: "Link" });
    expect(isComponentInstanceMirrorElement(children[0]!)).toBe(true);
    expect(getComponentMasterReference(children[0]!)).toBe("component-link");
    // origin 과 같은 키는 없고 다른 키만 (라벨 · href).
    expect(Object.keys(children[0]!.props ?? {})).not.toContain("variant");
  });

  it("doc 이 없으면 (legacy 호출) 종전대로 plain", () => {
    const definition = getComponentDefinitionCreator("Navigation")!(
      makeContext({ version: "composition-1.0", children: [] }),
    );
    const { children } = createElementsFromDefinition(definition, {
      pageId: "page-home",
      layoutId: null,
    });
    expect(children.map((child) => child.type)).toEqual(["Link", "Link", "Link"]);
  });
});
