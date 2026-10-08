---
title: Use React-Stately Hooks
impact: HIGH
impactDescription: 일관된 상태 관리, 접근성 호환
tags: [react-aria, react-stately, state]
---

선택·토글·collection 상태는 설치된 `react-aria-components` 컴포넌트가 내부에서 관리하는 것을
먼저 씁니다. RAC 컴포넌트 밖에서 그 상태가 필요할 때만 React-Stately 훅을 쓰고, useState 로
직접 상태 관리를 흉내 내지 않습니다.

## Incorrect

```tsx
// ❌ useState로 토글 상태 직접 관리
function ToggleButton() {
  const [isSelected, setIsSelected] = useState(false);

  return (
    <button onClick={() => setIsSelected(!isSelected)}>
      {isSelected ? "On" : "Off"}
    </button>
  );
}

// ❌ 리스트 선택 상태 직접 관리
function SelectableList({ items }) {
  const [selectedKeys, setSelectedKeys] = useState(new Set());

  const toggleItem = (key) => {
    const newSet = new Set(selectedKeys);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setSelectedKeys(newSet);
  };

  return items.map((item) => (
    <div key={item.id} onClick={() => toggleItem(item.id)}>
      {item.label}
    </div>
  ));
}
```

## Correct

```tsx
// ✅ useToggleState 사용
import { useToggleState } from 'react-stately';
import { useToggleButton } from 'react-aria';

function ToggleButton() {
  const state = useToggleState();
  const ref = useRef<HTMLButtonElement>(null);
  const { buttonProps } = useToggleButton({}, state, ref);

  return (
    <button {...buttonProps} ref={ref}>
      {state.isSelected ? 'On' : 'Off'}
    </button>
  );
}

// ✅ useListState 사용
import { useListState } from 'react-stately';
import { useListBox, useOption } from 'react-aria';

function SelectableList({ items }) {
  const state = useListState({
    items,
    selectionMode: 'multiple'
  });

  const ref = useRef<HTMLUListElement>(null);
  const { listBoxProps } = useListBox({}, state, ref);

  return (
    <ul {...listBoxProps} ref={ref}>
      {[...state.collection].map(item => (
        <Option key={item.key} item={item} state={state} />
      ))}
    </ul>
  );
}

// ✅ React-Aria Components 사용 (권장)
import { ToggleButton, ListBox, ListBoxItem } from 'react-aria-components';

<ToggleButton>Toggle</ToggleButton>
<ListBox selectionMode="multiple">
  {items.map(item => <ListBoxItem key={item.id}>{item.label}</ListBoxItem>)}
</ListBox>
```
