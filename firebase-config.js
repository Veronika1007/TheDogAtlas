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
  updateDoc,
  arrayUnion,
  arrayRemove,
  increment,
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

// ==========================================
// 1. GLOBAL AUTH & REDIRECTS
// ==========================================
onAuthStateChanged(auth, (user) => {
  const authLinks = document.getElementById("auth-links");
  if (user) {
    console.log("Logged In:", user.email);
    if (authLinks) {
      authLinks.innerHTML = `<li><a href="profile.html">Profile</a></li><li><a href="#" id="logout-btn">Logout</a></li>`;
      document.getElementById("logout-btn").onclick = () =>
        signOut(auth).then(() => (window.location.href = "login.html"));
    }

    // Page Data Loaders
    if (document.getElementById("pack-feed")) loadVisualFeed();
    if (document.getElementById("user-profile-data")) loadProfile(user.uid);
  } else {
    if (authLinks)
      authLinks.innerHTML = `<li><a href="login.html" class="login-btn">Login</a></li>`;
  }
});

// ==========================================
// 2. LOGIN LOGIC (Fixed Redirect)
// ==========================================
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-password").value;
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      // This forces the redirect to the profile page
      window.location.href = "profile.html";
    } catch (err) {
      alert("Login failed. Check your credentials.");
    }
  };
}

// ==========================================
// 3. COMMUNITY FEED (MATCHES "BEFORE" STYLE)
// ==========================================
async function loadVisualFeed() {
  const container = document.getElementById("pack-feed");
  if (!container) return;
  const q = query(collection(db, "feedPosts"), orderBy("createdAt", "desc"));

  onSnapshot(q, async (snap) => {
    container.innerHTML = "";
    for (const d of snap.docs) {
      const p = d.data();
      const postId = d.id;
      const user = auth.currentUser;
      const hasWoofed = p.likedBy && user && p.likedBy.includes(user.uid);

      // Fetch Comments
      const commSnap = await getDocs(
        collection(db, "feedPosts", postId, "comments"),
      );
      let commentsHtml = "";
      commSnap.forEach((c) => {
        commentsHtml += `<p class="comment-row"><strong>${c.data().authorName}:</strong> ${c.data().text}</p>`;
      });

      container.innerHTML += `
                <div class="feed-item">
                    <div class="feed-header">
                        <img src="${p.authorPhoto || "Media/Milo.png"}" class="meta-avatar">
                        <strong>${p.authorName}</strong>
                    </div>
                    <img src="${p.imageUrl}" class="main-img">
                    <div class="feed-footer">
                        <div class="actions">
                            <span class="woof-icon ${hasWoofed ? "active" : ""}" onclick="handleWoof('${postId}', this)">
                                <i class="fa-solid fa-paw"></i> <small>${p.likes || 0}</small>
                            </span>
                        </div>
                        <p class="feed-cap"><strong>${p.authorName}</strong> ${p.caption}</p>
                        <div class="comments-wrap">${commentsHtml}</div>
                    </div>
                </div>`;
    }
  });
}

window.handleWoof = async (postId, btn) => {
  const user = auth.currentUser;
  if (!user) return alert("Login to woof!");
  const postRef = doc(db, "feedPosts", postId);
  const isActive = btn.classList.contains("active");
  await updateDoc(postRef, {
    likes: increment(isActive ? -1 : 1),
    likedBy: isActive ? arrayRemove(user.uid) : arrayUnion(user.uid),
  });
};
