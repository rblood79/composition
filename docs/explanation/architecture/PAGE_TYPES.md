# Page Type Separation Architecture

**작성일**: 2025-11-15
**버전**: 1.0
**상태**: ✅ Active

---

## 📋 개요

composition 프로젝트는 **두 가지 다른 Page 타입**을 사용합니다:

1. **API Layer**: `ApiPage` (Supabase Database schema)
2. **Store Layer**: `Page` (Zustand state management)

이 문서는 두 타입의 차이점, 사용 시나리오, 그리고 올바른 변환 방법을 설명합니다.

---

## 🔍 문제 배경

### 왜 두 가지 타입이 필요한가?

**API Layer (Database)**:

- Supabase 데이터베이스 스키마를 직접 반영
- RESTful API 응답 형식
- 필드명: `title` (데이터베이스 컬럼명)

**Store Layer (State Management)**:

- Zustand 상태 관리 최적화
- 컴포넌트에서 사용하기 편리한 형식
- 필드명: `name` (UI/UX 관점에서 더 직관적)

---

## 📊 Type Definitions

### API Layer: ApiPage

**위치**: `src/services/api/PagesApiService.ts`

```typescript
export interface Page {
  id: string;
  project_id: string;
  title: string; // 🔑 주목: "title" 필드
  slug: string;
  parent_id: string | null;
  order_num: number;
  is_home: boolean;
  created_at: string;
  updated_at: string;
  deleted?: boolean;
}

export type ApiPage = Page; // Type alias for clarity
```

**특징**:

- Supabase `pages` 테이블 스키마와 일치
- CRUD 작업에서 사용
- API 응답 형식

---

### Store Layer: Page

**위치**: `src/types/builder/unified.types.ts`

```typescript
export interface Page {
  id: string;
  name: string; // 🔑 주목: "name" 필드 (title이 아님!)
  slug: string;
  parent_id: string | null;
  order_num: number;
  // 기타 메타데이터는 생략 가능 (Store에서는 필수 필드만 유지)
}
```

**특징**:

- Zustand store에서 사용
- UI 컴포넌트가 직접 접근
- 간소화된 필드 (created_at, updated_at 등 제외)

---

## 🔄 타입 변환 패턴

### Pattern 1: API → Store (가장 흔한 케이스)

API에서 데이터를 가져와서 Store에 저장할 때:

```typescript
import { Page as ApiPage } from "../../services/api/PagesApiService";
import type { Page } from "../../types/builder/unified.types";

// API 응답
const apiPages: ApiPage[] = await pagesApi.getPages(projectId);

// Store로 변환
const storePages: Page[] = apiPages.map((apiPage) => ({
  id: apiPage.id,
  name: apiPage.title, // 🔑 title → name 변환
  slug: apiPage.slug,
  parent_id: apiPage.parent_id,
  order_num: apiPage.order_num,
}));

// Store 업데이트
setPages(storePages);
```

---

### Pattern 2: Store → API (데이터 저장 시)

Store 데이터를 API로 전송할 때:

```typescript
// Store에서 가져온 page
const storePage: Page = {
  id: "page-1",
  name: "Home Page",
  slug: "home",
  parent_id: null,
  order_num: 0,
};

// API 요청용으로 변환
const apiPageData: Partial<ApiPage> = {
  id: storePage.id,
  title: storePage.name, // 🔑 name → title 변환
  slug: storePage.slug,
  parent_id: storePage.parent_id,
  order_num: storePage.order_num,
};

// API 호출
await pagesApi.updatePage(storePage.id, apiPageData);
```

---

### Pattern 3: 변환 함수 (Utility)

재사용 가능한 변환 함수 작성 권장:

