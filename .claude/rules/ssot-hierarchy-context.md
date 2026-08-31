---
description: SSOT 체인 배경 맥락 — 역사적 맥락(§0) · 용어 사전(§2) · 주요 ADR 관계(§5). ADR 작성·spec/catalog 작업 시 자동 로드 (정본 ssot-hierarchy.md 에서 2026-08-31 분리)
paths:
  - "docs/adr/**"
  - "packages/specs/**"
  - "packages/shared/src/catalog/**"
---

# SSOT 체인 — 배경 맥락 (역사 · 용어 · ADR 관계)

> 정본 규칙은 [ssot-hierarchy.md](ssot-hierarchy.md) (상시 로드 — 3-Domain 분할 · 경계 판정 · 집행 · 금지/허용 패턴). 이 문서는 그 정본의 §0 · §2 · §5 를 원문 그대로 옮긴 것으로, 절 번호는 인용 안정성을 위해 정본 번호를 유지한다. 매 세션 상주할 필요가 없어 ADR·spec·catalog 작업 시에만 로드된다 (2026-08-31).

## 0. 역사적 맥락 (왜 이 구조인가)

1. **Phase 1**: Builder와 Preview 모두 DOM/CSS — Spec 불필요, 정합성 문제 없음
2. **Phase 2**: 대규모 프로젝트 한계 → Builder를 WebGL/Skia로 전환. Preview는 DOM/CSS(React Aria Components) 유지 → **두 화면 정합성 문제 발생**
3. **Phase 3**: SSOT 원칙 + Spec 도입 (정합성 복구 목적)
4. **현재**: 원칙 미준수로 정합성 재발 — 본 규칙은 그 재발 방지 명문화

## 2. 용어 사전

| 용어                         | 정의                                           | 적용 대상                                                |
| ---------------------------- | ---------------------------------------------- | -------------------------------------------------------- |
| **SSOT (Source of Truth)**   | 단일 source. 해당 domain 내에서 유일 정의 권한 | D3에서 catalog(+잔존 spec 3개)에만 적용                  |
| **권위 (authority)**         | domain 전체를 지배하는 외부 기준               | D1에서 RAC에만 적용                                      |
| **reference**                | 설계 시 참조하는 외부 원천 (결정권 없음)       | D2에서 RSP에 적용                                        |
| **consumer**                 | SSOT에서 파생되어 결과를 소비                  | D3의 Builder(Skia) / Preview(DOM+CSS)                    |
| **symmetric**                | 두 consumer가 대등 — 한쪽이 다른 쪽 기준 아님  | D3의 Skia ↔ CSS                                          |
| **직접 consumer (direct)**   | SSOT에서 직접 파생                             | Skia, catalog CSS binding (잔존 spec 3개는 CSSGenerator) |
| **간접 consumer (indirect)** | 중간 변환 경유                                 | Preview(binding→CSS→DOM), Publish                        |

## 5. 주요 ADR과의 관계

- **ADR-036 (Spec-First, Superseded by ADR-142)**: 컴포넌트당 spec 파일을 D3 SSOT로 둔 메커니즘 — ADR-142로 폐기. 역사적 기록으로 보존
- **ADR-057/058 (Text Spec-First Phase 1~4)**: D3 내부 정리 (spec 시대). Phase 5 Deferred = D1(DOM 구조)을 RAC에 맡긴 결정 — 본 규칙에 완전 정합
- **ADR-059 (skipCSSGeneration 해체)**: D3 내부 정리 (spec 시대). "CSS가 SSOT에서 파생되어야" = D3 symmetric consumer 복원
- **ADR-062 (Field variant 제거)**: D2 정리. RSP 미규정 prop 제거 + RSP 규정 prop(isQuiet) 보강
- **ADR-063 (본 charter)**: 본 규칙의 ADR 형식 정식화
- **ADR-142 (Starter/Spec Component System Cutover, Implemented 2026-06-02)**: D3 SSOT를 컴포넌트당 spec 파일에서 catalog(`COMPONENT_RULES_TABLE`) + theme/tokens root collection으로 재정의. ADR-036/907/908의 spec 스키마 메커니즘을 폐기(907/908은 잔존 spec 3개 한정 존속)

