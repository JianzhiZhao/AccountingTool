# 小帳本

繁體中文、手機優先的私人雲端記帳網站。支援多幣別與逐筆匯率、完全自訂分類、常用項目、統計圖表，以及版本化 CSV 備份還原。

完整正式環境建置流程請參閱 [Vercel 與 Supabase 部署指南](DEPLOYMENT_GUIDE.md)。

## 本機啟動（SQLite 開發模式）

1. 安裝 Node.js 22.5 以上版本並執行 `npm install`。
2. 執行 `npm run dev`，開啟 `http://localhost:3000`。

開發模式預設使用 Node.js 內建 SQLite，不需要 Supabase、不需要登入，也不需要建立 `.env.local`。第一次操作時會自動建立 `.data/accounting.db`，所有記帳、分類、常用項目、統計與 CSV 功能都可完整測試。

若要清空開發資料，先停止本機伺服器，再刪除 `.data/accounting.db`。`.data` 已列入 `.gitignore`，不會被提交到版本庫。

若希望在本機測試 Supabase 模式，建立 `.env.local` 並設定：

```env
NEXT_PUBLIC_DATA_BACKEND=supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Supabase 正式模式

1. 在 Supabase 建立免費專案。
2. 於 Supabase SQL Editor 依序執行 `001_initial_schema.sql`、`002_expense_tags.sql`、`003_favorite_template_tags.sql`、`004_currency_default_exchange_rates.sql`。
3. 依下方步驟建立私人帳號並關閉公開註冊。

正式建置與 Vercel 部署固定使用 Supabase；SQLite API 在非開發環境會直接停用。

## 建立私人帳號

1. 到 Supabase Dashboard → Authentication → Users，以管理介面建立自己的 Email／密碼帳號。
2. 到 Authentication → Providers → Email，關閉 **Allow new users to sign up**。
3. 保留 Email provider 與密碼重設功能。
4. 在 URL Configuration 加入本機與正式網站網址，並將 `/update-password` 加入允許的 Redirect URLs。

資料表已啟用 Row Level Security；匿名使用者沒有資料表權限，登入者只能讀寫 `user_id` 等於自己的資料。請勿將 `service_role` 金鑰放入任何 `NEXT_PUBLIC_` 環境變數。

## 部署到 Vercel

1. 將專案推送至私人 Git 儲存庫並匯入 Vercel。
2. 在 Vercel Project Settings → Environment Variables 設定 `NEXT_PUBLIC_DATA_BACKEND=supabase`、`NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
3. 部署完成後，將正式網址加入 Supabase 的 Site URL 與 Redirect URLs。
4. 執行 `npm run build`、`npm test` 與 `npm run typecheck` 作為部署前檢查。

## CSV 規則

- 僅接受本站匯出的 `private-accounting-tool-v1` 格式。
- 匯入前會預覽有效、重複與錯誤列；相同帳目 ID 永遠跳過，不覆寫既有資料。
- 缺少的分類會自動建立，檔案使用的支援幣別會自動啟用。
- 匯出內容依帳目頁目前的篩選結果產生。
