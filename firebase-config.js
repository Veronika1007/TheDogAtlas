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
  getDocs,
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
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

// --- AUTH OBSERVER ---
onAuthStateChanged(auth, (user) => {
  const authLinks = document.getElementById("auth-links");
  if (user) {
    if (authLinks) {
      authLinks.innerHTML = `<li><a href="profile.html">Profile</a></li><li><a href="#" id="logout-btn">Logout</a></li>`;
      document.getElementById("logout-btn").onclick = () =>
        signOut(auth).then(() => (window.location.href = "login.html"));
    }

    // Page specific data loaders
    if (document.getElementById("pack-feed")) loadPosts();
    if (document.getElementById("friends-list")) loadFriends(user.uid);
    if (document.getElementById("forum-topics")) loadForum();
    if (document.getElementById("user-profile-data")) loadProfile(user.uid);
  } else {
    if (authLinks)
      authLinks.innerHTML = `<li><a href="login.html" class="login-btn">Login</a></li>`;
  }
});

// --- LOGIN LOGIC ---
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-password").value;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // This forces the move to the profile page
      window.location.href = "profile.html";
    } catch (err) {
      alert("Login Error: " + err.message);
    }
  };
}

// --- DATA RECALL FUNCTIONS ---
async function loadPosts() {
  const q = query(collection(db, "feedPosts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snap) => {
    const container = document.getElementById("pack-feed");
    if (!container) return;
    container.innerHTML = "";
    snap.forEach((d) => {
      const p = d.data();
      container.innerHTML += `
                <div class="feed-card">
                    <img src="${p.imageUrl}" class="feed-img">
                    <div class="feed-content">
                        <strong>${p.authorName}</strong>
                        <p>${p.caption}</p>
                    </div>
                </div>`;
    });
  });
}

async function loadFriends(uid) {
  const userDoc = await getDoc(doc(db, "users", uid));
  const following = userDoc.data()?.following || [];
  const container = document.getElementById("friends-list");
  if (!container) return;
  container.innerHTML = following.length ? "" : "<p>No pack members yet.</p>";

  following.forEach(async (friendId) => {
    const fSnap = await getDoc(doc(db, "users", friendId));
    if (fSnap.exists()) {
      container.innerHTML += `<div class="friend-card"><span>${fSnap.data().displayName}</span></div>`;
    }
  });
}

async function loadForum() {
  const container = document.getElementById("forum-topics");
  if (!container) return;
  const snap = await getDocs(collection(db, "forum"));
  container.innerHTML = "";
  snap.forEach((d) => {
    container.innerHTML += `<div class="forum-row"><a>${d.data().title}</a></div>`;
  });
}
