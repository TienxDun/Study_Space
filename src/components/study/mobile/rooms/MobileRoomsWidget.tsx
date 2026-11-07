"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/components/study/auth";
import { useStudyRoomSession } from "@/components/study/rooms/hooks/useStudyRoomSession";
import { MobileRoomsSheet } from "../sheets/MobileRoomsSheet";
import { getLiveKitEndpoints } from "@/components/study/rooms/utils/floating-panel";
import type { PomodoroSoundType } from "@/components/study/study-sound";

export interface MobileRoomsWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  onBack?: () => void;
  backLabel?: string;
  soundEnabled?: boolean;
  soundType?: PomodoroSoundType;
}

export const MobileRoomsWidget = memo(function MobileRoomsWidget({
  isOpen,
  onClose,
  onOpen,
  onBack,
  backLabel,
  soundEnabled,
  soundType,
}: MobileRoomsWidgetProps) {
  const {
    user,
    loading: authLoading,
    isSigningIn,
    authError,
    signIn,
    getToken,
  } = useAuth();

  const onCloseRef = useRef(onClose);
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onCloseRef.current = onClose;
    onOpenRef.current = onOpen;
  }, [onClose, onOpen]);
  const stableOnClose = useCallback(() => onCloseRef.current(), []);
  const stableOnOpen = useCallback(() => onOpenRef.current?.(), []);

  const session = useStudyRoomSession({
    user,
    authLoading,
    getToken,
    isOpen,
    stableOnOpen,
    stableOnClose,
  });

  return (
    <MobileRoomsSheet
      isOpen={isOpen}
      onClose={stableOnClose}
      onOpen={stableOnOpen}
      onBack={onBack}
      backLabel={backLabel}
      soundEnabled={soundEnabled}
      soundType={soundType}
      user={user}
      authLoading={authLoading}
      isSigningIn={isSigningIn}
      authError={authError}
      signIn={signIn}
      displayName={session.displayName}
      setDisplayName={session.setDisplayName}
      roomName={session.roomName}
      setRoomName={session.setRoomName}
      openRooms={session.openRooms}
      loadingRooms={session.loadingRooms}
      loadOpenRooms={session.loadOpenRooms}
      handleJoinListed={session.handleJoinListed}
      handleJoin={session.handleJoin}
      canJoin={session.canJoin}
      joining={session.joining}
      error={session.error}
      token={session.token}
      serverUrl={session.serverUrl}
      joinedRoom={session.joinedRoom}
      handleLeave={session.handleLeave}
      exitNotice={session.exitNotice}
      onDismissExitNotice={session.handleDismissExitNotice}
      onRejoinExitNotice={session.handleRejoinFromNotice}
      isAvailable={getLiveKitEndpoints().isAvailable}
      maxParticipants={session.maxParticipants}
      remainingMinutes={session.remainingMinutes}
      quotaStatus={session.quotaStatus}
      sessionMaxMinutes={session.sessionMaxMinutes}
      preJoinConfig={session.preJoinConfig}
      onPreJoinSubmit={session.handlePreJoinSubmit}
      onPreJoinCancel={session.handlePreJoinCancel}
      initialMedia={session.initialMedia}
      handleCopyLobbyInvite={session.handleCopyLobbyInvite}
      userRole={session.userRole}
      isHost={session.isHost}
      isCoHost={session.isCoHost}
      initialIsLocked={session.isRoomLocked}
      initialHasPassword={session.roomHasPassword}
      getIdToken={getToken}
    />
  );
});

MobileRoomsWidget.displayName = "MobileRoomsWidget";
