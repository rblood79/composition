# Nested Routes & Slug System Design

**Status:** v2.3 (Phase 1-6 Complete)
**Created:** 2025-11-28
**Updated:** 2025-11-30
**Author:** Claude
**Related:** Layout/Slot System, Page Management, Data Panel System

---

## Implementation Progress

| Phase   | Status | Description                       |
| ------- | ------ | --------------------------------- |
| Phase 1 | ✅     | Foundation (Types, DB)            |
| Phase 2 | ✅     | Page Creation UI (Router)         |
| Phase 3 | ✅     | Dynamic Route Parameters          |
| Phase 4 | ✅     | Property Editors                  |
| Phase 5 | ✅     | NodesPanel Tree                   |
| Phase 6 | ✅     | Testing & Polish                  |
| Phase 7 | 📋     | Data Panel Integration (advanced) |

---

## 변경 이력

| 버전 | 날짜       | 변경 내용                                             |
| ---- | ---------- | ----------------------------------------------------- |
| v1.0 | 2025-11-28 | 초안 작성                                             |
| v2.0 | 2025-11-29 | Data Panel 통합, 동적 라우트 지원, Visual Picker 연동 |
| v2.1 | 2025-11-30 | Phase 3 동적 라우트 구현 완료                         |
| v2.2 | 2025-11-30 | Phase 4-5 완료 확인 (이미 구현됨)                     |
| v2.3 | 2025-11-30 | Phase 6 Testing & Polish 완료                         |

---

## 1. Overview

### 1.1 Problem Statement

현재 composition의 페이지 라우팅 시스템:

- 페이지 생성 시 slug가 `/page-1`, `/page-2` 형태로 자동 생성
- 중첩 경로 (`/products/category/item`) 지원 없음
- Layout과 URL 구조의 연관성 없음

### 1.2 Goal

`/products/shoes/nike` 같은 중첩 라우트를 지원하면서, Layout 시스템과 자연스럽게 통합

### 1.3 v2.0 확장 목표

**동적 라우트 + Data Panel 통합:**

- `/products/:productId` 같은 동적 라우트 지원
- DataTable과 라우트 파라미터 자동 바인딩
- Visual Picker로 라우트 파라미터 선택

```
┌─────────────────────────────────────────────────────────────┐
│                   v2.0 통합 아키텍처                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  URL: /products/:productId                                   │
│                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Route Parameter: { productId: "123" }                   ││
│  └─────────────────────────────────────────────────────────┘│
│                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ API Endpoint: /api/products/{{route.productId}}         ││
│  └─────────────────────────────────────────────────────────┘│
│                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ DataTable: products (자동 필터링/로드)                   ││
│  └─────────────────────────────────────────────────────────┘│
│                    ↓                                         │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Component Binding: {{products.name}}                    ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 Design Principle

**Case 2 (계층 기반)를 기본으로, Layout slug는 선택적 옵션**

```
┌─────────────────────────────────────────────┐
│         Case 2 (계층 기반 - Superset)         │
│                                             │
│   ┌─────────────────────────────────────┐   │
│   │  Case 1 (Layout 기반 URL)           │   │
│   │  + 자유로운 URL                      │   │
│   └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

**Rationale:**

- Layout의 본질 = 반복을 줄이기 위한 미리 정의된 구조
- 같은 Layout을 쓰는 페이지들 = 같은 섹션/카테고리 = 같은 URL 패턴
- 하지만 다양한 고객 요구를 위해 자유로운 URL도 지원 필요
- **Case 2는 Case 1을 포함하는 상위 집합**

---

## 2. Data Structure Changes

### 2.1 Layout Type (변경)

```typescript
// src/types/builder/layout.types.ts

export interface Layout {
  id: string;
  name: string;
  project_id: string;
  description?: string;

  // ✅ NEW FIELDS
  order_num?: number; // 정렬 순서
  slug?: string; // URL base path (e.g., "/products")

  // ✅ NEW: 404 처리
  notFoundPageId?: string; // Layout 전용 404 페이지 ID
  inheritNotFound?: boolean; // true면 프로젝트 기본 404 상속 (기본값: true)

  created_at?: string;
  updated_at?: string;
}
```

### 2.2 LayoutCreate, LayoutUpdate 타입 (변경)

```typescript
// src/types/builder/layout.types.ts

/**
 * Layout 생성 시 필요한 필드
 */
export type LayoutCreate = Pick<Layout, "name" | "project_id"> & {
  description?: string;
  order_num?: number; // ✅ 추가
  slug?: string; // ✅ 추가
};

/**
 * Layout 업데이트 시 필요한 필드
 */
export type LayoutUpdate = Partial<
  Pick<
    Layout,
    "name" | "description" | "slug" | "notFoundPageId" | "inheritNotFound"
  >
>; // ✅ slug, 404 필드 추가
```

### 2.3 Page Type (기존 유지)

```typescript
// src/types/builder/unified.types.ts (기존)

export interface Page {
  id: string;
  title: string; // 페이지 제목
  project_id: string;
  slug: string; // URL 경로 - 절대경로(/로 시작) 또는 상대경로
  parent_id?: string | null;
  order_num?: number;
  layout_id?: string | null;
  created_at?: string;
  updated_at?: string;
}
```

**⚠️ 중요: slug 필드 사용 규칙**

| 상황                       | slug 값           | 최종 URL                        |
| -------------------------- | ----------------- | ------------------------------- |
| 절대 경로                  | `/products/shoes` | `/products/shoes` (그대로 사용) |
| Layout 있음 + 상대 경로    | `nike`            | `{Layout.slug}/nike`            |
| parent_id 있음 + 상대 경로 | `nike`            | `{부모 URL}/nike`               |
| 상대 경로만                | `page-1`          | `/page-1`                       |

### 2.4 Database Migration (Supabase)

```sql
-- supabase/migrations/YYYYMMDD_add_layout_slug.sql

-- 1. Layout 테이블에 필드 추가
ALTER TABLE layouts
  ADD COLUMN order_num INTEGER DEFAULT 0,
  ADD COLUMN slug TEXT;

-- 2. Unique constraint (프로젝트 내 slug 고유)
CREATE UNIQUE INDEX idx_layout_slug_project
  ON layouts(project_id, slug)
  WHERE slug IS NOT NULL;

-- 3. order_num 인덱스
CREATE INDEX idx_layout_order
  ON layouts(project_id, order_num);
```

### 2.5 IndexedDB Schema Update

```typescript
// src/lib/db/indexedDB/adapter.ts

// ⚠️ DB_VERSION 증가 필요 (현재 5 → 6)
const DB_VERSION = 6;

// onupgradeneeded 핸들러 내부
// ✅ 버전 6: layouts 스토어에 order_num, slug 인덱스 추가
if (!db.objectStoreNames.contains("layouts")) {
  const layoutsStore = db.createObjectStore("layouts", { keyPath: "id" });
  layoutsStore.createIndex("project_id", "project_id", { unique: false });
  layoutsStore.createIndex("name", "name", { unique: false });
  layoutsStore.createIndex("order_num", "order_num", { unique: false }); // ✅ 추가
  layoutsStore.createIndex("slug", "slug", { unique: false }); // ✅ 추가
  console.log(
    "[IndexedDB] Created store: layouts with order_num, slug indexes",
  );
} else {
  // 기존 스토어에 인덱스 추가
  const transaction = (event.target as IDBOpenDBRequest).transaction;
  if (transaction) {
    const layoutsStore = transaction.objectStore("layouts");
    if (!layoutsStore.indexNames.contains("order_num")) {
      layoutsStore.createIndex("order_num", "order_num", { unique: false });
      console.log("[IndexedDB] Added index: layouts.order_num");
    }
    if (!layoutsStore.indexNames.contains("slug")) {
      layoutsStore.createIndex("slug", "slug", { unique: false });
      console.log("[IndexedDB] Added index: layouts.slug");
    }
  }
}

// ✅ layouts API 타입 수정 (인라인 타입 → Layout 타입 import)
import type { Layout } from "../../../types/builder/layout.types";

layouts = {
  insert: async (layout: Layout) => {
    const now = new Date().toISOString();
    const layoutWithTimestamps: Layout = {
      ...layout,
      created_at: layout.created_at || now,
      updated_at: layout.updated_at || now,
    };
    await this.putToStore("layouts", layoutWithTimestamps);
    return layoutWithTimestamps;
  },

  update: async (id: string, updates: Partial<Layout>) => {
    const existing = await this.layouts.getById(id);
    if (!existing) {
      throw new Error(`Layout ${id} not found`);
    }
    const updated: Layout = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    await this.putToStore("layouts", updated);
    return updated;
  },

  delete: async (id: string): Promise<void> => {
    await this.deleteFromStore("layouts", id);
  },

  getById: async (id: string): Promise<Layout | null> => {
    return this.getFromStore<Layout>("layouts", id);
  },

  getByProject: async (projectId: string): Promise<Layout[]> => {
    return this.getAllByIndex<Layout>("layouts", "project_id", projectId);
  },

  getAll: async (): Promise<Layout[]> => {
    return this.getAllFromStore<Layout>("layouts");
  },
};
```

