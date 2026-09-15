import { describe, expect, it } from "vitest";
import { getAiComponentCatalog } from "../catalog/componentCatalog";
import { resolveCompositeMode } from "../tools/compositeCreation";
import { listAgentCommands } from "../../agent/executeAgentCommand";
import { withPanelStyleFields } from "./styleManifest";
import { validateCommandArgs } from "./commandArgs";
import { compileRequest } from "./compile";
import { validateProgram, type CommandManifest } from "./manifest";

const manifest: CommandManifest = {
  components: getAiComponentCatalog().map((entry) => ({
    ...entry,
    creationMode: resolveCompositeMode(entry.type),
  })),
  commands: listAgentCommands().map((command) => ({
    ...command,
    args: command.args ? { ...command.args } : undefined,
  })),
};
const context = {
  parentId: "body",
  selectedId: "button-1",
  nodes: [
    { id: "body", type: "body" },
    { id: "button-1", type: "Button" },
  ],
};
const create = {
  version: 1,
  source: "compiler",
  operations: [
    { op: "create_element", args: { type: "Button", parentId: "body" } },
  ],
};

describe("ADR-202 closed compiler", () => {
  it.each([
    ["버튼 생성해", "Button"],
    ["버튼을 만들어줘", "Button"],
    ["Add a Button", "Button"],
    ["Select 추가해", "Select"],
    ["Card 추가해", "Card"],
    ["프레임 생성해", "frame"],
  ])("%s는 등록된 %s 생성 하나다", (text, type) => {
    const result = compileRequest(text, manifest, context);
    expect(result).toMatchObject({
      route: "direct",
      program: {
        operations: [
          { op: "create_element", args: { type, parentId: "body" } },
        ],
      },
    });
    if (result.route === "direct")
      expect(validateProgram(result.program, manifest, context).ok).toBe(true);
  });
  it.each([
    "버튼 만들지 마",
    "버튼 말고 카드 만들어",
    "delete everything",
    "버튼 100개 생성해",
    "여행 예약 위젯 만들어",
    "Button과 Select 추가해",
  ])("%s를 direct로 오해하지 않는다", (text) => {
    expect(compileRequest(text, manifest, context).route).not.toBe("direct");
  });
  it("필드·enum·schema version·추가 속성·multi-op은 실행 전에 거부한다", () => {
    for (const raw of [
      { ...create, version: 2 },
      { ...create, extra: true },
      { ...create, operations: [...create.operations, ...create.operations] },
      {
        ...create,
        operations: [
          {
            op: "create_element",
            args: { type: "Button", props: { madeUp: true } },
          },
        ],
      },
      {
        ...create,
        operations: [
          {
            op: "create_element",
            args: { type: "Button", props: { variant: "madeUp" } },
          },
        ],
      },
    ])
      expect(validateProgram(raw, manifest, context).ok).toBe(false);
  });
  it("placeable 변경을 손으로 쓴 enum이 숨기지 못한다", () => {
    const changed = {
      ...manifest,
      components: manifest.components.map((c) =>
        c.type === "Button" ? { ...c, placeable: false } : c,
      ),
    };
    expect(validateProgram(create, changed, context).ok).toBe(false);
    expect(compileRequest("버튼 생성해", changed, context).route).toBe(
      "ambiguous",
    );
  });
  it("선택·parent가 사라지면 mutation을 만들지 못한다", () => {
    expect(
      validateProgram(create, manifest, { ...context, nodes: [] }).ok,
    ).toBe(false);
    expect(
      compileRequest("선택한 요소 삭제", manifest, {
        ...context,
        selectedId: null,
      }).route,
    ).toBe("ambiguous");
  });
  it("병합 data command args 변경도 validator가 소비한다", () => {
    const command = manifest.commands.find((c) => c.id.startsWith("data."))!;
    const raw = {
      version: 1,
      source: "compiler",
      operations: [{ op: "run_command", args: { id: command.id, args: {} } }],
    };
    const changed = {
      ...manifest,
      commands: [
        {
          ...command,
          args: {
            type: "object",
            properties: { requiredNew: { type: "string" } },
            required: ["requiredNew"],
          },
        },
      ],
    };
    expect(validateProgram(raw, changed, context).ok).toBe(false);
    expect(
      validateProgram(raw, { ...manifest, commands: [] }, context).ok,
    ).toBe(false);
  });
});

