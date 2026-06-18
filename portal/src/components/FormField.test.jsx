import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FormField from "./FormField";

describe("FormField", () => {
  it("associates label with control via htmlFor", () => {
    render(
      <FormField label="Pipeline name" tip="Unique name">
        <input defaultValue="orders" />
      </FormField>
    );
    const input = screen.getByLabelText("Pipeline name");
    expect(input).toHaveValue("orders");
    expect(input).toHaveAttribute("aria-describedby", `${input.id}-tip`);
  });
});
