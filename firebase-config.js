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

// --- PERSISTENT AUTH OBSERVER ---
onAuthStateChanged(auth, (user) => {
  const authLinks = document.getElementById("auth-links");
  if (user) {
    console.log("Session Active:", user.email);
    if (authLinks) {
      authLinks.innerHTML = `<li><a href="profile.html">Profile</a></li><li><a href="#" id="logout-link">Logout</a></li>`;
      document.getElementById("logout-link").onclick = () =>
        signOut(auth).then(() => (window.location.href = "login.html"));
    }

    // Page loaders
    if (document.getElementById("pack-feed")) loadVisualFeed();
    if (document.getElementById("user-profile-data")) loadProfileData(user.uid);
  } else {
    if (authLinks)
      authLinks.innerHTML = `<li><a href="login.html" class="login-btn">Login</a></li>`;
  }
});

// --- LOGIN HANDLER ---
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-password").value;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      window.location.href = "profile.html";
    } catch (err) {
      alert("Login failed. Check your credentials.");
    }
  };
}

// --- VISUAL FEED LOADER (Matches "Before" Screenshot) ---
async function loadVisualFeed() {
  const container = document.getElementById("pack-feed");
  if (!container) return;
  const q = query(collection(db, "feedPosts"), orderBy("createdAt", "desc"));

  onSnapshot(q, (snap) => {
    container.innerHTML = "";
    snap.forEach((d) => {
      const p = d.data();
      container.innerHTML += `
                <div class="post-item">
                    <div class="post-meta">
                        <img src="${p.authorPhoto || "Media/Milo.png"}" class="meta-avatar">
                        <strong>${p.authorName}</strong>
                    </div>
                    <img src="${p.imageUrl}" class="post-image">
                    <div class="post-footer">
                        <p><strong>${p.authorName}</strong> ${p.caption}</p>
                    </div>
                </div>`;
    });
  });
}
