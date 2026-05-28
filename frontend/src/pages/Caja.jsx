import { useState, useEffect, useCallback, useRef } from "react";
import { cajaAPI, ventasAPI, stockAPI, clientesAPI, promosAPI } from "../api";
import { Plus, Trash2, XCircle, CheckCircle, Loader, DollarSign, PlusCircle, Printer, FileText } from "lucide-react";
import Modal from "../components/Modal";
import { imprimirTicket } from "../components/TicketVenta";
import { facturasAPI } from "../api";
import { imprimirFactura } from "../components/TicketFactura";

// Helper para normalizar texto (quita tildes, minúsculas)
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const METODOS = ["efectivo", "transferencia", "tarjeta"];
const CATS_GASTO = ["insumos", "servicios", "sueldos", "mantenimiento", "varios"];

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

function CajaNoAbierta({ onAbrir }) {
  const [monto, setMonto] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAbrir = async () => {
    setLoading(true);
    try {
      await cajaAPI.abrir({ monto_inicial: parseFloat(monto) || 0 });
      onAbrir();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <div className="card" style={{ maxWidth: 400, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>🍷</div>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 700, marginBottom: 8 }}>Abrir caja del día</h2>
        <p className="text-muted" style={{ marginBottom: 24, fontSize: "0.9rem" }}>
          Ingresá el monto inicial en efectivo para comenzar el día
        </p>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Caja inicial (efectivo)</label>
          <input
            type="number"
            className="form-input"
            placeholder="$ 0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            style={{ fontSize: "1.2rem", textAlign: "center" }}
            onKeyDown={(e) => e.key === "Enter" && handleAbrir()}
          />
        </div>
        <button className="btn btn-primary w-full" onClick={handleAbrir} disabled={loading}>
          {loading ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
          Abrir caja
        </button>
      </div>
    </div>
  );
}

export default function Caja() {
  const [caja, setCaja] = useState(null);
  const [loadingCaja, setLoadingCaja] = useState(true);
  const [ventas, setVentas] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [productos, setProductos] = useState([]);
  const [promos, setPromos] = useState([]);
  const [clientes, setClientes] = useState([]);

  const [detalleLine, setDetalleLine] = useState("");
  const [detalles, setDetalles] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showNuevoProducto, setShowNuevoProducto] = useState(false);
  const [nuevoProductoForm, setNuevoProductoForm] = useState({ nombre: "", precio_venta: "" });
  const suggestionsRef = useRef(null);
  const inputRef = useRef(null);
  const cerrarNuevoProducto = useCallback(() => setShowNuevoProducto(false), []);
  const [metodos, setMetodos] = useState({ efectivo: "", transferencia: "", tarjeta: "" });
  const [clienteId, setClienteId] = useState("");
  const [saving, setSaving] = useState(false);

  const [descuentoVenta, setDescuentoVenta] = useState("");
  const [showGasto, setShowGasto] = useState(false);
  const [gastoDesc, setGastoDesc] = useState("");
  const [gastoMonto, setGastoMonto] = useState("");
  const [gastoCat, setGastoCat] = useState("varios");
  const [lastVenta, setLastVenta] = useState(null);

  const [showCierre, setShowCierre] = useState(false);
  const [montoCierre, setMontoCierre] = useState("");

  const cerrarGasto = useCallback(() => setShowGasto(false), []);
  const cerrarCierreModal = useCallback(() => setShowCierre(false), []);

  const cargarCaja = useCallback(async () => {
    setLoadingCaja(true);
    try {
      const r = await cajaAPI.actual();
      setCaja(r.data);
      if (r.data) {
        await Promise.all([cargarVentas(r.data.id), cargarGastos(r.data.id), cargarResumen(r.data.id)]);
      }
    } finally {
      setLoadingCaja(false);
    }
  }, []);

  async function cargarVentas(id) { const r = await ventasAPI.listar({ caja_id: id }); setVentas(r.data); }
  async function cargarGastos(id) { const r = await ventasAPI.listarGastos({ caja_id: id }); setGastos(r.data); }
  async function cargarResumen(id) { const r = await cajaAPI.resumen(id); setResumen(r.data); }

  useEffect(() => {
    cargarCaja();
    stockAPI.productos({ activo: true }).then((r) => setProductos(r.data));
    promosAPI.listar({ activo: true }).then((r) => setPromos(r.data));
    clientesAPI.listar().then((r) => setClientes(r.data));
  }, []);

  const totalDetallesBruto = detalles.reduce((s, d) => s + d.cantidad * d.precio_unitario, 0);
  const descuentoNum = parseFloat(descuentoVenta) || 0;
  const totalDetalles = Math.max(0, totalDetallesBruto - descuentoNum);
  const totalMetodos = Object.values(metodos).reduce((s, v) => s + (parseFloat(v) || 0), 0);

  // Edición inline de detalles
  const updateDetalleField = (i, field, val) => {
    setDetalles((prev) => prev.map((d, j) =>
      j === i ? { ...d, [field]: parseFloat(val) || 0 } : d
    ));
  };

  const addDetalleProducto = (prod) => {
    setDetalles((prev) => {
      const exists = prev.find((d) => d.producto_id === prod.id);
      if (exists) {
        return prev.map((d) =>
          d.producto_id === prod.id ? { ...d, cantidad: d.cantidad + 1, subtotal: (d.cantidad + 1) * d.precio_unitario } : d
        );
      }
      return [...prev, { producto_id: prod.id, descripcion: prod.nombre, cantidad: 1, precio_unitario: parseFloat(prod.precio_venta), subtotal: parseFloat(prod.precio_venta) }];
    });
  };

  const addDetalleLibre = () => {
    if (!detalleLine.trim()) return;
    const match = detalleLine.match(/^(.+?)\s*x(\d+)\s*@\s*(\d+(?:\.\d+)?)$/i);
    if (match) {
      const [, desc, cant, precio] = match;
      setDetalles((p) => [...p, { descripcion: desc.trim(), cantidad: parseFloat(cant), precio_unitario: parseFloat(precio), subtotal: parseFloat(cant) * parseFloat(precio) }]);
    } else {
      const numMatch = detalleLine.match(/^(.+?)\s+(\d+(?:\.\d+)?)$/);
      if (numMatch) {
        const [, desc, precio] = numMatch;
        setDetalles((p) => [...p, { descripcion: desc.trim(), cantidad: 1, precio_unitario: parseFloat(precio), subtotal: parseFloat(precio) }]);
      } else {
        setDetalles((p) => [...p, { descripcion: detalleLine.trim(), cantidad: 1, precio_unitario: 0, subtotal: 0 }]);
      }
    }
    setDetalleLine("");
  };

  const removeDetalle = (i) => setDetalles((p) => p.filter((_, j) => j !== i));

  // Autocomplete: busca por nombre Y por SKU/código
  const handleDetalleLineChange = (val) => {
    setDetalleLine(val);
    const trimmed = val.trim();
    if (trimmed.length >= 1) {
      const term = norm(trimmed);
      // Coincidencia exacta de SKU primero
      const skuExact = productos.find((p) => p.codigo && p.codigo === trimmed);
      if (skuExact) {
        setSuggestions([skuExact]);
      } else {
        // Busca en nombre (con normalización) y en código (parcial)
        const matches = productos
          .filter((p) =>
            norm(p.nombre).includes(term) ||
            (p.codigo && p.codigo.toLowerCase().includes(term))
          )
          // Prioriza: empieza por el término > contiene el término
          .sort((a, b) => {
            const aN = norm(a.nombre).startsWith(term) ? 0 : 1;
            const bN = norm(b.nombre).startsWith(term) ? 0 : 1;
            return aN - bN;
          })
          .slice(0, 6);
        setSuggestions(matches);
      }
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Lookup por SKU desde lector de barras (Enter con código numérico puro)
  const handleDetalleKeyDown = async (e) => {
    if (e.key === "Enter") {
      const trimmed = detalleLine.trim();
      // Si hay sugerencias visibles, tomar la primera
      if (suggestions.length > 0 && showSuggestions) {
        selectSuggestion(suggestions[0]);
        return;
      }
      // Si parece un SKU de barras (≥6 dígitos numéricos), buscar en backend
      if (/^\d{6,}$/.test(trimmed)) {
        try {
          const r = await stockAPI.obtenerPorSku(trimmed);
          selectSuggestion(r.data);
          return;
        } catch {
          // no encontrado, cae a addDetalleLibre
        }
      }
      addDetalleLibre();
    }
  };

  const selectSuggestion = (prod) => {
    addDetalleProducto(prod);
    setDetalleLine("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Close suggestions on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
          inputRef.current && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const crearProductoRapido = async () => {
    if (!nuevoProductoForm.nombre.trim() || !nuevoProductoForm.precio_venta) return;
    setSaving(true);
    try {
      const r = await stockAPI.crearProducto({
        nombre: nuevoProductoForm.nombre.trim(),
        precio_venta: parseFloat(nuevoProductoForm.precio_venta),
        precio_costo: 0,
        stock_actual: 0,
        stock_minimo: 0,
        unidad: "unidad",
      });
      // Refresh products and add to current sale
      const prodsR = await stockAPI.productos({ activo: true });
      setProductos(prodsR.data);
      const newProd = prodsR.data.find((p) => p.id === r.data.id) || r.data;
      addDetalleProducto(newProd);
      setShowNuevoProducto(false);
      setNuevoProductoForm({ nombre: "", precio_venta: "" });
    } finally { setSaving(false); }
  };

  const guardarVenta = async () => {
    const totalEfc = parseFloat(metodos.efectivo) || 0;
    const totalTrans = parseFloat(metodos.transferencia) || 0;
    const totalTarj = parseFloat(metodos.tarjeta) || 0;
    const pagado = totalEfc + totalTrans + totalTarj;
    
    // El fiado es el monto del subtotal no cubierto por el monto pagado
    const fiadoFinal = totalDetalles > 0 ? Math.max(0, totalDetalles - pagado) : 0;
    
    if (detalles.length === 0 && pagado === 0) return;

    if (fiadoFinal > 0 && !clienteId) {
      alert(`Falta cubrir ${fmt(fiadoFinal)} del total. Debe seleccionar un cliente para generar la deuda/seña.`);
      return;
    }

    setSaving(true);
    try {
      const ventaResp = await ventasAPI.crear({
        detalles: detalles.map(({ producto_id, promo_id, descripcion, cantidad, precio_unitario }) => ({ producto_id, promo_id, descripcion, cantidad, precio_unitario })),
        efectivo: totalEfc,
        transferencia: totalTrans,
        tarjeta: totalTarj,
        seña: 0,
        fiado: fiadoFinal,
        cliente_id: clienteId ? parseInt(clienteId) : null,
        caja_id: caja.id,
        descuento_monto: descuentoNum,
      });
      const ventaCreada = { ...ventaResp.data, detalles, total: totalDetalles || (pagado + fiadoFinal) };
      setLastVenta(ventaCreada);
      setDetalles([]);
      setMetodos({ efectivo: "", transferencia: "", tarjeta: "" });
      setClienteId("");
      setDescuentoVenta("");
      await cargarVentas(caja.id);
      await cargarResumen(caja.id);
    } finally { setSaving(false); }
  };

  const anularVenta = async (id) => {
    if (!confirm("¿Anular esta venta?")) return;
    await ventasAPI.anular(id);
    await cargarVentas(caja.id);
    await cargarResumen(caja.id);
  };

  const eliminarGasto = async (id) => {
    if (!confirm("¿Eliminar este gasto?")) return;
    await ventasAPI.eliminarGasto(id);
    await cargarGastos(caja.id);
    await cargarResumen(caja.id);
  };

  const guardarGasto = async () => {
    if (!gastoDesc || !gastoMonto) return;
    await ventasAPI.crearGasto({ descripcion: gastoDesc, monto: parseFloat(gastoMonto), caja_id: caja.id, categoria: gastoCat });
    setGastoDesc(""); setGastoMonto(""); setGastoCat("varios"); setShowGasto(false);
    await cargarGastos(caja.id);
    await cargarResumen(caja.id);
  };

  const cerrarCaja = async () => {
    if (!montoCierre) return;
    await cajaAPI.cerrar(caja.id, { monto_cierre_real: parseFloat(montoCierre) });
    setShowCierre(false);
    await cargarCaja();
  };

  if (loadingCaja) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <Loader size={32} className="text-muted spin" />
      </div>
    );
  }

  if (!caja || caja.cerrada) return <CajaNoAbierta onAbrir={cargarCaja} />;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Caja del día</h2>
          <p className="page-sub">
            Abierta: {new Date(caja.fecha_apertura).toLocaleString("es-AR")} · Inicial: {fmt(caja.monto_inicial)}
          </p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowGasto(true)}>
            <DollarSign size={14} /> <span className="btn-label">Gasto</span>
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => setShowCierre(true)}>
            Cerrar caja
          </button>
        </div>
      </div>

      {resumen && (
        <div className="grid-4 mb-6">
          {[
            { label: "Total vendido", value: resumen.ventas.total, color: "var(--success)" },
            { label: "Efectivo", value: resumen.ventas.efectivo, color: "var(--text)" },
            { label: "Transfer.", value: resumen.ventas.transferencia, color: "var(--info)" },
            { label: "Fiado", value: resumen.ventas.fiado, color: "var(--danger)" },
          ].map((s) => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value money" style={{ color: s.color, fontSize: "1.5rem" }}>{fmt(s.value)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="caja-grid">
        <div>
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontWeight: 700, fontSize: "1rem" }}>Ventas del día ({ventas.filter((v) => !v.anulada).length})</h3>
            </div>

            <div className="table-wrap hide-mobile">
              <table>
                <thead>
                  <tr><th>#</th><th>Hora</th><th>Detalle</th><th>Efectivo</th><th>Transfer.</th><th>Tarjeta</th><th>Fiado</th><th>Total</th><th></th></tr>
                </thead>
                <tbody>
                  {ventas.length === 0 && <tr><td colSpan={9} className="text-center text-muted" style={{ padding: 32 }}>Aún no hay ventas registradas hoy</td></tr>}
                  {ventas.map((v) => (
                    <tr key={v.id} style={{ opacity: v.anulada ? 0.4 : 1 }}>
                      <td className="text-muted">{v.id}</td>
                      <td className="text-muted">{new Date(v.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td>
                        {v.detalle_libre || v.detalles?.map((d) => d.descripcion).join(", ") || "—"}
                        {v.anulada && <span className="badge badge-danger" style={{ marginLeft: 6 }}>ANULADA</span>}
                      </td>
                      <td className="text-success">{v.efectivo > 0 ? fmt(v.efectivo) : ""}</td>
                      <td style={{ color: "var(--info)" }}>{v.transferencia > 0 ? fmt(v.transferencia) : ""}</td>
                      <td style={{ color: "var(--primary)" }}>{v.tarjeta > 0 ? fmt(v.tarjeta) : ""}</td>
                      <td className="text-danger">{v.fiado > 0 ? fmt(v.fiado) : ""}</td>
                      <td className="money font-bold">{fmt(v.total)}</td>
                      <td>{!v.anulada && <button className="btn btn-ghost btn-sm" onClick={() => anularVenta(v.id)} title="Anular"><XCircle size={14} /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="show-mobile">
              {ventas.length === 0 && <p className="text-center text-muted" style={{ padding: 24 }}>Aún no hay ventas registradas hoy</p>}
              {ventas.map((v) => (
                <div key={v.id} style={{ opacity: v.anulada ? 0.4 : 1, padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-muted" style={{ fontSize: "0.75rem" }}>#{v.id} · {new Date(v.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                      {v.anulada && <span className="badge badge-danger" style={{ marginLeft: 6 }}>ANULADA</span>}
                    </div>
                    <span className="money font-bold">{fmt(v.total)}</span>
                  </div>
                  <div style={{ fontSize: "0.8rem", marginTop: 2 }} className="text-muted">
                    {v.detalle_libre || v.detalles?.map((d) => d.descripcion).join(", ") || "—"}
                  </div>
                  {!v.anulada && <button className="btn btn-ghost btn-sm mt-1" style={{ fontSize: "0.7rem" }} onClick={() => anularVenta(v.id)}><XCircle size={12} /> Anular</button>}
                </div>
              ))}
            </div>

            {gastos.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <h4 style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text2)", marginBottom: 8 }}>GASTOS</h4>
                {gastos.map((g) => (
                  <div key={g.id} className="flex items-center justify-between" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontSize: "0.875rem" }}>{g.descripcion}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-danger money">{fmt(g.monto)}</span>
                      <button className="btn btn-ghost btn-sm" style={{ padding: "2px 6px" }} onClick={() => eliminarGasto(g.id)} title="Eliminar gasto"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: "1rem" }}>Nueva venta</h3>

            <div className="form-group mb-4">
              <label className="form-label">Buscar producto o escribir libre (ej: "Foto x10 @50")</label>
              <div style={{ position: "relative" }}>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    className="form-input"
                    placeholder='Buscar producto o escribir libre...'
                    value={detalleLine}
                    onChange={(e) => handleDetalleLineChange(e.target.value)}
                    onKeyDown={handleDetalleKeyDown}
                    onFocus={() => { if (detalleLine.trim().length >= 1 && suggestions.length > 0) setShowSuggestions(true); }}
                  />
                  <button className="btn btn-ghost btn-sm" onClick={addDetalleLibre} title="Agregar como texto libre"><Plus size={16} /></button>
                </div>
                {showSuggestions && (suggestions.length > 0 || detalleLine.trim().length >= 2) && (
                  <div ref={suggestionsRef} className="autocomplete-dropdown">
                    {suggestions.map((p) => (
                      <button key={p.id} className="autocomplete-item" onClick={() => selectSuggestion(p)}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "flex-start" }}>
                          <span style={{ fontWeight: 500 }}>{p.nombre}</span>
                          {p.codigo && <span className="font-mono text-muted" style={{ fontSize: "0.72rem" }}>SKU: {p.codigo}</span>}
                        </div>
                        <span className="money text-success" style={{ fontSize: "0.85rem", whiteSpace: "nowrap" }}>{fmt(p.precio_venta)}</span>
                      </button>
                    ))}
                    {detalleLine.trim().length >= 2 && (
                      <button className="autocomplete-item autocomplete-create" onClick={() => {
                        setNuevoProductoForm({ nombre: detalleLine.trim(), precio_venta: "" });
                        setShowNuevoProducto(true);
                        setShowSuggestions(false);
                      }}>
                        <PlusCircle size={14} />
                        <span>Crear "<b>{detalleLine.trim()}</b>" como nuevo producto</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {productos.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="form-label mb-4">Acceso rápido</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {productos.slice(0, 8).map((p) => (
                    <button key={p.id} className="btn btn-ghost btn-sm" style={{ fontSize: "0.75rem" }} onClick={() => addDetalleProducto(p)}>
                      {p.nombre.split(" ").slice(0, 3).join(" ")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {promos.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div className="form-label mb-4">Promos / Combos</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {promos.map((pr) => (
                    <button key={pr.id} className="btn btn-ghost btn-sm" style={{ fontSize: "0.75rem", borderColor: "var(--success)", color: "var(--success)" }} onClick={() => {
                      const desc = pr.nombre + " (" + (pr.productos?.map((pp) => pp.producto?.nombre || "?").join(" + ")) + ")";
                      setDetalles((prev) => [...prev, {
                        promo_id: pr.id,
                        descripcion: desc,
                        cantidad: 1,
                        precio_unitario: parseFloat(pr.precio_promo),
                        subtotal: parseFloat(pr.precio_promo),
                      }]);
                    }}>
                      🏷️ {pr.nombre} — {fmt(pr.precio_promo)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {detalles.length > 0 && (
              <div className="mb-4">
                {detalles.map((d, i) => (
                  <div key={i} style={{ padding: "6px 0", borderBottom: "1px solid var(--border)", display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 6, alignItems: "center", fontSize: "0.82rem" }}>
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.descripcion}</span>
                    <input type="number" className="form-input" style={{ width: 52, padding: "3px 6px", fontSize: "0.78rem" }} value={d.cantidad} onChange={(e) => updateDetalleField(i, "cantidad", e.target.value)} title="Cantidad" />
                    <input type="number" className="form-input" style={{ width: 76, padding: "3px 6px", fontSize: "0.78rem" }} value={d.precio_unitario} onChange={(e) => updateDetalleField(i, "precio_unitario", e.target.value)} title="Precio" />
                    <div className="flex items-center gap-1">
                      <span className="money" style={{ minWidth: 60, textAlign: "right" }}>{fmt(d.cantidad * d.precio_unitario)}</span>
                      <button className="btn btn-ghost btn-sm" style={{ padding: "2px 5px" }} onClick={() => removeDetalle(i)}><Trash2 size={11} /></button>
                    </div>
                  </div>
                ))}
                <div className="flex justify-between" style={{ marginTop: 8, fontSize: "0.85rem" }}>
                  <span className="text-muted">Subtotal</span>
                  <span className="money">{fmt(totalDetallesBruto)}</span>
                </div>
                <div className="form-group" style={{ marginTop: 8 }}>
                  <label className="form-label">Descuento ($)</label>
                  <input type="number" className="form-input" placeholder="0" value={descuentoVenta} onChange={(e) => setDescuentoVenta(e.target.value)} style={{ fontSize: "0.85rem" }} />
                </div>
                {descuentoNum > 0 && (
                  <div className="flex justify-between" style={{ marginTop: 6, fontWeight: 700 }}>
                    <span>Total con descuento</span>
                    <span className="money text-success">{fmt(totalDetalles)}</span>
                  </div>
                )}
              </div>
            )}

            <hr className="divider" />

            <div className="form-group mb-4">
              <label className="form-label">Método de pago (puede ser mixto)</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {METODOS.map((m) => (
                  <div key={m} className="form-group">
                    <label className={`form-label payment-pill ${m} ${metodos[m] ? "active" : ""}`} style={{ marginBottom: 4, borderRadius: 6, padding: "4px 8px", display: "flex", justifyContent: "space-between" }}>
                      {m.charAt(0).toUpperCase() + m.slice(1)}
                    </label>
                    <input type="number" className="form-input" placeholder="$" value={metodos[m] || ""} onChange={(e) => setMetodos((p) => ({ ...p, [m]: e.target.value }))} style={{ fontSize: "0.9rem" }} />
                  </div>
                ))}
                
                <div className="form-group">
                  <label className="form-label payment-pill text-danger active" style={{ marginBottom: 4, borderRadius: 6, padding: "4px 8px", display: "flex", justifyContent: "space-between", background: "rgba(239, 68, 68, 0.1)" }}>
                    Falta (Seña/Fiado)
                  </label>
                  <input type="text" className="form-input" readOnly value={fmt(totalDetalles > 0 ? Math.max(0, totalDetalles - (parseFloat(metodos.efectivo || 0) + parseFloat(metodos.transferencia || 0) + parseFloat(metodos.tarjeta || 0))) : 0)} style={{ fontSize: "0.9rem", color: "var(--danger)", background: "var(--bg-card)", fontWeight: 700 }} />
                </div>
              </div>
            </div>

            {totalDetalles > 0 && Math.max(0, totalDetalles - (parseFloat(metodos.efectivo || 0) + parseFloat(metodos.transferencia || 0) + parseFloat(metodos.tarjeta || 0))) > 0 && (
              <div className="form-group mb-4">
                <label className="form-label text-danger">Cliente (requerido al faltar cubrir total)</label>
                <select className="form-select" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} {c.deuda_total > 0 ? `(debe ${fmt(c.deuda_total)})` : ""}</option>)}
                </select>
              </div>
            )}

            <div className="flex justify-between items-center" style={{ marginBottom: 16, padding: "12px 0", borderTop: "1px solid var(--border)" }}>
              <span style={{ fontWeight: 600 }}>Total cobrado</span>
              <span className="money-lg text-success">{fmt(totalMetodos || totalDetalles)}</span>
            </div>

            <button className="btn btn-primary w-full" onClick={guardarVenta} disabled={saving || (detalles.length === 0 && totalMetodos === 0)}>
              {saving ? <Loader size={16} className="spin" /> : <CheckCircle size={16} />}
              Registrar venta
            </button>
          </div>
        </div>
      </div>

      {/* Toast: última venta + ticket */}
      {lastVenta && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 500,
          background: "var(--bg2)", border: "1px solid var(--success)",
          borderRadius: "var(--radius)", padding: "14px 18px",
          boxShadow: "var(--shadow)", display: "flex", alignItems: "center", gap: 12,
          animation: "slideUp 0.2s ease",
        }}>
          <CheckCircle size={18} style={{ color: "var(--success)", flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Venta registrada ✓</div>
            <div className="text-muted" style={{ fontSize: "0.75rem" }}>{fmt(lastVenta.total)}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => imprimirTicket(lastVenta)} title="Imprimir ticket">
            <Printer size={14} /> Ticket
          </button>
          <button className="btn btn-ghost btn-sm" onClick={async () => {
            try {
              const r = await facturasAPI.crear({ tipo: "B", venta_id: lastVenta.id });
              imprimirFactura(r.data);
            } catch (e) { alert(e.response?.data?.detail || "Error al facturar"); }
          }} title="Emitir factura">
            <FileText size={14} /> Facturar
          </button>
          <button className="btn btn-ghost btn-sm" style={{ padding: "4px 8px" }} onClick={() => setLastVenta(null)}>✕</button>
        </div>
      )}

      {/* Modal gasto */}
      <Modal open={showGasto} onClose={cerrarGasto} title="Registrar gasto">
        <div className="flex-col flex gap-4">
          <div className="form-group">
            <label className="form-label">Descripción</label>
            <input className="form-input" placeholder="Ej: Insumos, limpieza..." value={gastoDesc} onChange={(e) => setGastoDesc(e.target.value)} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Monto</label>
              <input type="number" className="form-input" placeholder="$" value={gastoMonto} onChange={(e) => setGastoMonto(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={gastoCat} onChange={(e) => setGastoCat(e.target.value)}>
                {CATS_GASTO.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={cerrarGasto}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardarGasto}>Guardar gasto</button>
        </div>
      </Modal>

      {/* Modal nuevo producto rápido */}
      <Modal open={showNuevoProducto} onClose={cerrarNuevoProducto} title="Crear producto rapido">
        <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: 16 }}>
          Se creara el producto y se agregara automaticamente a la venta actual.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Nombre</label>
            <input className="form-input" value={nuevoProductoForm.nombre} onChange={(e) => setNuevoProductoForm((p) => ({ ...p, nombre: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Precio de venta</label>
            <input type="number" className="form-input" placeholder="$" value={nuevoProductoForm.precio_venta} onChange={(e) => setNuevoProductoForm((p) => ({ ...p, precio_venta: e.target.value }))} />
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={cerrarNuevoProducto}>Cancelar</button>
          <button className="btn btn-primary" onClick={crearProductoRapido} disabled={saving}>
            {saving ? "Creando..." : "Crear y agregar"}
          </button>
        </div>
      </Modal>

      {/* Modal cierre */}
      <Modal open={showCierre && !!resumen} onClose={cerrarCierreModal} title="Cierre de caja">
        {resumen && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {Object.entries(resumen.ventas).filter(([k]) => k !== "cantidad").map(([k, v]) => (
                <div key={k} className="stat-card card-sm">
                  <div className="stat-label">{k}</div>
                  <div className="stat-value" style={{ fontSize: "1.1rem" }}>{fmt(v)}</div>
                </div>
              ))}
              <div className="stat-card card-sm">
                <div className="stat-label">Gastos</div>
                <div className="stat-value text-danger" style={{ fontSize: "1.1rem" }}>{fmt(resumen.gastos)}</div>
              </div>
              <div className="stat-card card-sm">
                <div className="stat-label">Balance efectivo sistema</div>
                <div className="stat-value text-success" style={{ fontSize: "1.1rem" }}>{fmt(resumen.balance_efectivo)}</div>
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Efectivo contado en caja</label>
              <input type="number" className="form-input" style={{ fontSize: "1.2rem" }} placeholder="$" value={montoCierre} onChange={(e) => setMontoCierre(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={cerrarCierreModal}>Cancelar</button>
              <button className="btn btn-danger" onClick={cerrarCaja}>Cerrar caja</button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
