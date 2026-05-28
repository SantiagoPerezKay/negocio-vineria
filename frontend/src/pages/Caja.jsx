import { useState, useEffect, useCallback, useRef } from "react";
import { cajaAPI, ventasAPI, stockAPI, clientesAPI, promosAPI } from "../api";
import {
  Plus, Trash2, XCircle, CheckCircle, Loader, DollarSign, PlusCircle,
  Printer, FileText, Search, ShoppingBag, Clock, Banknote, CreditCard,
  ArrowRightLeft, AlertCircle, Wine, Tag, Minus, X,
} from "lucide-react";
import Modal from "../components/Modal";
import { imprimirTicket } from "../components/TicketVenta";
import { facturasAPI } from "../api";
import { imprimirFactura } from "../components/TicketFactura";

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const CATS_GASTO = ["insumos", "servicios", "sueldos", "mantenimiento", "varios"];

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

/* ── Pantalla caja cerrada ────────────────────────────────── */
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
    <div className="caja-empty-state">
      <div className="caja-empty-card">
        <div className="caja-empty-icon">
          <Wine size={40} />
        </div>
        <h2>Abrir caja del día</h2>
        <p>Ingresá el monto inicial en efectivo para comenzar</p>
        <div className="form-group" style={{ width: "100%", maxWidth: 280 }}>
          <label className="form-label" style={{ textAlign: "center" }}>Efectivo inicial</label>
          <input
            type="number"
            className="form-input caja-empty-input"
            placeholder="$ 0"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAbrir()}
          />
        </div>
        <button className="btn btn-primary btn-lg" onClick={handleAbrir} disabled={loading}>
          {loading ? <Loader size={18} className="spin" /> : <CheckCircle size={18} />}
          Abrir caja
        </button>
      </div>
    </div>
  );
}

