import { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) { setLoading(false); return; }
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    try {
      const r = await api.get("/auth/me");
      setUser(r.data);
    } catch {
      localStorage.removeItem("token");
      delete api.defaults.headers.common["Authorization"];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, []);

  const login = async (username, password) => {
    const formData = new FormData();
    formData.append("username", username);
    formData.append("password", password);
    const r = await api.post("/auth/login", formData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const { access_token, user: userData } = r.data;
    localStorage.setItem("token", access_token);
    api.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem("token");
    delete api.defaults.headers.common["Authorization"];
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin: user?.rol === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
