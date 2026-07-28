import { useState, useEffect, useCallback } from 'react';
import { Check, X, Clock, Info, Loader2, Trash2, BarChart3, CalendarDays, TrendingUp, Users, AlertCircle } from 'lucide-react';
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

interface MonthlyReport {
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




function getFinancialYear() {
  const now = new Date();
  const yr = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return yr;
}

export function LeaveManagement() {
  const [activeTab, setActiveTab] = useState<'requests' | 'yearly-report'>('requests');
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('Pending');

  // Yearly report state
  const [yearlyReport, setYearlyReport] = useState<MonthlyReport[]>([]);
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
  };

  const pendingCount = requests.filter(r => r.status === 'Pending').length;

  // Totals across the year
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Leave Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage requests &amp; view yearly leave analytics (Financial Year: Apr {selectedYear} – Mar {selectedYear + 1}).
          </p>
          <div className="mt-2 text-xs bg-primary/10 text-primary px-3 py-2 rounded-lg border border-primary/20 inline-flex items-center gap-1.5 font-medium">
            <Info className="w-3.5 h-3.5" />
            Sundays are excluded from leave duration calculations.
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border gap-1">
        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
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
          onClick={() => setActiveTab('yearly-report')}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
            activeTab === 'yearly-report'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Yearly Report
        </button>
      </div>

      {/* ── Leave Requests Tab ── */}
      {activeTab === 'requests' && (
        <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border flex justify-between items-center">
            <h2 className="text-xl font-bold text-foreground">Leave Requests</h2>
            <div className="flex items-center space-x-3">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="text-sm border border-input rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="All">All Requests</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
              <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Live Updates</span>
            </div>
          </div>
          {isLoading ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="divide-y divide-border">
              {requests.filter(req => filter === 'All' || req.status === filter).length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No leave requests found for the selected filter.
                </div>
              )}
              {requests.filter(req => filter === 'All' || req.status === filter).map((request) => (
                <div key={request.id} className="p-6 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-foreground text-lg">{request.employeeName}</span>
                        <span className="text-sm text-muted-foreground px-2 py-0.5 bg-muted rounded-full">{request.employeeId}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${request.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : request.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {request.status}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${request.type?.includes('Sick') ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                          {request.type}
                        </span>
                        <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> {request.startDate} to {request.endDate}</span>
                      </div>
                      <p className="text-sm text-foreground/80 mt-2 bg-background p-3 rounded-lg border border-border">
                        <span className="font-medium">Reason:</span> {request.reason}
                      </p>
                      {request.attachment && (
                        <div className="mt-4">
                          <span className="text-sm font-medium text-foreground block mb-2">Medical Certificate:</span>
                          <img src={request.attachment} alt="Medical Certificate" className="h-32 w-48 object-cover rounded-md border border-border shadow-sm hover:scale-105 transition-transform duration-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex space-x-3 shrink-0 pt-2">
                      {request.status === 'Pending' && (
                        <>
                          <button
                            onClick={() => handleStatusUpdate(request.id, 'Approved')}
                            className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-md transition-colors"
                            title="Approve"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(request.id, 'Rejected')}
                            className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-md transition-colors"
                            title="Reject"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={async () => {
                          if (!confirm('Are you sure you want to delete this leave request?')) return;
                          try {
                            await fetch(`${API_BASE_URL}/api/leaves/${request.id}`, { method: 'DELETE' });
                            setRequests(requests.filter(r => r.id !== request.id));
                          } catch (e) {
                            console.error(e);
                            alert('Failed to delete leave request');
                          }
                        }}
                        className="p-2 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 rounded-md transition-colors"
                        title="Delete"
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

      {/* ── Yearly Report Tab ── */}
      {activeTab === 'yearly-report' && (
        <div className="space-y-6">
          {/* Year selector + summary stats */}
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

          {/* Annual Summary Cards */}
          {!reportLoading && yearlyReport.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Leave Days', value: yearTotals.total, color: 'bg-slate-50 border-slate-200', text: 'text-slate-700', sub: 'Full year' },
                { label: 'Approved Days', value: yearTotals.approved, color: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', sub: 'Approved leave' },
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

          {/* Monthly breakdown table */}
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  Month-by-Month Leave Report
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Apr {selectedYear} – Mar {selectedYear + 1} · Click a row for details</p>
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
              <>
                {/* Table header */}
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
                        const now = new Date();
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
                            <td className="px-4 py-3.5 text-center">
                              <span className={`font-bold ${row.totalDays > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {row.totalDays}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`font-semibold ${row.approvedDays > 0 ? 'text-emerald-600' : 'text-muted-foreground/40'}`}>
                                {row.approvedDays}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`font-semibold ${row.pendingDays > 0 ? 'text-amber-600' : 'text-muted-foreground/40'}`}>
                                {row.pendingDays}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`font-semibold ${row.rejectedDays > 0 ? 'text-rose-600' : 'text-muted-foreground/40'}`}>
                                {row.rejectedDays}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`font-semibold ${row.casualDays > 0 ? 'text-blue-600' : 'text-muted-foreground/40'}`}>
                                {row.casualDays}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={`font-semibold ${row.sickDays > 0 ? 'text-purple-600' : 'text-muted-foreground/40'}`}>
                                {row.sickDays}
                              </span>
                            </td>
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
                    {/* Totals row */}
                    <tfoot>
                      <tr className="bg-muted/70 border-t-2 border-border font-bold">
                        <td className="px-5 py-3 text-foreground">Annual Total</td>
                        <td className="px-4 py-3 text-center text-foreground">{yearTotals.total}</td>
                        <td className="px-4 py-3 text-center text-emerald-700">{yearTotals.approved}</td>
                        <td className="px-4 py-3 text-center text-amber-700">{yearTotals.pending}</td>
                        <td className="px-4 py-3 text-center text-rose-700">—</td>
                        <td className="px-4 py-3 text-center text-blue-700">{yearTotals.casual}</td>
                        <td className="px-4 py-3 text-center text-purple-700">{yearTotals.sick}</td>
                        <td className="px-4 py-3 text-center">—</td>
                        <td className="px-5 py-3">—</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Selected month detail card */}
          {selectedMonthDetail && (() => {
            const row = yearlyReport.find(r => r.monthYear === selectedMonthDetail);
            if (!row) return null;
            return (
              <div className="bg-card border-2 border-primary/30 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-primary" />
                  {row.monthYear} — Detailed Breakdown
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {[
                    { label: 'Total Days', value: row.totalDays, cls: 'bg-slate-100 text-slate-700' },
                    { label: 'Approved', value: row.approvedDays, cls: 'bg-emerald-100 text-emerald-700' },
                    { label: 'Pending', value: row.pendingDays, cls: 'bg-amber-100 text-amber-700' },
                    { label: 'Rejected', value: row.rejectedDays, cls: 'bg-rose-100 text-rose-700' },
                    { label: 'Casual', value: row.casualDays, cls: 'bg-blue-100 text-blue-700' },
                    { label: 'Sick', value: row.sickDays, cls: 'bg-purple-100 text-purple-700' },
                  ].map(item => (
                    <div key={item.label} className={`p-3 rounded-xl text-center ${item.cls}`}>
                      <p className="text-2xl font-bold">{item.value}</p>
                      <p className="text-xs font-medium mt-0.5">{item.label}</p>
                    </div>
                  ))}
                </div>
                {row.employeesOnLeave > 0 && (
                  <p className="mt-3 text-sm text-muted-foreground flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {row.employeesOnLeave} employee{row.employeesOnLeave > 1 ? 's' : ''} had approved leave this month.
                  </p>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
