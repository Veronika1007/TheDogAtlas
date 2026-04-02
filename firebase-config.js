// ==========================================
// 1. FIREBASE INITIALIZATION & IMPORTS
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Your verified configuration from the latest screenshot
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
console.log("Firebase App Initialized:", app.name);
auth.onAuthStateChanged((user) => {
  console.log(
    "Auth Connection Status: ACTIVE. User:",
    user ? user.email : "Logged Out",
  );
});
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================================
// 2. AUTHENTICATION (LOGIN & SIGNUP)
// ==========================================

// Login Logic
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

// Signup Logic
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value;
    const pass = document.getElementById("signup-password").value;
    const name = document.getElementById("signup-name").value;
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCred.user, { displayName: name });
      await setDoc(doc(db, "users", userCred.user.uid), {
        displayName: name,
        email: email,
        createdAt: serverTimestamp(),
        following: [],
        followers: [],
      });
      window.location.href = "index.html";
    } catch (err) {
      alert("Signup Error: " + err.message);
    }
  });
}

// Global Auth State Observer
onAuthStateChanged(auth, (user) => {
  const authLinks = document.getElementById("auth-links");
  if (user) {
    if (authLinks) {
      authLinks.innerHTML = `<li><a href="profile.html">Profile</a></li><li><a href="#" onclick="logoutUser()">Logout</a></li>`;
    }
    if (document.getElementById("pack-feed")) loadVisualFeed();
  } else {
    if (authLinks) {
      authLinks.innerHTML = `<li><a href="login.html" class="login-btn">Login</a></li>`;
    }
  }
});

window.logoutUser = () => {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
};

// ==========================================
// 3. PACK FEED & SOCIAL LOGIC
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
// 4. CALENDAR & EVENTS (ISOLATED AT BOTTOM)
// ==========================================
async function initEventsCalendar() {
  const calendarEl = document.getElementById("calendar");
  // Safety check: Exit if not on the events page to prevent breaking login
  if (!calendarEl) return;

  try {
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      height: "auto",
      headerToolbar: { left: "prev,next", center: "title", right: "today" },
      events: async function (info, successCallback) {
        const snap = await getDocs(collection(db, "events"));
        const events = snap.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title,
          start: doc.data().start,
          color: "#ff6b35",
        }));
        successCallback(events);
      },
    });
    calendar.render();
    setTimeout(() => calendar.updateSize(), 500);
  } catch (e) {
    console.error("Calendar fail:", e);
  }
}

window.addEventListener("load", () => {
  if (document.getElementById("calendar")) initEventsCalendar();
});
