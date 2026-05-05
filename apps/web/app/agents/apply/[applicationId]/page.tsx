'use client';
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import type { RegistryApplication, EvaluationReport } from '@bifrost/shared';
import { Shell } from '@/components/ui/shell';
import { Card, Btn, Pill } from '@/components/ui/primitives';
import { VerificationCheckRow } from '@/components/VerificationCheckRow';
import {
  fetchRegistryApplication,
  runRegistryProtocolCheck,
  submitRegistryEvaluations,
} from '@/lib/api';

function statusTone(status: string): any {
  if (status === 'certified' || status === 'active') return 'ok';
  if (status === 'rejected' || status === 'suspended') return 'danger';
  if (
    status === 'submitted' ||
    status === 'protocol_check' ||
    status === 'sandbox_eval'
  )
    return 'warn';
  return 'pending';
}

function EvaluationReportCard({ report }: { report: EvaluationReport }) {
  const verdictTone =
    report.status === 'passed' ? 'ok' : report.status === 'failed' ? 'danger' : 'warn';

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{report.suiteId}</div>
          <div
            style={{
              fontSize: 11.5,
              color: 'var(--text-dim)',
              marginTop: 2,
            }}
          >
            {new Date(report.startedAt).toLocaleString()}
          </div>
        </div>
        <Pill tone={verdictTone}>{report.status}</Pill>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginBottom: 12,
          paddingBottom: 12,
          borderBottom: '1px solid var(--hairline)',
        }}
      >
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Score
          </div>
          <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>
            {(report.overallScore * 100).toFixed(0)}%
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Evaluator
          </div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            {report.evaluatorWallet.slice(0, 8)}…{report.evaluatorWallet.slice(-4)}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {report.claimsVerified.length} claims verified
        {report.claimsRejected.length > 0
          ? `, ${report.claimsRejected.length} rejected`
          : ''}
      </div>
    </Card>
  );
}

export default function RegistryApplicationStatusPage() {
  const params = useParams();
  const applicationId = params.applicationId as string;

  const [application, setApplication] = useState<RegistryApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [isSubmittingEval, setIsSubmittingEval] = useState(false);

  // Poll application state every 2 seconds
  useEffect(() => {
    const fetchApp = async () => {
      try {
        const app = await fetchRegistryApplication(applicationId);
        setApplication(app);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch application');
      } finally {
        setLoading(false);
      }
    };

    fetchApp();
    const interval = setInterval(fetchApp, 2000);
    return () => clearInterval(interval);
  }, [applicationId]);

  const handleProtocolCheck = async () => {
    if (!application) return;
    setIsRunningCheck(true);
    try {
      const updated = await runRegistryProtocolCheck(applicationId);
      setApplication(updated);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run protocol check');
    } finally {
      setIsRunningCheck(false);
    }
  };

  const handleSubmitEvaluations = async () => {
    if (!application) return;
    setIsSubmittingEval(true);
    try {
      const result = await submitRegistryEvaluations(applicationId);
      setApplication(result.application);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit evaluations');
    } finally {
      setIsSubmittingEval(false);
    }
  };

  if (loading) {
    return (
      <Shell
        title="Registry Application"
        subtitle="Loading…"
      >
        <Card style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ color: 'var(--text-muted)' }}>Loading application details…</div>
        </Card>
      </Shell>
    );
  }

  if (!application) {
    return (
      <Shell
        title="Registry Application"
        subtitle="Not found"
      >
        <Card style={{ padding: '40px 20px', color: 'var(--danger)' }}>
          Application not found
        </Card>
      </Shell>
    );
  }

  const agentName = application.manifest.name;

  return (
    <Shell
      title={agentName || applicationId}
      subtitle={`ID: ${applicationId.slice(0, 8)}…`}
      pill={<Pill tone={statusTone(application.status)}>{application.status}</Pill>}
    >
      {error && (
        <Card
          style={{
            marginBottom: 14,
            color: 'var(--danger)',
            borderColor: 'var(--danger)',
          }}
        >
          {error}
        </Card>
      )}

      {/* Header Section */}
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Agent</div>
            <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
              {application.manifest.description}
            </div>
          </div>
          <Pill tone={statusTone(application.status)}>{application.status}</Pill>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--hairline)',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Submitted
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {new Date(application.submittedAt).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Updated
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {new Date(application.updatedAt).toLocaleDateString()}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 10.5,
                color: 'var(--text-dim)',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Owner
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
              {application.ownerWallet.slice(0, 8)}…
            </div>
          </div>
        </div>
      </Card>

      {/* Protocol Checks */}
      {application.protocolChecks.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
            Protocol Checks
          </div>
          <div>
            {application.protocolChecks.map((check) => (
              <div key={check.id} style={{ marginBottom: 8 }}>
                <VerificationCheckRow
                  label={check.label}
                  passed={check.status === 'passed'}
                  detail={check.detail}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Evaluation Reports */}
      {application.evaluationReports.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
            Evaluation Reports
          </div>
          {application.evaluationReports.map((report) => (
            <EvaluationReportCard key={report.id} report={report} />
          ))}
        </Card>
      )}

      {/* Certified Capabilities */}
      {application.certifiedCapabilities.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 12 }}>
            Certified Capabilities
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {application.certifiedCapabilities.map((cap) => (
              <Pill key={cap.capabilityId} tone="ok">
                {cap.label} v{cap.version}
              </Pill>
            ))}
          </div>
        </Card>
      )}

      {/* On-chain Anchor */}
      {application.anchorTxSignature && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>
            On-chain Anchor
          </div>
          <a
            href={`https://solscan.io/tx/${application.anchorTxSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--accent)',
              wordBreak: 'break-all',
              textDecoration: 'underline',
            }}
          >
            {application.anchorTxSignature}
          </a>
        </Card>
      )}

      {/* Action Buttons */}
      <Card style={{ display: 'flex', gap: 8, padding: '16px 20px' }}>
        {application.status === 'submitted' && (
          <Btn
            variant="primary"
            size="md"
            onClick={handleProtocolCheck}
            disabled={isRunningCheck}
          >
            {isRunningCheck ? 'Running…' : 'Run Protocol Check'}
          </Btn>
        )}
        {application.status === 'protocol_check' && (
          <Btn
            variant="primary"
            size="md"
            onClick={handleSubmitEvaluations}
            disabled={isSubmittingEval}
          >
            {isSubmittingEval ? 'Submitting…' : 'Submit for Evaluation'}
          </Btn>
        )}
        {['certified', 'active', 'rejected', 'suspended'].includes(application.status) && (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {application.status === 'certified' || application.status === 'active'
              ? 'Application certified'
              : 'No further actions available'}
          </div>
        )}
      </Card>
    </Shell>
  );
}
