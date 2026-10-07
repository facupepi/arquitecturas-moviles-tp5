import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, TextInput, StyleSheet } from "react-native";
const s = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 17,
    paddingVertical: 11,
    backgroundColor: "#0077ae",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  light: { backgroundColor: "#e0f2fc" },
  buttonText: {
    fontFamily: "Quicksand",
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  lightText: { color: "#005c88" },
  input: {
    fontFamily: "Quicksand",
    fontSize: 16,
    color: "#1e2939",
    backgroundColor: "#fff",
    borderColor: "#b7c8d6",
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce4eb",
    borderRadius: 18,
    padding: 22,
    gap: 12,
  },
  title: {
    fontFamily: "Quicksand",
    fontSize: 18,
    fontWeight: "600",
    color: "#1e2939",
  },
  muted: {
    fontFamily: "Quicksand",
    fontSize: 16,
    lineHeight: 22,
    color: "#526174",
  },
});
export function Button({
  children,
  onPress,
  light = false,
  disabled = false,
  icon: Icon,
  href,
}) {
  const content = (
    <>
      {Icon && <Icon size={17} color={light ? "#005c88" : "white"} />}
      <Text style={[s.buttonText, light && s.lightText]}>{children}</Text>
    </>
  );
  if (href)
    return (
      <a
        className={`button-anchor ${light ? "light" : ""}`}
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noreferrer" : undefined}
      >
        {content}
      </a>
    );
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        light && s.light,
        { opacity: disabled ? 0.5 : pressed ? 0.75 : 1 },
      ]}
    >
      {content}
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = "",
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        style={[
          s.input,
          multiline && { minHeight: 105, textAlignVertical: "top" },
        ]}
      />
    </label>
  );
}
export function Select({ label, value, onChange, options }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value ?? o} value={o.value ?? o}>
            {o.label ?? o}
          </option>
        ))}
      </select>
    </label>
  );
}
export function Tag({ children, tone = "green" }) {
  return <span className={`tag ${tone}`}>{children}</span>;
}
export function Card({ children }) {
  return <View style={s.card}>{children}</View>;
}
export function Heading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow || "TUS SERVICIOS MUNICIPALES"}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Confirm({ value, onClose, onConfirm, busy, error }) {
  const panel = useRef(null);
  useEffect(() => {
    if (!value) return;
    const previous = document.activeElement;
    const first = panel.current?.querySelector("[role=button],button");
    first?.focus();
    const key = (e) => {
      if (e.key === "Escape" && !busy) onClose();
      if (e.key === "Tab") {
        const focusable = Array.from(
          panel.current.querySelectorAll("[role=button],button"),
        ).filter(
          (el) =>
            !el.hasAttribute("disabled") &&
            el.getAttribute("aria-disabled") !== "true",
        );
        const first = focusable[0],
          last = focusable.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [!!value, busy]);
  if (!value) return null;
  return (
    <div className="modal-backdrop">
      <section
        ref={panel}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <Tag tone="amber">Confirmación requerida</Tag>
        <h2 id="confirm-title">{value.title}</h2>
        <p>{value.text}</p>
        <p>Revisá los datos antes de continuar.</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <Button light onPress={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onPress={onConfirm} disabled={busy}>
            {busy ? "Procesando…" : "Confirmar operación"}
          </Button>
        </div>
      </section>
    </div>
  );
}
