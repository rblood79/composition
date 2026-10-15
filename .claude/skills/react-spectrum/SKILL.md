---
name: react-spectrum
description: S2 의 시각 · prop 표면 (D2 — variant · size · isEmphasized · isQuiet · fillStyle) 을 확인할 때 사용하는 로컬 공식 문서 참조. DOM 구조 · 접근성 · 동작은 react-aria.
license: Apache-2.0
compatibility: Requires a React project with react-aria-components or @react-spectrum/s2.
metadata:
  author: Adobe
  website: https://react-spectrum.adobe.com/
  snapshotDate: 2026-10-15
  snapshotSource: https://react-spectrum.adobe.com/.well-known/skills/index.json
  refresh: pnpm skills:adobe-refresh react-spectrum
---

# react-spectrum API 참조

대상 컴포넌트나 동작에 해당하는 문서만 엽니다.
`references/components/`는 컴포넌트별 API, `references/guides/`는 공통 패턴입니다.
문서 이름은 `rg --files .claude/skills/react-spectrum/references`로 찾습니다.
전체 문서 분류가 필요할 때만 [문서 인덱스](references/index.md)를 사용합니다.

로컬 reference 는 Adobe 공식 Agent Skill `react-spectrum-s2` 의 스냅샷 (2026-10-15, S2 컴포넌트 + guides + RAC 사본 262 — 목록은 [MANIFEST](references/MANIFEST.md), 갱신은 `pnpm skills:adobe-refresh react-spectrum`) 이고 설치본은 `@react-spectrum/s2` 1.8.1 (`apps/builder/package.json`) 입니다 — 다르면 설치 패키지의 TypeScript 타입이 D2 정본입니다 (ssot-hierarchy.md §D2 · 게이트 `d2S2Alignment.static.test.ts`). 공식 skill 의 「S2 컴포넌트 우선 · `style` macro」 지침은 이 프로젝트에 적용하지 않습니다 — 구현은 RAC (D1) + catalog CSS (D3) 이고, S2 는 prop 이름 · 값의 정본 (D2) 로만 읽습니다. 변경 가능성이
있는 동작은 Adobe 공식 문서·소스로 확인합니다. Composition 적용 시 DOM·접근성,
Props, 시각 정본의 경계를 구분합니다.
