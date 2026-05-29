import { useState, useEffect } from "react";
import { estadisticasAPI } from "../api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { TrendingUp, Banknote, CreditCard, ArrowRightLeft, Loader, AlertCircle } from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

const fmtShort = (n) => {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n}`;
};

const METODO_COLORS = {
  efectivo: "#22c55e",
  transferencia: "#38bdf8",
  tarjeta: "#818cf8",
  fiado: "#ef4444",
};

const METODO_LABELS = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  tarjeta: "Tarjeta",
  fiado: "Fiado",
};

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

const now = new Date();

/* Custom tooltip */
function ChartTooltip({ active, payload, label, isVertical }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-label">{isVertical ? payload[0]?.payload?.nombre : `Día ${label?.toString().slice(-2) || label}`}</div>
      {payload.map((p, i) => (
        <div key={i} className="chart-tooltip-row">
          <span className="chart-tooltip-dot" style={{ background: p.color || p.fill }} />
          <span className="chart-tooltip-name">{p.name === "total" ? "Ventas" : p.name === "total_vendido" ? "Facturado" : p.name}</span>
          <span className="chart-tooltip-value">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-row">
        <span className="chart-tooltip-dot" style={{ background: d.payload.fill }} />
        <span className="chart-tooltip-name">{METODO_LABELS[d.name] || d.name}</span>
        <span className="chart-tooltip-value">{fmt(d.value)}</span>
      </div>
    </div>
  );
}

export default function Estadisticas() {
  const [resumen, setResumen] = useState(null);
  const [ventasDia, setVentasDia] = useState([]);
  const [topProductos, setTopProductos] = useState([]);
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      estadisticasAPI.resumen(),
      estadisticasAPI.ventasPorDia({ anio, mes }),
      estadisticasAPI.productosMasVendidos({ limit: 8 }),
    ]).then(([r, v, p]) => {
      setResumen(r.data);
      setVentasDia(v.data);
      setTopProductos(p.data);
    }).finally(() => setLoading(false));
  }, [anio, mes]);

  const pieData = resumen
    ? Object.entries(resumen.por_metodo)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: k, value: v, fill: METODO_COLORS[k] || "#6366f1" }))
    : [];

  const totalMetodos = pieData.reduce((s, d) => s + d.value, 0);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Loader size={28} className="spin text-muted" />
      </div>
    );
  }

  return (
    <div className="stats-page">
      <div className="page-header">
        <div>
          <h2 className="page-title">Estadísticas</h2>
          <p className="page-sub">Resumen de ventas y rendimiento</p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <select className="form-select" style={{ width: 100 }} value={anio} onChange={(e) => setAnio(parseInt(e.target.value))}>
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="form-select" style={{ width: 140 }} value={mes} onChange={(e) => setMes(parseInt(e.target.value))}>
            {MESES.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* KPI cards */}
      {resumen && (
        <div className="stats-kpi-row">
          <div className="stats-kpi stats-kpi-main">
            <div className="stats-kpi-icon" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <span className="stats-kpi-label">Total vendido</span>
              <span className="stats-kpi-value text-success">{fmt(resumen.facturado)}</span>
              <span className="stats-kpi-sub">{resumen.total_ventas} ventas</span>
            </div>
          </div>
          <div className="stats-kpi">
            <div className="stats-kpi-icon" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
              <Banknote size={20} />
            </div>
            <div>
              <span className="stats-kpi-label">Efectivo</span>
              <span className="stats-kpi-value">{fmt(resumen.por_metodo?.efectivo)}</span>
            </div>
          </div>
          <div className="stats-kpi">
            <div className="stats-kpi-icon" style={{ background: "var(--info-bg)", color: "var(--info)" }}>
              <ArrowRightLeft size={20} />
            </div>
            <div>
              <span className="stats-kpi-label">Transferencia</span>
              <span className="stats-kpi-value">{fmt(resumen.por_metodo?.transferencia)}</span>
            </div>
          </div>
          <div className="stats-kpi">
            <div className="stats-kpi-icon" style={{ background: "var(--primary-glow)", color: "var(--primary)" }}>
              <CreditCard size={20} />
            </div>
            <div>
              <span className="stats-kpi-label">Tarjeta</span>
              <span className="stats-kpi-value">{fmt(resumen.por_metodo?.tarjeta)}</span>
            </div>
          </div>
          {resumen.deuda_clientes_total > 0 && (
            <div className="stats-kpi">
              <div className="stats-kpi-icon" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
                <AlertCircle size={20} />
              </div>
              <div>
                <span className="stats-kpi-label">Deuda clientes</span>
                <span className="stats-kpi-value text-danger">{fmt(resumen.deuda_clientes_total)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts row */}
      <div className="stats-charts-row">
        {/* Area chart - ventas por día */}
        <div className="stats-chart-card stats-chart-wide">
          <div className="stats-chart-header">
            <h3>Ventas diarias</h3>
            <span className="stats-chart-period">{MESES[mes - 1]} {anio}</span>
          </div>
          {ventasDia.length === 0 ? (
            <div className="stats-chart-empty">Sin datos para este período</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={ventasDia} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fill: "var(--text3)", fontSize: 11 }}
                  tickFormatter={(d) => d.slice(8)}
                  axisLine={{ stroke: "var(--border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: "var(--text3)", fontSize: 11 }}
                  tickFormatter={fmtShort}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--primary)", strokeWidth: 1, strokeDasharray: "4 4" }} />
                <Area
                  type="monotone" dataKey="total" name="total"
                  stroke="var(--primary)" strokeWidth={2.5}
                  fill="url(#gradVentas)"
                  dot={{ r: 3, fill: "var(--primary)", strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: "var(--primary)", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie chart - métodos */}
        <div className="stats-chart-card">
          <div className="stats-chart-header">
            <h3>Métodos de pago</h3>
          </div>
          {pieData.length === 0 ? (
            <div className="stats-chart-empty">Sin datos</div>
          ) : (
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData} dataKey="value" nameKey="name"
                    cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                    paddingAngle={3} strokeWidth={0}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="stats-pie-legend">
                {pieData.map((d) => (
                  <div key={d.name} className="stats-pie-legend-item">
                    <span className="stats-pie-dot" style={{ background: d.fill }} />
                    <span className="stats-pie-name">{METODO_LABELS[d.name] || d.name}</span>
                    <span className="stats-pie-pct">{totalMetodos > 0 ? ((d.value / totalMetodos) * 100).toFixed(0) : 0}%</span>
                    <span className="stats-pie-val">{fmt(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top productos */}
      <div className="stats-chart-card">
        <div className="stats-chart-header">
          <h3>Productos más vendidos</h3>
        </div>
        {topProductos.length === 0 ? (
          <div className="stats-chart-empty">Sin datos</div>
        ) : (
          <div className="stats-top-list">
            {topProductos.map((p, i) => {
              const maxVal = topProductos[0]?.total_vendido || 1;
              const pct = (p.total_vendido / maxVal) * 100;
              return (
                <div key={i} className="stats-top-item">
                  <div className="stats-top-rank">#{i + 1}</div>
                  <div className="stats-top-info">
                    <div className="stats-top-name">{p.nombre}</div>
                    <div className="stats-top-bar-wrap">
                      <div className="stats-top-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="stats-top-values">
                    <span className="stats-top-amount">{fmt(p.total_vendido)}</span>
                    <span className="stats-top-qty">{p.cantidad_vendida} uds</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Balance summary */}
      {resumen && (
        <div className="stats-balance">
          <div className="stats-balance-item">
            <span>Total compras</span>
            <span className="money text-warning">{fmt(resumen.total_compras)}</span>
          </div>
          <div className="stats-balance-item">
            <span>Ganancia estimada</span>
            <span className="money" style={{ color: resumen.ganancia_estimada >= 0 ? "var(--success)" : "var(--danger)" }}>
              {fmt(resumen.ganancia_estimada)}
            </span>
          </div>
          {resumen.deuda_proveedores_total > 0 && (
            <div className="stats-balance-item">
              <span>Deuda proveedores</span>
              <span className="money text-warning">{fmt(resumen.deuda_proveedores_total)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
