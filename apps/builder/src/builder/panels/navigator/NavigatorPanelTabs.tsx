/**
 * NavigatorPanelTabs
 *
 * Pages/Layouts 탭 전환 UI 컴포넌트.
 * React Aria TabList 패턴을 따름.
 */

import { FileText, Layout } from "lucide-react";
import { Tab, TabList } from "react-aria-components/Tabs";
import { iconProps } from "../../../utils/ui/uiConstants";
import { useI18n } from "../../../i18n";

export type NavigatorPanelTabType = "pages" | "layouts";

export function NavigatorPanelTabs() {
  const { t } = useI18n();
  const tabs: {
    id: NavigatorPanelTabType;
    label: string;
    Icon: typeof FileText;
  }[] = [
    {
      id: "pages",
      label: t("navigator.pages"),
      Icon: FileText,
    },
    {
      // canonical reusable FrameNode를 편집하지만 사용자 문맥은 page layout이다.
      // 탭 id "layouts" / EditMode "layout"과 같은 Layouts 라벨을 사용한다.
      id: "layouts",
      label: t("navigator.frames"),
      Icon: Layout,
    },
  ];

  return (
    <TabList className="panel-tablist" aria-label={t("navigator.panelTabs")}>
      {tabs.map(({ id, label, Icon }) => (
        <Tab key={id} id={id} className="panel-tab navigator-panel-tab">
          <Icon
            color="currentColor"
            strokeWidth={iconProps.strokeWidth}
            size={iconProps.size}
          />
          <span className="panel-tab-label navigator-panel-tab-label">
            {label}
          </span>
        </Tab>
      ))}
    </TabList>
  );
}

export default NavigatorPanelTabs;
