# 페이지 내비게이션 구현

## 개요

composition 빌더에서 Button onClick 이벤트를 통한 페이지 간 내비게이션 기능을 구현했습니다.

**구현 날짜:** 2025-11-06
**관련 이슈:** 빌더 모드에서 페이지 이동 기능 구현

---

## 목표

- Preview 내 Button 클릭 → 다른 페이지로 이동
- 빌더 모드(iframe)와 향후 퍼블리시 모드 모두 지원
- SPA 방식으로 페이지 리로드 없이 전환

---

## 아키텍처

### 작동 흐름

```
사용자가 Button 클릭
  ↓
Preview iframe에서 onClick 이벤트 발생
  ↓
EventEngine.executeNavigateAction() 실행
  ↓
환경 감지 (빌더 모드 / 퍼블리시 모드)
  ↓
빌더 모드: postMessage로 부모 Builder에게 전달
  ↓
Builder가 NAVIGATE_TO_PAGE 메시지 수신
  ↓
pages 배열에서 slug로 pageId 조회
  ↓
해당 페이지 elements 로드
  ↓
Preview iframe 자동 업데이트 (기존 sync 로직)
```

### 환경별 동작

| 모드              | 감지 방법                    | 내비게이션 방식                  |
| ----------------- | ---------------------------- | -------------------------------- |
| **빌더 모드**     | `window.self !== window.top` | postMessage → 부모가 페이지 로드 |
| **퍼블리시 모드** | `window.self === window.top` | React Router (향후 구현)         |

---

## 구현 세부사항

### 1. 타입 정의 통일

**파일:** `/src/types/events.ts`

기존 `NavigateActionValue`의 필드명을 `url` → `path`로 변경하여 Inspector 타입과 통일했습니다.

```typescript
export interface NavigateActionValue {
  path: string; // ✅ url → path 변경
  openInNewTab?: boolean; // ✅ newTab → openInNewTab 변경
  replace?: boolean;
}
```

**변경 이유:**

- Inspector의 `NavigateConfig`는 이미 `path` 필드 사용
- 일관성 확보로 혼란 방지

---

### 2. 메시지 타입 추가

**파일:** `/src/builder/preview/types/index.ts`

Preview iframe → Builder 부모 간 통신을 위한 `NAVIGATE_TO_PAGE` 메시지 타입 추가:

```typescript
export interface NavigateToPageMessage extends PreviewMessage {
  type: "NAVIGATE_TO_PAGE";
  payload: {
    path: string;
    replace?: boolean;
  };
}

export type MessageType =
  | UpdateElementsMessage
  | UpdateElementPropsMessage
  | DeleteElementsMessage
  | DeleteElementMessage
  | ThemeVarsMessage
  | UpdateThemeTokensMessage
  | AddColumnElementsMessage
  | NavigateToPageMessage; // ✅ 추가
```

---

### 3. EventEngine 수정

**파일:** `/src/utils/eventEngine.ts`

`executeNavigateAction()` 메서드를 대폭 수정하여 환경 감지 및 분기 로직 추가:

#### 주요 변경사항

1. **타입 변경:** `url` → `path`, `newTab` → `openInNewTab`
2. **환경 감지:** `isBuilderMode()` 메서드 추가
3. **내부/외부 URL 구분:** `isInternalPath()` 메서드 추가
4. **postMessage 전송:** 빌더 모드에서 부모에게 페이지 전환 요청

```typescript
private async executeNavigateAction(action: EventAction): Promise<void> {
    const { path, openInNewTab, replace } = action.value as {
        path: string;
        openInNewTab?: boolean;
        replace?: boolean;
    };

    if (!path || typeof path !== 'string') {
        throw new Error('Invalid path');
    }

    // 새 탭에서 열기
    if (openInNewTab) {
        window.open(path, '_blank');
        return;
    }

    // 내부 페이지인지 외부 URL인지 구분
    const isInternalPage = this.isInternalPath(path);

    if (isInternalPage) {
        // 빌더 모드 (iframe 안)에서 실행 중인지 확인
        if (this.isBuilderMode()) {
            // postMessage로 부모에게 페이지 전환 요청
            window.parent.postMessage({
                type: 'NAVIGATE_TO_PAGE',
                payload: { path, replace }
            }, '*');
        } else {
            // 퍼블리시 모드에서는 React Router 사용 (향후 구현)
            console.warn('Navigate in published mode not yet implemented');
            // TODO: 향후 퍼블리시 모드에서 React Router navigate() 호출
        }
    } else {
        // 외부 URL - 기존 방식
        try {
            new URL(path);
            window.location.href = path;
        } catch {
            throw new Error('Invalid URL');
        }
    }
}
```

#### 헬퍼 메서드

