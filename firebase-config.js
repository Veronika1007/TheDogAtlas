// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  where,
  deleteDoc,
  setDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// FIX: Added Storage imports for image uploading
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

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
    return ts.toDate().toLocaleString("en-GB", {
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
    updateCounter(user.uid);
  } else {
    if (loginLink) loginLink.classList.remove("hidden");
    if (logoutLink) logoutLink.classList.add("hidden");
    if (profileLink) profileLink.classList.add("hidden");

    const protectedPages = ["profile.html", "community.html"];
    const currentPage = window.location.pathname.split("/").pop();
    if (protectedPages.includes(currentPage)) {
      window.location.href = "login.html";
    }
  }
});

// --- AUTH FORM HANDLER ---
const authForm = document.getElementById("auth-form");
if (authForm) {
  authForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    const submitBtn = document.getElementById("auth-submit");
    const isLoginMode = submitBtn.innerText === "Login";

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Welcome back!");
      } else {
        const username = document.getElementById("auth-username").value;
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await setDoc(doc(db, "users", userCredential.user.uid), {
          displayName: username,
          email: email,
          createdAt: serverTimestamp(),
        });
        showToast("Welcome to the Pack!");
      }
      window.location.href = "profile.html";
    } catch (error) {
      alert(error.message);
    }
  };
}

// --- MEMBER DIRECTORY ---
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
    console.error("Directory error:", e);
  }
}

window.followUser = async (targetUserId, targetName) => {
  if (!auth.currentUser) return alert("Log in to follow!");
  try {
    const myUid = auth.currentUser.uid;
    await setDoc(
      doc(db, "users", myUid, "following", targetUserId),
      {
        displayName: targetName,
        followedAt: serverTimestamp(),
      },
      { merge: true }
    );
    await setDoc(
      doc(db, "users", targetUserId, "followers", myUid),
      {
        displayName: auth.currentUser.displayName || "A Pack Member",
        followedAt: serverTimestamp(),
      },
      { merge: true }
    );
    showToast(`Following ${targetName}!`);
    updateCounter(myUid);
  } catch (e) {
    console.error("Follow error:", e);
  }
};

// --- COUNTER LOGIC ---
async function updateCounter(uid) {
  const followingCount = document.getElementById("count-following");
  const packCount = document.getElementById("count-pack");
  if (followingCount) {
    const snap = await getDocs(collection(db, "users", uid, "following"));
    followingCount.innerText = snap.size;
  }
  if (packCount) {
    const snap = await getDocs(collection(db, "users", uid, "followers"));
    packCount.innerText = snap.size;
  }
}

// --- FORUM LOGIC ---
async function loadForumPosts() {
  const container = document.getElementById("dynamic-forum-list");
  if (!container) return;
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    container.innerHTML = "";
    snap.forEach((d) => {
      const post = d.data();
      container.innerHTML += `<div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:15px; background:white;">
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
    console.error("Forum error:", e);
  }
}

const postForm = document.getElementById("create-post-form");
if (postForm) {
  postForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return alert("Log in to post!");
    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const userData = userDoc.data() || {};
      await addDoc(collection(db, "posts"), {
        title: document.getElementById("post-title").value,
        description: document.getElementById("post-description").value,
        category: document.getElementById("post-category").value,
        authorId: auth.currentUser.uid,
        authorName: userData.displayName || "Anonymous Member",
        createdAt: serverTimestamp(),
      });
      showToast("Bark posted!");
      document.getElementById("new-post-modal").classList.add("hidden");
      postForm.reset();
      loadForumPosts();
    } catch (e) {
      alert("Post Error: " + e.message);
    }
  };
}

// --- PROFILE LOGIC ---
async function setupProfilePage(user) {
  const profileName = document.getElementById("profile-name");
  const avatarImg = document.getElementById("display-avatar");
  if (!profileName) return;

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const data = userDoc.exists() ? userDoc.data() : {};

  // FIX: Restore Avatar Visibility
  if (data.photoURL) avatarImg.src = data.photoURL;

  profileName.innerText = data.displayName || user.displayName || "Member";
  document.getElementById("public-city").innerText = data.city || "Not set";
  document.getElementById("public-bio").innerText = data.bio || "No bio yet.";

  // Populate Edit Fields
  document.getElementById("edit-username").value = data.displayName || "";
  document.getElementById("edit-email").value = user.email || "";
  document.getElementById("edit-city").value = data.city || "";
  document.getElementById("edit-postcode").value = data.postcode || "";
  document.getElementById("edit-bio").value = data.bio || "";
  document.getElementById("edit-dog-name").value = data.dogName || "";
  document.getElementById("edit-dog-age").value = data.dogAge || "";
  document.getElementById("edit-dog-breed").value = data.dogBreed || "";

  const badge = document.getElementById("public-dog-badge");
  if (data.dogName || data.dogBreed) {
    badge.style.display = "inline-flex";
    document.getElementById("public-dog-name").innerText = data.dogName || "";
    document.getElementById("public-dog-breed").innerText = data.dogBreed || "";
    document.getElementById("public-dog-age").innerText = data.dogAge
      ? `${data.dogAge} yrs`
      : "";
  }

  // FIX: RE-ATTACH BUTTON LISTENERS FOR REACTIVITY
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

  // FIX: Added image upload handler
  const avatarInput = document.getElementById("avatar-upload");
  if (avatarInput) {
    avatarInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) uploadProfileImage(user, file);
    };
  }

  document.getElementById("profile-edit-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
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
      showToast("Profile Saved!");
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      alert(err.message);
    }
  };
  renderUserPosts(user.uid);
}

// FIX: New Image Upload Logic using Firebase Storage
async function uploadProfileImage(user, file) {
  try {
    const storageRef = ref(storage, `profile_pictures/${user.uid}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    await setDoc(
      doc(db, "users", user.uid),
      { photoURL: downloadURL },
      { merge: true }
    );
    document.getElementById("display-avatar").src = downloadURL;
    showToast("Profile picture updated!");
  } catch (error) {
    alert("Failed to upload image.");
  }
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
  const countPosts = document.getElementById("count-posts");
  if (countPosts) countPosts.innerText = snap.size;

  container.innerHTML = snap.empty ? "<p>No barks yet.</p>" : "";
  snap.forEach((d) => {
    const post = d.data();
    // FIX: Added formatTimestamp(post.createdAt) to template
    container.innerHTML += `<div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:15px; background:white; text-align: left;">
        <h3 style="margin:0; color:#ff6b35;">${post.title}</h3>
        <p style="color:#444; margin: 8px 0;">${post.description}</p>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <small style="color:#888;">${formatTimestamp(post.createdAt)}</small>
          <button onclick="deletePost('${
            d.id
          }')" style="color:#ff4d4d; background:none; border:none; cursor:pointer; font-weight:bold;">Delete Bark</button>
        </div>
      </div>`;
  });
}

window.deletePost = async (id) => {
  if (confirm("Delete bark forever?")) {
    await deleteDoc(doc(db, "posts", id));
    showToast("Bark deleted.");
    location.reload();
  }
};

window.logoutUser = () =>
  signOut(auth).then(() => (location.href = "index.html"));
