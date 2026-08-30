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

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('pulsebug_token'));
  const [loading, setLoading] = useState<boolean>(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProjectState] = useState<Project | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  const refreshProjects = async () => {
    try {
      const projs = await api.getProjects();
      setProjects(projs);
      if (projs.length > 0 && !currentProject) {
        // Default to first project (PAY)
        setCurrentProjectState(projs[0]);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    }
  };

  const refreshUser = async () => {
    try {
      const u = await api.getMe();
      setUser(u);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const uList = await api.getUsers();
      setAllUsers(uList);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      try {
        if (!token) {
          // Auto-login as default Developer for instant academic demo readiness
          const res = await api.login('rahul@pulsebug.io', 'password123');
          localStorage.setItem('pulsebug_token', res.access_token);
          setToken(res.access_token);
          setUser(res.user);
        } else {
          const u = await api.getMe();
          setUser(u);
        }
        await refreshProjects();
        await fetchUsers();
      } catch (err) {
        console.error('Auth initialization error, falling back to demo login:', err);
        try {
          const res = await api.login('pm@pulsebug.io', 'password123');
          localStorage.setItem('pulsebug_token', res.access_token);
          setToken(res.access_token);
          setUser(res.user);
          await refreshProjects();
          await fetchUsers();
        } catch {
          // ignore
        }
      } finally {
        setLoading(false);
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
    setToken(null);
    setUser(null);
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