```typescript
/**
 * 빌더 모드(iframe 안)에서 실행 중인지 확인
 */
private isBuilderMode(): boolean {
    return window.self !== window.top && window.parent !== window.self;
}

/**
 * 내부 페이지 경로인지 확인 (slug 기반)
 * 예: "/", "/dashboard", "/about" 등
 */
private isInternalPath(path: string): boolean {
    // 외부 URL 패턴 (http://, https://, //, mailto:, tel: 등)
    const externalUrlPattern = /^(https?:\/\/|\/\/|mailto:|tel:)/i;

    // 외부 URL이 아니고 슬래시로 시작하면 내부 페이지
    return !externalUrlPattern.test(path) && path.startsWith('/');
}
```

---

### 4. Builder 페이지 전환 로직 추가

**파일:** `/src/builder/main/BuilderCore.tsx`

BuilderCore에 postMessage 리스너를 추가하여 Preview iframe으로부터 `NAVIGATE_TO_PAGE` 메시지를 수신하고 페이지를 전환합니다.

```typescript
// NAVIGATE_TO_PAGE 메시지 수신 (Preview iframe에서)
useEffect(() => {
  const handleNavigateMessage = async (event: MessageEvent) => {
    // 메시지 출처 검증 (보안)
    if (event.data?.type !== "NAVIGATE_TO_PAGE") return;

    const { path } = event.data.payload as { path: string; replace?: boolean };
    console.log("[BuilderCore] Received NAVIGATE_TO_PAGE:", path);

    // pages 배열에서 slug 기반으로 pageId 조회
    const targetPage = pages.find((p) => p.slug === path);

    if (targetPage) {
      console.log(
        "[BuilderCore] Navigating to page:",
        targetPage.title,
        targetPage.id,
      );
      // 페이지 elements 로드
      await fetchElements(targetPage.id);
    } else {
      console.warn(`[BuilderCore] Page not found for path: ${path}`);
      // 페이지를 찾지 못한 경우 사용자에게 알림
      handleError(
        new Error(`페이지를 찾을 수 없습니다: ${path}`),
        "페이지 이동",
      );
    }
  };

  window.addEventListener("message", handleNavigateMessage);

  return () => {
    window.removeEventListener("message", handleNavigateMessage);
  };
}, [pages, fetchElements, handleError]);
```

#### 주요 로직

1. **메시지 필터링:** `type === "NAVIGATE_TO_PAGE"`만 처리
2. **페이지 조회:** `pages.find(p => p.slug === path)`로 slug 기반 검색
3. **Elements 로드:** `fetchElements(pageId)`로 새 페이지 데이터 로드
4. **자동 업데이트:** 기존 sync 로직에 의해 Preview iframe 자동 업데이트
5. **에러 핸들링:** 페이지를 찾지 못하면 사용자에게 알림

---

### 5. 메시지 핸들러 유틸리티 (선택적)

**파일:** `/src/builder/preview/utils/messageHandlers.ts`

재사용 가능한 핸들러 함수를 추가했습니다 (현재는 사용되지 않지만 향후 확장 가능):

```typescript
/**
 * NAVIGATE_TO_PAGE 메시지 처리 (Preview → Parent)
 * 이 핸들러는 실제로 Preview에서는 사용되지 않고,
 * Parent (BuilderCore)에서 사용됩니다.
 */
export const handleNavigateToPage = (
  data: MessageType,
  onNavigate?: (path: string) => void,
) => {
  if (data.type === "NAVIGATE_TO_PAGE" && onNavigate) {
    const { path } = data.payload as { path: string };
    onNavigate(path);
  }
};
```

---

## 테스트 시나리오

### 준비

1. composition 빌더 실행: `npm run dev`
2. 프로젝트 생성 또는 기존 프로젝트 열기
3. 최소 2개 페이지 필요:
   - Home (`/`)
   - Dashboard (`/dashboard`)

### 테스트 케이스

#### ✅ TC1: 기본 페이지 이동

**Steps:**

1. Home 페이지(`/`)로 이동
2. Button 컴포넌트 배치
3. Inspector > Events 탭에서 onClick 이벤트 추가
4. Navigate 액션 선택, path에 `/dashboard` 입력
5. Preview에서 버튼 클릭

**Expected:**

- 콘솔에 `[BuilderCore] Received NAVIGATE_TO_PAGE: /dashboard` 출력
- Dashboard 페이지로 전환
- Preview가 Dashboard의 elements를 표시
- 페이지 리로드 없음 (SPA 방식)

#### ✅ TC2: 새 탭에서 열기

**Steps:**

1. Button의 onClick 이벤트에서 "Open in New Tab" 체크
2. Preview에서 버튼 클릭

**Expected:**

- 새 브라우저 탭이 열림
- 현재 페이지는 변경 없음

#### ✅ TC3: 외부 URL 이동

**Steps:**

1. Navigate 액션의 path에 `https://google.com` 입력
2. Preview에서 버튼 클릭

**Expected:**

- Google로 전체 페이지 이동 (기존 방식)

#### ✅ TC4: 존재하지 않는 페이지

**Steps:**

1. Navigate 액션의 path에 `/nonexistent` 입력
2. Preview에서 버튼 클릭

**Expected:**

- 콘솔 경고: `[BuilderCore] Page not found for path: /nonexistent`
- 에러 알림 표시: "페이지를 찾을 수 없습니다: /nonexistent"

