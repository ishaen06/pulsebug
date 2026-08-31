import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Project } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  projects: Project[];
  currentProject: Project | null;
  allUsers: User[];
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  switchUser: (email: string) => Promise<void>;
  setCurrentProject: (proj: Project | null) => void;
  refreshProjects: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_DEMO_USER: User = {
  id: 1,
  email: 'rahul@pulsebug.io',
  full_name: 'Rahul Sharma',
  role: 'DEVELOPER',
  skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'FastAPI'],
  avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  active_status: 'AVAILABLE',
  is_verified: true,
  created_at: new Date().toISOString()
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>(DEFAULT_DEMO_USER);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pulsebug_token') || 'pulsebug-demo-token');
  const [loading, setLoading] = useState<boolean>(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([DEFAULT_DEMO_USER]);

  const refreshProjects = async () => {
    try {
      const projs = await api.getProjects();
      setProjects(projs);
      if (projs.length > 0 && !currentProject) {
        setCurrentProjectState(projs[0]);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const refreshUser = async () => {
    try {
      const u = await api.getMe();
      if (u) setUser(u);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const uList = await api.getUsers();
      if (uList && uList.length > 0) setAllUsers(uList);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const res = await api.login('rahul@pulsebug.io', 'password123');
        if (res && res.access_token) {
          localStorage.setItem('pulsebug_token', res.access_token);
          setToken(res.access_token);
          if (res.user) setUser(res.user);
        }
      } catch (err) {
        console.error('Auto-login initialization fallback:', err);
      } finally {
        await refreshProjects();
        await fetchUsers();
      }
    };

    initAuth();
  }, []);

  const login = async (email: string, password: string = 'password123') => {
    setLoading(true);
    try {
      const res = await api.login(email, password);
      localStorage.setItem('pulsebug_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
      await refreshProjects();
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('pulsebug_token');
    setToken('pulsebug-demo-token');
    setUser(DEFAULT_DEMO_USER);
  };

  const switchUser = async (email: string) => {
    try {
      const res = await api.switchDemoUser(email);
      localStorage.setItem('pulsebug_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
    } catch (err) {
      console.error('Failed to switch user:', err);
    }
  };

  const setCurrentProject = (proj: Project | null) => {
    setCurrentProjectState(proj);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        projects,
        currentProject,
        allUsers,
        login,
        logout,
        switchUser,
        setCurrentProject,
        refreshProjects,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
