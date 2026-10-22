import { render, screen } from "@testing-library/react";
import {
  Button,
  ButtonContext,
  Checkbox,
  CheckboxContext,
  CheckboxGroup,
  DateField,
  DateInput,
  DateSegment,
  Dialog,
  I18nProvider,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Provider,
  Select,
  SelectValue,
} from "react-aria-components";
import { describe, expect, it } from "vitest";

/**
 * ADR-281 Phase 0 §1f — what the installed RAC (D1 authority) does with an ancestor `Provider`
 * at the places Decision 3 depends on. Facts, not wishes: each `it` pins the observed behavior so
 * an RAC upgrade that changes it turns RED here first (`providerContexts.ts` lists only what P1 ~
 * P4 say reaches).
 */
const disabled = (element: HTMLElement | null) =>
  element?.hasAttribute("disabled") ||
  element?.getAttribute("data-disabled") === "true" ||
  element?.hasAttribute("data-disabled");

describe("ADR-281 §1f — an ancestor RAC Provider and the contexts RAC supplies inside", () => {
  it("P1: a Select supplies its trigger's ButtonContext — the outer ButtonContext does not reach the trigger", () => {
    render(
      <Provider values={[[ButtonContext, { isDisabled: true }]]}>
        <Select aria-label="pick">
          <Button>
            <SelectValue />
          </Button>
          <Popover>
            <ListBox>
              <ListBoxItem id="a">A</ListBoxItem>
            </ListBox>
          </Popover>
        </Select>
        <Button>plain</Button>
      </Provider>,
    );
    expect(disabled(screen.getByRole("button", { name: "plain" }))).toBe(true);
    const trigger = screen
      .getAllByRole("button")
      .find((button) => button.textContent !== "plain")!;
    expect(disabled(trigger)).toBe(false);
  });

  it("P2: a CheckboxGroup's Checkbox still reads the outer CheckboxContext", () => {
    render(
      <Provider values={[[CheckboxContext, { isDisabled: true }]]}>
        <CheckboxGroup aria-label="group">
          <Checkbox value="a">A</Checkbox>
        </CheckboxGroup>
      </Provider>,
    );
    expect((screen.getByRole("checkbox") as HTMLInputElement).disabled).toBe(
      true,
    );
  });

  it("P3: a Dialog's slot Button is not reached by the outer ButtonContext (the Dialog supplies its own)", () => {
    render(
      <Provider values={[[ButtonContext, { isDisabled: true }]]}>
        <Dialog aria-label="body">
          <Button slot="close">close</Button>
        </Dialog>
      </Provider>,
    );
    expect(disabled(screen.getByRole("button", { name: "close" }))).toBe(false);
  });

  it("P4: a child's own isDisabled={false} beats the ancestor's isDisabled (useContextProps merge)", () => {
    render(
      <Provider values={[[ButtonContext, { isDisabled: true }]]}>
        <Button isDisabled={false}>own</Button>
      </Provider>,
    );
    expect(disabled(screen.getByRole("button", { name: "own" }))).toBe(false);
  });

  it("P5: the nearest I18nProvider wins (a field's locale over the page root's)", () => {
    const order = (locale: string | undefined) => {
      const view = render(
        <I18nProvider locale="ko-KR">
          <I18nProvider locale={locale ?? "ko-KR"}>
            <DateField
              aria-label="date">
              <Label>date</Label>
              <DateInput>
                {(segment) => <DateSegment segment={segment} />}
              </DateInput>
            </DateField>
          </I18nProvider>
        </I18nProvider>,
      );
      const types = [
        ...view.container.querySelectorAll<HTMLElement>("[data-type]"),
      ]
        .map((segment) => segment.dataset.type)
        .filter((type) => type !== "literal");
      view.unmount();
      return types;
    };
    expect(order(undefined)).toEqual(["year", "month", "day"]);
    expect(order("en-US")).toEqual(["month", "day", "year"]);
  });

  it("P6: RAC alone sets no color-scheme attribute — the color mode is the theme's (applyTheme)", () => {
    const view = render(
      <Provider values={[[ButtonContext, {}]]}>
        <Button>any</Button>
      </Provider>,
    );
    const attributes = [
      document.documentElement,
      ...view.container.querySelectorAll("*"),
    ].flatMap((element) =>
      [...element.attributes]
        .map((attribute) => attribute.name)
        .filter((name) => /color-?scheme|theme/i.test(name)),
    );
    expect(attributes).toEqual([]);
    view.unmount();
  });
});
