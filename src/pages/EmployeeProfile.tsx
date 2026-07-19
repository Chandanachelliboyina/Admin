import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Mail, Phone, MapPin, Briefcase, Calendar, Info, Map, Building, Edit2, Save, X, Download, Printer, Image as ImageIcon, Activity, Trash2, Search, CalendarRange, Bell, Plus, Check } from 'lucide-react';

interface Employee {
  id: string;
  name: string;
  position: string;
  email: string;
  mobileNumber: string;
  gender: string;
  dateOfBirth: string;
  joiningDate: string;
  address: string;
  village: string;
  mandal: string;
  profile_picture?: string;
}

interface AttendanceRecord {
  date: string;
  status: string;
  checkIn: string;
  checkOut: string;
  hrs: string;
  start: string;
  end: string;
}

export function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState('personal');
  const [selectedMonth, setSelectedMonth] = useState('All Months');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [empResponse, attResponse] = await Promise.all([
          fetch(`http://localhost:8000/api/employees/${id}`),
          fetch(`http://localhost:8000/api/employees/${id}/attendance`)
        ]);
        
        if (!empResponse.ok) throw new Error('Failed to fetch employee details');
        
        const empData = await empResponse.json();
        setEmployee({
          ...empData,
          village: empData.village || 'N/A',
          mandal: empData.mandal || 'N/A'
        });
        
        if (attResponse.ok) {
          const attData = await attResponse.json();
          setAttendance(attData);
        }
      } catch (err: any) {
        console.error(err);
        setError('Could not load profile. Ensure the database connection is active.');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (id) {
      fetchData();
    }
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
        
        const response = await fetch(`http://localhost:8000/api/employees/${id}/profile-picture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_b64: base64String }),
        });

        if (response.ok) {
          setEmployee(prev => prev ? { ...prev, profile_picture: base64String } : null);
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
  
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading Profile from MongoDB...</span>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4">
        <p className="text-red-500 font-medium">{error || 'Employee not found'}</p>
        <button onClick={() => navigate('/employees')} className="text-blue-600 hover:underline">
          Return to Employee Management
        </button>
      </div>
    );
  }

  const getMonthNumber = (monthName: string) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months.indexOf(monthName.split(' ')[0]) + 1;
  };

  const filteredAttendanceData = attendance.filter(row => {
    if (selectedMonth === 'All Months') return true;
    const [monthName, year] = selectedMonth.split(' ');
    const targetMonth = getMonthNumber(monthName);
    const [rowYear, rowMonth] = row.date.split('-');
    return parseInt(rowYear) === parseInt(year) && parseInt(rowMonth) === targetMonth;
  });

  const handleExportCSV = () => {
    const headers = ['Date', 'Employee Name', 'Employee ID', 'Check In', 'Check Out', 'Hours', 'Status', 'Start Location', 'End Location'];
    const csvRows = [headers.join(',')];
    filteredAttendanceData.forEach(row => {
      const values = [row.date, `"${employee.name}"`, employee.id, row.checkIn, row.checkOut, row.hrs, row.status, `"${row.start}"`, `"${row.end}"`];
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
      <button onClick={() => navigate(-1)} className="flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back
      </button>

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
        <div className="text-center md:text-left mt-4 md:mt-0">
          <h1 className="text-2xl font-bold text-foreground">{employee.name}</h1>
          <p className="text-muted-foreground">{employee.position}</p>
          <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-primary/10 text-primary">{employee.id}</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="w-full md:w-64 space-y-1">
          {['personal', 'work', 'attendance', 'updates', 'activities', 'leave', 'notifications'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground hover:bg-muted'}`}>
              {tab === 'personal' && <User className="w-4 h-4" />}
              {tab === 'work' && <Building className="w-4 h-4" />}
              {tab === 'attendance' && <Calendar className="w-4 h-4" />}
              {tab === 'updates' && <ImageIcon className="w-4 h-4" />}
              {tab === 'activities' && <Activity className="w-4 h-4" />}
              {tab === 'leave' && <CalendarRange className="w-4 h-4" />}
              {tab === 'notifications' && <Bell className="w-4 h-4" />}
              <span className="capitalize">{tab}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 bg-card rounded-2xl border border-border p-6 shadow-sm">
          {activeTab === 'personal' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold border-b border-border pb-4 flex items-center"><Info className="w-5 h-5 mr-2 text-muted-foreground" /> Personal Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                <div><label className="text-sm text-muted-foreground block mb-1">Employee ID</label><div className="font-medium">{employee.id}</div></div>
                <div><label className="text-sm text-muted-foreground block mb-1">Name</label><div className="font-medium">{employee.name}</div></div>
                <div><label className="text-sm text-muted-foreground block mb-1">Email</label><div className="font-medium">{employee.email}</div></div>
                <div><label className="text-sm text-muted-foreground block mb-1">Mobile</label><div className="font-medium">{employee.mobileNumber}</div></div>
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <h2 className="text-xl font-semibold flex items-center"><Calendar className="w-5 h-5 mr-2 text-muted-foreground" /> Attendance History</h2>
                <div className="flex items-center space-x-3">
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-background border border-input text-sm rounded-md px-3 py-2">
                    <option>All Months</option>
                    {['July 2026', 'June 2026', 'May 2026'].map(m => <option key={m}>{m}</option>)}
                  </select>
                  <button onClick={handleExportCSV} className="flex items-center space-x-2 text-sm bg-secondary px-3 py-2 rounded-md"><Download className="w-4 h-4" /> Export</button>
                </div>
              </div>
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 uppercase">
                    <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Check In</th><th className="px-4 py-3">Check Out</th><th className="px-4 py-3">Status</th></tr>
                  </thead>
                  <tbody>
                    {filteredAttendanceData.map((row, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="px-4 py-3">{row.date}</td>
                        <td className="px-4 py-3">{row.checkIn}</td>
                        <td className="px-4 py-3">{row.checkOut}</td>
                        <td className="px-4 py-3">{row.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>


    </div>
  );
}