```typescript
// src/utils/pageConversion.ts

import type { Page as ApiPage } from "../services/api/PagesApiService";
import type { Page } from "../types/builder/unified.types";

/**
 * API Page → Store Page 변환
 */
export function apiPageToStorePage(apiPage: ApiPage): Page {
  return {
    id: apiPage.id,
    name: apiPage.title,
    slug: apiPage.slug,
    parent_id: apiPage.parent_id,
    order_num: apiPage.order_num,
  };
}

/**
 * Store Page → API Page 변환
 */
export function storePageToApiPage(storePage: Page): Partial<ApiPage> {
  return {
    id: storePage.id,
    title: storePage.name,
    slug: storePage.slug,
    parent_id: storePage.parent_id,
    order_num: storePage.order_num,
  };
}
```

**사용 예시**:

```typescript
// API → Store
const storePages = apiPages.map(apiPageToStorePage);

// Store → API
const apiPageData = storePageToApiPage(storePage);
```

---

## 📁 실제 사용 예시

### Example 1: usePageManager Hook

**파일**: `src/builder/hooks/usePageManager.ts`

```typescript
import { useState, useCallback } from "react";
import {
  pagesApi,
  type Page as ApiPage,
} from "../../services/api/PagesApiService";
import type { Page } from "../../types/builder/unified.types";

export interface UsePageManagerReturn {
  pages: ApiPage[]; // 🔑 반환 타입은 ApiPage
  createPage: (title: string) => Promise<void>;
  deletePage: (pageId: string) => Promise<void>;
}

export function usePageManager(projectId: string): UsePageManagerReturn {
  const [pages, setPages] = useState<ApiPage[]>([]);

  const fetchPages = useCallback(async () => {
    const data = await pagesApi.getPages(projectId);
    setPages(data); // ApiPage[] 저장
  }, [projectId]);

  const createPage = useCallback(
    async (title: string) => {
      const newPage = await pagesApi.createPage({
        project_id: projectId,
        title, // API는 title 사용
        slug: title.toLowerCase().replace(/\s+/g, "-"),
        parent_id: null,
        order_num: pages.length,
      });

      // 🔑 Store Page 형식으로 변환하여 추가
      const currentPages = pages;
      const storePage: Page = {
        id: newPage.id,
        name: newPage.title, // title → name
        slug: newPage.slug,
        parent_id: null,
        order_num: newPage.order_num,
      };

      setPages([...currentPages, storePage]);
    },
    [projectId, pages],
  );

  return { pages, createPage, deletePage };
}
```

---

### Example 2: Pages Component (Sidebar)

**파일**: `src/builder/nodes/Pages.tsx`

```typescript
import type { Page as ApiPage } from '../../services/api/PagesApiService';

interface PagesProps {
  pages: ApiPage[];
  onDelete: (page: ApiPage) => void;
}

export function Pages({ pages, onDelete }: PagesProps) {
  const handleDelete = async (page: ApiPage) => {
    // API 삭제 호출
    await pagesApi.deletePage(page.id);

    // Store 업데이트: Store Page 형식으로 변환
    const updatedPages = pages
      .filter(p => p.id !== page.id)
      .map(p => ({
        id: p.id,
        name: p.title,        // 🔑 title → name
        slug: p.slug,
        parent_id: p.parent_id,
        order_num: p.order_num
      }));

    setPages(updatedPages);
  };

  return (
    <div>
      {pages.map(page => (
        <PageItem
          key={page.id}
          title={page.title}  // API Page는 title 사용
          onDelete={() => handleDelete(page)}
        />
      ))}
    </div>
  );
}
```

---

### Example 3: NavigatorPanel (Type Wrapper)

**파일**: `src/builder/panels/navigator/NavigatorPanel.tsx`

Sidebar 컴포넌트가 `UnifiedPage` (title 필드)를 기대하는 경우:

```typescript
import type { Page } from '../../types/builder/unified.types';
import type { UnifiedPage } from '../../types/builder/page.types';

interface NavigatorPanelProps {
  pages: Page[];  // Store Page (name 필드)
}

export function NavigatorPanel({ pages }: NavigatorPanelProps) {
  // 🔑 Store Page → UnifiedPage 변환 (래퍼)
  const unifiedPages: UnifiedPage[] = useMemo(() =>
    pages.map(p => ({
      id: p.id,
      title: p.name,        // name → title 변환
      project_id: '',
      slug: p.slug,
      parent_id: p.parent_id,
      order_num: p.order_num
    })),
    [pages]
  );

  return <Sidebar pages={unifiedPages} />;
}
```

