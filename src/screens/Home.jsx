import React, { useState, useEffect } from "react";
import {
  Bike,
  ReceiptText,
  MessageSquare,
  Bell,
  ArrowUpRight,
  ChevronRight,
  Search,
} from "../icons";
import { Button, Tag, Heading } from "../components";
import { date } from "../platform.web";
import { services } from "../services";
export default function Home({ data, go }) {
  const [search, setSearch] = useState("");
  const filtered = services.filter((s) =>
    (s.name + " " + s.description).toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <Heading
        eyebrow="BIENVENIDO A TU ESPACIO"
        title="Tu ciudad, a un toque."
        description="Todo lo que necesitás para tu día en San Francisco."
        action={
          <span className="date-label">
            {new Date().toLocaleDateString("es-AR", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        }
      />
      <div className="hero">
        <div className="hero-copy">
          <span className="hero-eyebrow">
            <span /> MOVETE A TU RITMO
          </span>
          <h2>
            Más cerca.
            <br />
            Más simple.
            <br />
            <em>Más San Francisco.</em>
          </h2>
          <p>
            Salí a recorrer la ciudad. Encontrá tu próxima
            <br className="desktop-only" /> bicicleta y elegí una forma distinta
            de moverte.
          </p>
          <Button light icon={ArrowUpRight} onPress={() => go("bicicletas")}>
            Encontrar una bicicleta
          </Button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="art-sun" />
          <div className="art-ring ring-one" />
          <div className="art-ring ring-two" />
          <div className="art-building b-one" />
          <div className="art-building b-two" />
          <div className="art-tree" />
          <div className="art-bike">
            <Bike size={202} strokeWidth={1.3} />
          </div>
          <div className="art-road" />
          <span className="art-badge">
            <span className="local-dot" />
            {data.stations.reduce((n, s) => n + s.bikes, 0)} bicicletas
            disponibles
          </span>
        </div>
      </div>
      <div className="metrics">
        <button onClick={() => go("bicicletas")}>
          <span className="metric-icon">
            <Bike />
          </span>
          <div>
            <strong>
              {data.stations.length}{" "}
              {data.stations.length === 1 ? "estación" : "estaciones"}
            </strong>
            <span>Una nueva forma de llegar</span>
          </div>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => go("tributos")}>
          <span className="metric-icon lilac">
            <ReceiptText />
          </span>
          <div>
            <strong>
              {data.taxes.filter((t) => !t.paidAt).length}{" "}
              {data.taxes.filter((t) => !t.paidAt).length === 1
                ? "cedulón pendiente"
                : "cedulones pendientes"}
            </strong>
            <span>Tené tus cuentas al día</span>
          </div>
          <ChevronRight size={18} />
        </button>
        <button onClick={() => go("reclamos")}>
          <span className="metric-icon sand">
            <MessageSquare />
          </span>
          <div>
            <strong>
              {data.claims.filter((c) => c.status !== "Resuelto").length}{" "}
              {data.claims.filter((c) => c.status !== "Resuelto").length === 1
                ? "reclamo"
                : "reclamos"}{" "}
              en seguimiento
            </strong>
            <span>Seguimos trabajando para vos</span>
          </div>
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="section-line">
        <div>
          <span className="eyebrow">EN UN SOLO LUGAR</span>
          <h2>¿Qué necesitás hacer?</h2>
        </div>
        <label className="search">
          <Search size={17} />
          <input
            aria-label="Buscar servicio"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar un servicio"
          />
        </label>
      </div>
      <div className="services-grid">
        {filtered.map((item) => (
          <button
            className="service-card"
            key={item.id}
            style={{ "--service-accent": item.accent }}
            onClick={() => go(item.id)}
          >
            <span
              className="service-icon"
              style={{ background: item.color, color: item.ink }}
            >
              <item.icon size={25} strokeWidth={1.6} />
            </span>
            <ArrowUpRight className="service-arrow" size={18} />
            <h3>{item.name}</h3>
            <p>{item.description}</p>
          </button>
        ))}
        {filtered.length === 0 && (
          <p>No encontramos servicios con ese nombre.</p>
        )}
      </div>
      <div className="news-strip">
        <span className="news-icon">
          <Bell size={23} />
        </span>
        <div>
          <Tag>TUS AVISOS</Tag>
          <h3>{data.notifications[0]?.title || "Estás al día"}</h3>
          <p>{data.notifications[0]?.body || "No hay nuevos avisos."}</p>
        </div>
        <button className="text-link" onClick={() => go("notificaciones")}>
          Ver novedades <ArrowUpRight size={16} />
        </button>
      </div>
    </>
  );
}
