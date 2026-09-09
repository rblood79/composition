# Workflow View Sync

> **폐기 (2026-09-09)**: 본문이 지목하는 `src/workflow/store/workflowStore.ts` 와 `BuilderWorkflow.tsx` 는 삭제됐다 ([WORKFLOW.md](WORKFLOW.md) 참조 — ReactFlow 의존성 제거, CanvasKit 오버레이로 전환). 현행 워크플로우 렌더는 `apps/builder/src/builder/workspace/canvas/skia/workflowRenderer*`. 기록 보존용.

빌더 상단 헤더의 `Switch to Workflow` 토글로 진입하는 워크플로우 뷰가 실제 프로젝트 데이터와 어떻게 동기화되는지 요약합니다. (기본 코드 위치: `src/builder/main/BuilderWorkflow.tsx`, `src/workflow/store/workflowStore.ts`)

## 동작 개요
- 데이터 소스: 빌더의 Zustand 스토어에서 `pages`, `elements`, `layouts`를 읽어 워크플로우 스토어에 즉시 반영합니다.
- 슬러그 정규화: 워크플로우로 보낼 때 페이지 `slug`의 선행 슬래시를 제거해 `//page-2` 같은 중복 표기를 방지합니다.
- 로딩 상태: 페이지가 비어 있어도 최초 동기화 시 `setLoading(false)`로 스피너를 종료하고 빈 상태를 표시합니다.

## 엣지 생성 규칙
- 링크 기반 네비게이션(`navEdgeCount`)
  - 지원 태그: `Link`, `a`, `Button` (대소문자 무관).
  - 지원 prop: `href`, `to`, `path`, `url`, `link.href`.
  - 외부/해시 링크는 제외, 슬러그는 앞뒤 `/`·쿼리·해시를 제거해 매칭.
- 이벤트 기반 네비게이션(`eventEdgeCount`)
  - `navigate`/`link` 액션만 처리.
  - 경로는 `action.config.path|href|to|url` → 없으면 `action.value.path|href|to|url`에서 추출.
  - 비활성 이벤트/액션은 제외, 슬러그 정규화 규칙 동일.
- 레이아웃 엣지: `showLayouts` + `showLayoutEdges`가 켜져 있으면 Layout → Page 점선 엣지 표시.
- 데이터 소스 엣지: 데이터 바인딩(source: dataTable/api/supabase/mock)을 사용하는 경우 DataSource → Page 엣지 표시.

## 토글/검증
- 워크플로우 툴바: `Layouts`, `Navigation`, `Layout Links` 토글 제공 (이벤트 엣지는 기본 on, UI 토글 없음).
- 개발 로그: `NODE_ENV=development`에서 `[Workflow] graph built { nodes, edges, navEdgeCount, eventEdgeCount }`를 콘솔에 출력해 생성 결과를 즉시 확인할 수 있습니다.

## 트러블슈팅 체크리스트
- 엣지가 없을 때
  1) 상단 툴바에서 `Navigation` 토글이 켜져 있는지 확인.
  2) 페이지 `slug`에 중복된 `/`이 없는지 확인(빌더에서 자동 정규화됨).
  3) 버튼/링크에 내부 경로가 `href|to|path`로 설정됐는지 확인.
  4) 이벤트의 `navigate` 액션이 `config.path`(또는 `value.path`)에 설정돼 있고 enabled 상태인지 확인.
- 이벤트/링크가 모두 인식되는데 선이 없을 때: 콘솔의 `navEdgeCount`, `eventEdgeCount` 값을 보고 0이면 매칭 문제, 0 이상이면 CanvasKit 오버레이 렌더/토글 문제입니다.

## 기대 결과
- Home 버튼이 `/page-2`, `/page-3`으로 이동하도록 설정된 경우 `Navigation` 토글 on 시 두 개의 네비게이션 엣지가 표시됩니다.
- 동일 경로가 이벤트 navigate로도 설정돼 있다면 `Events`가 on인 상태에서 점선 엣지가 추가로 표시됩니다.
