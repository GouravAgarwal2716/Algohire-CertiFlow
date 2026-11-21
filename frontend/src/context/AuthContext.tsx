import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  users: User[];
  switchPersona: (userId: string) => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  users: [],
  switchPersona: async () => {},
  loading: true,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('certiflow_token'));
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const userList = await api.getUsers();
        setUsers(userList);

        // Check if there is already a saved user
        const savedUserId = localStorage.getItem('certiflow_user_id');
        const defaultUser = userList.find((u) => u.id === savedUserId) || userList[0];

        if (defaultUser) {
          const loginData = await api.demoLogin(defaultUser.id);
          setUser(loginData.user);
          setToken(loginData.token);
          localStorage.setItem('certiflow_token', loginData.token);
          localStorage.setItem('certiflow_user_id', loginData.user.id);
        }
      } catch (err) {
        console.error('Failed to initialize demo auth:', err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const switchPersona = async (userId: string) => {
    try {
      setLoading(true);
      const loginData = await api.demoLogin(userId);
      setUser(loginData.user);
      setToken(loginData.token);
      localStorage.setItem('certiflow_token', loginData.token);
      localStorage.setItem('certiflow_user_id', loginData.user.id);
    } catch (err) {
      console.error('Failed to switch persona:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, users, switchPersona, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
