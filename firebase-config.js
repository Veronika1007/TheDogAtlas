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

// Helper: Format Timestamps
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

// --- 2. GLOBAL AUTH OBSERVER ---
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

// --- 3. LOGIN & SIGN-UP LOGIC ---
const authForm = document.getElementById("auth-form");
if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    const username = document.getElementById("auth-username")?.value;
    const isLoginMode =
      document.getElementById("auth-submit").innerText === "Login";

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        await updateProfile(cred.user, { displayName: username });
        await setDoc(doc(db, "users", cred.user.uid), {
          uid: cred.user.uid,
          displayName: username,
          dogName: "",
          dogBreed: "",
          bio: "",
          createdAt: serverTimestamp(),
        });
      }
      window.location.href = "community.html";
    } catch (err) {
      alert(err.message);
    }
  });
}

// --- 4. FORUM LOGIC (Restore Global Feed) ---
async function loadForumPosts() {
  const container = document.getElementById("dynamic-forum-list");
  if (!container) return;
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    container.innerHTML = "";
    snap.forEach((d) => {
      const post = d.data();
      container.innerHTML += `
        <div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:10px; background:white;">
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
    console.error("Forum Error:", e);
  }
}

// --- 5. POST DETAIL PAGE LOGIC (Restored Fix) ---
const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get("id");

if (postId && document.getElementById("post-detail-container")) {
  renderPostDetail(postId);
  renderComments(postId);
  handleCommentSubmit(postId);
}

async function renderPostDetail(id) {
  try {
    const docSnap = await getDoc(doc(db, "posts", id));
    if (docSnap.exists()) {
      const post = docSnap.data();
      document.getElementById("detail-title").innerText = post.title;
      document.getElementById("detail-description").innerText =
        post.description;
      document.getElementById("detail-author").innerText = `Posted by: ${
        post.authorName || "Guest"
      }`;
    }
  } catch (err) {
    console.error("Post Detail Error:", err);
  }
}

function renderComments(id) {
  const list = document.getElementById("comments-list");
  const q = query(
    collection(db, "posts", id, "comments"),
    orderBy("createdAt", "desc")
  );
  onSnapshot(q, (snapshot) => {
    list.innerHTML = "";
    if (snapshot.empty)
      return (list.innerHTML = "<p style='color:#888;'>No barks yet.</p>");
    snapshot.forEach((doc) => {
      const comment = doc.data();
      list.innerHTML += `
        <div style="border-bottom: 1px solid #eee; padding: 15px 0;">
          <p style="margin:0; color:#333;">${comment.text}</p>
          <small style="color:#888;">By ${
            comment.authorName || "Anonymous"
          } • ${formatTimestamp(comment.createdAt)}</small>
        </div>`;
    });
  });
}

function handleCommentSubmit(id) {
  const form = document.getElementById("add-comment-form");
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return alert("Please log in to comment!");
    try {
      await addDoc(collection(db, "posts", id, "comments"), {
        text: document.getElementById("comment-text").value,
        authorName: user.displayName || "Anonymous Dog",
        authorId: user.uid,
        createdAt: serverTimestamp(),
      });
      document.getElementById("comment-text").value = "";
    } catch (err) {
      console.error(err);
    }
  };
}

// --- 6. FRIENDS & DISCOVERY ---
async function loadMemberDirectory() {
  const grid = document.getElementById("friends-grid");
  const followingGrid = document.getElementById("following-grid");
  if (!grid || !auth.currentUser) return;
  try {
    const followingSnap = await getDocs(
      collection(db, "users", auth.currentUser.uid, "following")
    );
    const followingIds = followingSnap.docs.map((d) => d.id);
    const allUsersSnap = await getDocs(collection(db, "users"));
    grid.innerHTML = "";
    if (followingGrid) followingGrid.innerHTML = "";
    allUsersSnap.forEach((d) => {
      if (d.id === auth.currentUser.uid) return;
      const user = d.data();
      const card = `<div class="friend-row-card" style="display:flex; gap:15px; align-items:center; background:white; padding:15px; border-radius:12px; border:1px solid #ddd; margin-bottom:10px;">
                <img src="${
                  user.photoURL || "https://via.placeholder.com/60"
                }" style="width:60px; height:60px; border-radius:50%; object-fit:cover;">
                <div style="flex-grow:1;">
                    <h4>${user.dogName || user.displayName || "Member"}</h4>
                    <p style="margin:0; font-size:12px; color:#888;">${
                      user.dogBreed || "Dog Parent"
                    }</p>
                </div>
                ${
                  followingIds.includes(d.id)
                    ? "<span>My Pack</span>"
                    : `<button onclick="followUser('${d.id}')" class="follow-btn-small">Follow</button>`
                }
            </div>`;
      if (followingIds.includes(d.id) && followingGrid)
        followingGrid.innerHTML += card;
      else grid.innerHTML += card;
    });
  } catch (e) {
    console.error("Discovery error:", e);
  }
}

window.followUser = async (tid) => {
  await setDoc(doc(db, "users", auth.currentUser.uid, "following", tid), {
    followedAt: serverTimestamp(),
  });
  showToast("Added to pack!");
  loadMemberDirectory();
};

// --- 7. PROFILE LOGIC ---
async function setupProfilePage(user) {
  document.getElementById("profile-name").innerText =
    user.displayName || "Member";
  document.getElementById("profile-email").innerText = user.email;
  if (user.photoURL)
    document.getElementById("display-avatar").src = user.photoURL;

  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (userDoc.exists()) {
    const data = userDoc.data();
    if (document.getElementById("edit-username"))
      document.getElementById("edit-username").value =
        data.displayName || user.displayName || "";
    if (document.getElementById("edit-bio"))
      document.getElementById("edit-bio").value = data.bio || "";
    if (document.getElementById("edit-dog-name"))
      document.getElementById("edit-dog-name").value = data.dogName || "";
    if (document.getElementById("edit-dog-breed"))
      document.getElementById("edit-dog-breed").value = data.dogBreed || "";
  }
  renderUserPosts(user.uid);

  const editForm = document.getElementById("profile-edit-form");
  if (editForm) {
    editForm.onsubmit = async (e) => {
      e.preventDefault();
      const newName = document.getElementById("edit-username").value;
      await updateProfile(user, { displayName: newName });
      await setDoc(
        doc(db, "users", user.uid),
        {
          displayName: newName,
          bio: document.getElementById("edit-bio").value,
          dogName: document.getElementById("edit-dog-name").value,
          dogBreed: document.getElementById("edit-dog-breed").value,
        },
        { merge: true }
      );
      showToast("Profile Saved!");
      setTimeout(() => location.reload(), 1000);
    };
  }
}

async function renderUserPosts(uid) {
  const container = document.getElementById("my-posts-list");
  if (!container) return;
  try {
    const q = query(
      collection(db, "posts"),
      where("authorId", "==", uid),
      orderBy("createdAt", "desc")
    );
    const snap = await getDocs(q);
    container.innerHTML = snap.empty ? "<p>No barks yet.</p>" : "";
    snap.forEach((d) => {
      container.innerHTML += `<div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; background:white; margin-bottom:10px;">
        <h3 style="margin:0;">${d.data().title}</h3>
        <button onclick="deletePost('${
          d.id
        }')" style="color:red; background:none; border:none; cursor:pointer; font-size:12px;">Delete</button>
      </div>`;
    });
  } catch (err) {
    console.error(err);
  }
}

window.deletePost = async (id) => {
  if (confirm("Remove this bark?")) {
    await deleteDoc(doc(db, "posts", id));
    location.reload();
  }
};

window.logoutUser = () =>
  signOut(auth).then(() => (window.location.href = "index.html"));
