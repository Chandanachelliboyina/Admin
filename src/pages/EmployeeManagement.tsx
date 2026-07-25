import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { API_BASE_URL } from '../config';

type Employee = {
  id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  location: string;
  photo: string;
  has_access?: boolean;
};

export function EmployeeManagement() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState<Partial<Employee>>({});

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Partial<Employee>>({});

  const fetchEmployees = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees`, {
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) throw new Error('Failed to fetch employees');
      
      const data = await response.json();
      
      // Map backend model to frontend model
      const mappedEmployees: Employee[] = data.map((emp: any) => ({
        id: emp.id,
        name: emp.name || 'Unknown',
        role: emp.position || 'N/A',
        department: emp.department || 'Operations', // Fallback if missing
        phone: emp.mobileNumber || 'N/A',
        location: emp.address || 'N/A',
        photo: emp.photo || emp.profile_picture || `https://i.pravatar.cc/150?u=${emp.id}`,
      }));
      
      setEmployees(mappedEmployees);
    } catch (err: any) {
      console.error(err);
      if (err?.name === 'TimeoutError') {
        setError('Request timed out. The database is taking too long to respond. Please try again.');
      } else {
        setError(`Failed to load employees from database. Error: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleDelete = async (id: string) => {
    if (window.confirm(`Are you sure you want to remove employee ${id}?`)) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/employees/${id}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error('Failed to delete employee');
        fetchEmployees();
      } catch (err) {
        console.error(err);
        alert('Failed to delete employee');
      }
    }
  };

  const handleToggleAccess = async (empId: string, currentAccess: boolean) => {
    const actionText = currentAccess ? "remove access for" : "grant access to";
    if (!window.confirm(`Are you sure you want to ${actionText} this employee?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/${empId}/access`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ has_access: !currentAccess })
      });
      if (response.ok) {
        setEmployees(employees.map(emp => emp.id === empId ? { ...emp, has_access: !currentAccess } : emp));
      } else {
        alert('Failed to update employee access');
      }
    } catch (err) {
      console.error(err);
      alert('Error updating employee access');
    }
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = `EMP${Math.floor(1000 + Math.random() * 9000)}`;
    
    const payload = {
      id,
      name: newEmployee.name || '',
      position: newEmployee.role || '',
      department: newEmployee.department || '',
      email: '',
      mobileNumber: newEmployee.phone || '',
      gender: '',
      dateOfBirth: '',
      joiningDate: new Date().toISOString().split('T')[0],
      address: newEmployee.location || '',
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to add employee');
      
      setIsAddModalOpen(false);
      setNewEmployee({});
      fetchEmployees();
    } catch (err) {
      console.error(err);
      alert('Failed to add employee');
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee.id) return;

    const payload = {
      id: editingEmployee.id,
      name: editingEmployee.name || 'Unknown',
      position: editingEmployee.role || 'N/A',
      department: editingEmployee.department || 'N/A',
      email: 'N/A',
      mobileNumber: editingEmployee.phone || 'N/A',
      gender: 'N/A',
      dateOfBirth: 'N/A',
      joiningDate: 'N/A',
      address: editingEmployee.location || 'N/A',
    };

    try {
      const response = await fetch(`${API_BASE_URL}/api/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Failed to update employee');
      
      setIsEditModalOpen(false);
      setEditingEmployee({});
      fetchEmployees();
    } catch (err) {
      console.error(err);
      alert('Failed to update employee');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Employee Management</h1>
          <p className="text-muted-foreground mt-1">Manage your team members and their details.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center space-x-2 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      <div className="bg-card rounded-lg border border-border overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search employees..."
              className="w-full pl-9 pr-4 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
              <tr>
                <th className="px-6 py-3">Employee ID</th>
                <th className="px-6 py-3">Profile</th>
                <th className="px-6 py-3">Role & Dept</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Location</th>
                <th className="px-6 py-3 text-right">Access Control</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span>Loading employees from MongoDB...</span>
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-red-500 font-medium bg-red-50/50">
                    {error}
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">
                    No employees found. Add an employee to get started.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium bg-primary/10 text-primary">
                        {emp.id}
                      </span>
                    </td>
                    <td className="px-6 py-4 flex items-center space-x-3">
                      <img src={emp.photo} alt={emp.name} className="w-10 h-10 rounded-full border border-border object-cover" />
                      <div className="font-medium text-foreground">{emp.name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-foreground">{emp.role}</div>
                      <div className="text-muted-foreground text-xs">{emp.department}</div>
                    </td>
                    <td className="px-6 py-4 text-foreground">{emp.phone}</td>
                    <td className="px-6 py-4 text-foreground">{emp.location}</td>
                    <td className="px-6 py-4 text-right space-x-2">

                      <button 
                        onClick={() => handleToggleAccess(emp.id, emp.has_access !== false)}
                        className={`${emp.has_access !== false ? 'text-amber-600 hover:bg-amber-50 hover:border-amber-200' : 'text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200'} px-3 py-1.5 rounded-md transition-colors text-sm font-medium border border-transparent`} 
                        title={emp.has_access !== false ? "Remove Access" : "Grant Access"}
                      >
                        {emp.has_access !== false ? "Remove Access" : "Grant Access"}
                      </button>
                      <button 
                        onClick={() => handleDelete(emp.id)}
                        className="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors text-sm font-medium border border-red-200 bg-red-50/50" 
                        title="Delete Employee"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-lg border border-border overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h3 className="font-semibold text-lg">Add New Employee</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={newEmployee.name || ''} 
                  onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Jane Doe"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Role</label>
                  <input 
                    type="text" 
                    required
                    value={newEmployee.role || ''} 
                    onChange={(e) => setNewEmployee({...newEmployee, role: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Developer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Department</label>
                  <input 
                    type="text" 
                    required
                    value={newEmployee.department || ''} 
                    onChange={(e) => setNewEmployee({...newEmployee, department: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Engineering"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Phone</label>
                  <input 
                    type="text" 
                    value={newEmployee.phone || ''} 
                    onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="+1 555-0000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Location</label>
                  <input 
                    type="text" 
                    value={newEmployee.location || ''} 
                    onChange={(e) => setNewEmployee({...newEmployee, location: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="HQ"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-2">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-md border border-input hover:bg-muted transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Employee Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-xl shadow-lg border border-border overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-border">
              <h3 className="font-semibold text-lg">Edit Employee</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={editingEmployee.name || ''} 
                  onChange={(e) => setEditingEmployee({...editingEmployee, name: e.target.value})}
                  className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Jane Doe"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Role</label>
                  <input 
                    type="text" 
                    required
                    value={editingEmployee.role || ''} 
                    onChange={(e) => setEditingEmployee({...editingEmployee, role: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Developer"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Department</label>
                  <input 
                    type="text" 
                    required
                    value={editingEmployee.department || ''} 
                    onChange={(e) => setEditingEmployee({...editingEmployee, department: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Engineering"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Phone</label>
                  <input 
                    type="text" 
                    value={editingEmployee.phone || ''} 
                    onChange={(e) => setEditingEmployee({...editingEmployee, phone: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="+1 555-0000"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Location</label>
                  <input 
                    type="text" 
                    value={editingEmployee.location || ''} 
                    onChange={(e) => setEditingEmployee({...editingEmployee, location: e.target.value})}
                    className="w-full px-3 py-2 bg-background border border-input rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="HQ"
                  />
                </div>
              </div>
              <div className="pt-4 flex justify-end space-x-2">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-4 py-2 rounded-md border border-input hover:bg-muted transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                >
                  Update Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
