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

const loginForm = document.getElementById("login-form");

if (loginForm) {
  console.log("Login form found in HTML.");
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    console.log("Login button actually clicked.");

    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-password").value;

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        pass,
      );
      console.log("Firebase Login Success:", userCredential.user.email);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Firebase Login Error:", error.code);
      alert("Login Failed: " + error.message);
    }
  };
} else {
  console.log(
    "Login form NOT found. (This is normal if you aren't on the login page)",
  );
}

// --- CALENDAR LAYOUT FIX ---
async function initCalendar() {
  const el = document.getElementById("calendar");
  if (!el) return;
  const calendar = new FullCalendar.Calendar(el, {
    initialView: "dayGridMonth",
    height: "auto",
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
