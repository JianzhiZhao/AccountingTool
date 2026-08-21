// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ExpenseForm } from "../expense-form";

const { categoryId, saveExpense } = vi.hoisted(() => ({
  categoryId: "11111111-1111-4111-8111-111111111111",
  saveExpense: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/data", () => ({
  listCategories: vi.fn().mockResolvedValue([
    { id: categoryId, user_id: "dev-user", name: "交通", is_active: true, created_at: "2026-08-21", updated_at: "2026-08-21" },
  ]),
  listCurrencies: vi.fn().mockResolvedValue([
    { user_id: "dev-user", code: "JPY", is_active: true, created_at: "2026-08-21", updated_at: "2026-08-21" },
    { user_id: "dev-user", code: "TWD", is_active: true, created_at: "2026-08-21", updated_at: "2026-08-21" },
  ]),
  listFavorites: vi.fn().mockResolvedValue([
    {
      id: "favorite-bus-home",
      user_id: "dev-user",
      item_name: "下班公車費",
      default_amount: 20,
      currency_code: "TWD",
      category_id: categoryId,
      note: "",
      default_exchange_rate_to_twd: 1,
      sort_order: 0,
      created_at: "2026-08-21",
      updated_at: "2026-08-21",
    },
  ]),
  saveExpense,
}));

describe("ExpenseForm", () => {
  beforeEach(() => saveExpense.mockClear());

  it("does not submit or clear the favorite item when Enter is pressed in the exchange-rate field", async () => {
    render(<ExpenseForm />);

    fireEvent.click(await screen.findByRole("button", { name: /下班公車費/ }));
    fireEvent.change(screen.getByLabelText("幣別 *"), { target: { value: "JPY" } });

    const rate = screen.getByLabelText(/1 JPY 可換多少 TWD/);
    fireEvent.change(rate, { target: { value: "0.22" } });

    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    const shouldRunBrowserDefault = rate.dispatchEvent(enter);
    if (shouldRunBrowserDefault) fireEvent.submit(rate.closest("form")!);

    await waitFor(() => expect((screen.getByLabelText("項目名稱 *") as HTMLInputElement).value).toBe("下班公車費"));
    expect(saveExpense).not.toHaveBeenCalled();
  });
});
