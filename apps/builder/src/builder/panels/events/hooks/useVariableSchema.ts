/**
 * useVariableSchema - 변수 바인딩 자동완성 스키마 제공
 *
 * 프로젝트의 DataTable, API, 이벤트 타입에 따라
 * 동적으로 자동완성 스키마 생성
 *
 * Phase 4: Events Panel 재설계
 */

import { useMemo } from 'react';
import type { VariableSchema, SchemaNode } from '../editors/VariableBindingEditor';

/**
 * DataTable 스키마 정보
 */
interface DataTableInfo {
  name: string;
  columns: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    description?: string;
  }>;
}

/**
 * API 엔드포인트 정보
 */
interface ApiEndpointInfo {
  name: string;
  responseSchema?: SchemaNode;
}

/**
 * 이벤트 타입별 페이로드 스키마
 */
const EVENT_PAYLOAD_SCHEMAS: Record<string, SchemaNode> = {
  onClick: {
    type: 'object',
    description: 'Mouse click event',
    properties: {
      target: {
        type: 'object',
        description: 'Event target element',
        properties: {
          id: { type: 'string', description: 'Element ID' },
          value: { type: 'string', description: 'Element value' },
          textContent: { type: 'string', description: 'Text content' },
        },
      },
      clientX: { type: 'number', description: 'Mouse X position' },
      clientY: { type: 'number', description: 'Mouse Y position' },
      button: { type: 'number', description: 'Mouse button (0=left, 1=middle, 2=right)' },
    },
  },
  onChange: {
    type: 'object',
    description: 'Input change event',
    properties: {
      target: {
        type: 'object',
        description: 'Event target element',
        properties: {
          id: { type: 'string', description: 'Element ID' },
          value: { type: 'string', description: 'Input value' },
          checked: { type: 'boolean', description: 'Checkbox checked state' },
          name: { type: 'string', description: 'Input name' },
        },
      },
    },
  },
  onSubmit: {
    type: 'object',
    description: 'Form submit event',
    properties: {
      target: {
        type: 'object',
        description: 'Form element',
        properties: {
          id: { type: 'string', description: 'Form ID' },
          elements: { type: 'object', description: 'Form elements' },
        },
      },
      formData: {
        type: 'object',
        description: 'Form data as key-value pairs',
      },
    },
  },
  onKeyDown: {
    type: 'object',
    description: 'Keyboard key down event',
    properties: {
      key: { type: 'string', description: 'Key pressed (e.g., "Enter", "Escape")' },
      code: { type: 'string', description: 'Physical key code' },
      ctrlKey: { type: 'boolean', description: 'Ctrl key pressed' },
      shiftKey: { type: 'boolean', description: 'Shift key pressed' },
      altKey: { type: 'boolean', description: 'Alt key pressed' },
      metaKey: { type: 'boolean', description: 'Meta (Cmd/Win) key pressed' },
    },
  },
  onKeyUp: {
    type: 'object',
    description: 'Keyboard key up event',
    properties: {
      key: { type: 'string', description: 'Key released' },
      code: { type: 'string', description: 'Physical key code' },
    },
  },
  onFocus: {
    type: 'object',
    description: 'Focus event',
    properties: {
      target: {
        type: 'object',
        description: 'Focused element',
        properties: {
          id: { type: 'string', description: 'Element ID' },
          value: { type: 'string', description: 'Element value' },
        },
      },
      relatedTarget: {
        type: 'object',
        description: 'Previously focused element',
      },
    },
  },
  onBlur: {
    type: 'object',
    description: 'Blur event',
    properties: {
      target: {
        type: 'object',
        description: 'Blurred element',
        properties: {
          id: { type: 'string', description: 'Element ID' },
          value: { type: 'string', description: 'Element value' },
        },
      },
      relatedTarget: {
        type: 'object',
        description: 'Newly focused element',
      },
    },
  },
  onMouseEnter: {
    type: 'object',
    description: 'Mouse enter event',
    properties: {
      target: {
        type: 'object',
        description: 'Entered element',
        properties: {
          id: { type: 'string', description: 'Element ID' },
        },
      },
      clientX: { type: 'number', description: 'Mouse X position' },
      clientY: { type: 'number', description: 'Mouse Y position' },
    },
  },
  onMouseLeave: {
    type: 'object',
    description: 'Mouse leave event',
    properties: {
      target: {
        type: 'object',
        description: 'Left element',
        properties: {
          id: { type: 'string', description: 'Element ID' },
        },
      },
    },
  },
};

/**
 * 기본 상태 스키마
 */