---

## 3. URL Generation Logic

### 3.1 URL 결정 우선순위

```
1. Page.slug가 절대 경로 (/ 로 시작)인 경우 → 그대로 사용
2. Layout.slug가 있는 경우 → Layout.slug + "/" + Page.slug
3. parent_id가 있는 경우 → 부모 URL + "/" + Page.slug
4. 그 외 → "/" + Page.slug
```

### 3.2 예시 시나리오

**Scenario A: Layout 기반 URL**

```
Layout: { slug: "/products" }
Page: { slug: "shoes/nike", layout_id: "layout-1" }  // 상대 경로
→ Final URL: /products/shoes/nike
```

**Scenario B: 계층 기반 URL**

```
Page 1: { slug: "/products", parent_id: null }      // 절대 경로
Page 2: { slug: "shoes", parent_id: "page-1" }      // 상대 경로 → /products/shoes
Page 3: { slug: "nike", parent_id: "page-2" }       // 상대 경로 → /products/shoes/nike
```

**Scenario C: 자유 URL (Layout 없음)**

```
Page: { slug: "/promo-summer-2024", layout_id: null }  // 절대 경로
→ Final URL: /promo-summer-2024
```

**Scenario D: 절대 경로는 Layout slug 무시**

```
Layout: { slug: "/blog" }
Page: { slug: "/special-post", layout_id: "layout-1" }  // 절대 경로
→ Final URL: /special-post (Layout slug 무시)
```

### 3.3 URL 생성 유틸리티

```typescript
// src/utils/urlGenerator.ts

import type { Page } from "../types/builder/unified.types";
import type { Layout } from "../types/builder/layout.types";

interface GeneratePageUrlParams {
  page: Page;
  layout?: Layout | null;
  allPages?: Page[];
}

/**
 * 페이지의 최종 URL을 생성합니다.
 *
 * @param page - 대상 페이지
 * @param layout - 페이지에 적용된 Layout (optional)
 * @param allPages - 전체 페이지 목록 (parent_id 기반 URL 생성 시 필요)
 */
export function generatePageUrl({
  page,
  layout,
  allPages,
}: GeneratePageUrlParams): string {
  // 1. 절대 경로인 경우 그대로 반환
  if (page.slug.startsWith("/")) {
    return page.slug;
  }

  // 2. Layout slug가 있는 경우
  if (layout?.slug) {
    return normalizeUrl(`${layout.slug}/${page.slug}`);
  }

  // 3. parent_id가 있는 경우 (계층 기반)
  if (page.parent_id && allPages) {
    const parentUrl = buildParentPath(page.parent_id, allPages);
    return normalizeUrl(`${parentUrl}/${page.slug}`);
  }

  // 4. 기본값: 상대 경로를 절대 경로로 변환
  return normalizeUrl(`/${page.slug}`);
}

/**
 * 부모 페이지 경로를 재귀적으로 구성합니다.
 */
function buildParentPath(parentId: string, allPages: Page[]): string {
  const parent = allPages.find((p) => p.id === parentId);
  if (!parent) return "";

  // 부모가 절대 경로면 그대로 반환
  if (parent.slug.startsWith("/")) {
    return parent.slug;
  }

  // 부모도 parent_id가 있으면 재귀
  if (parent.parent_id) {
    return `${buildParentPath(parent.parent_id, allPages)}/${parent.slug}`;
  }

  return `/${parent.slug}`;
}

/**
 * URL 정규화 (연속 슬래시 제거)
 */
function normalizeUrl(url: string): string {
  return url.replace(/\/+/g, "/");
}

/**
 * 순환 참조 검증
 *
 * @param pageId - 검증 대상 페이지 ID
 * @param newParentId - 설정하려는 새 parent_id
 * @param allPages - 전체 페이지 목록
 * @returns true면 순환 참조 발생
 */
export function hasCircularReference(
  pageId: string,
  newParentId: string | null,
  allPages: Page[],
): boolean {
  if (!newParentId) return false;

  let currentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === pageId) return true; // 순환 발견
    if (visited.has(currentId)) return true; // 이미 방문 (무한 루프 방지)
    visited.add(currentId);

    const parent = allPages.find((p) => p.id === currentId);
    currentId = parent?.parent_id || null;
  }

  return false;
}

/**
 * 중첩 깊이 계산
 */
export function getNestingDepth(pageId: string, allPages: Page[]): number {
  let depth = 0;
  let currentId: string | null = pageId;

  while (currentId) {
    const page = allPages.find((p) => p.id === currentId);
    if (!page?.parent_id) break;
    depth++;
    currentId = page.parent_id;
  }

  return depth;
}
```

---

## 3.4 동적 라우트 (v2.0 NEW)

### 동적 세그먼트 문법

```typescript
// Page.slug 동적 세그먼트 패턴
/products/:productId          // 단일 파라미터
/users/:userId/posts/:postId  // 다중 파라미터
/blog/[...slug]               // Catch-all (선택적)
```

### Page 타입 확장

```typescript
// src/types/builder/unified.types.ts

export interface Page {
  id: string;
  title: string;
  project_id: string;
  slug: string;
  parent_id?: string | null;
  order_num?: number;
  layout_id?: string | null;

  // ✅ v2.0 NEW: 동적 라우트 설정
  routeParams?: RouteParam[]; // 동적 파라미터 정의
  dataBindings?: PageDataBinding[]; // 라우트 → DataTable 바인딩

  created_at?: string;
  updated_at?: string;
}

export interface RouteParam {
  name: string; // 파라미터 이름 (productId)
  type: "string" | "number";
  required: boolean;
  defaultValue?: string;
  validation?: {
    pattern?: string; // 정규식 패턴
    min?: number; // 숫자 최소값
    max?: number; // 숫자 최대값
  };
}

export interface PageDataBinding {
  dataTableId: string; // 바인딩할 DataTable ID
  paramName: string; // 라우트 파라미터 이름
  fieldPath: string; // DataTable 필드 경로 (id, slug 등)
  autoLoad: boolean; // 페이지 진입 시 자동 로드
}
```

### 동적 라우트 예시

```
┌─────────────────────────────────────────────────────────────┐
│  Page: Product Detail                                        │
├─────────────────────────────────────────────────────────────┤
│  Slug: /products/:productId                                  │
│                                                              │
│  Route Parameters:                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Name: productId                                         ││
│  │ Type: string                                            ││
│  │ Required: true                                          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  Data Bindings:                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ DataTable: products                                     ││
│  │ Match: productId → products.id                          ││
│  │ Auto Load: ✅                                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  Preview URL: /products/123                                  │
│               └─ products DataTable에서 id=123 자동 로드     │
└─────────────────────────────────────────────────────────────┘
```

### 라우트 파라미터 추출 유틸리티

```typescript
// src/utils/routeUtils.ts

/**
 * slug에서 동적 파라미터 이름 추출
 * /products/:productId → ['productId']
 */
export function extractRouteParams(slug: string): string[] {
  const matches = slug.match(/:([a-zA-Z][a-zA-Z0-9]*)/g);
  return matches ? matches.map((m) => m.slice(1)) : [];
}

/**
 * 실제 URL에서 파라미터 값 추출
 * pattern: /products/:productId
 * url: /products/123
 * → { productId: '123' }
 */
export function matchRouteParams(
  pattern: string,
  url: string,
): Record<string, string> | null {
  const patternParts = pattern.split("/").filter(Boolean);
  const urlParts = url.split("/").filter(Boolean);

  if (patternParts.length !== urlParts.length) return null;

  const params: Record<string, string> = {};

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];
    const urlPart = urlParts[i];

    if (patternPart.startsWith(":")) {
      params[patternPart.slice(1)] = urlPart;
    } else if (patternPart !== urlPart) {
      return null;
    }
  }

  return params;
}

/**
 * 파라미터 값으로 URL 생성
 * pattern: /products/:productId
 * params: { productId: '123' }
 * → /products/123
 */
export function generateUrlWithParams(
  pattern: string,
  params: Record<string, string>,
): string {
  return pattern.replace(/:([a-zA-Z][a-zA-Z0-9]*)/g, (_, name) => {
    return params[name] || `:${name}`;
  });
}
```

