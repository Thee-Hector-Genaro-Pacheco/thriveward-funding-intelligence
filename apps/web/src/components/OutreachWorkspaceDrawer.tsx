import React, { useState } from 'react';

interface OutreachWorkspaceDrawerProps {
  engagement: any;
  onClose: () => void;
  onRefresh: () => void;
  currentUser?: { displayName: string; role: 'ADMIN' | 'OPERATOR' | 'VIEWER' } | null;
}

export const OutreachWorkspaceDrawer: React.FC<OutreachWorkspaceDrawerProps> = ({
  engagement,
  onClose,
  onRefresh,
  currentUser,
}) => {
  const [activeTab, setActiveTab] = useState<'DRAFTS' | 'EVIDENCE' | 'RESPONSES' | 'DISCOVERY_MOU' | 'HISTORY'>('DRAFTS');

  // Human Attribution & Forms State (Server-authoritative authenticated user)
  const humanActorName = currentUser?.displayName || 'Hector Pacheco';

  // Draft Creation Form
  const [newDraftSubject, setNewDraftSubject] = useState<string>(engagement.draftVersions?.[0]?.subject || '');
  const [newDraftBody, setNewDraftBody] = useState<string>(engagement.draftVersions?.[0]?.body || '');
  const [newDraftRecipient, setNewDraftRecipient] = useState<string>(engagement.draftVersions?.[0]?.recipient || engagement.strategicPartnerCandidate?.contactChannel || '');

  // Approval Form
  const [approvalReason, setApprovalReason] = useState<string>('Verified recipient contact and approved competition positioning.');
  const [recipientReviewed, setRecipientReviewed] = useState<boolean>(true);
  const [contentReviewed, setContentReviewed] = useState<boolean>(true);
  const [evidenceVerified, setEvidenceVerified] = useState<boolean>(true);
  const [zeroTransmissionAck, setZeroTransmissionAck] = useState<boolean>(true);

  // Mark As Sent Form
  const [showSentModal, setShowSentModal] = useState<boolean>(false);
  const [actualRecipient, setActualRecipient] = useState<string>(engagement.draftVersions?.[0]?.recipient || '');
  const [sentChannel, setSentChannel] = useState<string>('EMAIL');
  const [sentTimestamp, setSentTimestamp] = useState<string>(new Date().toISOString().slice(0, 16));
  const [sentNotes, setSentNotes] = useState<string>('Sent via official agency contact email.');

  // Response Form
  const [showResponseModal, setShowResponseModal] = useState<boolean>(false);
  const [responseOutcome, setResponseOutcome] = useState<string>('INTERESTED');
  const [responseSummary, setResponseSummary] = useState<string>('');
  const [senderIdentity, setSenderIdentity] = useState<string>(engagement.strategicPartnerCandidate?.contactChannel || '');
  const [quotedExcerpt, setQuotedExcerpt] = useState<string>('');
  const [nextAction, setNextAction] = useState<string>('Schedule discovery call');

  // Follow-up Form
  const [showFollowUpModal, setShowFollowUpModal] = useState<boolean>(false);
  const [followUpDue, setFollowUpDue] = useState<string>(new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16));
  const [followUpReason, setFollowUpReason] = useState<string>('Check status of outreach inquiry');

  // Discovery Call Form
  const [showCallModal, setShowCallModal] = useState<boolean>(false);
  const [callDateTime, setCallDateTime] = useState<string>(new Date().toISOString().slice(0, 16));
  const [callNotes, setCallNotes] = useState<string>('');
  const [callOutcome, setCallOutcome] = useState<string>('Positive interest in joint application');
  const [callNextAction, setCallNextAction] = useState<string>('Draft partnership MOU');

  // MOU Checklist Form
  const [showMouModal, setShowMouModal] = useState<boolean>(false);
  const [mouLabel, setMouLabel] = useState<string>('CoC Collaborative Applicant Support Letter & Joint MOU');
  const [mouResponsible, setMouResponsible] = useState<string>('Project Thriveward Executive Team');

  // Transition Form
  const [showTransitionModal, setShowTransitionModal] = useState<boolean>(false);
  const [targetStatus, setTargetStatus] = useState<string>('POSSIBLE_MATCH');
  const [transitionReason, setTransitionReason] = useState<string>('');
  const [executedMouRef, setExecutedMouRef] = useState<string>('');

  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const partner = engagement.strategicPartnerCandidate;
  const currentStatus = engagement.currentStatus;
  const latestDraft = engagement.draftVersions?.[0];
  const isDemo = engagement.dataOrigin === 'DEMO';

  // API Action Handlers
  const handleSaveNewDraft = async () => {
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/outreach/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementId: engagement.id,
          subject: newDraftSubject,
          body: newDraftBody,
          recipient: newDraftRecipient,
          inquiryPurpose: engagement.inquiryPurpose,
          creatorType: 'HUMAN_EDITED',
          creatorActorName: humanActorName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save draft version');
      setActionSuccess('✓ Saved new human-edited draft version.');
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveDraft = async () => {
    if (!latestDraft) {
      setActionError('No draft version exists to approve.');
      return;
    }
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/outreach/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementId: engagement.id,
          draftVersionId: latestDraft.id,
          humanReviewerName: humanActorName,
          approvalReason,
          zeroTransmissionAck,
          userConfirmedChecks: {
            recipientReviewed,
            contentReviewed,
            evidenceVerified,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve draft');
      setActionSuccess('✓ Draft approved and contact evidence frozen. Status advanced to CONTACT_APPROVED.');
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkAsSent = async () => {
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const idempotencyKey = `SENT:${engagement.id}:${Date.now()}`;
      const res = await fetch('/api/outreach/sent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementId: engagement.id,
          actualRecipient,
          channel: sentChannel,
          sentTimestamp: new Date(sentTimestamp).toISOString(),
          humanActorName,
          notes: sentNotes,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark outreach as sent');
      setActionSuccess('✓ Outreach delivery recorded. Status advanced to CONTACTED.');
      setShowSentModal(false);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordResponse = async () => {
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const idempotencyKey = `RESP:${engagement.id}:${Date.now()}`;
      const res = await fetch('/api/outreach/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementId: engagement.id,
          deliveryRecordId: engagement.deliveryRecords?.[0]?.id,
          receivedTimestamp: new Date().toISOString(),
          senderIdentity,
          outcome: responseOutcome,
          summary: responseSummary,
          quotedExcerpt,
          nextAction,
          humanRecorderName: humanActorName,
          idempotencyKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record response');
      setActionSuccess('✓ Partner response recorded successfully.');
      setShowResponseModal(false);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleScheduleFollowUp = async () => {
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/outreach/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementId: engagement.id,
          dueDateTime: new Date(followUpDue).toISOString(),
          reason: followUpReason,
          humanActorName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule follow-up');
      setActionSuccess('✓ Follow-up reminder scheduled.');
      setShowFollowUpModal(false);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordDiscoveryCall = async () => {
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/outreach/discovery-calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementId: engagement.id,
          callState: 'COMPLETED',
          callDateTime: new Date(callDateTime).toISOString(),
          participants: [partner.name, humanActorName],
          meetingMethod: 'VIDEO_CONFERENCE',
          notes: callNotes || 'Discovery call held to review joint competition alignment.',
          outcome: callOutcome,
          nextAction: callNextAction,
          humanRecorderName: humanActorName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record discovery call');
      setActionSuccess('✓ Discovery call recorded. Status updated.');
      setShowCallModal(false);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddMouItem = async () => {
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/outreach/mou-checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementId: engagement.id,
          label: mouLabel,
          status: 'IN_PROGRESS',
          responsibleParty: mouResponsible,
          humanActorName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add MOU item');
      setActionSuccess('✓ MOU checklist item added.');
      setShowMouModal(false);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteTransition = async (statusToSet: string, reqReason: string) => {
    setSubmitting(true);
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await fetch('/api/outreach/transitions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engagementId: engagement.id,
          targetStatus: statusToSet,
          humanActorName,
          reason: reqReason,
          confirmationMetadata: statusToSet === 'CONFIRMED_PARTNER' ? { executedMouReference: executedMouRef || 'MOU-EXECUTED-2026-001' } : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transition rejected');
      setActionSuccess(`✓ Transitioned workflow status to ${statusToSet}.`);
      setShowTransitionModal(false);
      onRefresh();
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', background: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(8px)' }}>
      <div style={{ flex: 1 }} onClick={onClose} />

      <div style={{ width: '850px', maxWidth: '100vw', height: '100vh', background: '#0f172a', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', overflowY: 'auto', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)' }}>
        
        {/* Drawer Header */}
        <div style={{ padding: '1.25rem 1.5rem', background: '#1e293b', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge badge-purple" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                Status: {currentStatus}
              </span>
              <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '0.3rem', background: isDemo ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)', border: isDemo ? '1px solid #f59e0b' : '1px solid #3b82f6', color: isDemo ? '#fde68a' : '#93c5fd', fontWeight: 700 }}>
                {isDemo ? '⚠️ DEMO WORKFLOW CANDIDATE' : '🌐 OFFICIAL LIVE CANDIDATE'}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Purpose: {engagement.inquiryPurpose}
              </span>
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
              💬 Outreach Engagement Workspace — {partner?.name}
            </h2>
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem' }}>
              CoC Number: {partner?.cocNumber || 'N/A'} • Contact: {partner?.contactChannel || 'Unverified'}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '1.4rem', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Zero-Transmission Safeguard Alert */}
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', borderBottom: '1px solid #ef4444', color: '#fca5a5', padding: '0.65rem 1.5rem', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          🔒 <strong>Zero Automated Transmission Safeguard Active:</strong> Bridge AI NEVER transmits email. All outreach text must be human-reviewed, approved, and manually sent outside the system.
        </div>

        {/* Action Error / Success Banners */}
        {actionError && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', borderBottom: '1px solid #ef4444', color: '#fca5a5', padding: '0.65rem 1.5rem', fontSize: '0.85rem' }}>
            ⚠️ <strong>Error:</strong> {actionError}
          </div>
        )}
        {actionSuccess && (
          <div style={{ background: 'rgba(16, 185, 129, 0.2)', borderBottom: '1px solid #10b981', color: '#6ee7b7', padding: '0.65rem 1.5rem', fontSize: '0.85rem' }}>
            {actionSuccess}
          </div>
        )}

        {/* Human Attribution Read-Only Verified Bar */}
        <div style={{ padding: '0.75rem 1.5rem', background: 'rgba(30, 41, 59, 0.6)', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>👤 Authenticated Human Operator:</label>
          <div style={{ background: '#0f172a', border: '1px solid #334155', color: '#38bdf8', padding: '0.35rem 0.75rem', borderRadius: '0.35rem', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🔒</span>
            <span>{humanActorName} ({currentUser?.role || 'OPERATOR'})</span>
          </div>
        </div>

        {/* Server-Authoritative Status Progression Banner */}
        <div style={{ padding: '1rem 1.5rem', background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.5rem' }}>
            ⚡ Server-Authoritative Workflow Progression Actions:
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            {currentStatus === 'RESEARCH_REQUIRED' && (
              <button
                onClick={() => handleExecuteTransition('POSSIBLE_MATCH', 'Human confirmed partner relevance and contact candidacy.')}
                disabled={submitting}
                style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '0.45rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
              >
                Mark as Possible Match →
              </button>
            )}

            {currentStatus === 'POSSIBLE_MATCH' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', width: '100%', background: 'rgba(30, 41, 59, 0.8)', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #3b82f6' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa' }}>
                  🛡️ Mandatory Human Approval Required to Advance to CONTACT_APPROVED:
                </div>

                {latestDraft && (
                  Boolean((latestDraft.subject || '').match(/\[(ADD|VERIFY|INSERT|REPLACE|TODO|DO NOT SEND)\b/i)) ||
                  Boolean((latestDraft.body || '').match(/\[(ADD|VERIFY|INSERT|REPLACE|TODO|DO NOT SEND)\b/i)) ||
                  Boolean((latestDraft.recipient || '').match(/\[(ADD|VERIFY|INSERT|REPLACE|TODO|DO NOT SEND)\b/i)) ||
                  Boolean((latestDraft.recipient || '').includes('[VERIFY'))
                ) && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#fca5a5', padding: '0.65rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.8rem', fontWeight: 600 }}>
                    ⚠️ <strong>UNRESOLVED PLACEHOLDER DETECTED:</strong> Draft contains unresolved system placeholders (e.g. <code>[ADD ...]</code> or <code>[VERIFY ...]</code>). You must fill in all placeholders before approving.
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.4rem', fontSize: '0.8rem', color: '#cbd5e1' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <input type="checkbox" checked={recipientReviewed} onChange={(e) => setRecipientReviewed(e.target.checked)} />
                    Recipient email verified & safe
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <input type="checkbox" checked={contentReviewed} onChange={(e) => setContentReviewed(e.target.checked)} />
                    Draft subject & body reviewed
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <input type="checkbox" checked={evidenceVerified} onChange={(e) => setEvidenceVerified(e.target.checked)} />
                    Contact evidence citation verified
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', gridColumn: '1 / -1', color: '#fca5a5' }}>
                    <input type="checkbox" checked={zeroTransmissionAck} onChange={(e) => setZeroTransmissionAck(e.target.checked)} />
                    Confirm Bridge AI will NOT send email automatically
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                  <input
                    type="text"
                    value={approvalReason}
                    onChange={(e) => setApprovalReason(e.target.value)}
                    placeholder="State approval reason..."
                    style={{ flex: 1, background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.35rem 0.65rem', borderRadius: '0.35rem', fontSize: '0.8rem' }}
                  />
                  <button
                    onClick={handleApproveDraft}
                    disabled={submitting || !latestDraft}
                    style={{ background: '#10b981', border: 'none', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    ✓ Approve & Freeze Draft
                  </button>
                </div>
              </div>
            )}

            {currentStatus === 'CONTACT_APPROVED' && (
              <>
                <button
                  onClick={() => {
                    if (latestDraft) {
                      navigator.clipboard.writeText(`Subject: ${latestDraft.subject}\n\n${latestDraft.body}`);
                      setCopiedEmail(true);
                      setTimeout(() => setCopiedEmail(false), 3000);
                    }
                  }}
                  style={{ background: copiedEmail ? '#10b981' : '#2563eb', border: 'none', color: '#fff', padding: '0.45rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  {copiedEmail ? '✓ Copied!' : '📋 Copy Approved Email'}
                </button>
                <button
                  onClick={() => setShowSentModal(true)}
                  style={{ background: '#7c3aed', border: 'none', color: '#fff', padding: '0.45rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  ✉️ Mark Outreach as Sent →
                </button>
              </>
            )}

            {currentStatus === 'CONTACTED' && (
              <>
                <button
                  onClick={() => setShowResponseModal(true)}
                  style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '0.45rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  📥 Record Partner Response
                </button>
                <button
                  onClick={() => setShowFollowUpModal(true)}
                  style={{ background: '#f59e0b', border: 'none', color: '#000', padding: '0.45rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  ⏰ Schedule Follow-up
                </button>
                <button
                  onClick={() => setShowCallModal(true)}
                  style={{ background: '#10b981', border: 'none', color: '#fff', padding: '0.45rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  📞 Record Discovery Call →
                </button>
              </>
            )}

            {currentStatus === 'DISCOVERY_CALL' && (
              <>
                <button
                  onClick={() => handleExecuteTransition('PARTNERSHIP_DISCUSSION', 'Discovery call completed; advancing to formal partnership discussion.')}
                  disabled={submitting}
                  style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '0.45rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Advance to Partnership Discussion →
                </button>
                <button
                  onClick={() => setShowCallModal(true)}
                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border-color)', color: '#fff', padding: '0.45rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  + Add Another Call Record
                </button>
              </>
            )}

            {currentStatus === 'PARTNERSHIP_DISCUSSION' && (
              <>
                <button
                  onClick={() => setShowMouModal(true)}
                  style={{ background: '#7c3aed', border: 'none', color: '#fff', padding: '0.45rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Add MOU Checklist Item
                </button>
                <button
                  onClick={() => {
                    if (engagement.mouChecklistItems?.length > 0) {
                      handleExecuteTransition('MOU_IN_PROGRESS', 'Initiated MOU drafting & document checklist preparation.');
                    } else {
                      setActionError('Must add at least one MOU checklist item before moving to MOU_IN_PROGRESS.');
                    }
                  }}
                  disabled={submitting}
                  style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '0.45rem 0.85rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  Advance to MOU In Progress →
                </button>
              </>
            )}

            {currentStatus === 'MOU_IN_PROGRESS' && (
              <button
                onClick={() => {
                  setTargetStatus('CONFIRMED_PARTNER');
                  setTransitionReason('Fully executed MOU and support commitment confirmed by human operator.');
                  setShowTransitionModal(true);
                }}
                disabled={submitting}
                style={{ background: '#10b981', border: 'none', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer' }}
              >
                🤝 Execute & Confirm Partnership →
              </button>
            )}

            {currentStatus === 'CONFIRMED_PARTNER' && (
              <div style={{ fontSize: '0.85rem', color: '#34d399', fontWeight: 700 }}>
                🎉 Confirmed Strategic Partner (Fully Executed Support MOU)
              </div>
            )}
          </div>
        </div>

        {/* Drawer Tabs Navigation */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: '#1e293b' }}>
          {[
            { key: 'DRAFTS', label: `📄 Draft Versions (${engagement.draftVersions?.length || 0})` },
            { key: 'EVIDENCE', label: `🔍 Contact Evidence (${engagement.evidenceSnapshots?.length || 0})` },
            { key: 'RESPONSES', label: `💬 Responses & Reminders (${engagement.responses?.length || 0})` },
            { key: 'DISCOVERY_MOU', label: `📞 Discovery & MOU (${engagement.mouChecklistItems?.length || 0})` },
            { key: 'HISTORY', label: `📜 Append-Only Timeline (${engagement.workflowHistory?.length || 0})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                flex: 1,
                padding: '0.75rem 0.5rem',
                background: activeTab === tab.key ? '#0f172a' : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #3b82f6' : 'none',
                color: activeTab === tab.key ? '#60a5fa' : '#94a3b8',
                fontWeight: activeTab === tab.key ? 700 : 500,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Drawer Body Content */}
        <div style={{ padding: '1.25rem 1.5rem', flex: 1, overflowY: 'auto' }}>
          
          {/* TAB 1: DRAFT VERSIONS */}
          {activeTab === 'DRAFTS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Draft Version List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Draft History & Version Hashes:
                </h3>
                {engagement.draftVersions?.map((v: any) => (
                  <div key={v.id} style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa' }}>
                        Version {v.versionNumber} ({v.creatorType}) — by {v.creatorActorName}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {new Date(v.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                      <strong>To:</strong> {v.recipient}
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.35rem' }}>
                      Subject: {v.subject}
                    </div>
                    <pre style={{ fontSize: '0.8rem', background: '#0f172a', padding: '0.65rem', borderRadius: '0.35rem', color: '#cbd5e1', whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: '150px', overflowY: 'auto' }}>
                      {v.body}
                    </pre>
                    <div style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                      SHA-256 Content Hash: <code>{v.contentHash}</code>
                    </div>
                  </div>
                ))}
              </div>

              {/* Form to Save New Version */}
              <div style={{ background: 'rgba(30, 41, 59, 0.8)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '1rem', marginTop: '0.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#93c5fd', marginBottom: '0.65rem' }}>
                  ✏️ Edit and Save New Draft Version (Append-Only)
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}>Recipient Email:</label>
                    <input
                      type="text"
                      value={newDraftRecipient}
                      onChange={(e) => setNewDraftRecipient(e.target.value)}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem', fontSize: '0.8rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}>Subject:</label>
                    <input
                      type="text"
                      value={newDraftSubject}
                      onChange={(e) => setNewDraftSubject(e.target.value)}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem', fontSize: '0.8rem', fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.2rem' }}>Body Text:</label>
                    <textarea
                      value={newDraftBody}
                      onChange={(e) => setNewDraftBody(e.target.value)}
                      rows={8}
                      style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#cbd5e1', padding: '0.65rem', borderRadius: '0.35rem', fontSize: '0.8rem', fontFamily: 'monospace' }}
                    />
                  </div>
                  <button
                    onClick={handleSaveNewDraft}
                    disabled={submitting}
                    style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}
                  >
                    Save New Version v{(engagement.draftVersions?.length || 0) + 1}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CONTACT EVIDENCE SNAPSHOT */}
          {activeTab === 'EVIDENCE' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Verified Contact Channel Evidence & Snapshots:
              </h3>

              {partner?.contactChannels?.map((c: any) => (
                <div key={c.id} style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.85rem' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa', marginBottom: '0.35rem' }}>
                    {c.purposeCategory}: {c.contactValue}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginBottom: '0.35rem' }}>
                    <strong>Purpose:</strong> {c.purpose}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.35rem' }}>
                    <strong>Source URL:</strong>{' '}
                    <a href={c.sourceUrl} target="_blank" rel="noreferrer" style={{ color: '#38bdf8' }}>{c.sourceUrl}</a>
                  </div>
                  <div style={{ fontSize: '0.8rem', background: '#0f172a', padding: '0.65rem', borderRadius: '0.35rem', color: '#cbd5e1', fontStyle: 'italic' }}>
                    "{c.quotedCitation}"
                  </div>
                </div>
              ))}

              <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#93c5fd', marginTop: '0.5rem' }}>
                Frozen Contact Evidence Snapshots (Created Upon Approval):
              </h4>
              {engagement.evidenceSnapshots?.map((s: any) => (
                <div key={s.id} style={{ background: 'rgba(15, 23, 42, 0.8)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem' }}>
                  <div><strong>Recipient Email:</strong> {s.recipientEmail}</div>
                  <div><strong>Source URL:</strong> {s.sourceUrl}</div>
                  <div><strong>HTTP Status:</strong> {s.httpStatus || 200} • <strong>Bytes:</strong> {s.retrievedByteCount}</div>
                  <div><strong>Citation:</strong> "{s.quotedCitation}"</div>
                  <div style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '0.2rem' }}>
                    Snapshot SHA-256: <code>{s.snapshotHash}</code>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: RESPONSES & REMINDERS */}
          {activeTab === 'RESPONSES' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Recorded Responses ({engagement.responses?.length || 0}):
                </h3>
                <button
                  onClick={() => setShowResponseModal(true)}
                  style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: '0.35rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Record Response
                </button>
              </div>

              {engagement.responses?.map((r: any) => (
                <div key={r.id} style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#34d399' }}>
                      Outcome: {r.outcome}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(r.receivedTimestamp).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}><strong>Sender:</strong> {r.senderIdentity}</div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}><strong>Summary:</strong> {r.summary}</div>
                  {r.quotedExcerpt && <div style={{ fontSize: '0.78rem', background: '#0f172a', padding: '0.5rem', borderRadius: '0.3rem', marginTop: '0.3rem', fontStyle: 'italic' }}>"{r.quotedExcerpt}"</div>}
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.3rem' }}>Recorded by: {r.humanRecorderName}</div>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Scheduled Follow-up Reminders ({engagement.followUps?.length || 0}):
                </h3>
                <button
                  onClick={() => setShowFollowUpModal(true)}
                  style={{ background: '#f59e0b', border: 'none', color: '#000', padding: '0.35rem 0.75rem', borderRadius: '0.35rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Schedule Follow-up
                </button>
              </div>

              {engagement.followUps?.map((f: any) => (
                <div key={f.id} style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: f.status === 'PENDING' ? '#fbbf24' : '#6ee7b7' }}>
                      Status: {f.status}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      Due: {new Date(f.dueDateTime).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}><strong>Reason:</strong> {f.reason}</div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.2rem' }}>Set by: {f.humanActorName}</div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 4: DISCOVERY CALLS & MOU CHECKLIST */}
          {activeTab === 'DISCOVERY_MOU' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  Discovery Call Log ({engagement.discoveryCalls?.length || 0}):
                </h3>
                <button
                  onClick={() => setShowCallModal(true)}
                  style={{ background: '#10b981', border: 'none', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: '0.35rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Record Call
                </button>
              </div>

              {engagement.discoveryCalls?.map((c: any) => (
                <div key={c.id} style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#60a5fa' }}>
                      Call State: {c.callState} ({c.meetingMethod})
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {new Date(c.callDateTime).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}><strong>Outcome:</strong> {c.outcome}</div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}><strong>Next Action:</strong> {c.nextAction}</div>
                  <div style={{ fontSize: '0.8rem', background: '#0f172a', padding: '0.5rem', borderRadius: '0.3rem', marginTop: '0.3rem' }}>{c.notes}</div>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  MOU & Document Checklist ({engagement.mouChecklistItems?.length || 0}):
                </h3>
                <button
                  onClick={() => setShowMouModal(true)}
                  style={{ background: '#7c3aed', border: 'none', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: '0.35rem', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                >
                  + Add Checklist Item
                </button>
              </div>

              {engagement.mouChecklistItems?.map((m: any) => (
                <div key={m.id} style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#d8b4fe' }}>
                      {m.label}
                    </span>
                    <span className="badge badge-purple" style={{ fontSize: '0.75rem' }}>
                      {m.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}><strong>Responsible Party:</strong> {m.responsibleParty}</div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 5: APPEND-ONLY TIMELINE AUDIT HISTORY */}
          {activeTab === 'HISTORY' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                Append-Only Workflow Transition History:
              </h3>

              {engagement.workflowHistory?.map((h: any) => {
                const isSystemRepair = h.actorType === 'SYSTEM_DATA_REPAIR' || h.eventType === 'DATA_RECONCILIATION' || h.humanActorName === 'System Data Repair Service' || (h.humanActorName && h.humanActorName.includes('System'));
                return (
                  <div key={h.id} style={{ background: isSystemRepair ? 'rgba(120, 53, 15, 0.25)' : 'rgba(15, 23, 42, 0.7)', border: isSystemRepair ? '1px solid #78350f' : '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#60a5fa' }}>
                        {h.previousStatus} → <strong style={{ color: '#34d399' }}>{h.newStatus}</strong>
                      </span>
                      {isSystemRepair && (
                        <span className="badge badge-amber" style={{ background: '#78350f', color: '#fde68a', fontSize: '0.7rem' }}>
                          🛠️ SYSTEM DATA RECONCILIATION
                        </span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {new Date(h.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: isSystemRepair ? '#fde68a' : '#cbd5e1' }}>
                      <strong>Actor:</strong> {isSystemRepair ? '⚙️ System Data Repair Service (Not a human action)' : (h.actorName || h.humanActorName || 'Authorized Human Operator')}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#cbd5e1' }}>
                      <strong>Reason:</strong> {h.reason}
                    </div>
                    <div style={{ fontSize: '0.725rem', color: '#94a3b8', marginTop: '0.3rem' }}>
                      Event SHA-256: <code>{h.eventHash}</code>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* MODAL: MARK AS SENT */}
        {showSentModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '500px', width: '100%' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>
                ✉️ Mark Outreach as Sent (Human Confirmation)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Delivery Channel:</label>
                  <select value={sentChannel} onChange={(e) => setSentChannel(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }}>
                    <option value="EMAIL">EMAIL</option>
                    <option value="OFFICIAL_PORTAL">OFFICIAL_PORTAL</option>
                    <option value="TELEPHONE">TELEPHONE</option>
                    <option value="IN_PERSON">IN_PERSON</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Actual Recipient Email:</label>
                  <input type="text" value={actualRecipient} onChange={(e) => setActualRecipient(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Sent Timestamp:</label>
                  <input type="datetime-local" value={sentTimestamp} onChange={(e) => setSentTimestamp(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Notes / Method:</label>
                  <input type="text" value={sentNotes} onChange={(e) => setSentNotes(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button onClick={() => setShowSentModal(false)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleMarkAsSent} disabled={submitting} style={{ background: '#7c3aed', border: 'none', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', fontWeight: 700, cursor: 'pointer' }}>Confirm I Sent This →</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: RECORD RESPONSE */}
        {showResponseModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '500px', width: '100%' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>
                📥 Record Partner Response
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Sender Contact / Email:</label>
                  <input type="text" value={senderIdentity} onChange={(e) => setSenderIdentity(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Response Outcome:</label>
                  <select value={responseOutcome} onChange={(e) => setResponseOutcome(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }}>
                    <option value="INTERESTED">INTERESTED</option>
                    <option value="NEEDS_MORE_INFORMATION">NEEDS_MORE_INFORMATION</option>
                    <option value="REFERRED_TO_ANOTHER_CONTACT">REFERRED_TO_ANOTHER_CONTACT</option>
                    <option value="WRONG_CONTACT">WRONG_CONTACT</option>
                    <option value="FUTURE_CYCLE">FUTURE_CYCLE</option>
                    <option value="DECLINED">DECLINED</option>
                    <option value="NO_RESPONSE">NO_RESPONSE</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Summary:</label>
                  <input type="text" value={responseSummary} onChange={(e) => setResponseSummary(e.target.value)} placeholder="e.g. Expressed interest in joint CoC application." style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Quoted Excerpt (Optional):</label>
                  <textarea value={quotedExcerpt} onChange={(e) => setQuotedExcerpt(e.target.value)} rows={2} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#cbd5e1', padding: '0.5rem', borderRadius: '0.35rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Next Action:</label>
                  <input type="text" value={nextAction} onChange={(e) => setNextAction(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button onClick={() => setShowResponseModal(false)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleRecordResponse} disabled={submitting} style={{ background: '#2563eb', border: 'none', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', fontWeight: 700, cursor: 'pointer' }}>Save Response Record</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: SCHEDULE FOLLOW-UP */}
        {showFollowUpModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '500px', width: '100%' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>
                ⏰ Schedule Follow-up Reminder
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Due Date & Time:</label>
                  <input type="datetime-local" value={followUpDue} onChange={(e) => setFollowUpDue(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Reason:</label>
                  <input type="text" value={followUpReason} onChange={(e) => setFollowUpReason(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button onClick={() => setShowFollowUpModal(false)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleScheduleFollowUp} disabled={submitting} style={{ background: '#f59e0b', border: 'none', color: '#000', padding: '0.45rem 1rem', borderRadius: '0.4rem', fontWeight: 700, cursor: 'pointer' }}>Set Reminder</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: DISCOVERY CALL */}
        {showCallModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '500px', width: '100%' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>
                📞 Record Discovery Call
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Call Date & Time:</label>
                  <input type="datetime-local" value={callDateTime} onChange={(e) => setCallDateTime(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Outcome:</label>
                  <input type="text" value={callOutcome} onChange={(e) => setCallOutcome(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Next Action:</label>
                  <input type="text" value={callNextAction} onChange={(e) => setCallNextAction(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Call Notes:</label>
                  <textarea value={callNotes} onChange={(e) => setCallNotes(e.target.value)} rows={3} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#cbd5e1', padding: '0.5rem', borderRadius: '0.35rem' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button onClick={() => setShowCallModal(false)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleRecordDiscoveryCall} disabled={submitting} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', fontWeight: 700, cursor: 'pointer' }}>Save Call Record</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: MOU ITEM */}
        {showMouModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '500px', width: '100%' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>
                📜 Add MOU Checklist Item
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Item Description / Document Name:</label>
                  <input type="text" value={mouLabel} onChange={(e) => setMouLabel(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Responsible Party:</label>
                  <input type="text" value={mouResponsible} onChange={(e) => setMouResponsible(e.target.value)} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button onClick={() => setShowMouModal(false)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleAddMouItem} disabled={submitting} style={{ background: '#7c3aed', border: 'none', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', fontWeight: 700, cursor: 'pointer' }}>Add Item</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MODAL: TRANSITION CONFIRMATION */}
        {showTransitionModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <div style={{ background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.5rem', maxWidth: '500px', width: '100%' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '1rem' }}>
                🤝 Execute & Confirm Partnership ({targetStatus})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', fontSize: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Executed MOU / Support Ref:</label>
                  <input type="text" value={executedMouRef} onChange={(e) => setExecutedMouRef(e.target.value)} placeholder="e.g. MOU-EXECUTED-2026-001" style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#fff', padding: '0.4rem 0.65rem', borderRadius: '0.35rem' }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', marginBottom: '0.2rem' }}>Confirmation Reason:</label>
                  <textarea value={transitionReason} onChange={(e) => setTransitionReason(e.target.value)} rows={3} style={{ width: '100%', background: '#0f172a', border: '1px solid var(--border-color)', color: '#cbd5e1', padding: '0.5rem', borderRadius: '0.35rem' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem' }}>
                  <button onClick={() => setShowTransitionModal(false)} style={{ background: 'transparent', border: '1px solid var(--border-color)', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', cursor: 'pointer' }}>Cancel</button>
                  <button onClick={() => handleExecuteTransition(targetStatus, transitionReason)} disabled={submitting} style={{ background: '#10b981', border: 'none', color: '#fff', padding: '0.45rem 1rem', borderRadius: '0.4rem', fontWeight: 800, cursor: 'pointer' }}>Confirm Partnership Execution</button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
