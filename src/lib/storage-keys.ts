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
  // Music player
  mood: "huflit_study_mood",
  trackId: "huflit_study_track_id",
  volume: "huflit_study_volume",
  shuffle: "huflit_study_shuffle",
  loop: "huflit_study_loop",
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
  // Favorites
  favoriteScenes: "huflit_study_favorite_scenes",
  favoriteTracks: "huflit_study_favorite_tracks",
  // Focus Mode Integration
  activeFocusTask: "study_space_active_focus_task",
  // Onboarding Tour
  tourCompleted: "zenstudy_tour_completed",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
