import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Clock, MapPin, Search, Loader2 } from 'lucide-react';
import L from 'leaflet';
import { API_BASE_URL } from '../config';

// Fix Leaflet's default icon path issues with Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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
}

export function AttendanceTracking() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchAttendance = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/attendance`);
      if (res.ok) {
        const data = await res.json();
        setRecords(data);
        if (!selectedRecord && data.length > 0) {
          setSelectedRecord(data[0]);
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
    const timer = setInterval(fetchAttendance, 30000); // Auto-update every 30s
    return () => clearInterval(timer);
  }, []);

  const filteredRecords = records.filter(record => 
    record.empName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.empId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Attendance & Location</h1>
          <p className="text-muted-foreground mt-1">Live tracking of daily attendance, selfies, and GPS locations.</p>
        </div>
        {isLoading && <Loader2 className="w-5 h-5 animate-spin text-primary" />}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by name or ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <span className="text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full border border-primary/20">
                Live Feed
              </span>
            </div>
            
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3">Employee</th>
                    <th className="px-6 py-3">Time in / out</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRecords.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                        No attendance records found.
                      </td>
                    </tr>
                  )}
                  {filteredRecords.map((record) => (
                    <tr 
                      key={record.id} 
                      className={`hover:bg-muted/30 transition-colors cursor-pointer ${selectedRecord?.id === record.id ? 'bg-muted/50 border-l-2 border-primary' : 'border-l-2 border-transparent'}`}
                      onClick={() => setSelectedRecord(record)}
                    >
                      <td className="px-6 py-4 flex items-center space-x-3">
                        {record.selfie ? (
                           <img src={record.selfie} alt={record.empName} className="w-10 h-10 rounded-full border border-border object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-border text-primary font-bold text-lg">
                            {record.empName.charAt(0)}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-foreground">{record.empName}</div>
                          <div className="text-xs text-muted-foreground">{record.empId} • {record.date}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center space-x-2 text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit">
                            <Clock className="w-3.5 h-3.5" /> 
                            <span className="font-medium text-xs">IN: {record.checkIn}</span>
                          </div>
                          <div className={`flex items-center space-x-2 px-2 py-1 rounded w-fit ${record.checkOut !== 'N/A' ? 'text-rose-600 bg-rose-50' : 'text-muted-foreground bg-muted'}`}>
                            <Clock className="w-3.5 h-3.5" /> 
                            <span className="font-medium text-xs">OUT: {record.checkOut}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          record.status === 'Present' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 
                          record.status === 'Absent' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                          'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        }`}>
                          {record.status}
                        </span>
                        {record.hrs !== 'N/A' && (
                          <div className="text-xs text-muted-foreground mt-1 ml-1">{record.hrs}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-primary hover:underline font-medium text-xs">
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Location Sidebar */}
        <div className="xl:col-span-1">
          <div className="bg-card rounded-lg border border-border shadow-sm p-4 sticky top-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center border-b border-border pb-3">
              <MapPin className="w-5 h-5 mr-2 text-primary" /> Location Details
            </h3>
            
            {!selectedRecord ? (
              <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border">
                Select an attendance record to view location data.
              </div>
            ) : selectedRecord.loginLoc || selectedRecord.logoutLoc ? (
              <div className="space-y-4 animate-in fade-in">
                <div className="h-64 rounded-lg overflow-hidden border border-border relative z-0">
                  <MapContainer 
                    center={selectedRecord.loginLoc ? [selectedRecord.loginLoc.lat, selectedRecord.loginLoc.lng] : [selectedRecord.logoutLoc!.lat, selectedRecord.logoutLoc!.lng]} 
                    zoom={13} 
                    style={{ height: '100%', width: '100%' }}
                    key={`map-${selectedRecord.id}`} // Force re-render when selection changes
                  >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {selectedRecord.loginLoc && (
                      <Marker position={[selectedRecord.loginLoc.lat, selectedRecord.loginLoc.lng]}>
                        <Popup>Login: {selectedRecord.loginLoc.address}</Popup>
                      </Marker>
                    )}
                    {selectedRecord.logoutLoc && (
                      <Marker position={[selectedRecord.logoutLoc.lat, selectedRecord.logoutLoc.lng]}>
                        <Popup>Logout: {selectedRecord.logoutLoc.address}</Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>
                
                <div className="space-y-3 pt-2">
                  {selectedRecord.loginLoc && (
                    <div className="bg-emerald-50/50 p-3 rounded-lg border border-emerald-100">
                      <div className="flex items-center text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2"></div>
                        Login Location
                      </div>
                      <div className="text-sm text-foreground ml-4 leading-relaxed">{selectedRecord.loginLoc.address}</div>
                    </div>
                  )}
                  <div className="bg-rose-50/50 p-3 rounded-lg border border-rose-100">
                    <div className="flex items-center text-xs font-bold text-rose-700 uppercase tracking-wider mb-1">
                      <div className="w-2 h-2 rounded-full bg-rose-500 mr-2"></div>
                      Logout Location
                    </div>
                    <div className="text-sm text-foreground ml-4 leading-relaxed">{selectedRecord.logoutLoc?.address || 'Not checked out yet'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border">
                No GPS coordinates available for {selectedRecord.empName} today.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
