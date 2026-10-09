import { DeadlineStatus } from "../types";

export const getDeadlineStatus = (dueDate?: string): DeadlineStatus | null => {
  if (!dueDate) return null;

  const hasTime = dueDate.includes("T");
  const [datePart, timePart] = hasTime ? dueDate.split("T") : [dueDate, undefined];
  const [year, month, day] = datePart.split("-");

  if (!year || !month || !day) return null;

  const formattedTime = timePart ? timePart.slice(0, 5) : "";
  const formattedShort = formattedTime ? `${day}/${month} ${formattedTime}` : `${day}/${month}`;
  const formattedFull = formattedTime ? `${day}/${month}/${year} ${formattedTime}` : `${day}/${month}/${year}`;

  const now = new Date();
  const todayYear = now.getFullYear();
  const todayMonth = String(now.getMonth() + 1).padStart(2, "0");
  const todayDay = String(now.getDate()).padStart(2, "0");
  const todayDateStr = `${todayYear}-${todayMonth}-${todayDay}`;

  if (hasTime && formattedTime) {
    const dueDateTime = new Date(`${datePart}T${formattedTime}:00`);
    const diffMs = dueDateTime.getTime() - now.getTime();

    // Đã qua thời điểm deadline
    if (diffMs < 0) {
      const isPastToday = datePart === todayDateStr;
      return {
        status: "overdue",
        label: isPastToday
          ? `Quá hạn lúc ${formattedTime} hôm nay`
          : `Quá hạn (${formattedShort})`,
        shortLabel: isPastToday ? `Quá hạn ${formattedTime}` : `Quá hạn ${formattedShort}`,
        badgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/30 font-medium",
        isOverdue: true,
        formattedFull,
      };
    }

    // Chưa qua deadline trong ngày hôm nay
    if (datePart === todayDateStr) {
      return {
        status: "today",
        label: `Hôm nay lúc ${formattedTime}`,
        shortLabel: `${formattedTime} hôm nay`,
        badgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/30 font-medium",
        isToday: true,
        formattedFull,
      };
    }

    // Ngày mai
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tmrYear = tomorrow.getFullYear();
    const tmrMonth = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const tmrDay = String(tomorrow.getDate()).padStart(2, "0");
    const tmrDateStr = `${tmrYear}-${tmrMonth}-${tmrDay}`;

    if (datePart === tmrDateStr) {
      return {
        status: "tomorrow",
        label: `Mai lúc ${formattedTime} (${day}/${month})`,
        shortLabel: `Mai ${formattedTime}`,
        badgeClass: "bg-white/10 text-slate-200 border-white/15 font-medium",
        isTomorrow: true,
        formattedFull,
      };
    }

    // Tương lai xa hơn
    return {
      status: "future",
      label: `Hạn: ${formattedShort}`,
      shortLabel: formattedShort,
      badgeClass: "bg-white/10 text-slate-300 border-white/10",
      formattedFull,
    };
  }

  // Trường hợp CHỈ CÓ NGÀY (không có giờ)
  const due = new Date(datePart + "T00:00:00");
  const nowDateOnly = new Date(todayDateStr + "T00:00:00");
  const diffTime = due.getTime() - nowDateOnly.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

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
