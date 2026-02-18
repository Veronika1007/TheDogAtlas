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
  updateDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
    if (document.getElementById("friends-grid")) {
      loadMyPack();
      loadMemberDirectory();
    }
    if (document.getElementById("dynamic-forum-list")) loadForumPosts();
    if (document.getElementById("post-detail-container")) loadPostDetails();
    updateCounter(user.uid);
  } else {
    if (loginLink) loginLink.classList.remove("hidden");
    if (logoutLink) logoutLink.classList.add("hidden");
    if (profileLink) profileLink.classList.add("hidden");

    const protectedPages = [
      "profile.html",
      "community.html",
      "forum-detail.html",
    ];
    if (protectedPages.some((p) => window.location.pathname.includes(p))) {
      window.location.href = window.location.pathname.includes("Forum Post")
        ? "../login.html"
        : "login.html";
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

// --- FORUM DETAIL + IMPROVED EDIT UI ---
async function loadPostDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get("id");
  if (!postId) return;

  try {
    const postSnap = await getDoc(doc(db, "posts", postId));
    if (postSnap.exists()) {
      const post = postSnap.data();
      document.getElementById("detail-title").innerText = post.title;
      document.getElementById("detail-author").innerText = `By ${
        post.authorName
      } | ${formatTimestamp(post.createdAt)}`;
      document.getElementById("detail-description").innerText =
        post.description;

      if (auth.currentUser && auth.currentUser.uid === post.authorId) {
        const editBtn = document.createElement("button");
        editBtn.id = "main-edit-btn";
        editBtn.innerText = "Edit Bark";
        editBtn.className = "follow-btn-small";
        editBtn.style.marginTop = "15px";
        editBtn.onclick = () => enableEditMode(postId, post.description);
        document.getElementById("post-detail-container").appendChild(editBtn);
      }
    }
  } catch (e) {
    console.error(e);
  }
}

function enableEditMode(id, originalText) {
  const desc = document.getElementById("detail-description");
  const editBtn = document.getElementById("main-edit-btn");

  // Hide the "Edit Bark" button
  if (editBtn) editBtn.style.display = "none";

  desc.innerHTML = `
    <textarea id="edit-post-text" style="width:100%; min-height:120px; padding:12px; margin-top:10px; border-radius:8px; border:1px solid #ddd; font-family:inherit;">${originalText}</textarea>
    <div style="display:flex; gap:10px; margin-top:10px;">
      <button id="save-edit-btn" class="follow-btn-small" style="flex:1;">Save Changes</button>
      <button id="cancel-edit-btn" class="btn-outline" style="flex:1;">Cancel</button>
    </div>
  `;

  document.getElementById("save-edit-btn").onclick = async () => {
    const newText = document.getElementById("edit-post-text").value;
    await updateDoc(doc(db, "posts", id), { description: newText });
    showToast("Bark updated!");
    location.reload();
  };

  document.getElementById("cancel-edit-btn").onclick = () => {
    desc.innerText = originalText;
    if (editBtn) editBtn.style.display = "block";
  };
}

// --- CREATE TOPIC ---
const postForm = document.getElementById("create-post-form");
if (postForm) {
  postForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!auth.currentUser) return alert("Log in to post!");
    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const userData = userDoc.data() || {};
      const docRef = await addDoc(collection(db, "posts"), {
        title: document.getElementById("post-title").value,
        description: document.getElementById("post-description").value,
        category: document.getElementById("post-category")?.value || "General",
        authorId: auth.currentUser.uid,
        authorName: userData.displayName || "Anonymous",
        createdAt: serverTimestamp(),
      });
      showToast("Bark posted!");
      window.location.href = `Forum Post/forum-detail.html?id=${docRef.id}`;
    } catch (e) {
      alert(e.message);
    }
  };
}

// --- REMAINING LOGIC (PACK, DIRECTORY, FORUM LIST, PROFILE, CROP) ---
// (Included in full but truncated here for brevity in the response view—ensure you copy the whole block)

async function loadMemberDirectory() {
  const container = document.getElementById("friends-grid");
  if (!container) return;
  try {
    const myUid = auth.currentUser?.uid;
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
    console.error(e);
  }
}

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
    console.error(e);
  }
}

