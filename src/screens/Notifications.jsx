import React, { useState, useEffect } from "react";
import { Bell, Settings2, CheckCircle2 } from "../icons";
import { Button, Select, Tag, Card, Heading } from "../components";
import { date } from "../platform.web";
import { enablePush, disablePush } from "../push";
export default function Notifications({ data, vm, go }) {
  const [filter, setFilter] = useState("Todas");
  const prefs = data.preferences;
  const save = (patch) =>
    vm.act("/preferences", { ...prefs, ...patch }, "Preferencias guardadas");
  const items = data.notifications.filter((n) => filter === "Todas" || !n.read);
  return (
    <>
      <Heading
        title="Lo que pasa en tu ciudad."
        description="Avisos, recordatorios y novedades según tus intereses."
      />
      <div className="split-layout">
        <div className="stack">
          <div className="tabs">
            {["Todas", "No leídas"].map((t) => (
              <button
                key={t}
                className={filter === t ? "selected" : ""}
                onClick={() => setFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {items.map((n) => (
            <Card key={n.id}>
              <div className="row-between">
                <Tag>
                  {n.type}, {n.zone}
                </Tag>
                <small>{date(n.createdAt)}</small>
              </div>
              <h3>
                {!n.read && <span className="unread-dot" />}
                {n.title}
              </h3>
              <p>{n.body}</p>
              <div className="actions">
                {!n.read && (
                  <Button
                    light
                    disabled={vm.busy}
                    onPress={() => vm.act("/notifications/read", { id: n.id })}
                  >
                    Marcar como leída
                  </Button>
                )}
              </div>
              <details className="notification-details">
                <summary>Ver más información</summary>
                <div className="notification-detail-body">
                  <dl>
                    <div>
                      <dt>Tipo de aviso</dt>
                      <dd>{n.type}</dd>
                    </div>
                    <div>
                      <dt>Zona</dt>
                      <dd>{n.zone}</dd>
                    </div>
                    <div>
                      <dt>Recibido</dt>
                      <dd>
                        {new Date(n.createdAt).toLocaleString("es-AR", {
                          dateStyle: "long",
                          timeStyle: "short",
                        })}
                      </dd>
                    </div>
                  </dl>
                  <p>{n.details || n.body}</p>
                  {[
                    "tributos",
                    "reclamos",
                    "estacionamiento",
                    "alarmas",
                    "bicicletas",
                  ].includes(n.target) ? (
                    <Button light onPress={() => go(n.target)}>
                      Ir al servicio relacionado
                    </Button>
                  ) : (
                    <Button
                      light
                      href={
                        n.type === "Eventos"
                          ? "https://www.sanfrancisco.gov.ar/eventos"
                          : "https://wa.me/5493564336062"
                      }
                    >
                      {n.type === "Eventos"
                        ? "Consultar agenda municipal"
                        : "Consultar con atención ciudadana"}
                    </Button>
                  )}
                </div>
              </details>
            </Card>
          ))}
          {items.length === 0 && (
            <Card>
              <CheckCircle2 />
              <h3>Estás al día.</h3>
              <p>No hay avisos pendientes de lectura.</p>
            </Card>
          )}
        </div>
        <div className="stack">
          <Card>
            <Settings2 />
            <h2>Tus preferencias</h2>
            <p className="muted">
              Elegí qué avisos querés recibir y las zonas que te interesan.
            </p>
            {[
              "Obras",
              "Servicios",
              "Eventos",
              "Alarmas",
              "Tributos",
              "Estacionamiento",
              "Reclamos",
            ].map((t) => (
              <label className="checkbox" key={t}>
                <input
                  type="checkbox"
                  checked={prefs.types.includes(t)}
                  disabled={vm.busy}
                  onChange={() =>
                    save({
                      types: prefs.types.includes(t)
                        ? prefs.types.filter((x) => x !== t)
                        : [...prefs.types, t],
                    })
                  }
                />
                {t}
              </label>
            ))}
            <h3>Zonas de interés</h3>
            {["Centro", "Parque", "Norte", "Sur"].map((z) => (
              <label className="checkbox" key={z}>
                <input
                  type="checkbox"
                  checked={prefs.zones.includes(z)}
                  disabled={vm.busy}
                  onChange={() =>
                    save({
                      zones: prefs.zones.includes(z)
                        ? prefs.zones.filter((x) => x !== z)
                        : [...prefs.zones, z],
                    })
                  }
                />
                {z}
              </label>
            ))}
            <Select
              label="Frecuencia de avisos"
              value={prefs.frequency}
              onChange={(frequency) => save({ frequency })}
              options={["Inmediata", "Solo historial"]}
            />
            <Button
              light
              disabled={vm.busy}
              icon={Bell}
              onPress={async () => {
                if (prefs.desktop) {
                  try {
                    await disablePush();
                    save({ desktop: false });
                  } catch (e) {
                    vm.setError(e.message);
                  }
                  return;
                }
                if (!("Notification" in window)) {
                  vm.setError(
                    "Este navegador no admite notificaciones de escritorio.",
                  );
                  return;
                }
                try {
                  await enablePush();
                  save({ desktop: true });
                } catch (e) {
                  vm.setError(e.message);
                }
              }}
            >
              {prefs.desktop
                ? "Desactivar avisos del navegador"
                : "Habilitar avisos del navegador"}
            </Button>
            <p className="footnote">
              Todos tus avisos quedan disponibles en este historial.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
}
