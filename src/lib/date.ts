export function todayInTaipei(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function currentMonthRange(now = new Date()) {
  const today = todayInTaipei(now);
  const [year, month] = today.split("-");
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return { from: `${year}-${month}-01`, to: `${year}-${month}-${String(lastDay).padStart(2, "0")}` };
}

export function formatDateZh(date: string) {
  return new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "short", day: "numeric" })
    .format(new Date(`${date}T12:00:00+08:00`));
}
