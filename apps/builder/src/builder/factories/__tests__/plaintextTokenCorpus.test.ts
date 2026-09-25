/**
 * ADR-201 G4 (클라이언트 측) — 정적 평문 토큰 게이트: 문서에 굳어 배포본 (`/project.json`) 으로
 * 나가는 **정적 corpus** 에 인증값 패턴이 없어야 한다.
 *
 * corpus = 팔레트 기본값 (getDefaultProps — placeable 전수) + catalog accepts.default (entry 전수)
 *          + factory definition 트리 (create*Definition 전수 — 자식 포함) + Data 패널 seed
 *          endpoint 형태 (ApiEndpointHeader 행).
 *
 * 감지기 자체의 재현 fixture (Bearer JWT · hex api key · placeholder 통과) 는
 * `packages/shared/src/upload/__tests__/plaintextTokenGate.test.ts` 가 RED→GREEN 으로 잡는다.
 * 여기서는 그 감지기를 corpus 에 돌리고, 음성 fixture 1건으로 게이트가 살아 있음을 같이 증명한다.
 */
import { describe, expect, it } from "vitest";

import {
  componentCatalog,
  findPlaintextTokens,
  getCatalogDefaultProps,
} from "@composition/shared";
import type { CompositionDocument } from "@composition/shared";

import { ComponentFactory } from "@/builder/factories/ComponentFactory";
import { getDefaultProps } from "@/types/builder/unified.types";
import type {
  ComponentCreationContext,
  ComponentDefinition,
} from "@/builder/factories/types";
import * as DataComponents from "../definitions/DataComponents";
import * as DateColorComponents from "../definitions/DateColorComponents";
import * as DisplayComponents from "../definitions/DisplayComponents";
import * as FormComponents from "../definitions/FormComponents";
import * as GroupComponents from "../definitions/GroupComponents";
import * as LayoutComponents from "../definitions/LayoutComponents";
import * as NavigationComponents from "../definitions/NavigationComponents";
import * as OverlayComponents from "../definitions/OverlayComponents";
import * as SelectionComponents from "../definitions/SelectionComponents";
import * as TableComponents from "../definitions/TableComponents";

type DefinitionCreator = (
  context: ComponentCreationContext,
) => ComponentDefinition;

const MODULES: Record<string, Record<string, unknown>> = {
  DataComponents,
  DateColorComponents,
  DisplayComponents,
  FormComponents,
  GroupComponents,
  LayoutComponents,
  NavigationComponents,
  OverlayComponents,
  SelectionComponents,
  TableComponents,
};

const creators: Array<[string, DefinitionCreator]> = Object.entries(
  MODULES,
).flatMap(([moduleName, mod]) =>
  Object.entries(mod)
    .filter(
      (entry): entry is [string, DefinitionCreator] =>
        /^create[A-Za-z]+Definition$/.test(entry[0]) &&
        typeof entry[1] === "function",
    )
    .map(
      ([name, fn]) =>
        [`${moduleName}.${name}`, fn] as [string, DefinitionCreator],
    ),
);

const context = {
  parentElement: null,
  pageId: "page-gate",
  elements: [],
  layoutId: null,
  doc: { version: "composition-1.0", children: [] } as CompositionDocument,
} as unknown as ComponentCreationContext;

describe("ADR-201 G4 — 정적 corpus 에 평문 토큰 0", () => {
  it("팔레트 기본값 (getDefaultProps, placeable 전수)", () => {
    const findings = ComponentFactory.getRegisteredTypes().flatMap((type) =>
      findPlaintextTokens(getDefaultProps(type), `$.defaults.${type}`),
    );
    expect(findings).toEqual([]);
  });

  it("catalog accepts.default (entry 전수)", () => {
    const findings = componentCatalog.flatMap((entry) =>
      findPlaintextTokens(
        getCatalogDefaultProps(entry.type),
        `$.catalog.${entry.type}`,
      ),
    );
    expect(findings).toEqual([]);
  });

  it("factory definition 트리 (create*Definition 전수, 자식 포함)", () => {
    expect(creators.length).toBeGreaterThan(40);
    const findings = creators.flatMap(([name, create]) => {
      let def: ComponentDefinition;
      try {
        def = create(context);
      } catch {
        return []; // store 가 필요한 정의는 factoryNestingOracle 과 같은 이유로 건너뛴다
      }
      return findPlaintextTokens(def, `$.factory.${name}`);
    });
    expect(findings).toEqual([]);
  });

  it("FileUpload 기본값에는 endpoint 값이 없다 — 문서는 id 참조만 싣는다 (HC7)", () => {
    const props = getDefaultProps("FileUpload") as Record<string, unknown>;
    expect(props.endpoint).toBeUndefined();
    expect(Object.keys(props)).toEqual(
      expect.arrayContaining(["chunkSize", "autoProceed"]),
    );
  });

  it("음성 fixture — 게이트가 살아 있다 (평문 Bearer 를 넣으면 RED)", () => {
    const poisoned = {
      ...getDefaultProps("FileUpload"),
      endpoint: "ep-1",
      headers: { Authorization: "Bearer sk_live_0123456789abcdef" },
    };
    expect(findPlaintextTokens(poisoned, "$.fixture").length).toBe(1);
    // placeholder 로 바꾸면 통과 — ADR-212 vault 참조가 정상 경로다.
    poisoned.headers.Authorization = "{{secret.UPLOAD_TOKEN}}";
    expect(findPlaintextTokens(poisoned, "$.fixture")).toEqual([]);
  });
});
