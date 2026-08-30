/**
 * AI Tool Definitions
 *
 * Groq Tool Calling용 JSON Schema 정의
 * unified.types.ts의 getDefaultProps() 키 목록과 동기화
 */

import type { LLMToolDefinition } from "../providers/LLMProvider";
import type { PromptTranslate } from "../promptTranslate";

/**
 * 도구 정의의 중첩 형태 (OpenAI function calling wire 형태).
 *
 * ADR-134 Phase 2 에서 `groq-sdk` 타입 의존을 걷어내고 로컬 선언으로 대체했다 — 아래
 * 배열의 구조는 그대로다. 평평한 `LLMToolDefinition` 으로의 정리는 Phase 3 (도구 어휘
 * 확장 + MCP 호환 형태 갱신) 소관이라, 지금은 `toLLMToolDefinitions()` 가 경계에서 옮긴다.
 */
interface ChatCompletionTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * AI가 생성할 수 있는 컴포넌트 태그 목록
 * getDefaultProps() (unified.types.ts:1023)의 키와 동기화
 */
const COMPONENT_TAGS = [
  "Button",
  "TextField",
  "Checkbox",
  "Radio",
  "ToggleButton",
  "ToggleButtonGroup",
  "CheckboxGroup",
  "RadioGroup",
  "Select",
  "ComboBox",
  "Slider",
  "Tabs",
  "Tree",
  "Calendar",
  "DatePicker",
  "DateRangePicker",
  "Switch",
  "Table",
  "Card",
  "TagGroup",
  "ListBox",
  "GridList",
  "Text",
  "Div",
  "Section",
  "Nav",
  // ADR-130 canonical layout container — ARIA Group 이 아니라 frame 이 layout 진입점.
  // ADR-134 Phase 3 에서 도구 어휘로 노출.
  "frame",
] as const;

