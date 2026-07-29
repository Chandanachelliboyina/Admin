import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { API_BASE_URL } from '../config';

export const ALLOWED_ADMIN_EMAILS = [
  'chanduchelliboyina3@gmail.com',
  'bbmmwdo.org@gmail.com',
  'bbmmwdo.bmm@gmail.com'
];

interface AuthContextType {
  isAuthenticated: boolean;
  currentUserEmail: string | null;
  login: (email: string, password: string) => Promise<{success: boolean, message?: string}>;
  logout: () => void;
  register: (email: string, password: string) => void;
  updateAdminPassword: (email: string, newPassword: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Load auth state from localStorage on mount and verify access
  useEffect(() => {
    const authStatus = localStorage.getItem('isAuthenticated') === 'true';
    const email = localStorage.getItem('currentUserEmail');
    
    if (authStatus && email) {
      const cleanEmail = email.toLowerCase().trim();
      if (!ALLOWED_ADMIN_EMAILS.includes(cleanEmail)) {
        // Immediately revoke access if logged in email is not an authorized admin
        setIsAuthenticated(false);
        setCurrentUserEmail(null);
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('currentUserEmail');
        window.location.href = '/signin';
        return;
      }

      setIsAuthenticated(true);
      setCurrentUserEmail(email);

      // Verify access with backend (no-cache to ensure fresh status)
      fetch(`${API_BASE_URL}/api/employees`, { cache: 'no-store' })
        .then(res => res.json())
        .then(employees => {
          const emp = employees.find((e: any) => e.email?.toLowerCase() === cleanEmail || e.id?.toLowerCase() === cleanEmail);
          if (emp && emp.has_access === false) {
            setIsAuthenticated(false);
            setCurrentUserEmail(null);
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('currentUserEmail');
            window.location.href = '/signin';
          }
        })
        .catch(console.error);
    }
  }, []);

  const register = (email: string, password: string) => {
    const cleanEmail = email.toLowerCase().trim();
    if (!ALLOWED_ADMIN_EMAILS.includes(cleanEmail)) return;

    localStorage.setItem('registeredUser', JSON.stringify({ email: cleanEmail, password }));
    const rawAdmins = localStorage.getItem('adminAccounts');
    const admins = rawAdmins ? JSON.parse(rawAdmins) : {};
    admins[cleanEmail] = password;
    localStorage.setItem('adminAccounts', JSON.stringify(admins));
  };

  const updateAdminPassword = (email: string, newPassword: string) => {
    const cleanEmail = email.toLowerCase().trim();
    if (!ALLOWED_ADMIN_EMAILS.includes(cleanEmail)) return;

    const rawAdmins = localStorage.getItem('adminAccounts');
    const admins = rawAdmins ? JSON.parse(rawAdmins) : {};
    admins[cleanEmail] = newPassword;
    localStorage.setItem('adminAccounts', JSON.stringify(admins));

    // Also update registeredUser if email matches
    const storedData = localStorage.getItem('registeredUser');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        if (parsed.email && parsed.email.toLowerCase().trim() === cleanEmail) {
          localStorage.setItem('registeredUser', JSON.stringify({ email: parsed.email, password: newPassword }));
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const login = async (email: string, password: string): Promise<{success: boolean, message?: string}> => {
    const cleanEmail = email.toLowerCase().trim();

    // STRICT CHECK: Only hardcoded admin emails can access the Admin Dashboard
    if (!ALLOWED_ADMIN_EMAILS.includes(cleanEmail)) {
      return {
        success: false,
        message: "Unauthorized: Only authorized admin email addresses (chanduchelliboyina3@gmail.com, bbmmwdo.org@gmail.com) can access the Admin Dashboard."
      };
    }

    const rawAdmins = localStorage.getItem('adminAccounts');
    const admins = rawAdmins ? JSON.parse(rawAdmins) : {};

    // 1. Check if password matches in adminAccounts map (updated after reset)
    if (admins[cleanEmail] && admins[cleanEmail] === password) {
      setIsAuthenticated(true);
      setCurrentUserEmail(email);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('currentUserEmail', email);
      return { success: true };
    }

    // 2. Default password check for authorized admin emails
    if (password === 'admin123') {
      setIsAuthenticated(true);
      setCurrentUserEmail(email);
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('currentUserEmail', email);
      return { success: true };
    }

    // 3. Check registeredUser
    const storedData = localStorage.getItem('registeredUser');
    if (storedData) {
      try {
        const { email: storedEmail, password: storedPassword } = JSON.parse(storedData);
        if (storedEmail.toLowerCase().trim() === cleanEmail && storedPassword === password) {
          setIsAuthenticated(true);
          setCurrentUserEmail(email);
          localStorage.setItem('isAuthenticated', 'true');
          localStorage.setItem('currentUserEmail', email);
          return { success: true };
        }
      } catch (e) {
        console.error(e);
      }
    }

    // 4. Check employee in backend
    try {
      const response = await fetch(`${API_BASE_URL}/api/employees`, { cache: 'no-store' });
      if (response.ok) {
        const employees = await response.json();
        const emp = employees.find((e: any) => e.email?.toLowerCase().trim() === cleanEmail);
        if (emp) {
          if (emp.has_access === false) {
            return { success: false, message: "Admin has not granted access to your account." };
          }
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

    return { success: false, message: "Invalid email or password. Please try again." };
  };

  const logout = () => {
    setIsAuthenticated(false);
    setCurrentUserEmail(null);
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('currentUserEmail');
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, currentUserEmail, login, logout, register, updateAdminPassword }}>
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