/* ── Componente principal ─────────────────────────────────── */
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

  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [facturaTipo, setFacturaTipo] = useState("B");
  const [facturaGuardando, setFacturaGuardando] = useState(false);

  // Tabs mobile
  const [mobileTab, setMobileTab] = useState("venta"); // "venta" | "ventas"

  const cerrarGasto = useCallback(() => setShowGasto(false), []);
  const cerrarCierreModal = useCallback(() => setShowCierre(false), []);
  const cerrarFacturaModal = useCallback(() => setShowFacturaModal(false), []);

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
  const faltaCubrir = totalDetalles > 0 ? Math.max(0, totalDetalles - totalMetodos) : 0;

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
      return [...prev, { producto_id: prod.id, descripcion: prod.nombre, imagen_url: prod.imagen_url || null, cantidad: 1, precio_unitario: parseFloat(prod.precio_venta), subtotal: parseFloat(prod.precio_venta) }];
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

  const handleDetalleLineChange = (val) => {
    setDetalleLine(val);
    const trimmed = val.trim();
    if (trimmed.length >= 1) {
      const term = norm(trimmed);
      const skuExact = productos.find((p) => p.codigo && p.codigo === trimmed);
      if (skuExact) {
        setSuggestions([skuExact]);
      } else {
        const matches = productos
          .filter((p) =>
            norm(p.nombre).includes(term) ||
            (p.codigo && p.codigo.toLowerCase().includes(term))
          )
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

  const handleDetalleKeyDown = async (e) => {
    if (e.key === "Enter") {
      const trimmed = detalleLine.trim();
      if (suggestions.length > 0 && showSuggestions) {
        selectSuggestion(suggestions[0]);
        return;
      }
      if (/^\d{6,}$/.test(trimmed)) {
        try {
          const r = await stockAPI.obtenerPorSku(trimmed);
          selectSuggestion(r.data);
          return;
        } catch { /* no encontrado */ }
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
        precio_costo: 0, stock_actual: 0, stock_minimo: 0, unidad: "unidad",
      });
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
    const fiadoFinal = totalDetalles > 0 ? Math.max(0, totalDetalles - pagado) : 0;

    if (detalles.length === 0 && pagado === 0) return;
    if (fiadoFinal > 0 && !clienteId) {
      alert(`Falta cubrir ${fmt(fiadoFinal)}. Seleccione un cliente para fiado/seña.`);
      return;
    }

    setSaving(true);
    try {
      const ventaResp = await ventasAPI.crear({
        detalles: detalles.map(({ producto_id, promo_id, descripcion, cantidad, precio_unitario }) => ({ producto_id, promo_id, descripcion, cantidad, precio_unitario })),
        efectivo: totalEfc, transferencia: totalTrans, tarjeta: totalTarj,
        seña: 0, fiado: fiadoFinal,
        cliente_id: clienteId ? parseInt(clienteId) : null,
        caja_id: caja.id, descuento_monto: descuentoNum,
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
    const monto = parseFloat(montoCierre);
    if (isNaN(monto) || monto < 0) {
      alert("Ingresá el monto de efectivo contado en caja (puede ser 0)");
      return;
    }
    try {
      await cajaAPI.cerrar(caja.id, { monto_cierre_real: monto });
      setShowCierre(false);
      await cargarCaja();
    } catch (err) {
      alert(err.response?.data?.detail || "Error al cerrar caja");
    }
  };

  if (loadingCaja) {
    return (
      <div className="caja-empty-state">
        <Loader size={32} className="text-muted spin" />
      </div>
    );
  }

  if (!caja || caja.cerrada) return <CajaNoAbierta onAbrir={cargarCaja} />;

  const ventasActivas = ventas.filter((v) => !v.anulada);

  /* ── Render ─────────────────────────────────────────────── */
  return (
    <div className="caja-page">
      {/* Header */}
      <div className="caja-header">
        <div className="caja-header-info">
          <h2 className="caja-title">Caja del día</h2>
          <div className="caja-meta">
            <Clock size={13} />
            <span>Abierta {new Date(caja.fecha_apertura).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
            <span className="caja-meta-sep">·</span>
            <span>Inicial: {fmt(caja.monto_inicial)}</span>
          </div>
        </div>
        <div className="caja-header-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setShowGasto(true)}>
            <DollarSign size={14} /> <span className="btn-label">Gasto</span>
          </button>
          <button className="btn btn-danger btn-sm" onClick={() => setShowCierre(true)}>
            <X size={14} /> <span className="btn-label">Cerrar</span> caja
          </button>
        </div>
      </div>

      {/* Stats strip */}
      {resumen && (
        <div className="caja-stats">
          <div className="caja-stat caja-stat-main">
            <ShoppingBag size={16} />
            <div>
              <span className="caja-stat-label">Vendido</span>
              <span className="caja-stat-value">{fmt(resumen.ventas.total)}</span>
            </div>
          </div>
          <div className="caja-stat">
            <Banknote size={16} />
            <div>
              <span className="caja-stat-label">Efectivo</span>
              <span className="caja-stat-value">{fmt(resumen.ventas.efectivo)}</span>
            </div>
          </div>
          <div className="caja-stat">
            <ArrowRightLeft size={16} />
            <div>
              <span className="caja-stat-label">Transfer.</span>
              <span className="caja-stat-value">{fmt(resumen.ventas.transferencia)}</span>
            </div>
          </div>
          <div className="caja-stat">
            <CreditCard size={16} />
            <div>
              <span className="caja-stat-label">Tarjeta</span>
              <span className="caja-stat-value">{fmt(resumen.ventas.tarjeta)}</span>
            </div>
          </div>
          {resumen.ventas.fiado > 0 && (
            <div className="caja-stat caja-stat-danger">
              <AlertCircle size={16} />
              <div>
                <span className="caja-stat-label">Fiado</span>
                <span className="caja-stat-value">{fmt(resumen.ventas.fiado)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile tabs */}
      <div className="caja-mobile-tabs show-mobile">
        <button className={`caja-mobile-tab ${mobileTab === "venta" ? "active" : ""}`} onClick={() => setMobileTab("venta")}>
          <Plus size={14} /> Nueva venta
        </button>
        <button className={`caja-mobile-tab ${mobileTab === "ventas" ? "active" : ""}`} onClick={() => setMobileTab("ventas")}>
          <Clock size={14} /> Ventas ({ventasActivas.length})
        </button>
      </div>

      {/* Main grid */}
      <div className="caja-layout">
        {/* ── Panel Nueva venta ────────────────────────────── */}
        <div className={`caja-panel-venta ${mobileTab === "venta" ? "" : "caja-hide-mobile"}`}>
          <div className="caja-venta-card">
            <h3 className="caja-section-title">
              <Plus size={16} /> Nueva venta
            </h3>

            {/* Search */}
            <div className="caja-search-wrap">
              <div className="caja-search-box">
                <Search size={16} className="caja-search-icon" />
                <input
                  ref={inputRef}
                  className="caja-search-input"
                  placeholder="Buscar producto, escanear código..."
                  value={detalleLine}
                  onChange={(e) => handleDetalleLineChange(e.target.value)}
                  onKeyDown={handleDetalleKeyDown}
                  onFocus={() => { if (detalleLine.trim().length >= 1 && suggestions.length > 0) setShowSuggestions(true); }}
                />
                {detalleLine && (
                  <button className="caja-search-clear" onClick={() => { setDetalleLine(""); setSuggestions([]); setShowSuggestions(false); }}>
                    <X size={14} />
                  </button>
                )}
              </div>
              {showSuggestions && (suggestions.length > 0 || detalleLine.trim().length >= 2) && (
                <div ref={suggestionsRef} className="autocomplete-dropdown">
                  {suggestions.map((p) => (
                    <button key={p.id} className="autocomplete-item" onClick={() => selectSuggestion(p)}>
                      <div className="caja-suggestion-left">
                        {p.imagen_url ? (
                          <img src={p.imagen_url} alt="" className="caja-suggestion-img" />
                        ) : (
                          <div className="caja-suggestion-placeholder"><Wine size={14} /></div>
                        )}
                        <div className="caja-suggestion-info">
                          <span className="caja-suggestion-name">{p.nombre}</span>
                          {p.codigo && <span className="caja-suggestion-sku">SKU: {p.codigo}</span>}
                        </div>
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
                      <span>Crear "<b>{detalleLine.trim()}</b>" como producto</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Quick access */}
            {(productos.length > 0 || promos.length > 0) && (
              <div className="caja-quick-section">
                {productos.length > 0 && (
                  <div className="caja-quick-grid">
                    {productos.slice(0, 8).map((p) => (
                      <button key={p.id} className="caja-quick-btn" onClick={() => addDetalleProducto(p)}>
                        {p.imagen_url ? (
                          <img src={p.imagen_url} alt="" className="caja-quick-img" />
                        ) : (
                          <div className="caja-quick-placeholder"><Wine size={14} /></div>
                        )}
                        <span className="caja-quick-name">{p.nombre}</span>
                        <span className="caja-quick-price">{fmt(p.precio_venta)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {promos.length > 0 && (
                  <div className="caja-promo-row">
                    {promos.map((pr) => (
                      <button key={pr.id} className="caja-promo-btn" onClick={() => {
                        const desc = pr.nombre + " (" + (pr.productos?.map((pp) => pp.producto?.nombre || "?").join(" + ")) + ")";
                        setDetalles((prev) => [...prev, {
                          promo_id: pr.id, descripcion: desc,
                          cantidad: 1, precio_unitario: parseFloat(pr.precio_promo), subtotal: parseFloat(pr.precio_promo),
                        }]);
                      }}>
                        <Tag size={13} />
                        <span>{pr.nombre}</span>
                        <span className="caja-promo-price">{fmt(pr.precio_promo)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Cart items */}
            {detalles.length > 0 && (
              <div className="caja-cart">
                <div className="caja-cart-header">
                  <span>Productos ({detalles.length})</span>
                  <span className="money">{fmt(totalDetallesBruto)}</span>
                </div>
                {detalles.map((d, i) => (
                  <div key={i} className="caja-cart-item">
                    <div className="caja-cart-item-left">
                      {d.imagen_url && <img src={d.imagen_url} alt="" className="caja-cart-item-img" />}
                      <span className="caja-cart-item-name">{d.descripcion}</span>
                    </div>
                    <div className="caja-cart-item-right">
                      <div className="caja-qty-control">
                        <button onClick={() => {
                          if (d.cantidad <= 1) { removeDetalle(i); return; }
                          updateDetalleField(i, "cantidad", d.cantidad - 1);
                        }}><Minus size={12} /></button>
                        <span>{d.cantidad}</span>
                        <button onClick={() => updateDetalleField(i, "cantidad", d.cantidad + 1)}><Plus size={12} /></button>
                      </div>
                      <span className="caja-cart-item-price">{fmt(d.cantidad * d.precio_unitario)}</span>
                      <button className="caja-cart-item-remove" onClick={() => removeDetalle(i)}><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}

                {/* Discount */}
                <div className="caja-discount-row">
                  <label>Descuento</label>
                  <div className="caja-discount-input-wrap">
                    <span>$</span>
                    <input type="number" placeholder="0" value={descuentoVenta} onChange={(e) => setDescuentoVenta(e.target.value)} />
                  </div>
                </div>
                {descuentoNum > 0 && (
                  <div className="caja-cart-total-row">
                    <span>Total con descuento</span>
                    <span className="money text-success">{fmt(totalDetalles)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Payment */}
            <div className="caja-payment">
              <span className="caja-payment-title">Método de pago</span>
              <div className="caja-payment-grid">
                <div className="caja-payment-method">
                  <div className="caja-payment-label caja-pay-efectivo"><Banknote size={14} /> Efectivo</div>
                  <input type="number" className="form-input" placeholder="$ 0" value={metodos.efectivo} onChange={(e) => setMetodos((p) => ({ ...p, efectivo: e.target.value }))} />
                </div>
                <div className="caja-payment-method">
                  <div className="caja-payment-label caja-pay-transfer"><ArrowRightLeft size={14} /> Transferencia</div>
                  <input type="number" className="form-input" placeholder="$ 0" value={metodos.transferencia} onChange={(e) => setMetodos((p) => ({ ...p, transferencia: e.target.value }))} />
                </div>
                <div className="caja-payment-method">
                  <div className="caja-payment-label caja-pay-tarjeta"><CreditCard size={14} /> Tarjeta</div>
                  <input type="number" className="form-input" placeholder="$ 0" value={metodos.tarjeta} onChange={(e) => setMetodos((p) => ({ ...p, tarjeta: e.target.value }))} />
                </div>
              </div>

              {faltaCubrir > 0 && (
                <div className="caja-falta">
                  <AlertCircle size={14} />
                  <span>Falta cubrir: <b>{fmt(faltaCubrir)}</b> (queda como fiado)</span>
                </div>
              )}

              {faltaCubrir > 0 && (
                <div className="form-group">
                  <label className="form-label" style={{ color: "var(--danger)" }}>Cliente para fiado</label>
                  <select className="form-select" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                    <option value="">Seleccionar cliente...</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} {c.deuda_total > 0 ? `(debe ${fmt(c.deuda_total)})` : ""}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Total + submit */}
            <div className="caja-submit">
              <div className="caja-submit-total">
                <span>Total</span>
                <span className="caja-submit-amount">{fmt(totalDetalles || totalMetodos)}</span>
              </div>
              <button className="btn btn-primary btn-lg w-full caja-submit-btn" onClick={guardarVenta} disabled={saving || (detalles.length === 0 && totalMetodos === 0)}>
                {saving ? <Loader size={18} className="spin" /> : <CheckCircle size={18} />}
                Registrar venta
              </button>
            </div>
          </div>
        </div>

        {/* ── Panel historial ─────────────────────────────── */}
        <div className={`caja-panel-historial ${mobileTab === "ventas" ? "" : "caja-hide-mobile"}`}>
          <div className="caja-historial-card">
            <h3 className="caja-section-title">
              <Clock size={16} /> Ventas del día
              <span className="caja-section-count">{ventasActivas.length}</span>
            </h3>

            {ventas.length === 0 ? (
              <div className="caja-empty-list">
                <ShoppingBag size={28} />
                <span>Sin ventas registradas hoy</span>
              </div>
            ) : (
              <div className="caja-ventas-list">
                {ventas.map((v) => (
                  <div key={v.id} className={`caja-venta-row ${v.anulada ? "caja-venta-anulada" : ""}`}>
                    <div className="caja-venta-left">
                      <div className="caja-venta-time">
                        {new Date(v.fecha).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div className="caja-venta-detail">
                        <span className="caja-venta-desc">
                          {v.detalle_libre || v.detalles?.map((d) => d.descripcion).join(", ") || "—"}
                        </span>
                        <div className="caja-venta-badges">
                          {v.efectivo > 0 && <span className="caja-venta-badge caja-badge-ef">{fmt(v.efectivo)}</span>}
                          {v.transferencia > 0 && <span className="caja-venta-badge caja-badge-tr">{fmt(v.transferencia)}</span>}
                          {v.tarjeta > 0 && <span className="caja-venta-badge caja-badge-ta">{fmt(v.tarjeta)}</span>}
                          {v.fiado > 0 && <span className="caja-venta-badge caja-badge-fi">{fmt(v.fiado)}</span>}
                          {v.anulada && <span className="badge badge-danger">ANULADA</span>}
                        </div>
                      </div>
                    </div>
                    <div className="caja-venta-right">
                      <span className="caja-venta-total">{fmt(v.total)}</span>
                      {!v.anulada && (
                        <button className="caja-venta-anular-btn" onClick={() => anularVenta(v.id)} title="Anular">
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {gastos.length > 0 && (
              <div className="caja-gastos-section">
                <h4 className="caja-gastos-title">Gastos</h4>
                {gastos.map((g) => (
                  <div key={g.id} className="caja-gasto-row">
                    <span>{g.descripcion}</span>
                    <div className="caja-gasto-right">
                      <span className="text-danger money">{fmt(g.monto)}</span>
                      <button className="caja-venta-anular-btn" onClick={() => eliminarGasto(g.id)} title="Eliminar"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Toast última venta ──────────────────────────────── */}
      {lastVenta && (
        <div className="caja-toast">
          <div className="caja-toast-icon"><CheckCircle size={20} /></div>
          <div className="caja-toast-info">
            <span className="caja-toast-title">Venta registrada</span>
            <span className="caja-toast-amount">{fmt(lastVenta.total)}</span>
          </div>
          <div className="caja-toast-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => imprimirTicket(lastVenta)}><Printer size={14} /> Ticket</button>
            <button className="btn btn-ghost btn-sm" onClick={() => { setFacturaTipo("B"); setShowFacturaModal(true); }}><FileText size={14} /> Facturar</button>
          </div>
          <button className="caja-toast-close" onClick={() => setLastVenta(null)}><X size={16} /></button>
        </div>
      )}

      {/* ── Modales ─────────────────────────────────────────── */}
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

      <Modal open={showNuevoProducto} onClose={cerrarNuevoProducto} title="Crear producto rápido">
        <p className="text-muted" style={{ fontSize: "0.85rem", marginBottom: 16 }}>
          Se creará el producto y se agregará a la venta actual.
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
                <div className="stat-label">Balance efectivo</div>
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

      <Modal open={showFacturaModal} onClose={cerrarFacturaModal} title="Emitir factura">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Tipo de factura</label>
            <div style={{ display: "flex", gap: 10 }}>
              {["A", "B", "C"].map((t) => (
                <button
                  key={t}
                  className={`btn ${facturaTipo === t ? "btn-primary" : "btn-ghost"}`}
                  style={{ flex: 1, fontSize: "1.1rem", fontWeight: 700, padding: "14px 0" }}
                  onClick={() => setFacturaTipo(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {lastVenta && (
            <div style={{ background: "var(--bg3)", borderRadius: "var(--radius-sm)", padding: 12, border: "1px solid var(--border)" }}>
              <div className="flex justify-between" style={{ fontSize: "0.85rem" }}>
                <span className="text-muted">Venta #{lastVenta.id}</span>
                <span className="money text-success" style={{ fontWeight: 700 }}>{fmt(lastVenta.total)}</span>
              </div>
            </div>
          )}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={cerrarFacturaModal}>Cancelar</button>
          <button className="btn btn-primary" disabled={facturaGuardando} onClick={async () => {
            setFacturaGuardando(true);
            try {
              const r = await facturasAPI.crear({ tipo: facturaTipo, venta_id: lastVenta.id });
              imprimirFactura(r.data);
              setShowFacturaModal(false);
            } catch (e) {
              alert(e.response?.data?.detail || "Error al emitir factura");
            } finally {
              setFacturaGuardando(false);
            }
          }}>
            <FileText size={16} />
            {facturaGuardando ? "Emitiendo..." : `Emitir Factura ${facturaTipo}`}
          </button>
        </div>
      </Modal>
    </div>
  );
}
