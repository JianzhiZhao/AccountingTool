// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsManager } from "../settings-manager";

const { toggleCurrency } = vi.hoisted(() => ({ toggleCurrency: vi.fn().mockResolvedValue(undefined) }));

vi.mock("@/lib/data", () => ({
  listCategories: vi.fn().mockResolvedValue([]),
  listCurrencies: vi.fn().mockResolvedValue([
    { user_id: "dev-user", code: "TWD", is_active: true, default_exchange_rate_to_twd: 1, created_at: "2026-08-21", updated_at: "2026-08-21" },
    { user_id: "dev-user", code: "JPY", is_active: true, default_exchange_rate_to_twd: 0.22, created_at: "2026-08-21", updated_at: "2026-08-21" },
  ]),
  listTags: vi.fn().mockResolvedValue([]),
  saveCategory: vi.fn(),
  toggleCategory: vi.fn(),
  deleteCategory: vi.fn(),
  saveTag: vi.fn(),
  deleteTag: vi.fn(),
  toggleCurrency,
}));

describe("SettingsManager currency defaults", () => {
  afterEach(cleanup);
  beforeEach(() => toggleCurrency.mockClear());

  it("saves the default rate for an enabled currency", async () => {
    render(<SettingsManager />);

    const input = await screen.findByLabelText("JPY 預設匯率");
    expect((input as HTMLInputElement).value).toBe("0.22");
    fireEvent.change(input, { target: { value: "0.215" } });
    fireEvent.click(screen.getAllByRole("button", { name: "儲存" })[0]);

    await waitFor(() => expect(toggleCurrency).toHaveBeenCalledWith("JPY", true, 0.215));
  });

  it("requires a positive default rate before enabling a currency", async () => {
    render(<SettingsManager />);

    fireEvent.click((await screen.findAllByRole("button", { name: "啟用" }))[0]);

    expect(await screen.findByText(/請為 USD 輸入大於 0/)).toBeTruthy();
    expect(toggleCurrency).not.toHaveBeenCalledWith("USD", true, expect.anything());
  });
});
