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

// --- HELPERS ---
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

    // Community Page Loaders
    if (document.getElementById("friends-grid")) {
      loadMyPack(); // Load the Pack section
      loadMemberDirectory(); // Load the New Friends section
    }
    if (
      document.getElementById("dynamic-forum-list") ||
      document.getElementById("section-posts")
    ) {
      loadForumPosts(); // Load posts into both Feed and Forum
    }
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
      }
      window.location.href = "profile.html";
    } catch (error) {
      alert(error.message);
    }
  };
}

// --- MEMBER DIRECTORY (NEW FRIENDS) ---
async function loadMemberDirectory() {
  const container = document.getElementById("friends-grid");
  if (!container) return;
  try {
    const myUid = auth.currentUser?.uid;
    // Get following IDs to filter them out of "New Friends"
    let followingIds = [];
    if (myUid) {
      const followSnap = await getDocs(
        collection(db, "users", myUid, "following")
      );
      followingIds = followSnap.docs.map((d) => d.id);
    }

    const q = query(collection(db, "users"));
    const snap = await getDocs(q);
    container.innerHTML = "";
    snap.forEach((d) => {
      const member = d.data();
      if (d.id === myUid || followingIds.includes(d.id)) return;

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

// --- MY PACK LOGIC ---
async function loadMyPack() {
  const container = document.getElementById("following-grid");
  if (!container) return;
  const myUid = auth.currentUser?.uid;
  if (!myUid) return;

  try {
    const snap = await getDocs(collection(db, "users", myUid, "following"));
    container.innerHTML = snap.empty ? "<p>No pack members yet.</p>" : "";

    for (const followDoc of snap.docs) {
      const userDoc = await getDoc(doc(db, "users", followDoc.id));
      if (userDoc.exists()) {
        const member = userDoc.data();
        container.innerHTML += `
          <div class="friend-row-card">
            <img src="${
              member.photoURL || "https://via.placeholder.com/80"
            }" class="row-avatar">
            <div style="flex:1">
              <div class="row-header">
                <span class="username">${
                  member.displayName || "Anonymous"
                }</span>
                <span class="breed-tag" style="background:#fff4f0; color:var(--primary); padding:2px 10px; border-radius:10px">Following</span>
              </div>
              <div class="breed-tag">${member.dogBreed || "Dog Lover"}</div>
            </div>
          </div>`;
      }
    }
  } catch (e) {
    console.error("Pack loading error:", e);
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
    loadMyPack(); // Move the friend up to My Pack immediately
    loadMemberDirectory(); // Remove them from New Friends
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

// --- FORUM & FEED LOGIC ---
async function loadForumPosts() {
  const forumContainer = document.getElementById("dynamic-forum-list");
  const feedContainer = document.getElementById("section-posts");
  if (!forumContainer && !feedContainer) return;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    if (forumContainer) forumContainer.innerHTML = "";
    if (feedContainer) feedContainer.innerHTML = "";

    snap.forEach((d) => {
      const post = d.data();
      const postHtml = `<div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:15px; background:white;">
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

      if (forumContainer) forumContainer.innerHTML += postHtml;
      if (feedContainer) feedContainer.innerHTML += postHtml;
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
  if (!profileName) return;

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const data = userDoc.exists() ? userDoc.data() : {};

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

  // Toggles
  const btnEdit = document.getElementById("btn-edit-toggle");
  const btnLogin = document.getElementById("btn-login-details-toggle");
  const btnCancel = document.getElementById("btn-cancel-edit");

  if (btnEdit) {
    btnEdit.onclick = () => {
      document.getElementById("view-public").classList.add("hidden");
      document.getElementById("view-edit").classList.remove("hidden");
      document
        .getElementById("login-credentials-section")
        .classList.add("hidden");
      document
        .getElementById("general-info-section")
        .classList.remove("hidden");
    };
  }
  if (btnLogin) {
    btnLogin.onclick = () => {
      document.getElementById("view-public").classList.add("hidden");
      document.getElementById("view-edit").classList.remove("hidden");
      document
        .getElementById("login-credentials-section")
        .classList.remove("hidden");
      document.getElementById("general-info-section").classList.add("hidden");
    };
  }
  if (btnCancel) {
    btnCancel.onclick = () => {
      document.getElementById("view-public").classList.remove("hidden");
      document.getElementById("view-edit").classList.add("hidden");
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
    container.innerHTML += `
      <div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:15px; background:white; text-align: left;">
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
  if (confirm("Delete bark?")) {
    await deleteDoc(doc(db, "posts", id));
    location.reload();
  }
};

window.logoutUser = () =>
  signOut(auth).then(() => (location.href = "index.html"));
