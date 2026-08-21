import { ExpensesManager } from "@/components/expenses-manager";
export const metadata = { title: "帳目" };
export default function ExpensesPage() { return <><header className="mb-6"><p className="mb-1 text-sm font-medium text-moss-700">查找、修改與備份</p><h1 className="page-title">所有帳目</h1></header><ExpensesManager /></>; }
