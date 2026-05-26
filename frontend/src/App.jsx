import { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import {
  Package, Users, Truck, BarChart2, DollarSign, AlertTriangle,
  Sun, Moon, Menu, X, List, ShoppingCart, History, Home,
  Bell, LogOut, Settings, RotateCcw, FileText,
} from "lucide-react";

import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Caja from "./pages/Caja";
import Stock from "./pages/Stock";
import Clientes from "./pages/Clientes";
import Proveedores from "./pages/Proveedores";
import Estadisticas from "./pages/Estadisticas";
import Movimientos from "./pages/Movimientos";
import Presupuestos from "./pages/Presupuestos";
import HistorialVentas from "./pages/HistorialVentas";
import Facturas from "./pages/Facturas";
import "./index.css";

// ── Theme context ────────────────────────────────────────
const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);
  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Nav items ────────────────────────────────────────────
const navItems = [
  { to: "/dashboard",    icon: <Home />,        label: "Inicio",          end: true },
  { to: "/",             icon: <DollarSign />,  label: "Caja del día",    end: true },
  { to: "/historial",    icon: <History />,     label: "Historial ventas" },
  { to: "/presupuestos", icon: <ShoppingCart />,label: "Presupuestos"     },
  { to: "/facturas",     icon: <FileText />,    label: "Facturación"      },
  { to: "/stock",        icon: <Package />,     label: "Stock"            },
  { to: "/clientes",     icon: <Users />,       label: "Clientes / Fiado" },
  { to: "/proveedores",  icon: <Truck />,       label: "Proveedores"      },
  { to: "/movimientos",  icon: <List />,        label: "Movimientos"      },
  { to: "/estadisticas", icon: <BarChart2 />,   label: "Estadísticas"     },
];

// ── Sidebar ──────────────────────────────────────────────
function Sidebar({ open, onClose, alertCount }) {
  const { theme, toggle } = useTheme();
  const { user, logout, isAdmin } = useAuth();

  return (
    <>
      {open && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="flex items-center justify-between">
            <h1>Vinería</h1>
            <button className="sidebar-close-btn show-mobile" onClick={onClose}><X size={20} /></button>
          </div>
          <span>Sistema de gestión</span>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              onClick={onClose}
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {alertCount > 0 && (
            <NavLink to="/dashboard" className="alert-badge" onClick={onClose}>
              <Bell size={14} />
              <span>{alertCount} alerta{alertCount > 1 ? "s" : ""} activa{alertCount > 1 ? "s" : ""}</span>
            </NavLink>
          )}

          <div style={{ padding: "8px 12px", background: "var(--bg3)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text)" }}>{user?.nombre}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text3)", textTransform: "capitalize" }}>{user?.rol}</div>
          </div>

          <button className="theme-toggle" onClick={toggle}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === "dark" ? "Modo claro" : "Modo oscuro"}</span>
          </button>

          <button className="theme-toggle" onClick={logout} style={{ color: "var(--danger)", borderColor: "var(--danger)" }}>
            <LogOut size={16} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}

// ── Mobile Header ────────────────────────────────────────
function MobileHeader({ onMenuClick, alertCount }) {
  const { theme, toggle } = useTheme();
  return (
    <header className="mobile-header show-mobile">
      <button className="mobile-menu-btn" onClick={onMenuClick}><Menu size={22} /></button>
      <h1 className="mobile-header-title">Vinería</h1>
      <div className="flex gap-2">
        {alertCount > 0 && (
          <span style={{ background: "var(--danger)", color: "#fff", borderRadius: "999px", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700 }}>
            {alertCount}
          </span>
        )}
        <button className="theme-toggle-mini" onClick={toggle}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}

// ── App shell ─────────────────────────────────────────────
function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const { user } = useAuth();

  useEffect(() => {
    import("./api/index.js").then((mod) => {
      const { stockAPI, clientesAPI } = mod;
      Promise.all([stockAPI.alertas(), clientesAPI.listar({ con_deuda: true })]).then(([al, cl]) => {
        setAlertCount((al.data?.length || 0) + (cl.data?.length || 0));
      }).catch(() => {});
    });
  }, []);

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} alertCount={alertCount} />
      <MobileHeader onMenuClick={() => setSidebarOpen(true)} alertCount={alertCount} />
      <main className="main-content">
        <Routes>
          <Route path="/dashboard"    element={<Dashboard />}      />
          <Route path="/"             element={<Caja />}           />
          <Route path="/historial"    element={<HistorialVentas />} />
          <Route path="/presupuestos" element={<Presupuestos />}   />
          <Route path="/facturas"     element={<Facturas />}      />
          <Route path="/stock"        element={<Stock />}          />
          <Route path="/clientes"     element={<Clientes />}       />
          <Route path="/proveedores"  element={<Proveedores />}    />
          <Route path="/movimientos"  element={<Movimientos />}    />
          <Route path="/estadisticas" element={<Estadisticas />}   />
          <Route path="*"             element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────
function RootRouter() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="spin" style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%" }} />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="*" element={user ? <AppContent /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <RootRouter />
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}
