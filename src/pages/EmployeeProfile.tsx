import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, MapPin, Briefcase, Calendar, Info, Map, Building, Edit2, X, Download, Printer, Image as ImageIcon, Activity, Trash2, Search, CalendarRange, Bell, Plus, Check, BarChart3, CheckCircle2, Minus, CalendarDays } from 'lucide-react';
import { API_BASE_URL } from '../config';

function formatDisplayTime(timeStr?: string, _dateStr?: string): string {
  if (!timeStr) return '';
  const raw = timeStr.trim();
  try {
    const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const seconds = match[3] ? parseInt(match[3], 10) : 0;
      const ampm = match[4] ? match[4].toUpperCase() : '';

      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;

      // If time was recorded in UTC AM (e.g. 10:01 AM UTC while local IST is 3:31 PM), convert UTC to IST (+5:30)
      if (ampm === 'AM' || (!ampm && hours < 12)) {
        let totalMinutes = hours * 60 + minutes + 330; // +5 hours 30 mins
        totalMinutes = totalMinutes % (24 * 60);
        const newHours = Math.floor(totalMinutes / 60);
        const newMinutes = totalMinutes % 60;
        
        const finalAmPm = newHours >= 12 ? 'PM' : 'AM';
        const displayHours = newHours % 12 === 0 ? 12 : newHours % 12;
        
        const hStr = displayHours.toString().padStart(2, '0');
        const mStr = newMinutes.toString().padStart(2, '0');
        const sStr = seconds.toString().padStart(2, '0');
        
        return `${hStr}:${mStr}:${sStr} ${finalAmPm}`;
      }
    }
  } catch (e) {
    console.error('Error formatting time:', e);
  }
  return timeStr;
}

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
            String(n.target_type || '').trim().toLowerCase() === 'all' || 
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
  const [monthlyLeaveReport, setMonthlyLeaveReport] = useState<any[]>([]);
  const [monthlyReportLoading, setMonthlyReportLoading] = useState(false);
  const [leaveReportView, setLeaveReportView] = useState<'list' | 'monthly'>('list');


  const casualTotal = leaveBalances.casualTotal;
  const casualTaken = leaveBalances.casualTaken;
  const casualRemaining = leaveBalances.casualRemaining;

  const sickTotal = leaveBalances.sickTotal;
  const sickTaken = leaveBalances.sickTaken;
  const sickRemaining = leaveBalances.sickRemaining;





  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({ imageUrl: '', description: '', location: '' });

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
      setUpdateForm({ imageUrl: '', description: '', location: '' });
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
          String(n.target_type || '').trim().toLowerCase() === 'all' || 
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
                    <div key={update.id} className="bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col relative">
                      {/* Delete Button */}
                      <button 
                        onClick={() => handleDeleteUpdate(update.id)} 
                        title="Delete update" 
                        className="absolute top-3 right-3 z-20 p-2 bg-red-100/90 text-red-600 rounded-lg hover:bg-red-200 transition-colors shadow-md backdrop-blur-xs"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Image Container with Dark Overlay Banner matching user screenshot */}
                      {update.imageUrl ? (
                        <div className="relative h-64 overflow-hidden bg-slate-900 flex items-center justify-center shrink-0">
                          {update.imageUrl.startsWith('data:image') || update.imageUrl.startsWith('http') ? (
                            <img src={update.imageUrl} alt="Update" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <div className="text-muted-foreground text-xs p-4 overflow-hidden break-words">{update.imageUrl}</div>
                          )}

                          {/* Dark overlay at bottom of image */}
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent px-4 py-2.5 pt-6 text-center text-white font-mono tracking-tight text-xs drop-shadow">
                            <div className="font-semibold flex items-center justify-center space-x-3 text-white/95">
                              <span>Date: {update.date || 'N/A'}</span>
                              {update.time && <span>Time: {formatDisplayTime(update.time, update.date)}</span>}
                            </div>
                            {update.location && (
                              <div className="text-[11px] mt-0.5 text-gray-200 font-medium truncate">
                                {update.location.startsWith('Lat:') || update.location.startsWith('Location:') ? update.location : `Location: ${update.location}`}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        /* Fallback Banner when no image is uploaded */
                        <div className="bg-slate-900 px-4 py-4 text-center text-white font-mono tracking-tight text-xs">
                          <div className="font-semibold flex items-center justify-center space-x-3">
                            <span>Date: {update.date || 'N/A'}</span>
                            {update.time && <span>Time: {formatDisplayTime(update.time, update.date)}</span>}
                          </div>
                          {update.location && (
                            <div className="text-[11px] mt-0.5 text-gray-200 font-medium">
                              {update.location.startsWith('Lat:') || update.location.startsWith('Location:') ? update.location : `Location: ${update.location}`}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Description Text Below Image */}
                      <div className="p-5 flex-grow flex flex-col justify-center">
                        <p className="text-base text-foreground leading-relaxed whitespace-pre-wrap font-normal">
                          {update.description || 'Field update submission'}
                        </p>
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
                {/* Sub-tab toggle */}
                <div className="flex gap-1 bg-muted rounded-lg p-1 self-start">
                  <button
                    onClick={() => setLeaveReportView('list')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      leaveReportView === 'list' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Leave Letters
                  </button>
                  <button
                    onClick={async () => {
                      setLeaveReportView('monthly');
                      if (monthlyLeaveReport.length === 0) {
                        setMonthlyReportLoading(true);
                        try {
                          const res = await fetch(`${API_BASE_URL}/api/employees/${id}/leaves/monthly-report`);
                          if (res.ok) setMonthlyLeaveReport(await res.json());
                        } catch (e) { console.error(e); }
                        finally { setMonthlyReportLoading(false); }
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      leaveReportView === 'monthly' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Monthly Report
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Casual Leave (CL) Card */}
                <div className="bg-[#f4f8ff] dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/50 p-5 sm:p-6 rounded-2xl shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-blue-900 dark:text-blue-200 font-bold text-base sm:text-lg flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-blue-600 shrink-0" />
                        Casual Leave (CL)
                      </h3>
                      <p className="text-blue-500/90 dark:text-blue-400 text-xs font-medium mt-0.5">1 CL earned per month</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                    <div className="bg-blue-100/70 dark:bg-blue-900/40 border border-blue-200/60 dark:border-blue-800/60 px-2 py-3 sm:px-3.5 sm:py-3.5 rounded-xl flex flex-col justify-center items-center min-w-0">
                      <div className="text-xl sm:text-2xl font-black text-blue-900 dark:text-blue-100 leading-tight">{casualTotal}</div>
                      <div className="text-[11px] sm:text-xs font-bold text-blue-700 dark:text-blue-300 mt-1 uppercase tracking-tight truncate w-full">Total</div>
                    </div>
                    <div className="bg-rose-100/70 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60 px-2 py-3 sm:px-3.5 sm:py-3.5 rounded-xl flex flex-col justify-center items-center min-w-0">
                      <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1 leading-tight">
                        <Minus className="w-3.5 h-3.5 text-rose-500 stroke-[3] shrink-0" />
                        {casualTaken}
                      </div>
                      <div className="text-[11px] sm:text-xs font-bold text-rose-700 dark:text-rose-300 mt-1 uppercase tracking-tight truncate w-full">Used</div>
                    </div>
                    <div className="bg-emerald-100/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 px-2 py-3 sm:px-3.5 sm:py-3.5 rounded-xl flex flex-col justify-center items-center min-w-0">
                      <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1 leading-tight">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5] shrink-0" />
                        {casualRemaining}
                      </div>
                      <div className="text-[11px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300 mt-1 uppercase tracking-tight truncate w-full" title="Remaining">Remaining</div>
                    </div>
                  </div>
                </div>

                {/* Sick Leave (SL) Card */}
                <div className="bg-[#faf5ff] dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50 p-5 sm:p-6 rounded-2xl shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-purple-900 dark:text-purple-200 font-bold text-base sm:text-lg flex items-center gap-2">
                        <CalendarDays className="w-5 h-5 text-purple-600 shrink-0" />
                        Sick Leave (SL)
                      </h3>
                      <p className="text-purple-500/90 dark:text-purple-400 text-xs font-medium mt-0.5">1 SL earned per month</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                    <div className="bg-purple-100/70 dark:bg-purple-900/40 border border-purple-200/60 dark:border-purple-800/60 px-2 py-3 sm:px-3.5 sm:py-3.5 rounded-xl flex flex-col justify-center items-center min-w-0">
                      <div className="text-xl sm:text-2xl font-black text-purple-900 dark:text-purple-100 leading-tight">{sickTotal}</div>
                      <div className="text-[11px] sm:text-xs font-bold text-purple-700 dark:text-purple-300 mt-1 uppercase tracking-tight truncate w-full">Total</div>
                    </div>
                    <div className="bg-rose-100/70 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-800/60 px-2 py-3 sm:px-3.5 sm:py-3.5 rounded-xl flex flex-col justify-center items-center min-w-0">
                      <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 flex items-center justify-center gap-1 leading-tight">
                        <Minus className="w-3.5 h-3.5 text-rose-500 stroke-[3] shrink-0" />
                        {sickTaken}
                      </div>
                      <div className="text-[11px] sm:text-xs font-bold text-rose-700 dark:text-rose-300 mt-1 uppercase tracking-tight truncate w-full">Used</div>
                    </div>
                    <div className="bg-emerald-100/70 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-800/60 px-2 py-3 sm:px-3.5 sm:py-3.5 rounded-xl flex flex-col justify-center items-center min-w-0">
                      <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1 leading-tight">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5] shrink-0" />
                        {sickRemaining}
                      </div>
                      <div className="text-[11px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300 mt-1 uppercase tracking-tight truncate w-full" title="Remaining">Remaining</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Monthly Report Sub-view ── */}
              {leaveReportView === 'monthly' && (
                <div className="space-y-4">
                  {monthlyReportLoading ? (
                    <div className="flex items-center justify-center py-10 gap-3">
                      <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      <span className="text-sm text-muted-foreground">Generating monthly report...</span>
                    </div>
                  ) : monthlyLeaveReport.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground border border-dashed border-border rounded-xl bg-muted/10">
                      No leave data found for this financial year.
                    </div>
                  ) : (() => {
                    const now = new Date();
                    const currentMonthAbbr = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()];
                    const currentMonthData = monthlyLeaveReport.find((r: any) => r.month === currentMonthAbbr && r.year === now.getFullYear());
                    const maxDays = Math.max(...monthlyLeaveReport.map((r: any) => r.totalDays), 1);
                    const yearTotalDays = monthlyLeaveReport.reduce((s: number, r: any) => s + r.totalDays, 0);
                    const yearApproved = monthlyLeaveReport.reduce((s: number, r: any) => s + r.approvedDays, 0);
                    const yearPending = monthlyLeaveReport.reduce((s: number, r: any) => s + r.pendingDays, 0);
                    return (
                      <>
                        {/* Current month highlight */}
                        {currentMonthData && currentMonthData.totalDays > 0 && (
                          <div className="p-4 bg-primary/5 border-2 border-primary/20 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                              <p className="text-xs font-bold text-primary uppercase tracking-wider">This Month ({currentMonthData.monthYear})</p>
                              <p className="text-2xl font-bold text-foreground mt-0.5">{currentMonthData.totalDays} leave day{currentMonthData.totalDays !== 1 ? 's' : ''}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {currentMonthData.approvedDays} approved · {currentMonthData.pendingDays} pending
                              </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-center text-xs">
                              <div className="bg-blue-100 text-blue-700 rounded-lg px-3 py-2">
                                <p className="font-bold text-lg">{currentMonthData.casualDays}</p><p>Casual</p>
                              </div>
                              <div className="bg-rose-100 text-rose-700 rounded-lg px-3 py-2">
                                <p className="font-bold text-lg">{currentMonthData.sickDays}</p><p>Sick</p>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Annual summary mini-cards */}
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 bg-slate-50 border border-slate-200 rounded-xl">
                            <p className="text-2xl font-bold text-slate-700">{yearTotalDays}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Total Days</p>
                          </div>
                          <div className="text-center p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                            <p className="text-2xl font-bold text-emerald-700">{yearApproved}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Approved</p>
                          </div>
                          <div className="text-center p-3 bg-amber-50 border border-amber-200 rounded-xl">
                            <p className="text-2xl font-bold text-amber-700">{yearPending}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Pending</p>
                          </div>
                        </div>
                        {/* Month-by-month bars */}
                        <div className="bg-background border border-border rounded-xl overflow-hidden">
                          <div className="px-4 py-3 border-b border-border">
                            <h4 className="text-sm font-bold text-foreground">Month-by-Month Breakdown (Apr–Mar)</h4>
                          </div>
                          <div className="divide-y divide-border">
                            {monthlyLeaveReport.map((row: any) => {
                              const isThisMonth = row.month === currentMonthAbbr && row.year === now.getFullYear();
                              const barW = maxDays > 0 ? Math.round((row.totalDays / maxDays) * 100) : 0;
                              return (
                                <div key={row.monthYear} className={`px-4 py-3 ${isThisMonth ? 'bg-primary/5' : row.totalDays === 0 ? 'opacity-40' : ''}`}>
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-foreground w-16">{row.monthYear}</span>
                                      {isThisMonth && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-bold">NOW</span>}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs flex-wrap justify-end">
                                      {row.approvedDays > 0 && <span className="text-emerald-600 font-semibold">{row.approvedDays} approved</span>}
                                      {row.pendingDays > 0 && <span className="text-amber-600 font-semibold">{row.pendingDays} pending</span>}
                                      {row.casualDays > 0 && <span className="text-blue-600">{row.casualDays}CL</span>}
                                      {row.sickDays > 0 && <span className="text-rose-600">{row.sickDays}SL</span>}
                                      <span className="font-bold text-foreground w-5 text-right">{row.totalDays}</span>
                                    </div>
                                  </div>
                                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-700"
                                      style={{ width: `${barW}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* ── Leave Letters Sub-view ── */}
              {leaveReportView === 'list' && (
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
              )}
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
                <label className="block text-sm font-medium text-foreground mb-1">Location (Optional)</label>
                <input
                  type="text"
                  value={updateForm.location}
                  onChange={(e) => setUpdateForm({...updateForm, location: e.target.value})}
                  className="w-full border border-input rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  placeholder="e.g. Field Site / Branch Office / GPS Location"
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
