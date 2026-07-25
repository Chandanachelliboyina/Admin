import { useState, useEffect } from 'react';
import { Check, X, CalendarRange, HeartPulse, Clock, Info, Loader2, Send, BellRing } from 'lucide-react';
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
  const [leaveBalances, setLeaveBalances] = useState({
    casualTotal: 0, casualTaken: 0, casualRemaining: 0,
    sickTotal: 0, sickTaken: 0, sickRemaining: 0
  });

  // Notification State
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationTargetType, setNotificationTargetType] = useState('all');
  const [notificationEmployeeId, setNotificationEmployeeId] = useState('');
  const [isSendingNotif, setIsSendingNotif] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState('');

  const fetchLeaves = async () => {
    try {
      const [leavesRes, balancesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/leaves`),
        fetch(`${API_BASE_URL}/api/leave-balances/summary`)
      ]);
      
      if (leavesRes.ok) {
        const data = await leavesRes.json();
        if (Array.isArray(data)) {
          setRequests(data);
        } else {
          console.error("Leave data is not an array:", data);
        }
      }
      
      if (balancesRes.ok) {
        const balancesData = await balancesRes.json();
        setLeaveBalances(balancesData);
      }
    } catch (error) {
      console.error('Failed to fetch leaves or balances:', error);
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

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notificationTitle || !notificationMessage) return;
    setIsSendingNotif(true);
    setNotifSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notificationTitle,
          message: notificationMessage,
          target_type: notificationTargetType,
          employee_id: notificationTargetType === 'individual' ? notificationEmployeeId.trim() : null
        })
      });
      if (res.ok) {
        setNotifSuccess('Notification successfully sent and saved to MongoDB!');
        setNotificationTitle('');
        setNotificationMessage('');
        setNotificationEmployeeId('');
      } else {
        setNotifSuccess('Failed to send notification.');
      }
    } catch (err) {
      console.error(err);
      setNotifSuccess('An error occurred while sending.');
    } finally {
      setIsSendingNotif(false);
      setTimeout(() => setNotifSuccess(''), 4000);
    }
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Casual Leaves Card */}
        <div className="bg-[#f8fbff] border border-blue-100 p-6 rounded-2xl shadow-sm">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="text-blue-900 font-semibold text-lg">Casual Leaves (Global)</h3>
              <p className="text-blue-500/80 text-sm">April to March</p>
            </div>
            <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
              <CalendarRange className="w-6 h-6" />
            </div>
          </div>
          
          <div className="grid grid-cols-3 text-center divide-x divide-blue-100">
            <div>
              <div className="text-2xl font-bold text-blue-900">{leaveBalances.casualTotal}</div>
              <div className="text-xs text-blue-600 mt-1">Total Allocated</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{leaveBalances.casualTaken}</div>
              <div className="text-xs text-blue-600 mt-1">Total Taken</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{leaveBalances.casualRemaining}</div>
              <div className="text-xs text-blue-600 mt-1">Total Remaining</div>
            </div>
          </div>
        </div>

        {/* Sick Leaves Card */}
        <div className="bg-[#fdfaff] border border-purple-100 p-6 rounded-2xl shadow-sm">
          <div className="mb-6 flex justify-between items-center">
            <div>
              <h3 className="text-purple-900 font-semibold text-lg">Sick Leaves (Global)</h3>
              <p className="text-purple-500/80 text-sm">April to March</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-100 text-purple-600">
              <HeartPulse className="w-6 h-6" />
            </div>
          </div>
          
          <div className="grid grid-cols-3 text-center divide-x divide-purple-100">
            <div>
              <div className="text-2xl font-bold text-purple-900">{leaveBalances.sickTotal}</div>
              <div className="text-xs text-purple-600 mt-1">Total Allocated</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{leaveBalances.sickTaken}</div>
              <div className="text-xs text-purple-600 mt-1">Total Taken</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{leaveBalances.sickRemaining}</div>
              <div className="text-xs text-purple-600 mt-1">Total Remaining</div>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast/Individual Notification Form */}
      <div className="bg-card border border-border rounded-2xl shadow-sm p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <BellRing className="w-32 h-32" />
        </div>
        <div className="flex items-center space-x-2 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <BellRing className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Send Notification</h2>
        </div>
        
        <form onSubmit={handleSendNotification} className="space-y-4 relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Target Audience</label>
              <select 
                value={notificationTargetType}
                onChange={(e) => setNotificationTargetType(e.target.value)}
                className="w-full p-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="all">All Employees (Broadcast)</option>
                <option value="individual">Individual Employee</option>
              </select>
            </div>
            {notificationTargetType === 'individual' && (
              <div className="space-y-2 animate-in fade-in slide-in-from-left-4">
                <label className="text-sm font-medium text-foreground">Employee ID</label>
                <input 
                  type="text" 
                  value={notificationEmployeeId}
                  onChange={(e) => setNotificationEmployeeId(e.target.value)}
                  placeholder="e.g. EMP001"
                  required={notificationTargetType === 'individual'}
                  className="w-full p-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            )}
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Notification Title</label>
            <input 
              type="text" 
              value={notificationTitle}
              onChange={(e) => setNotificationTitle(e.target.value)}
              placeholder="e.g. Urgent Meeting, Leave Approved"
              required
              className="w-full p-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Message</label>
            <textarea 
              value={notificationMessage}
              onChange={(e) => setNotificationMessage(e.target.value)}
              placeholder="Type your notification message here..."
              required
              rows={3}
              className="w-full p-2.5 bg-background border border-input rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className={`text-sm font-medium transition-opacity duration-300 ${notifSuccess ? 'opacity-100 text-emerald-600' : 'opacity-0'}`}>
              {notifSuccess}
            </p>
            <button 
              type="submit" 
              disabled={isSendingNotif}
              className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium flex items-center space-x-2 hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSendingNotif ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span>{isSendingNotif ? 'Sending...' : 'Send Notification'}</span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h2 className="text-xl font-bold text-foreground">All Leave Letters</h2>
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Live Updates</span>
        </div>
        <div className="divide-y divide-border">
          {requests.length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              No leave requests at the moment.
            </div>
          )}
          {requests.map((request) => (
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
                        className="flex items-center space-x-1 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg transition-colors font-medium text-sm"
                        title="Approve"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => handleStatusUpdate(request.id, 'Rejected')}
                        className="flex items-center space-x-1 px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition-colors font-medium text-sm"
                        title="Reject"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
