import { useContext, useEffect } from "react";
import { TableStateContext } from "react-aria-components/Table";

/**
 * While a cell editor is open, the RAC table's keyboard navigation is off — its focus management
 * keeps the focused cell focused and would pull focus back out of the editor. The editor's unmount
 * turns it back on (RAC's editable-cell idiom). The variable table and the data grid's editors.
 */
export function useTableNavigationLock() {
  const state = useContext(TableStateContext);
  useEffect(() => {
    state?.setKeyboardNavigationDisabled(true);
    return () => state?.setKeyboardNavigationDisabled(false);
  }, [state]);
}
