// Doble de src/firebase/firestore.js: el test fija el Firestore del usuario de turno.
export let db = null;
export function fijarDb(nuevo) { db = nuevo; }
