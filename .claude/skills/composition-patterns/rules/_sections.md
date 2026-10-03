# Sections

규칙 파일의 접두사로 섹션을 분류합니다.

| 섹션 | 접두사         | 기본 영향도   | 설명                                                                           |
| ---- | -------------- | ------------- | ------------------------------------------------------------------------------ |
| 1    | `domain-`      | CRITICAL      | 비즈니스 로직/도메인 규칙 (문서 · 명령 · 히스토리는 catalog runtime — ADR-248) |
| 2    | `validation-`  | CRITICAL      | 입력 검증/에러 처리 규칙                                                       |
| 3    | `style-`       | CRITICAL      | 스타일/CSS 규칙                                                                |
| 4    | `type-`        | CRITICAL      | TypeScript 타입 규칙                                                           |
| 5    | `spec-`        | HIGH~CRITICAL | 잔존 spec · shape 생성 규칙                                                    |
| 6    | `react-aria-`  | HIGH          | React-Aria 접근성 규칙                                                         |
| 7    | `zustand-`     | HIGH          | 남은 UI · 데이터 store 규칙 (문서 · 요소 상태 제외)                            |
| 8    | `postmessage-` | HIGH~CRITICAL | PostMessage 통신 규칙                                                          |
| 9    | `inspector-`   | HIGH          | 패널 (Inspector) 편집 · 히스토리 연동 규칙                                     |
| 10   | `perf-`        | MEDIUM        | 성능 최적화 규칙                                                               |
| 11   | `test-`        | MEDIUM        | 테스트/Storybook 규칙                                                          |
| 12   | `arch-`        | HIGH          | 참조 구현 위치                                                                 |

> **Note**: 위 표는 섹션별 기본 영향도입니다.
> 개별 규칙은 중요도에 따라 다른 영향도를 가질 수 있습니다.
>
> - `domain-*` → 비즈니스 로직 오류 = 기능 결함
> - `validation-*` → 안정성/보안 직결
> - `postmessage-origin-verify` → CRITICAL (보안)
