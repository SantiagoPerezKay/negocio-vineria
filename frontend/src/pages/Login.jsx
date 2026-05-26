import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Loader, Lock, User } from "lucide-react";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err.response?.data?.detail || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🍷</div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
            Sistema Vinería
          </h1>
          <p className="text-muted" style={{ fontSize: "0.875rem", marginTop: 4 }}>
            Ingresá tus credenciales para continuar
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Usuario</label>
              <div style={{ position: "relative" }}>
                <User size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text3)" }} />
                <input
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  placeholder="tu_usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Contraseña</label>
              <div style={{ position: "relative" }}>
                <Lock size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text3)" }} />
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: 36 }}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div style={{
                background: "var(--danger-bg)", border: "1px solid var(--danger)",
                borderRadius: "var(--radius-sm)", padding: "10px 14px",
                fontSize: "0.85rem", color: "var(--danger)",
              }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary w-full" type="submit" disabled={loading} style={{ marginTop: 4, padding: "12px 18px" }}>
              {loading ? <Loader size={16} className="spin" /> : <Lock size={16} />}
              Ingresar
            </button>
          </form>
        </div>

        <p className="text-muted" style={{ textAlign: "center", marginTop: 16, fontSize: "0.75rem" }}>
          Usuario por defecto: <b>admin</b> / <b>admin123</b>
        </p>
      </div>
    </div>
  );
}
