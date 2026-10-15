export type MobileNavId = "pomodoro" | "tasks" | "scenes" | "music" | "more";

export interface MobileNavItem {
  id: MobileNavId;
  label: string;
}
