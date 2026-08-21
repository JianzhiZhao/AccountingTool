import { FavoritesManager } from "@/components/favorites-manager";
export const metadata = { title: "常用項目" };
export default function FavoritesPage() { return <><header className="mb-6"><p className="mb-1 text-sm font-medium text-moss-700">把重複輸入變成一次點選</p><h1 className="page-title">常用項目</h1></header><FavoritesManager /></>; }
