---
name: react-spectrum
description: S2 의 시각 · prop 표면 (D2 — variant · size · isEmphasized · isQuiet · fillStyle) 을 확인할 때 사용하는 로컬 공식 문서 참조. DOM 구조 · 접근성 · 동작은 react-aria.
license: Apache-2.0
compatibility: Requires a React project with react-aria-components or @react-spectrum/s2.
metadata:
  author: Adobe
  website: https://react-spectrum.adobe.com/
  snapshotVersion: "@react-spectrum/s2 1.4.0"
  snapshotDate: 2026-06-17
  snapshotSource: https://react-spectrum.adobe.com/llms.txt
---

# react-spectrum API 참조

대상 컴포넌트나 동작에 해당하는 문서만 엽니다.
`references/components/`는 컴포넌트별 API, `references/guides/`는 공통 패턴입니다.
문서 이름은 `rg --files .claude/skills/react-spectrum/references`로 찾습니다.
전체 문서 분류가 필요할 때만 [문서 인덱스](references/index.md)를 사용합니다.

로컬 reference 는 S2 1.4.0 스냅샷 (2026-06-17) 이고 설치본은 `@react-spectrum/s2` 1.8.1 (`apps/builder/package.json`) 입니다 — 다르면 설치 패키지의 TypeScript 타입이 D2 정본입니다 (ssot-hierarchy.md §D2 · 게이트 `d2S2Alignment.static.test.ts`). 변경 가능성이
있는 동작은 Adobe 공식 문서·소스로 확인합니다. Composition 적용 시 DOM·접근성,
Props, 시각 정본의 경계를 구분합니다.
