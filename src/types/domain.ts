export type Category = {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EnabledCurrency = {
  user_id: string;
  code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  item_name: string;
  expense_date: string;
  amount: number;
  currency_code: string;
  category_id: string;
  note: string;
  exchange_rate_to_twd: number;
  amount_twd: number;
  created_at: string;
  updated_at: string;
  categories?: Pick<Category, "id" | "name" | "is_active"> | null;
  tags?: Pick<Tag, "id" | "name">[];
};

export type FavoriteTemplate = {
  id: string;
  user_id: string;
  item_name: string;
  default_amount: number;
  currency_code: string;
  category_id: string;
  note: string;
  default_exchange_rate_to_twd: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
  categories?: Pick<Category, "id" | "name" | "is_active"> | null;
  tags?: Pick<Tag, "id" | "name">[];
};

export type FavoriteInput = {
  item_name: string;
  default_amount: number;
  currency_code: string;
  category_id: string;
  note: string;
  default_exchange_rate_to_twd: number;
  sort_order: number;
  tag_ids: string[];
};

export type UserSettings = {
  user_id: string;
  base_currency: "TWD";
  timezone: "Asia/Taipei";
  created_at: string;
  updated_at: string;
};

export type ExpenseInput = {
  item_name: string;
  expense_date: string;
  amount: number;
  currency_code: string;
  category_id: string;
  note: string;
  exchange_rate_to_twd: number;
  tag_ids: string[];
};

export type ExpenseFilters = {
  query: string;
  from: string;
  to: string;
  categoryId: string;
  currencyCode: string;
  tagId: string;
};
