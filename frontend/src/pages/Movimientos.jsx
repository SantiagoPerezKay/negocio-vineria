import { useState, useEffect } from "react";
import { movimientosAPI } from "../api";
import { ArrowUpCircle, ArrowDownCircle, RefreshCw } from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

const TIPO_CONFIG = {
  venta:            { color: "var(--success)", icon: <ArrowUpCircle size={14} />, label: "Venta" },
  "venta (anulada)": { color: "var(--text3)",  icon: <ArrowUpCircle size={14} />, label: "Venta anulada" },
  gasto:            { color: "var(--danger)",  icon: <ArrowDownCircle size={14} />, label: "Gasto" },
  compra:           { color: "var(--warning)", icon: <ArrowDownCircle size={14} />, label: "Compra a proveedor" },
  pago_cliente:     { color: "var(--info)",    icon: <ArrowUpCircle size={14} />, label: "Cobro cliente" },
  apertura_caja:    { color: "var(--primary)", icon: <ArrowUpCircle size={14} />, label: "Apertura de caja" },
  cierre_caja:      { color: "var(--text1)",   icon: <ArrowDownCircle size={14} />, label: "Cierre de caja" },
};

const hoy = () => new Date().toISOString().slice(0, 10);

export default function Movimientos() {
  const [movimientos, setMovimientos] = useState([]);
  const [filtro, setFiltro] = useState("hoy"); // "hoy" | "rango"
  const [fechaDesde, setFechaDesde] = useState(hoy());
  const [fechaHasta, setFechaHasta] = useState(hoy());
  const [loading, setLoading] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtro === "hoy") {
        params.fecha = hoy();
      } else {
        if (fechaDesde) params.fecha_desde = fechaDesde;
        if (fechaHasta) params.fecha_hasta = fechaHasta + "T23:59:59";
      }
      const r = await movimientosAPI.listar(params);
      setMovimientos(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, [filtro, fechaDesde, fechaHasta]);

  const totalIngresos = movimientos
    .filter((m) => m.tipo === "venta" || m.tipo === "pago_cliente")
    .reduce((s, m) => s + m.monto, 0);
  const totalEgresos = movimientos
    .filter((m) => m.tipo === "gasto" || m.tipo === "compra")
    .reduce((s, m) => s + m.monto, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Movimientos</h2>
          <p className="page-sub">{movimientos.length} movimientos registrados</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={cargar} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-6" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="flex gap-2">
          <button
            className={`btn btn-sm ${filtro === "hoy" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFiltro("hoy")}
          >
            Hoy
          </button>
          <button
            className={`btn btn-sm ${filtro === "rango" ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFiltro("rango")}
          >
            Rango de fechas
          </button>
        </div>
        {filtro === "rango" && (
          <div className="flex gap-2" style={{ alignItems: "center" }}>
            <input
              type="date"
              className="form-input"
              style={{ width: 160, fontSize: "0.85rem" }}
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
            />
            <span className="text-muted" style={{ fontSize: "0.85rem" }}>a</span>
            <input
              type="date"
              className="form-input"
              style={{ width: 160, fontSize: "0.85rem" }}
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Resumen rápido */}
      <div className="grid-3 mb-6">
        <div className="stat-card card-sm">
          <div className="stat-label">Ingresos</div>
          <div className="stat-value money text-success" style={{ fontSize: "1.4rem" }}>{fmt(totalIngresos)}</div>
        </div>
        <div className="stat-card card-sm">
          <div className="stat-label">Egresos</div>
          <div className="stat-value money text-danger" style={{ fontSize: "1.4rem" }}>{fmt(totalEgresos)}</div>
        </div>
        <div className="stat-card card-sm">
          <div className="stat-label">Balance</div>
          <div className="stat-value money" style={{ fontSize: "1.4rem", color: totalIngresos - totalEgresos >= 0 ? "var(--success)" : "var(--danger)" }}>
            {fmt(totalIngresos - totalEgresos)}
          </div>
        </div>
      </div>

      {/* Tabla desktop */}
      <div className="table-wrap hide-mobile">
        <table>
          <thead>
            <tr><th>Fecha / Hora</th><th>Tipo</th><th>Descripcion</th><th>Metodo</th><th>Monto</th></tr>
          </thead>
          <tbody>
            {movimientos.length === 0 && (
              <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 32 }}>Sin movimientos en este periodo</td></tr>
            )}
            {movimientos.map((m, i) => {
              const cfg = TIPO_CONFIG[m.tipo] || TIPO_CONFIG.venta;
              const isIngreso = m.tipo === "venta" || m.tipo === "pago_cliente";
              return (
                <tr key={`${m.tipo}-${m.id}-${i}`} style={{ opacity: m.tipo === "venta (anulada)" ? 0.45 : 1 }}>
                  <td className="text-muted" style={{ whiteSpace: "nowrap" }}>
                    {m.fecha ? new Date(m.fecha).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                  </td>
                  <td>
                    <span className="badge" style={{ background: `${cfg.color}20`, color: cfg.color, display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </td>
                  <td style={{ maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.descripcion}</td>
                  <td className="text-muted">{m.metodo || "—"}</td>
                  <td className="money font-bold" style={{ color: isIngreso ? "var(--success)" : "var(--danger)" }}>
                    {isIngreso ? "+" : "-"}{fmt(m.monto)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mobile-cards show-mobile">
        {movimientos.length === 0 && <p className="text-center text-muted" style={{ padding: 32 }}>Sin movimientos</p>}
        {movimientos.map((m, i) => {
          const cfg = TIPO_CONFIG[m.tipo] || TIPO_CONFIG.venta;
          const isIngreso = m.tipo === "venta" || m.tipo === "pago_cliente";
          return (
            <div key={`${m.tipo}-${m.id}-${i}`} className="card card-sm mb-3" style={{ opacity: m.tipo === "venta (anulada)" ? 0.45 : 1 }}>
              <div className="flex justify-between items-center mb-1">
                <span className="badge" style={{ background: `${cfg.color}20`, color: cfg.color, display: "inline-flex", alignItems: "center", gap: 4 }}>
                  {cfg.icon} {cfg.label}
                </span>
                <span className="money font-bold" style={{ color: isIngreso ? "var(--success)" : "var(--danger)" }}>
                  {isIngreso ? "+" : "-"}{fmt(m.monto)}
                </span>
              </div>
              <p style={{ fontSize: "0.8rem", marginBottom: 2 }} className="text-muted">
                {m.descripcion}
              </p>
              <span className="text-muted" style={{ fontSize: "0.72rem" }}>
                {m.fecha ? new Date(m.fecha).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                {m.metodo ? ` · ${m.metodo}` : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
