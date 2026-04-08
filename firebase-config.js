// ==========================================
// 1. FIREBASE IMPORTS
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
  getDoc,
  query,
  orderBy,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ==========================================
// 2. PROJECT CONFIGURATION
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

console.log("The Dog Atlas: Firebase logic active.");

// ==========================================
// 3. LOGIN LOGIC
// ==========================================
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-password").value;

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      window.location.href = "index.html";
    } catch (error) {
      alert("Login Failed: " + error.message);
    }
  };
}

// ==========================================
// 4. AUTH STATE & COMMUNITY DATA RECALL
// ==========================================
onAuthStateChanged(auth, (user) => {
  const authLinks = document.getElementById("auth-links");
  if (user) {
    if (authLinks) {
      authLinks.innerHTML = `<li><a href="profile.html">Profile</a></li><li><a href="#" id="logout-btn">Logout</a></li>`;
      document.getElementById("logout-btn").onclick = () =>
        signOut(auth).then(() => (location.href = "login.html"));
    }
    // This triggers the data recall for the community feed
    if (document.getElementById("pack-feed")) loadFeed();
  } else {
    if (authLinks)
      authLinks.innerHTML = `<li><a href="login.html" class="login-btn">Login</a></li>`;
  }
});

async function loadFeed() {
  const container = document.getElementById("pack-feed");
  if (!container) return;
  const q = query(collection(db, "feedPosts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    container.innerHTML = "";
    snap.forEach((d) => {
      const p = d.data();
      container.innerHTML += `
                <div class="feed-card">
                    <img src="${p.imageUrl || "Media/Milo.png"}">
                    <p><strong>${p.authorName || "Explorer"}</strong>: ${p.caption || ""}</p>
                </div>`;
    });
  });
}

// ==========================================
// 5. CALENDAR (WIDER LAYOUT FIX)
// ==========================================
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

window.addEventListener("load", () => {
  if (document.getElementById("calendar")) initCalendar();
});
