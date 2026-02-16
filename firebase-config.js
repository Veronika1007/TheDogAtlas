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

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- 2. Logic for community.html (Main Forum List) ---
async function loadForumPosts() {
  const forumContainer = document.getElementById("dynamic-forum-list");
  if (!forumContainer) return; // Exit if we are not on the community page

  try {
    const querySnapshot = await getDocs(collection(db, "posts"));
    forumContainer.innerHTML = "";

    querySnapshot.forEach((doc) => {
      const post = doc.data();
      forumContainer.innerHTML += `
            <a href="Forum Post/forum-detail.html?id=${
              doc.id
            }" class="forum-topic-link">
                <div class="forum-topic-card" style="border: 1px solid #ddd; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <h3 style="margin: 0; color: #ff6b35;">${post.title}</h3>
                    <p style="color: #444;">${post.description}</p>
                    <small style="color: #888;">Topic: ${
                      post.category || "General"
                    }</small>
                </div>
            </a>
        `;
    });
  } catch (error) {
    console.error("Error loading posts: ", error);
  }
}

// Logic for the New Topic Modal
const openBtn = document.getElementById("open-post-form");
const cancelBtn = document.getElementById("cancel-post");
const modal = document.getElementById("new-post-modal");

if (openBtn) openBtn.onclick = () => modal.classList.remove("hidden");
if (cancelBtn) cancelBtn.onclick = () => modal.classList.add("hidden");

const postForm = document.getElementById("create-post-form");
if (postForm) {
  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = document.getElementById("post-title").value;
    const category = document.getElementById("post-category").value;
    const description = document.getElementById("post-description").value;

    try {
      await addDoc(collection(db, "posts"), {
        title: title,
        category: category,
        description: description,
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

// --- 3. Logic for forum-detail.html (Single Post & Comments) ---
const urlParams = new URLSearchParams(window.location.search);
const postId = urlParams.get("id");

// Only run this if we are on the detail page
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
      commentsList.innerHTML += `
                <div style="border-bottom: 1px solid #eee; padding: 15px 0;">
                    <p style="margin: 0; color: #333;">${comment.text}</p>
                    <small style="color: #888;">Posted by Community Member</small>
                </div>
            `;
    });
  });
}

function handleCommentSubmit(id) {
  const commentForm = document.getElementById("add-comment-form");
  commentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const textValue = document.getElementById("comment-text").value;

    try {
      await addDoc(collection(db, "posts", id, "comments"), {
        text: textValue,
        createdAt: serverTimestamp(),
      });
      commentForm.reset();
    } catch (error) {
      console.error("Error adding comment:", error);
    }
  });
}

// Load main list if container exists
if (document.getElementById("dynamic-forum-list")) {
  loadForumPosts();
}
