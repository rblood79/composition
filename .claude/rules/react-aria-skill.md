---
description: UI 컴포넌트 구현/수정 시 React Aria Skill 문서 참조 규칙
paths:
  - "apps/builder/src/builder/**/*.tsx"
  - "apps/builder/src/preview/components/**/*.tsx"
  - "packages/specs/src/components/**/*.ts"
  - "**/factories/definitions/**"
  - "**/editors/**/*.tsx"
---

# React Aria 문서 참조 규칙

> **SSOT 체인 연계 (CRITICAL)**: 본 규칙은 [ssot-hierarchy.md](ssot-hierarchy.md) 3-domain 분할의 **D1(DOM/접근성, RAC 절대 권위) + D2(Props/API, RSP 참조)** 운영 규칙. D1에서 Spec 관여 금지, D2에서 RSP 참조 기반 선별 마이그레이션. 상세 원칙은 정본 규칙 참조.

## 컴포넌트 구현 시 React Aria 문서 참조 (Skill)

새 UI 컴포넌트를 구현하거나 기존 컴포넌트를 수정할 때, **프로젝트 내 React Aria Skill 문서**를 참조하여 공식 API와 접근성 패턴을 확인한다.

### 필수 참조 시점

1. **새 컴포넌트 생성** — 해당 컴포넌트의 React Aria 문서를 먼저 조회
2. **Props/API 설계** — React Aria의 공식 API 컨벤션 확인
3. **접근성(ARIA) 패턴** — 수동 ARIA 작성 전 React Aria 문서 기준 확인
4. **키보드 인터랙션** — React Aria의 키보드 네비게이션 패턴 참조
5. **상태 관리 훅** — React Stately 훅 존재 여부 확인

### Skill 문서 참조 방법

```
1. .claude/skills/react-aria/references/components/{ComponentName}.md  → 컴포넌트 API/예제
2. .claude/skills/react-aria/references/guides/                        → 가이드 (styling, forms, collections 등)
3. .claude/skills/react-aria/references/interactions/                   → 훅 (usePress, useFocus 등)
4. .claude/skills/react-aria/references/testing/                       → 테스팅 패턴
```

Read 도구로 해당 파일을 직접 읽어 참조한다.

### 참조 후 적용 원칙

- React Aria 패턴을 **그대로 복사하지 않고**, composition 컨벤션(tv(), Zustand, Spec 패턴)에 맞게 내재화
- React Aria hooks 사용 우선 (useButton, useTextField, useCalendar 등)
- 수동 ARIA 속성 작성 금지 — React Aria가 제공하는 hook 사용
- React Stately hooks로 상태 관리 (useListState, useTreeState 등)

### S2 기능 추가/변환 시: GitHub 소스코드 직접 참조 (CRITICAL)

기존 컴포넌트에 S2 전용 기능을 추가하거나 S2 패턴으로 변환할 때, **Skill 문서(API/Props)만으로는 내부 구현을 파악할 수 없다.** GitHub 소스코드를 직접 fetch하여 실제 메커니즘을 확인한 후 내재화한다.

**절차**:

1. Skill 문서로 Props/API 사양 파악
2. `WebFetch https://raw.githubusercontent.com/adobe/react-spectrum/main/packages/@react-spectrum/s2/src/{ComponentName}.tsx` — 실제 소스 참조
3. 핵심 패턴 추출 (DOM 측정, 상태 흐름, 무한 루프 방지 등)
4. composition 컨벤션으로 내재화

**적용 시점**: S2 전용 기능 추가, 복잡한 DOM 측정/상태 관리 포함 기능, Skill 문서만으로 불명확한 경우

### 참조 생략 조건

- 단순 스타일 변경, 버그 수정 등 API 설계와 무관한 작업
- 이미 composition에 확립된 패턴의 반복 적용 (예: 기존 Spec과 동일 구조)
- React Aria가 지원하지 않는 커스텀 컴포넌트 (Canvas 전용 등)
