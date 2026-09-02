// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FavoritesManager } from "../favorites-manager";

const { listFavorites, toggleFavorite } = vi.hoisted(() => ({
  listFavorites: vi.fn().mockResolvedValue([{
    id: "favorite-lunch",
    user_id: "dev-user",
    item_name: "午餐",
    is_active: true,
    default_amount: 120,
    currency_code: "TWD",
    category_id: "category-food",
    note: "",
    default_exchange_rate_to_twd: 1,
    sort_order: 0,
    created_at: "2026-08-21",
    updated_at: "2026-08-21",
    categories: { id: "category-food", name: "餐飲", is_active: true },
    tags: [],
  }]),
  toggleFavorite: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/data", () => ({
  deleteFavorite: vi.fn(),
  listCategories: vi.fn().mockResolvedValue([{ id: "category-food", name: "餐飲", is_active: true }]),
  listCurrencies: vi.fn().mockResolvedValue([{ code: "TWD", is_active: true, default_exchange_rate_to_twd: 1 }]),
  listFavorites,
  listTags: vi.fn().mockResolvedValue([]),
  saveFavorite: vi.fn(),
  toggleFavorite,
}));

describe("FavoritesManager", () => {
  afterEach(cleanup);
  beforeEach(() => { listFavorites.mockClear(); toggleFavorite.mockClear(); });

  it("loads inactive favorites in management and can disable an active favorite", async () => {
    render(<FavoritesManager />);

    fireEvent.click(await screen.findByRole("button", { name: "停用" }));

    await waitFor(() => expect(toggleFavorite).toHaveBeenCalledWith("favorite-lunch", false));
    expect(listFavorites).toHaveBeenCalledWith(true);
    expect(screen.getByText("常用項目已停用；既有資料不受影響。")).toBeTruthy();
  });
});