window.followUser = async (targetUserId, targetName) => {
  if (!auth.currentUser) return alert("Log in to follow!");
  try {
    const myUid = auth.currentUser.uid;
    await setDoc(
      doc(db, "users", myUid, "following", targetUserId),
      { displayName: targetName, followedAt: serverTimestamp() },
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
    loadMyPack();
    loadMemberDirectory();
  } catch (e) {
    console.error(e);
  }
};

async function updateCounter(uid) {
  const followingCount = document.getElementById("count-following");
  const packCount = document.getElementById("count-pack");
  const postsCount = document.getElementById("count-posts");
  if (followingCount) {
    const snap = await getDocs(collection(db, "users", uid, "following"));
    followingCount.innerText = snap.size;
  }
  if (packCount) {
    const snap = await getDocs(collection(db, "users", uid, "followers"));
    packCount.innerText = snap.size;
  }
  if (postsCount) {
    const q = query(collection(db, "posts"), where("authorId", "==", uid));
    const snap = await getDocs(q);
    postsCount.innerText = snap.size;
  }
}

async function loadForumPosts() {
  const forumContainer = document.getElementById("dynamic-forum-list");
  if (!forumContainer) return;
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    forumContainer.innerHTML = "";
    snap.forEach((d) => {
      const post = d.data();
      const detailPath = window.location.pathname.includes("Forum Post")
        ? `forum-detail.html?id=${d.id}`
        : `Forum Post/forum-detail.html?id=${d.id}`;
      forumContainer.innerHTML += `
        <div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:15px; background:white;">
          <a href="${detailPath}" style="text-decoration:none; color:inherit;">
            <h3 style="margin:0; color:#ff6b35;">${post.title}</h3>
            <p style="color:#444; margin: 8px 0;">${post.description.substring(
              0,
              100
            )}...</p>
            <small style="color:#888;">By ${
              post.authorName
            } | ${formatTimestamp(post.createdAt)}</small>
          </a>
        </div>`;
    });
  } catch (e) {
    console.error(e);
  }
}

