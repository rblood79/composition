/**
 * PropertyRowMenu — `.fieldset-row` 마지막 칸(`.fieldset-actions`)에 서는 행 액션 메뉴.
 *
 * 목록 행(시리즈 · 값 필드 …)의 "위로 / 아래로 / 초기화 / 제거" 처럼 **행마다 2개 이상의
 * 보조 액션**이 있을 때 쓴다. 인스펙터 행 템플릿(`--inspector-row-columns`)의 아이콘 칸은
 * `--control-size` 하나라 버튼을 나란히 두면 필드가 폭을 잃는다 (233px 패널에서 필드 2개 +
 * 아이콘 3개 = 필드당 49px). Appearance 의 "More border options" 와 같은 어법 — 트리거는
 * `SwatchIconButton`, 팝오버·항목 밀도는 필드 Select 의 ListBox 규약(`property-select-popover`).
 */
import { memo, type ComponentType, type Key } from "react";
import { Menu, MenuItem, MenuTrigger } from "react-aria-components/Menu";
import { Popover } from "react-aria-components/Popover";
import { EllipsisVertical } from "lucide-react";
import { SwatchIconButton } from "../ui/SwatchIconButton";
import { iconProps, iconSmall } from "../../../utils/ui/uiConstants";
import "./PropertyRowMenu.css";

export interface PropertyRowMenuItem {
  id: string;
  label: string;
  icon?: ComponentType<{ size?: number; strokeWidth?: number }>;
  isDisabled?: boolean;
}

interface PropertyRowMenuProps {
  /** 트리거의 접근 이름 — 행 정체를 포함한다 (`"Series A actions"`). */
  label: string;
  items: readonly PropertyRowMenuItem[];
  onAction: (id: string) => void;
}

export const PropertyRowMenu = memo(function PropertyRowMenu({
  label,
  items,
  onAction,
}: PropertyRowMenuProps) {
  const disabledKeys = items.filter((i) => i.isDisabled).map((i) => i.id);
  return (
    <MenuTrigger>
      <SwatchIconButton aria-label={label}>
        <EllipsisVertical
          size={iconProps.size}
          strokeWidth={iconProps.strokeWidth}
        />
      </SwatchIconButton>
      <Popover
        className="react-aria-Popover property-select-popover property-row-menu-popover"
        placement="bottom end"
      >
        <Menu
          className="react-aria-Menu property-row-menu"
          aria-label={label}
          disabledKeys={disabledKeys}
          onAction={(key: Key) => onAction(String(key))}
        >
          {items.map((item) => (
            <MenuItem
              key={item.id}
              id={item.id}
              className="react-aria-MenuItem"
              textValue={item.label}
            >
              {item.icon && (
                <item.icon
                  size={iconSmall.size}
                  strokeWidth={iconSmall.strokeWidth}
                />
              )}
              <span>{item.label}</span>
            </MenuItem>
          ))}
        </Menu>
      </Popover>
    </MenuTrigger>
  );
});
