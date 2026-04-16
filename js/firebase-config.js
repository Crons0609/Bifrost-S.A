// Configuración del SDK Web de Firebase (Para usar directamente en la página web)
const firebaseConfig = {
  apiKey: "AIzaSyASoDJQqXNWupnA0DicW6sWgm-zD7xe9HA",
  authDomain: "bifrost-sa.firebaseapp.com",
  databaseURL: "https://bifrost-sa-default-rtdb.firebaseio.com",
  projectId: "bifrost-sa",
  storageBucket: "bifrost-sa.firebasestorage.app",
  messagingSenderId: "943196918782",
  appId: "1:943196918782:web:5e197c094948a6517a66af"
};

// Importamos Firebase desde los CDN oficiales y lo inicializamos
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, onValue, set, push, update } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

const app = initializeApp(firebaseConfig);
export const dbWeb = getDatabase(app);
export { ref, onValue, set, push, update };

