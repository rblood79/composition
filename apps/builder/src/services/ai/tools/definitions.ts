/**
 * AI Tool Definitions
 *
 * Groq Tool Calling용 JSON Schema 정의
 * unified.types.ts의 getDefaultProps() 키 목록과 동기화
 */

import type Groq from "groq-sdk";

type ChatCompletionTool = Groq.Chat.Completions.ChatCompletionTool;

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
] as const;

export const toolDefinitions: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_element",
      description:
        "캔버스에 새 요소를 생성합니다. 버튼, 입력 필드, 테이블 등 다양한 UI 컴포넌트를 만들 수 있습니다.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "생성할 컴포넌트 타입",
            enum: COMPONENT_TAGS,
          },
          parentId: {
            type: "string",
            description: "부모 요소 ID. 없으면 선택된 요소 또는 body에 추가.",
          },
          props: {
            type: "object",
            description:
              "컴포넌트 속성 (children, variant, placeholder, label 등)",
          },
          styles: {
            type: "object",
            description:
              "CSS 인라인 스타일 (padding, fontSize, width, height 등). camelCase 사용. Fill V2 배경은 fills를 우선 사용.",
          },
          fills: {
            type: "array",
            description:
              "배경 Fill 레이어 배열. color/linear-gradient/radial-gradient/angular-gradient/image/mesh-gradient를 지원.",
            items: {
              type: "object",
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
      description: "기존 요소의 속성이나 스타일을 수정합니다.",
      parameters: {
        type: "object",
        properties: {
          elementId: {
            type: "string",
            description: '수정할 요소 ID. "selected"이면 현재 선택된 요소.',
          },
          props: {
            type: "object",
            description: "변경할 컴포넌트 속성",
          },
          styles: {
            type: "object",
            description:
              "변경할 CSS 인라인 스타일. camelCase 사용. Fill V2 배경은 fills를 우선 사용.",
          },
          fills: {
            type: "array",
            description: "교체할 배경 Fill 레이어 배열.",
            items: {
              type: "object",
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
      description: "요소를 삭제합니다. body 요소는 삭제할 수 없습니다.",
      parameters: {
        type: "object",
        properties: {
          elementId: {
            type: "string",
            description: '삭제할 요소 ID. "selected"이면 현재 선택된 요소.',
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
      description:
        "현재 에디터 상태를 조회합니다. 페이지 구조, 요소 트리, 선택 상태 등을 반환합니다.",
      parameters: {
        type: "object",
        properties: {
          includeStyles: {
            type: "boolean",
            description: "스타일 정보 포함 여부. false면 토큰 절약.",
          },
          maxDepth: {
            type: "number",
            description: "트리 탐색 최대 깊이. 기본 5.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_selection",
      description:
        "현재 선택된 요소의 상세 정보를 조회합니다. 태그, 속성, 스타일, 부모/자식 관계를 반환합니다.",
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
      description:
        "조건에 맞는 요소를 검색합니다. 태그, 속성명, 속성값, 스타일 속성으로 필터링할 수 있습니다.",
      parameters: {
        type: "object",
        properties: {
          type: {
            type: "string",
            description: "검색할 컴포넌트 태그 (예: Button, TextField)",
          },
          propName: {
            type: "string",
            description: "검색할 속성 이름 (예: children, variant)",
          },
          propValue: {
            type: "string",
            description: "검색할 속성 값. propName과 함께 사용.",
          },
          styleProp: {
            type: "string",
            description:
              "해당 CSS 속성이 설정된 요소를 검색 (예: padding, fontSize). Fill 기반 배경 검색은 별도 fills 데이터를 확인하세요.",
          },
          limit: {
            type: "number",
            description: "최대 반환 개수. 기본 20.",
          },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "batch_design",
      description:
        "여러 생성/수정/삭제 작업을 한 번에 순차 실행합니다. 복잡한 레이아웃을 한 번에 만들 때 유용합니다.",
      parameters: {
        type: "object",
        properties: {
          operations: {
            type: "array",
            description:
              "실행할 작업 배열. 순서대로 실행되며, 하나라도 실패하면 중단됩니다.",
            items: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: ["create", "update", "delete"],
                  description: "작업 유형",
                },
                args: {
                  type: "object",
                  description:
                    "해당 작업의 인자. create: {type, props, styles, parentId}, update: {elementId, props, styles}, delete: {elementId}",
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
];
