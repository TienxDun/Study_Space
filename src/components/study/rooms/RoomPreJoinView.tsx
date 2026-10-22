"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  usePreviewTracks,
  useMediaDeviceSelect,
  MediaDeviceMenu,
} from "@livekit/components-react";
import type { CreateLocalTracksOptions, LocalAudioTrack, LocalVideoTrack } from "livekit-client";
import {
  MicrophoneIcon,
  MicrophoneSlashIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  CircleNotchIcon,
  WarningCircleIcon,
  XIcon,
  SignInIcon,
  UserIcon,
  DoorIcon,
  CaretDownIcon,
  EyeIcon,
  EyeSlashIcon,
  LockKeyIcon,
  KeyIcon,
} from "@phosphor-icons/react";

export interface PreJoinChoices {
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDeviceId?: string;
  videoDeviceId?: string;
  password?: string;
}

interface RoomPreJoinViewProps {
  roomName: string;
  displayName: string;
  onJoin: (choices: PreJoinChoices) => void;
  onCancel: () => void;
  joining?: boolean;
  /**
   * Chế độ mật khẩu:
   * - "required": Phòng đã tồn tại và có mật khẩu -> Bắt buộc nhập
   * - "optional-create": Phòng mới chưa tồn tại -> Tùy chọn đặt mật khẩu (thu gọn mặc định)
   * - "none": Phòng công khai đã tồn tại -> Ẩn hoàn toàn ô mật khẩu
   */
  passwordMode?: "required" | "optional-create" | "none";
  /** Ẩn header nội bộ (khi đã có header của sheet cha, tránh trùng lặp). */
  hideHeader?: boolean;
}

/**
 * Màn hình Pre-join: kiểm tra microphone và camera trước khi chính thức kết nối vào phòng.
 * - Mặc định bật camera để xem trước ngay khi mở màn hình.
 * - Callbacks và options ổn định bằng useCallback/useMemo để ngăn chặn vòng lặp re-render vô hạn.
 * - Tự động tắt cả hai thiết bị (audio & video) nếu quyền bị từ chối, tránh xin quyền lại khi vào phòng.
 * - Trả về audioDeviceId và videoDeviceId đã chọn để phòng học sử dụng đúng thiết bị.
 * - Tự động tắt track khi hủy hoặc unmount (không để đèn camera sáng).
 */
