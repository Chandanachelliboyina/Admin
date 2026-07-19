import React, { useState } from 'react';
import { Check, X, CalendarRange, HeartPulse, Clock, Info } from 'lucide-react';

interface LeaveRequest {
  id: string;
  employeeName: string;
  employeeId: string;
  type: 'Casual Leave' | 'Sick Leave';
  startDate: string;
  endDate: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

const today = new Date();
const todayStr = today.toISOString().split('T')[0];
const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const nextWeekStr = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const mockLeaveRequests: LeaveRequest[] = [
  {
    id: 'L001',
    employeeName: 'Alice Smith',
    employeeId: 'EMP001',
    type: 'Sick Leave',
    startDate: yesterdayStr,
    endDate: todayStr,
    reason: 'Fever and cold',
    status: 'Pending',
  },
  {
    id: 'L002',
    employeeName: 'Bob Johnson',
    employeeId: 'EMP002',
    type: 'Casual Leave',
    startDate: tomorrowStr,
    endDate: nextWeekStr,
    reason: 'Personal work',
    status: 'Pending',
  },
];

export function LeaveManagement() {
  const [requests, setRequests] = useState<LeaveRequest[]>(mockLeaveRequests);
  const [casualLeaveCount, setCasualLeaveCount] = useState(120);
  const [sickLeaveCount, setSickLeaveCount] = useState(45);

  const handleStatusUpdate = (id: string, newStatus: 'Approved' | 'Rejected') => {
    setRequests(requests.map(req => {
      if (req.id === id) {
        return { ...req, status: newStatus };
      }
      return req;
    }));

    // If approved, update counters based on type (just simulating basic count)
    const req = requests.find(r => r.id === id);
    if (newStatus === 'Approved' && req?.status === 'Pending') {
      let days = 0;
      let currentDate = new Date(req.startDate);
      let endDate = new Date(req.endDate);
      
      // Iterate through each day and count if it's not a Sunday (0)
      while (currentDate <= endDate) {
        if (currentDate.getDay() !== 0) {
          days++;
        }
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      if (req.type === 'Casual Leave') {
        setCasualLeaveCount(prev => prev + days);
      } else {
        setSickLeaveCount(prev => prev + days);
      }
    }
  };

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
        <div className="p-6 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Pending Leave Letters</h2>
        </div>
        <div className="divide-y divide-border">
          {requests.filter(r => r.status === 'Pending').length === 0 && (
            <div className="p-6 text-center text-muted-foreground">
              No pending leave requests.
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
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${request.type === 'Sick Leave' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
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
      
      {/* History section optional */}
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
