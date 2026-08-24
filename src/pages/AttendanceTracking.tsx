import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Loader2, Navigation, Plus, RefreshCw, Route, Shield, Compass, Zap, Calendar, CheckCircle2, AlertTriangle, Radio, Users, Sun, Moon } from 'lucide-react';
import L from 'leaflet';
import { API_BASE_URL } from '../config';

// Fix Leaflet's default icon path issues with Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export interface LocationPoint {
  lat: number;
  lng: number;
  address?: string;
  time?: string;
  label?: string;
  type?: 'signin' | 'checkpoint' | 'signout' | 'present' | 'current';
}

interface AttendanceRecord {
  id: string;
  empId: string;
  empName: string;
  date: string;
  status: string;
  checkIn: string;
  checkOut: string;
  hrs: string;
  startLoc: string;
  endLoc: string;
  selfie: string;
  loginLoc: { lat: number; lng: number; address: string } | null;
  logoutLoc: { lat: number; lng: number; address: string } | null;
  routePoints?: LocationPoint[];
}

// Helper to fit map bounds automatically to route points
function MapController({ points }: { points: LocationPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 0) {
      const validPts = points.filter(p => p.lat !== 0 && p.lng !== 0);
      if (validPts.length > 0) {
        const bounds = L.latLngBounds(validPts.map(p => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      }
    }
  }, [points, map]);
  return null;
}

