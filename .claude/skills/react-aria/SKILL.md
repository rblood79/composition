---
name: react-aria
description: RAC 의 DOM 구조 · 접근성 · 동작 prop (D1 — 이벤트 · 선택 · focus) 을 확인할 때 사용하는 로컬 공식 문서 참조. Spectrum 시각 prop 이름 (variant · size · isQuiet) 은 react-spectrum.
license: Apache-2.0
compatibility: Requires React project with react-aria-components installed.
metadata:
  author: Adobe
  website: https://react-aria.adobe.com/
  snapshotVersion: 1.18.0
  snapshotDate: 2026-06-17
  snapshotSource: https://react-aria.adobe.com/llms.txt
---

# react-aria API 참조

대상 컴포넌트나 동작에 해당하는 문서만 엽니다.
`references/components/`는 컴포넌트별 API, `references/guides/`는 공통 패턴입니다.
문서 이름은 `rg --files .claude/skills/react-aria/references`로 찾습니다.
전체 문서 분류가 필요할 때만 [문서 인덱스](references/index.md)를 사용합니다.

로컬 reference 는 RAC 1.18.0 스냅샷 (2026-06-17) 이고 설치본은 `react-aria-components` 1.22.1 (`pnpm-workspace.yaml` catalog) 입니다 — 다르면 설치 패키지 (`node_modules/react-aria-components`) 가 정본입니다 (ssot-hierarchy.md D1). 변경 가능성이
있는 동작은 Adobe 공식 문서·소스로 확인합니다. Composition 적용 시 DOM·접근성,
Props, 시각 정본의 경계를 구분합니다.