---

## 3.5 Data Panel 통합 (v2.0 NEW)

### 라우트 → DataTable 자동 바인딩

```
사용자 흐름:
1. /products/:productId 페이지 생성
2. productId 파라미터 → products DataTable 바인딩 설정
3. 페이지 진입 시 자동으로 API 호출
   GET /api/products/{{route.productId}}
4. 응답 데이터가 products DataTable에 저장
5. 컴포넌트에서 {{products.name}} 바인딩 사용
```

### Visual Picker에서 라우트 파라미터 접근

```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Variable Picker                                          │
├─────────────────────────────────────────────────────────────┤
│  ▼ route (현재 페이지 라우트)                                │
│    ├─ productId: "123"                                       │
│    └─ categoryId: "shoes"                                    │
│                                                              │
│  ▼ dataTables                                                │
│    ├─ products (1 row)                                       │
│    │   ├─ id: "123"                                          │
│    │   ├─ name: "Nike Air Max"                               │
│    │   ├─ price: 129000                                      │
│    │   └─ ...                                                │
│    └─ categories                                             │
│                                                              │
│  ▼ variables                                                 │
│    ├─ user                                                   │
│    └─ settings                                               │
└─────────────────────────────────────────────────────────────┘
```

### 바인딩 표현식 예시

```typescript
// 라우트 파라미터 직접 사용
{{route.productId}}

// DataTable 데이터 사용 (라우트로 필터된)
{{products.name}}
{{products.price | currency}}

// API 엔드포인트에서 라우트 파라미터 사용
{
  "baseUrl": "https://api.example.com",
  "endpoint": "/products/{{route.productId}}",
  "method": "GET"
}

// Transformer에서 라우트 파라미터 접근
// Level 2 (JS Transformer)
const productId = context.route.productId;
return data.filter(item => item.id === productId);
```

### Page + DataTable 연동 설정 UI

```
┌─────────────────────────────────────────────────────────────┐
│  📄 Page: Product Detail                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ▼ Route Settings                                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Slug: /products/:productId                              ││
│  │                                                         ││
│  │ Parameters:                                             ││
│  │ ┌───────────┬─────────┬──────────┬─────────────────┐   ││
│  │ │ Name      │ Type    │ Required │ Validation       │   ││
│  │ ├───────────┼─────────┼──────────┼─────────────────┤   ││
│  │ │ productId │ string  │ ✅       │ [0-9]+           │   ││
│  │ └───────────┴─────────┴──────────┴─────────────────┘   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
│  ▼ Data Bindings                              [+ Add]       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ DataTable: [products            ▼]                      ││
│  │ Match Field: [id                ▼]                      ││
│  │ Route Param: [productId         ▼]                      ││
│  │ Auto Load: [✅]                                         ││
│  │                                                         ││
│  │ API Endpoint: (자동 생성)                               ││
│  │ GET /api/products/{{route.productId}}                   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 라우트 변경 시 데이터 자동 갱신

```typescript
// src/canvas/hooks/useRouteDataBinding.ts

import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { useDataPanelStore } from "../../stores/dataPanel";

export function useRouteDataBinding(page: Page) {
  const params = useParams();
  const { executeApiEndpoint, setDataTable } = useDataPanelStore();

  useEffect(() => {
    if (!page.dataBindings?.length) return;

    // 라우트 파라미터 변경 시 데이터 자동 로드
    page.dataBindings.forEach(async (binding) => {
      if (!binding.autoLoad) return;

      const paramValue = params[binding.paramName];
      if (!paramValue) return;

      // API 호출 (라우트 파라미터 치환)
      const result = await executeApiEndpoint(binding.apiEndpointId, {
        route: params,
      });

      // DataTable 업데이트
      if (result.success) {
        setDataTable(binding.dataTableId, result.data);
      }
    });
  }, [params, page.dataBindings]);
}
```

---

## 4. Page Creation Flow

### 4.1 Current Flow

```
현재:
1. "Add Page" 버튼 클릭
2. 자동으로 페이지 생성 (title: "Page N", slug: "/page-N")
3. 편집 불가
```

### 4.2 New Flow

```
개선:
1. "Add Page" 버튼 클릭
2. 다이얼로그 표시:
   ┌─────────────────────────────────┐
   │  Add New Page                   │
   ├─────────────────────────────────┤
   │  Title: [Page 4        ]        │  ← 기본값: "Page {N}"
   │  Slug:  [/page-4       ]        │  ← 기본값: "/page-{N}"
   │                                 │
   │  Layout: [None         ▼]       │  ← 선택적
   │  Parent: [None         ▼]       │  ← 선택적 (계층 구조)
   │                                 │
   │  [Cancel]          [Create]     │
   └─────────────────────────────────┘
3. 사용자가 값 수정 또는 기본값 사용
4. 페이지 생성
```

### 4.3 usePageManager 수정

```typescript
// src/builder/hooks/usePageManager.ts

// ✅ 새로운 타입 정의
export interface AddPageParams {
  projectId: string;
  title: string;
  slug: string;
  layoutId?: string | null;
  parentId?: string | null;
}

// ✅ 기본값 생성 함수 (다이얼로그에서 사용)
export function generatePageDefaults(existingPages: Page[]): {
  title: string;
  slug: string;
} {
  const nextNum = existingPages.length + 1;
  return {
    title: `Page ${nextNum}`,
    slug: `/page-${nextNum}`, // 절대 경로로 기본 생성
  };
}

// ✅ addPage 함수 시그니처 변경
const addPage = async (params: AddPageParams): Promise<ApiResult<ApiPage>> => {
  const { projectId, title, slug, layoutId, parentId } = params;

  // 순환 참조 검증
  if (parentId) {
    const { pages } = useStore.getState();
    if (hasCircularReference("", parentId, pages)) {
      return {
        success: false,
        error: new Error("Circular reference detected"),
      };
    }
  }

  try {
    const currentPages = useStore.getState().pages;
    const maxOrderNum = currentPages.reduce(
      (max, page) => Math.max(max, page.order_num || 0),
      -1,
    );

    const db = await getDB();
    const newPageData = {
      id: ElementUtils.generateId(),
      project_id: projectId,
      name: title,
      slug: slug,
      parent_id: parentId || null,
      layout_id: layoutId || null,
      order_num: maxOrderNum + 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const newPage = await db.pages.insert(newPageData);
    // ... rest of the implementation
  } catch (error) {
    return { success: false, error: error as Error };
  }
};
```

### 4.4 Slug Validation Rules

```typescript
// src/utils/slugValidator.ts

export interface SlugValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSlug(slug: string): SlugValidationResult {
  // 1. 빈 값 체크
  if (!slug.trim()) {
    return { valid: false, error: "Slug cannot be empty" };
  }

  // 2. 유효 문자 체크 (영문, 숫자, 하이픈, 슬래시)
  if (!/^[a-z0-9\-\/]+$/i.test(slug)) {
    return {
      valid: false,
      error: "Slug can only contain letters, numbers, hyphens, and slashes",
    };
  }

  // 3. 연속 슬래시 체크
  if (/\/\/+/.test(slug)) {
    return { valid: false, error: "Slug cannot contain consecutive slashes" };
  }

  // 4. 끝 슬래시 체크
  if (slug.endsWith("/") && slug !== "/") {
    return { valid: false, error: "Slug cannot end with a slash" };
  }

  return { valid: true };
}

/**
 * slug 자동 생성 (title → slug)
 */
export function generateSlugFromTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // 특수문자 제거
    .replace(/\s+/g, "-") // 공백 → 하이픈
    .replace(/-+/g, "-") // 연속 하이픈 제거
    .replace(/^-|-$/g, ""); // 앞뒤 하이픈 제거
}
```

---

## 5. Property Editor Integration

### 5.1 Page Property Editor

```
┌─────────────────────────────────────────┐
│  Page Properties                        │
├─────────────────────────────────────────┤
│  📄 Basic                               │
│  ├─ Title: [Nike Shoes      ]          │
│  ├─ Slug:  [nike-shoes      ]          │  ← 상대 경로
│  │         ↳ Preview: /products/shoes/nike-shoes
│  │                                      │
│  📐 Layout                              │
│  ├─ Layout: [Products Layout ▼]         │
│  │          Base URL: /products         │
│  │                                      │
│  🌲 Hierarchy                           │
│  ├─ Parent: [Shoes Category  ▼]         │
│  │   ⚠️ Nesting depth: 3 (SEO warning)  │  ← 깊은 중첩 경고
│  └─ Order:  [3              ]           │
└─────────────────────────────────────────┘
```

### 5.2 Page Editor Component

```typescript
// src/builder/panels/properties/editors/PageEditor.tsx

