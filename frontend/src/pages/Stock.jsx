import { useState, useEffect, useCallback, useRef } from "react";
import { stockAPI } from "../api";
import { Plus, AlertTriangle, Edit2, TrendingUp, Trash2, Upload, Image } from "lucide-react";
import Modal from "../components/Modal";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

const TIPOS_VINO = ["tinto", "blanco", "rosado", "espumante", "dulce", "otro"];
const UNIDADES = ["unidad", "botella", "caja", "litro", "kg"];

const CLOUDINARY_CLOUD = "dh7ki51v5";
const CLOUDINARY_PRESET = "vineria_productos";

const uploadToCloudinary = async (file) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET);
  formData.append("folder", "vineria");
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
    method: "POST",
    body: formData,
  });
  const data = await res.json();
  return data.secure_url;
};

export default function Stock() {
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [filtro, setFiltro] = useState({ categoria: "", bajStock: false });
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({});
  const [ajuste, setAjuste] = useState({ cantidad: "", motivo: "" });
  const [saving, setSaving] = useState(false);
  const [catNombre, setCatNombre] = useState("");
  const [uploadingImg, setUploadingImg] = useState(false);
  const fileInputRef = useRef(null);

  const cerrarModal = useCallback(() => setModal(null), []);

  const cargar = async () => {
    const params = {};
    if (filtro.categoria) params.categoria_id = filtro.categoria;
    if (filtro.bajStock) params.bajo_stock = true;
    const [prods, cats, al] = await Promise.all([
      stockAPI.productos(params),
      stockAPI.categorias(),
      stockAPI.alertas(),
    ]);
    setProductos(prods.data);
    setCategorias(cats.data);
    setAlertas(al.data);
  };

  useEffect(() => { cargar(); }, [filtro]);

  const diasParaVencer = (fecha) => {
    if (!fecha) return null;
    return Math.ceil((new Date(fecha) - new Date()) / 86400000);
  };

  const abrirNuevo = () => {
    setForm({ nombre: "", codigo: "", categoria_id: "", tipo_vino: "", imagen_url: "", nota_sabor: "", maridaje: "", ocasion: "", precio_venta: "", precio_costo: "", stock_actual: "0", stock_minimo: "0", unidad: "botella", fecha_vencimiento: "" });
    setModal("nuevo");
  };

  const abrirEditar = (p) => {
    setSelected(p);
    setForm({ nombre: p.nombre, codigo: p.codigo || "", categoria_id: p.categoria_id || "", tipo_vino: p.tipo_vino || "", imagen_url: p.imagen_url || "", nota_sabor: p.nota_sabor || "", maridaje: p.maridaje || "", ocasion: p.ocasion || "", precio_venta: p.precio_venta, precio_costo: p.precio_costo || "", stock_actual: p.stock_actual, stock_minimo: p.stock_minimo, unidad: p.unidad, fecha_vencimiento: p.fecha_vencimiento || "" });
    setModal("editar");
  };

  const abrirAjuste = (p) => {
    setSelected(p);
    setAjuste({ cantidad: "", motivo: "" });
    setModal("ajuste");
  };

  const guardar = async () => {
    setSaving(true);
    try {
      const data = {
        ...form,
        codigo: form.codigo?.trim() || null,
        categoria_id: form.categoria_id ? parseInt(form.categoria_id) : null,
        tipo_vino: form.tipo_vino || null,
        imagen_url: form.imagen_url || null,
        nota_sabor: form.nota_sabor || null,
        maridaje: form.maridaje || null,
        ocasion: form.ocasion || null,
        precio_venta: parseFloat(form.precio_venta) || 0,
        precio_costo: parseFloat(form.precio_costo) || 0,
        stock_actual: parseFloat(form.stock_actual) || 0,
        stock_minimo: parseFloat(form.stock_minimo) || 0,
        fecha_vencimiento: form.fecha_vencimiento || null,
      };
      if (modal === "nuevo") await stockAPI.crearProducto(data);
      else await stockAPI.actualizarProducto(selected.id, data);
      setModal(null);
      cargar();
    } finally { setSaving(false); }
  };

  const guardarAjuste = async () => {
    if (!ajuste.cantidad) return;
    await stockAPI.ajustarStock(selected.id, { cantidad: parseFloat(ajuste.cantidad), motivo: ajuste.motivo });
    setModal(null);
    cargar();
  };

  const eliminarProducto = async (p) => {
    if (!confirm(`¿Desactivar "${p.nombre}"? No aparecerá más en la lista.`)) return;
    try {
      await stockAPI.eliminarProducto(p.id);
      cargar();
    } catch (e) {
      alert(e.response?.data?.detail || "Error al eliminar");
    }
  };

  const crearCategoria = async () => {
    if (!catNombre.trim()) return;
    await stockAPI.crearCategoria({ nombre: catNombre });
    setCatNombre("");
    cargar();
  };

  const eliminarCategoria = async (cat) => {
    if (!confirm(`¿Eliminar categoría "${cat.nombre}"?`)) return;
    try {
      await stockAPI.eliminarCategoria(cat.id);
      cargar();
    } catch (e) {
      alert(e.response?.data?.detail || "Error al eliminar");
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Stock</h2>
          <p className="page-sub">{productos.length} productos · {alertas.length} alertas de stock bajo</p>
        </div>
        <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
          <button className="btn btn-ghost" onClick={() => setModal("categorias")}>Categorías</button>
          <button className="btn btn-primary" onClick={abrirNuevo}>
            <Plus size={16} /> <span className="btn-label">Nuevo producto</span>
          </button>
        </div>
      </div>

      {alertas.length > 0 && (
        <div className="alert-banner alert-warning mb-4">
          <AlertTriangle size={16} />
          <span>
            <b>{alertas.length} producto{alertas.length > 1 ? "s" : ""}</b> con stock bajo o agotado:{" "}
            {alertas.map((a) => a.nombre).join(", ")}
          </span>
        </div>
      )}

      <div className="flex gap-4 mb-6" style={{ flexWrap: "wrap" }}>
        <select className="form-select" style={{ width: 200, minWidth: 0 }} value={filtro.categoria} onChange={(e) => setFiltro((p) => ({ ...p, categoria: e.target.value }))}>
          <option value="">Todas las categorías</option>
          {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <label className="flex items-center gap-2" style={{ cursor: "pointer", fontSize: "0.875rem", color: "var(--text2)" }}>
          <input type="checkbox" checked={filtro.bajStock} onChange={(e) => setFiltro((p) => ({ ...p, bajStock: e.target.checked }))} />
          Solo stock bajo
        </label>
      </div>

      {/* Tabla desktop */}
      <div className="table-wrap hide-mobile">
        <table>
          <thead>
            <tr><th>Producto</th><th>SKU</th><th>Categoría</th><th>Tipo</th><th>P. venta</th><th>P. costo</th><th>Stock</th><th>Estado</th><th>Vence</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {productos.length === 0 && <tr><td colSpan={10} className="text-center text-muted" style={{ padding: 32 }}>Sin productos</td></tr>}
            {productos.map((p) => {
              const bajStock = parseFloat(p.stock_actual) <= parseFloat(p.stock_minimo);
              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {p.imagen_url ? (
                        <img src={p.imagen_url} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "var(--text3)" }}>
                          <Image size={16} />
                        </div>
                      )}
                      <span style={{ fontWeight: 500 }}>{p.nombre}</span>
                    </div>
                  </td>
                  <td>
                    {p.codigo
                      ? <span className="font-mono" style={{ fontSize: "0.8rem", background: "var(--bg3)", padding: "2px 6px", borderRadius: 4, border: "1px solid var(--border)" }}>{p.codigo}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="text-muted">{p.categoria?.nombre || "—"}</td>
                  <td>{p.tipo_vino ? <span className="badge badge-info">{p.tipo_vino}</span> : "—"}</td>
                  <td className="money text-success">{fmt(p.precio_venta)}</td>
                  <td className="money text-muted">{p.precio_costo ? fmt(p.precio_costo) : "—"}</td>
                  <td style={{ fontWeight: 700, color: bajStock ? "var(--danger)" : "var(--success)" }}>{parseFloat(p.stock_actual)} {p.unidad}</td>
                  <td>{bajStock ? <span className="badge badge-danger">Bajo</span> : <span className="badge badge-success">OK</span>}</td>
                  <td>{(() => {
                    const dias = diasParaVencer(p.fecha_vencimiento);
                    if (dias === null) return <span className="text-muted">—</span>;
                    if (dias <= 0) return <span className="badge badge-danger">VENCIDO</span>;
                    if (dias <= 7) return <span className="badge badge-danger">{dias}d</span>;
                    if (dias <= 30) return <span className="badge badge-warning">{dias}d</span>;
                    return <span className="text-muted" style={{ fontSize: "0.8rem" }}>{new Date(p.fecha_vencimiento).toLocaleDateString("es-AR")}</span>;
                  })()}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm" title="Ajustar stock" onClick={() => abrirAjuste(p)}><TrendingUp size={13} /></button>
                      <button className="btn btn-ghost btn-sm" title="Editar" onClick={() => abrirEditar(p)}><Edit2 size={13} /></button>
                      <button className="btn btn-danger btn-sm" title="Desactivar" onClick={() => eliminarProducto(p)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="mobile-cards show-mobile">
        {productos.length === 0 && <p className="text-center text-muted" style={{ padding: 32 }}>Sin productos</p>}
        {productos.map((p) => {
          const bajStock = parseFloat(p.stock_actual) <= parseFloat(p.stock_minimo);
          return (
            <div key={p.id} className="card card-sm mb-3">
              <div className="flex justify-between items-center mb-2">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 6 }} />
                  ) : null}
                  <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                </div>
                {bajStock ? <span className="badge badge-danger">Bajo stock</span> : <span className="badge badge-success">OK</span>}
              </div>
              <div className="grid-2" style={{ fontSize: "0.8rem", marginBottom: 8, gap: 4 }}>
                <span className="text-muted">Venta: <span className="text-success money">{fmt(p.precio_venta)}</span></span>
                <span className="text-muted">Stock: <b style={{ color: bajStock ? "var(--danger)" : "var(--success)" }}>{parseFloat(p.stock_actual)}</b> {p.unidad}</span>
              </div>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => abrirAjuste(p)}><TrendingUp size={13} /> Ajuste</button>
                <button className="btn btn-ghost btn-sm" onClick={() => abrirEditar(p)}><Edit2 size={13} /></button>
                <button className="btn btn-danger btn-sm" onClick={() => eliminarProducto(p)}><Trash2 size={13} /></button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal nuevo/editar */}
      <Modal open={modal === "nuevo" || modal === "editar"} onClose={cerrarModal} title={modal === "nuevo" ? "Nuevo producto" : "Editar producto"}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Nombre *</label>
              <input className="form-input" value={form.nombre || ""} onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">SKU / Código de barras</label>
              <input
                className="form-input font-mono"
                placeholder="ej: 7790001234567"
                value={form.codigo || ""}
                onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value.trim() || null }))}
              />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Categoría</label>
              <select className="form-select" value={form.categoria_id || ""} onChange={(e) => setForm((p) => ({ ...p, categoria_id: e.target.value }))}>
                <option value="">Sin categoría</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Tipo de vino</label>
              <select className="form-select" value={form.tipo_vino || ""} onChange={(e) => setForm((p) => ({ ...p, tipo_vino: e.target.value }))}>
                <option value="">N/A</option>
                {TIPOS_VINO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Precio venta</label>
              <input type="number" className="form-input" value={form.precio_venta || ""} onChange={(e) => setForm((p) => ({ ...p, precio_venta: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Precio costo</label>
              <input type="number" className="form-input" value={form.precio_costo || ""} onChange={(e) => setForm((p) => ({ ...p, precio_costo: e.target.value }))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Stock actual</label>
              <input type="number" className="form-input" value={form.stock_actual || ""} onChange={(e) => setForm((p) => ({ ...p, stock_actual: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Stock mínimo</label>
              <input type="number" className="form-input" value={form.stock_minimo || ""} onChange={(e) => setForm((p) => ({ ...p, stock_minimo: e.target.value }))} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Unidad</label>
              <select className="form-select" value={form.unidad || "unidad"} onChange={(e) => setForm((p) => ({ ...p, unidad: e.target.value }))}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Fecha de vencimiento</label>
              <input type="date" className="form-input" value={form.fecha_vencimiento || ""} onChange={(e) => setForm((p) => ({ ...p, fecha_vencimiento: e.target.value || null }))} />
            </div>
          </div>
          <hr className="divider" />
          <h4 style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text2)", marginBottom: 4 }}>Asesor de vinos (opcional)</h4>
          <div className="form-group">
            <label className="form-label">Notas de sabor</label>
            <textarea className="form-input" rows={2} placeholder="Ej: Frutal, con notas de cereza y vainilla, taninos suaves..." value={form.nota_sabor || ""} onChange={(e) => setForm((p) => ({ ...p, nota_sabor: e.target.value }))} style={{ resize: "vertical" }} />
          </div>
          <div className="form-group">
            <label className="form-label">Maridaje (comidas)</label>
            <textarea className="form-input" rows={2} placeholder="Ej: Carnes rojas, pastas con salsa, quesos duros, asado..." value={form.maridaje || ""} onChange={(e) => setForm((p) => ({ ...p, maridaje: e.target.value }))} style={{ resize: "vertical" }} />
          </div>
          <div className="form-group">
            <label className="form-label">Ocasión ideal</label>
            <textarea className="form-input" rows={2} placeholder="Ej: Cena romántica, reunión de amigos, asado familiar, regalo..." value={form.ocasion || ""} onChange={(e) => setForm((p) => ({ ...p, ocasion: e.target.value }))} style={{ resize: "vertical" }} />
          </div>

          <hr className="divider" />
          <div className="form-group">
            <label className="form-label">Imagen del producto</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {form.imagen_url ? (
                <img src={form.imagen_url} alt="Producto" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: "var(--radius-sm)", border: "1px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text3)" }}>
                  <Image size={24} />
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingImg(true);
                  try {
                    const url = await uploadToCloudinary(file);
                    setForm((p) => ({ ...p, imagen_url: url }));
                  } catch { alert("Error al subir imagen"); }
                  finally { setUploadingImg(false); }
                }} />
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingImg}>
                  <Upload size={14} /> {uploadingImg ? "Subiendo..." : "Subir foto"}
                </button>
                {form.imagen_url && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ color: "var(--danger)", fontSize: "0.75rem" }} onClick={() => setForm((p) => ({ ...p, imagen_url: "" }))}>
                    Quitar foto
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
          <button className="btn btn-primary" onClick={guardar} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
        </div>
      </Modal>

      {/* Modal ajuste stock */}
      <Modal open={modal === "ajuste" && !!selected} onClose={cerrarModal} title="Ajuste de stock">
        {selected && (
          <>
            <p className="text-muted" style={{ marginBottom: 20, fontSize: "0.9rem" }}>
              <b>{selected.nombre}</b> · Stock actual: <b>{parseFloat(selected.stock_actual)} {selected.unidad}</b>
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Cantidad (+entrada / -salida)</label>
                <input type="number" className="form-input" placeholder="ej: +50 o -10" value={ajuste.cantidad} onChange={(e) => setAjuste((p) => ({ ...p, cantidad: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Motivo (opcional)</label>
                <input className="form-input" placeholder="ej: Compra a proveedor" value={ajuste.motivo} onChange={(e) => setAjuste((p) => ({ ...p, motivo: e.target.value }))} />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
              <button className="btn btn-primary" onClick={guardarAjuste}>Confirmar ajuste</button>
            </div>
          </>
        )}
      </Modal>

      {/* Modal categorías */}
      <Modal open={modal === "categorias"} onClose={cerrarModal} title="Gestionar categorías">
        <div className="flex gap-2 mb-4">
          <input className="form-input" placeholder="Nueva categoría..." value={catNombre} onChange={(e) => setCatNombre(e.target.value)} onKeyDown={(e) => e.key === "Enter" && crearCategoria()} />
          <button className="btn btn-primary btn-sm" onClick={crearCategoria}><Plus size={14} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {categorias.map((cat) => (
            <div key={cat.id} className="flex justify-between items-center" style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: "0.9rem" }}>{cat.nombre}</span>
              <button className="btn btn-danger btn-sm" onClick={() => eliminarCategoria(cat)}><Trash2 size={12} /></button>
            </div>
          ))}
          {categorias.length === 0 && <p className="text-muted" style={{ fontSize: "0.875rem" }}>Sin categorías</p>}
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={cerrarModal}>Cerrar</button>
        </div>
      </Modal>
    </div>
  );
}
