// ==========================================
// 1. ABSOLUTE IMPORTS
// ==========================================
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
  doc,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 2. PROJECT INITIALIZATION
// ==========================================
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

// HEARTBEAT LOG: If you see this in console, the script is working
console.log("Firebase connection established.");

// ==========================================
// 3. LOGIN LISTENER (STRICT VERSION)
// ==========================================
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-password").value;

    console.log("Attempting login for:", email);

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Login Error:", error.code);
      alert("Login Failed: " + error.message);
    }
  };
}

// ==========================================
// 4. GLOBAL AUTH OBSERVER
// ==========================================
onAuthStateChanged(auth, (user) => {
  const authLinks = document.getElementById("auth-links");
  if (user) {
    if (authLinks)
      authLinks.innerHTML = `<li><a href="profile.html">Profile</a></li><li><a href="#" id="logout-trigger">Logout</a></li>`;
    const logoutBtn = document.getElementById("logout-trigger");
    if (logoutBtn)
      logoutBtn.onclick = () =>
        signOut(auth).then(() => (window.location.href = "login.html"));

    if (document.getElementById("pack-feed")) loadFeed();
  } else {
    if (authLinks)
      authLinks.innerHTML = `<li><a href="login.html" class="login-btn">Login</a></li>`;
  }
});

// ==========================================
// 5. CALENDAR & FEED (ISOLATED)
// ==========================================
async function loadFeed() {
  const container = document.getElementById("pack-feed");
  if (!container) return;
  const q = query(collection(db, "feedPosts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    container.innerHTML = "";
    snap.forEach((d) => {
      const p = d.data();
      container.innerHTML += `<div class="feed-card"><img src="${p.imageUrl}"><p>${p.caption || ""}</p></div>`;
    });
  });
}

async function initCalendar() {
  const el = document.getElementById("calendar");
  if (!el) return;
  const calendar = new FullCalendar.Calendar(el, {
    initialView: "dayGridMonth",
    events: async (info, success) => {
      const snap = await getDocs(collection(db, "events"));
      success(
        snap.docs.map((doc) => ({
          title: doc.data().title,
          start: doc.data().start,
          color: "#ff6b35",
        })),
      );
    },
  });
  calendar.render();
}

window.addEventListener("load", () => {
  if (document.getElementById("calendar")) initCalendar();
});
