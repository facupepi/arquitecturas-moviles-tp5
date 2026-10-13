// Íconos para la web (WP5, 7.2): lucide importado archivo por archivo (patrón de
// heredado:src/icons.js) para no arrastrar toda la librería al paquete.
import React from 'react';
import { colores } from '../tema/tokens';
import House from 'lucide-react/dist/esm/icons/house.js';
import Bike from 'lucide-react/dist/esm/icons/bike.js';
import ReceiptText from 'lucide-react/dist/esm/icons/receipt-text.js';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js';
import Phone from 'lucide-react/dist/esm/icons/phone.js';
import ShieldCheck from 'lucide-react/dist/esm/icons/shield-check.js';
import CircleParking from 'lucide-react/dist/esm/icons/circle-parking.js';
import Bell from 'lucide-react/dist/esm/icons/bell.js';
import Menu from 'lucide-react/dist/esm/icons/menu.js';
import X from 'lucide-react/dist/esm/icons/x.js';
import Check from 'lucide-react/dist/esm/icons/check.js';
import CircleCheck from 'lucide-react/dist/esm/icons/circle-check.js';
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right.js';
import ChevronLeft from 'lucide-react/dist/esm/icons/chevron-left.js';
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js';
import Clock from 'lucide-react/dist/esm/icons/clock.js';
import Download from 'lucide-react/dist/esm/icons/download.js';
import Mail from 'lucide-react/dist/esm/icons/mail.js';
import MapPin from 'lucide-react/dist/esm/icons/map-pin.js';
import Navigation from 'lucide-react/dist/esm/icons/navigation.js';
import Plus from 'lucide-react/dist/esm/icons/plus.js';
import Minus from 'lucide-react/dist/esm/icons/minus.js';
import Search from 'lucide-react/dist/esm/icons/search.js';
import Settings2 from 'lucide-react/dist/esm/icons/settings-2.js';
import ArrowUpRight from 'lucide-react/dist/esm/icons/arrow-up-right.js';
import MessageCircle from 'lucide-react/dist/esm/icons/message-circle.js';
import UserRound from 'lucide-react/dist/esm/icons/user-round.js';
import LogOut from 'lucide-react/dist/esm/icons/log-out.js';
import LayoutDashboard from 'lucide-react/dist/esm/icons/layout-dashboard.js';
import TriangleAlert from 'lucide-react/dist/esm/icons/triangle-alert.js';
import Info from 'lucide-react/dist/esm/icons/info.js';
import WifiOff from 'lucide-react/dist/esm/icons/wifi-off.js';
import Paperclip from 'lucide-react/dist/esm/icons/paperclip.js';
import Printer from 'lucide-react/dist/esm/icons/printer.js';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js';
import MonitorDown from 'lucide-react/dist/esm/icons/monitor-down.js';
import CreditCard from 'lucide-react/dist/esm/icons/credit-card.js';
import WalletCards from 'lucide-react/dist/esm/icons/wallet-cards.js';
import Smartphone from 'lucide-react/dist/esm/icons/smartphone.js';
import Landmark from 'lucide-react/dist/esm/icons/landmark.js';
import LockKeyhole from 'lucide-react/dist/esm/icons/lock-keyhole.js';

// Nombres de la sección 7.2, más chevronIzquierda, chevronAbajo y menos (agregados por WP5)
// y los de la pasarela de pagos.
export const ICONOS = {
  inicio: House,
  bicicleta: Bike,
  tributo: ReceiptText,
  reclamo: MessageSquare,
  telefono: Phone,
  alarma: ShieldCheck,
  estacionamiento: CircleParking,
  campana: Bell,
  menu: Menu,
  cerrar: X,
  check: Check,
  checkCirculo: CircleCheck,
  chevron: ChevronRight,
  chevronIzquierda: ChevronLeft,
  chevronAbajo: ChevronDown,
  reloj: Clock,
  descargar: Download,
  correo: Mail,
  ubicacion: MapPin,
  navegar: Navigation,
  mas: Plus,
  menos: Minus,
  buscar: Search,
  ajustes: Settings2,
  externo: ArrowUpRight,
  mensaje: MessageCircle,
  usuario: UserRound,
  salir: LogOut,
  panel: LayoutDashboard,
  alerta: TriangleAlert,
  info: Info,
  sinConexion: WifiOff,
  adjunto: Paperclip,
  imprimir: Printer,
  actualizar: RefreshCw,
  instalar: MonitorDown,
  // Medios de la pasarela de pagos (íconos genéricos, sin marcas).
  tarjetaCredito: CreditCard,
  tarjetaDebito: WalletCards,
  billetera: Smartphone,
  banco: Landmark,
  candado: LockKeyhole,
};

export const NOMBRES_ICONOS = Object.keys(ICONOS);

/**
 * <Icono nombre="campana" tamano={20} color="#1e2939" etiquetaAccesible?="…" />
 * Sin etiqueta es decorativo (aria-hidden). Con etiqueta se anuncia como imagen.
 */
export default function Icono({ nombre, tamano = 20, color = colores.texto, etiquetaAccesible }) {
  const Componente = ICONOS[nombre];
  if (!Componente) {
    if (__DEV__) console.warn(`Icono: nombre desconocido "${nombre}"`);
    return null;
  }
  const accesible = etiquetaAccesible
    ? { role: 'img', 'aria-label': etiquetaAccesible }
    : { 'aria-hidden': true, focusable: 'false' };
  return (
    <Componente
      size={tamano}
      color={color}
      strokeWidth={2}
      style={{ flexShrink: 0, display: 'block' }}
      {...accesible}
    />
  );
}
