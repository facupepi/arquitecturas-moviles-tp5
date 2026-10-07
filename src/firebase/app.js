// Aplicación de Firebase (WP4, sección 5.1). Se crea una sola vez, al importar el módulo.
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from './config.js';

export const app = initializeApp(firebaseConfig);
