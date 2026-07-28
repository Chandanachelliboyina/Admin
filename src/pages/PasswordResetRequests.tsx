import { useState, useEffect, useCallback } from 'react';
import {
  KeyRound, CheckCircle2, XCircle, Clock, Trash2, RefreshCw,
  Lock, User, Mail, FileText, Search, Filter, AlertCircle
} from 'lucide-react';
import { API_BASE_URL } from '../config';

type RequestStatus = 'pending' | 'approved' | 'rejected';

interface ResetRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  email: string;
  reason: string;
  status: RequestStatus;
  created_at: string;
  resolved_at: string | null;
  rejection_reason: string;
}

interface ActionModalState {
  open: boolean;
  request: ResetRequest | null;
  action: 'approve' | 'reject' | null;
}

const statusBadge = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 border-rose-200',
};

const statusIcon = {
  pending: Clock,
  approved: CheckCircle2,
  rejected: XCircle,
};

export function PasswordResetRequests() {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | RequestStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionModal, setActionModal] = useState<ActionModalState>({ open: false, request: null, action: null });
  const [newPassword, setNewPassword] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3500);
  };

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const url = filterStatus !== 'all'
        ? `${API_BASE_URL}/api/password-reset-requests?status=${filterStatus}`
        : `${API_BASE_URL}/api/password-reset-requests`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data) ? data : []);
      } else {
        setRequests([]);
      }
    } catch (err) {
      console.error('Failed to fetch reset requests:', err);
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const safeRequests = Array.isArray(requests) ? requests : [];
  const pendingCount = safeRequests.filter(r => (r?.status || '').toLowerCase() === 'pending').length;

  const filtered = safeRequests.filter(r => {
    if (!r) return false;
    const q = (searchQuery || '').toLowerCase();
    const empId = (r.employee_id || '').toLowerCase();
    const empName = (r.employee_name || '').toLowerCase();
    const email = (r.email || '').toLowerCase();
    return !q || empId.includes(q) || empName.includes(q) || email.includes(q);
  });

  const openApprove = (req: ResetRequest) => {
    setActionModal({ open: true, request: req, action: 'approve' });
    setNewPassword('');
    setRejectionReason('');
    setActionError('');
  };

  const openReject = (req: ResetRequest) => {
    setActionModal({ open: true, request: req, action: 'reject' });
    setNewPassword('');
    setRejectionReason('');
    setActionError('');
  };

  const closeModal = () => {
    setActionModal({ open: false, request: null, action: null });
    setNewPassword('');
    setRejectionReason('');
    setActionError('');
  };

  const handleAction = async () => {
    if (!actionModal.request || !actionModal.action) return;
    setActionError('');

    if (actionModal.action === 'approve' && !actionModal.request) {
      setActionError('Invalid request.');
      return;
    }

    setIsProcessing(true);
    try {
      const body: any = { action: actionModal.action };
      if (actionModal.action === 'approve') body.new_password = newPassword;
      if (actionModal.action === 'reject') body.rejection_reason = rejectionReason;

      const res = await fetch(`${API_BASE_URL}/api/password-reset-requests/${actionModal.request.id}/action`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.detail || 'Action failed. Please try again.');
        return;
      }
      closeModal();
      showToast(
        actionModal.action === 'approve'
          ? `Password reset approved for ${actionModal.request.employee_name}`
          : `Request rejected for ${actionModal.request.employee_name}`,
        'success'
      );
      fetchRequests();
    } catch (err) {
      setActionError('Connection error. Please check that the server is running.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (req: ResetRequest) => {
    if (!confirm(`Delete this password reset request from ${req.employee_name}?`)) return;
    try {
      await fetch(`${API_BASE_URL}/api/password-reset-requests/${req.id}`, { method: 'DELETE' });
      showToast('Request deleted.', 'success');
      fetchRequests();
    } catch (err) {
      showToast('Failed to delete request.', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 relative">
      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl text-sm font-semibold transition-all ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Password Reset Requests</h1>
            {pendingCount > 0 && (
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500 text-white text-xs font-bold animate-pulse">
                {pendingCount}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">Review and approve or reject employee password reset requests.</p>
        </div>
        <button
          onClick={fetchRequests}
          id="refresh-requests-btn"
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted transition-colors self-start md:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {(['pending', 'approved', 'rejected'] as RequestStatus[]).map((s) => {
          const count = safeRequests.filter(r => (r?.status || '').toLowerCase() === s).length;
          const Icon = statusIcon[s] || Clock;
          const colors = {
            pending: 'bg-amber-50 border-amber-200 text-amber-600',
            approved: 'bg-emerald-50 border-emerald-200 text-emerald-600',
            rejected: 'bg-rose-50 border-rose-200 text-rose-600',
          };
          return (
            <button
              key={s}
              onClick={() => setFilterStatus(filterStatus === s ? 'all' : s)}
              className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all hover:scale-[1.02] ${filterStatus === s ? colors[s] + ' ring-2 ring-offset-1 ring-current' : 'bg-card border-border hover:border-gray-300'}`}
            >
              <Icon className={`w-5 h-5 ${filterStatus === s ? '' : 'text-muted-foreground'}`} />
              <div className="text-left">
                <p className={`text-2xl font-bold ${filterStatus === s ? '' : 'text-foreground'}`}>{count}</p>
                <p className={`text-xs font-medium capitalize ${filterStatus === s ? '' : 'text-muted-foreground'}`}>{s}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, ID, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="search-requests-input"
            className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="w-10 h-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            <p className="text-muted-foreground text-sm">Loading requests...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <KeyRound className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-muted-foreground font-medium">No password reset requests found.</p>
            {filterStatus !== 'all' && (
              <button onClick={() => setFilterStatus('all')} className="text-primary text-sm hover:underline">Clear filter</button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((req) => {
              const statusKey = ((req?.status || 'pending').toLowerCase()) as RequestStatus;
              const Icon = statusIcon[statusKey] || Clock;
              const badgeClass = statusBadge[statusKey] || statusBadge.pending;
              return (
                <div key={req.id} className="p-5 hover:bg-muted/20 transition-colors group">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Info */}
                    <div className="flex items-start gap-4 min-w-0">
                      <div className={`p-2.5 rounded-xl border ${badgeClass} shrink-0`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-foreground">{req.employee_name || req.employee_id}</span>
                          {req.employee_id && (
                            <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
                              {req.employee_id}
                            </span>
                          )}
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${badgeClass}`}>
                            {statusKey.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{req.email}</span>
                        </div>
                        {req.reason && (
                          <p className="text-sm text-muted-foreground mt-1 flex items-start gap-1">
                            <FileText className="w-3 h-3 mt-0.5 shrink-0" />
                            <span className="line-clamp-2">{req.reason}</span>
                          </p>
                        )}
                        {statusKey === 'rejected' && req.rejection_reason && (
                          <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Rejected: {req.rejection_reason}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Submitted: {req.created_at}
                          {req.resolved_at && <span className="ml-3">Resolved: {req.resolved_at}</span>}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      {statusKey === 'pending' && (
                        <>
                          <button
                            onClick={() => openApprove(req)}
                            id={`approve-btn-${req.id}`}
                            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => openReject(req)}
                            id={`reject-btn-${req.id}`}
                            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white text-sm font-semibold rounded-xl hover:bg-rose-700 transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(req)}
                        id={`delete-btn-${req.id}`}
                        className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete request"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Modal */}
      {actionModal.open && actionModal.request && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b border-border flex items-center gap-3 ${actionModal.action === 'approve' ? 'bg-emerald-50' : 'bg-rose-50'}`}>
              {actionModal.action === 'approve' ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-600" />
              )}
              <div>
                <h2 className="font-bold text-lg text-foreground">
                  {actionModal.action === 'approve' ? 'Approve Password Reset' : 'Reject Password Reset Request'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {actionModal.action === 'approve'
                    ? 'Approve and activate the employee\'s requested new password'
                    : 'Reject this employee request'}
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Employee Info */}
              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <span className="font-semibold">{actionModal.request.employee_name}</span>
                  <span className="text-muted-foreground font-mono text-xs">({actionModal.request.employee_id})</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="w-4 h-4" />
                  {actionModal.request.email}
                </div>
                {actionModal.request.reason && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <FileText className="w-4 h-4 mt-0.5" />
                    <span>{actionModal.request.reason}</span>
                  </div>
                )}
              </div>

              {/* Approve: Confirmation note */}
              {actionModal.action === 'approve' && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <p className="text-sm font-semibold text-emerald-800 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-600" />
                    Approve Reset Request
                  </p>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    By approving, the request for {actionModal.request.employee_name || actionModal.request.employee_id} will be approved and activated.
                  </p>
                </div>
              )}

              {/* Reject: reason input */}
              {actionModal.action === 'reject' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">
                    Rejection Reason <span className="font-normal text-muted-foreground">(optional)</span>
                  </label>
                  <textarea
                    id="rejection-reason-input"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={3}
                    placeholder="Explain why this request is being rejected..."
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/30 focus:border-rose-400 resize-none"
                  />
                </div>
              )}

              {actionError && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm text-rose-600">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {actionError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={closeModal}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAction}
                  id="confirm-action-btn"
                  disabled={isProcessing}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                    actionModal.action === 'approve'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {isProcessing ? (
                    <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Processing...</>
                  ) : actionModal.action === 'approve' ? (
                    <><CheckCircle2 className="w-4 h-4" /> Confirm Approval</>
                  ) : (
                    <><XCircle className="w-4 h-4" /> Reject Request</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
