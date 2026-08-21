export const ISO_CURRENCIES = [
  ["TWD", "新台幣"], ["USD", "美元"], ["JPY", "日圓"], ["CNY", "人民幣"],
  ["EUR", "歐元"], ["GBP", "英鎊"], ["HKD", "港幣"], ["KRW", "韓元"],
  ["SGD", "新加坡幣"], ["AUD", "澳幣"], ["CAD", "加拿大幣"], ["CHF", "瑞士法郎"],
  ["THB", "泰銖"], ["VND", "越南盾"], ["MYR", "馬來西亞令吉"], ["PHP", "菲律賓披索"],
] as const;

export const CURRENCY_NAMES = Object.fromEntries(ISO_CURRENCIES) as Record<string, string>;

export const EMPTY_FILTERS = { query: "", from: "", to: "", categoryId: "", currencyCode: "", tagId: "" };
