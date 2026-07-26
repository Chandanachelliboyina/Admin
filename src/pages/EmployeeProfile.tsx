import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, MapPin, Briefcase, Calendar, Info, Map, Building, Edit2, X, Download, Printer, Image as ImageIcon, Activity, Trash2, Search, CalendarRange, Bell, Plus, Check } from 'lucide-react';
import { API_BASE_URL } from '../config';

export function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState('personal');
  const [selectedMonth, setSelectedMonth] = useState('All Months');
  const [attendanceFilter, setAttendanceFilter] = useState('All');
  const [attendance, setAttendance] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        const TIMEOUT = 30000;
        const [empResponse, attResponse, updResponse, actResponse, leaveResponse, workInfoRes, leaveBalRes, notifRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/employees/${id}`, { signal: AbortSignal.timeout(TIMEOUT) }),
          fetch(`${API_BASE_URL}/api/employees/${id}/attendance`, { signal: AbortSignal.timeout(TIMEOUT) }),
          fetch(`${API_BASE_URL}/api/employees/${id}/updates`, { signal: AbortSignal.timeout(TIMEOUT) }),
          fetch(`${API_BASE_URL}/api/employees/${id}/activities`, { signal: AbortSignal.timeout(TIMEOUT) }),
          fetch(`${API_BASE_URL}/api/employees/${id}/leaves`, { signal: AbortSignal.timeout(TIMEOUT) }),
          fetch(`${API_BASE_URL}/api/employees/${id}/work-info`, { signal: AbortSignal.timeout(TIMEOUT) }),
          fetch(`${API_BASE_URL}/api/employees/${id}/leave-balances`, { signal: AbortSignal.timeout(TIMEOUT) }),
          fetch(`${API_BASE_URL}/api/notifications`, { signal: AbortSignal.timeout(TIMEOUT) })
        ]);
        
        if (!empResponse.ok) {
          if (empResponse.status === 404) {
            throw new Error('Employee not found in the database.');
          }
          throw new Error('Failed to fetch employee details');
        }
        
        const data = await empResponse.json();
        setEmployeeData({
          ...data,
          village: data.village || 'N/A',
          mandal:  data.mandal  || 'N/A',
          district: data.district || 'N/A',
        });
        
        if (attResponse.ok)   setAttendance(await attResponse.json());
        if (updResponse.ok)   setUpdates(await updResponse.json());
        if (actResponse.ok)   setActivities(await actResponse.json());
        if (leaveResponse.ok) setLeaves(await leaveResponse.json());
        if (workInfoRes.ok) {
            const wi = await workInfoRes.json();
            if (Object.keys(wi).length > 0) setWorkInfo(wi);
        }
        if (leaveBalRes.ok) {
            const lb = await leaveBalRes.json();
            setLeaveBalances({ 
                casualTotal: lb.casualTotal ?? 12,
                casualTaken: lb.casualTaken ?? 0,
                casualRemaining: lb.casualRemaining ?? 12,
                sickTotal: lb.sickTotal ?? 12,
                sickTaken: lb.sickTaken ?? 0,
                sickRemaining: lb.sickRemaining ?? 12
            });
        }
        if (notifRes.ok) {
          const allNotifs = await notifRes.json();
          setNotifications(allNotifs.filter((n: any) => 
            n.target_type === 'all' || 
            String(n.employee_id || '').trim().toLowerCase() === String(id).trim().toLowerCase()
          ));
        }
      } catch (err: any) {
        console.error(err);
        if (err?.name === 'TimeoutError') {
          setError('Request timed out. MongoDB Atlas is taking too long to respond. Please try again.');
        } else if (err?.message === 'Employee not found in the database.') {
          setError(err.message);
        } else {
          setError('Could not load profile. Make sure the backend server (python app.py) is running.');
        }
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) fetchEmployee();
  }, [id]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { 
      alert("File is too large. Please select an image under 5MB.");
      return;
    }

    setIsUploading(true);
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result as string;
        
        const response = await fetch(`${API_BASE_URL}/api/employees/${id}/profile-picture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_b64: base64String }),
        });

        if (response.ok) {
          setEmployeeData((prev: any) => prev ? { ...prev, profile_picture: base64String } : null);
        } else {
          alert("Failed to upload profile picture.");
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("Upload error:", err);
      setIsUploading(false);
    }
  };
  
  const [lateSigninTime, setLateSigninTime] = useState('10:30');

  const handleAllowLateSignin = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/${id}/allow-late-signin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowed_until: lateSigninTime }),
      });
      if (response.ok) {
        alert(`Late sign-in access granted for today (up to ${lateSigninTime}).`);
      } else {
        alert('Failed to grant late sign-in access.');
      }
    } catch (err) {
      console.error(err);
      alert('Error granting late sign-in access.');
    }
  };
  
  // Work Info State
  const [workInfo, setWorkInfo] = useState({
    head: '',
    donorName: '',
    department: '',
    targetVillages: '',
    targetMandal: '',
    targets: '',
  });

  // Dynamic State for live data
  const [updates, setUpdates] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [leaves, setLeaves] = useState<any[]>([]);

  const [activitySearch, setActivitySearch] = useState('');
  
  // Leave Management State
  const [leaveFilter, setLeaveFilter] = useState('All');
  const [leaveBalances, setLeaveBalances] = useState({ 
    casualTotal: 12, casualTaken: 0, casualRemaining: 12,
    sickTotal: 12, sickTaken: 0, sickRemaining: 12
  });

  const calculateLeaveDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
    return Math.max(0, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  };

  const casualTotal = leaveBalances.casualTotal;
  const casualTaken = leaves.filter(l => l.status === 'Approved' && l.type?.toLowerCase().includes('casual')).reduce((acc, l) => acc + calculateLeaveDays(l.startDate, l.endDate), 0);
  const casualRemaining = Math.max(0, casualTotal - casualTaken);

  const sickTotal = leaveBalances.sickTotal;
  const sickTaken = leaves.filter(l => l.status === 'Approved' && l.type?.toLowerCase().includes('sick')).reduce((acc, l) => acc + calculateLeaveDays(l.startDate, l.endDate), 0);
  const sickRemaining = Math.max(0, sickTotal - sickTaken);





  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({ imageUrl: '', description: '' });

  const handleSaveUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/employees/${id}/updates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateForm)
      });
      if (res.ok) {
        const updResponse = await fetch(`${API_BASE_URL}/api/employees/${id}/updates`);
        if (updResponse.ok) setUpdates(await updResponse.json());
      }
      setIsUpdateModalOpen(false);
      setUpdateForm({ imageUrl: '', description: '' });
    } catch(err) {
        console.error(err);
    }
  };



  // Notifications State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [currentNotif, setCurrentNotif] = useState<any>(null);
  const [notifForm, setNotifForm] = useState({ title: '', message: '' });

  const handleSaveNotif = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (currentNotif) {
        await fetch(`${API_BASE_URL}/api/notifications/${currentNotif.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...notifForm,
            target_type: currentNotif.target_type || 'individual',
            employee_id: currentNotif.employee_id || id
          })
        });
      } else {
        await fetch(`${API_BASE_URL}/api/notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...notifForm,
            target_type: 'individual',
            employee_id: id
          })
        });
      }
      const notifRes = await fetch(`${API_BASE_URL}/api/notifications`);
      if (notifRes.ok) {
        const allNotifs = await notifRes.json();
        setNotifications(allNotifs.filter((n: any) => 
          n.target_type === 'all' || 
          String(n.employee_id || '').trim().toLowerCase() === String(id).trim().toLowerCase()
        ));
      }
      setIsNotifModalOpen(false);
    } catch (err) { console.error(err); }
  };
  
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

  const employee = employeeData;

  const getMonthNumber = (monthName: string) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months.indexOf(monthName.split(' ')[0]) + 1;
  };

  const filteredAttendanceData = attendance.filter(row => {
    let monthMatch = true;
    if (selectedMonth !== 'All Months') {
      const [monthName, year] = selectedMonth.split(' ');
      const targetMonth = getMonthNumber(monthName);
      const [rowYear, rowMonth] = row.date.split('-');
      monthMatch = parseInt(rowYear) === parseInt(year) && parseInt(rowMonth) === targetMonth;
    }

    let statusMatch = true;
    const isSunday = new Date(row.date).getDay() === 0;
    const status = isSunday ? 'Holiday' : row.status;

    if (attendanceFilter === 'Present') {
      statusMatch = status === 'Present';
    } else if (attendanceFilter === 'Absent') {
      statusMatch = status === 'Absent';
    }

    return monthMatch && statusMatch;
  });

  const filteredLeaves = leaves.filter(l => leaveFilter === 'All' || l.status === leaveFilter);

  const handleExportCSV = () => {
    const headers = ['Date', 'Employee Name', 'Employee ID', 'Check In', 'Check Out', 'Hours', 'Status', 'Start Location', 'End Location'];
    const csvRows = [headers.join(',')];
    filteredAttendanceData.forEach(row => {
      const values = [
        row.date,
        `"${employee.name}"`,
        employee.id,
        row.checkIn || '-',
        row.checkOut || '-',
        row.hrs || '-',
        row.status || '-',
        `"${row.start || '-'}"`,
        `"${row.end || '-'}"`
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

  const handleDeleteUpdate = async (updateId: string) => {
    if (window.confirm('Are you sure you want to delete this daily update?')) {
      await fetch(`${API_BASE_URL}/api/employees/${id}/updates/${updateId}`, { method: 'DELETE' });
      setUpdates(updates.filter(u => u.id !== updateId));
    }
  };



  const handleDeleteActivity = async (activityId: string) => {
    if (window.confirm('Are you sure you want to delete this activity?')) {
      await fetch(`${API_BASE_URL}/api/employees/${id}/activities/${activityId}`, { method: 'DELETE' });
      setActivities(activities.filter(a => a.id !== activityId));
    }
  };



  const filteredActivities = (activities || []).filter(a => 
    (a.description || '').toLowerCase().includes((activitySearch || '').toLowerCase()) ||
    (a.date || '').toLowerCase().includes((activitySearch || '').toLowerCase())
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
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col md:flex-row items-center space-x-0 md:space-x-6">
        <div className="relative group">
          <div className="relative inline-block">
            {employee.profile_picture ? (
              <img src={employee.profile_picture} alt={employee.name} className="w-24 h-24 rounded-full mx-auto object-cover border-4 border-muted" />
            ) : (
              <div className="w-24 h-24 rounded-full mx-auto bg-primary/10 flex items-center justify-center border-4 border-muted">
                <span className="text-2xl font-bold text-primary">{employee.name.charAt(0)}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <span className="text-white text-[10px] text-center font-medium">{isUploading ? "Uploading..." : "Change"}</span>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/jpg" onChange={handleFileChange} disabled={isUploading} />
          </div>
        </div>
        <div className="text-center md:text-left mt-4 md:mt-0 flex-1">
          <h1 className="text-2xl font-bold text-foreground">{employee.name}</h1>
          <p className="text-muted-foreground">{employee.position}</p>
          <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-primary/10 text-primary">
            {employee.id}
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex flex-col md:flex-row items-center gap-2 shrink-0">
          <select 
            value={lateSigninTime} 
            onChange={(e) => setLateSigninTime(e.target.value)} 
            className="px-3 py-2 bg-background border border-border rounded-lg text-sm"
          >
            <option value="10:30">10:30 AM</option>
            <option value="11:00">11:00 AM</option>
            <option value="11:30">11:30 AM</option>
            <option value="12:00">12:00 PM</option>
            <option value="12:30">12:30 PM</option>
            <option value="13:00">01:00 PM</option>
            <option value="13:30">01:30 PM</option>
            <option value="14:00">02:00 PM</option>
          </select>
          <button 
            onClick={handleAllowLateSignin}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg shadow-sm transition-colors"
          >
            Allow Late Sign-In
          </button>
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
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8 animate-in fade-in pt-4">
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
                    <div className="font-medium bg-muted/50 p-3 rounded-md border border-border whitespace-pre-wrap">
                      {workInfo.targets}
                    </div>
                  </div>
                </div>
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
                    value={attendanceFilter}
                    onChange={(e) => setAttendanceFilter(e.target.value)}
                    className="bg-background border border-input text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="All">All Status</option>
                    <option value="Present">Present</option>
                    <option value="Absent">Absent</option>
                  </select>
                  <select 
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-background border border-input text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="All Months">All Months</option>
                    <option value="December 2026">December</option>
                    <option value="November 2026">November</option>
                    <option value="October 2026">October</option>
                    <option value="September 2026">September</option>
                    <option value="August 2026">August</option>
                    <option value="July 2026">July</option>
                    <option value="June 2026">June</option>
                    <option value="May 2026">May</option>
                    <option value="April 2026">April</option>
                    <option value="March 2026">March</option>
                    <option value="February 2026">February</option>
                    <option value="January 2026">January</option>
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
                        let status = isSunday ? 'Holiday' : row.status;
                        const checkIn = isSunday ? '-' : row.checkIn || '-';
                        const checkOut = isSunday ? '-' : row.checkOut || '-';
                        const hrs = isSunday ? '-' : row.hrs || '-';
                        const startLoc = isSunday ? '-' : row.start || '-';
                        const endLoc = isSunday ? '-' : row.end || '-';

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
                    <div key={update.id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow group relative flex flex-col">
                      <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button onClick={() => handleDeleteUpdate(update.id)} className="p-1.5 bg-red-100 text-red-600 rounded-md hover:bg-red-200 transition-colors shadow-sm">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {update.imageUrl && (
                        <div className="h-48 overflow-hidden bg-muted flex items-center justify-center shrink-0">
                          {update.imageUrl.startsWith('data:image') || update.imageUrl.startsWith('http') ? (
                            <img src={update.imageUrl} alt="Update" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="text-muted-foreground text-xs p-4 overflow-hidden break-words">{update.imageUrl}</div>
                          )}
                        </div>
                      )}
                      <div className="p-4 flex-grow flex flex-col justify-between">
                        <p className="text-sm text-foreground leading-relaxed line-clamp-3">{update.description}</p>
                        <span className="text-xs font-medium text-muted-foreground mt-3 flex items-center">
                          <Calendar className="w-3 h-3 mr-1" /> {update.date}
                        </span>
                      </div>
                    </div>
                ))}

                {(updates || []).length === 0 && (
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
                    type="date"
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {filteredActivities.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted/20">
                    No activities found.
                  </div>
                ) : filteredActivities.map((activity) => (
                  <div key={activity.id} className="relative pl-8">
                    {/* Timeline dot */}
                    <div className="absolute left-[3px] top-1.5 w-2 h-2 rounded-full bg-primary ring-4 ring-background z-10"></div>
                    
                    <div className="bg-card border border-border p-4 rounded-xl hover:bg-muted/30 transition-colors group">
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center text-xs font-medium text-muted-foreground mb-2">
                          <Calendar className="w-3.5 h-3.5 mr-1.5" />
                          {activity.date}
                        </div>
                        <button onClick={() => handleDeleteActivity(activity.id)} className="text-muted-foreground hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {(activity.description || '').split('\n').map((line: string, idx: number, arr: string[]) => {
                          const isHeading = line.trim() !== '' && (idx === 0 || arr[idx - 1].trim() === '');
                          return (
                            <React.Fragment key={idx}>
                              {isHeading ? <span className="font-bold">{line}</span> : line}
                              {idx < arr.length - 1 && '\n'}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
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
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Casual Leaves Card */}
                <div className="bg-[#f8fbff] border border-blue-100 p-6 rounded-2xl shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-blue-900 font-semibold text-lg">Casual Leaves</h3>
                    <p className="text-blue-500/80 text-sm">April to March</p>
                  </div>
                  
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
                      <div className="text-2xl font-bold text-green-600">{casualRemaining}</div>
                      <div className="text-xs text-blue-600 mt-1">Remaining</div>
                    </div>
                  </div>
                </div>

                {/* Sick Leaves Card */}
                <div className="bg-[#fdfaff] border border-purple-100 p-6 rounded-2xl shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-purple-900 font-semibold text-lg">Sick Leaves</h3>
                    <p className="text-purple-500/80 text-sm">April to March</p>
                  </div>
                  
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
                      <div className="text-2xl font-bold text-green-600">{sickRemaining}</div>
                      <div className="text-xs text-purple-600 mt-1">Remaining</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-foreground">Leave Letters</h3>
                  <select 
                    value={leaveFilter}
                    onChange={(e) => setLeaveFilter(e.target.value)}
                    className="bg-background border border-input text-sm rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="All">All Requests</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                {filteredLeaves.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground border border-dashed border-border rounded-lg bg-muted/20">
                    No leave requests found.
                  </div>
                ) : filteredLeaves.map(l => (
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
                        
                        {l.attachment && (
                          <div className="mt-4">
                            <span className="text-sm font-medium text-foreground block mb-2">Medical Certificate:</span>
                            <div className="relative group inline-block">
                              <img src={l.attachment} alt="Medical Certificate" className="h-32 w-48 object-cover rounded-md border border-border shadow-sm transition-transform duration-300 group-hover:scale-105" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <button onClick={async () => {
                          await fetch(`${API_BASE_URL}/api/leaves/${l.id}/status`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'Approved' })
                          });
                          setLeaves(leaves.map(x => x.id === l.id ? { ...x, status: 'Approved' } : x));
                        }} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-md" title="Approve"><Check className="w-4 h-4"/></button>
                        
                        <button onClick={async () => {
                          await fetch(`${API_BASE_URL}/api/leaves/${l.id}/status`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'Rejected' })
                          });
                          setLeaves(leaves.map(x => x.id === l.id ? { ...x, status: 'Rejected' } : x));
                        }} className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-md" title="Reject"><X className="w-4 h-4"/></button>

                        <button onClick={async () => {
                          if (!confirm('Are you sure you want to delete this leave request?')) return;
                          try {
                            await fetch(`${API_BASE_URL}/api/leaves/${l.id}`, { method: 'DELETE' });
                            setLeaves(leaves.filter(x => x.id !== l.id));
                          } catch (e) {
                            console.error(e);
                            alert('Failed to delete leave request');
                          }
                        }} className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-md" title="Delete"><Trash2 className="w-4 h-4"/></button>
                      </div>
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
                      <button onClick={async () => {
                        await fetch(`${API_BASE_URL}/api/notifications/${n.id}`, { method: 'DELETE' });
                        setNotifications(notifications.filter(x => x.id !== n.id));
                      }} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md h-fit"><Trash2 className="w-4 h-4"/></button>
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
