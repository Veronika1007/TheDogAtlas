// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
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

// --- 2. Function to Fetch and Display Forum Posts ---
async function loadForumPosts() {
  const forumContainer = document.getElementById("dynamic-forum-list");
  if (!forumContainer) return;

  try {
    const querySnapshot = await getDocs(collection(db, "posts"));
    forumContainer.innerHTML = ""; // Clear existing content

    querySnapshot.forEach((doc) => {
      const post = doc.data();
      // This creates the HTML for each post card dynamically
      forumContainer.innerHTML += `
            <a href="Forum Post/forum-detail.html?id=${
              doc.id
            }" class="forum-topic-link">
                <div class="forum-topic-card">
                    <h3>${post.title}</h3>
                    <p>${post.description}</p>
                    <div class="topic-meta">
                        <small>Topic: ${post.category || "General"}</small>
                        <span><i class="fa-solid fa-paw"></i> 0 Woofs</span>
                        <span><i class="fa-regular fa-comment"></i> 0 Comments</span>
                    </div>
                </div>
            </a>
        `;
    });
  } catch (error) {
    console.error("Error loading posts: ", error);
  }
}

// --- 3. UI Logic for the "New Topic" Form ---
const openBtn = document.getElementById("open-post-form");
const cancelBtn = document.getElementById("cancel-post");
const modal = document.getElementById("new-post-modal");

if (openBtn) {
  openBtn.onclick = () => modal.classList.remove("hidden");
}
if (cancelBtn) {
  cancelBtn.onclick = () => {
    modal.classList.add("hidden");
    document.getElementById("create-post-form").reset();
  };
}

// --- 4. Logic to Save a New Post to Firebase ---
const postForm = document.getElementById("create-post-form");
if (postForm) {
  postForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Get values from the form
    const title = document.getElementById("post-title").value;
    const category = document.getElementById("post-category").value;
    const description = document.getElementById("post-description").value;

    try {
      // Add a new document to the "posts" collection
      await addDoc(collection(db, "posts"), {
        title: title,
        category: category,
        description: description,
        createdAt: serverTimestamp(), // Adds a server-side timestamp
      });

      // Reset form, hide modal, and refresh list
      postForm.reset();
      modal.classList.add("hidden");
      await loadForumPosts();
      alert("Post successful!");
    } catch (error) {
      console.error("Error adding post: ", error);
      alert(
        "Could not post. Make sure your Firebase Rules are set to Test Mode."
      );
    }
  });
}

// Initial load of posts when the script runs
loadForumPosts();
