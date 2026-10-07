import React, { useState, useEffect } from "react";
import { ParkingCircle, MapPin, Plus, Clock } from "../icons";
import { Button, Field, Select, Tag, Card, Heading } from "../components";
import { money, date } from "../platform.web";
import LocalMap from "../MapView";
export default function Parking({ data, vm, ask }) {
  const [point, setPoint] = useState("p1"),
    [plate, setPlate] = useState(""),
    [duration, setDuration] = useState("60"),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const selected =
    data.parkingZones.find((z) => z.id === point) || data.parkingZones[0];
  const active = data.parking.filter((p) => Date.parse(p.endsAt) > now);
  const total = (selected.rate * Number(duration)) / 60;
  return (
    <>
      <Heading
        title="Estacionamiento medido."
        description="Elegí un punto, indicá tu patente y controlá el tiempo desde el celular."
      />
      <LocalMap
        items={data.parkingZones}
        selected={point}
        onSelect={setPoint}
      />
      <div className="split-layout">
        <Card>
          <h2>Iniciar una sesión</h2>
          <Select
            label="Punto de estacionamiento"
            value={point}
            onChange={setPoint}
            options={data.parkingZones.map((z) => ({
              value: z.id,
              label: z.name,
            }))}
          />
          <p className="muted">
            <MapPin size={14} /> {selected.address || selected.landmark}
          </p>
          <p className="muted">
            <Clock size={14} /> {selected.schedule}, {money(selected.rate)} por
            hora
          </p>
          <Field
            label="Patente"
            value={plate}
            onChange={(v) => setPlate(v.toUpperCase())}
            placeholder="AB123CD"
          />
          <Select
            label="Tiempo"
            value={duration}
            onChange={setDuration}
            options={[15, 30, 60, 90, 120, 180, 240].map((n) => ({
              value: String(n),
              label: `${n} minutos`,
            }))}
          />
          <div className="row-between">
            <span>Importe</span>
            <strong className="amount">{money(total)}</strong>
          </div>
          <Button
            disabled={vm.busy}
            icon={ParkingCircle}
            onPress={() =>
              ask(
                "Iniciar estacionamiento",
                `${plate || "Sin patente"}, ${duration} minutos, ${money(total)}`,
                "/parking",
                { plate, zoneId: point, minutes: Number(duration) },
              )
            }
          >
            Iniciar estacionamiento
          </Button>
          <p className="footnote">
            El importe se calcula según el punto elegido y el tiempo
            seleccionado.
          </p>
        </Card>
        <div className="stack">
          <h2>Sesiones activas</h2>
          {active.length === 0 && (
            <Card>
              <Clock size={32} />
              <h3>Tu próximo lugar te espera.</h3>
              <p className="muted">
                Cuando inicies una sesión, vas a ver el tiempo restante acá.
              </p>
            </Card>
          )}
          {active.map((p) => {
            const sec = Math.max(
              0,
              Math.ceil((Date.parse(p.endsAt) - now) / 1000),
            );
            const rate =
              data.parkingZones.find((z) => z.id === p.zoneId)?.rate || 0;
            const place = data.parkingZones.find((z) => z.id === p.zoneId);
            return (
              <Card key={p.id}>
                <Tag>{p.plate}</Tag>
                <h3>{place?.name || p.zone}</h3>
                <p className="muted">{place?.address || place?.landmark}</p>
                {sec <= 300 && (
                  <p className="expiry-warning" role="status">
                    Quedan menos de cinco minutos. Extendé tu sesión si
                    necesitás más tiempo.
                  </p>
                )}
                <strong className="timer" role="timer">
                  {Math.floor(sec / 3600)
                    .toString()
                    .padStart(2, "0")}
                  :
                  {Math.floor((sec % 3600) / 60)
                    .toString()
                    .padStart(2, "0")}
                  :{(sec % 60).toString().padStart(2, "0")}
                </strong>
                <p className="muted">
                  Finaliza a las{" "}
                  {new Date(p.endsAt).toLocaleTimeString("es-AR")},{" "}
                  {money(p.amount)}
                </p>
                <Button
                  light
                  disabled={vm.busy || p.minutes + 15 > 240}
                  icon={Plus}
                  onPress={() =>
                    ask(
                      "Extender estacionamiento",
                      `${p.plate}, 15 minutos adicionales, ${money(rate / 4)}`,
                      "/parking/extend",
                      { id: p.id, minutes: 15 },
                    )
                  }
                >
                  Extender 15 minutos
                </Button>
              </Card>
            );
          })}
          <h3>Historial</h3>
          {data.parking
            .filter((p) => Date.parse(p.endsAt) <= now)
            .map((p) => (
              <Card key={p.id}>
                <h3>{p.plate}, Sesión finalizada</h3>
                <p>
                  {date(p.startedAt)}, {p.zone}, {money(p.amount)}
                </p>
              </Card>
            ))}
          {data.parking.filter((p) => Date.parse(p.endsAt) <= now).length ===
            0 && <p className="muted">Todavía no hay sesiones finalizadas.</p>}
        </div>
      </div>
    </>
  );
}
