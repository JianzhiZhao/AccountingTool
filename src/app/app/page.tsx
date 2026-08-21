import { ExpenseForm } from "@/components/expense-form";
export const metadata = { title: "快速記帳" };
export default function AddExpensePage() { return <><header className="mb-6"><p className="mb-1 text-sm font-medium text-moss-700">今天花了什麼？</p><h1 className="page-title">快速記一筆</h1></header><ExpenseForm /></>; }
