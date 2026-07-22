import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowRight, Users, UserCheck, Map, Activity, Clock, Loader2 } from 'lucide-react';

interface ActivityLog {
  action: string;
  time: string;
  type: string;
}

export function DashboardHome() {
  const navigate = useNavigate();
  const [searchId, setSearchId] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState({ totalEmployees: 0, presentToday: 0, activeLocations: 0 });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchActivities = async () => {
    try {
      const res = await fetch('http://localhost:8080/api/activities');
      if (res.ok) {
        setActivities(await res.json());
      }
      const statsRes = await fetch('http://localhost:8080/api/dashboard/stats');
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    const actTimer = setInterval(fetchActivities, 30000); // Polling every 30s
    return () => clearInterval(actTimer);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchId.trim()) {
      navigate('/employees/' + searchId.trim());
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-10">
      {/* Hero Section with Glassmorphism */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/90 via-primary to-primary/80 p-8 shadow-2xl">
        {/* Abstract Background Shapes */}
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        
        <div className="relative z-10 text-primary-foreground flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-2 drop-shadow-sm">
              Admin Dashboard
            </h1>
            <p className="text-primary-foreground/80 text-lg max-w-xl mb-8">
              Centralized management for workforce operations and access control.
            </p>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-xl max-w-lg shadow-[0_8px_32px_0_rgba(0,0,0,0.1)]">
              <h2 className="text-lg font-semibold mb-1 flex items-center">
                <Activity className="w-5 h-5 mr-2" /> Employee Lookup
              </h2>
              <p className="text-sm text-primary-foreground/70 mb-4">Search by Employee ID.</p>
              
              <form onSubmit={handleSearch} className="flex space-x-2">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                    placeholder="e.g. EMP001"
                    className="w-full pl-10 pr-4 py-3 bg-background text-foreground border border-transparent rounded-lg text-sm focus:outline-none focus:ring-4 focus:ring-primary/30 shadow-inner transition-all"
                  />
                </div>
                <button type="submit" className="bg-foreground text-background px-6 py-3 rounded-lg hover:bg-foreground/90 font-medium flex items-center space-x-2 transition-transform active:scale-95 shadow-md">
                  <span>Lookup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
          
          {/* Live Clock Display */}
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl shadow-lg flex items-center space-x-4 shrink-0 mt-4 md:mt-0">
             <div className="p-3 bg-white/20 rounded-full">
               <Clock className="w-6 h-6 text-white animate-pulse" />
             </div>
             <div>
               <div className="text-2xl font-bold tracking-tight">
                 {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
               </div>
               <div className="text-sm font-medium text-primary-foreground/80">
                 {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
               </div>
             </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: 'Total Employees', value: stats.totalEmployees.toString(), icon: Users, color: 'text-blue-600', bg: 'bg-blue-100', trend: 'Total registered' },
          { title: 'Present Today', value: stats.presentToday.toString(), icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-100', trend: "Today's check-ins" },
          { title: 'Active Locations', value: stats.activeLocations.toString(), icon: Map, color: 'text-purple-600', bg: 'bg-purple-100', trend: 'Across districts/mandals' },
        ].map((stat, i) => (
          <div key={i} className="bg-card border border-border p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow group cursor-default">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">Overview</span>
            </div>
            <h3 className="text-muted-foreground text-sm font-medium">{stat.title}</h3>
            <div className="text-3xl font-bold text-foreground mt-1 mb-2">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.trend}</p>
          </div>
        ))}
      </div>
      
      {/* Live Recent Activity */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center">
            Recent Activity Feed
            {isLoading && <Loader2 className="w-4 h-4 ml-3 animate-spin text-muted-foreground" />}
          </h2>
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">Live Updates</span>
        </div>
        
        <div className="bg-card border border-border rounded-2xl shadow-sm divide-y divide-border overflow-hidden">
          {activities.length === 0 && !isLoading && (
            <div className="p-6 text-center text-muted-foreground">
              No recent activity.
            </div>
          )}
          {activities.map((log, i) => (
            <div key={i} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
              <div className="flex items-center space-x-4">
                <div className={`w-2 h-2 rounded-full ${log.type === 'attendance' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                <span className="text-sm font-medium text-foreground">{log.action}</span>
              </div>
              <span className="text-xs text-muted-foreground">{log.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
