import { useState, useEffect, useCallback } from 'react';
import { Check, X, Clock, Info, Loader2, Trash2, BarChart3, CalendarDays, TrendingUp, Users, AlertCircle, Download, Search, Calendar as CalendarIcon, Filter, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  attachment?: string;
}

interface MonthlyReportItem {
  id: string;
  employeeId: string;
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  attachment?: string;
}

interface MonthlyReportData {
  year: number;
  month: number;
  monthName: string;
  monthYear: string;
  summary: {
    totalDays: number;
    approvedDays: number;
    pendingDays: number;
    rejectedDays: number;
    casualDays: number;
    sickDays: number;
    employeesOnLeave: number;
    totalRequests: number;
  };
  leaves: MonthlyReportItem[];
}

interface YearlyReportRow {
  month: string;
  year: number;
  monthYear: string;
  totalDays: number;
  approvedDays: number;
  pendingDays: number;
  rejectedDays: number;
  casualDays: number;
  sickDays: number;
  employeesOnLeave: number;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getFinancialYear() {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

export function LeaveManagement() {
  const [activeTab, setActiveTab] = useState<'requests' | 'monthly-report' | 'yearly-report'>('requests');
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('Pending');

  // Monthly Wise Report State
  const now = new Date();
  const [reportMonth, setReportMonth] = useState<number>(now.getMonth() + 1);
  const [reportYear, setReportYear] = useState<number>(now.getFullYear());
  const [monthlyData, setMonthlyData] = useState<MonthlyReportData | null>(null);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlySearch, setMonthlySearch] = useState('');
  const [monthlyStatusFilter, setMonthlyStatusFilter] = useState<string>('All');

  // Yearly report state
  const [yearlyReport, setYearlyReport] = useState<YearlyReportRow[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(getFinancialYear());
  const [selectedMonthDetail, setSelectedMonthDetail] = useState<string | null>(null);

  const fetchLeaves = async () => {
    try {
      const leavesRes = await fetch(`${API_BASE_URL}/api/leaves`);
      if (leavesRes.ok) {
        const data = await leavesRes.json();
        if (Array.isArray(data)) setRequests(data);
      }
    } catch (error) {
      console.error('Failed to fetch leaves:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMonthlyReport = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/monthly-report?year=${reportYear}&month=${reportMonth}`);
      if (res.ok) {
        const data = await res.json();
        setMonthlyData(data);
      }
    } catch (err) {
      console.error('Failed to fetch monthly report:', err);
    } finally {
      setMonthlyLoading(false);
    }
  }, [reportYear, reportMonth]);

  const fetchYearlyReport = useCallback(async () => {
    setReportLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/leaves/yearly-report?year=${selectedYear}`);
      if (res.ok) {
        const data = await res.json();
        setYearlyReport(data);
      }
    } catch (err) {
      console.error('Failed to fetch yearly report:', err);
    } finally {
      setReportLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    fetchLeaves();
    const timer = setInterval(fetchLeaves, 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTab === 'monthly-report') fetchMonthlyReport();
  }, [activeTab, fetchMonthlyReport]);

  useEffect(() => {
    if (activeTab === 'yearly-report') fetchYearlyReport();
  }, [activeTab, fetchYearlyReport]);

  const handleStatusUpdate = async (id: string, newStatus: 'Approved' | 'Rejected') => {
    setRequests(requests.map(req => req.id === id ? { ...req, status: newStatus } : req));
    try {
      await fetch(`${API_BASE_URL}/api/leaves/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (err) {
      console.error('Failed to update status', err);
    }
    setTimeout(fetchLeaves, 1000);
    if (activeTab === 'monthly-report') fetchMonthlyReport();
  };

  const exportMonthlyCSV = () => {
    if (!monthlyData || !monthlyData.leaves.length) {
      alert('No leave data available to export for this month.');
      return;
    }

    const headers = ['Employee ID', 'Employee Name', 'Leave Type', 'Start Date', 'End Date', 'Leave Days', 'Reason', 'Status'];
    const csvRows = [headers.join(',')];

    monthlyData.leaves.forEach(l => {
      const row = [
        `"${l.employeeId || ''}"`,
        `"${l.employeeName || ''}"`,
        `"${l.type || ''}"`,
        `"${l.startDate || ''}"`,
        `"${l.endDate || ''}"`,
        l.daysCount,
        `"${(l.reason || '').replace(/"/g, '""')}"`,
        `"${l.status || ''}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Leave_Report_${MONTH_NAMES[reportMonth - 1]}_${reportYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pendingCount = requests.filter(r => r.status === 'Pending').length;

  const yearTotals = yearlyReport.reduce(
    (acc, m) => ({
      total: acc.total + m.totalDays,
      approved: acc.approved + m.approvedDays,
      pending: acc.pending + m.pendingDays,
      casual: acc.casual + m.casualDays,
      sick: acc.sick + m.sickDays,
    }),
    { total: 0, approved: 0, pending: 0, casual: 0, sick: 0 }
  );

  const maxTotal = Math.max(...yearlyReport.map(m => m.totalDays), 1);

  // Filtered monthly leaves list
  const filteredMonthlyLeaves = (monthlyData?.leaves || []).filter(item => {
    const matchesSearch = 
      item.employeeName.toLowerCase().includes(monthlySearch.toLowerCase()) ||
      item.employeeId.toLowerCase().includes(monthlySearch.toLowerCase()) ||
      item.reason.toLowerCase().includes(monthlySearch.toLowerCase());
    const matchesStatus = monthlyStatusFilter === 'All' || item.status === monthlyStatusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Leave Management</h1>
          <p className="text-muted-foreground mt-1">
            Review leave requests, view monthly reports, &amp; track yearly balance analytics.
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <div className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 px-3 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 inline-flex items-center gap-1.5 font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span><strong>Approved:</strong> Minus leave balance (-1/day)</span>
            </div>
            <div className="text-xs bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1.5 font-medium">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              <span><strong>Pending/Rejected:</strong> No balance deduction</span>
            </div>
            <div className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-lg border border-primary/20 inline-flex items-center gap-1.5 font-medium">
              <Clock className="w-3.5 h-3.5" />
              <span>Sundays excluded from leave days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-border gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
            activeTab === 'requests'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Leave Requests
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('monthly-report')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
            activeTab === 'monthly-report'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
          Monthly Wise Report
        </button>
        <button
          onClick={() => setActiveTab('yearly-report')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors whitespace-nowrap ${
            activeTab === 'yearly-report'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Yearly Overview
        </button>
      </div>

      {/* ── TAB 1: Leave Requests ── */}
      {activeTab === 'requests' && (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Leave Requests</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Approve to deduct leave balance. Pending or rejected requests do not deduct balance.</p>
            </div>
            <div className="flex items-center space-x-3">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="text-sm border border-input rounded-md px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="All">All Requests</option>
                <option value="Pending">Pending Only</option>
                <option value="Approved">Approved Only</option>
                <option value="Rejected">Rejected Only</option>
              </select>
              <span className="text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">Live Updates</span>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {requests.filter(req => filter === 'All' || req.status === filter).length === 0 && (
                <div className="p-12 text-center text-muted-foreground">
                  <AlertCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p>No leave requests found for the selected filter.</p>
                </div>
              )}
              {requests.filter(req => filter === 'All' || req.status === filter).map((request) => (
                <div key={request.id} className="p-6 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <span className="font-semibold text-foreground text-lg">{request.employeeName}</span>
                        <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 bg-muted rounded-full">{request.employeeId}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          request.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                          request.status === 'Approved' ? 'bg-emerald-100 text-emerald-800 font-semibold' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {request.status} {request.status === 'Approved' ? '(Deducted)' : '(No Deduction)'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-sm text-muted-foreground flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          request.type?.includes('Sick') ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {request.type}
                        </span>
                        <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> {request.startDate} to {request.endDate}</span>
                      </div>
                      <p className="text-sm text-foreground/80 mt-2 bg-background p-3 rounded-lg border border-border">
                        <span className="font-medium text-foreground">Reason:</span> {request.reason}
                      </p>
                      {request.attachment && (
                        <div className="mt-3">
                          <span className="text-xs font-medium text-muted-foreground block mb-1">Medical Attachment:</span>
                          <img src={request.attachment} alt="Medical Certificate" className="h-28 w-44 object-cover rounded-md border border-border shadow-sm hover:scale-105 transition-transform duration-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2 shrink-0 pt-2">
                      {request.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleStatusUpdate(request.id, 'Approved')}
                            className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-medium text-xs shadow-sm"
                            title="Approve leave and deduct from employee balance"
                          >
                            <Check className="w-4 h-4" /> Approve (-1 Day)
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(request.id, 'Rejected')}
                            className="flex items-center gap-1 px-3 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition-colors font-medium text-xs"
                            title="Reject leave without balance deduction"
                          >
                            <X className="w-4 h-4" /> Reject
                          </button>
                        </>
                      )}
                      {request.status === 'Approved' && (
                        <button
                          onClick={() => handleStatusUpdate(request.id, 'Rejected')}
                          className="px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-medium border border-amber-200 transition-colors"
                          title="Revoke approval and restore balance"
                        >
                          Revoke Approval
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!confirm('Are you sure you want to delete this leave request? If approved, balance will be restored.')) return;
                          try {
                            await fetch(`${API_BASE_URL}/api/leaves/${request.id}`, { method: 'DELETE' });
                            setRequests(requests.filter(r => r.id !== request.id));
                          } catch (e) {
                            console.error(e);
                            alert('Failed to delete leave request');
                          }
                        }}
                        className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        title="Delete Request"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Monthly Wise Report ── */}
      {activeTab === 'monthly-report' && (
        <div className="space-y-6">
          {/* Controls: Month, Year, Search, Export */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-primary" />
                  <label className="text-sm font-semibold text-foreground">Month:</label>
                  <select
                    value={reportMonth}
                    onChange={(e) => setReportMonth(Number(e.target.value))}
                    className="text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                  >
                    {MONTH_NAMES.map((m, idx) => (
                      <option key={m} value={idx + 1}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-foreground">Year:</label>
                  <select
                    value={reportYear}
                    onChange={(e) => setReportYear(Number(e.target.value))}
                    className="text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                  >
                    {[2024, 2025, 2026, 2027].map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={fetchMonthlyReport}
                  disabled={monthlyLoading}
                  className="px-3.5 py-2 text-xs font-semibold bg-primary/10 text-primary hover:bg-primary/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  {monthlyLoading ? 'Loading...' : 'Fetch Report'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={exportMonthlyCSV}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-xs transition-colors shadow-sm"
                >
                  <Download className="w-4 h-4" /> Export CSV Report
                </button>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 border-t border-border">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by Employee Name, ID, or Reason..."
                  value={monthlySearch}
                  onChange={(e) => setMonthlySearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
                <select
                  value={monthlyStatusFilter}
                  onChange={(e) => setMonthlyStatusFilter(e.target.value)}
                  className="text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary w-full sm:w-auto"
                >
                  <option value="All">All Statuses</option>
                  <option value="Approved">Approved Only</option>
                  <option value="Pending">Pending Only</option>
                  <option value="Rejected">Rejected Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Monthly KPI Cards */}
          {monthlyData && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-900/50">
                <p className="text-xs text-muted-foreground font-medium">Total Requests</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{monthlyData.summary.totalRequests || 0}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{monthlyData.summary.totalDays || 0} leave days</p>
              </div>
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">Approved (Deducted)</p>
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{monthlyData.summary.approvedDays || 0}</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">Days subtracted</p>
              </div>
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Pending Days</p>
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{monthlyData.summary.pendingDays || 0}</p>
                <p className="text-[11px] text-amber-600 mt-0.5">No deduction yet</p>
              </div>
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/30">
                <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">Rejected Days</p>
                <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{monthlyData.summary.rejectedDays || 0}</p>
                <p className="text-[11px] text-rose-600 mt-0.5">Not deducted</p>
              </div>
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/30">
                <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">Casual Days</p>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{monthlyData.summary.casualDays || 0}</p>
                <p className="text-[11px] text-blue-600 mt-0.5">Casual leave</p>
              </div>
              <div className="p-4 rounded-xl border border-purple-200 bg-purple-50 dark:bg-purple-950/30">
                <p className="text-xs text-purple-700 dark:text-purple-400 font-medium">Sick Days</p>
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{monthlyData.summary.sickDays || 0}</p>
                <p className="text-[11px] text-purple-600 mt-0.5">Sick leave</p>
              </div>
            </div>
          )}

          {/* Monthly Employee Details Table */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                Monthly Report — {MONTH_NAMES[reportMonth - 1]} {reportYear}
              </h2>
              <span className="text-xs font-semibold bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                {filteredMonthlyLeaves.length} Record{filteredMonthlyLeaves.length !== 1 ? 's' : ''}
              </span>
            </div>

            {monthlyLoading ? (
              <div className="p-12 flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Generating monthly report...</p>
              </div>
            ) : filteredMonthlyLeaves.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No leave records found for {MONTH_NAMES[reportMonth - 1]} {reportYear}.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border text-left">
                      <th className="px-5 py-3 font-semibold text-foreground">Employee</th>
                      <th className="px-4 py-3 font-semibold text-foreground">Leave Type</th>
                      <th className="px-4 py-3 font-semibold text-foreground">Duration</th>
                      <th className="px-4 py-3 font-semibold text-center text-foreground">Days</th>
                      <th className="px-4 py-3 font-semibold text-foreground">Reason</th>
                      <th className="px-4 py-3 font-semibold text-center text-foreground">Status &amp; Balance Impact</th>
                      <th className="px-5 py-3 font-semibold text-right text-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredMonthlyLeaves.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                        <td className="px-5 py-3.5">
                          <div>
                            <p className="font-semibold text-foreground">{item.employeeName}</p>
                            <p className="text-xs font-mono text-muted-foreground">{item.employeeId}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.type?.includes('Sick') ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {item.type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">
                          {item.startDate} to {item.endDate}
                        </td>
                        <td className="px-4 py-3.5 text-center font-bold text-foreground">
                          {item.daysCount}
                        </td>
                        <td className="px-4 py-3.5 max-w-xs">
                          <p className="text-xs text-foreground/80 truncate" title={item.reason}>{item.reason}</p>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            item.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                            item.status === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {item.status} ({item.status === 'Approved' ? `-${item.daysCount} Balance` : 'No Minus'})
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {item.status === 'Pending' && (
                            <button
                              onClick={() => handleStatusUpdate(item.id, 'Approved')}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
                            >
                              Approve
                            </button>
                          )}
                          {item.status === 'Approved' && (
                            <span className="text-xs text-emerald-600 font-medium">Deducted</span>
                          )}
                          {item.status === 'Rejected' && (
                            <span className="text-xs text-rose-500 font-medium">Rejected</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: Yearly Overview ── */}
      {activeTab === 'yearly-report' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-foreground">Financial Year:</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-sm border border-input rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>Apr {y} – Mar {y + 1}</option>
                ))}
              </select>
            </div>
            <button
              onClick={fetchYearlyReport}
              disabled={reportLoading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              <TrendingUp className={`w-4 h-4 ${reportLoading ? 'animate-pulse' : ''}`} />
              {reportLoading ? 'Loading...' : 'Refresh Report'}
            </button>
          </div>

          {!reportLoading && yearlyReport.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Leave Days', value: yearTotals.total, color: 'bg-slate-50 border-slate-200', text: 'text-slate-700', sub: 'Full year' },
                { label: 'Approved Days (Deducted)', value: yearTotals.approved, color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', sub: 'Subtracted from quota' },
                { label: 'Casual Days', value: yearTotals.casual, color: 'bg-blue-50 border-blue-200', text: 'text-blue-700', sub: 'Casual leave' },
                { label: 'Sick Days', value: yearTotals.sick, color: 'bg-rose-50 border-rose-200', text: 'text-rose-700', sub: 'Sick leave' },
              ].map(card => (
                <div key={card.label} className={`p-4 rounded-xl border-2 ${card.color}`}>
                  <p className="text-xs text-muted-foreground font-medium mb-1">{card.label}</p>
                  <p className={`text-3xl font-bold ${card.text}`}>{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Month-by-Month Leave Breakdown
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Apr {selectedYear} – Mar {selectedYear + 1}</p>
              </div>
            </div>

            {reportLoading ? (
              <div className="p-12 flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                <p className="text-sm text-muted-foreground">Generating yearly report...</p>
              </div>
            ) : yearlyReport.length === 0 ? (
              <div className="p-12 text-center">
                <AlertCircle className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No leave data available for this year.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-5 py-3 font-semibold text-foreground">Month</th>
                      <th className="text-center px-4 py-3 font-semibold text-foreground">Total Days</th>
                      <th className="text-center px-4 py-3 font-semibold text-emerald-700">Approved</th>
                      <th className="text-center px-4 py-3 font-semibold text-amber-700">Pending</th>
                      <th className="text-center px-4 py-3 font-semibold text-rose-700">Rejected</th>
                      <th className="text-center px-4 py-3 font-semibold text-blue-700">Casual</th>
                      <th className="text-center px-4 py-3 font-semibold text-purple-700">Sick</th>
                      <th className="text-center px-4 py-3 font-semibold text-foreground">
                        <Users className="w-4 h-4 inline mr-1" />Emps on Leave
                      </th>
                      <th className="px-5 py-3 font-semibold text-foreground">Trend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {yearlyReport.map((row) => {
                      const isCurrentMonth = row.year === now.getFullYear() && row.month === ['', 'Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth() + 1];
                      const barWidth = maxTotal > 0 ? Math.round((row.totalDays / maxTotal) * 100) : 0;
                      const isSelected = selectedMonthDetail === row.monthYear;

                      return (
                        <tr
                          key={row.monthYear}
                          onClick={() => setSelectedMonthDetail(isSelected ? null : row.monthYear)}
                          className={`cursor-pointer transition-colors hover:bg-muted/40 ${isSelected ? 'bg-primary/5' : ''} ${isCurrentMonth ? 'font-semibold' : ''}`}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span>{row.monthYear}</span>
                              {isCurrentMonth && (
                                <span className="text-[10px] font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">NOW</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-foreground">{row.totalDays}</td>
                          <td className="px-4 py-3.5 text-center font-semibold text-emerald-600">{row.approvedDays}</td>
                          <td className="px-4 py-3.5 text-center font-semibold text-amber-600">{row.pendingDays}</td>
                          <td className="px-4 py-3.5 text-center font-semibold text-rose-600">{row.rejectedDays}</td>
                          <td className="px-4 py-3.5 text-center font-semibold text-blue-600">{row.casualDays}</td>
                          <td className="px-4 py-3.5 text-center font-semibold text-purple-600">{row.sickDays}</td>
                          <td className="px-4 py-3.5 text-center">
                            {row.employeesOnLeave > 0 ? (
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                {row.employeesOnLeave}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden min-w-[60px]">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground w-7 text-right">{barWidth}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
