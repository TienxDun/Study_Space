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
  notesCompactMode: "huflit_study_notes_compact_mode",
  notesCompactPos: "study_space_notes_compact_pos",
  notesCompactSize: "study_space_notes_compact_size",
  embedPipPos: "study_space_pip_pos",
  embedPipSize: "study_space_pip_size",
  // Thẻ gọi video phòng học nhóm
  roomsPos: "study_space_rooms_pos",
  roomsSize: "study_space_rooms_size",
  // Giữ màn hình sáng khi đang học (Wake Lock)
  screenAwake: "study_space_screen_awake",
  // Favorites
  favoriteScenes: "huflit_study_favorite_scenes",
  favoriteTracks: "huflit_study_favorite_tracks",
  slideshowEnabled: "huflit_study_slideshow_enabled",
  slideshowIntervalMin: "huflit_study_slideshow_interval_min",
  // Focus Mode Integration
  activeFocusTask: "study_space_active_focus_task",
  // Focus sessions log (ghi nhận thời gian tập trung theo task)
  focusSessions: "study_space_focus_sessions_v1",
  // Onboarding Tour
  tourCompleted: "zenstudy_tour_completed",
  // Cấu hình chế độ xem Mobile Sheet (Toàn màn hình Zen vs Dạng thu nhỏ/khay đáy)
  mobileSheetZenMap: "study_space_mobile_sheet_zen_map",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
