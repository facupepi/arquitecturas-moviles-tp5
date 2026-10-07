import React, { useState, useEffect } from "react";
import {
  MessageSquare,
  Phone,
  ArrowUpRight,
  MapPin,
  Clock,
  Mail,
} from "../icons";
import { Button, Card, Heading } from "../components";
export default function Contacts({ data }) {
  return (
    <>
      <Heading
        title="Estamos cerca para ayudarte."
        description="Encontrá el área que necesitás y elegí cómo comunicarte."
      />
      <div className="notice">
        Atención al vecino: 147. Para consultas municipales, acercate a Bv. 9 de
        Julio 1187.
      </div>
      <div className="two-grid">
        {data.contacts.map((c) => (
          <Card key={c.id}>
            <span className="service-icon" style={{ background: "#e2eef7" }}>
              <Phone />
            </span>
            <h3>{c.name}</h3>
            <p>{c.description}</p>
            <p className="muted">
              <MapPin size={14} /> {c.address}
            </p>
            <p className="muted">
              <Clock size={14} /> {c.hours}
            </p>
            <div className="actions">
              <Button light icon={Phone} href={`tel:${c.phone}`}>
                Llamar
              </Button>
              {c.email && (
                <Button light icon={Mail} href={`mailto:${c.email}`}>
                  Correo
                </Button>
              )}
              {c.whatsapp && (
                <Button
                  light
                  icon={MessageSquare}
                  href={`https://wa.me/${c.whatsapp}`}
                >
                  Mensaje
                </Button>
              )}
              {c.website && (
                <Button light icon={ArrowUpRight} href={c.website}>
                  Sitio web
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
