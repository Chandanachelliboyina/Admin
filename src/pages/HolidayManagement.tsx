import { useState, useEffect } from 'react';
import { Loader2, Plus, Calendar as CalendarIcon, Trash2, CalendarDays } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface Holiday {
  id: string;
  name: string;
  from_date: string;
  to_date: string;
  type: string;
  created_at: string;
}

export function HolidayManagement() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    from_date: '',
    to_date: '',
    type: 'Public Holiday',
    otherType: ''
  });

  const fetchHolidays = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/holidays`);
      if (res.ok) {
        const data = await res.json();
        setHolidays(data);
      }
    } catch (err) {
      console.error('Failed to fetch holidays:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'from_date') {
      setFormData({
        ...formData,
        from_date: value,
        to_date: value // Auto-fill to_date with from_date for single-day holidays
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    if (formData.from_date > formData.to_date) {
      setError('End date cannot be before start date.');
      setIsSubmitting(false);
      return;
    }

    const finalType = formData.type === 'Other' ? formData.otherType : formData.type;
    
    if (formData.type === 'Other' && !finalType.trim()) {
      setError('Please specify the holiday type.');
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        name: formData.name,
        from_date: formData.from_date,
        to_date: formData.to_date,
        type: finalType
      };

      const res = await fetch(`${API_BASE_URL}/api/holidays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setFormData({ name: '', from_date: '', to_date: '', type: 'Public Holiday', otherType: '' });
        fetchHolidays();
      } else {
        setError('Failed to create holiday.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/holidays/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchHolidays();
      }
    } catch (err) {
      console.error('Failed to delete holiday:', err);
    }
  };

  const holidayTypes = ['Public Holiday', 'Company Holiday', 'Festival', 'Other'];

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Holiday Management</h1>
        <p className="text-muted-foreground mt-1">Manage company holidays and block attendance during these dates.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden p-6">
            <h2 className="text-xl font-bold text-foreground flex items-center mb-6">
              <Plus className="w-5 h-5 mr-2 text-primary" />
              Add New Holiday
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-rose-50 text-rose-600 text-sm rounded-md border border-rose-100">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Holiday Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="e.g. Diwali, Christmas"
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Type</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mb-2"
                >
                  {holidayTypes.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {formData.type === 'Other' && (
                  <input
                    type="text"
                    name="otherType"
                    value={formData.otherType}
                    onChange={handleChange}
                    required
                    placeholder="Specify holiday type..."
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent mt-2"
                  />
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">From Date</label>
                <input
                  type="date"
                  name="from_date"
                  value={formData.from_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">To Date</label>
                <input
                  type="date"
                  name="to_date"
                  value={formData.to_date}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors font-medium flex items-center justify-center mt-2"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Holiday'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden h-full">
            <div className="p-6 border-b border-border flex justify-between items-center bg-muted/20">
              <h2 className="text-xl font-bold text-foreground flex items-center">
                <CalendarDays className="w-5 h-5 mr-2 text-primary" />
                Declared Holidays
              </h2>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center items-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : holidays.length === 0 ? (
              <div className="text-center p-12 text-muted-foreground border-t border-border border-dashed m-4 rounded-lg bg-muted/10">
                <CalendarIcon className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
                No holidays declared yet. Add one from the panel.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {holidays.map((holiday) => {
                  const isActive = new Date() >= new Date(holiday.from_date) && new Date() <= new Date(holiday.to_date);
                  return (
                    <div key={holiday.id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <CalendarIcon className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-foreground text-lg">{holiday.name}</h3>
                            {isActive && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 uppercase tracking-wider">
                                Active Now
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5 flex items-center">
                            <span className="font-medium mr-2">{holiday.type}</span> •
                            <span className="ml-2 bg-muted px-2 rounded font-mono text-xs py-0.5">{holiday.from_date}</span> 
                            {holiday.from_date !== holiday.to_date && (
                              <>
                                <span className="mx-2 text-xs">to</span>
                                <span className="bg-muted px-2 rounded font-mono text-xs py-0.5">{holiday.to_date}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(holiday.id)}
                        className="p-2 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                        title="Delete Holiday"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
