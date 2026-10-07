import React, { useState, useEffect, useRef } from "react";
import { ActivityIndicator } from "react-native";
import { Menu, CheckCircle2 } from "./icons";
import { useMunicipal } from "./useMunicipal";
import { nav } from "./services";
import { Confirm } from "./components";
import {
  MunicipalHeader,
  MunicipalSidebar,
  MunicipalFooter,
} from "./MunicipalChrome";
import Home from "./screens/Home";
import Bikes from "./screens/Bikes";
import Taxes from "./screens/Taxes";
import Claims from "./screens/Claims";
import Contacts from "./screens/Contacts";
import Alarms from "./screens/Alarms";
import Parking from "./screens/Parking";
import Notifications from "./screens/Notifications";

export default function MunicipalApp({ user, onSignOut }) {
  const vm = useMunicipal();
  const { data, error, busy, toast, act } = vm;
  const initial = location.hash.slice(1);
  const [page, setPage] = useState(
    nav.some((n) => n.id === initial) ? initial : "inicio",
  );
  const [mobileMenu, setMobileMenu] = useState(false);
  const [narrow, setNarrow] = useState(
    window.matchMedia("(max-width: 900px)").matches,
  );
  const [confirm, setConfirm] = useState(null);
  const [reportStation, setReportStation] = useState("");
  const sidebar = useRef(null),
    main = useRef(null),
    menuOrigin = useRef(null);
  const openMenu = (event) => {
    // Pointer activation does not focus buttons in every browser. Preserve the
    // actual trigger before the mobile tabs become inert.
    menuOrigin.current = event.currentTarget;
    setMobileMenu(true);
  };
  const go = (id) => {
    if (!nav.some((n) => n.id === id)) return;
    setPage(id);
    location.hash = id;
    setMobileMenu(false);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => main.current?.focus({ preventScroll: true }));
  };
  useEffect(() => {
    const change = () => {
      const id = location.hash.slice(1) || "inicio";
      setPage(nav.some((n) => n.id === id) ? id : "inicio");
      setMobileMenu(false);
    };
    window.addEventListener("hashchange", change);
    const query = window.matchMedia("(max-width: 900px)");
    const resize = (event) => {
      setNarrow(event.matches);
      if (!event.matches) setMobileMenu(false);
    };
    query.addEventListener("change", resize);
    return () => {
      window.removeEventListener("hashchange", change);
      query.removeEventListener("change", resize);
    };
  }, []);
  useEffect(() => {
    document.title = `${nav.find((n) => n.id === page)?.name || "Inicio"}, San Francisco Conecta`;
  }, [page]);
  useEffect(() => {
    if (!mobileMenu) return;
    const previous = menuOrigin.current || document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const controls = () =>
      [...sidebar.current.querySelectorAll("button,a[href]")].filter(
        (el) => !el.disabled,
      );
    controls()[0]?.focus();
    const keyboard = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileMenu(false);
      }
      if (event.key === "Tab") {
        const list = controls(),
          first = list[0],
          last = list.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", keyboard);
      previous?.focus({ preventScroll: true });
    };
  }, [mobileMenu]);
  const ask = (title, text, path, body) =>
    setConfirm({
      title,
      text,
      path,
      body: { ...body, requestId: crypto.randomUUID() },
    });
  const unread = data?.notifications.filter((n) => !n.read).length || 0;
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          main.current?.focus();
        }}
      >
        Ir al contenido
      </a>
      <MunicipalHeader
        unread={unread}
        open={mobileMenu}
        onMenu={openMenu}
        onNotifications={() => go("notificaciones")}
        user={user}
        onSignOut={onSignOut}
        go={go}
      />
      <MunicipalSidebar
        page={page}
        unread={unread}
        open={mobileMenu}
        narrow={narrow}
        onClose={() => setMobileMenu(false)}
        go={go}
        panelRef={sidebar}
        user={user}
        onSignOut={onSignOut}
      />
      {mobileMenu && (
        <button
          className="menu-overlay"
          tabIndex={-1}
          aria-label="Cerrar menú"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <div className="main-shell" inert={mobileMenu ? true : undefined}>
        <main id="main-content" ref={main} className="content" tabIndex={-1}>
          {error && !confirm && (
            <div className="error" role="alert">
              {error}
              <button onClick={vm.refresh}>Reintentar conexión</button>
            </div>
          )}
          {!data ? (
            <div className="loading">
              <ActivityIndicator color="#0077ae" />
              <p>Cargando tus servicios…</p>
            </div>
          ) : (
            <>
              {page === "inicio" && <Home data={data} go={go} />}
              {page === "bicicletas" && (
                <Bikes
                  data={data}
                  vm={vm}
                  report={(name) => {
                    setReportStation(name);
                    go("reclamos");
                  }}
                />
              )}
              {page === "tributos" && (
                <Taxes data={data} busy={busy} ask={ask} />
              )}
              {page === "reclamos" && (
                <Claims
                  data={data}
                  vm={vm}
                  station={reportStation}
                  clearStation={() => setReportStation("")}
                />
              )}
              {page === "contactos" && <Contacts data={data} />}
              {page === "alarmas" && <Alarms data={data} vm={vm} />}
              {page === "estacionamiento" && (
                <Parking data={data} vm={vm} ask={ask} />
              )}
              {page === "notificaciones" && (
                <Notifications data={data} vm={vm} go={go} />
              )}
            </>
          )}
        </main>
        <MunicipalFooter go={go} />
      </div>
      <nav
        className="mobile-tabs"
        aria-label="Accesos móviles"
        inert={mobileMenu ? true : undefined}
      >
        {[nav[0], nav[3], nav[6]].map((item) => (
          <button
            key={item.id}
            className={page === item.id ? "selected" : ""}
            aria-current={page === item.id ? "page" : undefined}
            onClick={() => go(item.id)}
          >
            <item.icon size={23} aria-hidden="true" />
            <span>
              {item.id === "estacionamiento"
                ? "Estacionar"
                : item.short || item.name}
            </span>
          </button>
        ))}
        <button
          aria-expanded={mobileMenu}
          aria-controls="municipal-navigation"
          onClick={openMenu}
        >
          <Menu size={23} aria-hidden="true" />
          <span>Menú</span>
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={21} />
          {toast}
        </div>
      )}
      <Confirm
        error={error}
        value={confirm}
        onClose={() => setConfirm(null)}
        busy={busy}
        onConfirm={async () => {
          const result = await act(
            confirm.path,
            { ...confirm.body, confirm: true },
            "Operación registrada",
          );
          if (result) setConfirm(null);
        }}
      />
    </div>
  );
}
