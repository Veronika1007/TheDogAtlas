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

// GLOBAL AUTH OBSERVER
onAuthStateChanged(auth, (user) => {
  const authLinks = document.getElementById("auth-links");
  if (user) {
    if (authLinks) {
      authLinks.innerHTML = `<li><a href="profile.html">Profile</a></li><li><a href="#" id="logout-btn">Logout</a></li>`;
      document.getElementById("logout-btn").onclick = () =>
        signOut(auth).then(() => (window.location.href = "login.html"));
    }
    if (document.getElementById("pack-feed")) loadVisualFeed();
    if (document.getElementById("friends-list")) loadFriends(user.uid);
    if (document.getElementById("forum-topics")) loadForum();
  } else {
    if (authLinks)
      authLinks.innerHTML = `<li><a href="login.html" class="login-btn">Login</a></li>`;
  }
});

// LOGIN LOGIC
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

// FEED WITH WOOFS & COMMENTS
async function loadVisualFeed() {
  const container = document.getElementById("pack-feed");
  if (!container) return;
  const q = query(collection(db, "feedPosts"), orderBy("createdAt", "desc"));

  onSnapshot(q, (snap) => {
    container.innerHTML = "";
    snap.forEach(async (d) => {
      const p = d.data();
      const postId = d.id;
      const user = auth.currentUser;
      const hasWoofed = p.likedBy && user && p.likedBy.includes(user.uid);

      // Fetch comments for this specific post
      const commSnap = await getDocs(
        collection(db, "feedPosts", postId, "comments"),
      );
      let commentsHtml = "";
      commSnap.forEach((c) => {
        commentsHtml += `<p class="comment-text"><strong>${c.data().authorName}:</strong> ${c.data().text}</p>`;
      });

      container.innerHTML += `
                <div class="post-item">
                    <div class="post-meta">
                        <img src="${p.authorPhoto || "Media/Milo.png"}" class="meta-avatar">
                        <strong>${p.authorName}</strong>
                    </div>
                    <img src="${p.imageUrl}" class="post-image">
                    <div class="post-footer">
                        <div class="post-actions">
                            <span class="woof-btn ${hasWoofed ? "active" : ""}" onclick="handleWoof('${postId}', this)">
                                <i class="fa-solid fa-paw"></i> <small>${p.likes || 0}</small>
                            </span>
                        </div>
                        <p class="caption"><strong>${p.authorName}</strong> ${p.caption}</p>
                        <div class="comments-section">${commentsHtml}</div>
                    </div>
                </div>`;
    });
  });
}

// ATTACH FUNCTIONS TO WINDOW FOR HTML ACCESS
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
