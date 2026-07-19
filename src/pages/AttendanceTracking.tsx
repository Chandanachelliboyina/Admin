import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Clock, MapPin, Search } from 'lucide-react';
import L from 'leaflet';

// Fix Leaflet's default icon path issues with Webpack/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MOCK_ATTENDANCE = [
  {
    id: 'ATT001',
    empName: 'Alice Smith',
    loginTime: '09:00 AM',
    logoutTime: '05:30 PM',
    status: 'Present',
    selfie: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
    logoutSelfie: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
    loginLoc: { lat: 40.7128, lng: -74.0060, address: 'New York HQ' },
    logoutLoc: { lat: 40.7128, lng: -74.0060, address: 'New York HQ' },
  },
  {
    id: 'ATT002',
    empName: 'Bob Johnson',
    loginTime: '08:45 AM',
    logoutTime: '05:00 PM',
    status: 'Present',
    selfie: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
    logoutSelfie: 'https://i.pravatar.cc/150?u=a042581f4e29026704d',
    loginLoc: { lat: 37.7749, lng: -122.4194, address: 'San Francisco Office' },
    logoutLoc: { lat: 37.7749, lng: -122.4194, address: 'San Francisco Office' },
  },
  {
    id: 'ATT003',
    empName: 'Charlie Brown',
    loginTime: '--',
    logoutTime: '--',
    status: 'Absent',
    selfie: '',
    logoutSelfie: '',
    loginLoc: null,
    logoutLoc: null,
  },
];

export function AttendanceTracking() {
  const [selectedRecord, setSelectedRecord] = useState<typeof MOCK_ATTENDANCE[0] | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Attendance & Location</h1>
        <p className="text-muted-foreground mt-1">Track daily attendance, selfies, and live GPS locations.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="relative w-72">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search attendance..."
                  className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th className="px-6 py-3">Employee</th>
                    <th className="px-6 py-3">Time in / out</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_ATTENDANCE.map((record) => (
                    <tr 
                      key={record.id} 
                      className={`border-b border-border hover:bg-muted/30 transition-colors cursor-pointer ${selectedRecord?.id === record.id ? 'bg-muted/50' : ''}`}
                      onClick={() => setSelectedRecord(record)}
                    >
                      <td className="px-6 py-4 flex items-center space-x-3">
                        {record.selfie ? (
                           <img src={record.selfie} alt={record.empName} className="w-10 h-10 rounded-full border border-border object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center border border-border text-muted-foreground text-xs">No img</div>
                        )}
                        <span className="font-medium text-foreground">{record.empName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center space-x-1 text-emerald-600">
                          <Clock className="w-3 h-3" /> <span>{record.loginTime}</span>
                        </div>
                        <div className="flex items-center space-x-1 text-rose-600 mt-1">
                          <Clock className="w-3 h-3" /> <span>{record.logoutTime}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          record.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {record.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="text-blue-600 hover:underline font-medium text-xs">
                          Edit
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
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-primary" /> Location Details
            </h3>
            
            {!selectedRecord ? (
              <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border">
                Select an attendance record to view location data.
              </div>
            ) : selectedRecord.loginLoc ? (
              <div className="space-y-4">
                <div className="h-64 rounded-lg overflow-hidden border border-border relative z-0">
                  <MapContainer center={[selectedRecord.loginLoc.lat, selectedRecord.loginLoc.lng]} zoom={13} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={[selectedRecord.loginLoc.lat, selectedRecord.loginLoc.lng]}>
                      <Popup>Login: {selectedRecord.loginLoc.address}</Popup>
                    </Marker>
                  </MapContainer>
                </div>
                
                <div className="space-y-3 pt-2">
                  <div className="bg-emerald-50 p-3 rounded-md border border-emerald-100">
                    <div className="text-xs font-semibold text-emerald-800 uppercase mb-1">Login Location</div>
                    <div className="text-sm text-emerald-900">{selectedRecord.loginLoc.address}</div>
                  </div>
                  <div className="bg-rose-50 p-3 rounded-md border border-rose-100">
                    <div className="text-xs font-semibold text-rose-800 uppercase mb-1">Logout Location</div>
                    <div className="text-sm text-rose-900">{selectedRecord.logoutLoc?.address || 'Not checked out yet'}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border">
                No location data available for {selectedRecord.empName} (Absent).
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
