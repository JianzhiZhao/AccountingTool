import { AnalyticsDashboard } from "@/components/analytics-dashboard";
export const metadata = { title: "統計" };
export default function AnalyticsPage() { return <><header className="mb-6"><p className="mb-1 text-sm font-medium text-moss-700">看懂錢花到哪裡</p><h1 className="page-title">支出統計</h1></header><AnalyticsDashboard /></>; }
