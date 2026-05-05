'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useBifrostWalletModal as useWalletModal } from '@/components/wallet-modal';
import { buildRegistryApplicationAuthorizationMessage } from '@bifrost/shared';
import type { AgentManifest, AgentCapabilityClaim, AgentPhaseDefinition } from '@bifrost/shared';
import { Shell } from '@/components/ui/shell';
import { Card, Btn, Pill } from '@/components/ui/primitives';
import { createRegistryApplication } from '@/lib/api';

// ── Shared input styles ────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 10,
  background: 'var(--surface-2)',
  border: '1px solid var(--hairline)',
  color: 'var(--text)',
  fontFamily: 'inherit',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  lineHeight: 1.5,
};

// ── Sub-components ─────────────────────────────────────────────────────────────
function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 11,
      color: 'var(--text-dim)',
      textTransform: 'uppercase',
      letterSpacing: '0.06em',
      fontWeight: 500,
      marginBottom: 6,
      ...style,
    }}>
      {children}
    </div>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ChipInput({
  items,
  onAdd,
  onRemove,
  placeholder,
}: {
  items: string[];
  onAdd: (v: string) => void;
  onRemove: (i: number) => void;
  placeholder?: string;
}) {
  const [val, setVal] = useState('');
  const add = () => {
    const trimmed = val.trim();
    if (trimmed && !items.includes(trimmed)) {
      onAdd(trimmed);
      setVal('');
    }
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: items.length ? 8 : 0 }}>
        {items.map((item, i) => (
          <span key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 8px 3px 10px', borderRadius: 999,
            background: 'var(--accent-soft)', color: 'var(--accent)',
            border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
            fontSize: 12, fontWeight: 500,
          }}>
            {item}
            <button onClick={() => onRemove(i)} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--accent)', fontSize: 14, lineHeight: 1, padding: 0,
              display: 'flex', alignItems: 'center',
            }}>×</button>
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder ?? 'Type and press Enter or Add'}
          style={{ ...inputStyle, flex: 1 }}
        />
        <Btn variant="default" size="sm" onClick={add}>Add</Btn>
      </div>
    </div>
  );
}

