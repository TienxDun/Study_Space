// B4: Mọi key localStorage của app tập trung ở đây.
// Quy ước: component KHÔNG hardcode string key, luôn dùng STORAGE_KEYS.*
// (bắt bằng grep khi review). Đổi/tái cấu trúc key chỉ sửa 1 file.

export const STORAGE_KEYS = {
  // StudySpace shell (page.tsx)
  sceneId: "huflit_study_scene_id",
  globalMute: "huflit_study_global_mute",
  pomoVisible: "huflit_study_pomo_visible",
  // Clock / pomodoro settings (dùng chung page + PomodoroWidget)
  clockSeconds: "study_clock_show_seconds",
  clock12Hour: "study_clock_12hour",
  stopwatchMs: "study_stopwatch_show_ms",
  pomoDurations: "study_pomodoro_durations",
  soundEnabled: "study_sound_enabled",
  pomoSoundType: "study_pomodoro_sound_type",
  pomoCount: "huflit_study_pomo_count",
  // Giờ đang chạy dở của Pomodoro (để F5 vẫn chạy tiếp, tính theo giờ thật)
  pomoRunningState: "study_pomodoro_running_state_v1",
  // Giờ đang chạy dở của Đồng hồ bấm giờ Stopwatch (để F5/tắt tab mở lại vẫn tiếp tục chuẩn xác)
  stopwatchRunningState: "study_stopwatch_running_state_v1",
  // Music player
  mood: "huflit_study_mood",
  trackId: "huflit_study_track_id",
  volume: "huflit_study_volume",
  shuffle: "huflit_study_shuffle",
  loop: "huflit_study_loop",
  musicAutoplayVisited: "study_space_music_autoplay_visited",
  // Ambient mixer
  ambientVols: "huflit_study_ambient_vols",
  // Tasks kanban
  kanbanBoards: "huflit_study_kanban_boards_v3",
  activeBoard: "huflit_study_active_board_id_v3",
  // Embed player
  customEmbeds: "huflit_study_custom_embeds",
  activeEmbed: "huflit_study_active_embed",
  embedViewMode: "huflit_study_embed_view_mode",
  embedStageTipsDismissed: "huflit_study_embed_stage_tips_dismissed",
  // Notes
  multiNotes: "huflit_study_multi_notes",
  oldNotes: "huflit_study_notes",
  notesTheme: "huflit_study_notes_theme",
  notesCompactPos: "study_space_notes_compact_pos",
  notesCompactSize: "study_space_notes_compact_size",
  embedPipPos: "study_space_pip_pos",
  embedPipSize: "study_space_pip_size",
  // Thẻ gọi video phòng học nhóm
  roomsPos: "study_space_rooms_pos",
  roomsSize: "study_space_rooms_size",
  roomsActiveSession: "study_space_rooms_active_session",
  // Giữ màn hình sáng khi đang học (Wake Lock)
  screenAwake: "study_space_screen_awake",
  // Favorites
  favoriteScenes: "huflit_study_favorite_scenes",
  slideshowEnabled: "huflit_study_slideshow_enabled",
  slideshowIntervalMin: "huflit_study_slideshow_interval_min",
  // Focus Mode Integration
  activeFocusTask: "study_space_active_focus_task",
  // Focus sessions log (ghi nhận thời gian tập trung theo task)
  focusSessions: "study_space_focus_sessions_v1",
  // Quản lý epoch đời của focus sessions theo UID
  focusEpoch: "study_space_focus_epoch",
  // Hàng đợi đẩy focus sessions offline theo UID
  pendingFocusQueue: "study_space_pending_focus_queue",
  // Mốc thời gian máy chủ đồng bộ gần nhất (Delta Sync)
  lastSyncedAt: "study_space_last_synced_at",
  // Onboarding Tour
  tourCompleted: "zenstudy_tour_completed",
  tourQuestState: "zenstudy_tour_quest_state",
  tourQuestMinimized: "zenstudy_tour_quest_minimized",
  tourQuestPos: "zenstudy_tour_quest_pos",
  // Cấu hình chế độ xem Mobile Sheet (Toàn màn hình Zen vs Dạng thu nhỏ/khay đáy)
  mobileSheetZenMap: "study_space_mobile_sheet_zen_map",
  // Màn hình chào mừng Mobile (Chỉ hiện ở lần đầu tiên mở app)
  mobileWelcomeCompleted: "zenstudy_mobile_welcome_completed",
  // Bản catalog nội dung mới nhất tải từ data-api (cache để mở app là có ngay)
  contentCatalog: "study_space_content_catalog_v1",
  // Chat v2 (dev): phiên chat + tuỳ chọn giao diện
  chatV2Sessions: "chat_v2_sessions_v1",
  chatV2Theme: "chat-v2-theme",
  chatV2KeyTier: "chat-v2-key-tier",
  chatV2SidebarOpen: "chat-v2-sidebar-open",
  chatV2RailOpen: "chat-v2-rail-open",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
