import { SettingsManager } from "@/components/settings-manager";
export const metadata = { title: "設定" };
export default function SettingsPage() { return <><header className="mb-6"><p className="mb-1 text-sm font-medium text-moss-700">依照你的使用方式調整</p><h1 className="page-title">分類、Tag 與幣別</h1></header><SettingsManager /></>; }
