// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reorderById, SettingsManager } from "../settings-manager";

const { reorderCategories, reorderTags, toggleCurrency } = vi.hoisted(() => ({
  reorderCategories: vi.fn().mockResolvedValue(undefined),
  reorderTags: vi.fn().mockResolvedValue(undefined),
  toggleCurrency: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/data", () => ({
  listCategories: vi.fn().mockResolvedValue([
    { id: "11111111-1111-4111-8111-111111111111", user_id: "dev-user", name: "餐飲", is_active: true, sort_order: 0, created_at: "2026-08-21", updated_at: "2026-08-21" },
    { id: "22222222-2222-4222-8222-222222222222", user_id: "dev-user", name: "交通", is_active: true, sort_order: 1, created_at: "2026-08-21", updated_at: "2026-08-21" },
  ]),
  listCurrencies: vi.fn().mockResolvedValue([
    { user_id: "dev-user", code: "TWD", is_active: true, default_exchange_rate_to_twd: 1, created_at: "2026-08-21", updated_at: "2026-08-21" },
    { user_id: "dev-user", code: "JPY", is_active: true, default_exchange_rate_to_twd: 0.22, created_at: "2026-08-21", updated_at: "2026-08-21" },
  ]),
  listTags: vi.fn().mockResolvedValue([
    { id: "33333333-3333-4333-8333-333333333333", user_id: "dev-user", name: "工作", sort_order: 0, created_at: "2026-08-21", updated_at: "2026-08-21" },
    { id: "44444444-4444-4444-8444-444444444444", user_id: "dev-user", name: "旅遊", sort_order: 1, created_at: "2026-08-21", updated_at: "2026-08-21" },
  ]),
  saveCategory: vi.fn(),
  toggleCategory: vi.fn(),
  deleteCategory: vi.fn(),
  reorderCategories,
  saveTag: vi.fn(),
  deleteTag: vi.fn(),
  reorderTags,
  toggleCurrency,
}));

describe("SettingsManager currency defaults", () => {
  afterEach(cleanup);
  beforeEach(() => { toggleCurrency.mockClear(); reorderCategories.mockClear(); reorderTags.mockClear(); });

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

  it("shows drag handles for categories and reorders their data", async () => {
    render(<SettingsManager />);
    expect(await screen.findByRole("button", { name: "拖拉排序分類 餐飲" })).toBeTruthy();
    const reordered = reorderById([
      { id: "11111111-1111-4111-8111-111111111111" },
      { id: "22222222-2222-4222-8222-222222222222" },
    ], "11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222");
    expect(reordered.map((item) => item.id)).toEqual(["22222222-2222-4222-8222-222222222222", "11111111-1111-4111-8111-111111111111"]);
  });

  it("shows drag handles for tags", async () => {
    render(<SettingsManager />);
    expect(await screen.findByRole("button", { name: "拖拉排序Tag 工作" })).toBeTruthy();
  });
});
