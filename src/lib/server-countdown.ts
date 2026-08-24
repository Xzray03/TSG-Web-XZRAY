export interface ServerCountdown {
  days: number;
  isToday: boolean;
  isPast: boolean;
}

export function computeServerCountdown(targetDate: string): ServerCountdown {
  const diff = new Date(targetDate).getTime() - Date.now();

  if (diff <= 0) {
    return { days: 0, isToday: true, isPast: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const isToday = days === 0;

  return { days, isToday, isPast: false };
}
