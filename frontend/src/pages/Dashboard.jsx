import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { cajaAPI, stockAPI, clientesAPI, ventasAPI, estadisticasAPI } from "../api";
import { useAuth } from "../context/AuthContext";
import {
  TrendingUp, TrendingDown, AlertTriangle, Users, Package,
  DollarSign, ShoppingCart, Clock, ChevronRight,
} from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

const hoy = () => new Date().toISOString().slice(0, 10);

export default function Dashboard() {
  const { user } = useAuth();
  const [caja, setCaja] = useState(null);
  const [resumenCaja, setResumenCaja] = useState(null);
  const [alertasStock, setAlertasStock] = useState([]);
  const [deudores, setDeudores] = useState([]);
  const [resumenHoy, setResumenHoy] = useState(null);
  const [ventasRecientes, setVentasRecientes] = useState([]);
  const [vencimientosProximos, setVencimientosProximos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const [cajaR, alertasR, clientesR, resumenR] = await Promise.all([
        cajaAPI.actual(),
        stockAPI.alertas(),
        clientesAPI.listar({ con_deuda: true }),
        estadisticasAPI.resumen({ fecha_desde: hoy(), fecha_hasta: hoy() }),
      ]);

      setCaja(cajaR.data);
      setAlertasStock(alertasR.data);
      setDeudores((clientesR.data || []).slice(0, 5));
      setResumenHoy(resumenR.data);

      if (cajaR.data && !cajaR.data.cerrada) {
        const [resumenC, ventasR] = await Promise.all([
          cajaAPI.resumen(cajaR.data.id),
          ventasAPI.listar({ caja_id: cajaR.data.id }),
        ]);
        setResumenCaja(resumenC.data);
        setVentasRecientes((ventasR.data || []).filter((v) => !v.anulada).slice(0, 5));
      }

      // Productos próximos a vencer (30 días)
      const prodsR = await stockAPI.productos({ activo: true });
      const hoyDate = new Date();
      const limite = new Date(hoyDate);
      limite.setDate(limite.getDate() + 30);
      const proximos = (prodsR.data || [])
        .filter((p) => p.fecha_vencimiento && new Date(p.fecha_vencimiento) <= limite)
        .sort((a, b) => new Date(a.fecha_vencimiento) - new Date(b.fecha_vencimiento))
        .slice(0, 5);
      setVencimientosProximos(proximos);
    } finally {
      setLoading(false);
    }
  };

  const hora = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const fechaLarga = new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h2 className="page-title">Buen día, {user?.nombre?.split(" ")[0] || "admin"} 👋</h2>
          <p className="page-sub" style={{ textTransform: "capitalize" }}>{fechaLarga} · {hora}</p>
        </div>
        <Link to="/" className="btn btn-primary">
          <DollarSign size={16} /> Ir a Caja
        </Link>
      </div>

      {/* Estado de caja */}
      <div className="card mb-6" style={{ borderLeft: `4px solid ${caja && !caja.cerrada ? "var(--success)" : "var(--text3)"}` }}>
        <div className="flex justify-between items-center">
          <div>
            <div className="stat-label">Estado de caja</div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem", marginTop: 4 }}>
              {caja && !caja.cerrada ? (
                <span className="text-success">✓ Abierta</span>
              ) : (
                <span className="text-muted">Cerrada — sin abrir hoy</span>
              )}
            </div>
            {caja && !caja.cerrada && (
              <p className="text-muted" style={{ fontSize: "0.8rem", marginTop: 2 }}>
                Inicial: {fmt(caja.monto_inicial)} · Abierta: {new Date(caja.fecha_apertura).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            )}
          </div>
          {resumenCaja && (
            <div style={{ textAlign: "right" }}>
              <div className="stat-label">Total del día</div>
              <div className="stat-value money text-success" style={{ fontSize: "1.8rem" }}>{fmt(resumenCaja.ventas?.total)}</div>
              <div className="text-muted" style={{ fontSize: "0.8rem" }}>{resumenCaja.ventas?.cantidad || 0} ventas</div>
            </div>
          )}
        </div>
      </div>

      {/* KPIs del día */}
      {resumenHoy && (
        <div className="grid-4 mb-6">
          <div className="stat-card">
            <div className="stat-label">Facturado hoy</div>
            <div className="stat-value money text-success" style={{ fontSize: "1.5rem" }}>{fmt(resumenHoy.facturado)}</div>
            <div className="stat-sub">{resumenHoy.total_ventas} ventas</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Efectivo hoy</div>
            <div className="stat-value money" style={{ fontSize: "1.5rem" }}>{fmt(resumenHoy.por_metodo?.efectivo)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Comprado hoy</div>
            <div className="stat-value money text-warning" style={{ fontSize: "1.5rem" }}>{fmt(resumenHoy.total_compras)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Ganancia estimada</div>
            <div className="stat-value money" style={{ fontSize: "1.5rem", color: resumenHoy.ganancia_estimada >= 0 ? "var(--success)" : "var(--danger)" }}>
              {fmt(resumenHoy.ganancia_estimada)}
            </div>
          </div>
        </div>
      )}

      <div className="grid-2 mb-6">
        {/* Últimas ventas */}
        <div className="card">
          <div className="flex justify-between items-center mb-4">
            <h3 style={{ fontWeight: 700, fontSize: "0.95rem" }}>Últimas ventas</h3>
            <Link to="/" className="btn btn-ghost btn-sm" style={{ fontSize: "0.75rem" }}>Ver todas <ChevronRight size={12} /></Link>
          </div>
          {ventasRecientes.length === 0 ? (
            <p className="text-muted" style={{ fontSize: "0.875rem", padding: "16px 0" }}>Sin ventas hoy</p>
          ) : (
            <div>
              {ventasRecientes.map((v) => (
                <div key={v.id} className="flex justify-between items-center" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>
                      {v.detalle_libre || v.detalles?.map((d) => d.descripcion).join(", ") || "Venta"}
                    </div>
                    <div className="text-muted" style={{ fontSize: "0.75rem" }}>
                      {new Date(v.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                  <span className="money text-success" style={{ fontSize: "0.9rem", fontWeight: 700 }}>{fmt(v.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alertas */}
        <div className="card">
          <h3 style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 16 }}>Alertas activas</h3>

          {alertasStock.length === 0 && deudores.length === 0 && vencimientosProximos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--success)" }}>
              <span style={{ fontSize: "2rem" }}>✓</span>
              <p style={{ marginTop: 8, fontSize: "0.875rem" }}>Todo en orden</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {alertasStock.length > 0 && (
                <Link to="/stock" className="alert-item alert-warning">
                  <AlertTriangle size={14} />
                  <span><b>{alertasStock.length}</b> producto{alertasStock.length > 1 ? "s" : ""} con stock bajo</span>
                  <ChevronRight size={13} style={{ marginLeft: "auto" }} />
                </Link>
              )}
              {deudores.length > 0 && (
                <Link to="/clientes" className="alert-item alert-danger">
                  <Users size={14} />
                  <span><b>{deudores.length}</b> clientes con deuda</span>
                  <ChevronRight size={13} style={{ marginLeft: "auto" }} />
                </Link>
              )}
              {vencimientosProximos.length > 0 && (
                <Link to="/stock" className="alert-item alert-warning">
                  <Clock size={14} />
                  <span><b>{vencimientosProximos.length}</b> producto{vencimientosProximos.length > 1 ? "s" : ""} próximos a vencer</span>
                  <ChevronRight size={13} style={{ marginLeft: "auto" }} />
                </Link>
              )}

              {/* Deudores top */}
              {deudores.slice(0, 3).map((c) => (
                <div key={c.id} className="flex justify-between items-center" style={{ padding: "6px 0", fontSize: "0.85rem", borderBottom: "1px solid var(--border)" }}>
                  <span>{c.nombre}</span>
                  <span className="money text-danger">{fmt(c.deuda_total)}</span>
                </div>
              ))}

              {/* Vencimientos */}
              {vencimientosProximos.map((p) => {
                const dias = Math.ceil((new Date(p.fecha_vencimiento) - new Date()) / 86400000);
                return (
                  <div key={p.id} className="flex justify-between items-center" style={{ padding: "6px 0", fontSize: "0.85rem", borderBottom: "1px solid var(--border)" }}>
                    <span>{p.nombre}</span>
                    <span className="text-warning">{dias <= 0 ? "VENCIDO" : `${dias}d`}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Accesos rápidos */}
      <h3 style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text2)", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.05em" }}>Accesos rápidos</h3>
      <div className="grid-4">
        {[
          { to: "/", icon: <DollarSign size={22} />, label: "Caja del día", color: "var(--success)" },
          { to: "/stock", icon: <Package size={22} />, label: "Stock", color: "var(--primary)" },
          { to: "/clientes", icon: <Users size={22} />, label: "Clientes", color: "var(--info)" },
          { to: "/presupuestos", icon: <ShoppingCart size={22} />, label: "Presupuestos", color: "var(--warning)" },
        ].map((item) => (
          <Link key={item.to} to={item.to} className="card" style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", transition: "all 0.15s", textDecoration: "none" }}>
            <div style={{ width: 44, height: 44, borderRadius: "var(--radius-sm)", background: `${item.color}20`, display: "flex", alignItems: "center", justifyContent: "center", color: item.color }}>
              {item.icon}
            </div>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
