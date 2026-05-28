import { useState, useEffect } from "react";
import { stockAPI } from "../api";
import { Search, Wine, Utensils, PartyPopper, Star, Loader, X, Filter } from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

const TIPOS_VINO = [
  { value: "", label: "Todos", icon: "🍷" },
  { value: "tinto", label: "Tinto", icon: "🍷" },
  { value: "blanco", label: "Blanco", icon: "🥂" },
  { value: "rosado", label: "Rosado", icon: "🌸" },
  { value: "espumante", label: "Espumante", icon: "🍾" },
  { value: "dulce", label: "Dulce", icon: "🍯" },
];

const SUGERENCIAS = [
  { text: "asado", icon: "🥩", label: "Asado" },
  { text: "pasta", icon: "🍝", label: "Pastas" },
  { text: "pescado", icon: "🐟", label: "Pescado" },
  { text: "queso", icon: "🧀", label: "Quesos" },
  { text: "postre", icon: "🍰", label: "Postres" },
  { text: "pizza", icon: "🍕", label: "Pizza" },
  { text: "regalo", icon: "🎁", label: "Regalo" },
  { text: "romantica", icon: "💕", label: "Cena" },
  { text: "amigos", icon: "🎉", label: "Amigos" },
  { text: "suave", icon: "🌿", label: "Suave" },
];

