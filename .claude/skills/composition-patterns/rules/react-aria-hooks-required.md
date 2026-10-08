---
title: React-Aria Hooks Required
impact: HIGH
impactDescription: 접근성 보장, 키보드/스크린리더 지원
tags: [react-aria, accessibility, hooks]
---

인터랙티브 컴포넌트는 설치된 `react-aria-components` 컴포넌트를 먼저 씁니다 (D1 권위 —
[SSOT](../../../rules/ssot-hierarchy.md)). RAC 에 없는 동작만 `react-aria` 훅으로 보강합니다.
커스텀 포커스/키보드 이벤트 직접 구현을 금지합니다.

## Incorrect

```tsx
// ❌ 커스텀 키보드 이벤트 직접 구현
function CustomButton({ onClick, children }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      onClick();
    }
  };

  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={handleKeyDown}>
      {children}
    </div>
  );
}

// ❌ 포커스 관리 직접 구현
function CustomInput() {
  const [focused, setFocused] = useState(false);
  return (
    <input
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={focused ? "focused" : ""}
    />
  );
}
```

## Correct

```tsx
// ✅ React-Aria 훅 사용
import { useButton } from "react-aria";

function CustomButton({ onPress, children }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useButton({ onPress }, ref);

  return (
    <button {...buttonProps} ref={ref}>
      {children}
    </button>
  );
}

// ✅ useFocusRing 사용
import { useFocusRing } from "react-aria";

function CustomInput() {
  const { isFocusVisible, focusProps } = useFocusRing();

  return (
    <input {...focusProps} className={isFocusVisible ? "focus-ring" : ""} />
  );
}

// ✅ React-Aria Components 사용 (권장)
import { Button } from "react-aria-components";

function MyButton({ onPress, children }) {
  return <Button onPress={onPress}>{children}</Button>;
}
```