// ── Step indicator ─────────────────────────────────────────────────────────────
function StepIndicator({ step }: { step: number }) {
  const steps = [
    { n: 1, label: 'Identity' },
    { n: 2, label: 'Capabilities' },
    { n: 3, label: 'Wallets & Policies' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
      {steps.map((s, idx) => {
        const isDone = s.n < step;
        const isActive = s.n === step;
        return (
          <React.Fragment key={s.n}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 999,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 600,
                background: isDone
                  ? 'var(--ok)'
                  : isActive
                    ? 'linear-gradient(135deg, var(--plasma-2), var(--plasma-1))'
                    : 'var(--surface-2)',
                color: isDone || isActive ? 'white' : 'var(--text-dim)',
                border: isActive ? '1px solid transparent' : '1px solid var(--hairline)',
              }}>
                {isDone ? '✓' : s.n}
              </div>
              <span style={{
                fontSize: 12.5,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--text)' : isDone ? 'var(--text-muted)' : 'var(--text-dim)',
              }}>
                {s.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div style={{
                flex: 1, height: 1,
                background: s.n < step ? 'var(--ok)' : 'var(--hairline)',
                margin: '0 12px',
              }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function RegistryApplyPage() {
  const router = useRouter();
  const { connected, publicKey, signMessage } = useWallet();
  const { setVisible } = useWalletModal();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Step 1 — Identity
  const [agentId, setAgentId] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState('');
  const [icon, setIcon] = useState('🤖');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [executionMode, setExecutionMode] = useState<'builtin' | 'callback'>('callback');

  // Step 2 — Capabilities + Services
  const [capabilityClaims, setCapabilityClaims] = useState<string[]>([]);
  const [supportedServices, setSupportedServices] = useState<string[]>([]);
  const [maxPerCallUsdc, setMaxPerCallUsdc] = useState<number>(1);
  const [perMissionCapUsdc, setPerMissionCapUsdc] = useState<number>(10);
  const [allowlistedServices, setAllowlistedServices] = useState<string[]>([]);
  const [phaseSchemaRaw, setPhaseSchemaRaw] = useState('[]');
  const [phaseSchemaError, setPhaseSchemaError] = useState<string | null>(null);

  // Step 3 — Wallets + Policies
  const ownerWallet = publicKey?.toBase58() ?? '';
  const [payoutWallet, setPayoutWallet] = useState('');
  const [verifierWallet, setVerifierWallet] = useState('');
  const [privacyPolicyUri, setPrivacyPolicyUri] = useState('');
  const [metadataUri, setMetadataUri] = useState('');
  const [priceModel, setPriceModel] = useState('per-call');
  const [evaluationSuites, setEvaluationSuites] = useState<string[]>([]);

  // Sync payout wallet when owner wallet becomes available
  React.useEffect(() => {
    if (ownerWallet && !payoutWallet) {
      setPayoutWallet(ownerWallet);
    }
  }, [ownerWallet, payoutWallet]);

  // Auto-generate slug from name
  const handleNameChange = (v: string) => {
    setName(v);
    if (!slugManual) {
      setSlug(v.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
    }
  };

  // Validate slug (kebab-case)
  const slugValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
  const agentIdValid = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(agentId);

  // Step 1 required fields
  const step1Valid = agentIdValid && slugValid && name.trim().length >= 3 &&
    description.trim().length >= 12 && role !== '' && endpointUrl.trim().length >= 6;

  // Step 2 required fields
  const step2Valid = capabilityClaims.length >= 1;

  // Step 3 required fields — wallet must be connected
  const step3Valid = connected && ownerWallet && payoutWallet;

  const encodeBase64 = (value: Uint8Array) => btoa(String.fromCharCode(...value));

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!connected) {
      setVisible(true);
      return;
    }
    if (!publicKey || !signMessage) {
      setSubmitError('Connected wallet must support message signing.');
      return;
    }

    // Parse phase schema
    let parsedPhaseSchema: AgentPhaseDefinition[] = [];
    try {
      parsedPhaseSchema = JSON.parse(phaseSchemaRaw) as AgentPhaseDefinition[];
    } catch {
      setSubmitError('Phase schema is not valid JSON.');
      return;
    }

    // Build capability claims into AgentCapabilityClaim objects
    const capabilities: AgentCapabilityClaim[] = capabilityClaims.map((id) => ({
      id,
      label: id,
      description: id,
      version: '1.0.0',
      inputSchema: '{}',
      outputSchema: '{}',
      requiredTools: [],
      allowedServices: allowlistedServices,
      evaluationSuiteId: evaluationSuites[0] ?? 'default',
    }));

    const signedAt = new Date().toISOString();
    const issuedAt = signedAt;

    const manifest: AgentManifest = {
      agentId,
      slug,
      name,
      description,
      icon,
      ownerWallet,
      payoutWallet: payoutWallet || ownerWallet,
      verifierWallet: verifierWallet || ownerWallet,
      endpointUrl,
      role: role as AgentManifest['role'],
      executionMode,
      capabilities,
      phaseSchema: parsedPhaseSchema,
      supportedServices,
      spendPolicy: {
        maxPerCall: maxPerCallUsdc,
        budgetCap: perMissionCapUsdc,
        requiresHumanAbove: 0,
      },
      priceModel,
      metadataUri: metadataUri || undefined,
      privacyPolicyUri: privacyPolicyUri || undefined,
      requestedEvaluationSuites: evaluationSuites.length ? evaluationSuites : ['default'],
      signedAt,
    };

    setIsSubmitting(true);
    try {
      const message = buildRegistryApplicationAuthorizationMessage(manifest, issuedAt);
      const signatureBytes = await signMessage(new TextEncoder().encode(message));
      const application = await createRegistryApplication(manifest, {
        issuedAt,
        signature: encodeBase64(signatureBytes),
      });
      router.push(`/agents/apply/${application.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Submission failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const walletShort = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
    : 'Not connected';

  return (
    <Shell
      title="Register Agent"
      subtitle="Submit your agent for Bifrost registry certification"
      pill={<Pill tone="accent">APPLY</Pill>}
      actions={<>
        <Btn variant="ghost" size="sm" onClick={() => router.push('/agents')}>Cancel</Btn>
      </>}
    >
      <div style={{ maxWidth: 740, margin: '0 auto' }}>
        <StepIndicator step={step} />

        {/* ── Step 1: Identity ── */}
        {step === 1 && (
          <Card>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 18 }}>Agent Identity</div>

            <FieldRow>
              <Field label="Agent ID (slug, kebab-case) *">
                <input
                  value={agentId}
                  onChange={e => setAgentId(e.target.value.toLowerCase().replace(/\s/g, '-'))}
                  placeholder="my-research-agent"
                  style={{ ...inputStyle, borderColor: agentId && !agentIdValid ? 'var(--danger)' : undefined }}
                />
                {agentId && !agentIdValid && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                    Must be kebab-case (a-z, 0-9, hyphens only)
                  </div>
                )}
              </Field>
              <Field label="Display name *">
                <input
                  value={name}
                  onChange={e => handleNameChange(e.target.value)}
                  placeholder="My Research Agent"
                  style={inputStyle}
                />
              </Field>
            </FieldRow>

            <div style={{ marginBottom: 14 }}>
              <Field label="Slug (URL-safe, auto-generated) *">
                <input
                  value={slug}
                  onChange={e => {
                    setSlug(e.target.value.toLowerCase().replace(/\s/g, '-'));
                    setSlugManual(true);
                  }}
                  placeholder="my-research-agent"
                  style={{ ...inputStyle, borderColor: slug && !slugValid ? 'var(--danger)' : undefined }}
                />
                {slug && !slugValid && (
                  <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>
                    Must be kebab-case (a-z, 0-9, hyphens only)
                  </div>
                )}
              </Field>
            </div>

            <div style={{ marginBottom: 14 }}>
              <Label>Description *</Label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe what this agent does, its primary use case, and what makes it trustworthy..."
                style={textareaStyle}
              />
            </div>

            <FieldRow>
              <Field label="Role *">
                <select value={role} onChange={e => setRole(e.target.value)} style={selectStyle}>
                  <option value="">Select role…</option>
                  <option value="research">research</option>
                  <option value="market">analytics / market</option>
                  <option value="skeptic">skeptic</option>
                  <option value="risk">risk</option>
                  <option value="execution">execution</option>
                  <option value="verifier">verifier</option>
                  <option value="news">news</option>
                  <option value="compliance">compliance</option>
                  <option value="coordinator">coordinator</option>
                  <option value="wallet_intelligence">wallet intelligence</option>
                  <option value="custom">other / custom</option>
                </select>
              </Field>
              <Field label="Icon (single emoji)">
                <input
                  value={icon}
                  onChange={e => setIcon(e.target.value)}
                  maxLength={4}
                  placeholder="🤖"
                  style={{ ...inputStyle, fontSize: 22, textAlign: 'center' }}
                />
              </Field>
            </FieldRow>

            <div style={{ marginBottom: 14 }}>
              <Label>Endpoint URL *</Label>
              <input
                value={endpointUrl}
                onChange={e => setEndpointUrl(e.target.value)}
                placeholder="https://my-agent.example.com/api"
                type="url"
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <Label>Execution mode</Label>
              <select value={executionMode} onChange={e => setExecutionMode(e.target.value as 'builtin' | 'callback')} style={selectStyle}>
                <option value="callback">callback (orchestrated)</option>
                <option value="builtin">builtin (standalone)</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Btn variant="primary" size="md" onClick={() => setStep(2)} disabled={!step1Valid}>
                Next: Capabilities →
              </Btn>
            </div>
          </Card>
        )}

        {/* ── Step 2: Capabilities + Services ── */}
        {step === 2 && (
          <Card>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 18 }}>Capabilities &amp; Services</div>

            <div style={{ marginBottom: 18 }}>
              <Label>Capability claims * (at least one required)</Label>
              <ChipInput
                items={capabilityClaims}
                onAdd={v => setCapabilityClaims(prev => [...prev, v])}
                onRemove={i => setCapabilityClaims(prev => prev.filter((_, idx) => idx !== i))}
                placeholder="e.g. wallet-analysis, on-chain-data…"
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <Label>Supported services</Label>
              <ChipInput
                items={supportedServices}
                onAdd={v => setSupportedServices(prev => [...prev, v])}
                onRemove={i => setSupportedServices(prev => prev.filter((_, idx) => idx !== i))}
                placeholder="e.g. coingecko, helius, jupiter…"
              />
            </div>

            <div style={{
              padding: 14, borderRadius: 10,
              background: 'var(--surface-2)', border: '1px solid var(--hairline)',
              marginBottom: 18,
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 12 }}>Spend policy</div>
              <FieldRow>
                <Field label="Max per call (USDC)">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={maxPerCallUsdc}
                    onChange={e => setMaxPerCallUsdc(+e.target.value)}
                    style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                  />
                </Field>
                <Field label="Per-mission cap (USDC)">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={perMissionCapUsdc}
                    onChange={e => setPerMissionCapUsdc(+e.target.value)}
                    style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
                  />
                </Field>
              </FieldRow>
              <Label style={{ marginBottom: 6 }}>Allowlisted services (spend policy)</Label>
              <ChipInput
                items={allowlistedServices}
                onAdd={v => setAllowlistedServices(prev => [...prev, v])}
                onRemove={i => setAllowlistedServices(prev => prev.filter((_, idx) => idx !== i))}
                placeholder="Match from supported services above…"
              />
              {supportedServices.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                  {supportedServices.filter(s => !allowlistedServices.includes(s)).map(s => (
                    <button key={s} onClick={() => setAllowlistedServices(prev => [...prev, s])} style={{
                      padding: '3px 8px', borderRadius: 6, cursor: 'pointer',
                      background: 'var(--surface)', border: '1px solid var(--hairline)',
                      color: 'var(--text-muted)', fontSize: 11.5, fontFamily: 'inherit',
                    }}>
                      + {s}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 20 }}>
              <Label>Phase schema (JSON array, optional)</Label>
              <textarea
                value={phaseSchemaRaw}
                rows={5}
                onChange={e => {
                  setPhaseSchemaRaw(e.target.value);
                  try {
                    JSON.parse(e.target.value);
                    setPhaseSchemaError(null);
                  } catch {
                    setPhaseSchemaError('Invalid JSON');
                  }
                }}
                placeholder='[{"id":"phase-1","label":"Research","description":"...","streams":false}]'
                style={{ ...textareaStyle, fontFamily: 'var(--font-mono)', fontSize: 12 }}
              />
              {phaseSchemaError && (
                <div style={{ fontSize: 11, color: 'var(--danger)', marginTop: 4 }}>{phaseSchemaError}</div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Btn variant="ghost" size="md" onClick={() => setStep(1)}>← Back</Btn>
              <Btn variant="primary" size="md" onClick={() => setStep(3)} disabled={!step2Valid || !!phaseSchemaError}>
                Next: Wallets →
              </Btn>
            </div>
          </Card>
        )}

        {/* ── Step 3: Wallets + Policies ── */}
        {step === 3 && (
          <Card>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 18 }}>Wallets &amp; Policies</div>

            {!connected ? (
              <div style={{
                padding: 20, borderRadius: 12,
                background: 'var(--surface-2)', border: '1px solid var(--hairline)',
                textAlign: 'center', marginBottom: 18,
              }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Connect wallet to register agent
                </div>
                <button
                  onClick={() => setVisible(true)}
                  style={{
                    padding: '9px 20px', borderRadius: 10, cursor: 'pointer',
                    background: 'linear-gradient(135deg, var(--plasma-2), var(--plasma-1))',
                    color: 'white', border: '1px solid transparent',
                    fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
                    boxShadow: '0 8px 24px -8px var(--plasma-1)',
                  }}
                >
                  Connect wallet
                </button>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 14 }}>
                  <Label>Owner wallet (connected — read only)</Label>
                  <div style={{
                    ...inputStyle,
                    color: 'var(--text-dim)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    cursor: 'default',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: 999, background: 'var(--ok)',
                      boxShadow: '0 0 8px var(--ok)', flexShrink: 0,
                    }} />
                    {ownerWallet}
                  </div>
                </div>

                <FieldRow>
                  <Field label="Payout wallet *">
                    <input
                      value={payoutWallet}
                      onChange={e => setPayoutWallet(e.target.value)}
                      placeholder={ownerWallet}
                      style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                    />
                  </Field>
                  <Field label="Verifier wallet (optional)">
                    <input
                      value={verifierWallet}
                      onChange={e => setVerifierWallet(e.target.value)}
                      placeholder="Leave blank to use owner wallet"
                      style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                    />
                  </Field>
                </FieldRow>

                <FieldRow>
                  <Field label="Privacy policy URI (optional)">
                    <input
                      value={privacyPolicyUri}
                      onChange={e => setPrivacyPolicyUri(e.target.value)}
                      placeholder="https://…"
                      type="url"
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Metadata URI (optional)">
                    <input
                      value={metadataUri}
                      onChange={e => setMetadataUri(e.target.value)}
                      placeholder="https://…"
                      type="url"
                      style={inputStyle}
                    />
                  </Field>
                </FieldRow>

                <div style={{ marginBottom: 14 }}>
                  <Label>Price model</Label>
                  <select value={priceModel} onChange={e => setPriceModel(e.target.value)} style={selectStyle}>
                    <option value="per-call">per-call</option>
                    <option value="subscription">subscription</option>
                    <option value="free">free</option>
                  </select>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <Label>Requested evaluation suites</Label>
                  <ChipInput
                    items={evaluationSuites}
                    onAdd={v => setEvaluationSuites(prev => [...prev, v])}
                    onRemove={i => setEvaluationSuites(prev => prev.filter((_, idx) => idx !== i))}
                    placeholder="e.g. default, wallet-hygiene-v1…"
                  />
                </div>
              </>
            )}

            {submitError && (
              <div style={{
                marginBottom: 14, padding: '8px 10px', borderRadius: 8,
                background: 'color-mix(in oklch, var(--danger) 10%, transparent)',
                color: 'var(--danger)', border: '1px solid color-mix(in oklch, var(--danger) 28%, transparent)',
                fontSize: 12.5, lineHeight: 1.4,
              }}>
                {submitError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Btn variant="ghost" size="md" onClick={() => setStep(2)}>← Back</Btn>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {connected && (
                  <span style={{ fontSize: 11.5, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                    {walletShort}
                  </span>
                )}
                <Btn
                  variant="primary"
                  size="md"
                  icon={connected ? 'bolt' : 'wallet'}
                  disabled={isSubmitting || !step3Valid}
                  onClick={handleSubmit}
                >
                  {!connected ? 'Connect wallet' : isSubmitting ? 'Signing & submitting…' : 'Sign & submit application'}
                </Btn>
              </div>
            </div>
          </Card>
        )}
      </div>
    </Shell>
  );
}