---

## 🚫 안티패턴

### ❌ Anti-Pattern 1: 타입 혼용

```typescript
// ❌ WRONG - ApiPage를 Store에 직접 저장
import { Page } from '../../services/api/PagesApiService';

const [pages, setPages] = useState<Page[]>([]);  // ❌ title 필드 사용

// 나중에 컴포넌트에서
<div>{page.name}</div>  // ❌ Error: 'name' does not exist on type 'Page'
```

### ❌ Anti-Pattern 2: 타입 별칭 미사용

```typescript
// ❌ WRONG - 어떤 Page 타입인지 불명확
import { Page } from "../../services/api/PagesApiService";
import { Page } from "../../types/builder/unified.types"; // ❌ 이름 충돌!

// ✅ CORRECT - 타입 별칭 사용
import { Page as ApiPage } from "../../services/api/PagesApiService";
import type { Page } from "../../types/builder/unified.types";
```

### ❌ Anti-Pattern 3: 변환 누락

```typescript
// ❌ WRONG - 변환 없이 직접 사용
const apiPage = await pagesApi.getPage(pageId);
setCurrentPage(apiPage);  // ❌ title/name 필드 불일치

// 컴포넌트에서
<h1>{currentPage.name}</h1>  // ❌ Undefined (title이어야 함)

// ✅ CORRECT - 명시적 변환
const apiPage = await pagesApi.getPage(pageId);
const storePage: Page = {
  id: apiPage.id,
  name: apiPage.title,  // 변환!
  slug: apiPage.slug,
  parent_id: apiPage.parent_id,
  order_num: apiPage.order_num
};
setCurrentPage(storePage);
```

---

## 📋 Best Practices

### 1. 명확한 타입 별칭 사용

```typescript
// ✅ ALWAYS use type alias for API Page
import { Page as ApiPage } from "../../services/api/PagesApiService";
import type { Page } from "../../types/builder/unified.types";
```

### 2. 변환 함수 작성

```typescript
// ✅ Create reusable conversion functions
export function apiPageToStorePage(apiPage: ApiPage): Page {
  return { id: apiPage.id, name: apiPage.title, ... };
}
```

### 3. 주석으로 의도 명시

```typescript
// ✅ Document conversion points
// Convert API Page (title) → Store Page (name)
const storePage: Page = {
  id: apiPage.id,
  name: apiPage.title, // title → name
  slug: apiPage.slug,
  parent_id: apiPage.parent_id,
  order_num: apiPage.order_num,
};
```

### 4. TypeScript Type Guard 사용

```typescript
// ✅ Type guard for runtime validation
function isApiPage(page: unknown): page is ApiPage {
  return (
    typeof page === "object" &&
    page !== null &&
    "title" in page && // API Page has 'title'
    "id" in page
  );
}

function isStorePage(page: unknown): page is Page {
  return (
    typeof page === "object" &&
    page !== null &&
    "name" in page && // Store Page has 'name'
    "id" in page
  );
}
```

---

## 🎯 결정 트리 (Decision Tree)

언제 어떤 타입을 사용할지 빠르게 결정:

```
┌─────────────────────────────────┐
│   어디에서 데이터를 사용하는가?   │
└────────────┬────────────────────┘
             │
     ┌───────┴───────┐
     │               │
     ▼               ▼
┌─────────┐    ┌─────────────┐
│ API 호출 │    │ UI/Store    │
│ Supabase │    │ Component   │
└────┬────┘    └──────┬──────┘
     │                │
     │                │
     ▼                ▼
  ApiPage           Page
  (title)          (name)
```

**질문**:

1. **데이터 출처가 API인가?** → `ApiPage` 사용
2. **데이터가 Store에 저장되는가?** → `Page` 사용
3. **API ↔ Store 전환이 필요한가?** → 변환 함수 사용

---