async function setupProfilePage(user) {
  const profileName = document.getElementById("profile-name");
  const avatarImg = document.getElementById("display-avatar");
  if (!profileName) return;

  // 1. Fetch current data from Firestore to ensure we have the most recent info
  const userDoc = await getDoc(doc(db, "users", user.uid));
  const data = userDoc.exists() ? userDoc.data() : {};

  // FIX: Priority for Display Name (Firestore > Auth > "Member")
  profileName.innerText = data.displayName || user.displayName || "Member";

  // Set Profile Image if it exists
  if (data.photoURL) avatarImg.src = data.photoURL;
  document.getElementById("public-city").innerText = data.city || "Not set";
  document.getElementById("public-bio").innerText = data.bio || "No bio yet.";

  // 2. Populate Edit Fields (Ensures we don't lose data on the next save)
  document.getElementById("edit-username").value = data.displayName || "";
  document.getElementById("edit-email").value = user.email; // Email is read-only
  document.getElementById("edit-city").value = data.city || "";
  document.getElementById("edit-postcode").value = data.postcode || "";
  document.getElementById("edit-bio").value = data.bio || "";
  document.getElementById("edit-dog-name").value = data.dogName || "";
  document.getElementById("edit-dog-age").value = data.dogAge || "";
  document.getElementById("edit-dog-breed").value = data.dogBreed || "";

  // 3. Dog Badge Visibility Logic
  const badge = document.getElementById("public-dog-badge");
  if (data.dogName || data.dogBreed) {
    badge.style.display = "inline-flex";
    document.getElementById("public-dog-name").innerText = data.dogName || "";
    document.getElementById("public-dog-breed").innerText = data.dogBreed || "";
    document.getElementById("public-dog-age").innerText = data.dogAge
      ? `${data.dogAge} yrs`
      : "";
  }

  // --- RE-ATTACH BUTTON LISTENERS FOR UI TOGGLES ---
  document.getElementById("btn-edit-toggle").onclick = () => {
    document.getElementById("view-public").classList.add("hidden");
    document.getElementById("view-edit").classList.remove("hidden");
    document
      .getElementById("login-credentials-section")
      .classList.add("hidden");
    document.getElementById("general-info-section").classList.remove("hidden");
  };
  document.getElementById("btn-login-details-toggle").onclick = () => {
    document.getElementById("view-public").classList.add("hidden");
    document.getElementById("view-edit").classList.remove("hidden");
    document
      .getElementById("login-credentials-section")
      .classList.remove("hidden");
    document.getElementById("general-info-section").classList.add("hidden");
  };
  document.getElementById("btn-cancel-edit").onclick = () => {
    document.getElementById("view-public").classList.remove("hidden");
    document.getElementById("view-edit").classList.add("hidden");
  };

  // --- IMAGE ADJUSTMENT & CANVAS CROP LOGIC ---
  const avatarInput = document.getElementById("avatar-upload");
  const cropModal = document.getElementById("crop-modal");
  const previewImg = document.getElementById("preview-to-crop");
  const zoomSlider = document.getElementById("zoom-slider");

  let isDragging = false;
  let startX,
    startY,
    currentX = 0,
    currentY = 0,
    currentScale = 1;

  function updateTransform() {
    // Math to keep image centered during zoom
    previewImg.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px)) scale(${currentScale})`;
  }

  if (avatarInput) {
    avatarInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          previewImg.src = event.target.result;
          previewImg.style.left = "50%";
          previewImg.style.top = "50%";
          currentX = 0;
          currentY = 0;
          currentScale = 1;
          zoomSlider.value = 1;
          updateTransform();
          cropModal.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
      }
    };
  }

  zoomSlider.oninput = (e) => {
    currentScale = e.target.value;
    updateTransform();
  };
  previewImg.onmousedown = (e) => {
    isDragging = true;
    startX = e.clientX - currentX;
    startY = e.clientY - currentY;
    previewImg.style.cursor = "grabbing";
  };
  document.onmousemove = (e) => {
    if (!isDragging) return;
    currentX = e.clientX - startX;
    currentY = e.clientY - startY;
    updateTransform();
  };
  document.onmouseup = () => {
    isDragging = false;
    if (previewImg) previewImg.style.cursor = "move";
  };
  document.getElementById("cancel-crop").onclick = () => {
    cropModal.classList.add("hidden");
    avatarInput.value = "";
  };

  // FIX: CROPPED SAVE LOGIC (Uses Canvas to save your specific zoom/pan)
  document.getElementById("save-crop").onclick = async () => {
    showToast("Processing your new look...");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const size = 300; // Final output resolution
    canvas.width = size;
    canvas.height = size;

    const imgWidth = previewImg.naturalWidth;
    const imgHeight = previewImg.naturalHeight;
    const aspectRatio = imgWidth / imgHeight;

    // Draw based on current UI scale
    const drawWidth = size * currentScale * (imgWidth / 280);
    const drawHeight = drawWidth / aspectRatio;

    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip(); // Circular crop
    ctx.drawImage(
      previewImg,
      size / 2 - drawWidth / 2 + currentX * (size / 280),
      size / 2 - drawHeight / 2 + currentY * (size / 280),
      drawWidth,
      drawHeight
    );

    canvas.toBlob(
      async (blob) => {
        try {
          const storageRef = ref(storage, `profile_pictures/${user.uid}`);
          const snapshot = await uploadBytes(storageRef, blob);
          const downloadURL = await getDownloadURL(snapshot.ref);
          await setDoc(
            doc(db, "users", user.uid),
            { photoURL: downloadURL },
            { merge: true }
          ); // Merge to protect other data
          avatarImg.src = downloadURL;
          cropModal.classList.add("hidden");
          showToast("Profile picture updated!");
        } catch (err) {
          alert("Upload failed. Please try again.");
        }
      },
      "image/jpeg",
      0.9
    );
  };

  // 4. Handle Profile Form Submission (Uses merge: true to protect dog info)
  document.getElementById("profile-edit-form").onsubmit = async (e) => {
    e.preventDefault();
    try {
      const updatedData = {
        displayName: document.getElementById("edit-username").value,
        city: document.getElementById("edit-city").value,
        postcode: document.getElementById("edit-postcode").value,
        bio: document.getElementById("edit-bio").value,
        dogName: document.getElementById("edit-dog-name").value,
        dogBreed: document.getElementById("edit-dog-breed").value,
        dogAge: document.getElementById("edit-dog-age").value,
      };

      await setDoc(doc(db, "users", user.uid), updatedData, { merge: true }); // Crucial merge
      showToast("Profile Saved!");
      setTimeout(() => location.reload(), 1000);
    } catch (err) {
      alert("Error saving profile: " + err.message);
    }
  };

  renderUserPosts(user.uid); // Load user's barks
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
  if (confirm("Delete bark?")) {
    await deleteDoc(doc(db, "posts", id));
    location.reload();
  }
};

window.logoutUser = () =>
  signOut(auth).then(() => (location.href = "index.html"));
