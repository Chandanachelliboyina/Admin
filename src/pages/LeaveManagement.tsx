import { useState, useEffect } from 'react';
import { Check, X, Clock, Info, Loader2, Trash2 } from 'lucide-react';
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

export function LeaveManagement() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string>('Pending');

  const fetchLeaves = async () => {
    try {
      const leavesRes = await fetch(`${API_BASE_URL}/api/leaves`);
      
      if (leavesRes.ok) {
        const data = await leavesRes.json();
        if (Array.isArray(data)) {
          setRequests(data);
        } else {
          console.error("Leave data is not an array:", data);
        }
      }
    } catch (error) {
      console.error('Failed to fetch leaves:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
    const timer = setInterval(fetchLeaves, 30000); // Auto-update every 30s
    return () => clearInterval(timer);
  }, []);

  const handleStatusUpdate = async (id: string, newStatus: 'Approved' | 'Rejected') => {
    // Optimistic update
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
    
    // Refresh to get actual counters
    setTimeout(fetchLeaves, 1000);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Loading leaves from database...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Leave Management</h1>
        <p className="text-muted-foreground mt-1">Manage employee leave requests for the financial year (April 2026 - March 2027).</p>
        <div className="mt-3 text-xs bg-primary/10 text-primary px-3 py-2 rounded-lg border border-primary/20 inline-block font-medium">
          <Info className="w-4 h-4 inline mr-1" />
          Sundays are automatically declared as holidays and excluded from leave duration.
        </div>
      </div>

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
        <div className="divide-y divide-border">
          {requests.filter(req => filter === 'All' || req.status === filter).length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
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
                      <div className="relative group inline-block">
                        <img src={request.attachment} alt="Medical Certificate" className="h-32 w-48 object-cover rounded-md border border-border shadow-sm transition-transform duration-300 group-hover:scale-105" />
                      </div>
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
      </div>
    </div>
  );
}