import { useMemo } from "react";
import { useLayoutsStore } from "../../../stores/layouts";
import { useStore } from "../../../stores";
import {
  generatePageUrl,
  getNestingDepth,
  hasCircularReference,
} from "../../../../utils/urlGenerator";
import { PropertyInput, PropertySelect } from "../../components";

interface PageEditorProps {
  page: Page;
  onUpdate: (updates: Partial<Page>) => void;
}

export function PageEditor({ page, onUpdate }: PageEditorProps) {
  const layouts = useLayoutsStore((s) => s.layouts);
  const pages = useStore((s) => s.pages);
  const selectedLayout = layouts.find((l) => l.id === page.layout_id);

  // URL 미리보기 계산
  const previewUrl = useMemo(() => {
    return generatePageUrl({ page, layout: selectedLayout, allPages: pages });
  }, [page, selectedLayout, pages]);

  // 중첩 깊이 계산
  const nestingDepth = useMemo(() => {
    return getNestingDepth(page.id, pages);
  }, [page.id, pages]);

  // Parent 변경 핸들러 (순환 참조 검증 포함)
  const handleParentChange = (newParentId: string | null) => {
    if (newParentId && hasCircularReference(page.id, newParentId, pages)) {
      // 순환 참조 경고 표시
      console.warn("Circular reference detected");
      return;
    }
    onUpdate({ parent_id: newParentId });
  };

  return (
    <div className="page-editor">
      {/* Basic Section */}
      <fieldset className="properties-group">
        <legend>Basic</legend>

        <PropertyInput
          label="Title"
          value={page.title}
          onChange={(value) => onUpdate({ title: value })}
          placeholder="Page Title"
        />

        <PropertyInput
          label="Slug"
          value={page.slug}
          onChange={(value) => onUpdate({ slug: value })}
          placeholder="/page-url or relative-path"
        />

        <div className="url-preview">
          Preview: <code>{previewUrl}</code>
        </div>
      </fieldset>

      {/* Layout Section */}
      <fieldset className="properties-group">
        <legend>Layout</legend>

        <PropertySelect
          label="Layout"
          value={page.layout_id || ""}
          onChange={(value) => onUpdate({ layout_id: value || null })}
          options={[
            { value: "", label: "None" },
            ...layouts.map((l) => ({
              value: l.id,
              label: `${l.name}${l.slug ? ` (${l.slug})` : ""}`,
            })),
          ]}
        />

        {selectedLayout?.slug && (
          <div className="layout-slug-info">
            Base URL: <code>{selectedLayout.slug}</code>
          </div>
        )}
      </fieldset>

      {/* Hierarchy Section */}
      <fieldset className="properties-group">
        <legend>Hierarchy</legend>

        <PropertySelect
          label="Parent Page"
          value={page.parent_id || ""}
          onChange={(value) => handleParentChange(value || null)}
          options={[
            { value: "", label: "None (Root)" },
            ...pages
              .filter((p) => p.id !== page.id) // 자기 자신 제외
              .map((p) => ({ value: p.id, label: p.title })),
          ]}
        />

        {/* ✅ 깊은 중첩 경고 */}
        {nestingDepth >= 3 && (
          <div className="nesting-warning">
            ⚠️ Nesting depth: {nestingDepth} (may affect SEO)
          </div>
        )}
      </fieldset>
    </div>
  );
}
```

### 5.3 Layout Property Editor (slug 추가)

```typescript
// src/builder/panels/properties/editors/LayoutEditor.tsx

import { PropertyInput } from "../../components";

interface LayoutEditorProps {
  layout: Layout;
  onUpdate: (updates: Partial<Layout>) => void;
}

export function LayoutEditor({ layout, onUpdate }: LayoutEditorProps) {
  return (
    <div className="layout-editor">
      <fieldset className="properties-group">
        <legend>Basic</legend>

        <PropertyInput
          label="Name"
          value={layout.name}
          onChange={(value) => onUpdate({ name: value })}
          placeholder="Layout Name"
        />

        <PropertyInput
          label="Description"
          value={layout.description || ""}
          onChange={(value) => onUpdate({ description: value })}
          placeholder="Optional description"
        />
      </fieldset>

      <fieldset className="properties-group">
        <legend>URL Settings</legend>

        <PropertyInput
          label="Base Slug"
          value={layout.slug || ""}
          onChange={(value) => onUpdate({ slug: value || undefined })}
          placeholder="/products (optional)"
        />

        <div className="slug-help">
          이 Layout을 사용하는 모든 페이지는
          <br />
          <code>{layout.slug || "/"}</code> 하위 경로에 생성됩니다.
        </div>
      </fieldset>
    </div>
  );
}
```

---

## 6. Canvas Runtime Integration

### 6.1 Canvas Runtime Store 타입 수정

```typescript
// src/canvas/store/types.ts

// ✅ Layout 타입 추가 (Canvas Runtime용 최소 타입)
export interface CanvasLayout {
  id: string;
  name: string;
  slug?: string | null;
}

// ✅ RuntimeStoreState에 layouts 추가
export interface RuntimeStoreState extends StateHierarchy {
  // ... 기존 필드들 ...

  // ✅ Layouts 추가
  layouts: CanvasLayout[];
  setLayouts: (layouts: CanvasLayout[]) => void;
}
```

### 6.2 Canvas Runtime Store 수정

```typescript
// src/canvas/store/runtimeStore.ts

export const createRuntimeStore = () =>
  create<RuntimeStoreState>((set, get) => ({
    // ... 기존 코드 ...

    // ============================================
    // Layouts (NEW)
    // ============================================
    layouts: [],
    setLayouts: (layouts: CanvasLayout[]) => set({ layouts }),

    // ... 기존 코드 ...
  }));
```

### 6.3 postMessage 메시지 타입 추가

```typescript
// src/canvas/messaging/types.ts (또는 적절한 위치)

// ✅ UPDATE_LAYOUTS 메시지 타입 추가
export interface UpdateLayoutsMessage {
  type: 'UPDATE_LAYOUTS';
  layouts: CanvasLayout[];
}

// 기존 메시지 유니온에 추가
export type CanvasMessage =
  | UpdateElementsMessage
  | UpdatePagesMessage
  | UpdateLayoutsMessage  // ✅ 추가
  | /* ... */;
```

### 6.4 Message Handler 수정

```typescript
// src/canvas/utils/messageHandlers.ts

// ✅ UPDATE_LAYOUTS 핸들러 추가
case 'UPDATE_LAYOUTS': {
  const { layouts } = message;
  console.log('[Canvas] Received layouts:', layouts.length);
  setLayouts(layouts);
  break;
}
```

### 6.5 Builder에서 layouts 전송

```typescript
// src/builder/hooks/useIframeMessenger.ts (또는 적절한 위치)

// Layout 변경 시 Canvas에 전송
const sendLayoutsToCanvas = useCallback((layouts: Layout[]) => {
  if (!iframeRef.current?.contentWindow) return;

  const canvasLayouts: CanvasLayout[] = layouts.map((l) => ({
    id: l.id,
    name: l.name,
    slug: l.slug,
  }));

  iframeRef.current.contentWindow.postMessage(
    {
      type: "UPDATE_LAYOUTS",
      layouts: canvasLayouts,
    },
    "*",
  );
}, []);

// useLayoutsStore 구독하여 변경 시 전송
useEffect(() => {
  const unsubscribe = useLayoutsStore.subscribe(
    (state) => state.layouts,
    (layouts) => sendLayoutsToCanvas(layouts),
  );
  return unsubscribe;
}, [sendLayoutsToCanvas]);
```

### 6.6 CanvasRouter 업데이트

```typescript
// src/canvas/router/CanvasRouter.tsx

import { useMemo } from "react";
import { useRuntimeStore } from "../store/runtimeStore";
import { generatePageUrl } from "../../utils/urlGenerator";

