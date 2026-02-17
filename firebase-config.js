// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  where,
  deleteDoc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  updateProfile,
  updateEmail,
  updatePassword,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Helpers
function formatTimestamp(ts) {
  if (!ts) return "Just now";
  try {
    return ts
      .toDate()
      .toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
  } catch (e) {
    return "Just now";
  }
}

function showToast(msg) {
  const toast = document.createElement("div");
  toast.style =
    "position: fixed; bottom: 20px; right: 20px; background: #2a9d8f; color: white; padding: 12px 25px; border-radius: 30px; font-weight: bold; z-index: 9999;";
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// --- GLOBAL AUTH OBSERVER ---
onAuthStateChanged(auth, async (user) => {
  const loginLink = document.getElementById("login-link");
  const logoutLink = document.getElementById("logout-link");
  const profileLink = document.getElementById("profile-link");

  if (user) {
    if (loginLink) loginLink.classList.add("hidden");
    if (logoutLink) logoutLink.classList.remove("hidden");
    if (profileLink) profileLink.classList.remove("hidden");

    if (document.getElementById("profile-name")) setupProfilePage(user);
    if (document.getElementById("friends-grid")) loadMemberDirectory();
    if (document.getElementById("dynamic-forum-list")) loadForumPosts();
  } else {
    if (loginLink) loginLink.classList.remove("hidden");
    if (logoutLink) logoutLink.classList.add("hidden");
    if (profileLink) profileLink.classList.add("hidden");
    if (window.location.pathname.includes("profile.html"))
      window.location.href = "login.html";
  }
});

// --- MEMBER DIRECTORY (FOLLOW LOGIC) ---
async function loadMemberDirectory() {
  const container = document.getElementById("friends-grid");
  if (!container) return;
  try {
    const q = query(collection(db, "users"));
    const snap = await getDocs(q);
    container.innerHTML = "";
    snap.forEach((d) => {
      const member = d.data();
      if (d.id === auth.currentUser?.uid) return;
      container.innerHTML += `
        <div class="friend-row-card">
          <img src="${
            member.photoURL || "https://via.placeholder.com/80"
          }" class="row-avatar">
          <div style="flex:1">
            <div class="row-header">
              <span class="username">${member.displayName || "Anonymous"}</span>
              <button class="follow-btn-small" onclick="followUser('${
                d.id
              }', '${member.displayName || "Member"}')">Follow</button>
            </div>
            <div class="breed-tag">${member.dogBreed || "Dog Lover"}</div>
          </div>
        </div>`;
    });
  } catch (e) {
    console.error(e);
  }
}

window.followUser = async (targetUserId, targetName) => {
  if (!auth.currentUser) return alert("Log in to follow!");
  try {
    await setDoc(
      doc(db, "users", auth.currentUser.uid, "following", targetUserId),
      {
        displayName: targetName,
        followedAt: serverTimestamp(),
      }
    );
    showToast(`Following ${targetName}!`);
  } catch (e) {
    console.error(e);
  }
};

// --- FORUM LOGIC ---
async function loadForumPosts() {
  const container = document.getElementById("dynamic-forum-list");
  if (!container) return;
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    container.innerHTML = "";
    if (snap.empty) {
      container.innerHTML = "<p>No topics found.</p>";
      return;
    }
    snap.forEach((d) => {
      const post = d.data();
      container.innerHTML += `<div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:10px; background:white;">
          <a href="Forum Post/forum-detail.html?id=${
            d.id
          }" style="text-decoration:none;">
            <h3 style="margin:0; color:#ff6b35;">${post.title}</h3>
            <p style="color:#444; margin: 8px 0;">${post.description}</p>
            <small style="color:#888;">By ${
              post.authorName || "Guest"
            } | ${formatTimestamp(post.createdAt)}</small>
          </a>
        </div>`;
    });
  } catch (e) {
    console.error(e);
  }
}

// --- PROFILE LOGIC (FIXED NAME & TOGGLES) ---
async function setupProfilePage(user) {
  const profileName = document.getElementById("profile-name");
  const avatarImg = document.getElementById("display-avatar");
  const usernameInput = document.getElementById("edit-username");
  if (!profileName) return;

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const data = userDoc.exists() ? userDoc.data() : {};

  // FIX: Prioritize displayName over email
  profileName.innerText = data.displayName || "Member";
  if (usernameInput) usernameInput.value = data.displayName || "";

  const emailInput = document.getElementById("edit-email");
  if (emailInput) emailInput.value = user.email;

  if (data.photoURL || user.photoURL)
    avatarImg.src = data.photoURL || user.photoURL;

  // Populate public info
  document.getElementById("public-city").innerText = data.city || "Not set";
  document.getElementById("public-bio").innerText = data.bio || "No bio yet.";

  // Populate other fields
  ["city", "postcode", "bio", "dog-name", "dog-breed", "dog-age"].forEach(
    (f) => {
      const el = document.getElementById(`edit-${f}`);
      if (el) el.value = data[f.replace("-", "")] || "";
    }
  );

  // Toggle Fixes
  const viewPublic = document.getElementById("view-public");
  const viewEdit = document.getElementById("view-edit");
  const loginSec = document.getElementById("login-credentials-section");
  const generalSec = document.getElementById("general-info-section");

  document.getElementById("btn-edit-toggle").onclick = () => {
    viewPublic.classList.add("hidden");
    viewEdit.classList.remove("hidden");
    loginSec.classList.add("hidden");
    generalSec.classList.remove("hidden");
  };
  document.getElementById("btn-login-details-toggle").onclick = () => {
    viewPublic.classList.add("hidden");
    viewEdit.classList.remove("hidden");
    loginSec.classList.remove("hidden");
    generalSec.classList.add("hidden");
  };
  document.getElementById("btn-cancel-edit").onclick = () => {
    viewPublic.classList.remove("hidden");
    viewEdit.classList.add("hidden");
  };

  document.getElementById("profile-edit-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      if (!generalSec.classList.contains("hidden")) {
        await setDoc(
          doc(db, "users", user.uid),
          {
            displayName: document.getElementById("edit-username").value,
            city: document.getElementById("edit-city").value,
            postcode: document.getElementById("edit-postcode").value,
            bio: document.getElementById("edit-bio").value,
            dogName: document.getElementById("edit-dog-name").value,
            dogBreed: document.getElementById("edit-dog-breed").value,
            dogAge: document.getElementById("edit-dog-age").value,
          },
          { merge: true }
        );
      }
      showToast("Updated!");
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      alert(err.message);
    }
  };

  renderUserPosts(user.uid);
}

async function renderUserPosts(uid) {
  const container = document.getElementById("my-posts-list");
  if (!container) return;
  const q = query(
    collection(db, "posts"),
    where("authorId", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  container.innerHTML = snap.empty ? "<p>No barks yet.</p>" : "";
  snap.forEach((d) => {
    const post = d.data();
    container.innerHTML += `<div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; background:white; margin-bottom:10px;">
        <h3 style="margin:0; color:#ff6b35;">${post.title}</h3>
        <p style="color:#444; margin: 8px 0;">${post.description}</p>
        <small style="color:#888;">${formatTimestamp(post.createdAt)}</small>
      </div>`;
  });
}

window.logoutUser = () =>
  signOut(auth).then(() => (location.href = "index.html"));
