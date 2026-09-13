---
name: composition-patterns
description: Composition의 canonical 상태, 레이아웃, catalog·Canvas·Preview 계약을 확인할 때 사용.
user-invocable: true
---

# Composition 코드 계약

일반 코딩 절차 대신 현재 변경의 도메인에 해당하는 정본만 읽습니다.
Codex에서는 Claude의 glob 규칙 자동 로드를 전제하지 않습니다.

| 변경 영역                               | 정본                                                                                           |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 시각·DOM·Props 권위                     | [SSOT](../../rules/ssot-hierarchy.md)                                                          |
| Zustand·selection·history·canonical     | [상태 관리](../../rules/state-management.md), [runtime 불변식](reference/runtime-contracts.md) |
| CanvasKit·Skia 캐시·렌더 루프           | [Canvas](../../rules/canvas-rendering.md)                                                      |
| Rust 엔진·layout invalidation·grid/flex | [레이아웃](../../rules/layout-engine.md)                                                       |
| CSS·token·variant                       | [스타일](../../rules/css-tokens.md)                                                            |
| 트리 구조 변경의 소비자                 | [구조 변경 감사](rules/domain-structure-change-audit.md)                                       |
| 패널 섹션                               | [Section 계약](rules/domain-section-component.md)                                              |
| Preview 동기화                          | [origin](rules/postmessage-origin-verify.md), [ready 버퍼](rules/postmessage-buffer-ready.md)  |

추가 규칙은 `rules/`, 구현 레퍼런스는 `reference/`에서 관련 이름으로 찾습니다.
예: `rg --files .claude/skills/composition-patterns/rules`.

핵심 구분: DOM·접근성은 RAC, Props/API는 Spectrum 참조와 custom 계약,
시각은 catalog `COMPONENT_RULES_TABLE` + theme/tokens입니다. 잔존 spec은
Frame/Group/Slot 경로입니다. Canvas와 Preview의 시각 결과를 같은 정본에 대조합니다.
