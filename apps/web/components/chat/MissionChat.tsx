'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import type { AgentMessage, MissionInput, MissionRecord, SpendApprovalRequest } from '@bifrost/shared';
import {
  buildHumanCheckpointAuthorizationMessage,
  buildMissionAuthorizationMessage,
  buildSpendApprovalAuthorizationMessage,
  buildSelectionAuthorizationMessage,
} from '@bifrost/shared';
import {
  answerHumanCheckpoint,
  approveMissionSelection,
  createMission,
  fetchMission,
  fetchMissionMessages,
  rebuildMission,
  resolveSpendApproval,
  resolveApiBaseUrl,
  subscribeToMission,
} from '../../lib/api';
import { reduceMission } from './eventReducer';
import EventStream from './EventStream';
import TreasuryBar from './TreasuryBar';
import ChainFooter from './ChainFooter';
import ChatComposer from './ChatComposer';
import {
  clearIntake,
  initialIntake,
  intakeNext,
  intakeToMissionInput,
  loadIntake,
  saveIntake,
  type IntakeState,
} from '../../lib/intakeFlow';
import TeamReviewSlideOver from './slideOver/TeamReviewSlideOver';
import SpendSlideOver from './slideOver/SpendSlideOver';
import DisputeSlideOver from './slideOver/DisputeSlideOver';
import PreviewIframeModal from './slideOver/PreviewIframeModal';

export type MissionChatMode = 'intake' | 'live';

export interface MissionChatProps {
  mode: MissionChatMode;
  missionId?: string;
}

interface ChatState {
  mission: MissionRecord | null;
  messages: AgentMessage[];
  intake: IntakeState;
  openSlideOver: { kind: 'team' | 'spend' | 'dispute' | null; payload?: { approvalId?: string } };
  openModal: { kind: 'preview' | null; previewUrl?: string; label?: string };
  walletPending: boolean;
  actionError: string | null;
}

