---
name: component-design
description: Composition 새 컴포넌트의 catalog·RAC 계약을 설계하거나 S2 기능을 적용할 때 사용.
user-invocable: true
---

# 컴포넌트 설계·구현

대상 컴포넌트의 RAC DOM·접근성과 Spectrum Props를 확인하고 Composition의
catalog·theme/tokens·panel 어법에 맞게 구현합니다. 기존 컴포넌트의 단순 스타일 수정에는
새 컴포넌트 등록 절차를 적용하지 않습니다.

- API 확인은 `react-aria` 또는 `react-spectrum`의 대상 reference만 읽습니다.
  S2 전용 동작·DOM 측정·상태 흐름이 문서로 불명확하면 Adobe 공식 소스에서 확인합니다.
- 신규 등록은 [등록 경로](references/registration.md)의 타입·기본 props·catalog·factory·
  Preview·Skia 소비 경로를 적용합니다. 필요한 경로만 변경합니다.
- RAC는 unstyled이며 시각 정본은 catalog입니다. Frame/Group/Slot 예외 외에
  새 spec 파일이나 TAG_SPEC_MAP 경로를 추가하지 않습니다.
- 새 의존성은 현재 ADR의 bundle 계약과 승인된 예외를 확인합니다. 오래된 500KB 예시를
  최신 승인 상한이나 만료 기록 대신 사용하지 않습니다.

변경된 계약의 typecheck·등록 테스트와 실제 키보드·focus·사용자 흐름을 검증합니다.
Canvas/Preview를 함께 그리는 컴포넌트는 `cross-check`로 시각 정합성을 확인합니다.