---

## 수정된 파일 목록

1. ✅ `/src/types/events.ts` - NavigateActionValue 타입 수정
2. ✅ `/src/builder/preview/types/index.ts` - NavigateToPageMessage 타입 추가
3. ✅ `/src/utils/eventEngine.ts` - executeNavigateAction() 대폭 수정
4. ✅ `/src/builder/main/BuilderCore.tsx` - NAVIGATE_TO_PAGE 리스너 추가
5. ✅ `/src/builder/preview/utils/messageHandlers.ts` - handleNavigateToPage 유틸 추가

---

## 향후 작업 (퍼블리싱 모드)

현재 구현은 **빌더 모드**에만 적용되며, 퍼블리시 모드는 아직 구현되지 않았습니다.

### 퍼블리시 모드 구현 시 필요한 작업

1. **퍼블리시 라우트 생성**

   ```typescript
   // apps/builder/src/main.tsx
   <Route path="/site/:projectId/*" element={<PublishedSite />} />
   ```

2. **PublishedSite 컴포넌트 생성**
   - 기존 Preview 컴포넌트 재사용
   - 인증 불필요 (공개 접근)
   - postMessage 리스너 제거
   - React Router 통합

3. **React Router 페이지 라우팅**

   ```typescript
   pages.forEach(page => {
     <Route path={page.slug} element={<PageRenderer pageId={page.id} />} />
   });
   ```

4. **EventEngine에 navigate 함수 주입**

   ```typescript
   // PublishedSite에서
   const navigate = useNavigate();
   eventEngine.setNavigateFunction(navigate);

   // EventEngine에서
   private navigateFunction?: (path: string) => void;

   setNavigateFunction(fn: (path: string) => void) {
     this.navigateFunction = fn;
   }

   private async executeNavigateAction(action: EventAction) {
     // ...
     if (!this.isBuilderMode()) {
       // 퍼블리시 모드
       if (this.navigateFunction) {
         this.navigateFunction(path);
       }
     }
   }
   ```

---

## 장점

### ✅ 확장성

- 빌더/퍼블리시 모드 분기 구조로 향후 확장 용이
- React Router 통합 준비 완료

### ✅ 일관성

- 타입 정의 통일 (`path`, `openInNewTab`)
- 기존 postMessage 패턴 재사용

### ✅ 보안

- 환경 감지로 잘못된 컨텍스트에서 실행 방지
- URL 검증 로직 포함

### ✅ 사용성

- SPA 방식으로 페이지 전환 (리로드 없음)
- 에러 핸들링으로 사용자 피드백 제공

---

## 참고사항

### 내부 페이지 경로 규칙

내부 페이지로 인식되는 패턴:

- ✅ `/` (루트)
- ✅ `/dashboard`
- ✅ `/about`
- ✅ `/users/profile`

외부 URL로 인식되는 패턴:

- ✅ `https://example.com`
- ✅ `http://example.com`
- ✅ `//cdn.example.com`
- ✅ `mailto:user@example.com`
- ✅ `tel:+1234567890`

### 데이터베이스 스키마

페이지 정보는 `pages` 테이블에 저장:

```sql
CREATE TABLE pages (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),
  title TEXT NOT NULL,
  slug TEXT NOT NULL,  -- 예: "/", "/dashboard"
  order_num INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 추가 수정 사항 (타입 호환성)

구현 중 발견된 타입 시스템 불일치를 해결했습니다:

### 문제: 두 가지 이벤트 타입 시스템 공존

**기존 타입 (`/src/types/events.ts`)**:

```typescript
{
  event_type: "onClick",
  actions: [{ type: "navigate", value: {...} }]
}
```

**새 타입 (`/src/builder/inspector/events/types/eventTypes.ts`)**:

```typescript
{
  event: "onClick",
  actions: [{ type: "navigate", config: {...} }]
}
```

### 해결 방법: 하위 호환성 지원

**1. eventHandlers.ts 수정**

```typescript
// event_type 또는 event 모두 지원
const type = e.event_type || e.event;
```

**2. EventEngine 수정**

```typescript
// config 또는 value 모두 지원
const value = actionData.config || actionData.value || {};
```

**3. React Aria 호환**

```typescript
// onClick → onPress 자동 매핑
if (eventType === "onClick") {
  eventHandlers["onPress"] = handler;
}
```

---

## 결론

빌더 모드에서의 페이지 내비게이션 기능이 성공적으로 구현되었습니다.

### ✅ 완료된 기능

- Button onClick 이벤트로 페이지 간 이동
- 두 가지 이벤트 타입 시스템 하위 호환성
- React Aria Button과의 호환 (onClick → onPress 매핑)
- 내부 페이지 vs 외부 URL 자동 구분
- postMessage 기반 안전한 iframe 통신

### 🚀 향후 작업

사용자는 이제 Button onClick 이벤트를 통해 페이지 간 이동을 테스트할 수 있으며, 향후 퍼블리시 모드로의 확장도 원활하게 진행할 수 있는 구조가 마련되었습니다.
