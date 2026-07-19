import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, MapPin, Briefcase, Calendar, Info, Map, Building, Edit2, Save, X, Download, Printer, Image as ImageIcon, Activity, Trash2, Search, CalendarRange, Bell, Plus, Check } from 'lucide-react';

export function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState('personal');
  const [selectedMonth, setSelectedMonth] = useState('All Months');

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/employees/${id}`);
        if (!response.ok) throw new Error('Failed to fetch employee details');
        
        const data = await response.json();
        // Add fallback fields for frontend UI if missing from DB schema
        setEmployeeData({
          ...data,
          village: data.village || 'N/A',
          mandal: data.mandal || 'N/A',
          photo: data.photo || `https://i.pravatar.cc/150?u=${data.id}`
        });
      } catch (err: any) {
        console.error(err);
        setError('Could not load profile. Ensure the database connection is active.');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      fetchEmployee();
    }
  }, [id]);
  
  // Work Info State
  const [isEditingWork, setIsEditingWork] = useState(false);
  const [workInfo, setWorkInfo] = useState({
    head: 'Dr. Sarah Connor',
    donorName: 'Global Foundation',
    department: 'Field Operations',
    targetVillages: '15 Villages',
    targetMandal: 'East Mandal District',
    targets: 'Complete survey for 500 households by Q4',
  });

  // Daily Updates State
  const [updates, setUpdates] = useState([
    { id: 1, date: '2026-07-18', imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=500&auto=format&fit=crop&q=60', description: 'Field visit to Village A' },
    { id: 2, date: '2026-07-17', imageUrl: 'https://images.unsplash.com/photo-1574482620826-40685ca5ebe2?w=500&auto=format&fit=crop&q=60', description: 'Meeting with local leaders' },
  ]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const yesterdayStr = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const nextWeekStr = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  // Activities State
  const [activities, setActivities] = useState([
    { id: 1, date: todayStr, description: 'Completed baseline survey for 50 households in Sector 1.' },
    { id: 2, date: yesterdayStr, description: 'Conducted awareness camp on sanitation and hygiene.' },
    { id: 3, date: '2026-06-25', description: 'Submitted monthly progress report.' },
  ]);
  const [activitySearch, setActivitySearch] = useState('');
  
  // Leave Management State
  const [leaves, setLeaves] = useState([
    { id: 1, type: 'Sick Leave', startDate: yesterdayStr, endDate: todayStr, reason: 'Fever and cold', status: 'Pending', attachment: 'https://images.unsplash.com/photo-1581056771107-24ca5f033842?w=500&auto=format&fit=crop&q=60' },
    { id: 2, type: 'Casual Leave', startDate: tomorrowStr, endDate: nextWeekStr, reason: 'Personal work', status: 'Pending' },
  ]);
  const [casualTotal, setCasualTotal] = useState(9);
  const [casualTaken, setCasualTaken] = useState(2);
  const [sickTotal, setSickTotal] = useState(9);
  const [sickTaken, setSickTaken] = useState(1);
  const [isEditingLeaves, setIsEditingLeaves] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ 
    casualTotal: 9, casualTaken: 2, casualRemaining: 7,
    sickTotal: 9, sickTaken: 1, sickRemaining: 8
  });

  const handleLeaveFormChange = (type: 'casual' | 'sick', field: 'total' | 'taken' | 'remaining', value: number) => {
    setLeaveForm(prev => {
      let next = { ...prev };
      if (type === 'casual') {
        if (field === 'total') {
          next.casualTotal = value;
          next.casualRemaining = value - next.casualTaken;
        } else if (field === 'taken') {
          next.casualTaken = value;
          next.casualRemaining = next.casualTotal - value;
        } else if (field === 'remaining') {
          next.casualRemaining = value;
          next.casualTaken = next.casualTotal - value;
        }
      } else {
        if (field === 'total') {
          next.sickTotal = value;
          next.sickRemaining = value - next.sickTaken;
        } else if (field === 'taken') {
          next.sickTaken = value;
          next.sickRemaining = next.sickTotal - value;
        } else if (field === 'remaining') {
          next.sickRemaining = value;
          next.sickTaken = next.sickTotal - value;
        }
      }
      return next;
    });
  };

  const handleLeaveStatus = (id: number, status: 'Approved' | 'Rejected') => {
    setLeaves(leaves.map(l => {
      if (l.id === id) {
        if (status === 'Approved' && l.status === 'Pending') {
           let days = 0;
           let currentDate = new Date(l.startDate);
           let endDate = new Date(l.endDate);
           
           // Iterate through each day and count if it's not a Sunday (0)
           while (currentDate <= endDate) {
             if (currentDate.getDay() !== 0) {
               days++;
             }
             currentDate.setDate(currentDate.getDate() + 1);
           }
           
           if (l.type === 'Casual Leave') setCasualTaken(prev => prev + days);
           else setSickTaken(prev => prev + days);
        }
        return { ...l, status };
      }
      return l;
    }));
  };

  const handleRemoveAttachment = (id: number) => {
    if (confirm('Are you sure you want to remove this attachment?')) {
      setLeaves(leaves.map(l => l.id === id ? { ...l, attachmentDeleted: true } : l));
    }
  };

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({ imageUrl: '', description: '' });

  const handleSaveUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    const fullDate = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    setUpdates([{ 
      id: Date.now(), 
      date: fullDate, 
      imageUrl: updateForm.imageUrl || 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=500&auto=format&fit=crop&q=60', 
      description: updateForm.description 
    }, ...updates]);
    setIsUpdateModalOpen(false);
    setUpdateForm({ imageUrl: '', description: '' });
  };

  const handleRemoveUpdateImage = (id: number) => {
    if (confirm('Are you sure you want to delete this image?')) {
      setUpdates(updates.map(u => u.id === id ? { ...u, imageDeleted: true } : u));
    }
  };

  // Notifications State
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'System Maintenance', message: 'System will be down on Saturday.', date: nextWeekStr }
  ]);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [currentNotif, setCurrentNotif] = useState<any>(null);
  const [notifForm, setNotifForm] = useState({ title: '', message: '' });

  const handleSaveNotif = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentNotif) {
      setNotifications(notifications.map(n => n.id === currentNotif.id ? { ...n, title: notifForm.title, message: notifForm.message } : n));
    } else {
      const fullDate = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
      setNotifications([{ id: Date.now(), title: notifForm.title, message: notifForm.message, date: fullDate }, ...notifications]);
    }
    setIsNotifModalOpen(false);
  };
  
  // We removed the static mock data initialization here
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading Profile from MongoDB...</span>
      </div>
    );
  }

  if (error || !employeeData) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <p className="text-red-500 font-medium">{error || 'Employee not found'}</p>
        <button onClick={() => navigate('/employees')} className="text-blue-600 hover:underline">
          Return to Employee Management
        </button>
      </div>
    );
  }

  // Use the dynamically fetched employeeData instead of mock
  const employee = employeeData;

  const handleLeaveSubmit = (e: React.FormEvent) => {
    // Logic for submitting leave
  };

  const allAttendanceData = [
    { date: '2026-07-19', in: '09:00 AM', out: '05:30 PM', hrs: '8h 30m', status: 'Absent', start: 'Village A Center', end: 'Mandal HQ' }, // Sunday (will be overridden)
    { date: '2026-07-18', in: '09:00 AM', out: '05:30 PM', hrs: '8h 30m', status: 'Present', start: 'Village A Center', end: 'Mandal HQ' },
    { date: '2026-07-17', in: '08:45 AM', out: '06:00 PM', hrs: '9h 15m', status: 'Present', start: 'Mandal HQ', end: 'Village B Center' },
    { date: '2026-07-16', in: '-', out: '-', hrs: '0h', status: 'Absent', start: '-', end: '-' },
    { date: '2026-07-15', in: '09:10 AM', out: '05:00 PM', hrs: '7h 50m', status: 'Late', start: 'Village C', end: 'Village C' },
    // Mock data for other months to demonstrate filtering
    { date: '2026-06-25', in: '09:00 AM', out: '05:30 PM', hrs: '8h 30m', status: 'Present', start: 'Mandal HQ', end: 'Mandal HQ' },
    { date: '2026-06-12', in: '09:15 AM', out: '06:00 PM', hrs: '8h 45m', status: 'Present', start: 'Village D', end: 'Village D' },
    { date: '2026-05-10', in: '09:00 AM', out: '05:00 PM', hrs: '8h 00m', status: 'Present', start: 'Village A', end: 'Village B' },
    { date: '2026-04-05', in: '-', out: '-', hrs: '0h', status: 'Absent', start: '-', end: '-' },
  ];

  // Helper to map month names to numbers for filtering
  const getMonthNumber = (monthName: string) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months.indexOf(monthName.split(' ')[0]) + 1;
  };

  const filteredAttendanceData = allAttendanceData.filter(row => {
    if (selectedMonth === 'All Months') return true;
    
    // Extract month and year from selected string (e.g. "July 2026")
    const [monthName, year] = selectedMonth.split(' ');
    const targetMonth = getMonthNumber(monthName);
    
    // Extract month and year from row date (e.g. "2026-07-18")
    const [rowYear, rowMonth] = row.date.split('-');
    
    return parseInt(rowYear) === parseInt(year) && parseInt(rowMonth) === targetMonth;
  });

  const handleWorkSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditingWork(false);
    // Real app would send a PUT/PATCH request to FastAPI here
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Employee Name', 'Employee ID', 'Check In', 'Check Out', 'Hours', 'Status', 'Start Location', 'End Location'];
    const csvRows = [headers.join(',')];

    filteredAttendanceData.forEach(row => {
      const values = [
        row.date,
        `"${employee.name}"`,
        employee.id,
        row.in,
        row.out,
        row.hrs,
        row.status,
        `"${row.start}"`,
        `"${row.end}"`
      ];
      csvRows.push(values.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_${employee.id}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteUpdate = (id: number) => {
    if (window.confirm('Are you sure you want to delete this daily update?')) {
      setUpdates(updates.map(u => u.id === id ? { ...u, isDeleted: true } : u));
    }
  };

  const handleEditUpdate = (id: number) => {
    const newDesc = window.prompt('Enter new description for this update:');
    if (newDesc !== null) {
      setUpdates(updates.map(u => u.id === id ? { ...u, description: newDesc } : u));
    }
  };

  const handleDeleteActivity = (id: number) => {
    if (window.confirm('Are you sure you want to delete this activity?')) {
      setActivities(activities.map(a => a.id === id ? { ...a, isDeleted: true } : a));
    }
  };

  const handleEditActivity = (id: number) => {
    const newDesc = window.prompt('Enter updated activity details:');
    if (newDesc !== null) {
      setActivities(activities.map(a => a.id === id ? { ...a, description: newDesc } : a));
    }
  };

  const filteredActivities = activities.filter(a => 
    a.date.toLowerCase().includes(activitySearch.toLowerCase()) || 
    a.description.toLowerCase().includes(activitySearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-500 pb-10">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Back
      </button>

      {/* Header Profile Card */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex items-center space-x-6">
        <img 
          src={employee.photo} 
          alt={employee.name} 
          className="w-24 h-24 rounded-full border-4 border-muted object-cover"
        />
        <div>
          <h1 className="text-2xl font-bold text-foreground">{employee.name}</h1>
          <p className="text-muted-foreground">{employee.position}</p>
          <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-primary/10 text-primary">
            {employee.id}
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 space-y-1">
          <button 
            onClick={() => setActiveTab('personal')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'personal' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card border border-border text-foreground hover:bg-muted'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Personal Details</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('work')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'work' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card border border-border text-foreground hover:bg-muted'
            }`}
          >
            <Building className="w-4 h-4" />
            <span>Work Information</span>
          </button>

          <button 
            onClick={() => setActiveTab('attendance')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'attendance' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card border border-border text-foreground hover:bg-muted'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Attendance History</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('updates')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'updates' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card border border-border text-foreground hover:bg-muted'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Daily Updates</span>
          </button>

          <button 
            onClick={() => setActiveTab('activities')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'activities' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card border border-border text-foreground hover:bg-muted'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Activities</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('leave')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'leave' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card border border-border text-foreground hover:bg-muted'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            <span>Leave Management</span>
          </button>

          <button 
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'notifications' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-card border border-border text-foreground hover:bg-muted'
            }`}
          >
            <Bell className="w-4 h-4" />
            <span>Notifications</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-card rounded-2xl border border-border p-6 shadow-sm">
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold border-b border-border pb-4 flex items-center">
                <Info className="w-5 h-5 mr-2 text-muted-foreground" />
                Personal Details
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Employee ID</label>
                  <div className="font-medium">{employee.id}</div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Employee Name</label>
                  <div className="font-medium">{employee.name}</div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Position</label>
                  <div className="flex items-center font-medium">
                    <Briefcase className="w-4 h-4 mr-2 text-muted-foreground" />
                    {employee.position}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Email</label>
                  <div className="flex items-center font-medium">
                    <Mail className="w-4 h-4 mr-2 text-muted-foreground" />
                    {employee.email}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Mobile Number</label>
                  <div className="flex items-center font-medium">
                    <Phone className="w-4 h-4 mr-2 text-muted-foreground" />
                    {employee.mobileNumber}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Gender</label>
                  <div className="font-medium">{employee.gender}</div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Date of Birth</label>
                  <div className="font-medium">{employee.dateOfBirth}</div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Joining Date</label>
                  <div className="font-medium">{employee.joiningDate}</div>
                </div>
              </div>

              <h2 className="text-xl font-semibold border-b border-border pb-4 pt-6 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-muted-foreground" />
                Location Details
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Address</label>
                  <div className="font-medium">{employee.address}</div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Village</label>
                  <div className="flex items-center font-medium">
                    <Map className="w-4 h-4 mr-2 text-muted-foreground" />
                    {employee.village}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground block mb-1">Mandal</label>
                  <div className="font-medium">{employee.mandal}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'work' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <h2 className="text-xl font-semibold flex items-center">
                  <Building className="w-5 h-5 mr-2 text-muted-foreground" />
                  Work Information
                </h2>
                {!isEditingWork && (
                  <button 
                    onClick={() => setIsEditingWork(true)}
                    className="flex items-center space-x-2 text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-1.5 rounded-md transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit</span>
                  </button>
                )}
              </div>
              
              {!isEditingWork ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 animate-in fade-in">
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">Head</label>
                    <div className="font-medium">{workInfo.head}</div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">Donor Name</label>
                    <div className="font-medium">{workInfo.donorName}</div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">Department</label>
                    <div className="font-medium">{workInfo.department}</div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">Target Villages</label>
                    <div className="font-medium">{workInfo.targetVillages}</div>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground block mb-1">Target Mandal</label>
                    <div className="font-medium">{workInfo.targetMandal}</div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-muted-foreground block mb-1">Targets</label>
                    <div className="font-medium bg-muted/50 p-3 rounded-md border border-border">
                      {workInfo.targets}
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleWorkSave} className="space-y-6 animate-in fade-in">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Head</label>
                      <input
                        type="text"
                        value={workInfo.head}
                        onChange={(e) => setWorkInfo({ ...workInfo, head: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Donor Name</label>
                      <input
                        type="text"
                        value={workInfo.donorName}
                        onChange={(e) => setWorkInfo({ ...workInfo, donorName: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Department</label>
                      <input
                        type="text"
                        value={workInfo.department}
                        onChange={(e) => setWorkInfo({ ...workInfo, department: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Target Villages</label>
                      <input
                        type="text"
                        value={workInfo.targetVillages}
                        onChange={(e) => setWorkInfo({ ...workInfo, targetVillages: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Target Mandal</label>
                      <input
                        type="text"
                        value={workInfo.targetMandal}
                        onChange={(e) => setWorkInfo({ ...workInfo, targetMandal: e.target.value })}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <label className="text-sm font-medium text-foreground">Targets</label>
                      <textarea
                        value={workInfo.targets}
                        onChange={(e) => setWorkInfo({ ...workInfo, targets: e.target.value })}
                        rows={3}
                        className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => setIsEditingWork(false)}
                      className="flex items-center space-x-2 px-4 py-2 rounded-md border border-input hover:bg-muted transition-colors text-sm font-medium"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                    <button
                      type="submit"
                      className="flex items-center space-x-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Changes</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <h2 className="text-xl font-semibold flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-muted-foreground" />
                  Attendance History
                </h2>
                <div className="flex items-center space-x-3">
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-background border border-input text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option>All Months</option>
                    <option>December 2026</option>
                    <option>November 2026</option>
                    <option>October 2026</option>
                    <option>September 2026</option>
                    <option>August 2026</option>
                    <option>July 2026</option>
                    <option>June 2026</option>
                    <option>May 2026</option>
                    <option>April 2026</option>
                    <option>March 2026</option>
                    <option>February 2026</option>
                    <option>January 2026</option>
                  </select>
                  <button 
                    onClick={handleExportCSV}
                    className="flex items-center space-x-2 text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-2 rounded-md transition-colors border border-transparent"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="flex items-center space-x-2 text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 px-3 py-2 rounded-md transition-colors border border-transparent"
                  >
                    <Printer className="w-4 h-4" />
                    <span className="hidden sm:inline">Print PDF</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm text-left whitespace-nowrap">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Name & ID</th>
                      <th className="px-4 py-3">Check In</th>
                      <th className="px-4 py-3">Check Out</th>
                      <th className="px-4 py-3">Hours</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Start Location</th>
                      <th className="px-4 py-3">End Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAttendanceData.length > 0 ? (
                      filteredAttendanceData.map((row, i) => {
                        const isSunday = new Date(row.date).getDay() === 0;
                        const status = isSunday ? 'Holiday' : row.status;
                        const checkIn = isSunday ? '-' : row.in;
                        const checkOut = isSunday ? '-' : row.out;
                        const hrs = isSunday ? '-' : row.hrs;
                        const startLoc = isSunday ? '-' : row.start;
                        const endLoc = isSunday ? '-' : row.end;

                        return (
                          <tr key={i} className={`border-b border-border hover:bg-muted/30 transition-colors ${isSunday ? 'bg-muted/10' : ''}`}>
                            <td className="px-4 py-3 font-medium text-foreground flex items-center">
                              {row.date}
                              {isSunday && <span className="ml-2 text-[10px] uppercase tracking-wider text-blue-500 font-bold border border-blue-200 bg-blue-50 px-1.5 py-0.5 rounded">Sun</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-foreground">{employee.name}</div>
                              <div className="text-xs text-muted-foreground">{employee.id}</div>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{checkIn}</td>
                            <td className="px-4 py-3 text-muted-foreground">{checkOut}</td>
                            <td className="px-4 py-3 text-muted-foreground">{hrs}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                status === 'Holiday' ? 'bg-blue-100 text-blue-700' :
                                status === 'Present' ? 'bg-emerald-100 text-emerald-700' :
                                status === 'Absent' ? 'bg-red-100 text-red-700' :
                                'bg-yellow-100 text-yellow-700'
                              }`}>
                                {status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]" title={startLoc}>{startLoc}</td>
                            <td className="px-4 py-3 text-muted-foreground truncate max-w-[120px]" title={endLoc}>{endLoc}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                          No attendance records found for the selected month.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'updates' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-semibold flex items-center">
                    <ImageIcon className="w-5 h-5 mr-2 text-muted-foreground" />
                    Daily Updates
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Image uploads and daily field progress.</p>
                </div>
                <button
                  onClick={() => setIsUpdateModalOpen(true)}
                  className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1 hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Update</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {updates.map(update => (
                  update.isDeleted ? (
                    <div key={update.id} className="bg-muted/50 border border-dashed border-border rounded-xl p-6 flex flex-col justify-center items-center text-center space-y-3 shadow-inner">
                      <Trash2 className="w-6 h-6 text-muted-foreground/50" />
                      <span className="text-sm text-muted-foreground">Daily update deleted. Available in trash for 7 days.</span>
                      <button onClick={() => setUpdates(updates.map(u => u.id === update.id ? { ...u, isDeleted: false } : u))} className="text-blue-600 text-sm font-bold uppercase hover:underline transition-all">Undo</button>
                    </div>
                  ) : (
                    <div key={update.id} className="bg-background border border-border rounded-xl overflow-hidden shadow-sm group flex flex-col">
                      {update.imageUrl && !update.imageDeleted && (
                        <div className="relative aspect-video bg-muted">
                          <img src={update.imageUrl} alt={update.description} className="w-full h-full object-cover" />
                          <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleRemoveUpdateImage(update.id)}
                              className="p-1.5 bg-rose-500 text-white hover:bg-rose-600 rounded-md shadow-sm transition-colors"
                              title="Delete Image Only"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                      {update.imageUrl && update.imageDeleted && (
                        <div className="relative aspect-video bg-muted/50 border-b border-dashed border-border flex flex-col items-center justify-center space-y-2 shadow-inner">
                           <span className="text-sm text-muted-foreground px-4 text-center">Image deleted. Available in trash for 7 days.</span>
                           <button onClick={() => setUpdates(updates.map(u => u.id === update.id ? { ...u, imageDeleted: false } : u))} className="text-blue-600 text-sm font-bold uppercase hover:underline transition-all">Undo Image</button>
                        </div>
                      )}
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center text-xs text-muted-foreground mb-2">
                            <Calendar className="w-3 h-3 mr-1" />
                            {update.date}
                          </div>
                          <p className="text-sm font-medium text-foreground">{update.description}</p>
                        </div>
                        <div className="flex justify-end space-x-1 mt-4 pt-3 border-t border-border">
                          <button 
                            onClick={() => handleEditUpdate(update.id)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center text-xs font-medium"
                            title="Edit Description"
                          >
                            <Edit2 className="w-3 h-3 mr-1" /> Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteUpdate(update.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md transition-colors flex items-center text-xs font-medium"
                            title="Delete Entire Update"
                          >
                            <Trash2 className="w-3 h-3 mr-1" /> Delete Log
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                ))}
                
                {updates.length === 0 && (
                  <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No daily updates found.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'activities' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-semibold flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-muted-foreground" />
                    Activities
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">Daily task logs and accomplishments.</p>
                </div>
                
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    placeholder="Search date, month, year..."
                    className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {filteredActivities.map(activity => (
                  activity.isDeleted ? (
                    <div key={activity.id} className="p-4 border border-dashed border-border rounded-lg bg-muted/50 flex justify-between items-center shadow-inner">
                      <span className="text-sm text-muted-foreground flex items-center"><Trash2 className="w-4 h-4 mr-2" /> Activity deleted. Available in trash for 7 days.</span>
                      <button onClick={() => setActivities(activities.map(a => a.id === activity.id ? { ...a, isDeleted: false } : a))} className="text-blue-600 text-sm font-bold uppercase hover:underline transition-all">Undo</button>
                    </div>
                  ) : (
                    <div key={activity.id} className="p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors flex items-start justify-between group">
                      <div>
                        <div className="flex items-center text-xs font-medium text-primary mb-1">
                          <Calendar className="w-3 h-3 mr-1" />
                          {activity.date}
                        </div>
                        <p className="text-sm text-foreground">{activity.description}</p>
                      </div>
                      <div className="flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4 shrink-0">
                        <button 
                          onClick={() => handleEditActivity(activity.id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteActivity(activity.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                ))}

                {filteredActivities.length === 0 && (
                  <div className="py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No activities found matching your search.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'leave' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-start justify-between border-b border-border pb-4 gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Leave Management</h2>
                  <p className="text-sm text-muted-foreground mt-1">Track your leave balances and submit leave requests.</p>
                  <div className="mt-3 text-xs bg-primary/10 text-primary px-3 py-2 rounded-lg border border-primary/20 inline-block font-medium">
                    <Info className="w-4 h-4 inline mr-1" />
                    Sundays are automatically declared as holidays and excluded from leave duration.
                  </div>
                </div>
                <div>
                  {isEditingLeaves ? (
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => {
                          setCasualTotal(leaveForm.casualTotal);
                          setCasualTaken(leaveForm.casualTaken);
                          setSickTotal(leaveForm.sickTotal);
                          setSickTaken(leaveForm.sickTaken);
                          setIsEditingLeaves(false);
                        }}
                        className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        Save
                      </button>
                      <button 
                        onClick={() => setIsEditingLeaves(false)}
                        className="bg-muted text-muted-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        setLeaveForm({ 
                          casualTotal, casualTaken, casualRemaining: casualTotal - casualTaken,
                          sickTotal, sickTaken, sickRemaining: sickTotal - sickTaken
                        });
                        setIsEditingLeaves(true);
                      }}
                      className="bg-muted text-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
                    >
                      Edit Balances
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Casual Leaves Card */}
                <div className="bg-[#f8fbff] border border-blue-100 p-6 rounded-2xl shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-blue-900 font-semibold text-lg">Casual Leaves</h3>
                    <p className="text-blue-500/80 text-sm">April 2026 to March 2027</p>
                  </div>
                  
                  {isEditingLeaves ? (
                    <div className="grid grid-cols-3 text-center gap-2">
                      <div>
                        <input type="number" className="w-16 text-center border border-blue-200 rounded-md text-xl font-bold text-blue-900 bg-white shadow-inner" value={leaveForm.casualTotal} onChange={(e) => handleLeaveFormChange('casual', 'total', parseInt(e.target.value) || 0)} />
                        <div className="text-xs text-blue-600 mt-1">Total</div>
                      </div>
                      <div>
                        <input type="number" className="w-16 text-center border border-blue-200 rounded-md text-xl font-bold text-red-600 bg-white shadow-inner" value={leaveForm.casualTaken} onChange={(e) => handleLeaveFormChange('casual', 'taken', parseInt(e.target.value) || 0)} />
                        <div className="text-xs text-blue-600 mt-1">Taken</div>
                      </div>
                      <div>
                        <input type="number" className="w-16 text-center border border-blue-200 rounded-md text-xl font-bold text-green-600 bg-white shadow-inner" value={leaveForm.casualRemaining} onChange={(e) => handleLeaveFormChange('casual', 'remaining', parseInt(e.target.value) || 0)} />
                        <div className="text-xs text-blue-600 mt-1">Remaining</div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 text-center divide-x divide-blue-100">
                      <div>
                        <div className="text-2xl font-bold text-blue-900">{casualTotal}</div>
                        <div className="text-xs text-blue-600 mt-1">Total</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">{casualTaken}</div>
                        <div className="text-xs text-blue-600 mt-1">Taken</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{casualTotal - casualTaken}</div>
                        <div className="text-xs text-blue-600 mt-1">Remaining</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sick Leaves Card */}
                <div className="bg-[#fdfaff] border border-purple-100 p-6 rounded-2xl shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-purple-900 font-semibold text-lg">Sick Leaves</h3>
                    <p className="text-purple-500/80 text-sm">April 2026 to March 2027</p>
                  </div>
                  
                  {isEditingLeaves ? (
                    <div className="grid grid-cols-3 text-center gap-2">
                      <div>
                        <input type="number" className="w-16 text-center border border-purple-200 rounded-md text-xl font-bold text-purple-900 bg-white shadow-inner" value={leaveForm.sickTotal} onChange={(e) => handleLeaveFormChange('sick', 'total', parseInt(e.target.value) || 0)} />
                        <div className="text-xs text-purple-600 mt-1">Total</div>
                      </div>
                      <div>
                        <input type="number" className="w-16 text-center border border-purple-200 rounded-md text-xl font-bold text-red-600 bg-white shadow-inner" value={leaveForm.sickTaken} onChange={(e) => handleLeaveFormChange('sick', 'taken', parseInt(e.target.value) || 0)} />
                        <div className="text-xs text-purple-600 mt-1">Taken</div>
                      </div>
                      <div>
                        <input type="number" className="w-16 text-center border border-purple-200 rounded-md text-xl font-bold text-green-600 bg-white shadow-inner" value={leaveForm.sickRemaining} onChange={(e) => handleLeaveFormChange('sick', 'remaining', parseInt(e.target.value) || 0)} />
                        <div className="text-xs text-purple-600 mt-1">Remaining</div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 text-center divide-x divide-purple-100">
                      <div>
                        <div className="text-2xl font-bold text-purple-900">{sickTotal}</div>
                        <div className="text-xs text-purple-600 mt-1">Total</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">{sickTaken}</div>
                        <div className="text-xs text-purple-600 mt-1">Taken</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-green-600">{sickTotal - sickTaken}</div>
                        <div className="text-xs text-purple-600 mt-1">Remaining</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground">Leave Letters</h3>
                {leaves.map(l => (
                  <div key={l.id} className="p-4 border border-border rounded-lg bg-background">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-medium text-foreground">{l.type}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${l.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : l.status === 'Approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                            {l.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1"><Calendar className="w-3 h-3 inline mr-1"/>{l.startDate} to {l.endDate}</p>
                        <p className="text-sm mt-2 text-foreground"><span className="font-medium">Reason:</span> {l.reason}</p>
                        {l.attachment && !l.attachmentDeleted && (
                          <div className="mt-4">
                            <span className="text-sm font-medium text-foreground block mb-2">Attachment (Medical Certificate):</span>
                            <div className="relative group inline-block">
                              <img src={l.attachment} alt="Medical Certificate" className="h-32 w-48 object-cover rounded-md border border-border shadow-sm transition-transform duration-300 group-hover:scale-105" />
                              <button
                                onClick={() => handleRemoveAttachment(l.id)}
                                className="absolute -top-2 -right-2 bg-rose-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-rose-600 focus:outline-none"
                                title="Remove attachment"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )}
                        {l.attachment && l.attachmentDeleted && (
                          <div className="mt-4 p-3 bg-muted/50 border border-dashed border-border rounded-md flex justify-between items-center shadow-inner max-w-sm">
                            <span className="text-sm text-muted-foreground flex items-center"><Trash2 className="w-4 h-4 mr-2" /> Attachment deleted. Kept in trash for 7 days.</span>
                            <button onClick={() => setLeaves(leaves.map(lv => lv.id === l.id ? { ...lv, attachmentDeleted: false } : lv))} className="text-blue-600 text-sm font-bold uppercase hover:underline transition-all shrink-0 ml-2">Undo</button>
                          </div>
                        )}
                      </div>
                      {l.status === 'Pending' && (
                        <div className="flex space-x-2">
                          <button onClick={() => handleLeaveStatus(l.id, 'Approved')} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md"><Check className="w-4 h-4"/></button>
                          <button onClick={() => handleLeaveStatus(l.id, 'Rejected')} className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-md"><X className="w-4 h-4"/></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6 relative">
              <div className="flex justify-between items-center border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-semibold flex items-center">
                    <Bell className="w-5 h-5 mr-2 text-muted-foreground" />
                    Notifications
                  </h2>
                </div>
                <button
                  onClick={() => { setCurrentNotif(null); setNotifForm({title:'', message:''}); setIsNotifModalOpen(true); }}
                  className="bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm font-medium flex items-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create</span>
                </button>
              </div>

              <div className="space-y-4">
                {notifications.map(n => (
                  <div key={n.id} className="p-4 border border-border rounded-lg bg-background group flex justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground">{n.title}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                      <span className="text-xs text-muted-foreground mt-2 block">{n.date}</span>
                    </div>
                    <div className="flex space-x-2 opacity-0 group-hover:opacity-100">
                      <button onClick={() => { setCurrentNotif(n); setNotifForm({title: n.title, message: n.message}); setIsNotifModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md h-fit"><Edit2 className="w-4 h-4"/></button>
                      <button onClick={() => setNotifications(notifications.filter(x => x.id !== n.id))} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md h-fit"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  </div>
                ))}
              </div>

              {isNotifModalOpen && (
                <div className="absolute inset-0 z-10 flex items-start justify-center bg-card/80 backdrop-blur-sm pt-10">
                  <div className="bg-background border border-border rounded-xl shadow-lg w-full max-w-md p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold">{currentNotif ? 'Edit Notification' : 'Create Notification'}</h3>
                      <button onClick={() => setIsNotifModalOpen(false)}><X className="w-4 h-4"/></button>
                    </div>
                    <form onSubmit={handleSaveNotif} className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">Title</label>
                        <input type="text" required value={notifForm.title} onChange={e => setNotifForm({...notifForm, title: e.target.value})} className="w-full mt-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary" />
                      </div>
                      <div>
                        <label className="text-sm font-medium">Message</label>
                        <textarea required value={notifForm.message} onChange={e => setNotifForm({...notifForm, message: e.target.value})} className="w-full mt-1 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary" rows={3}></textarea>
                      </div>
                      <div className="flex justify-end space-x-2 pt-2">
                        <button type="button" onClick={() => setIsNotifModalOpen(false)} className="px-4 py-2 text-sm font-medium border border-input rounded-md hover:bg-muted transition-colors">Cancel</button>
                        <button type="submit" className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">Save</button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Add Update Modal */}
      {isUpdateModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
              <h3 className="text-lg font-bold text-foreground">Add Daily Update</h3>
              <button onClick={() => setIsUpdateModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveUpdate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Image URL (Optional)</label>
                <input
                  type="text"
                  required={false}
                  value={updateForm.imageUrl}
                  onChange={(e) => setUpdateForm({...updateForm, imageUrl: e.target.value})}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Description</label>
                <textarea
                  required
                  value={updateForm.description}
                  onChange={(e) => setUpdateForm({...updateForm, description: e.target.value})}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background min-h-[100px]"
                  placeholder="What was accomplished today?"
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsUpdateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors shadow-sm"
                >
                  Save Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
