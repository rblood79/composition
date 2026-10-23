---
title: Performance Checklist
impact: MEDIUM
impactDescription: 성능 체크리스트 = 일관된 품질, 문제 사전 방지
tags: [performance, checklist, optimization]
---

새 기능 추가 시 확인해야 할 성능 체크리스트입니다.

## 렌더링 체크리스트

### 리스트 가상화

- [ ] **100+ 항목**: `@tanstack/react-virtual` 검토 (builder 의존성에 있는 가상화 라이브러리는 이것 하나)
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

> 문서 · 요소 상태는 Zustand store 가 아니라 catalog runtime 이 소유한다 (ADR-248 — `.claude/rules/state-management.md`).

- [ ] **O(1) 검색**: 문서는 `CatalogGraph.getEntry` · `ownerOf` · `referrersOf` (`packages/shared/src/catalog/document/graph.ts`), Canvas 쪽은 composition root 의 record Map. 문서 전체를 훑어 찾지 않는다
- [ ] **선택적 구독**: field · 행 단위로 구독 — `useCatalogSession(select)` · `useCatalogRows` (`catalogRuntime/react.runtime.ts`), `runtime.subscribeEntryField` · `subscribeResolvedField` (`catalogRuntime/controller.ts`). 남은 UI store 는 개별 selector

```typescript
// ✅ 필요한 값만 구독
const selection = useCatalogSession((state) => state.selection);

// ❌ 문서 전체를 내보내 놓고 찾기 (exportDocument 는 저장 · 교환 형식)
const entries = Object.values(graph.exportDocument().entries);
const entry = entries.find((e) => e.id === id); // → graph.getEntry(id)
```

### 네트워크

- [ ] **중복 요청 방지**: 같은 요청을 동시에 여러 번 보내지 않는다 (builder 에 TanStack Query 는 없다)
- [ ] **병렬 요청**: Promise.all 활용

## Canvas 체크리스트

### Skia/CanvasKit 렌더링

- [ ] **WASM Paragraph 객체 캐싱 금지**: 메모리 누수 — 측정 결과값 `{width, height}` 만 LRU 캐싱 (Canvas 2D 세그먼트 캐시 `canvas2dSegmentCache.ts` 는 폭만 보관, 상세: `.claude/rules/canvas-rendering.md` §3)
- [ ] **측정기 ↔ 렌더러 fontFamilies 동일 배열**: CSS 체인 전체를 `split(",")` → `resolveFamily()` 매핑 (불일치 시 줄바꿈 위치 어긋남)
- [ ] **컬링**: 뷰포트 외 요소 렌더링 스킵 — `SkiaRenderer.renderContent(cullingBounds)` 가 명령 스트림 실행 (`executeRenderCommands` AABB 컬링) 에 넘긴다

### Viewport Culling

- [ ] **좌표 시스템 일관성**: 뷰포트와 요소 bounds를 동일 좌표계(스크린 좌표)로 비교
- [ ] **실시간 bounds**: 명령 스트림의 `boundsMap` (scene 좌표) 과 composition root 의 `getGeometry` 를 쓴다. `elementRegistry.ts` 의 bounds 레지스트리는 production 쓰기 호출자가 없어 catalog 경로에서 비어 있다 — 새 코드가 읽지 않는다
- [ ] **Cull/Render cycle 방지**: 부모 가시성 체크로 unmount→re-include 무한 loop 방지
- [ ] **Overflow 자식 처리**: 부모가 화면에 있으면 자식은 `overflow: visible`로 보일 수 있으므로 cull하지 않음

### 애니메이션

- [ ] **requestAnimationFrame**: setInterval 대신 사용
- [ ] **display refresh cadence**: 60Hz 환경의 최소선과 frame time p50/p95/p99를 모니터링

## 성능 기준

| 영역        | 기준                                                         | 측정 방법                            |
| ----------- | ------------------------------------------------------------ | ------------------------------------ |
| Canvas/Skia | native refresh target, 60Hz 환경 p95 floor                   | Chrome trace: frame time p50/p95/p99 |
| 초기 로드   | < 3초                                                        | Chrome DevTools Performance          |
| 번들 (초기) | ADR-201 §initial 번들 상한 재승인 절의 현재 값 (만료일 포함) | `adr201-bundle-gate.mjs`             |
| 인터랙션    | < 100ms                                                      | Chrome DevTools                      |
| 메모리      | 안정적                                                       | Performance Monitor                  |

60fps는 60Hz 환경의 호환성 최소선이며 목표 상한이 아니다. 측정하지 않은
절대 FPS 주장은 하지 않는다.

## 측정 도구

```bash
# 누수 · 프레임 기준선 (ADR-246 · BUILDER_PERF_BASELINE_2026-09)
pnpm perf:baseline -- --lane leak|frame

# 결정적 카운트 ratchet (수동 — 성능 작업 때. push 자동 실행은 2026-10-24 기본 끔)
pnpm gate:perf-ratchet

# 프로파일링
Chrome DevTools → Performance 탭
```

## 참조

> 이 체크리스트는 성능 규칙의 **통합 진입점**입니다 — 도메인 특화 항목 (Canvas/Skia, catalog graph · record Map 조회) 이 핵심입니다.

- 범용 패턴 (barrel import 금지 · `Promise.all` 병렬 · lazy `import()` · Map/Set O(1) 조회) 은 별도 규칙 파일 없음 — lint/tsc 와 기본 동작에 맡긴다. catalog 쪽 조회는 `graph.getEntry` · `ownerOf` 인덱스를 쓴다 ([domain-o1-lookup](domain-o1-lookup.md))