function encodeSig(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

export default function MissionChat({ mode, missionId }: MissionChatProps) {
  const router = useRouter();
  const wallet = useWallet();
  const walletModal = useWalletModal();
  const [state, setState] = useState<ChatState>({
    mission: null,
    messages: [],
    intake: initialIntake(),
    openSlideOver: { kind: null },
    openModal: { kind: null },
    walletPending: false,
    actionError: null,
  });
  const patch = useCallback((partial: Partial<ChatState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const cancelledRef = useRef(false);

  // Mount/unmount cleanup flag.
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Hydrate intake from localStorage on mount (intake mode only).
  useEffect(() => {
    if (mode !== 'intake') return;
    const stored = loadIntake();
    if (stored) patch({ intake: stored });
  }, [mode, patch]);

  // WS + initial fetch for live mode.
  useEffect(() => {
    if (mode !== 'live' || !missionId) return;
    if (!resolveApiBaseUrl()) return;
    let active = true;
    const setMissionGuarded = (incoming: MissionRecord) => {
      if (!active || cancelledRef.current) return;
      setState((prev) => {
        const prevLen = prev.mission?.events.length ?? 0;
        if (incoming.events.length < prevLen) return prev;
        return { ...prev, mission: incoming };
      });
    };
    fetchMission(missionId)
      .then((m) => setMissionGuarded(m))
      .catch((err) => patch({ actionError: err instanceof Error ? err.message : 'fetch failed' }));
    fetchMissionMessages(missionId)
      .then((m) => active && !cancelledRef.current && patch({ messages: m }))
      .catch(() => undefined);
    const unsub = subscribeToMission(missionId, {
      onMission: (m) => setMissionGuarded(m),
      onMessages: (msgs) => active && !cancelledRef.current && patch({ messages: msgs }),
    });
    return () => {
      active = false;
      unsub?.();
    };
  }, [mode, missionId, patch]);

  const bubbles = useMemo(() => reduceMission(state.mission, state.messages), [state.mission, state.messages]);

  // ---------- Intake flow ----------
  const onIntakeSubmit = useCallback(
    async (text: string) => {
      const advanced = intakeNext(state.intake, text);
      if (advanced.state.step !== 'ready') {
        patch({ intake: advanced.state });
        saveIntake(advanced.state);
        return;
      }
      patch({ intake: advanced.state });
      saveIntake(advanced.state);
      // ready -> create mission
      if (!wallet.publicKey || !wallet.signMessage) {
        walletModal.setVisible(true);
        return;
      }
      patch({ walletPending: true, actionError: null });
      try {
        const issuedAt = new Date().toISOString();
        const input: MissionInput = intakeToMissionInput(advanced.state, wallet.publicKey.toBase58());
        const message = buildMissionAuthorizationMessage(input, issuedAt);
        const sigBytes = await wallet.signMessage(new TextEncoder().encode(message));
        const created = await createMission(input, { issuedAt, signature: encodeSig(sigBytes) });
        clearIntake();
        patch({ walletPending: false });
        router.replace(`/missions/${created.id}`);
      } catch (err) {
        patch({
          walletPending: false,
          actionError: err instanceof Error ? err.message : 'sign or create failed',
        });
      }
    },
    [state.intake, wallet, walletModal, patch, router],
  );

  const onChipClick = useCallback(
    (label: string) => {
      void onIntakeSubmit(label);
    },
    [onIntakeSubmit],
  );

  // ---------- Action handlers (live) ----------
  const onApproveTeam = useCallback(async () => {
    if (!state.mission) return;
    if (!wallet.publicKey || !wallet.signMessage) {
      walletModal.setVisible(true);
      return;
    }
    patch({ walletPending: true, actionError: null });
    try {
      const chosen = state.mission.selectionProposal?.recommendedAgentIds ?? state.mission.selectedAgentIds ?? [];
      const issuedAt = new Date().toISOString();
      const message = buildSelectionAuthorizationMessage(
        state.mission.id,
        state.mission.input.authorityWallet,
        chosen,
        issuedAt,
      );
      const sigBytes = await wallet.signMessage(new TextEncoder().encode(message));
      const updated = await approveMissionSelection(state.mission.id, chosen, {
        issuedAt,
        signature: encodeSig(sigBytes),
      });
      patch({
        mission: updated,
        openSlideOver: { kind: null },
        walletPending: false,
      });
    } catch (err) {
      patch({
        walletPending: false,
        actionError: err instanceof Error ? err.message : 'team sign failed',
      });
    }
  }, [state.mission, wallet, walletModal, patch]);

  const onAnswerCheckpoint = useCallback(
    async (checkpointId: string, responseText: string) => {
      if (!state.mission) return;
      if (!wallet.publicKey || !wallet.signMessage) {
        walletModal.setVisible(true);
        return;
      }
      patch({ walletPending: true, actionError: null });
      try {
        const issuedAt = new Date().toISOString();
        const message = buildHumanCheckpointAuthorizationMessage(
          state.mission.id,
          state.mission.input.authorityWallet,
          checkpointId,
          responseText,
          issuedAt,
        );
        const sigBytes = await wallet.signMessage(new TextEncoder().encode(message));
        const updated = await answerHumanCheckpoint(state.mission.id, checkpointId, responseText, {
          issuedAt,
          signature: encodeSig(sigBytes),
        });
        patch({ mission: updated, walletPending: false });
      } catch (err) {
        patch({
          walletPending: false,
          actionError: err instanceof Error ? err.message : 'checkpoint sign failed',
        });
      }
    },
    [state.mission, wallet, walletModal, patch],
  );

  const onApproveSpend = useCallback(
    async (approval: SpendApprovalRequest, approve: boolean) => {
      if (!state.mission) return;
      if (!wallet.publicKey || !wallet.signMessage) {
        walletModal.setVisible(true);
        return;
      }
      patch({ walletPending: true, actionError: null });
      try {
        const issuedAt = new Date().toISOString();
        const message = buildSpendApprovalAuthorizationMessage(
          state.mission.id,
          state.mission.input.authorityWallet,
          approval.id,
          approve,
          issuedAt,
        );
        const sigBytes = await wallet.signMessage(new TextEncoder().encode(message));
        const updated = await resolveSpendApproval(state.mission.id, approval.id, approve, {
          issuedAt,
          signature: encodeSig(sigBytes),
        });
        patch({
          mission: updated,
          openSlideOver: { kind: null },
          walletPending: false,
        });
      } catch (err) {
        patch({
          walletPending: false,
          actionError: err instanceof Error ? err.message : 'spend sign failed',
        });
      }
    },
    [state.mission, wallet, walletModal, patch],
  );

  const onRebuild = useCallback(async () => {
    if (!state.mission) return;
    patch({ walletPending: true, actionError: null });
    try {
      const updated = await rebuildMission(state.mission.id);
      patch({ mission: updated, openSlideOver: { kind: null }, walletPending: false });
    } catch (err) {
      patch({
        walletPending: false,
        actionError: err instanceof Error ? err.message : 'rebuild failed',
      });
    }
  }, [state.mission, patch]);

  const openSlideOver = useCallback(
    (kind: 'team' | 'spend' | 'dispute', payload?: { approvalId?: string }) => {
      patch({ openSlideOver: { kind, payload } });
    },
    [patch],
  );
  const closeSlideOver = useCallback(() => patch({ openSlideOver: { kind: null } }), [patch]);
  const openPreviewModal = useCallback(
    (previewUrl: string, label?: string) => patch({ openModal: { kind: 'preview', previewUrl, label } }),
    [patch],
  );
  const closeModal = useCallback(() => patch({ openModal: { kind: null } }), [patch]);

  // Find the active spend approval object for the slide-over.
  const activeSpendApproval = useMemo(() => {
    const id = state.openSlideOver.payload?.approvalId;
    if (!id || !state.mission) return undefined;
    return state.mission.pendingSpendApprovals.find((a) => a.id === id);
  }, [state.openSlideOver, state.mission]);

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        color: 'var(--text)',
      }}
    >
      <TreasuryBar mission={state.mission} />
      <div
        style={{
          flex: 1,
          width: '100%',
          minHeight: 0,
          display: 'flex',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            flex: 1,
            width: '100%',
            maxWidth: 760,
            padding: '24px 20px 12px',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
          }}
        >
          <EventStream
            mission={state.mission}
            bubbles={bubbles}
            intake={state.intake}
            mode={mode}
            walletPending={state.walletPending}
            onChipClick={onChipClick}
            onAnswerCheckpoint={onAnswerCheckpoint}
            onOpenTeamReview={() => openSlideOver('team')}
            onOpenSpend={(approvalId) => openSlideOver('spend', { approvalId })}
            onOpenDispute={() => openSlideOver('dispute')}
            onOpenPreview={openPreviewModal}
            onRebuild={onRebuild}
          />
        </div>
      </div>
      <ChainFooter mission={state.mission} />
      <ChatComposer
        disabled={state.walletPending || (mode === 'live' && !state.mission)}
        placeholder={
          mode === 'intake'
            ? state.intake.step === 'ask_brief'
              ? 'What do you want a Bifrost team to ship?'
              : 'Type your answer or pick a chip…'
            : 'Send a message to the mission'
        }
        onSubmit={mode === 'intake' ? onIntakeSubmit : () => undefined}
        actionLabel={state.intake.step === 'ready' ? 'Sign brief & launch' : 'Send'}
      />
      <TeamReviewSlideOver
        open={state.openSlideOver.kind === 'team'}
        onClose={closeSlideOver}
        mission={state.mission}
        onSign={onApproveTeam}
        signing={state.walletPending}
        error={state.actionError}
      />
      <SpendSlideOver
        open={state.openSlideOver.kind === 'spend'}
        onClose={closeSlideOver}
        approval={activeSpendApproval}
        onDecision={onApproveSpend}
        pending={state.walletPending}
      />
      <DisputeSlideOver
        open={state.openSlideOver.kind === 'dispute'}
        onClose={closeSlideOver}
        mission={state.mission}
        onRebuild={onRebuild}
        rebuilding={state.walletPending}
      />
      <PreviewIframeModal
        open={state.openModal.kind === 'preview'}
        onClose={closeModal}
        previewUrl={state.openModal.previewUrl ?? ''}
        label={state.openModal.label}
      />
      {state.actionError && (
        <div
          role="alert"
          style={{
            position: 'fixed',
            bottom: 100,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 14px',
            borderRadius: 8,
            background: 'oklch(0.16 0.06 30 / 0.85)',
            color: 'var(--text)',
            border: '1px solid var(--danger)',
            fontSize: 12,
            zIndex: 80,
          }}
        >
          {state.actionError}
        </div>
      )}
    </div>
  );
}