export const toolDefinitions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_element",
      description: "aiToolDef.createElement",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "aiToolDef.createType",
            enum: COMPONENT_TAGS,
          },
          parentId: {
            type: "string",
            description: "aiToolDef.parentId",
          },
          props: {
            type: "object",
            description: "aiToolDef.props",
          },
          styles: {
            type: "object",
            description: "aiToolDef.styles",
          },
          fills: {
            type: "array",
            description: "aiToolDef.fills",
            items: {
              type: "object",
            },
          },
          canonical: {
            type: "object",
            description: "aiToolId.canonicalCreate",
            properties: {
              clip: {
                type: "boolean",
                description: "aiToolDef.clip",
              },
              placeholder: {
                type: "boolean",
                description: "aiToolDef.placeholder",
              },
              slot: {
                description: "aiToolDef.slot",
              },
              reusable: {
                type: "boolean",
                description: "aiToolDef.reusable",
              },
            },
          },
        },
        required: ["type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_element",
      description: "aiToolDef.updateElement",
      parameters: {
        type: "object",
        properties: {
          elementId: {
            type: "string",
            description: "aiToolId.elementIdUpdate",
          },
          props: {
            type: "object",
            description: "aiToolDef.updateProps",
          },
          styles: {
            type: "object",
            description: "aiToolDef.updateStyles",
          },
          fills: {
            type: "array",
            description: "aiToolDef.updateFills",
            items: {
              type: "object",
            },
          },
          canonical: {
            type: "object",
            description: "aiToolId.canonicalUpdate",
            properties: {
              clip: { type: "boolean" },
              placeholder: { type: "boolean" },
              slot: {},
              reusable: { type: "boolean" },
            },
          },
        },
        required: ["elementId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_element",
      description: "aiToolDef.deleteElement",
      parameters: {
        type: "object",
        properties: {
          elementId: {
            type: "string",
            description: "aiToolId.elementIdDelete",
          },
        },
        required: ["elementId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_editor_state",
      description: "aiToolDef.getEditorState",
      parameters: {
        type: "object",
        properties: {
          includeStyles: {
            type: "boolean",
            description: "aiToolDef.includeStyles",
          },
          maxDepth: {
            type: "number",
            description: "aiToolDef.maxDepth",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_selection",
      description: "aiToolDef.getSelection",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_elements",
      description: "aiToolDef.searchElements",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "aiToolDef.searchTag",
          },
          propName: {
            type: "string",
            description: "aiToolDef.searchPropName",
          },
          propValue: {
            type: "string",
            description: "aiToolDef.searchPropValue",
          },
          styleProp: {
            type: "string",
            description: "aiToolDef.searchStyleProp",
          },
          limit: {
            type: "number",
            description: "aiToolDef.searchLimit",
          },
          hasSlot: {
            type: "boolean",
            description: "aiToolDef.searchSlot",
          },
          reusable: {
            type: "boolean",
            description: "aiToolDef.searchReusable",
          },
          clip: {
            type: "boolean",
            description: "aiToolDef.searchClip",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "batch_design",
      description: "aiToolDef.batchDesign",
      parameters: {
        type: "object",
        properties: {
          operations: {
            type: "array",
            description: "aiToolDef.batchOperations",
            items: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: ["create", "update", "delete"],
                  description: "aiToolDef.batchType",
                },
                args: {
                  type: "object",
                  description: "aiToolDef.batchArgs",
                },
              },
              required: ["action", "args"],
            },
          },
        },
        required: ["operations"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "bind_collection",
      description: "aiToolDef.bindCollection",
      parameters: {
        type: "object",
        properties: {
          elementId: {
            type: "string",
            description: "aiToolId.elementIdTarget",
          },
          source: {
            type: "string",
            enum: ["static", "api", "supabase"],
            description: "aiToolDef.bindSource",
          },
          config: {
            type: "object",
            description: "aiToolDef.bindConfig",
          },
        },
        required: ["elementId", "source", "config"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_interaction_rule",
      description: "aiToolDef.createRule",
      parameters: {
        type: "object",
        properties: {
          elementId: {
            type: "string",
            description: "aiToolId.elementIdTrigger",
          },
          trigger: {
            type: "string",
            description: "aiToolDef.ruleTrigger",
          },
          action: {
            type: "object",
            description: "aiToolDef.ruleAction",
            properties: {
              kind: {
                type: "string",
                enum: ["navigate", "toast", "capability"],
              },
              path: { type: "string" },
              message: { type: "string" },
              targetId: { type: "string" },
              capability: { type: "string" },
              value: {},
            },
          },
        },
        required: ["elementId", "trigger", "action"],
      },
    },
  },
];

/**
 * ADR-196 — 빌더 명령 실행 도구. 정의(enum·설명)를 `COMMAND_META` allowlist 에서 생성하므로
 * 표가 바뀌면 도구 목록도 함께 바뀐다 (목록이 따로 낡지 않는다).
 *
 * 동적 import 인 이유: agent 명령 표면 (`COMMAND_META` + adapter + executor) 은 agent 가
 * 실제로 명령을 부를 때만 필요하다. 정적으로 매달면 초기 번들에 3KB+ 가 상주한다 (HC6).
 */
export async function getToolDefinitions(
  t: PromptTranslate,
): Promise<LLMToolDefinition[]> {
  const { buildRunCommandToolDefinition } = await import("./runCommand");
  return [
    ...toLLMToolDefinitions(toolDefinitions, t),
    buildRunCommandToolDefinition(t),
  ];
}

/** 중첩 정의 → provider 중립 정의 (JSON Schema 는 그대로 통과). */
/**
 * 정의에 실린 것은 문구가 아니라 **키**다 (ADR-200 후속). 중첩 schema 어디에나
 * `description` 이 있으므로 재귀로 훑어 한 번에 해소한다 — 키가 아닌 값(빈 문자열
 * 등)은 그대로 지나간다.
 */
function resolveDescriptions(value: unknown, t: PromptTranslate): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => resolveDescriptions(item, t));
  }
  if (typeof value !== "object" || value === null) return value;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    out[key] =
      key === "description" && typeof nested === "string"
        ? t(nested)
        : resolveDescriptions(nested, t);
  }
  return out;
}

export function toLLMToolDefinitions(
  definitions: readonly ChatCompletionTool[],
  t: PromptTranslate,
): LLMToolDefinition[] {
  return definitions.map((definition) => ({
    name: definition.function.name,
    description: t(definition.function.description ?? ""),
    parameters: (resolveDescriptions(
      definition.function.parameters,
      t,
    ) as LLMToolDefinition["parameters"]) ?? {
      type: "object",
      properties: {},
    },
  }));
}