export function RoomPreJoinView({
  roomName,
  displayName,
  onJoin,
  onCancel,
  joining = false,
  passwordMode = "optional-create",
  hideHeader = false,
}: RoomPreJoinViewProps) {
  const [audioEnabled, setAudioEnabled] = useState(false);
  // Mở lên thấy camera ngay để người dùng xem trước theo đúng yêu cầu
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Lưu thiết bị người dùng chủ động chọn qua MediaDeviceMenu
  const [selectedAudioId, setSelectedAudioId] = useState<string | undefined>(undefined);
  const [selectedVideoId, setSelectedVideoId] = useState<string | undefined>(undefined);

  // Callback ổn định để không làm useMediaDeviceSelect re-run ở mỗi render
  const handleDeviceError = useCallback((err: Error) => {
    console.warn("Lỗi thiết bị đầu vào:", err);
  }, []);

  // Danh sách thiết bị đầu vào từ LiveKit hook
  const {
    devices: audioDevices,
    activeDeviceId: activeAudioId,
    setActiveMediaDevice: setActiveAudioDevice,
  } = useMediaDeviceSelect({
    kind: "audioinput",
    onError: handleDeviceError,
  });

  const {
    devices: videoDevices,
    activeDeviceId: activeVideoId,
    setActiveMediaDevice: setActiveVideoDevice,
  } = useMediaDeviceSelect({
    kind: "videoinput",
    onError: handleDeviceError,
  });

  const currentAudioId = selectedAudioId || activeAudioId;
  const currentVideoId = selectedVideoId || activeVideoId;

  const currentAudioLabel =
    audioDevices.find((d) => d.deviceId === currentAudioId)?.label ||
    "Mặc định (Microphone)";
  const currentVideoLabel =
    videoDevices.find((d) => d.deviceId === currentVideoId)?.label ||
    "Mặc định (Camera)";

  // Callback ổn định để usePreviewTracks không bị gọi lại liên tục gây lặp vô hạn và nhấp nháy camera
  const handlePreviewError = useCallback((err: Error) => {
    console.warn("Lỗi truy cập mic/cam khi xem trước:", err);
    setMediaError(
      "Không thể truy cập camera hoặc microphone. Quyền đã bị từ chối; bạn vẫn có thể vào phòng với mic và camera tắt."
    );
    // Tự động tắt cả 2 trạng thái khi bị từ chối quyền, tránh việc vào phòng lại xin quyền/bật lại
    setAudioEnabled(false);
    setVideoEnabled(false);
  }, []);

  // Options ghi nhớ bằng useMemo để không tạo object mới mỗi render
  const previewOptions = useMemo<CreateLocalTracksOptions>(() => {
    return {
      audio: audioEnabled
        ? currentAudioId
          ? { deviceId: currentAudioId }
          : true
        : false,
      video: videoEnabled
        ? currentVideoId
          ? { deviceId: currentVideoId }
          : true
        : false,
    };
  }, [audioEnabled, videoEnabled, currentAudioId, currentVideoId]);

  // Tạo local preview tracks với options và callback ổn định
  const tracks = usePreviewTracks(previewOptions, handlePreviewError);

  const audioTrack = tracks?.find((t) => t.kind === "audio") as LocalAudioTrack | undefined;
  const videoTrack = tracks?.find((t) => t.kind === "video") as LocalVideoTrack | undefined;
  const videoRef = useRef<HTMLVideoElement>(null);

  // Xử lý đổi thiết bị từ MediaDeviceMenu
  const handleAudioDeviceChange = useCallback(
    (_kind: MediaDeviceKind, deviceId: string) => {
      setSelectedAudioId(deviceId);
      setActiveAudioDevice(deviceId);
    },
    [setActiveAudioDevice]
  );

  const handleVideoDeviceChange = useCallback(
    (_kind: MediaDeviceKind, deviceId: string) => {
      setSelectedVideoId(deviceId);
      setActiveVideoDevice(deviceId);
    },
    [setActiveVideoDevice]
  );

  // Gắn track video vào thẻ <video>
  useEffect(() => {
    const el = videoRef.current;
    if (el && videoTrack) {
      videoTrack.attach(el);
      return () => {
        videoTrack.detach();
      };
    }
  }, [videoTrack]);

  // Đảm bảo dừng mọi preview track khi component unmount hoặc hủy
  useEffect(() => {
    return () => {
      tracks?.forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
    };
  }, [tracks]);

  const handleToggleAudio = () => {
    setAudioEnabled((prev) => !prev);
    setMediaError(null);
  };

  const handleToggleVideo = () => {
    setVideoEnabled((prev) => !prev);
    setMediaError(null);
  };

  const handleConfirmJoin = () => {
    // Nếu ở chế độ optional-create nhưng không bật toggle đặt mật khẩu thì không gửi password
    const effectivePassword =
      passwordMode === "required"
        ? password.trim()
        : passwordMode === "optional-create" && isSettingPassword
        ? password.trim()
        : undefined;

    onJoin({
      audioEnabled,
      videoEnabled,
      audioDeviceId: currentAudioId,
      videoDeviceId: currentVideoId,
      password: effectivePassword,
    });
  };

  return (
    <div className="flex flex-col h-full select-none">
      {/* Header */}
      {!hideHeader && (
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-white/10 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white">Kiểm tra thiết bị</h2>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-400/30 shrink-0">
              Bước xem trước
            </span>
          </div>
          <p className="text-xs text-slate-400 truncate">
            Xem lại camera và micro trước khi tham gia
          </p>
        </div>
        <button
          onClick={onCancel}
          disabled={joining}
          className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
          title="Hủy"
        >
          <XIcon className="w-4 h-4" />
        </button>
      </div>
      )}

      {/* Thân Pre-join */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 custom-study-scroll">
        {/* Thông tin phòng & Tên */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-2 min-w-0">
            <DoorIcon className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block">Phòng</span>
              <strong className="text-white font-medium truncate block">{roomName}</strong>
            </div>
          </div>
          <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center gap-2 min-w-0">
            <UserIcon className="w-4 h-4 text-teal-400 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 block">Tên hiển thị</span>
              <strong className="text-white font-medium truncate block">{displayName}</strong>
            </div>
          </div>
        </div>

        {/* Khung xem trước Camera */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-900 border border-white/15 flex items-center justify-center shadow-inner">
          {videoEnabled && videoTrack ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 mb-2">
                <VideoCameraSlashIcon className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-300 font-medium">Camera đang tắt</p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Bật camera bên dưới nếu bạn muốn chia sẻ hình ảnh
              </p>
            </div>
          )}

          {/* Nút bật/tắt nổi trực tiếp trên video */}
          <div className="absolute bottom-2.5 inset-x-0 flex items-center justify-center gap-2.5 pointer-events-auto">
            <button
              type="button"
              onClick={handleToggleAudio}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${
                audioEnabled
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30"
                  : "bg-rose-500/90 hover:bg-rose-500 text-white shadow-rose-500/20"
              }`}
              title={audioEnabled ? "Tắt micro" : "Bật micro"}
            >
              {audioEnabled ? (
                <MicrophoneIcon className="w-5 h-5" weight="bold" />
              ) : (
                <MicrophoneSlashIcon className="w-5 h-5" weight="bold" />
              )}
            </button>

            <button
              type="button"
              onClick={handleToggleVideo}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-lg active:scale-95 ${
                videoEnabled
                  ? "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30"
                  : "bg-rose-500/90 hover:bg-rose-500 text-white shadow-rose-500/20"
              }`}
              title={videoEnabled ? "Tắt camera" : "Bật camera"}
            >
              {videoEnabled ? (
                <VideoCameraIcon className="w-5 h-5" weight="bold" />
              ) : (
                <VideoCameraSlashIcon className="w-5 h-5" weight="bold" />
              )}
            </button>
          </div>
        </div>

        {/* Thông báo lỗi thiết bị (nếu từ chối cấp quyền) */}
        {mediaError && (
          <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-start gap-2.5 text-xs text-amber-200">
            <WarningCircleIcon className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" weight="bold" />
            <p className="leading-relaxed">{mediaError}</p>
          </div>
        )}

        {/* Lựa chọn thiết bị dùng MediaDeviceMenu của @livekit/components-react */}
        <div data-lk-theme="default" className="space-y-3 pt-1">
          <div className="relative">
            <span className="block text-[11px] font-semibold text-slate-300 mb-1">
              Microphone
            </span>
            <MediaDeviceMenu
              kind="audioinput"
              initialSelection={currentAudioId}
              onActiveDeviceChange={handleAudioDeviceChange}
              tracks={{ audioinput: audioTrack }}
              requestPermissions={Boolean(audioTrack)}
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-xs text-white flex items-center justify-between text-left hover:border-white/30 transition-colors cursor-pointer"
            >
              <span className="truncate pr-2">{currentAudioLabel}</span>
              <CaretDownIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </MediaDeviceMenu>
          </div>

          <div className="relative">
            <span className="block text-[11px] font-semibold text-slate-300 mb-1">
              Camera
            </span>
            <MediaDeviceMenu
              kind="videoinput"
              initialSelection={currentVideoId}
              onActiveDeviceChange={handleVideoDeviceChange}
              tracks={{ videoinput: videoTrack }}
              requestPermissions={Boolean(videoTrack)}
              className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/20 text-xs text-white flex items-center justify-between text-left hover:border-white/30 transition-colors cursor-pointer"
            >
              <span className="truncate pr-2">{currentVideoLabel}</span>
              <CaretDownIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </MediaDeviceMenu>
          </div>

          {/* Mật khẩu phòng: Chỉ xuất hiện khi cần thiết */}
          {passwordMode === "required" && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-400/30 space-y-2 animate-fadeIn">
              <span className="block text-[11px] font-semibold text-amber-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>Mật khẩu phòng (Bắt buộc)</span>
                </span>
                <span className="text-[10px] text-amber-400/80 font-normal">Phòng này đã được bảo vệ</span>
              </span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu để vào phòng..."
                  className="w-full px-3 py-2 pr-9 rounded-xl bg-black/60 border border-amber-400/40 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer z-10"
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="w-4 h-4" />
                  ) : (
                    <EyeIcon className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          )}

          {passwordMode === "optional-create" && (
            <div className="space-y-2 pt-1 border-t border-white/10">
              <label className="flex items-center justify-between cursor-pointer select-none group">
                <div className="flex items-center gap-2">
                  <span className="p-1 rounded-lg bg-white/5 border border-white/10 text-slate-400 group-hover:text-emerald-400 transition-colors">
                    <LockKeyIcon className="w-3.5 h-3.5" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold text-slate-300 group-hover:text-white transition-colors">
                      Đặt mật khẩu bảo vệ phòng
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Chỉ những người có mật khẩu mới được vào
                    </p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isSettingPassword}
                  onChange={(e) => {
                    setIsSettingPassword(e.target.checked);
                    if (!e.target.checked) setPassword("");
                  }}
                  className="w-4 h-4 rounded text-emerald-500 bg-black/40 border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer accent-emerald-500"
                />
              </label>

              {isSettingPassword && (
                <div className="relative pt-1 animate-fadeIn">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu cho phòng mới..."
                    className="w-full px-3 py-2 pr-9 rounded-xl bg-black/50 border border-emerald-400/30 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400/60 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-white transition-colors cursor-pointer z-10"
                    title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="w-4 h-4" />
                    ) : (
                      <EyeIcon className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hành động dưới đáy: Hủy & Vào phòng */}
      <div className="p-4 border-t border-white/10 flex items-center justify-end gap-2.5 shrink-0 bg-white/[0.02]">
        <button
          type="button"
          onClick={onCancel}
          disabled={joining}
          className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-40"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={handleConfirmJoin}
          disabled={joining}
          className="px-5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 border border-emerald-400/30 text-emerald-200 text-xs font-bold transition-all cursor-pointer disabled:opacity-40 flex items-center gap-2 shadow-[0_0_15px_rgba(52,211,153,0.15)]"
        >
          {joining ? (
            <>
              <CircleNotchIcon className="w-4 h-4 animate-spin" />
              <span>Đang kết nối...</span>
            </>
          ) : (
            <>
              <SignInIcon className="w-4 h-4" />
              <span>Vào phòng học</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
