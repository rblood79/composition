import { useState } from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { I18nProvider } from "@/i18n";
import { DateValueInput } from "./DateValueInput";
import { FieldValueInput } from "../../panels/datatable/grid/FieldValueInput";

afterEach(cleanup);

describe("DateValueInput", () => {
  it("merges native edits into the original zone/precision and switches ISO mode without committing blur", () => {
    const change = vi.fn();
    const blur = vi.fn();
    function Host() {
      const [value, setValue] = useState("2026-10-29T10:30:15.500+09:00");
      return (
        <DateValueInput
          aria-label="When"
          value={value}
          onValueChange={(v) => {
            setValue(v);
            change(v);
          }}
          onBlur={blur}
        />
      );
    }
    const view = render(
      <I18nProvider initialLocale="en-US">
        <Host />
      </I18nProvider>,
    );
    const input = view.getByLabelText("When") as HTMLInputElement;
    expect(input.type).toBe("datetime-local");
    expect(input.step).toBe("0.001");
    expect(input.value).toBe("2026-10-29T10:30:15.5");
    expect(view.getByText("UTC+09:00")).toBeTruthy();
    fireEvent.change(input, { target: { value: "2026-10-29T10:31:15.5" } });
    expect(change).toHaveBeenLastCalledWith("2026-10-29T10:31:15.500+09:00");
    const toggle = view.getByRole("button", { name: "Edit ISO date and time" });
    fireEvent.blur(input, { relatedTarget: toggle });
    expect(blur).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(input.type).toBe("text");
    expect(input.value).toBe("2026-10-29T10:31:15.500+09:00");
    fireEvent.change(input, {
      target: { value: "2026-10-29T12:31:15.123456789Z" },
    });
    fireEvent.blur(input, { relatedTarget: null });
    expect(change).toHaveBeenLastCalledWith("2026-10-29T12:31:15.123456789Z");
    expect(blur).toHaveBeenCalledTimes(1);
  });

  it("leaves a DST gap invalid and editable instead of shifting its wall clock", () => {
    function Host() {
      const [value, setValue] = useState(
        "2026-03-07T02:30-05:00[America/New_York]",
      );
      return (
        <DateValueInput
          aria-label="When"
          value={value}
          onValueChange={setValue}
        />
      );
    }
    const view = render(<Host />);
    const input = view.getByLabelText("When") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2026-03-08T02:30" } });
    expect(input.value).toBe("2026-03-08T02:30");
    expect(input.getAttribute("aria-invalid")).toBe("true");
  });

  it("keeps its edit envelope while a native segment is temporarily empty", () => {
    const change = vi.fn();
    function Host() {
      const [value, setValue] = useState("2026-10-29T10:30:15.500Z");
      return (
        <DateValueInput
          aria-label="When"
          value={value}
          onValueChange={(v) => {
            setValue(v);
            change(v);
          }}
        />
      );
    }
    const view = render(<Host />);
    const input = view.getByLabelText("When") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    expect(input.type).toBe("datetime-local");
    expect(input.value).toBe("");
    fireEvent.change(input, { target: { value: "2026-10-30T10:30:15.5" } });
    expect(change).toHaveBeenLastCalledWith("2026-10-30T10:30:15.500Z");
  });

  it("the RowForm/default editor uses the same lossless ISO commit", () => {
    const change = vi.fn();
    const view = render(
      <I18nProvider initialLocale="en-US">
        <FieldValueInput
          field={{ id: "due", key: "due", type: "date" }}
          label="Due"
          text="2026-10-29T10:30:15.50Z"
          onChange={change}
        />
      </I18nProvider>,
    );
    const input = view.container.querySelector("input")!;
    fireEvent.change(input, { target: { value: "2026-10-30T10:30:15.5" } });
    expect(change).toHaveBeenCalledWith("2026-10-30T10:30:15.50Z");
  });
});
