import React, { useState, useEffect } from 'react';

export interface FundingDocumentVersion {
  id: string;
  fundingDocumentId: string;
  version: number;
  status: 'UPLOADED' | 'PROCESSING' | 'READY' | 'OCR_REQUIRED' | 'FAILED' | 'SUPERSEDED';
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
  pageCount: number;
  extractionVersion: string;
  uploadedByUserId: string;
  uploadedByUser?: { id: string; displayName: string; email: string; role: string } | null;
  createdAt: string;
  processedAt?: string | null;
  failureCode?: string | null;
  failureMessage?: string | null;
}

export interface FundingDocumentData {
  id: string;
  fundingOpportunityId: string;
  documentType: 'OFFICIAL_NOTICE' | 'AMENDMENT' | 'SUPPLEMENTAL' | 'OTHER_OFFICIAL_DOCUMENT';
  title: string;
  officialSourceUrl?: string | null;
  createdAt: string;
  versions: FundingDocumentVersion[];
}

export interface ExtractedPage {
  id: string;
  documentVersionId: string;
  pageNumber: number;
  text: string;
  textHash: string;
  characterCount: number;
  citationRef: string;
  createdAt: string;
}

interface OfficialFundingDocumentsProps {
  opportunityId: string;
  currentUser: any;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const OfficialFundingDocuments: React.FC<OfficialFundingDocumentsProps> = ({
  opportunityId,
  currentUser,
  apiFetch,
}) => {
  const [documents, setDocuments] = useState<FundingDocumentData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState<string>('');
  const [documentType, setDocumentType] = useState<string>('OFFICIAL_NOTICE');
  const [officialSourceUrl, setOfficialSourceUrl] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Page Inspection Modal State
  const [activeVersionForPages, setActiveVersionForPages] = useState<FundingDocumentVersion | null>(null);
  const [pages, setPages] = useState<ExtractedPage[]>([]);
  const [selectedPageNum, setSelectedPageNum] = useState<number>(1);
  const [loadingPages, setLoadingPages] = useState<boolean>(false);

  const isViewer = currentUser?.role === 'VIEWER';

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/opportunities/${opportunityId}/funding-documents`);
      if (res.ok) {
        const json = await res.json();
        setDocuments(json.data || []);
      } else {
        const json = await res.json();
        setError(json.error || 'Failed to load funding documents');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load funding documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (opportunityId) {
      fetchDocuments();
    }
  }, [opportunityId]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a PDF file to upload');
      return;
    }
    if (!title.trim()) {
      setError('Please enter a document title');
      return;
    }

    setUploading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', title.trim());
      formData.append('documentType', documentType);
      if (officialSourceUrl.trim()) {
        formData.append('officialSourceUrl', officialSourceUrl.trim());
      }

      const res = await apiFetch(`/api/opportunities/${opportunityId}/funding-documents`, {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': `upload_${opportunityId}_${Date.now()}`,
        },
        body: formData,
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to upload document');
      }

      setSuccessMessage(`✓ Document "${title}" uploaded and extracted successfully (Version ${json.data.version.version})`);
      setTitle('');
      setOfficialSourceUrl('');
      setSelectedFile(null);
      await fetchDocuments();
    } catch (err: any) {
      setError(err.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleInspectPages = async (version: FundingDocumentVersion) => {
    setActiveVersionForPages(version);
    setLoadingPages(true);
    setSelectedPageNum(1);
    try {
      const res = await apiFetch(`/api/funding-document-versions/${version.id}/pages`);
      if (res.ok) {
        const json = await res.json();
        setPages(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load document pages:', err);
    } finally {
      setLoadingPages(false);
    }
  };

  const handleDownload = async (versionId: string, fileName: string) => {
    try {
      const res = await apiFetch(`/api/funding-document-versions/${versionId}/download`);
      if (!res.ok) throw new Error('Download failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err: any) {
      alert(err.message || 'Failed to download PDF document');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'READY':
        return { background: '#15803d', color: '#bbf7d0', border: '1px solid #22c55e' };
      case 'OCR_REQUIRED':
        return { background: '#854d0e', color: '#fef08a', border: '1px solid #eab308' };
      case 'FAILED':
        return { background: '#9f1239', color: '#fecdd3', border: '1px solid #f43f5e' };
      case 'PROCESSING':
        return { background: '#1e40af', color: '#bfdbfe', border: '1px solid #3b82f6' };
      default:
        return { background: '#334155', color: '#cbd5e1', border: '1px solid #64748b' };
    }
  };

  const selectedPage = pages.find((p) => p.pageNumber === selectedPageNum) || null;

  return (
    <div className="card" style={{ marginTop: '1.5rem', background: 'rgba(15, 23, 42, 0.75)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <span style={{ background: '#0284c7', color: '#e0f2fe', fontWeight: 800, fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', letterSpacing: '0.05em' }}>
            AI-2A CITATION FOUNDATION
          </span>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.35rem' }}>
            📄 Official Funding Documents
          </h3>
        </div>
      </div>

      {/* Mandatory Disclaimer Box */}
      <div style={{ padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '0.5rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
        ℹ️ <strong>Document Evidence Notice:</strong> Extracted document text is preserved for evidence review and future grounded analysis. Verify critical requirements against the original official PDF. This phase does not perform AI retrieval or eligibility analysis.
      </div>

      {error && (
        <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.375rem', color: '#fca5a5', fontSize: '0.85rem' }}>
          ❌ {error}
        </div>
      )}

      {successMessage && (
        <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '0.375rem', color: '#86efac', fontSize: '0.85rem' }}>
          {successMessage}
        </div>
      )}

      {/* Upload Form (Disabled for VIEWER) */}
      {!isViewer && (
        <form onSubmit={handleUploadSubmit} style={{ background: '#1e293b', padding: '1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)', marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: '#e2e8f0', marginBottom: '0.75rem' }}>
            📤 Upload Official Notice PDF
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Document Type</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid var(--border-color)', padding: '0.45rem', borderRadius: '0.375rem', fontSize: '0.8rem' }}
              >
                <option value="OFFICIAL_NOTICE">Official Notice / FOA / NOFO</option>
                <option value="AMENDMENT">Official Amendment</option>
                <option value="SUPPLEMENTAL">Supplemental Guidance</option>
                <option value="OTHER_OFFICIAL_DOCUMENT">Other Official Document</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Title *</label>
              <input
                type="text"
                placeholder="e.g. Official Solicitation Notice & Guidelines"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid var(--border-color)', padding: '0.45rem', borderRadius: '0.375rem', fontSize: '0.8rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Official Source URL (Optional)</label>
              <input
                type="url"
                placeholder="https://www.grants.gov/search-results-detail/..."
                value={officialSourceUrl}
                onChange={(e) => setOfficialSourceUrl(e.target.value)}
                style={{ width: '100%', background: '#0f172a', color: '#f8fafc', border: '1px solid var(--border-color)', padding: '0.45rem', borderRadius: '0.375rem', fontSize: '0.8rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              style={{ fontSize: '0.8rem', color: '#cbd5e1' }}
            />
            <button
              type="submit"
              disabled={uploading || !selectedFile || !title.trim()}
              style={{
                background: uploading ? '#475569' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: 'none',
                padding: '0.5rem 1.25rem',
                borderRadius: '0.375rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: uploading || !selectedFile ? 'not-allowed' : 'pointer',
              }}
            >
              {uploading ? '⏳ Uploading & Extracting PDF...' : '🚀 Upload & Extract Pages'}
            </button>
          </div>
        </form>
      )}

      {/* Document List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '1.5rem', color: '#94a3b8', fontSize: '0.85rem' }}>Loading funding documents...</div>
      ) : documents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem', background: 'rgba(30, 41, 59, 0.4)', borderRadius: '0.5rem', border: '1px border-dashed rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '0.85rem' }}>
          No official funding documents uploaded for this opportunity yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {documents.map((doc) => {
            const latestVersion = doc.versions[0];
            return (
              <div key={doc.id} style={{ background: '#1e293b', border: '1px solid var(--border-color)', borderRadius: '0.5rem', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ background: '#334155', color: '#38bdf8', fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '0.2rem' }}>
                        {doc.documentType}
                      </span>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>{doc.title}</h4>
                    </div>
                    {doc.officialSourceUrl && (
                      <a href={doc.officialSourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: '#38bdf8', textDecoration: 'underline' }}>
                        🔗 Official Source URL
                      </a>
                    )}
                  </div>

                  {latestVersion && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontWeight: 700, ...getStatusBadgeStyle(latestVersion.status) }}>
                        {latestVersion.status} (v{latestVersion.version})
                      </span>
                      {latestVersion.status === 'READY' && (
                        <button
                          onClick={() => handleInspectPages(latestVersion)}
                          style={{ background: '#0284c7', color: '#ffffff', border: 'none', padding: '0.3rem 0.65rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
                        >
                          🔍 Inspect Extracted Pages ({latestVersion.pageCount})
                        </button>
                      )}
                      <button
                        onClick={() => handleDownload(latestVersion.id, latestVersion.originalFileName)}
                        style={{ background: '#334155', color: '#f8fafc', border: '1px solid var(--border-color)', padding: '0.3rem 0.65rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
                      >
                        ⬇️ Download Original PDF
                      </button>
                    </div>
                  )}
                </div>

                {/* Version History Table */}
                <div style={{ marginTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.4rem' }}>Version History ({doc.versions.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    {doc.versions.map((ver) => (
                      <div key={ver.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.75rem', color: '#cbd5e1', background: 'rgba(15, 23, 42, 0.4)', padding: '0.4rem 0.6rem', borderRadius: '0.25rem' }}>
                        <div>
                          <strong>v{ver.version}</strong> — {ver.originalFileName} ({formatBytes(ver.sizeBytes)}) | {ver.pageCount} pages | Version: <code>{ver.extractionVersion}</code> | Uploaded by <em>{ver.uploadedByUser?.displayName || 'User'}</em> on {new Date(ver.createdAt).toLocaleString()}
                        </div>
                        <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#64748b' }}>
                          SHA256: {ver.sha256.substring(0, 16)}...
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Extracted Page Viewer Modal */}
      {activeVersionForPages && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: '#0f172a', border: '1px solid var(--border-color)', borderRadius: '0.75rem', width: '900px', maxWidth: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>

              <div>
                <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                  📄 Extracted Page Text Inspector — v{activeVersionForPages.version}
                </h4>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                  {activeVersionForPages.originalFileName} | Total Pages: {activeVersionForPages.pageCount} | Extraction Engine: <code>{activeVersionForPages.extractionVersion}</code>
                </div>
              </div>
              <button
                onClick={() => setActiveVersionForPages(null)}
                style={{ background: 'transparent', color: '#94a3b8', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✖
              </button>
            </div>

            {loadingPages ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading page text...</div>
            ) : pages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>No page text available.</div>
            ) : (
              <div style={{ display: 'flex', gap: '1rem', flex: 1, overflow: 'hidden' }}>
                {/* Page Navigation List */}
                <div style={{ width: '180px', overflowY: 'auto', borderRight: '1px solid var(--border-color)', paddingRight: '0.5rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', marginBottom: '0.5rem' }}>Pages ({pages.length})</div>
                  {pages.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPageNum(p.pageNumber)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '0.4rem 0.6rem',
                        marginBottom: '0.25rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        background: p.pageNumber === selectedPageNum ? '#0284c7' : '#1e293b',
                        color: p.pageNumber === selectedPageNum ? '#ffffff' : '#cbd5e1',
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      Page {p.pageNumber} ({p.characterCount} chars)
                    </button>
                  ))}
                </div>

                {/* Page Content Display */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {selectedPage && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', padding: '0.5rem 0.75rem', borderRadius: '0.375rem', marginBottom: '0.75rem', fontSize: '0.75rem' }}>
                        <div>
                          Citation Reference: <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{selectedPage.citationRef}</strong>
                        </div>
                        <div style={{ color: '#94a3b8' }}>
                          Hash: <code style={{ color: '#cbd5e1' }}>{selectedPage.textHash.substring(0, 16)}...</code>
                        </div>
                      </div>

                      {/* Plain Text Render Node */}
                      <pre style={{ flex: 1, overflowY: 'auto', background: '#020617', padding: '1rem', borderRadius: '0.375rem', border: '1px solid var(--border-color)', color: '#e2e8f0', fontSize: '0.8rem', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, lineHeight: 1.5 }}>
                        {selectedPage.text || '[EMPTY PAGE]'}
                      </pre>

                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
