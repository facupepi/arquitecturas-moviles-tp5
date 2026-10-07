import React, { useState, useEffect } from "react";
import {
  observeSession,
  loginGoogle,
  logout,
  completeRedirect,
  authMessage,
} from "./firebase";
import { Bike, ReceiptText, MessageSquare, Bell } from "./icons";
export default function AuthGate({ children }) {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    completeRedirect().catch((e) => setError(authMessage(e)));
    return observeSession((value) => {
      setUser(value);
      setReady(true);
      setBusy(false);
    });
  }, []);
  if (ready && user)
    return children(user, async () => {
      try {
        await (await import("./push")).disablePush();
      } catch {
        // El cierre de la sesión no depende de la disponibilidad del canal push.
      } finally {
        await logout();
      }
    });
  return (
    <div className="auth-page">
      <header className="auth-header">
        <a
          href="https://www.sanfrancisco.gov.ar/"
          target="_blank"
          rel="noreferrer"
        >
          <img
            src="/brand/municipalidad-blanco.png"
            width="164"
            height="96"
            alt="Municipalidad de San Francisco"
          />
        </a>
        <span>Conecta <span className="auth-header-caption">Servicios al vecino</span></span>
      </header>
      <main className="auth-layout">
        <section className="auth-welcome">
          <span className="eyebrow">SAN FRANCISCO, CÓRDOBA</span>
          <h1>
            Tu ciudad.
            <br />
            Tu espacio.
            <br />
            <em>Todo más cerca.</em>
          </h1>
          <p>
            Un solo lugar para tus trámites, tus recorridos y las novedades de
            tu barrio.
          </p>
          <div className="auth-benefits">
            <span>
              <Bike />
              Bicicletas y movilidad
            </span>
            <span>
              <ReceiptText />
              Tributos y estacionamiento
            </span>
            <span>
              <MessageSquare />
              Reclamos y atención
            </span>
            <span>
              <Bell />
              Avisos de tu ciudad
            </span>
          </div>
        </section>
        <section className="auth-card" aria-labelledby="login-title">
          <span className="auth-mark" aria-hidden="true">
            C
          </span>
          <h2 id="login-title">Bienvenido a Conecta</h2>
          <p>
            Ingresá con tu cuenta de Google para consultar tus servicios y
            guardar tus gestiones.
          </p>
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <button
            className="google-button"
            disabled={!ready || busy}
            onClick={async () => {
              setError("");
              setBusy(true);
              try {
                await loginGoogle();
              } catch (e) {
                setError(authMessage(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.01 46.98 31.83 46.98 24.55Z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.28-3.13.75-4.59l-7.97-6.19A23.8 23.8 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.97 6.19C6.51 42.62 14.62 48 24 48Z"
              />
            </svg>
            {!ready
              ? "Preparando el ingreso…"
              : busy
                ? "Conectando con Google…"
                : "Continuar con Google"}
          </button>
          <p className="auth-registration">
            ¿Es tu primera vez? Al ingresar con Google se crea tu cuenta
            automáticamente.
          </p>
          <div className="auth-privacy">
            <strong>Tus gestiones son personales.</strong>
            <p>
              Los reclamos, pagos y preferencias quedan asociados a tu cuenta.
              No te pedimos una contraseña adicional.
            </p>
          </div>
        </section>
      </main>
      <footer className="auth-footer">
        <span>San Francisco Conecta</span>
        <a href="tel:147">Llamá al 147 si necesitás ayuda</a>
      </footer>
    </div>
  );
}
