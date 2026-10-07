import React, { useEffect, useRef } from "react";
import {
  Bell,
  Menu,
  Phone,
  MessageSquare,
  ArrowUpRight,
  ChevronRight,
  X,
} from "./icons";
import { nav } from "./services";

const portal = "https://www.sanfrancisco.gov.ar/";
const tana = "https://wa.me/5493564336062";

export function MunicipalHeader({
  unread,
  open,
  onMenu,
  onNotifications,
  go,
  user,
  onSignOut,
}) {
  const account = useRef(null);
  useEffect(() => {
    const closeOutside = (event) => {
      if (!account.current?.contains(event.target))
        account.current?.removeAttribute("open");
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  return (
    <header className="municipal-header">
      <div className="topbar">
        <button
          className="menu-button icon-button"
          aria-label="Abrir menú"
          aria-expanded={open}
          aria-controls="municipal-navigation"
          onClick={onMenu}
        >
          <Menu size={24} />
        </button>
        <a
          className="municipal-brand"
          href="#inicio"
          aria-label="San Francisco Conecta, ir al inicio"
          onClick={(event) => {
            event.preventDefault();
            go("inicio");
          }}
        >
          <span className="institutional-logo">
            <img
              src="/brand/municipalidad-blanco.png"
              alt="Municipalidad de San Francisco"
              width="164"
              height="96"
            />
          </span>
          <span className="brand-wordmark">
            <strong>Conecta</strong>
            <span>San Francisco</span>
          </span>
        </a>
        <div className="header-services">
          <a className="header-help" href="tel:147">
            <Phone size={18} aria-hidden="true" />
            <span>Atención 147</span>
          </a>
          <button
            className="notification-button icon-button"
            aria-label={
              unread > 0
                ? `Ver notificaciones, ${unread} sin leer`
                : "Ver notificaciones"
            }
            onClick={onNotifications}
          >
            <Bell size={23} />
            {unread > 0 && (
              <b aria-hidden="true">{unread > 9 ? "9+" : unread}</b>
            )}
          </button>
          <details
            ref={account}
            className="account-menu"
            onKeyDown={(event) => {
              if (event.key === "Escape" && event.currentTarget.open) {
                event.preventDefault();
                event.stopPropagation();
                event.currentTarget.removeAttribute("open");
                event.currentTarget.querySelector("summary")?.focus();
              }
            }}
          >
            <summary aria-label={`Mi cuenta, ${user?.displayName || "vecino"}`}>
              <span className="account-avatar" aria-hidden="true">
                {(user?.displayName || "V").slice(0, 1)}
              </span>
              <span className="account-caption">
                <strong>
                  {user?.displayName?.split(" ")[0] || "Mi cuenta"}
                </strong>
                <span>Mi cuenta</span>
              </span>
              <ChevronRight
                className="account-chevron"
                size={18}
                aria-hidden="true"
              />
            </summary>
            <div>
              <strong>{user?.displayName || "Vecino"}</strong>
              <span>{user?.email}</span>
              <button onClick={onSignOut}>Cerrar sesión</button>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}

export function MunicipalSidebar({
  page,
  unread,
  open,
  narrow,
  onClose,
  go,
  panelRef,
  user,
  onSignOut,
}) {
  return (
    <aside
      id="municipal-navigation"
      ref={panelRef}
      className={`sidebar ${open ? "open" : ""}`}
      role={open ? "dialog" : undefined}
      aria-modal={open ? "true" : undefined}
      aria-label="Menú de servicios"
      aria-hidden={narrow && !open ? true : undefined}
    >
      <div className="sidebar-heading">
        <div>
          <strong>Tus servicios</strong>
          <span>Todo en un solo lugar</span>
        </div>
        <button
          className="drawer-close icon-button"
          aria-label="Cerrar menú"
          onClick={onClose}
        >
          <X size={24} />
        </button>
      </div>
      <nav aria-label="Navegación principal">
        {nav.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${page === item.id ? "active" : ""}`}
            aria-current={page === item.id ? "page" : undefined}
            onClick={() => go(item.id)}
          >
            <item.icon size={22} aria-hidden="true" />
            <span>{item.short || item.name}</span>
            {item.id === "notificaciones" && unread > 0 && (
              <span className="count">{unread}</span>
            )}
          </button>
        ))}
      </nav>
      <a className="sidebar-help" href="tel:147">
        <Phone size={25} aria-hidden="true" />
        <span>
          <strong>147</strong>
          <span>Atención al vecino</span>
        </span>
        <ArrowUpRight size={18} aria-hidden="true" />
      </a>
      <div className="sidebar-account">
        <span>{user?.displayName || "Mi cuenta"}</span>
        <button onClick={onSignOut}>Cerrar sesión</button>
      </div>
    </aside>
  );
}

export function MunicipalFooter({ go }) {
  const localLink = (id, label) => (
    <a
      href={`#${id}`}
      onClick={(event) => {
        event.preventDefault();
        go(id);
      }}
    >
      {label}
    </a>
  );
  return (
    <footer className="municipal-footer">
      <div className="footer-inner">
        <div className="footer-help">
          <div>
            <h2>Estamos cerca.</h2>
            <p>Encontrá el canal de atención que necesitás.</p>
          </div>
          <a
            className="footer-tana"
            href={tana}
            target="_blank"
            rel="noreferrer"
          >
            <MessageSquare size={21} aria-hidden="true" /> Hablá con Tana{" "}
            <ArrowUpRight size={18} aria-hidden="true" />
          </a>
        </div>
        <div className="footer-grid">
          <div className="footer-column">
            <h3>Servicios al vecino</h3>
            <div>
              {localLink("bicicletas", "Bicicletas públicas")}
              {localLink("tributos", "Mis tributos")}
              {localLink("reclamos", "Centro de reclamos")}
              {localLink("estacionamiento", "Estacionamiento")}
            </div>
          </div>
          <div className="footer-column">
            <h3>Tu ciudad</h3>
            <div>
              {localLink("alarmas", "Alarmas comunitarias")}
              {localLink("notificaciones", "Avisos y novedades")}
              {localLink("contactos", "Líneas de atención")}
              <a href={portal} target="_blank" rel="noreferrer">
                Portal municipal <ArrowUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          </div>
          <div className="footer-column">
            <h3>Contacto municipal</h3>
            <address>
              Bv. 9 de Julio 1187
              <br />
              San Francisco, Córdoba<a href="tel:+543564439111">03564 439111</a>
              <a href="tel:147">147, Atención ciudadana</a>
            </address>
            <a
              href="https://www.sanfrancisco.gov.ar/contenidos/telefonos-utiles-355"
              target="_blank"
              rel="noreferrer"
            >
              Teléfonos útiles <ArrowUpRight size={15} aria-hidden="true" />
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-identity">
            <img
              src="/brand/municipalidad-blanco.png"
              alt="Municipalidad de San Francisco"
              width="132"
              height="77"
            />
            <span>
              San Francisco Conecta
              <br />
              <span>Servicios al vecino</span>
            </span>
          </div>
          <nav aria-label="Redes del municipio">
            <a
              href="https://www.facebook.com/municipalidaddesanfrancisco/"
              target="_blank"
              rel="noreferrer"
            >
              Facebook
            </a>
            <a
              href="https://www.instagram.com/municipalidaddesanfrancisco/"
              target="_blank"
              rel="noreferrer"
            >
              Instagram
            </a>
            <a
              href="https://www.youtube.com/@SanFcoTeVe"
              target="_blank"
              rel="noreferrer"
            >
              YouTube
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
