const accountTimeFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

const accountDateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Jakarta",
});

export function formatAccountCreatedAt(dateString?: string | null) {
  if (!dateString) return null;
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    const time = accountTimeFormatter.format(date).replace(/\./g, ":");
    return `Akun ini dibuat pada : ${time} | ${accountDateFormatter.format(date)}`;
  } catch {
    return null;
  }
}
