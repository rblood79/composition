/**
 * AI Tool Definitions
 *
 * Tool Calling용 JSON Schema 정의.
 * unified.types.ts의 getDefaultProps() 키 목록과 동기화
 */

import type { LLMToolDefinition } from "../providers/LLMProvider";
import type { PromptTranslate } from "../promptTranslate";
import { getAiComponentCatalog } from "../catalog/componentCatalog";

/**
 * 도구 정의의 중첩 형태 (OpenAI function calling wire 형태).
 *
 * ADR-134 Phase 2 에서 벤더 SDK 타입 의존을 걷어내고 로컬 선언으로 대체했다 — 아래
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
 * AI 가 생성할 수 있는 컴포넌트 type — system prompt 의 카탈로그 인덱스와 같은 집합
 * (`getCatalogByCategory` 도 placeable 만 싣는다). 손으로 적은 목록은 카탈로그와 갈라져
 * 프롬프트 ("아래 목록만") 와 스키마 (enum) 가 다른 말을 했다 (PROMPT_AUDIT_2026-09 D2).
 * frame 은 catalog native entry 라 여기 포함된다 (ADR-130).
 */
const COMPONENT_TAGS: readonly string[] = getAiComponentCatalog()
  .filter((entry) => entry.placeable)
  .map((entry) => entry.type);

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
          collectionId: {
            type: "string",
            description: "aiToolDef.collectionIdRef",
          },
          collectionName: {
            type: "string",
            description: "aiToolDef.collectionNameRef",
          },
          fieldMap: {
            type: "object",
            description: "aiToolDef.bindFieldMap",
            properties: {
              value: { type: "string" },
              icon: { type: "string" },
            },
          },
          // legacy (ADR-134) — static 은 collection 으로 승격, api/supabase 는 안내만
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
        required: ["elementId"],
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
  // ADR-213 Phase 1 — 데이터 읽기 tool 4. 행 전량 노출 tool 은 없다 (I7).
  {
    type: "function",
    function: {
      name: "list_collections",
      description: "aiToolDef.listCollections",
      parameters: {
        type: "object",
        properties: {
          format: {
            type: "string",
            enum: ["concise", "detailed"],
            description: "aiToolDef.readFormat",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_collection",
      description: "aiToolDef.getCollection",
      parameters: {
        type: "object",
        properties: {
          collectionId: {
            type: "string",
            description: "aiToolDef.collectionIdRef",
          },
          name: {
            type: "string",
            description: "aiToolDef.collectionNameRef",
          },
          sampleRows: {
            type: "integer",
            description: "aiToolDef.sampleRows",
          },
          format: {
            type: "string",
            enum: ["concise", "detailed"],
            description: "aiToolDef.readFormat",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_api_endpoints",
      description: "aiToolDef.listApiEndpoints",
      parameters: {
        type: "object",
        properties: {
          format: {
            type: "string",
            enum: ["concise", "detailed"],
            description: "aiToolDef.readFormat",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_api_endpoint",
      description: "aiToolDef.getApiEndpoint",
      parameters: {
        type: "object",
        properties: {
          endpointId: {
            type: "string",
            description: "aiToolDef.endpointIdRef",
          },
          name: {
            type: "string",
            description: "aiToolDef.endpointNameRef",
          },
        },
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
