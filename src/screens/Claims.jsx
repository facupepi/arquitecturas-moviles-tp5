import React, { useState, useRef } from "react";
import { Plus } from "../icons";
import { Button, Field, Select, Tag, Card, Heading } from "../components";
import { readAttachments, date } from "../platform.web";
import { required, member, categories } from "../../server/domain.mjs";
export default function Claims({ data, vm, station, clearStation }) {
  const [category, setCategory] = useState(
      station ? "Bicicletas" : "Alumbrado",
    ),
    [address, setAddress] = useState(station),
    [description, setDescription] = useState(""),
    [files, setFiles] = useState([]),
    [search, setSearch] = useState(""),
    [formKey, setFormKey] = useState(0),
    [reading, setReading] = useState(false);
  const pending = useRef(null);
  const send = async () => {
    try {
      member(category, categories, "Categoría");
      required(address, "Ubicación", 5, 160);
      required(description, "Descripción", 10, 1500);
    } catch (error) {
      vm.setError(error.message);
      return;
    }
    const payload = { category, address, description, attachments: files };
    const signature = JSON.stringify(payload);
    if (!pending.current || pending.current.signature !== signature)
      pending.current = { signature, requestId: crypto.randomUUID() };
    const r = await vm.act(
      "/claims",
      { ...payload, requestId: pending.current.requestId },
      "Reclamo registrado. Ya podés seguir su estado.",
    );
    if (r) {
      pending.current = null;
      setDescription("");
      setAddress("");
      setFiles([]);
      setFormKey((k) => k + 1);
      clearStation();
    }
  };
  return (
    <>
      <Heading
        title="Una ciudad que te escucha."
        description="Registrá tu solicitud y acompañá cada paso de su resolución."
      />
      <div className="split-layout">
        <Card>
          <h2>Nuevo reclamo</h2>
          <Select
            label="Tipo de reclamo"
            value={category}
            onChange={setCategory}
            options={["Alumbrado", "Bacheo", "Limpieza", "Bicicletas", "Otros"]}
          />
          <Field
            label="Ubicación"
            value={address}
            onChange={setAddress}
            placeholder="Calle y altura o nombre de la estación"
          />
          <Field
            label="Descripción"
            value={description}
            onChange={setDescription}
            multiline
            placeholder="Contanos qué pasó (mínimo 10 caracteres)"
          />
          <label className="upload field">
            <span>Fotos o documentos</span>
            <input
              key={formKey}
              type="file"
              className="file-input"
              aria-label="Fotos o documentos"
              multiple
              accept="image/jpeg,image/png,application/pdf"
              onChange={async (e) => {
                setReading(true);
                try {
                  setFiles(await readAttachments(e.target.files));
                } catch (err) {
                  setFiles([]);
                  e.target.value = "";
                  vm.setError(err.message);
                } finally {
                  setReading(false);
                }
              }}
            />
            <span className="file-trigger">Seleccionar archivos</span>
            <small>Hasta 3 archivos JPG, PNG o PDF de 2 MB cada uno.</small>
          </label>
          {files.map((f) => (
            <span className="muted" key={f.name}>
              {f.name}
            </span>
          ))}
          <Button disabled={vm.busy || reading} onPress={send} icon={Plus}>
            {reading ? "Leyendo archivos…" : "Enviar reclamo"}
          </Button>
        </Card>
        <div className="stack">
          <div className="section-line">
            <h2>Mis reclamos</h2>
          </div>
          <Field
            label="Buscar reclamos"
            value={search}
            onChange={setSearch}
            placeholder="Número, dirección o descripción"
          />
          {data.claims
            .filter((c) =>
              (c.id + " " + c.address + " " + c.description)
                .toLowerCase()
                .includes(search.toLowerCase()),
            )
            .map((c) => (
              <Card key={c.id}>
                <div className="row-between">
                  <Tag tone={c.status === "Resuelto" ? "green" : "amber"}>
                    {c.status}
                  </Tag>
                  <small>{c.id}</small>
                </div>
                <h3>
                  {c.category}, {c.address}
                </h3>
                <p>{c.description}</p>
                <ol className="timeline">
                  {c.history.map((h, i) => (
                    <li key={i}>
                      <span>{h.status}</span>
                      <small>{date(h.date)}</small>
                    </li>
                  ))}
                </ol>
                {c.attachments.map((f, i) => (
                  <Button
                    key={i}
                    light
                    disabled={vm.busy}
                    onPress={async () => {
                      const file = await vm.act("/claims/attachment", {
                        id: c.id,
                        index: i,
                      });
                      if (file) {
                        const a = document.createElement("a");
                        a.href = file.data;
                        a.download = file.name;
                        a.click();
                      }
                    }}
                  >
                    Descargar {f.name}
                  </Button>
                ))}
              </Card>
            ))}
          {data.claims.filter((c) =>
            (c.id + " " + c.address + " " + c.description)
              .toLowerCase()
              .includes(search.toLowerCase()),
          ).length === 0 && <p>No se encontraron reclamos.</p>}
        </div>
      </div>
    </>
  );
}
