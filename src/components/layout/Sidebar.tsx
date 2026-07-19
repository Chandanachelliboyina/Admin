import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Users, MapPin, LayoutDashboard, LogOut, Bell, Clock } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../../contexts/AuthContext';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
  { icon: Users, label: 'Employee Management', to: '/employees' },
  { icon: Bell, label: 'Notifications', to: '/notifications' },
  { icon: MapPin, label: 'Attendance Tracking', to: '/attendance' },
];

function LiveClock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDate = (date: Date) => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    const timeStr = date.toLocaleTimeString('en-US', { 
      hour12: true, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    return `${day} ${month} ${year}, ${timeStr}`;
  };

  return (
    <div className="flex items-center space-x-2 px-2 pb-4 mb-4 border-b border-border text-[13px] font-mono font-medium text-slate-700">
      <Clock className="w-5 h-5 text-blue-600 shrink-0" />
      <span>{formatDate(time)}</span>
    </div>
  );
}

export function Sidebar() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/signin');
  };

  return (
    <div className="w-64 bg-card border-r border-border h-screen flex flex-col p-4 space-y-4">
      <LiveClock />
      
      <div className="flex items-center space-x-2 px-2 pb-4 border-b border-border">
        <div className="h-10 w-10 flex items-center justify-center">
          <img src="/BMM_LOGO.jpg" alt="BMM Logo" className="w-full h-full object-contain rounded-full border border-border" />
        </div>
        <span className="text-lg font-bold">BMM Admin</span>
      </div>
      
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors",
                isActive 
                  ? "bg-accent text-accent-foreground font-medium" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="pt-4 border-t border-border mt-auto">
        <button
          onClick={handleLogout}
          className="flex w-full items-center space-x-3 px-3 py-2 rounded-md transition-colors text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
}
