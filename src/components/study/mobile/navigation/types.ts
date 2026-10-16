export type MobileNavId = "pomodoro" | "tasks" | "notes" | "scenes" | "music" | "more";

export interface MobileNavItem {
  id: MobileNavId;
  label: string;
}
