import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { API_BASE_URL } from '../config';

interface AuthContextType {
  isAuthenticated: boolean;
  currentUserEmail: string | null;
  login: (email: string, password: string) => Promise<{success: boolean, message?: string}>;
  logout: () => void;
  register: (email: string, password: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Load auth state from localStorage on mount and verify access
  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated') === 'true';
    const email = localStorage.getItem('currentUserEmail');
    
    setIsAuthenticated(authStatus);
    if (email) setCurrentUserEmail(email);

    if (authStatus && email && email !== 'admin@example.com') {
      // Verify access with backend (no-cache to ensure fresh status)
      fetch(`${API_BASE_URL}/api/employees`, { cache: 'no-store' })
        .then(res => res.json())
        .then(employees => {
          const emp = employees.find((e: any) => e.email === email || e.id === email);
          if (emp && emp.has_access === false) {
            // Revoke access immediately if they are currently logged in
            setIsAuthenticated(false);
            setCurrentUserEmail(null);
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('currentUserEmail');
            // Force reload to kick them out properly
            window.location.href = '/signin';
          }
        })
        .catch(console.error);
    }
  }, []);

  const register = (email: string, password: string) => {
    // Store registered user and password in mock database (localStorage)
    localStorage.setItem('registeredUser', JSON.stringify({ email, password }));
  };

  const login = async (email: string, password: string): Promise<{success: boolean, message?: string}> => {
    const storedData = localStorage.getItem('registeredUser');
    
    // Default admin fallback for testing without registering first
    if (email === 'admin@example.com' && password === 'admin123') {
      setIsAuthenticated(true);
      setCurrentUserEmail(email);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('currentUserEmail', email);
      return { success: true };
    }

    // Check if it's an employee in the backend
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees`, { cache: 'no-store' });
      if (response.ok) {
        const employees = await response.json();
        const emp = employees.find((e: any) => e.email === email || e.id === email);
        if (emp) {
          if (emp.has_access === false) {
            return { success: false, message: "Admin has not granted access to your account." };
          }
          // Accept any password for mock employee login
          setIsAuthenticated(true);
          setCurrentUserEmail(email);
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('currentUserEmail', email);
          return { success: true };
        }
      }
    } catch (e) {
      console.error(e);
    }

    if (storedData) {
      const { email: storedEmail, password: storedPassword } = JSON.parse(storedData);
      if (storedEmail === email && storedPassword === password) {
        setIsAuthenticated(true);
        setCurrentUserEmail(email);
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('currentUserEmail', email);
        return { success: true };
      }
    }
    return { success: false, message: "Invalid email or password. Please try again or create an account." };
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUserEmail(null);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('currentUserEmail');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUserEmail, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
