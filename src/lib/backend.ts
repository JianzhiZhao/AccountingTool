export type DataBackend = "sqlite" | "supabase";

export function getDataBackend(): DataBackend {
  if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_DATA_BACKEND !== "supabase") return "sqlite";
  return "supabase";
}

export const isSqliteDevelopment = () => getDataBackend() === "sqlite";