export default function Asesor() {
  const [query, setQuery] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [resultados, setResultados] = useState([]);
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buscando, setBuscando] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(() => {
    stockAPI.productos({ activo: true }).then((r) => {
      setTodos(r.data);
      setResultados(r.data.filter((p) => p.nota_sabor || p.maridaje || p.ocasion));
      setLoading(false);
    });
  }, []);

  const buscar = async (texto, tipo) => {
    const q = texto || query;
    const t = tipo !== undefined ? tipo : tipoFiltro;

    if (!q && !t) {
      setResultados(todos.filter((p) => p.nota_sabor || p.maridaje || p.ocasion));
      return;
    }

    setBuscando(true);
    try {
      const params = {};
      if (q) params.q = q;
      if (t) params.tipo_vino = t;
      const r = await stockAPI.recomendar(params);
      setResultados(r.data);
    } finally {
      setBuscando(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    buscar();
  };

  const handleSugerencia = (texto) => {
    setQuery(texto);
    buscar(texto);
  };

  const handleTipoChange = (tipo) => {
    setTipoFiltro(tipo);
    buscar(query, tipo);
  };

  const conInfo = resultados.filter((p) => p.nota_sabor || p.maridaje || p.ocasion);
  const sinInfo = resultados.filter((p) => !p.nota_sabor && !p.maridaje && !p.ocasion);

  return (
    <div className="asesor-page">
      {/* Hero */}
      <div className="asesor-hero">
        <div className="asesor-hero-content">
          <h2 className="asesor-title">Asesor de Vinos</h2>
          <p className="asesor-subtitle">
            Encontrá el vino perfecto para cada momento, comida u ocasión
          </p>

          {/* Search */}
          <form className="asesor-search" onSubmit={handleSearch}>
            <Search size={18} className="asesor-search-icon" />
            <input
              className="asesor-search-input"
              placeholder="¿Qué estás buscando? Ej: asado, cena romántica, frutal..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" className="asesor-search-clear" onClick={() => { setQuery(""); buscar(""); }}>
                <X size={16} />
              </button>
            )}
            <button type="submit" className="btn btn-primary">Buscar</button>
          </form>

          {/* Quick suggestions */}
          <div className="asesor-suggestions">
            {SUGERENCIAS.map((s) => (
              <button
                key={s.text}
                className={`asesor-chip ${query === s.text ? "active" : ""}`}
                onClick={() => handleSugerencia(s.text)}
              >
                <span>{s.icon}</span> {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filtro tipo */}
      <div className="asesor-tipo-bar">
        {TIPOS_VINO.map((t) => (
          <button
            key={t.value}
            className={`asesor-tipo-btn ${tipoFiltro === t.value ? "active" : ""}`}
            onClick={() => handleTipoChange(t.value)}
          >
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="asesor-loading"><Loader size={28} className="spin" /></div>
      ) : (
        <>
          <div className="asesor-results-header">
            <span>{resultados.length} producto{resultados.length !== 1 ? "s" : ""} encontrado{resultados.length !== 1 ? "s" : ""}</span>
            {buscando && <Loader size={14} className="spin" />}
          </div>

          {resultados.length === 0 ? (
            <div className="asesor-empty">
              <Wine size={40} />
              <h3>Sin resultados</h3>
              <p>Probá con otros términos o quitá los filtros</p>
            </div>
          ) : (
            <>
              {/* Products with info */}
              {conInfo.length > 0 && (
                <div className="asesor-grid">
                  {conInfo.map((p) => (
                    <div key={p.id} className="asesor-card" onClick={() => setSelectedProduct(p.id === selectedProduct ? null : p.id)}>
                      <div className="asesor-card-top">
                        {p.imagen_url ? (
                          <img src={p.imagen_url} alt="" className="asesor-card-img" />
                        ) : (
                          <div className="asesor-card-img-placeholder"><Wine size={28} /></div>
                        )}
                        <div className="asesor-card-info">
                          <h4 className="asesor-card-name">{p.nombre}</h4>
                          <div className="asesor-card-meta">
                            {p.tipo_vino && <span className="badge badge-info">{p.tipo_vino}</span>}
                            {p.categoria?.nombre && <span className="badge badge-primary">{p.categoria.nombre}</span>}
                          </div>
                          <span className="asesor-card-price">{fmt(p.precio_venta)}</span>
                        </div>
                      </div>

                      <div className={`asesor-card-details ${selectedProduct === p.id ? "open" : ""}`}>
                        {p.nota_sabor && (
                          <div className="asesor-detail-row">
                            <div className="asesor-detail-icon"><Star size={14} /></div>
                            <div>
                              <span className="asesor-detail-label">Sabor</span>
                              <p className="asesor-detail-text">{p.nota_sabor}</p>
                            </div>
                          </div>
                        )}
                        {p.maridaje && (
                          <div className="asesor-detail-row">
                            <div className="asesor-detail-icon"><Utensils size={14} /></div>
                            <div>
                              <span className="asesor-detail-label">Maridaje</span>
                              <p className="asesor-detail-text">{p.maridaje}</p>
                            </div>
                          </div>
                        )}
                        {p.ocasion && (
                          <div className="asesor-detail-row">
                            <div className="asesor-detail-icon"><PartyPopper size={14} /></div>
                            <div>
                              <span className="asesor-detail-label">Ocasión</span>
                              <p className="asesor-detail-text">{p.ocasion}</p>
                            </div>
                          </div>
                        )}
                      </div>

                      {(p.nota_sabor || p.maridaje || p.ocasion) && (
                        <button className="asesor-card-toggle">
                          {selectedProduct === p.id ? "Menos info" : "Ver detalles"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Products without info */}
              {sinInfo.length > 0 && query && (
                <div style={{ marginTop: 24 }}>
                  <h4 style={{ fontSize: "0.85rem", color: "var(--text3)", marginBottom: 12 }}>
                    Otros resultados (sin información de asesor)
                  </h4>
                  <div className="asesor-grid-simple">
                    {sinInfo.map((p) => (
                      <div key={p.id} className="asesor-simple-card">
                        {p.imagen_url ? (
                          <img src={p.imagen_url} alt="" className="asesor-simple-img" />
                        ) : (
                          <div className="asesor-simple-placeholder"><Wine size={16} /></div>
                        )}
                        <div>
                          <span className="asesor-simple-name">{p.nombre}</span>
                          <span className="asesor-simple-price">{fmt(p.precio_venta)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
