import { DeadlineStatus } from "../types";

export const getDeadlineStatus = (dueDate?: string): DeadlineStatus | null => {
  if (!dueDate) return null;
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = String(today.getMonth() + 1).padStart(2, "0");
  const todayDay = String(today.getDate()).padStart(2, "0");
  const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

  const due = new Date(dueDate + "T00:00:00");
  const now = new Date(todayStr + "T00:00:00");
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const [year, month, day] = dueDate.split("-");
  const formattedShort = `${day}/${month}`;
  const formattedFull = `${day}/${month}/${year}`;

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      status: "overdue",
      label: `Quá hạn ${overdueDays} ngày (${formattedShort})`,
      shortLabel: `Quá hạn ${formattedShort}`,
      badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/30 font-medium",
      isOverdue: true,
      formattedFull,
    };
  } else if (diffDays === 0) {
    return {
      status: "today",
      label: "Hạn hôm nay",
      shortLabel: "Hôm nay",
      badgeClass: "bg-white/15 text-white border-white/20 font-medium",
      isToday: true,
      formattedFull,
    };
  } else if (diffDays === 1) {
    return {
      status: "tomorrow",
      label: `Hạn ngày mai (${formattedShort})`,
      shortLabel: `Mai (${formattedShort})`,
      badgeClass: "bg-white/10 text-slate-200 border-white/15 font-medium",
      isTomorrow: true,
      formattedFull,
    };
  } else {
    return {
      status: "future",
      label: `Hạn: ${formattedShort}/${year}`,
      shortLabel: formattedShort,
      badgeClass: "bg-white/10 text-slate-300 border-white/10",
      formattedFull,
    };
  }
};
