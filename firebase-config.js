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

// --- 1. THE PERSISTENCE ENGINE ---
onAuthStateChanged(auth, (user) => {
  const authLinks = document.getElementById("auth-links");
  if (user) {
    console.log("Session Active:", user.email);
    if (authLinks) {
      authLinks.innerHTML = `<li><a href="profile.html">Profile</a></li><li><a href="#" id="logout-btn">Logout</a></li>`;
      document.getElementById("logout-btn").onclick = () =>
        signOut(auth).then(() => (window.location.href = "login.html"));
    }

    // Run loaders based on which page we are on
    if (document.getElementById("pack-feed")) loadVisualFeed();
    if (document.getElementById("friends-list")) loadFriends(user.uid);
    if (document.getElementById("forum-topics")) loadForum();
    if (document.getElementById("user-profile-data")) loadProfile(user.uid);
  } else {
    if (authLinks)
      authLinks.innerHTML = `<li><a href="login.html" class="login-btn">Login</a></li>`;
  }
});

// --- 2. THE VISUAL FEED (WITH COMMENTS & WOOFS) ---
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

      // Fetch Comments from sub-collection
      const commSnap = await getDocs(
        collection(db, "feedPosts", postId, "comments"),
      );
      let commentsHtml = "";
      commSnap.forEach((c) => {
        commentsHtml += `<div class="comment-item"><strong>${c.data().authorName}:</strong> ${c.data().text}</div>`;
      });

      container.innerHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <img src="${p.authorPhoto || "Media/Milo.png"}" class="avatar-mini">
                        <strong>${p.authorName}</strong>
                    </div>
                    <img src="${p.imageUrl}" class="post-img-main">
                    <div class="post-details">
                        <div class="action-bar">
                            <span class="woof-trigger ${hasWoofed ? "active" : ""}" onclick="handleWoof('${postId}', this)">
                                <i class="fa-solid fa-paw"></i> <small>${p.likes || 0}</small>
                            </span>
                        </div>
                        <p class="post-caption"><strong>${p.authorName}</strong> ${p.caption}</p>
                        <div class="post-comments">${commentsHtml}</div>
                    </div>
                </div>`;
    }
  });
}

// --- 3. FRIENDS & FORUM RECALL ---
async function loadFriends(uid) {
  const container = document.getElementById("friends-list");
  if (!container) return;
  const userSnap = await getDoc(doc(db, "users", uid));
  const following = userSnap.data()?.following || [];
  container.innerHTML = following.length ? "" : "<p>No pack members yet.</p>";
  for (const fId of following) {
    const fSnap = await getDoc(doc(db, "users", fId));
    if (fSnap.exists()) {
      container.innerHTML += `<div class="friend-pill">${fSnap.data().displayName}</div>`;
    }
  }
}

async function loadForum() {
  const container = document.getElementById("forum-topics");
  if (!container) return;
  const snap = await getDocs(collection(db, "forum"));
  container.innerHTML = "";
  snap.forEach((d) => {
    container.innerHTML += `<div class="forum-entry"><h4>${d.data().title}</h4></div>`;
  });
}

// --- 4. UTILITIES ---
window.handleWoof = async (postId, btn) => {
  const user = auth.currentUser;
  if (!user) return;
  const postRef = doc(db, "feedPosts", postId);
  const isActive = btn.classList.contains("active");
  await updateDoc(postRef, {
    likes: increment(isActive ? -1 : 1),
    likedBy: isActive ? arrayRemove(user.uid) : arrayUnion(user.uid),
  });
};
