import { useState, useEffect } from "react";
import { estadisticasAPI } from "../api";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

const COLORS = ["#6366f1", "#22c55e", "#38bdf8", "#f59e0b", "#ef4444"];
const METODO_COLORS = {
  efectivo: "#22c55e",
  transferencia: "#38bdf8",
  tarjeta: "#6366f1",
  seña: "#f59e0b",
  fiado: "#ef4444",
};

const now = new Date();

export default function Estadisticas() {
  const [resumen, setResumen] = useState(null);
  const [ventasDia, setVentasDia] = useState([]);
  const [topProductos, setTopProductos] = useState([]);
  const [anio, setAnio] = useState(now.getFullYear());
  const [mes, setMes] = useState(now.getMonth() + 1);

  useEffect(() => {
    Promise.all([
      estadisticasAPI.resumen(),
      estadisticasAPI.ventasPorDia({ anio, mes }),
      estadisticasAPI.productosMasVendidos({ limit: 8 }),
    ]).then(([r, v, p]) => {
      setResumen(r.data);
      setVentasDia(v.data);
      setTopProductos(p.data);
    });
  }, [anio, mes]);

  const pieData = resumen
    ? Object.entries(resumen.por_metodo)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: k, value: v }))
    : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Estadísticas</h2>
          <p className="page-sub">Resumen de ventas y rendimiento del negocio</p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <select className="form-select" style={{ width: 100, minWidth: 0 }} value={anio} onChange={(e) => setAnio(parseInt(e.target.value))}>
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select className="form-select" style={{ width: 130, minWidth: 0 }} value={mes} onChange={(e) => setMes(parseInt(e.target.value))}>
            {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
              .map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Balance general */}
      {resumen && (
        <div className="card mb-6" style={{ borderLeft: "4px solid var(--primary)", padding: "20px 24px" }}>
          <h3 style={{ fontWeight: 700, fontSize: "1rem", marginBottom: 16 }}>Balance general</h3>
          <div className="grid-4">
            <div className="stat-card card-sm">
              <div className="stat-label">Total vendido</div>
              <div className="stat-value money text-success" style={{ fontSize: "1.4rem" }}>{fmt(resumen.facturado)}</div>
              <div className="stat-sub">{resumen.total_ventas} ventas</div>
            </div>
            <div className="stat-card card-sm">
              <div className="stat-label">Total comprado</div>
              <div className="stat-value money text-warning" style={{ fontSize: "1.4rem" }}>{fmt(resumen.total_compras)}</div>
            </div>
            <div className="stat-card card-sm">
              <div className="stat-label">Ganancia estimada</div>
              <div className="stat-value money" style={{ fontSize: "1.4rem", color: resumen.ganancia_estimada >= 0 ? "var(--success)" : "var(--danger)" }}>
                {fmt(resumen.ganancia_estimada)}
              </div>
              <div className="stat-sub">Vendido - Comprado</div>
            </div>
            <div className="stat-card card-sm">
              <div className="stat-label">Deuda proveedores</div>
              <div className="stat-value money text-warning" style={{ fontSize: "1.4rem" }}>{fmt(resumen.deuda_proveedores_total)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Detalle por método */}
      {resumen && (
        <div className="grid-4 mb-6">
          <div className="stat-card">
            <div className="stat-label">Efectivo</div>
            <div className="stat-value money" style={{ fontSize: "1.5rem" }}>{fmt(resumen.por_metodo.efectivo)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Transferencia</div>
            <div className="stat-value money" style={{ fontSize: "1.5rem", color: "var(--info)" }}>{fmt(resumen.por_metodo.transferencia)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Tarjeta</div>
            <div className="stat-value money" style={{ fontSize: "1.5rem", color: "var(--primary)" }}>{fmt(resumen.por_metodo.tarjeta)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Deuda clientes</div>
            <div className="stat-value money" style={{ fontSize: "1.5rem", color: "var(--danger)" }}>{fmt(resumen.deuda_clientes_total)}</div>
          </div>
        </div>
      )}

      <div className="grid-2 mb-6">
        {/* Ventas por día */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: "1rem" }}>
            Ventas por día — {["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][mes]} {anio}
          </h3>
          {ventasDia.length === 0
            ? <p className="text-muted text-center" style={{ padding: 32 }}>Sin datos</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ventasDia} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="dia" tick={{ fill: "var(--text3)", fontSize: 10 }} tickFormatter={(d) => d.slice(8)} />
                  <YAxis tick={{ fill: "var(--text3)", fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8 }}
                    labelStyle={{ color: "var(--text)" }}
                    formatter={(v) => [fmt(v), "Total"]}
                  />
                  <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
        </div>

        {/* Métodos de pago */}
        <div className="card">
          <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: "1rem" }}>Métodos de pago (total histórico)</h3>
          {pieData.length === 0
            ? <p className="text-muted text-center" style={{ padding: 32 }}>Sin datos</p>
            : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={METODO_COLORS[entry.name] || COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8 }} formatter={(v) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
        </div>
      </div>

      {/* Productos más vendidos */}
      <div className="card">
        <h3 style={{ fontWeight: 700, marginBottom: 20, fontSize: "1rem" }}>Productos más vendidos</h3>
        {topProductos.length === 0
          ? <p className="text-muted text-center" style={{ padding: 32 }}>Sin datos</p>
          : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topProductos} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill: "var(--text3)", fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="nombre" tick={{ fill: "var(--text2)", fontSize: 11 }} width={160} />
                <Tooltip
                  contentStyle={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8 }}
                  formatter={(v, name) => [name === "total_vendido" ? fmt(v) : v, name === "total_vendido" ? "Total $" : "Cantidad"]}
                />
                <Bar dataKey="total_vendido" fill="var(--success)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
      </div>
    </div>
  );
}
