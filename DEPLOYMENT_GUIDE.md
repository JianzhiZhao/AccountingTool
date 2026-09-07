# 小帳本：Vercel 與 Supabase 部署指南

這份指南適用於本專案的正式環境部署。完成後，網站會由 Vercel 執行 Next.js，資料、登入帳號與權限則由 Supabase 提供。

## 目錄

1. [部署架構](#部署架構)
2. [事前準備](#事前準備)
3. [建立 Supabase 專案](#建立-supabase-專案)
4. [建立資料庫結構](#建立資料庫結構)
5. [預付與攤提 migration](#預付與攤提-migration)
6. [設定登入與私人帳號](#設定登入與私人帳號)
7. [部署到 Vercel](#部署到-vercel)
8. [設定 Supabase 網址](#設定-supabase-網址)
9. [首次上線驗收](#首次上線驗收)
10. [日後更新流程](#日後更新流程)
11. [常見問題](#常見問題)
12. [安全與維護建議](#安全與維護建議)

## 部署架構

正式環境的資料流如下：

```text
手機或電腦瀏覽器
        │
        ▼
Vercel（Next.js 網站）
        │
        ▼
Supabase（Auth + PostgreSQL + Row Level Security）
```

- Vercel：建置、託管網站並在 GitHub 更新後自動重新部署。
- Supabase Auth：處理 Email／密碼登入與密碼重設。
- Supabase PostgreSQL：保存分類、帳目、幣別、常用項目與 Tag。
- Row Level Security（RLS）：確保登入者只能讀寫自己的資料。
- SQLite：只用於本機開發；正式建置固定使用 Supabase。

## 事前準備

請先準備：

- GitHub 帳號，以及已推送本專案的 GitHub repository。
- Vercel 帳號，建議直接使用 GitHub 登入。
- Supabase 帳號。
- Node.js 22.x 與 npm，供部署前在本機驗證。

本機部署前檢查：

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

以上指令都成功後再部署，可提早發現型別、測試或正式建置問題。

## 建立 Supabase 專案

1. 登入 [Supabase Dashboard](https://supabase.com/dashboard)。
2. 選擇 **New project**。
3. 設定專案名稱、資料庫密碼與區域。
4. 區域建議選擇靠近主要使用者的位置；資料庫區域建立後通常不容易變更。
5. 保存資料庫密碼到密碼管理器，不要放入 Git repository。
6. 等候專案建立完成。

接著到 Supabase 專案的 **Settings → API**（新版介面可能顯示為 **Project Settings → Data API / API Keys**），取得：

- Project URL，例如 `https://abcdefgh.supabase.co`
- `anon` public key，或新版所稱的 publishable key

這兩個值稍後會放到 Vercel。請勿使用 `service_role` secret key。

## 建立資料庫結構

### 全新 Supabase 專案

在 Supabase Dashboard 開啟 **SQL Editor**，依序執行下列八個檔案的完整內容：

1. [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
2. [`supabase/migrations/002_expense_tags.sql`](supabase/migrations/002_expense_tags.sql)
3. [`supabase/migrations/003_favorite_template_tags.sql`](supabase/migrations/003_favorite_template_tags.sql)
4. [`supabase/migrations/004_currency_default_exchange_rates.sql`](supabase/migrations/004_currency_default_exchange_rates.sql)
5. [`supabase/migrations/005_category_tag_sort_order.sql`](supabase/migrations/005_category_tag_sort_order.sql)
6. [`supabase/migrations/006_tag_active_state.sql`](supabase/migrations/006_tag_active_state.sql)
7. [`supabase/migrations/007_favorite_active_state.sql`](supabase/migrations/007_favorite_active_state.sql)
8. [`supabase/migrations/008_prepaid_amortized_expenses.sql`](supabase/migrations/008_prepaid_amortized_expenses.sql)

每次只執行一個檔案，確認成功後再執行下一個。順序不能顛倒：`002` 至 `004` 建立 Tag 與預設匯率，`005` 至 `007` 建立排序與啟用狀態，`008` 建立預付與攤提的關聯及保護規則。

### 已經使用中的 Supabase 專案

- 不要為了保險而重複執行所有 migration；部分建立資料表或 constraint 的指令無法重複執行。
- 只執行尚未套用的 migration，並先備份重要資料。
- 如果不確定目前版本，可在 **Table Editor** 檢查是否存在 `tags`、`expense_tags`、`favorite_template_tags`，以及 `enabled_currencies.default_exchange_rate_to_twd` 欄位。

完成後，Table Editor 應能看到這些主要資料表：

- `user_settings`
- `enabled_currencies`
- `categories`
- `expenses`
- `favorite_templates`
- `tags`
- `expense_tags`
- `favorite_template_tags`

Migration 也會建立 RLS policy、外鍵、索引與新使用者初始化 trigger。不要為了排錯而關閉 RLS。

## 預付與攤提 migration

已使用本系統並已套用 `001` 至 `007` 的正式專案，只應執行一次 `008_prepaid_amortized_expenses.sql`。這個 migration 是交易式的：任何步驟失敗都會回復本次 schema 變更；但成功後產生的新預付資料不應以手動刪欄方式回復。

執行前：

1. 在 Supabase Dashboard 建立資料庫備份，並另外匯出一份現有帳目的 CSV。
2. 以 SQL Editor 確認舊資料可安全轉為一般帳目：`select count(*) from public.expenses;`。migration 不會修改既有列的付款日期、金額、分類、Tag 或匯率。
3. 暫時不要部署依賴新欄位的網站版本，也不要讓其他人同時修改帳目。

執行時，將 [`008_prepaid_amortized_expenses.sql`](supabase/migrations/008_prepaid_amortized_expenses.sql) 的完整內容貼到 SQL Editor 後一次執行。成功後先確認：

```sql
select expense_type, count(*) from public.expenses group by expense_type;
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'expenses'
  and column_name in ('expense_type', 'parent_expense_id', 'amortization_unit', 'amortization_periods', 'amortization_start_date', 'amortization_sequence');
```

第一個查詢在既有資料庫應只顯示 `general`，且總筆數必須與執行前相同。接著以正式帳號登入網站，建立一筆測試預付、查看父子關聯，再刪除它，確認攤提子帳也一併移除。

若 migration 執行失敗，SQL Editor 會因 transaction 回復本次變更；保留錯誤訊息並停止部署。若 migration 已成功且已有新資料，請使用執行前的資料庫備份復原，而不是手動刪除欄位或關聯，避免遺失已建立的預付帳目。

## 設定登入與私人帳號

### 建立自己的帳號

1. 到 Supabase **Authentication → Users**。
2. 使用管理介面的新增使用者功能建立自己的 Email／密碼帳號。
3. 如果介面提供自動確認 Email 的選項，可直接確認這個由管理員建立的私人帳號。
4. 建立完成後，migration 中的 trigger 會替帳號初始化 `user_settings` 與 TWD 幣別。

如果帳號在執行 `001_initial_schema.sql` 之前就已存在，該 migration 最後也包含補建初始化資料的指令。

### 關閉公開註冊

到 **Authentication → Providers → Email**，關閉 **Allow new users to sign up**，但保留 Email provider 與 Email／密碼登入。

這個網站是私人帳本，正式環境不應允許陌生人自行註冊。日後若要增加使用者，請由 Supabase Dashboard 管理員手動建立。

## 部署到 Vercel

1. 登入 [Vercel Dashboard](https://vercel.com/dashboard)。
2. 選擇 **Add New → Project**。
3. 匯入此專案的 GitHub repository。
4. Framework Preset 應自動辨識為 **Next.js**。
5. 如果 repository 根目錄就是本專案，不需要修改 Root Directory。
6. 建議在 Vercel 專案設定確認 Node.js 使用 22.x。
7. 在 **Environment Variables** 新增下列三個變數：

```env
NEXT_PUBLIC_DATA_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

請把範例值換成自己的 Supabase Project URL 與 public key。

環境範圍建議：

| 變數 | Production | Preview | Development |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_DATA_BACKEND` | 必須 | 建議 | 本機要測 Supabase 時才需要 |
| `NEXT_PUBLIC_SUPABASE_URL` | 必須 | 建議 | 本機要測 Supabase 時才需要 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 必須 | 建議 | 本機要測 Supabase 時才需要 |

如果 Preview 與 Production 共用同一個 Supabase 專案，Preview 操作的會是正式資料。較嚴謹的做法是為 Preview 準備獨立的 Supabase 專案；若只有自己使用，也可以只在 Production 設定這些變數。

8. 按下 **Deploy**。
9. 等待 Vercel 完成 Install、Build 與 Deployment。
10. 記下 Vercel 提供的正式網域，例如 `https://your-project.vercel.app`。

如果部署後才修改環境變數，必須到 **Deployments** 對最新版本執行 Redeploy，或重新 push 一個 commit；已完成的 deployment 不會自動套用後來新增的環境變數。

## 設定 Supabase 網址

Vercel 部署完成後，回到 Supabase **Authentication → URL Configuration**。

### Site URL

設為正式網站首頁：

```text
https://your-project.vercel.app
```

若有自訂網域，應改用自訂網域，例如：

```text
https://accounting.example.com
```

### Redirect URLs

至少加入正式環境的密碼重設頁：

```text
https://your-project.vercel.app/update-password
```

若要在本機測試 Supabase 密碼重設，再加入：

```text
http://localhost:3000/update-password
```

如果使用自訂網域，也要加入：

```text
https://accounting.example.com/update-password
```

本專案會以目前網站來源組成密碼重設網址，因此使用者從哪個網域提出重設，就必須讓該網域的 `/update-password` 出現在 Supabase Redirect URLs 中。

Vercel Preview 每次可能產生不同網址。若需要測試 Preview 的密碼重設，可依 Supabase 的 wildcard 規則加入受限制的 Preview 網域；不要使用範圍過大的萬用 Redirect URL。

## 首次上線驗收

依序確認：

1. 開啟正式網址，未登入時應顯示登入頁，而不是 `/setup` 設定提示。
2. 使用 Supabase 建立的私人帳號登入。
3. 到設定頁新增一個分類。
4. 新增一筆 TWD 帳目。
5. 啟用另一個幣別並新增一筆外幣帳目，確認換算金額正常。
6. 建立 Tag，並套用到帳目與常用項目。
7. 檢查帳目篩選與統計頁。
8. 建立一筆月攤提預付，確認可以查看父子關聯、未到期攤提預設不顯示、預付與攤提不能單筆編輯、且刪除預付會一併刪除子帳。
9. 確認統計頁分別顯示現金流、費用認列、差異與期末預付餘額。
10. 匯出包含預付的 CSV，確認匯出資料包含完整預付家族。
11. 登出後確認無法存取私人帳目。
12. 測試「忘記密碼」，確認郵件連結會回到正式網站的 `/update-password`。
13. 在 Supabase Table Editor 確認資料的 `user_id` 是登入帳號的 UUID。

## 日後更新流程

Vercel 與 GitHub 串接後，推送到 production branch（通常是 `main`）就會自動部署：

```bash
git status
git add <本次修改的檔案>
git commit -m "描述本次修改"
git push origin main
```

推送後：

1. 到 Vercel **Deployments** 查看建置狀態。
2. 等待狀態變成 **Ready**。
3. 開啟正式網址做一次功能確認。
4. 如果 deployment 失敗，先閱讀 Build Logs，不要反覆無修改地 Redeploy。

若版本同時新增 `supabase/migrations` 檔案，應先備份資料，再依檔名順序將新的 migration 套用到 Supabase，並閱讀該版本的相依要求。資料庫與網站程式版本不一致時，可能發生「資料表不存在」或欄位查詢失敗。

## 常見問題

### 部署後進入 `/setup`

通常表示 Vercel 缺少 Supabase 環境變數，或仍保留範例值。

請檢查：

- `NEXT_PUBLIC_DATA_BACKEND` 是否為 `supabase`
- `NEXT_PUBLIC_SUPABASE_URL` 是否為真正的 Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否為真正的 anon／publishable key
- 修改環境變數後是否已重新部署

### 可以登入，但新增或讀取資料失敗

常見原因：

- migration 沒有全部依序執行。
- `002_expense_tags.sql`、`003_favorite_template_tags.sql` 或 `004_currency_default_exchange_rates.sql` 尚未套用。
- RLS policy 被手動修改或刪除。
- 使用者初始化資料缺少 TWD 幣別。

先在 Supabase SQL Editor 與 Table Editor 檢查資料表、policy 與該使用者的 `enabled_currencies`。

### 密碼重設連結回不到網站

請確認 Supabase URL Configuration 已加入提出重設要求之網域的：

```text
/update-password
```

同時檢查 Site URL 是否仍指向舊的 Vercel 網址。

### Vercel 顯示建置失敗

先在本機執行：

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

再比對 Vercel Build Logs。也要確認 Vercel Node.js 版本與 lockfile 沒有衝突。

### 本機有資料，部署後卻看不到

這是正常現象。本機預設使用 `.data/accounting.db` 的 SQLite，而正式環境使用 Supabase，兩者不會自動同步。可利用網站的 CSV 匯出／匯入功能搬移帳目；匯入前請先在正式環境準備好帳號並登入。

### `anon` key 放在 `NEXT_PUBLIC_` 變數安全嗎

Supabase 的 anon／publishable key 本來就會提供給瀏覽器使用，真正的資料保護依賴登入狀態與 RLS。以下項目才是關鍵：

- 絕對不要把 `service_role` secret key 放入 `NEXT_PUBLIC_` 變數。
- 不要關閉 RLS。
- 不要建立允許匿名存取私人資料的 policy。
- 定期檢查 Supabase Security Advisor 的警告。

## 安全與維護建議

- Vercel、GitHub 與 Supabase 帳號都啟用多重要素驗證。
- 資料庫密碼與 secret key 使用密碼管理器保存。
- `.env.local` 不要提交到 Git；本專案的 `.gitignore` 已排除它。
- 執行新 migration 前先備份資料，尤其是包含 `alter table` 或刪除操作的 migration。
- 定期用 CSV 匯出功能保存可攜式帳目備份。
- 刪除帳目是永久操作，正式操作前應確認 CSV 備份可用。
- 發現部署問題時，優先回復上一個可用的 Vercel deployment；資料庫 migration 是否能回復則必須個別評估。

## 快速檢查表

```text
[ ] Supabase 專案已建立
[ ] 已依序執行 001 至 008 migration
[ ] 私人 Email／密碼帳號已建立
[ ] 公開註冊已關閉
[ ] Vercel 三個環境變數已設定
[ ] Vercel Production deployment 顯示 Ready
[ ] Supabase Site URL 已指向正式網站
[ ] /update-password 已加入 Redirect URLs
[ ] 登入、新增分類、一般帳目、預付攤提、Tag、統計、CSV 均已驗證
[ ] 已完成一次 CSV 備份
```
