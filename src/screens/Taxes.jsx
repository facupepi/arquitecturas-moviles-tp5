import React, { useState } from "react";
import { ReceiptText, Download, CheckCircle2 } from "../icons";
import { Button, Tag, Card, Heading } from "../components";
import { emitBill, money, date } from "../platform.web";
export default function Taxes({ data, busy, ask }) {
  const [tab, setTab] = useState("Pendientes");
  const items = data.taxes.filter((t) =>
    tab === "Historial" ? t.paidAt : !t.paidAt,
  );
  return (
    <>
      <Heading
        title="Tus cuentas, en orden."
        description="Consultá tus obligaciones en la Dirección General Tributaria"
      />
      <div className="summary-banner">
        <div>
          <span>Total pendiente</span>
          <strong>
            {money(
              data.taxes
                .filter((t) => !t.paidAt)
                .reduce((n, t) => n + t.amount, 0),
            )}
          </strong>
        </div>
        <ReceiptText size={40} />
      </div>
      <div className="tabs">
        {["Pendientes", "Historial"].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="stack">
        {items.map((t) => (
          <Card key={t.id}>
            <div className="row-between">
              <h3>{t.concept}</h3>
              <Tag tone={t.paidAt ? "green" : "amber"}>
                {t.paidAt ? "Pagado" : "Pendiente"}
              </Tag>
            </div>
            <p className="muted">
              {t.id}, Período {t.period}, Vence el {date(t.due)}
            </p>
            <div className="row-between">
              <strong className="amount">{money(t.amount)}</strong>
              <div className="actions">
                <Button icon={Download} light onPress={() => emitBill(t)}>
                  Emitir cedulón
                </Button>
                {!t.paidAt && (
                  <Button
                    disabled={busy}
                    onPress={() =>
                      ask(
                        "Pagar cedulón",
                        `${t.concept}, ${money(t.amount)}`,
                        "/taxes/pay",
                        { id: t.id },
                      )
                    }
                  >
                    Pagar
                  </Button>
                )}
              </div>
            </div>
            {t.receipt && (
              <p className="muted">
                Comprobante {t.receipt}, {date(t.paidAt)}
              </p>
            )}
          </Card>
        ))}
      </div>
      {!items.length && (
        <Card>
          <CheckCircle2 />
          <h3>No hay cedulones en esta sección.</h3>
        </Card>
      )}
      <p className="footnote">
        Abrí el cedulón descargado para imprimirlo o guardarlo como PDF.
        Revisá las fechas de vencimiento de cada obligación.
      </p>
    </>
  );
}
