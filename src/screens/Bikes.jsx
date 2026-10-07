import React, { useState, useEffect } from "react";
import { Search, Navigation } from "../icons";
import { Button, Tag, Card, Heading } from "../components";
import { locate } from "../platform.web";
import LocalMap from "../MapView";
import { distanceKm } from "../../server/domain.mjs";
export default function Bikes({ data, vm, report }) {
  const [selected, setSelected] = useState("b1"),
    [position, setPosition] = useState(null),
    [query, setQuery] = useState(""),
    [locating, setLocating] = useState(false);
  const items = data.stations
    .filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    .map((s) => ({ ...s, distance: position ? distanceKm(position, s) : null }))
    .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  return (
    <>
      <Heading
        title="La ciudad, sobre dos ruedas."
        description="Elegí una estación y consultá su disponibilidad."
        action={
          <Button
            icon={Navigation}
            disabled={locating}
            onPress={async () => {
              setLocating(true);
              try {
                const location = await locate();
                setPosition(location);
                vm.setPosition(location);
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
        items={data.stations}
        selected={selected}
        onSelect={setSelected}
        user={position}
      />
      <div className="section-line">
        <h2>Estaciones {position ? "por cercanía" : ""}</h2>
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Buscar estación"
            placeholder="Buscar estación"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="two-grid">
        {items.map((st) => (
          <Card key={st.id}>
            <div className="row-between">
              <h3>{st.name}</h3>
              <Tag tone={st.bikes ? "green" : "amber"}>
                {st.bikes ? "Disponible" : "Sin bicicletas"}
              </Tag>
            </div>
            <p className="muted">
              {st.zone}
              {st.distance !== null
                ? `, ${st.distance.toFixed(1)} km de tu ubicación`
                : ""}
            </p>
            <div className="station-counts">
              <strong>
                {st.bikes}
                <span>bicicletas</span>
              </strong>
              <strong>
                {st.capacity - st.bikes}
                <span>anclajes libres</span>
              </strong>
            </div>
            <div className="actions">
              <Button light onPress={() => setSelected(st.id)}>
                Ver en mapa
              </Button>
              <Button light onPress={() => report(st.name)}>
                Reportar problema
              </Button>
            </div>
            <button
              className="text-link small"
              disabled={vm.busy}
              onClick={() => vm.refresh()}
            >
              Actualizar disponibilidad
            </button>
          </Card>
        ))}
      </div>
      {!items.length && <p>No se encontraron estaciones.</p>}
    </>
  );
}