## 📊 타입 필드 비교표

| 항목          | API Layer (ApiPage)                                 | Store Layer (Page)                   |
| ------------- | --------------------------------------------------- | ------------------------------------ |
| **위치**      | `src/services/api/PagesApiService.ts`               | `src/types/builder/unified.types.ts` |
| **주요 필드** | `title` (String)                                    | `name` (String)                      |
| **기타 필드** | `project_id`, `created_at`, `updated_at`, `is_home` | 최소 필드만 유지                     |
| **사용처**    | API 요청/응답, Supabase                             | Zustand Store, UI Components         |
| **변환 필요** | ✅ Store 저장 전 변환 필요                          | ✅ API 호출 전 변환 필요             |

---

## 🔗 관련 파일

### Type Definitions

- `src/services/api/PagesApiService.ts` - ApiPage 정의
- `src/types/builder/unified.types.ts` - Store Page 정의

### Conversion Points (변환 발생 위치)

- `src/builder/hooks/usePageManager.ts` - API → Store 변환
- `src/builder/nodes/Pages.tsx` - 삭제 시 Store → API 변환
- `src/builder/panels/navigator/NavigatorPanel.tsx` - Store → UnifiedPage 래퍼

### Tests (추가 권장)

- `src/builder/hooks/__tests__/usePageManager.test.ts`
- `src/utils/__tests__/pageConversion.test.ts`

---

## 🧪 테스트 가이드

### Unit Test Example

```typescript
// src/utils/__tests__/pageConversion.test.ts

import { describe, it, expect } from "vitest";
import { apiPageToStorePage, storePageToApiPage } from "../pageConversion";
import type { Page as ApiPage } from "../../services/api/PagesApiService";
import type { Page } from "../../types/builder/unified.types";

describe("Page Conversion Utilities", () => {
  it("should convert API Page to Store Page", () => {
    const apiPage: ApiPage = {
      id: "page-1",
      project_id: "proj-1",
      title: "Home Page",
      slug: "home",
      parent_id: null,
      order_num: 0,
      is_home: true,
      created_at: "2025-01-01",
      updated_at: "2025-01-01",
    };

    const storePage = apiPageToStorePage(apiPage);

    expect(storePage).toEqual({
      id: "page-1",
      name: "Home Page", // title → name
      slug: "home",
      parent_id: null,
      order_num: 0,
    });
  });

  it("should convert Store Page to API Page", () => {
    const storePage: Page = {
      id: "page-1",
      name: "Home Page",
      slug: "home",
      parent_id: null,
      order_num: 0,
    };

    const apiPageData = storePageToApiPage(storePage);

    expect(apiPageData).toEqual({
      id: "page-1",
      title: "Home Page", // name → title
      slug: "home",
      parent_id: null,
      order_num: 0,
    });
  });
});
```

---

## 🔧 Migration Checklist

기존 코드를 타입 분리 아키텍처로 마이그레이션:

- [ ] API 호출 지점에서 `Page as ApiPage` import 사용
- [ ] Store 사용 지점에서 `type { Page }` import 사용
- [ ] API → Store 변환 시 `title → name` 변환 확인
- [ ] Store → API 변환 시 `name → title` 변환 확인
- [ ] TypeScript 에러 0개 확인 (`npx tsc --noEmit`)
- [ ] 변환 함수 유틸리티 작성 (재사용성)
- [ ] Unit tests 작성

---

## 📚 참고 문서

- **[TYPESCRIPT_ERROR_FIXES.md](../../legacy/TYPESCRIPT_ERRORS_FIX.md)** - TypeScript 에러 수정 전체 내역
- **[CLAUDE.md](../../../CLAUDE.md)** - TypeScript 코딩 규칙 (Common Error Patterns #2)
- **[PROPERTY_CUSTOM_ID_PATTERN.md](../../reference/components/CUSTOM_ID_PATTERN.md)** - PropertyCustomId 패턴 가이드

---

**최종 업데이트**: 2025-11-15
**작성자**: Claude Code
**버전**: 1.0
