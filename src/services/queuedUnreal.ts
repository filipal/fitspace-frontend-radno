// services/queuedUnreal.ts
import { useCallback, useEffect, useRef } from 'react';
import type {
  FitSpaceCommandData,
  FittingRoomCommandType,
  SendFitSpaceCommand,
} from '../context/PixelStreamingContext';

type UECommand =
  | 'updateMorph'
  | 'updateMorphs'
  | 'rotateCamera'
  | 'zoomCamera'
  | 'moveCamera'
  | 'resetAvatar'
  | 'saveLook'
  | 'updateSkin'
  | 'updateSkinBrightness'
  | 'updateHair'
  | 'updateExtras';

type UECommandPayload<T extends UECommand = UECommand> = FitSpaceCommandData<T>;

type QueuedCommand = {
  [K in UECommand]: {
    cmd: K;
    payload: UECommandPayload<K>;
    label?: string;
  };
}[UECommand];

type UECommandWithoutPayload = Extract<
  FittingRoomCommandType,
  'resetAvatar'
>;

type UECommandWithPayload = Exclude<UECommand, UECommandWithoutPayload>;

const COMMANDS_WITHOUT_PAYLOAD: ReadonlySet<UECommandWithoutPayload> = new Set([
  'resetAvatar',
]);

const isCommandWithoutPayload = (cmd: UECommand): cmd is UECommandWithoutPayload =>
  COMMANDS_WITHOUT_PAYLOAD.has(cmd as UECommandWithoutPayload);

export function useQueuedUnreal(
  sendFitSpaceCommand: SendFitSpaceCommand,
  connectionState: 'connected' | 'connecting' | 'disconnected',
  throttleMs = 50
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<QueuedCommand | null>(null);

  const dispatchToUnreal = useCallback(
    (command: QueuedCommand) => {
      if (isCommandWithoutPayload(command.cmd)) {
        sendFitSpaceCommand(command.cmd);
        return;
      }

      if (command.payload === undefined) {
        console.warn('Missing payload for Unreal command that requires it', command);
        return;
      }

      sendFitSpaceCommand(
        command.cmd as UECommandWithPayload,
        command.payload as UECommandPayload<UECommandWithPayload>
      );
    },
    [sendFitSpaceCommand]
  );

  const send = useCallback(
    <T extends UECommand>(cmd: T, payload?: UECommandPayload<T>, label = 'update') => {
      if (!isCommandWithoutPayload(cmd) && payload === undefined) {
        console.warn('Skipping Unreal command because payload is required', { cmd, label });
        return;
      }

      const normalizedPayload = (payload ?? undefined) as UECommandPayload<T>;
      const queuedCommand = {
        cmd,
        payload: normalizedPayload,
        label,
      } as QueuedCommand;
      if (connectionState !== 'connected') {
        pendingRef.current = queuedCommand;
        console.info(`Queued ${label} until connection resumes`, {
          cmd,
          payload: normalizedPayload,
          connectionState,
        });
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      const current = queuedCommand;
      timerRef.current = setTimeout(() => {
        const toSend = pendingRef.current ?? current;
        dispatchToUnreal(toSend);
        console.log(`Sent ${toSend.label} to Unreal`, toSend);
        pendingRef.current = null;
      }, throttleMs);
    },
    [connectionState, dispatchToUnreal, throttleMs]
  );

  useEffect(() => {
    if (connectionState === 'connected' && pendingRef.current) {
      const { cmd, payload, label } = pendingRef.current;
      dispatchToUnreal({ cmd, payload, label } as QueuedCommand);
      console.log(`Flushed queued ${label} after reconnect`, { cmd, payload });
      pendingRef.current = null;
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [connectionState, dispatchToUnreal]);

  return send;
}
