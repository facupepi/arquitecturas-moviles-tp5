import React, { useState, useEffect } from "react";
import { Check, Navigation } from "../icons";
import { Button, Tag, Card, Heading } from "../components";
import { locate } from "../platform.web";
import LocalMap from "../MapView";
export default function Alarms({ data, vm }) {
  const [selected, setSelected] = useState("a1"),
    [position, setPosition] = useState(null),
    [locating, setLocating] = useState(false);
  return (
    <>
      <Heading
        title="Conectados con tu barrio."
        description="Estado de las alarmas y suscripciones por zona."
        action={
          <Button
            light
            icon={Navigation}
            disabled={locating}
            onPress={async () => {
              setLocating(true);
              try {
                const location = await locate();
                setPosition(location);
                vm.setPosition(location);
                vm.setToast(
                  "Avisos de alarmas habilitados a un kilómetro de tu ubicación",
                );
              } catch (e) {
                vm.setError(e.message);
              } finally {
                setLocating(false);
              }
            }}
          >
            {locating ? "Buscando…" : "Usar mi ubicación"}
          </Button>
        }
      />
      <LocalMap
        items={data.alarms}
        selected={selected}
        onSelect={setSelected}
        user={position}
      />
      <div className="section-line">
        <h2>Zonas que seguís</h2>
      </div>
      <div className="chips">
        {["Centro", "Parque", "Norte", "Sur"].map((z) => (
          <button
            key={z}
            className={data.preferences.zones.includes(z) ? "selected" : ""}
            disabled={vm.busy}
            onClick={() =>
              vm.act(
                "/preferences",
                {
                  ...data.preferences,
                  zones: data.preferences.zones.includes(z)
                    ? data.preferences.zones.filter((x) => x !== z)
                    : [...data.preferences.zones, z],
                },
                "Suscripción actualizada",
              )
            }
          >
            {data.preferences.zones.includes(z) && <Check size={15} />} {z}
          </button>
        ))}
      </div>
      <div className="two-grid">
        {data.alarms.map((a) => (
          <Card key={a.id}>
            <div className="row-between">
              <h3>{a.name}</h3>
              <Tag tone={a.active ? "red" : "green"}>
                {a.active ? "Activada" : "Desactivada"}
              </Tag>
            </div>
            <p className="muted">Zona {a.zone}, Actualización reciente</p>
            <div className="actions">
              <Button light onPress={() => setSelected(a.id)}>
                Ver en mapa
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <p className="footnote">
        Recibís avisos de las zonas que seguís y, al usar tu ubicación, de las
        alarmas a menos de un kilómetro.
      </p>
    </>
  );
}
