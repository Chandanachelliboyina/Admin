import React, { useState } from 'react';
import { Bell, Plus, Edit2, Trash2, X, Check } from 'lucide-react';

interface Notification {
  id: string;
  title: string;
  message: string;
  date: string;
}

const today = new Date();
const todayStr = today.toISOString().split('T')[0];
const tomorrowStr = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

const mockNotifications: Notification[] = [
  {
    id: '1',
    title: 'System Maintenance',
    message: 'The system will be down for maintenance on Saturday from 2 AM to 4 AM.',
    date: tomorrowStr,
  },
  {
    id: '2',
    title: 'Holiday Update',
    message: 'Diwali holiday is confirmed for Nov 12th.',
    date: todayStr,
  }
];

export function Notifications() {
  const [notifications, setNotifications] = useState<any[]>(mockNotifications);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentNotif, setCurrentNotif] = useState<any | null>(null);
  const [formData, setFormData] = useState({ title: '', message: '' });

  const handleOpenModal = (notif?: Notification) => {
    if (notif) {
      setCurrentNotif(notif);
      setFormData({ title: notif.title, message: notif.message });
    } else {
      setCurrentNotif(null);
      setFormData({ title: '', message: '' });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentNotif(null);
    setFormData({ title: '', message: '' });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.message) return;

    if (currentNotif) {
      // Edit
      setNotifications(notifications.map(n => 
        n.id === currentNotif.id 
          ? { ...n, title: formData.title, message: formData.message }
          : n
      ));
    } else {
      // Create
      const fullDate = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
      const newNotif: Notification = {
        id: Date.now().toString(),
        title: formData.title,
        message: formData.message,
        date: fullDate
      };
      setNotifications([newNotif, ...notifications]);
    }
    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this notification?')) {
      setNotifications(notifications.map(n => n.id === id ? { ...n, isDeleted: true } : n));
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Notifications</h1>
          <p className="text-muted-foreground mt-1">Manage system announcements and alerts.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90 flex items-center space-x-2 transition-transform active:scale-95 shadow-md self-start md:self-auto"
        >
          <Plus className="w-5 h-5" />
          <span>Create Notification</span>
        </button>
      </div>

      <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground flex flex-col items-center">
            <Bell className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p>No notifications created yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {notifications.map((notif) => (
              notif.isDeleted ? (
                <div key={notif.id} className="p-6 bg-muted/50 border-b border-dashed border-border flex justify-between items-center group">
                  <span className="text-sm text-muted-foreground flex items-center"><Trash2 className="w-4 h-4 mr-2" /> Notification deleted. Available in trash for 7 days.</span>
                  <button onClick={() => setNotifications(notifications.map(n => n.id === notif.id ? { ...n, isDeleted: false } : n))} className="text-blue-600 text-sm font-bold uppercase hover:underline transition-all">Undo</button>
                </div>
              ) : (
                <div key={notif.id} className="p-6 hover:bg-muted/30 transition-colors group">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start space-x-4">
                      <div className="p-3 bg-blue-100 text-blue-600 rounded-full mt-1">
                        <Bell className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg text-foreground">{notif.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 mb-3">{notif.message}</p>
                        <span className="text-xs text-muted-foreground font-medium bg-muted px-2 py-1 rounded-md">
                          {notif.date}
                        </span>
                      </div>
                    </div>
                    <div className="flex space-x-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenModal(notif)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(notif.id)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold">{currentNotif ? 'Edit Notification' : 'Create Notification'}</h2>
              <button onClick={handleCloseModal} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Title</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g. System Maintenance"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Message</label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder="Enter the notification message..."
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              
              <div className="pt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors flex items-center"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
