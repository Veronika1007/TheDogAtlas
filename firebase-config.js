// ==========================================
// 1. STABLE IMPORTS & INITIALIZATION
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

// ==========================================
// 2. CORE LOGIN LOGIC (PRIORITY)
// ==========================================
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-password").value;

    signInWithEmailAndPassword(auth, email, pass)
      .then(() => {
        window.location.href = "index.html";
      })
      .catch((err) => {
        alert("Login Error: " + err.message);
      });
  });
}

// Global Auth State
onAuthStateChanged(auth, (user) => {
  const authLinks = document.getElementById("auth-links");
  if (user) {
    if (authLinks)
      authLinks.innerHTML = `<li><a href="profile.html">Profile</a></li><li><a href="#" onclick="logoutUser()">Logout</a></li>`;
    if (document.getElementById("pack-feed")) loadVisualFeed();
  } else {
    if (authLinks)
      authLinks.innerHTML = `<li><a href="login.html" class="login-btn">Login</a></li>`;
  }
});

window.logoutUser = () => {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
};

// ==========================================
// 3. COMMUNITY FEED RECALL
// ==========================================
async function loadVisualFeed() {
  const feedContainer = document.getElementById("pack-feed");
  if (!feedContainer) return;

  const q = query(collection(db, "feedPosts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    feedContainer.innerHTML = "";
    snapshot.forEach((d) => {
      const post = d.data();
      feedContainer.innerHTML += `
                <div class="feed-card">
                    <img src="${post.imageUrl}" style="width:100%; aspect-ratio:1/1; object-fit:cover;">
                    <div style="padding:15px;">
                        <p><strong>${post.authorName}</strong> ${post.caption || ""}</p>
                    </div>
                </div>`;
    });
  });
}

// ==========================================
// 4. CALENDAR PROTECTION
// ==========================================
async function initEventsCalendar() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  try {
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      events: async function (info, successCallback) {
        const snap = await getDocs(collection(db, "events"));
        const events = snap.docs.map((doc) => ({
          title: doc.data().title,
          start: doc.data().start,
          color: "#ff6b35",
        }));
        successCallback(events);
      },
    });
    calendar.render();
  } catch (e) {
    console.error("Calendar fail:", e);
  }
}

window.addEventListener("load", () => {
  if (document.getElementById("calendar")) initEventsCalendar();
});
