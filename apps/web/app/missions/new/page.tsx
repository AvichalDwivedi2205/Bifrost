'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useBifrostWalletModal as useWalletModal } from '@/components/wallet-modal';
import {
  buildMissionAuthorizationMessage,
  type ExecutionMode,
  type MissionInput,
  type MissionUrgency,
  type VerificationMode,
} from '@bifrost/shared';
import { Shell } from '@/components/ui/shell';
import { Card, Btn, Pill, WalletAddr } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/icons';
import { createMission, resolveApiBaseUrl } from '@/lib/api';

// ── Local helpers ─────────────────────────────────────────────────────────────

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 'var(--text-caption)', color: 'var(--text-dim)',
      textTransform: 'uppercase', letterSpacing: '0.06em',
      fontWeight: 500, marginBottom: 6, ...style,
    }}>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
        background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
        color: active ? 'var(--accent)' : 'var(--text-muted)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--hairline)'}`,
        fontSize: 'var(--text-small)', fontFamily: 'inherit', textTransform: 'capitalize',
        transition: 'all 0.15s', fontWeight: 500,
      }}
    >
      {children}
    </button>
  );
}

function SummaryRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0', borderBottom: '1px solid var(--hairline)',
    }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>{k}</span>
      <span style={{ color: 'var(--text)', fontSize: 'var(--text-small)', fontWeight: 500 }}>{v}</span>
    </div>
  );
}

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 10, resize: 'vertical',
  background: 'var(--surface-2)', border: '1px solid var(--hairline)', color: 'var(--text)',
  fontFamily: 'inherit', fontSize: 'var(--text-small)', lineHeight: 1.5, outline: 'none',
  boxSizing: 'border-box',
};

const numberInputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 10,
  background: 'var(--surface-2)', border: '1px solid var(--hairline)', color: 'var(--text)',
  fontFamily: 'var(--font-mono)', fontSize: 'var(--text-small)', outline: 'none',
};

// ── Template data ─────────────────────────────────────────────────────────────

const TEMPLATES = [
  'Launch a Landing Page',
  'Wallet Hygiene Check',
  'DAO Treasury Spend Review',
  'Stablecoin Rent Split',
  'Merchant POS Reconciliation',
  'Prediction Market Research',
  'Custom',
] as const;

type TemplateName = (typeof TEMPLATES)[number];

const TEMPLATE_COPY: Record<TemplateName, { objective: string; success: string }> = {
  'Launch a Landing Page': {
    objective: 'Launch a landing page for my AI SDR tool for dentists. Budget $120. Buy a domain if it is under $15. Ask me before any spend. I want a live site, waitlist form, and three launch posts by the end.',
    success: 'A launch mission completes with approved agent team, human positioning checkpoint, spend approval, preview URL, live URL, working waitlist endpoint, three launch posts, proof, and settlement.',
  },
  'Wallet Hygiene Check': {
    objective: 'Check my Solana wallet for risky approvals, suspicious counterparties, recurring charges, and stablecoin spend exposure before I fund new agent work.',
    success: 'Wallet hygiene report with risk flags, receipt-backed tool calls, recommended actions, and verifier-signed proof.',
  },
  'DAO Treasury Spend Review': {
    objective: 'Review a DAO treasury payout request for budget fit, service allowlist, recipient risk, and settlement readiness.',
    success: 'Treasury control report with approval recommendation, spend caps, receipt requirements, and verifier proof.',
  },
  'Stablecoin Rent Split': {
    objective: 'Create a stablecoin rent split plan with roommate IOUs, due dates, payment receipts, and refund handling.',
    success: 'Rent split artifact with participant amounts, payment evidence requirements, and settlement-ready receipt plan.',
  },
  'Merchant POS Reconciliation': {
    objective: 'Reconcile Solana Pay merchant receipts against orders, refunds, and loyalty reward obligations.',
    success: 'Matched receipt report with unresolved payments, refund notes, and verifier-signed reconciliation proof.',
  },
  'Prediction Market Research': {
    objective: 'Identify event-driven prediction market opportunities with news context, market depth, skeptic review, and no forced trade.',
    success: 'Ranked markets, risk notes, skeptic verdict, and verifier-signed proof.',
  },
  Custom: {
    objective: '',
    success: '',
  },
};

// Approximate agent count per template — shown in right rail
const TEMPLATE_AGENTS: Record<TemplateName, number | null> = {
  'Launch a Landing Page': 6,
  'Wallet Hygiene Check': 4,
  'DAO Treasury Spend Review': 3,
  'Stablecoin Rent Split': 3,
  'Merchant POS Reconciliation': 4,
  'Prediction Market Research': 5,
  Custom: null,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function NewMissionPage() {
  const router = useRouter();
  const { connected, connecting, publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();

  // Wizard step
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form state — field names kept identical to the original for payload compat
  const [template, setTemplate] = useState<TemplateName>('Wallet Hygiene Check');
  const [objective, setObjective] = useState(TEMPLATE_COPY['Wallet Hygiene Check'].objective);
  const [success, setSuccess] = useState(TEMPLATE_COPY['Wallet Hygiene Check'].success);
  const [urgency, setUrgency] = useState('high');
  const [mode, setMode] = useState('guarded autonomy');
  const [verify, setVerify] = useState('hybrid');
  const [budget, setBudget] = useState(12);
  const [maxCall, setMaxCall] = useState(0.5);
  const [productName, setProductName] = useState('RecallReady AI');
  const [oneLineIdea, setOneLineIdea] = useState('An AI SDR that helps dentists convert missed calls and stale leads into booked appointments.');
  const [targetAudience, setTargetAudience] = useState('independent dental practices');
  const [primaryCTA, setPrimaryCTA] = useState('Join the waitlist');
  const [brandTone, setBrandTone] = useState('confident, clinical, helpful');
  const [domainBudgetCap, setDomainBudgetCap] = useState(15);
  const [allowDomainPurchase, setAllowDomainPurchase] = useState(true);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const selectTemplate = (t: TemplateName) => {
    setTemplate(t);
    const copy = TEMPLATE_COPY[t];
    if (t !== 'Custom') {
      setObjective(copy.objective);
      setSuccess(copy.success);
    }
    if (t === 'Launch a Landing Page') {
      setBudget(120);
      setMaxCall(1.5);
      setVerify('hybrid');
      setMode('guarded autonomy');
    }
  };

  const encodeBase64 = (value: Uint8Array) => btoa(String.fromCharCode(...value));

  const templateId = template === 'Launch a Landing Page'
    ? 'launch-site-v1'
    : template.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const modeId = mode.replaceAll(' ', '_') as ExecutionMode;

  const walletShort = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
    : null;

  // Demo auto-fill
  const runDemo = () => {
    selectTemplate('Launch a Landing Page');
    setProductName('RecallReady AI');
    setOneLineIdea('An AI SDR that helps dentists convert missed calls and stale leads into booked appointments.');
    setTargetAudience('independent dental practices');
    setPrimaryCTA('Join the waitlist');
    setBrandTone('confident, clinical, helpful');
    setDomainBudgetCap(15);
    setAllowDomainPurchase(true);
    setBudget(120);
    setMaxCall(1.5);
    const baseUrl = resolveApiBaseUrl();
    if (!baseUrl) {
      router.push('/missions/mission-demo-1');
    }
  };

  // Submit / sign flow
  const handleLaunch = async () => {
    setSubmitError(null);

    if (!connected) {
      setVisible(true);
      return;
    }
    if (!publicKey || !signMessage) {
      setSubmitError('Connected wallet must support message signing.');
      return;
    }

    const missionInput: MissionInput = {
      title: `${template} Mission`,
      template: templateId,
      description: objective,
      objective,
      successCriteria: success,
      authorityWallet: publicKey.toBase58(),
      urgency: urgency as MissionUrgency,
      executionMode: modeId,
      verificationMode: verify as VerificationMode,
      maxBudget: budget,
      maxPerCall: maxCall,
      humanApprovalAbove: 0,
      challengeWindowHours: 24,
      ...(templateId === 'launch-site-v1'
        ? {
            templateConfig: {
              productName,
              oneLineIdea,
              targetAudience,
              primaryCTA,
              brandTone,
              mustHaveSections: ['hero', 'problem', 'workflow', 'benefits', 'faq', 'waitlist'],
              domainBudgetCap,
              allowDomainPurchase,
              launchChannels: ['LinkedIn', 'X', 'Founder community'],
              referenceSites: [],
              assetsProvided: [],
            },
          }
        : {}),
    };

    setIsSubmitting(true);
    try {
      const baseUrl = resolveApiBaseUrl();
      if (!baseUrl) {
        router.push('/missions/mission-demo-1');
        return;
      }

      const issuedAt = new Date().toISOString();
      const message = buildMissionAuthorizationMessage(missionInput, issuedAt);
      const signatureBytes = await signMessage(new TextEncoder().encode(message));
      const mission = await createMission(missionInput, {
        issuedAt,
        signature: encodeBase64(signatureBytes),
      });
      router.push(`/missions/${mission.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Mission launch failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Validation per step ───────────────────────────────────────────────────────

  const step1Valid = objective.trim().length > 0;
  const step2Valid = budget > 0;
  const step3Valid = connected;

  // ── Policy options ────────────────────────────────────────────────────────────

  const URGENCIES = ['critical', 'high', 'medium', 'low'] as const;
  const MODES = [
    { id: 'manual assist', desc: 'Operator approves each agent step.' },
    { id: 'guarded autonomy', desc: 'Agents run; spends require signed approval.' },
    { id: 'full autonomy', desc: 'Agents run to completion within policy caps.' },
  ] as const;
  const VERIFIES = ['human', 'hybrid', 'proof', 'agent'] as const;

  // ── Step cards ────────────────────────────────────────────────────────────────

  const stepCard = () => {
    if (step === 1) {
      return (
        <Card>
          {/* Templates */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <div style={{ fontSize: 'var(--text-h2)', fontWeight: 500, marginBottom: 4 }}>Define the mission</div>
            <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
              Choose a template and describe what you want the agent team to accomplish.
            </div>
            <Label>Mission template</Label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TEMPLATES.map(t => (
                <Chip key={t} active={t === template} onClick={() => selectTemplate(t)}>{t}</Chip>
              ))}
            </div>
          </div>

          {/* Objective */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <Label>Objective</Label>
            <textarea
              value={objective}
              onChange={e => setObjective(e.target.value)}
              rows={3}
              placeholder="What should the agent team achieve?"
              style={textareaStyle}
            />
            {!step1Valid && (
              <div style={{ fontSize: 'var(--text-caption)', color: 'var(--danger)', marginTop: 4 }}>
                Objective is required to continue.
              </div>
            )}
          </div>

          {template === 'Launch a Landing Page' && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <Label>Launch brief</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input
                  value={productName}
                  onChange={e => setProductName(e.target.value)}
                  placeholder="Product name"
                  style={numberInputStyle}
                />
                <input
                  value={targetAudience}
                  onChange={e => setTargetAudience(e.target.value)}
                  placeholder="Target audience"
                  style={numberInputStyle}
                />
                <input
                  value={primaryCTA}
                  onChange={e => setPrimaryCTA(e.target.value)}
                  placeholder="Primary CTA"
                  style={numberInputStyle}
                />
                <input
                  value={brandTone}
                  onChange={e => setBrandTone(e.target.value)}
                  placeholder="Brand tone"
                  style={numberInputStyle}
                />
              </div>
              <textarea
                value={oneLineIdea}
                onChange={e => setOneLineIdea(e.target.value)}
                rows={2}
                placeholder="One-line product idea"
                style={{ ...textareaStyle, marginTop: 10 }}
              />
            </div>
          )}

          {/* Success criteria */}
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <Label>Success criteria</Label>
            <textarea
              value={success}
              onChange={e => setSuccess(e.target.value)}
              rows={3}
              placeholder="How do you know when the mission is complete?"
              style={textareaStyle}
            />
          </div>

          {/* Step nav */}
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Btn
              variant="default"
              size="md"
              icon="arrow"
              disabled={!step1Valid}
              onClick={() => step1Valid && setStep(2)}
              style={step1Valid ? {
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                border: '1px solid var(--accent)',
              } : undefined}
            >
              Continue
            </Btn>
          </div>
        </Card>
      );
    }

    if (step === 2) {
      return (
        <Card>
          <div style={{ fontSize: 'var(--text-h2)', fontWeight: 500, marginBottom: 4 }}>Set the policy</div>
          <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
            Configure autonomy, verification, and budget constraints enforced by the on-chain allocation.
          </div>

          {/* Urgency */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <Label>Urgency</Label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {URGENCIES.map(u => (
                <Chip key={u} active={u === urgency} onClick={() => setUrgency(u)}>{u}</Chip>
              ))}
            </div>
          </div>

          {/* Execution mode */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <Label>Execution mode</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              {MODES.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  style={{
                    textAlign: 'left', padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                    background: m.id === mode ? 'var(--accent-soft)' : 'var(--surface-2)',
                    border: `1px solid ${m.id === mode ? 'var(--accent)' : 'var(--hairline)'}`,
                    color: 'var(--text)', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontSize: 'var(--text-small)', fontWeight: 500, marginBottom: 4, textTransform: 'capitalize' }}>{m.id}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Verification mode */}
          <div style={{ marginBottom: 'var(--space-3)' }}>
            <Label>Verification mode</Label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {VERIFIES.map(v => (
                <Chip key={v} active={v === verify} onClick={() => setVerify(v)}>{v}</Chip>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 'var(--space-4)' }}>
            <div>
              <Label>Total budget (USDC)</Label>
              <input
                type="number"
                value={budget}
                onChange={e => setBudget(+e.target.value)}
                style={numberInputStyle}
              />
              {!step2Valid && (
                <div style={{ fontSize: 'var(--text-caption)', color: 'var(--danger)', marginTop: 4 }}>
                  Budget must be greater than 0.
                </div>
              )}
            </div>
            <div>
              <Label>Max per call (USDC)</Label>
              <input
                type="number"
                value={maxCall}
                onChange={e => setMaxCall(+e.target.value)}
                style={numberInputStyle}
              />
            </div>
            <div>
              <Label>Approval trigger</Label>
              <input
                type="text"
                value="every spend"
                disabled
                style={{ ...numberInputStyle, color: 'var(--text-dim)', cursor: 'not-allowed' }}
              />
            </div>
          </div>

          {template === 'Launch a Landing Page' && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              marginBottom: 'var(--space-4)',
              padding: 14,
              borderRadius: 10,
              background: 'var(--surface-2)',
              border: '1px solid var(--hairline)',
            }}>
              <div>
                <Label>Domain cap (USD)</Label>
                <input
                  type="number"
                  value={domainBudgetCap}
                  onChange={e => setDomainBudgetCap(+e.target.value)}
                  style={numberInputStyle}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 13, paddingTop: 22 }}>
                <input
                  type="checkbox"
                  checked={allowDomainPurchase}
                  onChange={e => setAllowDomainPurchase(e.target.checked)}
                />
                Ask before domain purchase
              </label>
            </div>
          )}

          {/* Step nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Btn variant="ghost" size="md" onClick={() => setStep(1)}>
              ← Back
            </Btn>
            <Btn
              variant="default"
              size="md"
              icon="arrow"
              disabled={!step2Valid}
              onClick={() => step2Valid && setStep(3)}
              style={step2Valid ? {
                background: 'var(--accent-soft)',
                color: 'var(--accent)',
                border: '1px solid var(--accent)',
              } : undefined}
            >
              Continue
            </Btn>
          </div>
        </Card>
      );
    }

    // Step 3
    return (
      <Card>
        <div style={{ fontSize: 'var(--text-h2)', fontWeight: 500, marginBottom: 4 }}>Review and sign</div>
        <div style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)', marginBottom: 'var(--space-3)' }}>
          Confirm the mission parameters, then sign with your wallet to anchor the authorization on-chain.
        </div>

        {/* Mission summary */}
        <div style={{
          borderRadius: 12, border: '1px solid var(--hairline)',
          background: 'var(--surface-2)', padding: '4px 16px 0',
          marginBottom: 'var(--space-3)',
        }}>
          <SummaryRow k="Template" v={template} />
          {template === 'Launch a Landing Page' && (
            <SummaryRow k="Product" v={productName} />
          )}
          <SummaryRow k="Objective" v={
            <span style={{ maxWidth: 280, textAlign: 'right', lineHeight: 1.4, display: 'block' }}>
              {objective.length > 90 ? objective.slice(0, 90) + '…' : objective}
            </span>
          } />
          <SummaryRow k="Urgency" v={<Pill tone="accent" dot={false}>{urgency}</Pill>} />
          <SummaryRow k="Execution mode" v={<span style={{ textTransform: 'capitalize' }}>{mode}</span>} />
          <SummaryRow k="Verification" v={verify} />
          <SummaryRow k="Total budget" v={`${budget} USDC`} />
          {template === 'Launch a Landing Page' && (
            <SummaryRow k="Domain cap" v={`$${domainBudgetCap}`} />
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-small)' }}>Max per call</span>
            <span style={{ color: 'var(--text)', fontSize: 'var(--text-small)', fontWeight: 500 }}>{maxCall} USDC</span>
          </div>
        </div>

        {/* Agent lineup preview */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Label>Agent lineup</Label>
          <div style={{
            padding: 14, borderRadius: 12, background: 'var(--surface-2)',
            border: '1px solid var(--hairline)', display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="spark" size={15} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: 'var(--text-small)', fontWeight: 500 }}>Scored after mission creation</span>
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Bifrost scores the registry against your objective and proposes an agent team on the next screen.
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['data', 'skeptic', 'verifier', 'executor', 'domain specialist'].map(role => (
                <Pill key={role} tone="default" dot={false}>{role}</Pill>
              ))}
            </div>
          </div>
        </div>

        {/* Wallet auth */}
        <div style={{ marginBottom: 'var(--space-3)' }}>
          <Label>Wallet authorization</Label>
          {walletShort ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', borderRadius: 10,
              background: 'var(--surface-2)', border: '1px solid var(--hairline)',
            }}>
              <Icon name="wallet" size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>Connected —</span>
              <WalletAddr short={walletShort} />
              <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 'auto' }}>
                Signing is valid for 5 minutes
              </span>
            </div>
          ) : (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 10,
              background: 'var(--surface-2)', border: '1px solid var(--hairline)',
            }}>
              <span style={{ fontSize: 'var(--text-small)', color: 'var(--text-muted)' }}>
                Connect a Solana wallet to sign and launch.
              </span>
              <Btn variant="default" size="sm" icon="wallet" onClick={() => setVisible(true)}>
                Connect wallet
              </Btn>
            </div>
          )}
        </div>

        {/* Error */}
        {submitError && (
          <div style={{
            marginBottom: 'var(--space-3)', padding: '8px 12px', borderRadius: 8,
            background: 'color-mix(in oklch, var(--danger) 10%, transparent)',
            color: 'var(--danger)', border: '1px solid color-mix(in oklch, var(--danger) 28%, transparent)',
            fontSize: 12.5, lineHeight: 1.4,
          }}>
            {submitError}
          </div>
        )}

        {/* Step nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Btn variant="ghost" size="md" onClick={() => setStep(2)}>
            ← Back
          </Btn>
          {/* Plasma — single primary CTA per viewport */}
          <Btn
            variant="primary"
            size="md"
            icon={connected ? 'bolt' : 'wallet'}
            disabled={isSubmitting}
            onClick={handleLaunch}
          >
            {!connected
              ? connecting ? 'Connecting…' : 'Connect wallet'
              : isSubmitting ? 'Submitting…' : 'Sign and launch mission'}
          </Btn>
        </div>
      </Card>
    );
  };

  // ── Right rail ────────────────────────────────────────────────────────────────

  const agentsNeeded = TEMPLATE_AGENTS[template];

  const rail = (
    <div style={{
      position: 'sticky', top: 24,
      display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
    }}>
      {/* Step indicator */}
      <Card pad={16}>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, fontWeight: 500 }}>
          Progress
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {([
            [1, 'Define the mission'],
            [2, 'Set the policy'],
            [3, 'Review and sign'],
          ] as const).map(([n, label]) => {
            const isCurrent = step === n;
            const isDone = step > n;
            return (
              <div key={n} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                opacity: isDone ? 0.55 : 1,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isDone
                    ? 'color-mix(in oklch, var(--ok) 15%, transparent)'
                    : isCurrent ? 'var(--accent-soft)' : 'var(--surface-2)',
                  border: `1px solid ${isDone ? 'var(--ok)' : isCurrent ? 'var(--accent)' : 'var(--hairline)'}`,
                  fontSize: 10, fontWeight: 600,
                  color: isDone ? 'var(--ok)' : isCurrent ? 'var(--accent)' : 'var(--text-dim)',
                }}>
                  {isDone ? <Icon name="check" size={11} /> : n}
                </div>
                <span style={{
                  fontSize: 'var(--text-small)',
                  fontWeight: isCurrent ? 500 : 400,
                  color: isCurrent ? 'var(--text)' : 'var(--text-muted)',
                }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
        {/* Thin progress bar */}
        <div style={{
          marginTop: 12, height: 3, borderRadius: 99,
          background: 'var(--surface-2)',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: 99,
            background: 'var(--accent)',
            width: `${((step - 1) / 2) * 100}%`,
            transition: 'width 0.35s var(--ease)',
          }} />
        </div>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-dim)', marginTop: 6, textAlign: 'right' }}>
          Step {step} of 3
        </div>
      </Card>

      {/* Estimated cost */}
      <Card pad={16}>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 500 }}>
          Estimated total
        </div>
        <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--text)' }}>
          {budget > 0 ? `${budget} USDC` : '—'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          Max {maxCall} USDC per call
        </div>
      </Card>

      {/* Agents needed */}
      <Card pad={16}>
        <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 500 }}>
          Agents needed
        </div>
        <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: '-0.025em', color: 'var(--text)' }}>
          {agentsNeeded !== null ? agentsNeeded : '—'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
          {agentsNeeded !== null ? 'Scored from registry' : 'Set after objective'}
        </div>
      </Card>

      {template === 'Launch a Landing Page' && (
        <>
          <Card pad={16}>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 500 }}>
              Deliverables
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['preview URL', 'live URL', 'waitlist', '3 posts', 'screenshots', 'proof'].map(item => (
                <Pill key={item} tone="default" dot={false}>{item}</Pill>
              ))}
            </div>
          </Card>
          <Card pad={16}>
            <div style={{ fontSize: 'var(--text-caption)', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, fontWeight: 500 }}>
              Human checkpoints
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              <span>Approve lineup</span>
              <span>Pick positioning</span>
              <span>Approve preview spend</span>
              <span>Confirm domain candidate</span>
            </div>
          </Card>
        </>
      )}

      {/* Demo link */}
      <div style={{ textAlign: 'center' }}>
        <button
          onClick={runDemo}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-dim)', fontSize: 12,
            textDecoration: 'underline', textDecorationStyle: 'dotted',
            fontFamily: 'inherit', padding: 4,
          }}
        >
          Try a demo mission
        </button>
      </div>
    </div>
  );

  // ── Layout ────────────────────────────────────────────────────────────────────

  return (
    <Shell
      title="New Mission"
      subtitle="Compose a governed mission and anchor it with a wallet signature"
      pill={<Pill tone="accent">DRAFT</Pill>}
      actions={<Btn variant="ghost" size="sm" onClick={() => router.push('/missions')}>Cancel</Btn>}
    >
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 240px',
        gap: 'var(--space-4)',
        alignItems: 'start',
      }} data-wizard-grid>
        {/* Main column */}
        <div>
          {stepCard()}
        </div>

        {/* Right rail */}
        <div>
          {rail}
        </div>
      </div>

      {/* Responsive: collapse rail on narrow viewports */}
      <style>{`
        @media (max-width: 1023px) {
          [data-wizard-grid] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Shell>
  );
}
