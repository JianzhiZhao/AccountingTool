export function StatusMessage({ message, error = false }: { message: string; error?: boolean }) {
  if (!message) return null;
  return <p role={error ? "alert" : "status"} className={`rounded-2xl p-3 text-sm ${error ? "bg-red-50 text-red-700" : "bg-moss-50 text-moss-700"}`}>{message}</p>;
}
