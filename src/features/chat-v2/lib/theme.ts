import { STORAGE_KEYS } from "@/lib/storage-keys";

export type ChatV2Theme = "dark" | "light";

export const DEFAULT_CHAT_V2_THEME: ChatV2Theme = "dark";

// Giữ khớp với --chat-bg trong src/app/styles/chat-v2.css.
export const CHAT_V2_THEME_COLORS: Record<ChatV2Theme, string> = {
  dark: "#070a11",
  light: "#f4f6f5",
};

// Màu theme-color mặc định của app (root viewport).
export const APP_THEME_COLOR = "#090d16";

export const CHAT_V2_ROUTE = "/dev/chat-v2";

// Chạy đồng bộ trong <head> để <html> có theme và trạng thái panel đúng trước frame đầu tiên.
export function buildChatV2BootScript() {
  return (
    `(function(){try{` +
    `if(location.pathname.indexOf(${JSON.stringify(CHAT_V2_ROUTE)})===-1)return;` +
    `var t=localStorage.getItem(${JSON.stringify(STORAGE_KEYS.chatV2Theme)});` +
    `if(t!=="light"&&t!=="dark")t=${JSON.stringify(DEFAULT_CHAT_V2_THEME)};` +
    `var b=t==="light"?${JSON.stringify(CHAT_V2_THEME_COLORS.light)}:${JSON.stringify(CHAT_V2_THEME_COLORS.dark)};` +
    `var r=document.documentElement;` +
    `r.setAttribute("data-chat-theme",t);r.style.colorScheme=t;` +
    `var m=document.querySelector('meta[name="theme-color"]');` +
    `if(m)m.setAttribute("content",b);` +
    `r.setAttribute("data-chat-sidebar",localStorage.getItem(${JSON.stringify(STORAGE_KEYS.chatV2SidebarOpen)})==="0"?"0":"1");` +
    `r.setAttribute("data-chat-rail",localStorage.getItem(${JSON.stringify(STORAGE_KEYS.chatV2RailOpen)})==="0"?"0":"1");` +
    `}catch(e){}})();`
  );
}