const DEFAULT_STATE_SCHEMA: Record<string, SchemaNode> = {
  isLoading: { type: 'boolean', description: '전역 로딩 상태' },
  error: { type: 'string', description: '에러 메시지' },
  user: {
    type: 'object',
    description: '현재 사용자 정보',
    properties: {
      id: { type: 'string', description: '사용자 ID' },
      name: { type: 'string', description: '사용자 이름' },
      email: { type: 'string', description: '이메일' },
      role: { type: 'string', description: '역할' },
    },
  },
  theme: { type: 'string', description: '현재 테마 (light/dark)' },
  locale: { type: 'string', description: '현재 로케일' },
};

/**
 * 기본 응답 스키마
 */
const DEFAULT_RESPONSE_SCHEMA: Record<string, SchemaNode> = {
  data: { type: 'any', description: 'API 응답 데이터' },
  status: { type: 'number', description: 'HTTP 상태 코드' },
  statusText: { type: 'string', description: 'HTTP 상태 텍스트' },
  headers: {
    type: 'object',
    description: '응답 헤더',
    properties: {
      'content-type': { type: 'string', description: 'Content-Type 헤더' },
    },
  },
  ok: { type: 'boolean', description: '성공 여부 (status 200-299)' },
};

/**
 * 기본 요소 스키마
 */
const DEFAULT_ELEMENT_SCHEMA: Record<string, SchemaNode> = {
  id: { type: 'string', description: '요소 ID' },
  type: { type: 'string', description: '태그 이름' },
  props: { type: 'object', description: '요소 속성' },
  style: { type: 'object', description: '인라인 스타일' },
  computedStyle: { type: 'object', description: '계산된 스타일' },
  boundingRect: {
    type: 'object',
    description: '요소 위치 및 크기',
    properties: {
      x: { type: 'number', description: 'X 좌표' },
      y: { type: 'number', description: 'Y 좌표' },
      width: { type: 'number', description: '너비' },
      height: { type: 'number', description: '높이' },
    },
  },
};

interface UseVariableSchemaOptions {
  /** 현재 이벤트 타입 (이벤트 페이로드 스키마 결정) */
  eventType?: string;
  /** 프로젝트의 DataTable 목록 */
  collections?: DataTableInfo[];
  /** 프로젝트의 API 엔드포인트 목록 */
  apiEndpoints?: ApiEndpointInfo[];
  /** 추가 상태 스키마 */
  additionalState?: Record<string, SchemaNode>;
  /** 추가 변수 스키마 */
  additionalVariables?: Record<string, SchemaNode>;
}

/**
 * 변수 바인딩 자동완성 스키마 제공 훅
 *
 * @example
 * const schema = useVariableSchema({
 *   eventType: 'onClick',
 *   collections: projectDataTables,
 *   apiEndpoints: projectApiEndpoints,
 * });
 *
 * <VariableBindingEditor schema={schema} ... />
 */
export function useVariableSchema(options: UseVariableSchemaOptions = {}): VariableSchema {
  const {
    eventType,
    collections = [],
    apiEndpoints = [],
    additionalState = {},
    additionalVariables = {},
  } = options;

  return useMemo(() => {
    // 이벤트 스키마
    const eventSchema = eventType
      ? EVENT_PAYLOAD_SCHEMAS[eventType]?.properties || {}
      : {};

    // DataTable 스키마 생성
    const datatableSchema: Record<string, SchemaNode> = {};
    for (const table of collections) {
      const columnProps: Record<string, SchemaNode> = {};
      for (const col of table.columns) {
        columnProps[col.name] = {
          type: col.type,
          description: col.description,
        };
      }

      datatableSchema[table.name] = {
        type: 'array',
        description: `${table.name} DataTable`,
        items: {
          type: 'object',
          properties: columnProps,
        },
      };
    }

    // API 응답 스키마 생성
    const apiResponseSchema: Record<string, SchemaNode> = { ...DEFAULT_RESPONSE_SCHEMA };
    for (const endpoint of apiEndpoints) {
      if (endpoint.responseSchema) {
        apiResponseSchema[endpoint.name] = endpoint.responseSchema;
      }
    }

    return {
      state: { ...DEFAULT_STATE_SCHEMA, ...additionalState },
      event: eventSchema as Record<string, SchemaNode>,
      datatable: datatableSchema,
      response: apiResponseSchema,
      element: DEFAULT_ELEMENT_SCHEMA,
      variable: additionalVariables,
    };
  }, [eventType, collections, apiEndpoints, additionalState, additionalVariables]);
}

/**
 * 이벤트 타입별 페이로드 스키마 가져오기
 */
export function getEventPayloadSchema(eventType: string): SchemaNode | undefined {
  return EVENT_PAYLOAD_SCHEMAS[eventType];
}

/**
 * DataTable에서 스키마 생성
 */
export function createDataTableSchema(columns: DataTableInfo['columns']): SchemaNode {
  const props: Record<string, SchemaNode> = {};
  for (const col of columns) {
    props[col.name] = {
      type: col.type,
      description: col.description,
    };
  }

  return {
    type: 'array',
    items: {
      type: 'object',
      properties: props,
    },
  };
}
