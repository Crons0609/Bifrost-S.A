// Configuración del SDK Web de Firebase (Para usar directamente en la página web)
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  databaseURL: "TU_FIREBASE_URL",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_ID_AQUI",
  appId: "TU_APP_ID"
};

// Importamos Firebase desde los CDN oficiales y lo inicializamos
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, onValue, set, push, update } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

const app = initializeApp(firebaseConfig);
export const dbWeb = getDatabase(app);
export { ref, onValue, set, push, update };