describe("ADR-202 semantic sensitivity", () => {
  it("확인 recipe는 children을 보존하고 새 자식 구조를 만들지 않는다", () => {
    expect(compileRequest("확인 버튼 생성해", manifest, context)).toMatchObject(
      {
        route: "direct",
        program: {
          operations: [
            {
              op: "create_element",
              args: { type: "Button", props: { children: "확인" } },
            },
          ],
        },
      },
    );
  });
  it("명시한 대상 타입과 선택이 다르면 색상 변경을 확정하지 않는다", () => {
    expect(
      compileRequest("선택한 버튼을 파란색으로", manifest, {
        ...context,
        selectedId: "body",
      }).route,
    ).toBe("ambiguous");
  });
  it("새 schema keyword나 알 수 없는 field kind를 조용히 허용하지 않는다", () => {
    expect(validateCommandArgs({}, { type: "object", oneOf: [] })).toBe(false);
    const changed = {
      ...manifest,
      components: [
        {
          ...manifest.components.find((c) => c.type === "Button")!,
          props: [
            {
              name: "future",
              origin: "semantic" as const,
              kind: "future-kind",
            },
          ],
        },
      ],
    };
    expect(
      validateProgram(
        {
          ...create,
          operations: [
            {
              op: "create_element",
              args: { type: "Button", props: { future: {} } },
            },
          ],
        },
        changed,
        context,
      ).ok,
    ).toBe(false);
  });
  it("enum 제거가 기존 IR을 무효화한다", () => {
    const raw = {
      ...create,
      operations: [
        {
          op: "create_element",
          args: { type: "Button", props: { variant: "primary" } },
        },
      ],
    };
    expect(validateProgram(raw, manifest, context).ok).toBe(true);
    const changed = {
      ...manifest,
      components: manifest.components.map((c) => ({
        ...c,
        props: c.props.map((f) =>
          f.name === "variant" ? { ...f, values: [] } : f,
        ),
      })),
    };
    expect(validateProgram(raw, changed, context).ok).toBe(false);
  });
});

it("Styles 패널의 layout 키를 파생해 기존 Agent CSS 단위 입력을 보존한다", () => {
  const fields = withPanelStyleFields([
    { name: "height", kind: "number", origin: "style" },
  ]);
  const component = {
    ...manifest.components.find((c) => c.type === "Button")!,
    props: fields,
  };
  const local = { ...manifest, components: [component] };
  const raw = {
    ...create,
    operations: [
      {
        op: "create_element",
        args: {
          type: "Button",
          styles: {
            width: "80%",
            height: "2rem",
            padding: 16,
            display: "flex",
          },
        },
      },
    ],
  };
  expect(validateProgram(raw, local, context).ok).toBe(true);
  expect(
    validateProgram(
      {
        ...raw,
        operations: [
          {
            op: "create_element",
            args: { type: "Button", styles: { width: [] } },
          },
        ],
      },
      local,
      context,
    ).ok,
  ).toBe(false);
});

it("semantic/style의 같은 이름이 충돌하면 direct로 추측하지 않는다", () => {
  const collision = {
    ...context,
    nodes: [
      {
        id: "button-1",
        type: "Button",
        props: [
          { name: "color", origin: "semantic" as const, kind: "string" },
          { name: "color", origin: "style" as const, kind: "css" },
        ],
      },
    ],
  };
  expect(compileRequest("set color to blue", manifest, collision).route).toBe(
    "ambiguous",
  );
});
