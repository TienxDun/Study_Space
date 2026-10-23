"use client";

import { StudySproutMascot } from "../chat/components/StudySproutMascot";
import {
  ImageIcon,
  MusicNotesIcon,
  CloudRainIcon,
  RadioIcon,
  TimerIcon,
  CheckSquareIcon,
  FileTextIcon,
  UsersIcon,
  EyeSlashIcon,
} from "@phosphor-icons/react";
import type { FeatureGroup, QuestTask } from "./types";

export const TOUR_GROUPS: FeatureGroup[] = [
  {
    id: "ambience-audio",
    categoryTitle: "Không gian & Âm thanh thư giãn",
    categoryBadge: "Bối cảnh & Giai điệu",
    categorySubtitle:
      "Tạo cảm hứng và không gian êm dịu giúp bạn nhanh chóng bước vào trạng thái tập trung sâu.",
    features: [
      {
        id: "scenes",
        title: "Đổi không gian bối cảnh",
        shortcut: "B",
        description:
          "Hơn 40 khung cảnh tĩnh và động: quán cafe, đêm mưa, thư viện cổ.",
        icon: <ImageIcon className="w-5 h-5 text-sky-400" />,
      },
      {
        id: "music",
        title: "Kho nhạc Lofi & Âm lượng",
        shortcut: "P",
        description:
          "Tuyển tập nhạc Lofi Chill, Piano và Jazz không lời giúp tăng tập trung.",
        icon: <MusicNotesIcon className="w-5 h-5 text-emerald-400" />,
      },
      {
        id: "mixer",
        title: "Bộ trộn âm thanh thiên nhiên",
        shortcut: "P",
        description:
          "Hòa trộn hơn 20 âm thanh thiên nhiên: mưa rào, sóng biển, chim hót.",
        icon: <CloudRainIcon className="w-5 h-5 text-teal-400" />,
      },
      {
        id: "embed",
        title: "Đài phát YouTube & Spotify",
        shortcut: "E",
        description:
          "Phát trực tiếp luồng nhạc từ YouTube, Spotify và thu nhỏ gọn ở góc.",
        icon: <RadioIcon className="w-5 h-5 text-rose-400" />,
      },
    ],
  },
  {
    id: "productivity-tools",
    categoryTitle: "Bộ công cụ tập trung & Năng suất",
    categoryBadge: "Quản lý thời gian",
    categorySubtitle:
      "Rèn luyện tính kỷ luật, theo dõi tiến độ công việc và ghi lại các ý tưởng quan trọng.",
    features: [
      {
        id: "pomodoro",
        title: "Đồng hồ hẹn giờ Pomodoro",
        shortcut: "T",
        description:
          "Học tập trung 25 phút và nghỉ ngắn 5 phút giúp não bộ luôn sảng khoái.",
        icon: <TimerIcon className="w-5 h-5 text-emerald-400" />,
      },
      {
        id: "tasks",
        title: "Kế hoạch học tập Kanban",
        shortcut: "K",
        description:
          "Bảng thẻ kéo thả trực quan giúp theo dõi tiến độ công việc dễ dàng.",
        icon: <CheckSquareIcon className="w-5 h-5 text-amber-400" />,
      },
      {
        id: "notes",
        title: "Sổ ghi chép nhanh",
        shortcut: "N",
        description:
          "Soạn thảo ghi chú Markdown nhanh, ghim cố định tiện lợi trên màn hình.",
        icon: <FileTextIcon className="w-5 h-5 text-indigo-400" />,
      },
    ],
  },
  {
    id: "connection-mastery",
    categoryTitle: "Kết nối & Trải nghiệm chuyên sâu",
    categoryBadge: "Cộng đồng & Tối ưu",
    categorySubtitle:
      "Cùng học với bạn bè, đồng hành cùng trợ lý AI và tối ưu hóa không gian hiển thị.",
    features: [
      {
        id: "rooms",
        title: "Phòng học nhóm trực tuyến",
        shortcut: "G",
        description:
          "Học cùng bạn bè và đồng bộ Pomodoro để cùng nhau giữ vững động lực.",
        icon: <UsersIcon className="w-5 h-5 text-cyan-400" />,
      },
      {
        id: "chat",
        title: "Trợ lý học tập AI ZenBot",
        shortcut: "C",
        description:
          "Trợ lý thông minh giải đáp thắc mắc, tóm tắt và gợi ý lộ trình học.",
        icon: (
          <div className="w-5 h-5 flex items-center justify-center scale-90">
            <StudySproutMascot size={22} />
          </div>
        ),
      },
      {
        id: "zen-shortcuts",
        title: "Chế độ Zen & Bảng phím tắt",
        shortcut: "Z / ?",
        description:
          "Phím Z ẩn sạch công cụ để tập trung sâu, phím ? mở danh mục phím tắt.",
        icon: <EyeSlashIcon className="w-5 h-5 text-purple-400" />,
      },
    ],
  },
];

// ============================================================================
// ĐỊNH NGHĨA 4 NHIỆM VỤ LÀM QUEN (KIỂU C)
// ============================================================================


export const QUEST_TASKS: QuestTask[] = [
  {
    id: "quest-scene",
    title: "Đổi 1 bối cảnh học tập",
    shortcut: "B",
    hint: "Chọn quán cafe hoặc đêm mưa",
    icon: <ImageIcon className="w-4 h-4 text-sky-400" />,
  },
  {
    id: "quest-mixer",
    title: "Bật âm thanh thiên nhiên",
    shortcut: "P",
    hint: "Mở tiếng mưa rơi hoặc sóng biển",
    icon: <CloudRainIcon className="w-4 h-4 text-teal-400" />,
  },
  {
    id: "quest-pomodoro",
    title: "Khởi động Pomodoro 25p",
    shortcut: "T",
    hint: "Đặt mục tiêu cho buổi học",
    icon: <TimerIcon className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: "quest-chat",
    title: "Trò chuyện với ZenBot AI",
    shortcut: "C",
    hint: "Hỏi bí quyết học tập trung",
    icon: (
      <div className="w-4 h-4 flex items-center justify-center scale-75">
        <StudySproutMascot size={18} />
      </div>
    ),
  },
];
