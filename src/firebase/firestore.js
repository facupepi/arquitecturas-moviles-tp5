// Firestore con caché persistente (WP4, sección 5.3).
import './appCheck.js'; // garantiza App Check antes de la primera petición
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { app } from './app.js';
import { USAR_EMULADORES, PUERTOS } from './config.js';

// Sin try/catch a propósito: si falta IndexedDB (algunas ventanas privadas), el SDK no lanza, cae solo
// a la caché en memoria y lo avisa por consola. Un segundo initializeFirestore sí lanzaría.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (USAR_EMULADORES) connectFirestoreEmulator(db, '127.0.0.1', PUERTOS.firestore);