// Custom Leaflet marker icons with Green (Sign-In) and Blue (Present Location)
const createCleanMarkerIcon = (type: 'signin' | 'present' | 'signout' | 'current', nameLabel?: string) => {
  let bgColor = '#10b981'; // Green for Sign-In Location
  if (type === 'signout') {
    bgColor = '#ef4444'; // Red for Sign-Out (After 6 PM)
  } else if (type === 'present' || type === 'current') {
    bgColor = '#2563eb'; // Vibrant Blue for Present Location
  }

  const pinSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;

  return L.divIcon({
    className: 'custom-clean-pin-wrapper',
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center; cursor: pointer;">
        ${type !== 'signin' ? `<div style="position: absolute; width: 40px; height: 40px; border-radius: 50%; background-color: ${bgColor}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>` : ''}
        <div style="background-color: ${bgColor}; color: white; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
          ${pinSvg}
        </div>
        ${nameLabel ? `<div style="position: absolute; top: -24px; white-space: nowrap; background: rgba(0,0,0,0.75); color: white; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;">${nameLabel}</div>` : ''}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
};

export function AttendanceTracking() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [mapViewMode, setMapViewMode] = useState<'single' | 'all'>('single');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<string>('today');
  const [isLoading, setIsLoading] = useState(true);
  const [roadPolyline, setRoadPolyline] = useState<[number, number][]>([]);
  const [isRoutingLoading, setIsRoutingLoading] = useState(false);
  
  // HTML5 Browser Geolocation & Permission State
  const [geoPermissionStatus, setGeoPermissionStatus] = useState<'granted' | 'prompt' | 'denied' | 'unsupported'>('prompt');
  const [isLiveTrackingActive, setIsLiveTrackingActive] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string>('');

  // Dynamic user device location center state (no hardcoded location)
  const [userDeviceCenter, setUserDeviceCenter] = useState<[number, number]>([16.50617, 80.64801]);

  // Real Address Name Resolution state & cache for all employee records
  const [signInAddressName, setSignInAddressName] = useState<string>('');
  const [presentAddressName, setPresentAddressName] = useState<string>('');
  const [recordAddressNames, setRecordAddressNames] = useState<Record<string, { signIn: string; present: string }>>({});

  // Add Checkpoint Modal state
  const [showAddPointModal, setShowAddPointModal] = useState(false);
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [isSubmittingPoint, setIsSubmittingPoint] = useState(false);

  const cleanLocationAddress = (fullStr: string): string => {
    if (!fullStr) return '';
    const parts = fullStr.split(', ').map(p => p.trim());
    const filtered = parts.filter(p => 
      !/^\d{5,6}$/.test(p) && 
      !['india', 'telangana', 'andhra pradesh'].includes(p.toLowerCase())
    );
    return (filtered.length > 0 ? filtered : parts).slice(0, 3).join(', ');
  };

  const getAddressNameFromCoords = async (lat: number, lng: number, fallback: string): Promise<string> => {
    if (!lat || !lng) return cleanLocationAddress(fallback) || fallback;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.display_name) {
          return cleanLocationAddress(data.display_name);
        }
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }
    return cleanLocationAddress(fallback) || fallback;
  };

  // Request & Monitor HTML5 Browser Geolocation Permissions & Center
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoPermissionStatus('unsupported');
      setPermissionError('Browser does not support HTML5 Geolocation.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserDeviceCenter([pos.coords.latitude, pos.coords.longitude]);
      },
      () => {},
      { timeout: 5000 }
    );

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setGeoPermissionStatus(result.state as 'granted' | 'prompt' | 'denied');
        result.onchange = () => {
          setGeoPermissionStatus(result.state as 'granted' | 'prompt' | 'denied');
        };
      }).catch(() => {
        setGeoPermissionStatus('prompt');
      });
    }
  }, []);

  const requestBrowserLocation = () => {
    if (!('geolocation' in navigator)) return;
    setPermissionError('');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoPermissionStatus('granted');
        const coords = {
          lat: Math.round(position.coords.latitude * 100000) / 100000,
          lng: Math.round(position.coords.longitude * 100000) / 100000,
        };

        if (selectedRecord) {
          sendGpsUpdate(selectedRecord.id, coords.lat, coords.lng, "Live Browser GPS Location");
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGeoPermissionStatus('denied');
          setPermissionError('Location permission denied. Please allow location access in browser settings.');
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          setPermissionError('GPS position unavailable. Ensure device location services are enabled.');
        } else if (error.code === error.TIMEOUT) {
          setPermissionError('Location request timed out. Please try again.');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Watch position for continuous real-time movement updates when live tracking is toggled
  useEffect(() => {
    let watchId: number | null = null;
    if (isLiveTrackingActive && 'geolocation' in navigator && selectedRecord) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const lat = Math.round(position.coords.latitude * 100000) / 100000;
          const lng = Math.round(position.coords.longitude * 100000) / 100000;
          sendGpsUpdate(selectedRecord.id, lat, lng, "Live Movement GPS Update");
        },
        (error) => {
          console.error("Watch position error:", error.message);
        },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
      );
    }
    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [isLiveTrackingActive, selectedRecord]);

  const sendGpsUpdate = async (recordId: string, lat: number, lng: number, addressText: string) => {
    try {
      let resolvedAddress = addressText;
      if (!addressText || addressText.includes('Location Point') || addressText.includes('GPS Location') || addressText === 'Live Browser GPS Location') {
        resolvedAddress = await getAddressNameFromCoords(lat, lng, addressText);
      }

      const res = await fetch(`${API_BASE_URL}/api/attendance/${recordId}/location-point`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lng,
          address: resolvedAddress,
        })
      });
      if (res.ok) {
        await fetchAttendance();
      }
    } catch (err) {
      console.error('Failed to update live GPS location:', err);
    }
  };

  const fetchAttendance = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
        if (data.length > 0) {
          setSelectedRecord(prev => {
            if (!prev) return data[0];
            const found = data.find((r: AttendanceRecord) => r.id === prev.id);
            return found || data[0];
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch attendance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
    const timer = setInterval(fetchAttendance, 15000);
    return () => clearInterval(timer);
  }, []);

  // Fetch OSRM Road routing line from Sign-In to Present/Sign-Out Location
  useEffect(() => {
    if (!selectedRecord || !selectedRecord.routePoints || selectedRecord.routePoints.length < 2) {
      setRoadPolyline([]);
      return;
    }

    const pts = selectedRecord.routePoints;
    const fallbackPolyline = pts.map(p => [p.lat, p.lng] as [number, number]);
    
    setIsRoutingLoading(true);
    const coordsStr = pts.map(p => `${p.lng},${p.lat}`).join(';');
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;

    fetch(osrmUrl)
      .then(res => res.json())
      .then(data => {
        if (data.routes && data.routes.length > 0 && data.routes[0].geometry) {
          const routeCoords = data.routes[0].geometry.coordinates.map(
            (c: [number, number]) => [c[1], c[0]] as [number, number]
          );
          setRoadPolyline(routeCoords);
        } else {
          setRoadPolyline(fallbackPolyline);
        }
      })
      .catch(() => {
        setRoadPolyline(fallbackPolyline);
      })
      .finally(() => {
        setIsRoutingLoading(false);
      });
  }, [selectedRecord]);

  // Resolve Real Location Address Names for Sign-In and Present Location
  useEffect(() => {
    if (!selectedRecord || !selectedRecord.routePoints || selectedRecord.routePoints.length === 0) {
      setSignInAddressName('');
      setPresentAddressName('');
      return;
    }

    const signInPt = selectedRecord.routePoints.find(p => p.type === 'signin') || selectedRecord.routePoints[0];
    const presentPt = selectedRecord.routePoints[selectedRecord.routePoints.length - 1];

    if (signInPt && signInPt.lat && signInPt.lng) {
      const existing = signInPt.address || selectedRecord.startLoc || '';
      if (existing && !existing.startsWith('Point ') && !existing.includes('Location Point') && existing !== 'Exact GPS Location') {
        setSignInAddressName(existing);
      } else {
        getAddressNameFromCoords(signInPt.lat, signInPt.lng, 'Sign-In Location').then(setSignInAddressName);
      }
    }

    if (presentPt && presentPt.lat && presentPt.lng) {
      const existing = presentPt.address || selectedRecord.endLoc || '';
      if (existing && !existing.startsWith('Point ') && !existing.includes('Location Point') && existing !== 'Exact GPS Location') {
        setPresentAddressName(existing);
      } else {
        getAddressNameFromCoords(presentPt.lat, presentPt.lng, 'Present Location').then(setPresentAddressName);
      }
    }
  }, [selectedRecord]);

  // Resolve Real Location Address Names for ALL Employee Records in the table
  useEffect(() => {
    if (!records || records.length === 0) return;

    records.forEach(async (rec) => {
      const firstPt = rec.routePoints?.[0];
      const lastPt = rec.routePoints?.[rec.routePoints.length - 1];

      let resolvedSignIn = firstPt?.address || rec.startLoc || 'Sign-In Location';
      let resolvedPresent = lastPt?.address || rec.endLoc || 'Present Location';

      if (firstPt && firstPt.lat && firstPt.lng) {
        if (!resolvedSignIn || resolvedSignIn.startsWith('Point ') || resolvedSignIn.includes('Location Point') || resolvedSignIn === 'Exact GPS Location' || resolvedSignIn === 'Live Browser GPS Location') {
          resolvedSignIn = await getAddressNameFromCoords(firstPt.lat, firstPt.lng, 'Sign-In Location');
        }
      }

      if (lastPt && lastPt.lat && lastPt.lng) {
        if (!resolvedPresent || resolvedPresent.startsWith('Point ') || resolvedPresent.includes('Location Point') || resolvedPresent === 'Exact GPS Location' || resolvedPresent === 'Live Browser GPS Location' || resolvedPresent === 'Live Movement GPS Update') {
          resolvedPresent = await getAddressNameFromCoords(lastPt.lat, lastPt.lng, 'Present Location');
        }
      }

      setRecordAddressNames(prev => ({
        ...prev,
        [rec.id]: { signIn: resolvedSignIn, present: resolvedPresent }
      }));
    });
  }, [records]);

  const getTodayIST = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset() + 330);
    return d.toISOString().split('T')[0];
  };
  
  const todayStr = getTodayIST();
  
  const filteredRecords = records.filter(record => {
    const matchesSearch = 
      record.empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.empId.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (dateFilter === 'today') {
      return record.date === todayStr;
    } else if (dateFilter !== 'all') {
      return record.date === dateFilter;
    }
    
    return true;
  });

  // Haversine formula to compute total route distance in km
  const calculateTotalDistance = (points?: LocationPoint[]): string => {
    if (!points || points.length < 2) return '0.0 km';
    let totalKm = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const R = 6371;
      const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
      const dLng = (p2.lng - p1.lng) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      totalKm += R * c;
    }
    return totalKm.toFixed(1) + ' km';
  };

  // Helper to check if current time is after 6:00 PM (18:00 IST)
  const isAfter6PM = (): boolean => {
    const now = new Date();
    const istHours = (now.getUTCHours() + 5 + Math.floor((now.getUTCMinutes() + 30) / 60)) % 24;
    return istHours >= 18;
  };

  const showSignOut = isAfter6PM();

  const handleAddCheckpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    setIsSubmittingPoint(true);
    try {
      const latNum = parseFloat(newLat);
      const lngNum = parseFloat(newLng);
      if (isNaN(latNum) || isNaN(lngNum)) {
        alert('Please enter valid numeric latitude and longitude coordinates.');
        return;
      }

      await sendGpsUpdate(selectedRecord.id, latNum, lngNum, newAddress || 'Present Location Checkpoint');
      setShowAddPointModal(false);
      setNewLat('');
      setNewLng('');
      setNewAddress('');
    } catch (err) {
      console.error('Error adding checkpoint:', err);
      alert('Error recording location point.');
    } finally {
      setIsSubmittingPoint(false);
    }
  };

  const currentRoutePoints = selectedRecord?.routePoints || [];
  const signInPoint = currentRoutePoints.find(p => p.type === 'signin') || currentRoutePoints[0];
  const presentPoint = currentRoutePoints[currentRoutePoints.length - 1];

  // Map points for ALL employees mode
  const allEmployeesMapPoints: { record: AttendanceRecord; pt: LocationPoint }[] = filteredRecords.flatMap(r => 
    (r.routePoints || []).map(pt => ({ record: r, pt }))
  );

  const handleSelectRecordLocation = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setMapViewMode('single');
    const mapSection = document.getElementById('location-map-section');
    if (mapSection) {
      mapSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Compass className="w-8 h-8 text-primary" />
            Attendance & Live Location Tracking
          </h1>
          <p className="text-muted-foreground mt-1">
            Sign-In Location in <strong className="text-emerald-600">Green 🟢</strong> and Present Location in <strong className="text-blue-600">Blue 🔵</strong> with real location names.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchAttendance()}
            className="flex items-center gap-2 text-sm bg-card hover:bg-accent border border-border px-4 py-2.5 rounded-lg font-medium shadow-sm transition"
            title="Refresh Attendance & Location Data"
          >
            <RefreshCw className={`w-4 h-4 text-primary ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>

          {selectedRecord && (
            <button
              onClick={() => setShowAddPointModal(true)}
              className="flex items-center gap-2 text-sm bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-lg font-medium shadow transition"
            >
              <Plus className="w-4 h-4" />
              <span>Update Present GPS</span>
            </button>
          )}
        </div>
      </div>

      {/* OVERALL SUMMARY BANNER */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Total Signed-In Employees */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Signed-In Today</span>
            <Users className="w-5 h-5 text-primary" />
          </div>
          <div className="text-2xl font-extrabold text-foreground">
            {filteredRecords.length} Employees
          </div>
          <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Active Attendance Logging
          </p>
        </div>

        {/* Card 2: 6:00 PM Display Mode Status */}
        <div className={`border rounded-xl p-5 shadow-sm space-y-2 ${
          showSignOut ? 'bg-rose-50/70 border-rose-200 text-rose-950' : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider">6:00 PM Tracking Rule</span>
            {showSignOut ? <Moon className="w-5 h-5 text-rose-600" /> : <Sun className="w-5 h-5 text-emerald-600" />}
          </div>
          <div className="text-base font-extrabold">
            {showSignOut ? 'Evening View (After 6:00 PM)' : 'Daytime View (Before 6:00 PM)'}
          </div>
          <p className="text-xs font-medium opacity-90">
            {showSignOut ? 'Showing Complete Sign-In → Sign-Out Live Track' : 'Sign-In (Green 🟢) → Present Location (Blue 🔵)'}
          </p>
        </div>

        {/* Card 3: Map Mode View Switcher */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">Map Overview Mode</span>
            <Route className="w-5 h-5 text-primary" />
          </div>
          <div className="flex items-center gap-1.5 bg-muted p-1 rounded-lg border border-border">
            <button
              onClick={() => setMapViewMode('single')}
              className={`flex-1 text-xs py-1.5 rounded-md font-bold transition ${
                mapViewMode === 'single' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Single Focus
            </button>
            <button
              onClick={() => setMapViewMode('all')}
              className={`flex-1 text-xs py-1.5 rounded-md font-bold transition ${
                mapViewMode === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All Employees Mode
            </button>
          </div>
        </div>

        {/* Card 4: HTML5 Geolocation Status */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold uppercase tracking-wider">GPS Permission Status</span>
            <Radio className={`w-5 h-5 ${isLiveTrackingActive ? 'text-emerald-600 animate-pulse' : 'text-primary'}`} />
          </div>
          <div className="text-sm font-bold flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
              geoPermissionStatus === 'granted' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
              geoPermissionStatus === 'denied' ? 'bg-rose-100 text-rose-800 border-rose-300' :
              'bg-amber-100 text-amber-800 border-amber-300'
            }`}>
              {geoPermissionStatus === 'granted' ? 'GPS Granted' : geoPermissionStatus === 'denied' ? 'GPS Denied' : 'Prompt Needed'}
            </span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={requestBrowserLocation}
              className="text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded transition"
            >
              Fetch GPS
            </button>
            <button
              onClick={() => setIsLiveTrackingActive(prev => !prev)}
              className="text-[11px] bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground font-bold px-2.5 py-1 rounded transition border border-primary/20"
            >
              {isLiveTrackingActive ? 'Stop Watch' : 'Live Watch'}
            </button>
          </div>
        </div>
      </div>

      {permissionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{permissionError}</span>
        </div>
      )}

      {/* SECTION 1: Attendance Records Table (Green Sign-In & Blue Present Location) */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="p-5 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-muted/20">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Employee Attendance & Live Location Log</h2>
            <span className="ml-2 text-xs font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
              {filteredRecords.length} Signed-In Employees
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Buttons */}
            <div className="flex items-center bg-background border border-input rounded-lg p-1 text-xs font-semibold">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-3 py-1.5 rounded-md transition ${dateFilter === 'today' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Today ({todayStr})
              </button>
              <button
                onClick={() => setDateFilter('all')}
                className={`px-3 py-1.5 rounded-md transition ${dateFilter === 'all' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All Records ({records.length})
              </button>
            </div>

            {/* Custom Date Input */}
            <div className="relative">
              <input
                type="date"
                value={dateFilter === 'all' || dateFilter === 'today' ? '' : dateFilter}
                onChange={(e) => setDateFilter(e.target.value || 'all')}
                className="pl-8 pr-3 py-1.5 bg-background border border-input rounded-lg text-xs font-medium focus:ring-2 focus:ring-primary focus:outline-none"
              />
              <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5 pointer-events-none" />
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search Employee ID or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-1.5 bg-background border border-input rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b border-border font-bold tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Employee Name & Date</th>
                <th className="px-4 py-3.5">Employee ID</th>
                <th className="px-5 py-3.5">Sign In Location 🟢</th>
                <th className="px-5 py-3.5 bg-blue-50/50 text-blue-900 font-extrabold border-x border-blue-200/60">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                    </span>
                    <span>Live Present Location Update 🔵</span>
                  </div>
                </th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Location Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRecords.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    No sign-in attendance records found for selected filter ({dateFilter === 'today' ? todayStr : dateFilter}).
                  </td>
                </tr>
              )}

              {filteredRecords.map((record) => {
                const isSelected = selectedRecord?.id === record.id && mapViewMode === 'single';
                const firstPt = record.routePoints?.[0];
                const lastPt = record.routePoints?.[record.routePoints.length - 1];

                const resolvedNames = recordAddressNames[record.id];
                const signInLocName = resolvedNames?.signIn || firstPt?.address || record.startLoc || 'Sign-In Location';
                const presentLocName = resolvedNames?.present || lastPt?.address || record.endLoc || 'Present Location';

                return (
                  <tr
                    key={record.id}
                    onClick={() => handleSelectRecordLocation(record)}
                    className={`hover:bg-muted/40 transition-colors cursor-pointer ${
                      isSelected ? 'bg-primary/10 border-l-4 border-primary font-medium' : 'border-l-4 border-transparent'
                    }`}
                  >
                    {/* Employee Profile & Name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-3">
                        {record.selfie ? (
                          <img src={record.selfie} alt={record.empName} className="w-10 h-10 rounded-full border border-border object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-border text-primary font-bold text-base shrink-0">
                            {record.empName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-foreground text-sm">{record.empName}</div>
                          <div className="text-xs text-muted-foreground">{record.date}</div>
                        </div>
                      </div>
                    </td>

                    {/* Employee ID */}
                    <td className="px-4 py-4">
                      <span className="font-mono text-xs font-semibold bg-muted px-2.5 py-1 rounded-md text-foreground border border-border">
                        {record.empId}
                      </span>
                    </td>

                    {/* Sign In Location (Green Symbol 🟢) */}
                    <td className="px-5 py-4">
                      <div className="flex items-start space-x-2 text-emerald-800 bg-emerald-50 border border-emerald-300 p-2 rounded-lg max-w-xs shadow-xs">
                        <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                          <MapPin className="w-3 h-3 text-white" />
                        </div>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5 text-emerald-900">
                            <span>{record.checkIn}</span>
                            <span className="text-[10px] bg-emerald-200 text-emerald-800 px-1.5 py-0.2 rounded font-mono">Sign-In</span>
                          </div>
                          <div className="text-xs text-emerald-950 font-semibold leading-snug line-clamp-2 mt-0.5">
                            {signInLocName}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Present Location (Blue Symbol 🔵) */}
                    <td className="px-5 py-4">
                      <div className={`flex items-start space-x-2 p-2 rounded-lg max-w-xs shadow-xs border ${
                        showSignOut 
                          ? 'text-rose-900 bg-rose-50 border-rose-300' 
                          : 'text-blue-900 bg-blue-50 border-blue-300'
                      }`}>
                        <div className={`w-5 h-5 rounded-full text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${
                          showSignOut ? 'bg-rose-600' : 'bg-blue-600'
                        }`}>
                          <MapPin className="w-3 h-3 text-white" />
                        </div>
                        <div>
                          <div className="font-bold text-xs flex items-center gap-1.5">
                            <span>{showSignOut && record.checkOut !== 'N/A' ? record.checkOut : 'Active Now'}</span>
                            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                              showSignOut ? 'bg-rose-200 text-rose-800' : 'bg-blue-200 text-blue-800'
                            }`}>
                              {showSignOut ? 'Sign-Out' : 'Present'}
                            </span>
                          </div>
                          <div className="text-xs font-semibold leading-snug line-clamp-2 mt-0.5">
                            {presentLocName}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-emerald-100 text-emerald-700 border-emerald-200">
                        Present
                      </span>
                    </td>

                    {/* Location Action Button */}
                    <td className="px-5 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectRecordLocation(record);
                        }}
                        className={`inline-flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg font-bold transition-all shadow-sm ${
                          isSelected 
                            ? 'bg-primary text-primary-foreground shadow-md' 
                            : 'bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20'
                        }`}
                      >
                        <MapPin className="w-4 h-4" />
                        <span>Track Location</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Interactive Location Map (Green Sign-In & Blue Present Location) */}
      <div id="location-map-section" className="bg-card rounded-xl border border-border shadow-sm overflow-hidden scroll-mt-6">
        {/* Map Header Info */}
        <div className="p-5 border-b border-border flex flex-wrap items-center justify-between bg-muted/20 gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-sm">
              <Navigation className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                {mapViewMode === 'all' ? (
                  <span>All Signed-In Employees Live Overview Map</span>
                ) : selectedRecord ? (
                  <span>{selectedRecord.empName} ({selectedRecord.empId}) — Live Route Map</span>
                ) : (
                  <span>Location Route Map</span>
                )}
              </h3>
              <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                {mapViewMode === 'all' ? (
                  <span>Showing all {filteredRecords.length} active signed-in employees across the map.</span>
                ) : selectedRecord ? (
                  <>
                    <span>Sign In (Green 🟢): <strong className="text-emerald-600 font-semibold">{selectedRecord.checkIn}</strong></span>
                    <span>•</span>
                    <span>Present Location (Blue 🔵): <strong className="text-blue-600 font-semibold">{showSignOut && selectedRecord.checkOut !== 'N/A' ? selectedRecord.checkOut : 'Active Now'}</strong></span>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {mapViewMode === 'single' && selectedRecord && (
              <span className="text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm">
                <Route className="w-4 h-4 text-blue-600" />
                Sign-In to Present Route: {calculateTotalDistance(selectedRecord.routePoints)}
              </span>
            )}

            <button
              onClick={() => setMapViewMode(prev => prev === 'single' ? 'all' : 'single')}
              className="text-xs bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border border-primary/20 px-3.5 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5"
            >
              <Users className="w-4 h-4" />
              <span>{mapViewMode === 'single' ? 'Switch to All Employees Overview' : 'Switch to Focused Mode'}</span>
            </button>
          </div>
        </div>

        {!selectedRecord && mapViewMode === 'single' ? (
          <div className="text-center py-24 text-muted-foreground bg-muted/20">
            Click on any employee's <strong>"Track Location"</strong> button above to view sign-in location and present location route.
          </div>
        ) : (
          <div className="space-y-0">
            {/* Main Leaflet Map View */}
            <div className="h-[540px] w-full relative z-0 border-b border-border">
              <MapContainer 
                center={mapViewMode === 'single' && currentRoutePoints.length > 0 ? [currentRoutePoints[0].lat, currentRoutePoints[0].lng] : userDeviceCenter} 
                zoom={13} 
                style={{ height: '100%', width: '100%' }}
                key={`map-view-${mapViewMode}-${selectedRecord?.id}-${currentRoutePoints.length}`}
              >
                <TileLayer 
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />

                {mapViewMode === 'single' ? (
                  <>
                    <MapController points={currentRoutePoints} />

                    {/* Outer Glowing Blur Blue Polyline */}
                    {roadPolyline.length > 0 && (
                      <Polyline 
                        positions={roadPolyline} 
                        pathOptions={{ 
                          color: '#3b82f6', 
                          weight: 12, 
                          opacity: 0.35, 
                          lineCap: 'round', 
                          lineJoin: 'round' 
                        }} 
                      />
                    )}

                    {/* Main Google Maps Blue Line */}
                    {roadPolyline.length > 0 && (
                      <Polyline 
                        positions={roadPolyline} 
                        pathOptions={{ 
                          color: '#2563eb', 
                          weight: 6, 
                          opacity: 0.95, 
                          lineCap: 'round', 
                          lineJoin: 'round' 
                        }} 
                      />
                    )}

                    {/* 1. Sign-In Location Marker (GREEN Pin) */}
                    {signInPoint && (
                      <Marker 
                        position={[signInPoint.lat, signInPoint.lng]}
                        icon={createCleanMarkerIcon('signin')}
                      >
                        <Tooltip permanent={false} direction="top" offset={[0, -14]}>
                          <span className="font-bold text-xs text-emerald-700">🟢 Sign-In: {signInAddressName || signInPoint.address}</span>
                        </Tooltip>
                        <Popup>
                          <div className="p-1 space-y-1 max-w-xs">
                            <div className="font-bold text-sm text-emerald-600 flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-emerald-600" /> Sign-In Location (Green 🟢)
                            </div>
                            <div className="text-xs text-foreground font-medium leading-snug">
                              {signInAddressName || signInPoint.address || selectedRecord?.startLoc || 'Sign-In Location Address'}
                            </div>
                            <div className="text-[11px] text-emerald-700 font-semibold pt-1 border-t border-border mt-1">
                              Sign In Time: {selectedRecord?.checkIn} | Lat: {signInPoint.lat}, Lng: {signInPoint.lng}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    )}

                    {/* 2. Present Location Marker (BLUE Pin) */}
                    {presentPoint && (
                      <Marker 
                        position={[presentPoint.lat, presentPoint.lng]}
                        icon={createCleanMarkerIcon(showSignOut ? 'signout' : 'present')}
                      >
                        <Tooltip permanent={false} direction="top" offset={[0, -14]}>
                          <span className="font-bold text-xs text-blue-700">
                            {showSignOut ? '🔴 Sign-Out: ' : '🔵 Present Location: '} {presentAddressName || presentPoint.address}
                          </span>
                        </Tooltip>
                        <Popup>
                          <div className="p-1 space-y-1 max-w-xs">
                            <div className="font-bold text-sm text-blue-600 flex items-center gap-1">
                              <MapPin className="w-4 h-4 text-blue-600" /> {showSignOut ? 'Sign-Out Location' : 'Exact Present Location (Blue 🔵)'}
                            </div>
                            <div className="text-xs text-foreground font-medium leading-snug">
                              {presentAddressName || presentPoint.address || selectedRecord?.endLoc || 'Present Location Address'}
                            </div>
                            <div className="text-[11px] text-blue-700 font-semibold pt-1 border-t border-border mt-1">
                              Status: {showSignOut && selectedRecord && selectedRecord.checkOut !== 'N/A' ? `Signed Out at ${selectedRecord.checkOut}` : 'Present / Active Now'} | Lat: {presentPoint.lat}, Lng: {presentPoint.lng}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                  </>
                ) : (
                  /* ALL EMPLOYEES MODE MAP RENDERING */
                  <>
                    <MapController points={allEmployeesMapPoints.map(item => item.pt)} />
                    {allEmployeesMapPoints.map((item, idx) => (
                      <Marker
                        key={`all-pt-${idx}-${item.record.id}-${item.pt.lat}-${item.pt.lng}`}
                        position={[item.pt.lat, item.pt.lng]}
                        icon={createCleanMarkerIcon(
                          item.pt.type === 'signin' ? 'signin' : showSignOut ? 'signout' : 'present',
                          item.record.empName.split(' ')[0]
                        )}
                      >
                        <Popup>
                          <div className="p-1 space-y-1 max-w-xs">
                            <div className="font-bold text-sm text-primary">
                              {item.record.empName} ({item.record.empId})
                            </div>
                            <div className="text-xs font-semibold text-emerald-700">
                              {item.pt.type === 'signin' ? '🟢 Sign-In Location' : showSignOut ? '🔴 Sign-Out Location' : '🔵 Present Location'}
                            </div>
                            <div className="text-xs text-foreground">{item.pt.address}</div>
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                  </>
                )}
              </MapContainer>

              {isRoutingLoading && mapViewMode === 'single' && (
                <div className="absolute bottom-4 left-4 bg-background/95 backdrop-blur-md px-3.5 py-2 rounded-lg border border-border shadow-lg text-xs text-primary font-bold flex items-center gap-2 z-[1000]">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Drawing road route line (Sign-In to Present Location)...</span>
                </div>
              )}
            </div>

            {/* SECTION 3: Sign-In Location Details Card (Green) & Present Location Details Card (Blue) */}
            {selectedRecord && (
              <div className="p-6 bg-card">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Card 1: Sign-In Location Details (GREEN Theme) */}
                  <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-emerald-200/80 pb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center shadow-sm">
                          <MapPin className="w-4 h-4 text-white" />
                        </div>
                        <h4 className="text-sm font-bold text-emerald-900 uppercase tracking-wider">
                          Sign-In Location (Green 🟢)
                        </h4>
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-md border border-emerald-300">
                        Time: {selectedRecord.checkIn}
                      </span>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <div className="text-sm text-emerald-950 font-semibold leading-relaxed">
                          {signInAddressName || signInPoint?.address || selectedRecord.startLoc || 'Sign-In Location Address'}
                        </div>
                      </div>
                      
                      <div className="text-xs text-emerald-700 font-mono bg-emerald-100/60 p-2.5 rounded-lg border border-emerald-200/80 flex items-center justify-between">
                        <span>Sign-In Coordinates:</span>
                        <span className="font-bold">{signInPoint?.lat}, {signInPoint?.lng}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Present Location Details (BLUE Theme) */}
                  <div className="bg-blue-50/80 border border-blue-300 rounded-xl p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-blue-200/80 pb-3">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shadow-sm relative">
                          <MapPin className="w-4 h-4 text-white" />
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
                        </div>
                        <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wider">
                          {showSignOut ? 'Sign-Out Location' : 'Exact Present Location (Blue 🔵)'}
                        </h4>
                      </div>
                      <span className="text-xs font-bold text-blue-700 bg-blue-100 px-3 py-1 rounded-md border border-blue-300">
                        {showSignOut && selectedRecord.checkOut !== 'N/A' 
                          ? `Sign Out: ${selectedRecord.checkOut}` 
                          : 'Active / Live Now'}
                      </span>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                        <div className="text-sm text-blue-950 font-semibold leading-relaxed">
                          {presentAddressName || presentPoint?.address || selectedRecord.endLoc || 'Present Location Address'}
                        </div>
                      </div>

                      <div className="text-xs text-blue-700 font-mono bg-blue-100/60 p-2.5 rounded-lg border border-blue-200/80 flex items-center justify-between">
                        <span>{showSignOut ? 'Sign-Out' : 'Present'} Coordinates:</span>
                        <span className="font-bold">{presentPoint?.lat}, {presentPoint?.lng}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Add / Update Present Location Checkpoint */}
      {showAddPointModal && selectedRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4">
          <div className="bg-card rounded-xl border border-border shadow-2xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200 space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" /> Update Present GPS Location
              </h3>
              <button 
                onClick={() => setShowAddPointModal(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCheckpoint} className="space-y-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-border">
                <span>Updating location for <strong>{selectedRecord.empName}</strong> ({selectedRecord.empId}).</span>
                <button
                  type="button"
                  onClick={() => {
                    if ('geolocation' in navigator) {
                      navigator.geolocation.getCurrentPosition((pos) => {
                        setNewLat((Math.round(pos.coords.latitude * 100000) / 100000).toString());
                        setNewLng((Math.round(pos.coords.longitude * 100000) / 100000).toString());
                        setNewAddress('Live Browser Device Location');
                      });
                    }
                  }}
                  className="text-primary font-bold hover:underline shrink-0 flex items-center gap-1"
                >
                  <Zap className="w-3.5 h-3.5" /> Auto-fill GPS
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1 text-foreground">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 17.38504"
                    value={newLat}
                    onChange={(e) => setNewLat(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1 text-foreground">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 78.48667"
                    value={newLng}
                    onChange={(e) => setNewLng(e.target.value)}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">Present Location Address / Landmark</label>
                <input
                  type="text"
                  placeholder="e.g. Road No. 1, Jubilee Hills / Client Site"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPointModal(false)}
                  className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPoint}
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition flex items-center gap-1.5"
                >
                  {isSubmittingPoint && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Location</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
