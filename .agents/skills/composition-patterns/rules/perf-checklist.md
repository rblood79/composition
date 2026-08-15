---
title: Performance Checklist
impact: MEDIUM
impactDescription: 성능 체크리스트 = 일관된 품질, 문제 사전 방지
tags: [performance, checklist, optimization]
---

새 기능 추가 시 확인해야 할 성능 체크리스트입니다.

## 렌더링 체크리스트

### React 컴포넌트

- [ ] **React.memo**: 순수 컴포넌트에 적용 검토
- [ ] **useMemo**: 비용이 큰 계산에 적용
- [ ] **useCallback**: 자식에 전달하는 콜백에 적용
- [ ] **Key 안정성**: 리스트 key가 안정적인 ID 사용

```typescript
// ✅ 안정적인 key
{elements.map(el => <Item key={el.id} />)}

// ❌ 불안정한 key
{elements.map((el, index) => <Item key={index} />)}
```

### 리스트 가상화

- [ ] **100+ 항목**: react-window 또는 @tanstack/virtual 검토
- [ ] **무한 스크롤**: 페이지네이션 또는 가상화 적용

## 번들 체크리스트

### 코드 분할

- [ ] **라우트 분할**: 페이지별 동적 import
- [ ] **큰 라이브러리**: lazy loading 적용

```typescript
// ✅ 동적 import
const MonacoEditor = lazy(() => import("./MonacoEditor"));

// ❌ 정적 import (번들에 포함)
import MonacoEditor from "./MonacoEditor";
```

### Import 최적화

- [ ] **Barrel import 지양**: 직접 경로 import
- [ ] **Tree-shaking 확인**: 사용하지 않는 export 제거

## 데이터 체크리스트

### Store 접근

- [ ] **O(1) 검색**: elementsMap 사용
- [ ] **선택적 구독**: 필요한 상태만 구독

```typescript
// ✅ 선택적 구독
const element = useStore((state) => state.elementsMap.get(id));

// ❌ 전체 구독
const { elements } = useStore();
const element = elements.find((el) => el.id === id);
```

### 네트워크

- [ ] **캐싱**: TanStack Query staleTime 설정
- [ ] **중복 요청 방지**: queryKey 올바르게 설정
- [ ] **병렬 요청**: Promise.all 활용

## Canvas 체크리스트

### Canvas/Skia 렌더링

- [ ] **노드 분류**: Text/Image/Shape 경로를 올바르게 선택
- [ ] **리소스 재사용**: 동일 이미지와 paint 리소스 공유
- [ ] **컬링**: 뷰포트 외 요소 렌더링 스킵

### Viewport Culling

- [ ] **좌표 시스템 일관성**: 뷰포트와 요소 bounds를 동일 좌표계로 비교
- [ ] **실시간 bounds**: 현재 layout snapshot 사용 (stale registry 재사용 금지)
- [ ] **Cull/Render cycle 방지**: 부모 가시성 체크로 unmount→re-include 무한 loop 방지
- [ ] **Overflow 자식 처리**: 부모가 화면에 있으면 자식은 `overflow: visible`로 보일 수 있으므로 cull하지 않음

### 애니메이션

- [ ] **requestAnimationFrame**: setInterval 대신 사용
- [ ] **display refresh cadence**: 60Hz 환경의 최소선과 frame time p50/p95/p99를 모니터링

## 메모리 체크리스트

- [ ] **이벤트 리스너**: 정리(cleanup) 확인
- [ ] **구독 해제**: useEffect cleanup
- [ ] **큰 객체**: 사용 후 참조 해제

```typescript
useEffect(() => {
  const handler = () => {
    /* ... */
  };
  window.addEventListener("resize", handler);

  return () => window.removeEventListener("resize", handler); // ✅ cleanup
}, []);
```

## 성능 기준

| 영역        | 기준                                       | 측정 방법                            |
| ----------- | ------------------------------------------ | ------------------------------------ |
| Canvas/Skia | native refresh target, 60Hz 환경 p95 floor | Chrome trace: frame time p50/p95/p99 |
| 초기 로드   | < 3초                                      | Lighthouse                           |
| 번들 (초기) | < 500KB                                    | vite-bundle-analyzer                 |
| 인터랙션    | < 100ms                                    | Chrome DevTools                      |
| 메모리      | 안정적                                     | Performance Monitor                  |

60fps는 60Hz 환경의 호환성 최소선이며 목표 상한이 아니다. 측정하지 않은
절대 FPS 주장은 하지 않는다.

## 측정 도구

```bash
# 번들 분석
pnpm run build --mode analyze

# Lighthouse 실행
pnpm lighthouse

# 프로파일링
Chrome DevTools → Performance 탭
```

## 참조

> 이 체크리스트는 아래 개별 규칙의 **통합 진입점**입니다.
> Opus 4.6에서 범용 패턴(barrel import, Promise.all, 동적 import)은 자연스럽게 준수되므로,
> 도메인 특화 항목(Canvas/Skia, elementsMap)에 집중하세요.

- `perf-barrel-imports.md` - Barrel import 상세 (범용 — 레퍼런스용)
- `perf-promise-all.md` - 병렬 처리 상세 (범용 — 레퍼런스용)
- `perf-dynamic-imports.md` - 동적 import 상세 (범용 — 레퍼런스용)
- `perf-map-set-lookups.md` - O(1) 검색 상세 (**도메인 특화** — elementsMap 패턴)