export function CanvasRouter({ renderElements }: CanvasRouterProps) {
  const pages = useRuntimeStore((s) => s.pages);
  const layouts = useRuntimeStore((s) => s.layouts); // ✅ layouts 추가

  // 각 페이지의 최종 URL 계산
  const routeConfigs = useMemo(() => {
    return pages.map((page) => {
      const layout = layouts.find((l) => l.id === page.layout_id);
      const finalUrl = generatePageUrl({
        page: { ...page, title: page.title }, // Page 타입 맞추기
        layout,
        allPages: pages.map((p) => ({ ...p, title: p.title })),
      });

      return {
        pageId: page.id,
        path: finalUrl,
        layoutId: page.layout_id,
      };
    });
  }, [pages, layouts]);

  return (
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        {routeConfigs.map(({ pageId, path }) => (
          <Route
            key={pageId}
            path={path}
            element={
              <PageRenderer pageId={pageId} renderElements={renderElements} />
            }
          />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>
  );
}
```

---

## 7. NodesPanel 계층 트리 표시

### 7.1 현재 vs 개선

```
현재 (평면 리스트):
📄 Page 1
📄 Page 2
📄 Page 3

개선 (계층 트리):
📁 Products (/products)
├─ 📄 Shoes (/products/shoes)
│   ├─ 📄 Nike (/products/shoes/nike)
│   └─ 📄 Adidas (/products/shoes/adidas)
└─ 📄 Clothes (/products/clothes)
📄 About (/about)
```

### 7.2 페이지 트리 구조 생성

```typescript
// src/builder/panels/nodes/utils/pageTreeBuilder.ts

import type { Page } from "../../../../types/builder/unified.types";

export interface PageTreeNode {
  page: Page;
  children: PageTreeNode[];
  depth: number;
}

/**
 * 평면 페이지 배열을 계층 트리로 변환
 */
export function buildPageTree(pages: Page[]): PageTreeNode[] {
  const nodeMap = new Map<string, PageTreeNode>();
  const roots: PageTreeNode[] = [];

  // 1. 모든 노드 생성
  pages.forEach((page) => {
    nodeMap.set(page.id, { page, children: [], depth: 0 });
  });

  // 2. 부모-자식 관계 연결
  pages.forEach((page) => {
    const node = nodeMap.get(page.id)!;

    if (page.parent_id && nodeMap.has(page.parent_id)) {
      const parentNode = nodeMap.get(page.parent_id)!;
      parentNode.children.push(node);
      node.depth = parentNode.depth + 1;
    } else {
      roots.push(node);
    }
  });

  // 3. order_num으로 정렬
  const sortNodes = (nodes: PageTreeNode[]) => {
    nodes.sort((a, b) => (a.page.order_num || 0) - (b.page.order_num || 0));
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);

  return roots;
}
```

### 7.3 NodesPanel 수정

```typescript
// src/builder/panels/nodes/NodesPanel.tsx (일부)

import { buildPageTree } from "./utils/pageTreeBuilder";

// 페이지 트리 렌더링
function PageTreeItem({ node, onSelect, selectedPageId }: PageTreeItemProps) {
  const { page, children, depth } = node;
  const isSelected = page.id === selectedPageId;

  return (
    <div className="page-tree-item" style={{ paddingLeft: `${depth * 16}px` }}>
      <button
        className={`page-item ${isSelected ? "selected" : ""}`}
        onClick={() => onSelect(page.id)}
      >
        {children.length > 0 ? "📁" : "📄"} {page.title}
      </button>

      {children.map((child) => (
        <PageTreeItem
          key={child.page.id}
          node={child}
          onSelect={onSelect}
          selectedPageId={selectedPageId}
        />
      ))}
    </div>
  );
}
```

---

## 8. Implementation Plan

### Phase 1: Foundation (기반 작업) - P0

| Task                                   | File                                | Description                             |
| -------------------------------------- | ----------------------------------- | --------------------------------------- |
| Layout 타입에 `order_num`, `slug` 추가 | `src/types/builder/layout.types.ts` | Layout, LayoutCreate, LayoutUpdate 수정 |
| IndexedDB 스키마 업데이트              | `src/lib/db/indexedDB/adapter.ts`   | DB_VERSION 증가 (5→6), 인덱스 추가      |
| IndexedDB layouts API 타입 수정        | `src/lib/db/indexedDB/adapter.ts`   | 인라인 타입 → Layout 타입 import        |
| types.ts 타입 일치 확인                | `src/lib/db/types.ts`               | Layout 타입 import 확인                 |
| Supabase 마이그레이션                  | `supabase/migrations/`              | (Supabase 사용 시)                      |

### Phase 2: Page Creation UI - P1

| Task                         | File                                       | Description                                            |
| ---------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| AddPageDialog 컴포넌트       | `src/builder/components/AddPageDialog.tsx` | 다이얼로그 UI                                          |
| usePageManager 수정          | `src/builder/hooks/usePageManager.ts`      | AddPageParams, generatePageDefaults 추가               |
| slug 검증 유틸리티           | `src/utils/slugValidator.ts`               | validateSlug, generateSlugFromTitle                    |
| URL 생성 유틸리티            | `src/utils/urlGenerator.ts`                | generatePageUrl, hasCircularReference, getNestingDepth |
| NodesPanel과 다이얼로그 연동 | `src/builder/panels/nodes/NodesPanel.tsx`  | Add 버튼 → 다이얼로그 열기                             |

### Phase 3: Property Editors - P1

| Task                          | File                                                     | Description            |
| ----------------------------- | -------------------------------------------------------- | ---------------------- |
| PageEditor 컴포넌트 생성      | `src/builder/panels/properties/editors/PageEditor.tsx`   | 페이지 속성 편집기     |
| LayoutEditor에 slug 필드 추가 | `src/builder/panels/properties/editors/LayoutEditor.tsx` | Base Slug 입력 필드    |
| URL 미리보기 컴포넌트         | `src/builder/components/UrlPreview.tsx`                  | 실시간 URL 미리보기    |
| 깊은 중첩 경고 UI             | `src/builder/panels/properties/`                         | nestingDepth >= 3 경고 |

### Phase 4: Property Editors - P1 ✅ COMPLETE (Already Implemented)

| Task                | File                                                           | Status | Description             |
| ------------------- | -------------------------------------------------------------- | ------ | ----------------------- |
| LayoutSlugEditor    | `src/builder/panels/properties/editors/LayoutSlugEditor.tsx`   | ✅     | Layout slug 편집        |
| PageParentSelector  | `src/builder/panels/properties/editors/PageParentSelector.tsx` | ✅     | Parent 선택 + slug 편집 |
| PageBodyEditor 통합 | `src/builder/panels/properties/editors/PageBodyEditor.tsx`     | ✅     | Layout/Parent 통합 UI   |
| URL 미리보기        | `generatePageUrl` 사용                                         | ✅     | 실시간 URL 표시         |

#### Phase 4 구현 상세

**1. LayoutSlugEditor.tsx** - Layout의 base slug 편집

- slug 입력 필드
- 실시간 URL 프리뷰
- 해당 Layout 사용하는 모든 페이지 URL 표시

**2. PageParentSelector.tsx** - Page의 parent 선택 및 slug 편집

- Parent page 선택 드롭다운
- Page slug 입력 필드
- `generatePageUrl` 함수로 최종 URL 계산
- 순환 참조 방지 (자기 자신 및 자손 제외)

**3. PageBodyEditor.tsx** - 통합 편집 UI

- PageLayoutSelector 포함
- PageParentSelector 포함
- 일관된 페이지 속성 편집 경험

### Phase 5: NodesPanel 트리 표시 - P1 ✅ COMPLETE (Already Implemented)

| Task             | File                                      | Status | Description           |
| ---------------- | ----------------------------------------- | ------ | --------------------- |
| renderTree 함수  | `src/builder/sidebar/index.tsx`           | ✅     | parent_id 재귀 렌더링 |
| hasChildren 함수 | `src/builder/sidebar/index.tsx`           | ✅     | 자식 존재 확인        |
| CSS 들여쓰기     | `src/builder/nodes/index.css`             | ✅     | data-depth 스타일     |
| PagesTab 통합    | `src/builder/nodes/PagesTab/PagesTab.tsx` | ✅     | Pages + Layers 래핑   |

#### Phase 5 구현 상세

**1. renderTree 함수** (`sidebar/index.tsx:495-877`)

```typescript
const renderTree = <
  T extends { id: string; parent_id?: string | null; order_num?: number },
>(
  items: T[],
  getLabel: (item: T) => string,
  onClick: (item: T) => void,
  onDelete: (item: T) => Promise<void>,
  parentId: string | null = null,
  depth: number = 0,
): React.ReactNode => {
  // parent_id 기반 필터링
  let filteredItems = items.filter((item) => {
    if (item.deleted === true) return false;
    const matchesParent =
      item.parent_id === parentId ||
      (parentId === null && item.parent_id === undefined);
    return matchesParent;
  });

  // 재귀적 자식 렌더링
  hasChildNodes &&
    renderTree(items, getLabel, onClick, onDelete, item.id, depth + 1);
};
```

**2. CSS 들여쓰기** (`nodes/index.css:214-236`)

```css
.element[data-depth="0"] .elementItem {
  padding-left: var(--spacing-sm);
}
.element[data-depth="1"] .elementItem {
  padding-left: calc(var(--spacing-lg) * 1 + var(--spacing-sm));
}
.element[data-depth="2"] .elementItem {
  padding-left: calc(var(--spacing-lg) * 2 + var(--spacing-sm));
}
.element[data-depth="3"] .elementItem {
  padding-left: calc(var(--spacing-lg) * 3 + var(--spacing-sm));
}
.element[data-depth="4"] .elementItem {
  padding-left: calc(var(--spacing-lg) * 4 + var(--spacing-sm));
}
.element[data-depth="5"] .elementItem {
  padding-left: calc(var(--spacing-lg) * 5 + var(--spacing-sm));
}
```

**3. Pages.tsx** (`nodes/Pages.tsx:121-131`)

- `renderTree` 호출로 페이지 계층 표시
- AddPageDialog와 통합

### Phase 6: Testing & Polish - P2 ✅ COMPLETE

| Task                            | Status | Description                        |
| ------------------------------- | ------ | ---------------------------------- |
| TypeScript 체크                 | ✅     | 0 errors (`npx tsc --noEmit` 통과) |
| ESLint 체크                     | ✅     | 0 errors (minor warnings only)     |
| Vitest 테스트                   | ✅     | 21개 테스트 모두 통과              |
| 단위 테스트 (urlGenerator)      | ⏳     | 향후 추가 예정                     |
| E2E 테스트 (페이지 생성 플로우) | ⏳     | 향후 추가 예정                     |

#### Phase 6 구현 상세

**1. 코드 품질 검증**

- TypeScript: 모든 타입 에러 해결
- ESLint: 에러 0개 (react-refresh 관련 minor warnings만 존재)
- Vitest: 기존 21개 테스트 모두 통과

**2. 관련 파일 상태**

- `urlGenerator.ts` - 동적 라우트 함수 정상 작동
- `CanvasRouter.tsx` - useCanvasParams, 라우트 정렬 정상
- `PageParentSelector.tsx` - Parent 선택 + slug 편집 정상
- `LayoutSlugEditor.tsx` - Layout slug 편집 정상
- `PageBodyEditor.tsx` - 통합 편집 UI 정상

**3. 향후 테스트 계획**

- `urlGenerator.test.ts` - generatePageUrl, hasCircularReference 단위 테스트
- `slugValidator.test.ts` - validateSlug, generateSlugFromTitle 단위 테스트
- E2E 테스트 - 다이얼로그 → 페이지 생성 → URL 확인 플로우

### Phase 7: 동적 라우트 (v2.0) - P1 ✅ COMPLETE

| Task                         | File                                 | Status | Description                      |
| ---------------------------- | ------------------------------------ | ------ | -------------------------------- |
| 동적 라우트 유틸리티 확장    | `src/utils/urlGenerator.ts`          | ✅     | 동적 파라미터 추출/매칭 함수     |
| Canvas 라우트 파라미터 훅    | `src/canvas/router/CanvasRouter.tsx` | ✅     | useCanvasParams 훅               |
| RuntimeStore 라우트 파라미터 | `src/canvas/store/runtimeStore.ts`   | ✅     | routeParams 상태/액션            |
| 라우트 정렬 (정적 우선)      | `src/canvas/router/CanvasRouter.tsx` | ✅     | 정적 라우트가 동적보다 먼저 매칭 |

#### Phase 7 구현 세부 내용

**1. urlGenerator.ts 확장** (`src/utils/urlGenerator.ts`)

```typescript
// 동적 파라미터 추출
extractDynamicParams("/products/:categoryId/:itemId");
// → ['categoryId', 'itemId']

// 동적 라우트 여부 확인
hasDynamicParams("/products/:id"); // → true
hasDynamicParams("/products/shoes"); // → false

// 파라미터 값 채우기
fillDynamicParams("/products/:id", { id: "123" });
// → '/products/123'

// URL 매칭
matchDynamicUrl("/products/:id", "/products/123");
// → { id: '123' }
```

**2. useCanvasParams 훅** (`src/canvas/router/CanvasRouter.tsx`)

```typescript
// Canvas 컴포넌트에서 동적 파라미터 접근
function ProductDetail() {
  const params = useCanvasParams();
  // params = { productId: '123', categoryId: 'shoes' }

  return <div>Product ID: {params.productId}</div>;
}
```

**3. RuntimeStore 연동** (`src/canvas/store/runtimeStore.ts`)

```typescript
// PageRenderer에서 자동 저장
useEffect(() => {
  setRouteParams(params as Record<string, string>);
}, [params, setRouteParams]);

// useDataSource에서 변수 치환
const { data } = useDataSource("getProduct", {
  params: { productId: "{{route.productId}}" },
});
```

**4. 라우트 정렬** (`src/canvas/router/CanvasRouter.tsx`)

```typescript
// 정적 라우트가 동적 라우트보다 먼저 매칭되도록 정렬
// /products/new → /products/:id 순서로 정렬
routeConfigs.sort((a, b) => {
  if (a.isDynamic && !b.isDynamic) return 1; // 동적은 뒤로
  if (!a.isDynamic && b.isDynamic) return -1; // 정적은 앞으로
  return bSegments - aSegments; // 더 구체적인 경로 먼저
});
```

### Phase 8: Data Panel 통합 (v2.0) - P1

| Task                          | File                                                   | Description                     |
| ----------------------------- | ------------------------------------------------------ | ------------------------------- |
| Visual Picker 라우트 카테고리 | `src/builder/panels/data/VariablePicker.tsx`           | `route` 카테고리 추가           |
| 라우트 파라미터 바인딩 UI     | `src/builder/panels/properties/editors/PageEditor.tsx` | Data Bindings 섹션              |
| useRouteDataBinding 훅        | `src/canvas/hooks/useRouteDataBinding.ts`              | 라우트 변경 시 자동 데이터 로드 |
| 바인딩 표현식 확장            | `src/utils/bindingResolver.ts`                         | `{{route.paramName}}` 지원      |
| Transformer context 확장      | `src/stores/dataPanel/transformerExecutor.ts`          | `context.route` 접근            |
| API Endpoint 라우트 치환      | `src/stores/dataPanel/apiExecutor.ts`                  | URL에서 `{{route.xxx}}` 치환    |

### Phase 9: Data Panel 통합 고급 (v2.0) - P2

| Task                     | File                                 | Description                       |
| ------------------------ | ------------------------------------ | --------------------------------- |
| 자동 API 엔드포인트 생성 | `src/stores/dataPanel/`              | DataBinding 설정 시 자동 API 생성 |
| 라우트 검증              | `src/utils/routeValidator.ts`        | 라우트 파라미터 유효성 검증       |
| 404 페이지 처리          | `src/canvas/router/`                 | 잘못된 파라미터 시 에러 페이지    |
| SSG/SSR 프리렌더링 힌트  | `src/types/builder/unified.types.ts` | 정적 경로 목록 생성 지원          |

### 구현 일정 요약

| Phase       | 내용                       | 예상 기간 | 우선순위 |
| ----------- | -------------------------- | --------- | -------- |
| Phase 1     | 기반 작업 (타입, DB)       | 2일       | P0       |
| Phase 2     | Page 생성 UI               | 3일       | P1       |
| Phase 3     | Property Editors           | 2일       | P1       |
| Phase 4     | Canvas Runtime & Router    | 2일       | P1       |
| Phase 5     | NodesPanel 트리            | 1일       | P1       |
| Phase 6     | 테스트 & 폴리시            | 2일       | P2       |
| **Phase 7** | **동적 라우트 (v2.0)**     | **3일**   | **P1**   |
| **Phase 8** | **Data Panel 통합 (v2.0)** | **3일**   | **P1**   |
| **Phase 9** | **고급 기능 (v2.0)**       | **2일**   | **P2**   |

**총 예상: 20일 (v1.0: 12일 + v2.0: 8일)**

---

## 9. UI Mockups

### 9.1 Add Page Dialog

```
┌────────────────────────────────────────────────┐
│  ➕ Add New Page                          [×]  │
├────────────────────────────────────────────────┤
│                                                │
│  Title                                         │
│  ┌──────────────────────────────────────────┐  │
│  │ Page 4                                   │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  URL Slug                                      │
│  ┌──────────────────────────────────────────┐  │
│  │ /page-4                                  │  │
│  └──────────────────────────────────────────┘  │
│  💡 Auto-generated from title. Edit if needed. │
│                                                │
│  Layout (Optional)                             │
│  ┌──────────────────────────────────────────┐  │
│  │ None                                   ▼ │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  Parent Page (Optional)                        │
│  ┌──────────────────────────────────────────┐  │
│  │ None (Root Level)                      ▼ │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ─────────────────────────────────────────     │
│  Preview URL: /page-4                          │
│  ─────────────────────────────────────────     │
│                                                │
│                      [Cancel]    [Create Page] │
└────────────────────────────────────────────────┘
```

### 9.2 Page Properties Panel

```
┌────────────────────────────────────────┐
│  📄 Page: Nike Shoes                   │
├────────────────────────────────────────┤
│                                        │
│  ▼ Basic Information                   │
│  ┌────────────────────────────────────┐│
│  │ Title                              ││
│  │ ┌────────────────────────────────┐ ││
│  │ │ Nike Shoes                     │ ││
│  │ └────────────────────────────────┘ ││
│  │                                    ││
│  │ Slug                               ││
│  │ ┌────────────────────────────────┐ ││
│  │ │ nike-shoes                     │ ││
│  │ └────────────────────────────────┘ ││
│  └────────────────────────────────────┘│
│                                        │
│  ▼ Layout                              │
│  ┌────────────────────────────────────┐│
│  │ ┌────────────────────────────────┐ ││
│  │ │ Products Layout (/products)  ▼ │ ││
│  │ └────────────────────────────────┘ ││
│  │                                    ││
│  │ 📍 Final URL:                      ││
│  │ /products/shoes/nike-shoes         ││
│  └────────────────────────────────────┘│
│                                        │
│  ▼ Hierarchy                           │
│  ┌────────────────────────────────────┐│
│  │ Parent: Shoes Category           ▼ ││
│  │ Order:  3                          ││
│  │ ⚠️ Nesting depth: 3 (SEO warning)  ││
│  └────────────────────────────────────┘│
│                                        │
└────────────────────────────────────────┘
```

### 9.3 NodesPanel 계층 트리

```
┌────────────────────────────────────────┐
│  Pages                            [+]  │
├────────────────────────────────────────┤
│                                        │
│  📁 Products                           │
│  ├─ 📁 Shoes                          │
│  │   ├─ 📄 Nike                       │  ← 선택됨
│  │   └─ 📄 Adidas                     │
│  └─ 📄 Clothes                        │
│  📄 About                              │
│  📄 Contact                            │
│                                        │
└────────────────────────────────────────┘
```

---

## 10. Edge Cases

### 10.1 Slug 충돌

```
Layout A: { slug: "/products" }
Layout B: { slug: "/products" }  // ❌ 같은 프로젝트 내 중복 불가

해결: UNIQUE INDEX (project_id, slug) WHERE slug IS NOT NULL
```

### 10.2 순환 참조

```
Page A: { parent_id: "page-b" }
Page B: { parent_id: "page-a" }  // ❌ 순환 참조

해결: hasCircularReference() 함수로 검증
```

```typescript
// PageEditor에서 사용
const handleParentChange = (newParentId: string | null) => {
  if (newParentId && hasCircularReference(page.id, newParentId, pages)) {
    showToast("Cannot set parent: circular reference detected");
    return;
  }
  onUpdate({ parent_id: newParentId });
};
```

### 10.3 깊은 중첩

```
/level1/level2/level3/level4/level5/page  // ⚠️ SEO 비권장

해결: getNestingDepth() 함수로 깊이 계산, 3단계 이상 시 경고 표시
```

diff --git a/docs/features/NESTED_ROUTES_SLUG_SYSTEM.md b/docs/features/NESTED_ROUTES_SLUG_SYSTEM.md
index 5564e91d8188eb90d1afb64bafcfb35ada2dbd67..3a49a1fe7e996b21d8fb774cab6dbef29ec12168 100644
--- a/docs/features/NESTED_ROUTES_SLUG_SYSTEM.md
+++ b/docs/features/NESTED_ROUTES_SLUG_SYSTEM.md
@@ -1516,50 +1516,78 @@ Layout B: { slug: "/products" } // ❌ 같은 프로젝트 내 중복 불가
Page A: { parent_id: "page-b" }
Page B: { parent_id: "page-a" } // ❌ 순환 참조

해결: hasCircularReference() 함수로 검증

````

```typescript
// PageEditor에서 사용
const handleParentChange = (newParentId: string | null) => {
  if (newParentId && hasCircularReference(page.id, newParentId, pages)) {
    showToast('Cannot set parent: circular reference detected');
    return;
  }
  onUpdate({ parent_id: newParentId });
};
````

### 10.3 깊은 중첩

```
/level1/level2/level3/level4/level5/page  // ⚠️ SEO 비권장

해결: getNestingDepth() 함수로 깊이 계산, 3단계 이상 시 경고 표시
```

### 10.4 라우트 파라미터 보안/검증

필요한 추가 안전장치:

1. **허용 리스트 기반 파라미터 스키마**: `RouteParamSchema`(type, pattern, allowList)로 정의하고, 동적 세그먼트 매칭 시 Zod/Built-in validator로 1차 검증.
2. **URL 인코딩 일관화**: 미인코딩 값 삽입 방지를 위해 `generateUrlWithParams` 내부에서 `encodeURIComponent` 강제 적용, 중복 인코딩 탐지 로깅.
3. **서버/클라이언트 분리 정책**: 민감한 파라미터(예: 토큰, 내부 ID)는 프리뷰/클라이언트 라우팅에서 사용 금지 태그(`sensitive: true`)를 두고, 존재 시 에러/가드 페이지로 전환.
4. **파라미터 누수 방지**: `postMessage`로 프리뷰에 전달 시 민감 키 마스킹, 브레드크럼/메트릭 로거에서도 동일 키 필터링 규칙 재사용.

### 10.5 에러 처리 (라우트 매칭/데이터 로드)

1. **매칭 실패 가드**: `matchRouteParams`가 null을 반환하면 404 템플릿 렌더 + 실패 이벤트 발행(`route:nomatch`).
2. **데이터 로드 오류**: 라우트 파라미터가 API/데이터테이블 로드에 사용될 때:
   - (a) 파라미터 검증 실패 → 400 뷰
   - (b) API 실패 → 5xx/네트워크 전용 에러 뷰
   - (c) 변환/바인딩 실패 → 422 뷰로 세분화
3. **회복 UX**: 에러 페이지에 "다시 시도"(API 재호출), "상위로 이동"(부모 URL), "홈으로 이동" CTA 제공.
4. **로깅**: 에러 타입/파라미터/현재 URL을 ExecutionLog와 동일 구조로 기록해 Data Panel 관측성과 연결.

### 10.6 캐싱/프리패치 정책

1. **라우트 파라미터 기반 캐시 키**: `cacheKey = route.path + JSON.stringify(sortedParams)` 규칙을 명시해 동일 페이지 이동 시 데이터 재사용.
2. **stale-while-revalidate**: 캐시된 데이터 즉시 표시 후 백그라운드 갱신 옵션을 Router 설정(`revalidateOnFocus`, `revalidateInterval`)으로 노출.
3. **프리패치**: Navigation 트리/노드 패널 hover 시 하위 페이지의 정적 자원과 주요 API를 프리패치하는 훅(옵션) 추가.
4. **무효화 규칙**: slug/routeParam 변경 시 관련 캐시를 일괄 삭제할 `invalidateRouteCache(slug, params)` 헬퍼 정의.

### 10.7 404 Page Strategy (NEW)

동적 라우트가 많아질 경우, 매칭되지 않는 경로에 대한 체계적인 404 페이지 처리가 필요합니다.

#### 404 처리 계층 구조

```
┌─────────────────────────────────────────────────────────────┐
│                    404 Page Strategy                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Level 1: 프로젝트 기본 404                                  │
│  ────────────────────────────────────────────────────────── │
│  - 모든 미매칭 경로의 최종 fallback                          │
│  - Project 설정에서 지정: defaultNotFoundPageId              │
│                                                              │
│  Level 2: Layout별 404 (Optional)                            │
│  ────────────────────────────────────────────────────────── │
│  - /products/* 에서 404 → Products Layout 유지               │
│  - /blog/* 에서 404 → Blog Layout 유지                       │
│  - Layout.notFoundPageId 필드로 지정                         │
│                                                              │
│  Level 3: 동적 라우트 파라미터 실패                          │
│  ────────────────────────────────────────────────────────── │
│  - /products/:productId 매칭됐지만 데이터 없음               │
│  - → API 404 → 해당 Layout 404 또는 프로젝트 404             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 404 매칭 우선순위

```
URL: /products/shoes/unknown-item

1. 라우트 매칭 시도
   /products/:category/:productId → 매칭됨

2. 데이터 로드 시도
   GET /api/products/unknown-item → 404 Not Found

3. 404 페이지 결정
   ┌─────────────────────────────────────────────┐
   │ Layout(Products).notFoundPageId 있음?       │
   │   → Yes: Layout 404 렌더링 (Layout 유지)    │
   │   → No:  inheritNotFound 체크               │
   │          → true: 프로젝트 기본 404          │
   │          → false: Layout 내 빈 상태 표시    │
   └─────────────────────────────────────────────┘
```

#### Project 타입 확장

```typescript
// src/types/builder/project.types.ts 확장

export interface Project {
  id: string;
  name: string;
  // ... 기존 필드

  // ✅ NEW: 에러 페이지 설정
  defaultNotFoundPageId?: string; // 프로젝트 기본 404 페이지
  defaultErrorPageId?: string; // 프로젝트 기본 500 에러 페이지
}
```

#### CanvasRouter 404 처리

```typescript
// src/canvas/router/CanvasRouter.tsx

function PageRenderer({ pageId, layoutId, renderElements }: PageRendererProps) {
  const { data, error, isLoading } = useRouteDataBinding(page);
  const layouts = useRuntimeStore((s) => s.layouts);
  const project = useRuntimeStore((s) => s.project);

  // 데이터 로드 실패 시 404 처리
  if (error?.status === 404) {
    const layout = layouts.find((l) => l.id === layoutId);

    // 1. Layout 전용 404 페이지 확인
    let notFoundPageId = layout?.notFoundPageId;

    // 2. Layout에 없고 inheritNotFound가 true면 프로젝트 기본 404 사용
    if (!notFoundPageId && layout?.inheritNotFound !== false) {
      notFoundPageId = project?.defaultNotFoundPageId;
    }

    if (notFoundPageId) {
      // Layout 유지하며 404 페이지 렌더링
      return (
        <LayoutWrapper layoutId={layoutId}>
          <NotFoundPage pageId={notFoundPageId} originalUrl={currentUrl} />
        </LayoutWrapper>
      );
    }

    // 3. 설정된 404 페이지가 없으면 기본 404 컴포넌트
    return (
      <LayoutWrapper layoutId={layoutId}>
        <DefaultNotFound />
      </LayoutWrapper>
    );
  }

  return <PageContent />;
}
```

#### UI 설정 화면

```
┌────────────────────────────────────────────────┐
│  ⚙️ Project Settings                           │
├────────────────────────────────────────────────┤
│                                                │
│  ▼ Error Pages                                 │
│  ┌──────────────────────────────────────────┐  │
│  │ Default 404 Page: [Select Page      ▼]  │  │
│  │ Default 500 Page: [Select Page      ▼]  │  │
│  └──────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘

┌────────────────────────────────────────────────┐
│  📐 Layout: Products                           │
├────────────────────────────────────────────────┤
│                                                │
│  ▼ Error Handling                              │
│  ┌──────────────────────────────────────────┐  │
│  │ Custom 404 Page: [Product Not Found ▼]  │  │
│  │ ☑️ Inherit from Project if not set      │  │
│  └──────────────────────────────────────────┘  │
│                                                │
└────────────────────────────────────────────────┘
```

#### 구현 우선순위

| 항목                        | 우선순위 | 설명                         |
| --------------------------- | -------- | ---------------------------- |
| 프로젝트 기본 404           | **P0**   | 필수 - 모든 미매칭 경로 처리 |
| Layout별 404                | **P1**   | 권장 - 섹션별 일관된 UX      |
| 데이터 로드 실패 → 404 연동 | **P1**   | 필수 - 동적 라우트에서 핵심  |
| 500 에러 페이지             | **P2**   | 선택 - API 에러 처리         |

---

## 11. Migration Strategy

### 11.1 Existing Data Migration

```typescript
// 기존 페이지의 slug는 그대로 유지 (절대 경로)
// Layout에 slug를 추가해도 기존 페이지는 영향 없음

// 예시: 기존 데이터
{ id: 'p1', slug: '/page-1', layout_id: 'layout-1' }

// Layout에 slug 추가 후
Layout: { id: 'layout-1', slug: '/products' }

// 기존 페이지는 여전히 /page-1 으로 접근 가능
// (절대 경로이므로 Layout.slug 무시)
```

### 11.2 Backward Compatibility

- 절대 경로 (`/`로 시작)는 항상 그대로 사용
- Layout.slug는 선택적 (undefined 허용)
- 기존 페이지 수정 없이 동작

---

## 12. Success Criteria

### 필수 (P0/P1)

- [ ] Layout 타입에 order_num, slug 필드 추가 완료
- [ ] LayoutCreate, LayoutUpdate 타입 수정 완료
- [ ] IndexedDB layouts 스토어에 order_num, slug 인덱스 추가
- [ ] IndexedDB layouts API 타입 Layout으로 통일
- [ ] Page 생성 시 title/slug 입력 다이얼로그 표시
- [ ] usePageManager와 AddPageDialog 연동
- [ ] Property Editor에서 Page slug 편집 가능
- [ ] Property Editor에서 Layout slug 편집 가능
- [ ] URL 미리보기 실시간 표시
- [ ] Canvas Runtime Store에 layouts 배열 추가
- [ ] postMessage로 layouts 전달 구현
- [ ] Canvas Router에서 계층적 URL 정상 동작
- [ ] NodesPanel 계층 트리 표시
- [ ] 기존 페이지 하위 호환성 유지
- [ ] TypeScript 타입 오류 0개

### 권장 (P2)

- [ ] 순환 참조 검증 및 경고 표시
- [ ] 깊은 중첩 경고 UI (3단계 이상)
- [ ] 단위 테스트 작성
- [ ] E2E 테스트 작성

### v2.0 동적 라우트 (P1)

- [ ] Page 타입에 routeParams, dataBindings 필드 추가
- [ ] RouteParam, PageDataBinding 타입 정의
- [ ] 라우트 유틸리티 (extractRouteParams, matchRouteParams, generateUrlWithParams)
- [ ] PageEditor에 Route Parameters UI 추가
- [ ] Canvas Router에서 동적 세그먼트 (`:param`) 지원

### v2.0 Data Panel 통합 (P1)

- [ ] Visual Picker에 `route` 카테고리 추가
- [ ] PageEditor에 Data Bindings UI 추가
- [ ] useRouteDataBinding 훅 구현
- [ ] `{{route.paramName}}` 바인딩 표현식 지원
- [ ] Transformer context에 `context.route` 접근 가능
- [ ] API Endpoint URL에서 `{{route.xxx}}` 치환

### v2.0 404 Page Strategy (P0/P1)

- [ ] Layout 타입에 notFoundPageId, inheritNotFound 필드 추가
- [ ] Project 타입에 defaultNotFoundPageId, defaultErrorPageId 필드 추가
- [ ] Project Settings UI에 Error Pages 설정 추가
- [ ] Layout Editor에 Error Handling 섹션 추가
- [ ] CanvasRouter에서 404 계층적 처리 구현
- [ ] 데이터 로드 실패 시 Layout 유지하며 404 페이지 렌더링
- [ ] DefaultNotFound 컴포넌트 구현

### v2.0 고급 기능 (P2)

- [ ] DataBinding 설정 시 자동 API 엔드포인트 생성
- [ ] 라우트 파라미터 유효성 검증
- [ ] 500 에러 페이지 처리
- [ ] SSG/SSR 프리렌더링 힌트

---

## 13. References

- [Next.js App Router](https://nextjs.org/docs/app/building-your-application/routing)
- [Framer Page Structure](https://janeui.com/articles/framer-page-structure)
- [React Router Nested Routes](https://reactrouter.com/start/declarative/routing)
- [composition Layout/Slot System](LAYOUT_PRESETS.md)
- [composition Data Panel System](DATA_PANEL.md)
