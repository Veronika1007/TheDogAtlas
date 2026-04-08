import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAUzPfsLsh5bCsso7DMLDlmuyb-PR0JeeY",
  authDomain: "thedogatlas.firebaseapp.com",
  projectId: "thedogatlas",
  storageBucket: "thedogatlas.firebasestorage.app",
  messagingSenderId: "313338994397",
  appId: "1:313338994397:web:cc18283775082fa0194534",
  measurementId: "G-RFSFBEKSS9",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("SUCCESS: firebase-config.js has loaded.");

// --- LOGIN LOGIC ---
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-password").value;

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // FIXED: Removed the 's' from windows
      window.location.href = "index.html";
    } catch (error) {
      alert("Login Failed: " + error.message);
    }
  };
}

// --- CALENDAR LOGIC (WIDE & SYMMETRICAL) ---
async function initCalendar() {
  const el = document.getElementById("calendar");
  if (!el) return;
  const calendar = new FullCalendar.Calendar(el, {
    initialView: "dayGridMonth",
    height: "auto",
    aspectRatio: 1.5, // Makes the calendar wider and more symmetrical
    headerToolbar: { left: "prev,next", center: "title", right: "today" },
    events: async (info, success) => {
      const snap = await getDocs(collection(db, "events"));
      success(
        snap.docs.map((d) => ({
          title: d.data().title,
          start: d.data().start,
          color: "#ff7a4a",
        })),
      );
    },
  });
  calendar.render();
}

onAuthStateChanged(auth, (user) => {
  if (user && document.getElementById("calendar")) initCalendar();
});
