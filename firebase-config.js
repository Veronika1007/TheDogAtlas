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
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

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

// --- HELPER: Format Timestamps ---
function formatTimestamp(timestamp) {
  if (!timestamp) return "Just now";
  const date = timestamp.toDate();
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- 2. Logic for community.html (Main Forum List) ---
async function loadForumPosts() {
  const forumContainer = document.getElementById("dynamic-forum-list");
  if (!forumContainer) return;

  try {
    // Sort by newest first
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    forumContainer.innerHTML = "";

    querySnapshot.forEach((doc) => {
      const post = doc.data();
      const readableDate = formatTimestamp(post.createdAt);

      forumContainer.innerHTML += `
            <a href="Forum Post/forum-detail.html?id=${
              doc.id
            }" class="forum-topic-link">
                <div class="forum-topic-card" style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <h3 style="margin: 0; color: #ff6b35;">${post.title}</h3>
                    <p style="color: #444;">${post.description}</p>
                    <div class="topic-meta">
                        <small style="color: #888;">Topic: ${
                          post.category || "General"
                        }</small>
                        <small style="color: #888;"> | Posted by: ${
                          post.authorName || "Guest"
                        }</small>
                        <small style="color: #888;"> | ${readableDate}</small>
                    </div>
                </div>
            </a>
        `;
    });
  } catch (error) {
    console.error("Error loading posts: ", error);
  }
}

// Forum Post Creation Logic
const openBtn = document.getElementById("open-post-form");
const cancelBtn = document.getElementById("cancel-post");
const modal = document.getElementById("new-post-modal");

if (openBtn) openBtn.onclick = () => modal.classList.remove("hidden");
if (cancelBtn) cancelBtn.onclick = () => modal.classList.add("hidden");

const postForm = document.getElementById("create-post-form");
if (postForm) {
  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      alert("Please log in to post!");
      window.location.href = "login.html";
      return;
    }

    const title = document.getElementById("post-title").value;
    const category = document.getElementById("post-category").value;
    const description = document.getElementById("post-description").value;

    try {
      await addDoc(collection(db, "posts"), {
        title: title,
        category: category,
        description: description,
        authorName: user.displayName || "Anonymous Dog",
        authorId: user.uid,
        createdAt: serverTimestamp(),
      });
      postForm.reset();
      modal.classList.add("hidden");
      loadForumPosts();
    } catch (error) {
      console.error("Error adding post: ", error);
    }
  });
}

// --- 3. Logic for forum-detail.html ---
const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get("id");

if (postId && document.getElementById("post-detail-container")) {
  renderPostDetail(postId);
  renderComments(postId);
  handleCommentSubmit(postId);
}

async function renderPostDetail(id) {
  const docRef = doc(db, "posts", id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const post = docSnap.data();
    document.getElementById("detail-title").innerText = post.title;
    document.getElementById("detail-description").innerText = post.description;
    document.getElementById("detail-category").innerText =
      post.category || "General";
  }
}

function renderComments(id) {
  const commentsList = document.getElementById("comments-list");
  const q = query(
    collection(db, "posts", id, "comments"),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snapshot) => {
    commentsList.innerHTML = "";
    if (snapshot.empty) {
      commentsList.innerHTML = '<p style="color: #888;">No comments yet.</p>';
      return;
    }
    snapshot.forEach((doc) => {
      const comment = doc.data();
      const readableDate = formatTimestamp(comment.createdAt);

      commentsList.innerHTML += `
                <div style="border-bottom: 1px solid #eee; padding: 15px 0;">
                    <p style="margin: 0; color: #333;">${comment.text}</p>
                    <div style="display: flex; gap: 10px; margin-top: 5px;">
                        <small style="color: #888;">Posted by: ${
                          comment.authorName || "Anonymous Member"
                        }</small>
                        <small style="color: #bbb;">• ${readableDate}</small>
                    </div>
                </div>
            `;
    });
  });
}

function handleCommentSubmit(id) {
  const commentForm = document.getElementById("add-comment-form");
  if (commentForm) {
    commentForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const user = auth.currentUser;
      if (!user) {
        alert("Login required to comment.");
        return;
      }
      const textValue = document.getElementById("comment-text").value;
      try {
        await addDoc(collection(db, "posts", id, "comments"), {
          text: textValue,
          authorName: user.displayName || "Anonymous Dog",
          authorId: user.uid,
          createdAt: serverTimestamp(),
        });
        commentForm.reset();
      } catch (error) {
        console.error("Error adding comment:", error);
      }
    });
  }
}

// --- 4. Auth & Navigation Logic ---
const authForm = document.getElementById("auth-form");
const authToggleBtn = document.getElementById("auth-toggle-btn");
const logoutLink = document.getElementById("logout-link");
const loginLink = document.getElementById("login-link");
let isLoginMode = true;

// Toggle Login/Signup Mode
if (authToggleBtn) {
  authToggleBtn.onclick = (e) => {
    e.preventDefault();
    isLoginMode = !isLoginMode;
    document.getElementById("auth-title").innerText = isLoginMode
      ? "Welcome Back"
      : "Join TheDogAtlas";
    document.getElementById("auth-submit").innerText = isLoginMode
      ? "Login"
      : "Sign Up";
    document.getElementById("auth-toggle-text").innerText = isLoginMode
      ? "Don't have an account?"
      : "Already a member?";
    authToggleBtn.innerText = isLoginMode ? "Sign Up" : "Login";

    // Toggle username field visibility
    const usernameField = document.getElementById("auth-username");
    if (usernameField)
      usernameField.style.display = isLoginMode ? "none" : "block";
  };
}

// Auth Form Submission
if (authForm) {
  authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    const username = document.getElementById("auth-username")?.value;

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        // Save the chosen ID name to the profile
        await updateProfile(userCredential.user, { displayName: username });
      }
      window.location.href = "community.html";
    } catch (error) {
      alert(error.message);
    }
  });
}

// Handle Logout
if (logoutLink) {
  logoutLink.addEventListener("click", (e) => {
    e.preventDefault();
    signOut(auth).then(() => {
      alert("Logged out!");
      window.location.href = "index.html";
    });
  });
}

// Monitor User Login Status
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("Logged in as:", user.displayName || user.email);
    if (loginLink) loginLink.classList.add("hidden");
    if (logoutLink) logoutLink.classList.remove("hidden");
  } else {
    console.log("Guest user");
    if (loginLink) loginLink.classList.remove("hidden");
    if (logoutLink) logoutLink.classList.add("hidden");
  }
});

if (document.getElementById("dynamic-forum-list")) {
  loadForumPosts();
}
