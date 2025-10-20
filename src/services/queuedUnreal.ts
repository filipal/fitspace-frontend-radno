// services/queuedUnreal.ts
import { useCallback, useEffect, useRef } from 'react';

type UECommand =
  | 'updateMorph'
  | 'updateMorphs'
  | 'configureAvatar'
  | 'rotateCamera'
  | 'zoomCamera'
  | 'moveCamera'
  | 'resetAvatar'
  | 'saveLook';

type UECommandPayload = Record<string, unknown> | undefined

export function useQueuedUnreal(
  sendFitSpaceCommand: (cmd: UECommand, payload?: UECommandPayload) => void,
  connectionState: 'connected' | 'connecting' | 'disconnected',
  throttleMs = 50
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<{ cmd: UECommand; payload?: UECommandPayload; label?: string } | null>(null);

  const send = useCallback(
    (cmd: UECommand, payload?: UECommandPayload, label = 'update') => {
      if (connectionState !== 'connected') {
        pendingRef.current = { cmd, payload, label };
        console.info(`Queued ${label} until connection resumes`, { cmd, payload, connectionState });
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      const current = { cmd, payload, label };
      timerRef.current = setTimeout(() => {
        const toSend = pendingRef.current ?? current;
        sendFitSpaceCommand(toSend.cmd, toSend.payload);
        console.log(`Sent ${toSend.label} to Unreal`, toSend);
        pendingRef.current = null;
      }, throttleMs);
    },
    [connectionState, sendFitSpaceCommand, throttleMs]
  );

  useEffect(() => {
    if (connectionState === 'connected' && pendingRef.current) {
      const { cmd, payload, label } = pendingRef.current;
      sendFitSpaceCommand(cmd, payload);
      console.log(`Flushed queued ${label} after reconnect`, { cmd, payload });
      pendingRef.current = null;
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [connectionState, sendFitSpaceCommand]);

  return send;
}
