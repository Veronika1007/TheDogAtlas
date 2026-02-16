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
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// --- 1. Firebase Configuration ---
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

// --- HELPER: Toast Notification ---
function showToast(msg) {
  const toast = document.createElement("div");
  toast.style =
    "position: fixed; bottom: 20px; right: 20px; background: #2a9d8f; color: white; padding: 12px 25px; border-radius: 30px; font-weight: bold; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.1);";
  toast.innerText = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "Just now";
  try {
    return timestamp
      .toDate()
      .toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
  } catch (e) {
    return "Just now";
  }
}

// --- 2. GLOBAL AUTH & NAV TOGGLES ---
onAuthStateChanged(auth, async (user) => {
  const loginLink = document.getElementById("login-link");
  const logoutLink = document.getElementById("logout-link");
  const profileLink = document.getElementById("profile-link");

  if (user) {
    if (loginLink) loginLink.classList.add("hidden");
    if (logoutLink) logoutLink.classList.remove("hidden");
    if (profileLink) profileLink.classList.remove("hidden");

    if (document.getElementById("profile-edit-form")) setupProfilePage(user);
    if (document.getElementById("friends-grid")) loadMemberDirectory();
  } else {
    if (loginLink) loginLink.classList.remove("hidden");
    if (logoutLink) logoutLink.classList.add("hidden");
    if (profileLink) profileLink.classList.add("hidden");
    if (window.location.pathname.includes("profile.html"))
      window.location.href = "login.html";
  }
});

// --- 3. FORUM LOGIC with SEARCH ---
async function loadForumPosts(searchTerm = "") {
  const forumContainer = document.getElementById("dynamic-forum-list");
  if (!forumContainer) return;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    forumContainer.innerHTML = "";

    snap.forEach((doc) => {
      const post = doc.data();
      const title = post.title || "Untitled";
      const desc = post.description || "";

      // Filter logic
      if (
        searchTerm &&
        !title.toLowerCase().includes(searchTerm.toLowerCase()) &&
        !desc.toLowerCase().includes(searchTerm.toLowerCase())
      )
        return;

      forumContainer.innerHTML += `
        <div class="forum-topic-card" style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-bottom: 10px; background: white;">
          <a href="Forum Post/forum-detail.html?id=${
            doc.id
          }" style="text-decoration: none;">
            <h3 style="margin: 0; color: #ff6b35;">${title}</h3>
            <p style="color: #444;">${desc}</p>
            <small style="color: #888;">By ${
              post.authorName || "Guest"
            } | ${formatTimestamp(post.createdAt)}</small>
          </a>
        </div>`;
    });
  } catch (err) {
    console.error(err);
  }
}

// Forum Search Listener
const forumSearch = document.getElementById("forum-search");
if (forumSearch) forumSearch.oninput = (e) => loadForumPosts(e.target.value);

// --- 4. FRIENDS / MEMBER DIRECTORY ---
async function loadMemberDirectory() {
  const grid = document.getElementById("friends-grid");
  if (!grid) return;

  try {
    const snap = await getDocs(collection(db, "users"));
    grid.innerHTML = "";
    snap.forEach((d) => {
      const user = d.data();
      grid.innerHTML += `
                <div class="friend-row-card" style="display:flex; gap:15px; align-items:center; background:white; padding:15px; border-radius:12px; border:1px solid #ddd;">
                    <img src="${
                      user.photoURL || "https://via.placeholder.com/60"
                    }" style="width:60px; height:60px; border-radius:50%; object-fit:cover;">
                    <div>
                        <h4 style="margin:0;">${
                          user.dogName || "Dog Parent"
                        }</h4>
                        <p style="margin:0; font-size:13px; color:#888;">${
                          user.dogBreed || "Community Member"
                        }</p>
                        <span style="font-size:11px; color:#aaa;">@${
                          user.displayName || "Anonymous"
                        }</span>
                    </div>
                </div>`;
    });
  } catch (e) {
    console.error(e);
  }
}

// --- 5. PROFILE PAGE LOGIC ---
async function setupProfilePage(user) {
  document.getElementById("profile-name").innerText =
    user.displayName || "Member";
  document.getElementById("profile-email").innerText = user.email || "";
  document.getElementById("edit-username").value = user.displayName || "";
  if (user.photoURL)
    document.getElementById("display-avatar").src = user.photoURL;

  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (userDoc.exists()) {
    const data = userDoc.data();
    document.getElementById("edit-bio").value = data.bio || "";
    document.getElementById("edit-dog-name").value = data.dogName || "";
    document.getElementById("edit-dog-breed").value = data.dogBreed || "";
  }

  document.getElementById("profile-edit-form").onsubmit = async (e) => {
    e.preventDefault();
    await updateProfile(user, {
      displayName: document.getElementById("edit-username").value,
    });
    await setDoc(
      doc(db, "users", user.uid),
      {
        bio: document.getElementById("edit-bio").value,
        dogName: document.getElementById("edit-dog-name").value,
        dogBreed: document.getElementById("edit-dog-breed").value,
        photoURL: user.photoURL || "",
      },
      { merge: true }
    );
    showToast("Profile Saved!");
  };

  const avatarInput = document.getElementById("avatar-input");
  avatarInput.onchange = async (e) => {
    const file = e.target.files[0];
    const storageRef = ref(storage, `profiles/${user.uid}`);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await updateProfile(user, { photoURL: url });
    await setDoc(
      doc(db, "users", user.uid),
      { photoURL: url },
      { merge: true }
    );
    document.getElementById("display-avatar").src = url;
    showToast("Avatar Updated!");
  };
}

// Logout Global
window.logoutUser = () =>
  signOut(auth).then(() => (window.location.href = "index.html"));

if (document.getElementById("dynamic-forum-list")) loadForumPosts();
