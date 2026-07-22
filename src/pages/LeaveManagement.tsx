import React, { useState, useEffect } from 'react';
import { Check, X, CalendarRange, HeartPulse, Clock, Info, Loader2 } from 'lucide-react';

interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeId: string;
  type: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

export function LeaveManagement() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [casualLeaveCount, setCasualLeaveCount] = useState(0);
  const [sickLeaveCount, setSickLeaveCount] = useState(0);

  const fetchLeaves = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/leaves');
      if (res.ok) {
        const data = await res.json();
        
        if (Array.isArray(data)) {
          setRequests(data);
          
          // Compute casual and sick leave totals based on approved requests
          let casual = 0;
          let sick = 0;
          data.forEach((req: LeaveRequest) => {
            if (req.status === 'Approved') {
              try {
                let days = 0;
                let currentDate = new Date(req.startDate);
                let endDate = new Date(req.endDate);
                
                // Safety check to prevent infinite loops if dates are invalid
                if (!isNaN(currentDate.getTime()) && !isNaN(endDate.getTime())) {
                  // Limit the maximum number of days to prevent browser hanging just in case
                  let maxIterations = 365; 
                  while (currentDate <= endDate && maxIterations > 0) {
                    if (currentDate.getDay() !== 0) days++;
                    currentDate.setDate(currentDate.getDate() + 1);
                    maxIterations--;
                  }
                }
                
                if (req.type?.includes('Casual')) casual += days;
                else if (req.type?.includes('Sick')) sick += days;
              } catch (err) {
                console.error("Error processing dates for leave:", err);
              } 
            }
          });
          setCasualLeaveCount(casual);
          setSickLeaveCount(sick);
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
    
    // In a real app, you would hit an endpoint like PUT /api/leaves/{id}/status
    // try {
    //   await fetch(`http://localhost:8080/api/leaves/${id}/status`, {
    //     method: 'PUT',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ status: newStatus })
    //   });
    // } catch (err) { ... }
    
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
        <p className="text-muted-foreground mt-1">Manage employee leave requests for the financial year (April - March).</p>
        <div className="mt-3 text-xs bg-primary/10 text-primary px-3 py-2 rounded-lg border border-primary/20 inline-block font-medium">
          <Info className="w-4 h-4 inline mr-1" />
          Sundays are automatically declared as holidays and excluded from leave duration.
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Casual Leave Box */}
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
              <CalendarRange className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">Apr - Mar</span>
          </div>
          <h3 className="text-muted-foreground text-sm font-medium">Total Casual Leaves Approved</h3>
          <div className="text-3xl font-bold text-foreground mt-1">{casualLeaveCount}</div>
          <p className="text-xs text-muted-foreground mt-2">Cumulative total for all employees</p>
        </div>

        {/* Sick Leave Box */}
        <div className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-rose-100 text-rose-600">
              <HeartPulse className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">Apr - Mar</span>
          </div>
          <h3 className="text-muted-foreground text-sm font-medium">Total Sick Leaves Approved</h3>
          <div className="text-3xl font-bold text-foreground mt-1">{sickLeaveCount}</div>
          <p className="text-xs text-muted-foreground mt-2">Cumulative total for all employees</p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex justify-between items-center">
          <h2 className="text-xl font-bold text-foreground">Pending Leave Letters</h2>
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Live Updates</span>
        </div>
        <div className="divide-y divide-border">
          {requests.filter(r => r.status === 'Pending').length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              No pending leave requests at the moment.
            </div>
          )}
          {requests.filter(r => r.status === 'Pending').map((request) => (
            <div key={request.id} className="p-6 hover:bg-muted/30 transition-colors">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-foreground text-lg">{request.employeeName}</span>
                    <span className="text-sm text-muted-foreground px-2 py-0.5 bg-muted rounded-full">{request.employeeId}</span>
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
                </div>
                <div className="flex space-x-3 shrink-0 pt-2">
                  <button
                    onClick={() => handleStatusUpdate(request.id, 'Approved')}
                    className="flex items-center space-x-1 px-4 py-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 rounded-lg transition-colors font-medium text-sm"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(request.id, 'Rejected')}
                    className="flex items-center space-x-1 px-4 py-2 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 rounded-lg transition-colors font-medium text-sm"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {requests.filter(r => r.status !== 'Pending').length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-bold text-foreground mb-4">Recent History</h2>
          <div className="bg-card border border-border rounded-2xl shadow-sm divide-y divide-border">
            {requests.filter(r => r.status !== 'Pending').map(request => (
              <div key={request.id} className="p-4 flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium text-foreground">{request.employeeName}</span> requested <span className="font-medium">{request.type}</span> ({request.startDate} to {request.endDate})
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${request.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {request.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
