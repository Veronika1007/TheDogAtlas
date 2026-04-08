import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
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
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// 1. GLOBAL AUTH OBSERVER (Keeps you logged in)
onAuthStateChanged(auth, (user) => {
  const authLinks = document.getElementById("auth-links");
  if (user) {
    console.log("Logged in as:", user.email);
    if (authLinks) {
      authLinks.innerHTML = `<li><a href="profile.html">Profile</a></li><li><a href="#" id="logout-btn">Logout</a></li>`;
      document.getElementById("logout-btn").onclick = () =>
        signOut(auth).then(() => (window.location.href = "login.html"));
    }

    // Page specific loaders
    if (document.getElementById("user-profile-data")) loadProfile(user.uid);
    if (document.getElementById("pack-feed")) loadPosts();
    if (document.getElementById("friends-list")) loadFriends(user.uid);
  } else {
    console.log("User is logged out.");
    if (authLinks)
      authLinks.innerHTML = `<li><a href="login.html" class="login-btn">Login</a></li>`;

    // Redirect to login if trying to access private pages
    const privatePages = ["profile.html", "community.html"];
    if (privatePages.some((page) => window.location.pathname.includes(page))) {
      window.location.href = "login.html";
    }
  }
});

// 2. DATA RECALL FUNCTIONS
async function loadProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (snap.exists()) {
    const data = snap.data();
    document.getElementById("profile-name").innerText =
      data.displayName || "Dog Explorer";
  }
}

async function loadPosts() {
  const q = query(collection(db, "feedPosts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    const container = document.getElementById("pack-feed");
    container.innerHTML = "";
    snap.forEach((d) => {
      const p = d.data();
      container.innerHTML += `<div class="feed-card"><img src="${p.imageUrl}"><p>${p.caption}</p></div>`;
    });
  });
}
