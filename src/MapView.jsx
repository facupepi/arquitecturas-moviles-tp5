import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { money } from "./platform.web";

export default function LocalMap({ items, selected, onSelect, user }) {
  const container = useRef(null),
    map = useRef(null),
    layers = useRef(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    const instance = L.map(container.current, {
      scrollWheelZoom: false,
    }).setView([-31.429, -62.082], items.some((item) => item.path) ? 16 : 14);
    map.current = instance;
    const tiles = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>',
      },
    ).addTo(instance);
    tiles.on("tileerror", () => setTileError(true));
    tiles.on("tileload", () => setTileError(false));
    instance.setMinZoom(3);
    layers.current = L.layerGroup().addTo(instance);
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      instance.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!layers.current) return;
    layers.current.clearLayers();
    for (const point of items) {
      const color = point.active
        ? "#b52f26"
        : selected === point.id
          ? "#f07e07"
          : "#0077ae";
      if (point.path)
        L.polyline(point.path, {
          color,
          weight: selected === point.id ? 11 : 7,
          opacity: 0.7,
        })
          .on("click", () => onSelect(point.id))
          .addTo(layers.current);
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: selected === point.id ? 12 : 9,
        color: "#fff",
        weight: 3,
        fillColor: color,
        fillOpacity: 1,
      }).addTo(layers.current);
      const tooltip = document.createElement("span");
      tooltip.textContent = point.name;
      marker.bindTooltip(tooltip, { direction: "top" });
      // API fields are text nodes, never executable popup HTML.
      const popup = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = point.name;
      popup.append(title);
      const details = [
        point.address || point.landmark,
        point.description,
        point.bikes !== undefined
          ? `${point.bikes} bicicletas, ${point.capacity - point.bikes} anclajes libres`
          : null,
        point.active !== undefined
          ? point.active
            ? "Activada"
            : "Desactivada"
          : null,
        point.rate !== undefined
          ? `${money(point.rate)} por hora, ${point.schedule}`
          : null,
      ].filter(Boolean);
      for (const detail of details) {
        const line = document.createElement("p");
        line.textContent = detail;
        popup.append(line);
      }
      marker.bindPopup(popup);
      marker.on("click", () => onSelect(point.id));
    }
    if (user)
      L.circleMarker([user.lat, user.lng], {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: "#3264da",
        fillOpacity: 1,
      })
        .bindTooltip("Tu ubicación")
        .addTo(layers.current);
  }, [items, selected, onSelect, user]);
  useEffect(() => {
    const point = items.find((item) => item.id === selected);
    if (point) map.current?.panTo([point.lat, point.lng]);
  }, [selected]);
  const current = items.find((item) => item.id === selected);
  return (
    <div className="map-frame">
      <div
        ref={container}
        className="local-map"
        role="region"
        aria-label="Mapa de San Francisco, Córdoba"
      />
      <div className="map-overlay">
        <strong>San Francisco, Córdoba</strong>
        <span>
          {items.some((item) => item.path)
            ? "Tramos de estacionamiento"
            : "Ubicaciones y disponibilidad"}
        </span>
      </div>
      <div className="map-selection">
        <span className="map-selection-dot" />
        <span>{current?.name || "Seleccioná un punto en el mapa"}</span>
      </div>
      {tileError && (
        <div className="map-network" role="status">
          No se pudo cargar parte del mapa. Revisá tu conexión a internet.
        </div>
      )}
    </div>
  );
}
