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
  onSnapshot,
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

// Distance calculation using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Radius of Earth in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// --- TAB PERSISTENCE LOGIC ---
function setupTabPersistence() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      localStorage.setItem("activeTab", tab.id);
    });
  });

  const savedTabId = localStorage.getItem("activeTab");
  if (savedTabId) {
    const savedTab = document.getElementById(savedTabId);
    if (savedTab) savedTab.click();
  }
}

// --- SEARCH & BREED AUTOMATION ---
async function populateBreeds() {
  const breedSelect = document.getElementById("filter-breed");
  if (!breedSelect) return;

  try {
    const snap = await getDocs(collection(db, "users"));
    const breeds = new Set();
    snap.forEach((d) => {
      const data = d.data();
      if (data.dogBreed) breeds.add(data.dogBreed);
    });

    breedSelect.innerHTML = '<option value="">All Breeds</option>';
    Array.from(breeds)
      .sort()
      .forEach((breed) => {
        const opt = document.createElement("option");
        opt.value = breed;
        opt.innerText = breed;
        breedSelect.appendChild(opt);
      });
  } catch (e) {
    console.error("Error populating breeds:", e);
  }
}

async function searchMembers(searchTerm = "", breedFilter = "", maxDist = "") {
  const container = document.getElementById("friends-grid");
  if (!container) return;

  try {
    const myUid = auth.currentUser?.uid;
    const myDoc = await getDoc(doc(db, "users", myUid));
    const myData = myDoc.data() || {};

    const followSnap = await getDocs(
      collection(db, "users", myUid, "following")
    );
    const followedIds = followSnap.docs.map((d) => d.id);

    const snap = await getDocs(collection(db, "users"));
    container.innerHTML = "";
    let found = false;

    snap.forEach((d) => {
      const member = d.data();
      if (d.id === myUid || followedIds.includes(d.id)) return;

      const nameMatch =
        !searchTerm ||
        (member.displayName || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const breedMatch = !breedFilter || member.dogBreed === breedFilter;

      let distMatch = true;
      if (maxDist) {
        if (myData.lat && myData.lng && member.lat && member.lng) {
          const distance = calculateDistance(
            myData.lat,
            myData.lng,
            member.lat,
            member.lng
          );
          if (distance > parseFloat(maxDist)) distMatch = false;
        } else {
          distMatch = false;
        }
      }

      if (nameMatch && breedMatch && distMatch) {
        found = true;
        container.innerHTML += createFriendCard(d.id, member, false);
      }
    });

    if (!found)
      container.innerHTML =
        "<p style='text-align:center; color:gray; width:100%;'>No matches found.</p>";
  } catch (e) {
    console.error("Search error:", e);
  }
}

async function searchForum(searchTerm = "") {
  const forumContainer = document.getElementById("dynamic-forum-list");
  if (!forumContainer) return;

  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    forumContainer.innerHTML = "";
    let found = false;

    snap.forEach((d) => {
      const post = d.data();
      const titleMatch = (post.title || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const descMatch = (post.description || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      if (titleMatch || descMatch) {
        found = true;
        const detailPath = window.location.pathname.includes("Forum Post")
          ? `forum-detail.html?id=${d.id}`
          : `Forum Post/forum-detail.html?id=${d.id}`;

        forumContainer.innerHTML += `
          <div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:15px; background:white;">
            <a href="${detailPath}" style="text-decoration:none; color:inherit;">
              <h3 style="margin:0; color:#ff6b35;">${post.title}</h3>
              <p style="color:#444; margin: 8px 0;">${
                post.description ? post.description.substring(0, 100) : ""
              }...</p>
              <small style="color:#888;">By ${
                post.authorName || "Anonymous"
              } | ${formatTimestamp(post.createdAt)}</small>
            </a>
          </div>`;
      }
    });

    if (!found)
      forumContainer.innerHTML =
        "<p style='text-align:center; color:gray;'>No topics found.</p>";
  } catch (e) {
    console.error("Forum search error:", e);
  }
}

// --- FRIEND CARD GENERATOR ---
function createFriendCard(id, member, isFollowing) {
  const btnHtml = isFollowing
    ? `<button class="follow-btn-small" style="background:#ddd; color:#444;" onclick="unfollowUser('${id}', '${
        member.displayName || "Member"
      }')">Following</button>`
    : `<button class="follow-btn-small" onclick="followUser('${id}', '${
        member.displayName || "Member"
      }')">Follow</button>`;

  return `
      <div class="friend-row-card">
        <img src="${
          member.photoURL || "https://via.placeholder.com/80"
        }" class="row-avatar" onclick="openUserModal('${id}')" style="cursor:pointer;">
        <div style="flex:1">
          <div class="row-header">
            <span class="username" onclick="openUserModal('${id}')" style="cursor:pointer;">${
    member.displayName || "Anonymous"
  }</span>
            ${btnHtml}
          </div>
          <div class="breed-tag">${member.dogBreed || "Dog Lover"}</div>
        </div>
      </div>`;
}

// --- USER PROFILE MODAL LOGIC ---
window.openUserModal = async (uid) => {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data();
      document.getElementById("modal-user-avatar").src =
        data.photoURL || "https://via.placeholder.com/150";
      document.getElementById("modal-user-name").innerText =
        data.displayName || "Member";
      document.getElementById(
        "modal-user-city"
      ).innerHTML = `<i class="fa fa-map-marker-alt"></i> ${
        data.city || "Not set"
      }`;
      document.getElementById("modal-user-bio").innerText =
        data.bio || "No bio yet.";

      const dogInfo = document.getElementById("modal-dog-info");
      if (data.dogName) {
        dogInfo.style.display = "flex";
        document.getElementById("modal-dog-details").innerText = `${
          data.dogName
        } (${data.dogBreed || "Mixed"}) • ${data.dogAge || "?"} yrs`;
      } else {
        dogInfo.style.display = "none";
      }
      document.getElementById("user-modal").classList.remove("hidden");
    }
  } catch (e) {
    console.error("Modal error:", e);
  }
};

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
      populateBreeds();
      setupTabPersistence();
      setupCommunityListeners();
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
    const currentPage = window.location.pathname.split("/").pop();
    if (protectedPages.includes(currentPage)) {
      window.location.href = window.location.pathname.includes("Forum Post")
        ? "../login.html"
        : "login.html";
    }
  }
});

function setupCommunityListeners() {
  const toggleBtn = document.getElementById("toggle-pack-btn");
  const packGrid = document.getElementById("following-grid");
  if (toggleBtn && packGrid) {
    toggleBtn.onclick = () => {
      const isHidden = packGrid.classList.toggle("hidden");
      toggleBtn.innerText = isHidden ? "Show Pack" : "Hide Pack";
    };
  }

  const searchBtn = document.getElementById("friends-search-btn");
  if (searchBtn) {
    searchBtn.onclick = () => {
      const term = document.getElementById("member-search").value;
      const breed = document.getElementById("filter-breed").value;
      const dist = document.getElementById("filter-distance")?.value;
      searchMembers(term, breed, dist);
    };
  }

  const forumSearchBtn = document.getElementById("forum-search-btn");
  if (forumSearchBtn) {
    forumSearchBtn.onclick = () => {
      const term = document.getElementById("forum-search").value;
      searchForum(term);
    };
  }
}

// --- FORUM DETAIL + AUTHOR EDIT LOGIC ---
async function loadPostDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get("id");
  if (!postId) return;

  try {
    const postRef = doc(db, "posts", postId);
    const postSnap = await getDoc(postRef);

    if (postSnap.exists()) {
      const post = postSnap.data();
      document.getElementById("detail-title").innerText =
        post.title || "Untitled";
      document.getElementById("detail-author").innerText = `By ${
        post.authorName || "Guest"
      } | ${formatTimestamp(post.createdAt)}`;
      document.getElementById("detail-description").innerText =
        post.description || "";

      if (auth.currentUser && auth.currentUser.uid === post.authorId) {
        const editBtn = document.createElement("button");
        editBtn.id = "main-edit-btn";
        editBtn.innerText = "Edit Bark";
        editBtn.className = "follow-btn-small";
        editBtn.style.marginTop = "15px";
        editBtn.onclick = () => enableEditMode(postId, post.description);
        document.getElementById("post-detail-container").appendChild(editBtn);
      }
    } else {
      document.getElementById("detail-title").innerText = "Post not found";
    }
  } catch (e) {
    console.error("Error retrieving forum post:", e);
  }
}

function enableEditMode(id, originalText) {
  const desc = document.getElementById("detail-description");
  const editBtn = document.getElementById("main-edit-btn");

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
    try {
      await updateDoc(doc(db, "posts", id), { description: newText });
      showToast("Bark updated!");
      location.reload();
    } catch (e) {
      alert("Error updating: " + e.message);
    }
  };

  document.getElementById("cancel-edit-btn").onclick = () => {
    desc.innerText = originalText;
    if (editBtn) editBtn.style.display = "block";
  };
}

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

// --- MEMBER DIRECTORY & MY PACK LOADERS ---
async function loadMemberDirectory(term = "", breed = "", maxDist = "") {
  const container = document.getElementById("friends-grid");
  if (!container) return;
  try {
    const myUid = auth.currentUser?.uid;
    const myDoc = await getDoc(doc(db, "users", myUid));
    const myData = myDoc.data() || {};

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

      const nameMatch =
        !term ||
        (member.displayName || "").toLowerCase().includes(term.toLowerCase());
      const breedMatch = !breed || member.dogBreed === breed;

      let distMatch = true;
      if (maxDist) {
        if (myData.lat && myData.lng && member.lat && member.lng) {
          const distance = calculateDistance(
            myData.lat,
            myData.lng,
            member.lat,
            member.lng
          );
          if (distance > parseFloat(maxDist)) distMatch = false;
        } else {
          distMatch = false;
        }
      }

      if (nameMatch && breedMatch && distMatch) {
        container.innerHTML += createFriendCard(d.id, member, false);
      }
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
        container.innerHTML += createFriendCard(
          followDoc.id,
          userDoc.data(),
          true
        );
      }
    }
  } catch (e) {
    console.error(e);
  }
}

// --- FOLLOW / UNFOLLOW LOGIC ---
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

window.unfollowUser = async (uid, name) => {
  if (confirm(`Unfollow ${name}?`)) {
    try {
      const myUid = auth.currentUser.uid;
      await deleteDoc(doc(db, "users", myUid, "following", uid));
      await deleteDoc(doc(db, "users", uid, "followers", myUid));
      showToast(`Unfollowed ${name}`);
      updateCounter(myUid);
      loadMyPack();
      loadMemberDirectory();
    } catch (e) {
      console.error("Unfollow error:", e);
    }
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

// --- FORUM LISTING ---
async function loadForumPosts(searchTerm = "") {
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
      const titleMatch = (post.title || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const descMatch = (post.description || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

      if (searchTerm === "" || titleMatch || descMatch) {
        const detailPath = window.location.pathname.includes("Forum Post")
          ? `forum-detail.html?id=${d.id}`
          : `Forum Post/forum-detail.html?id=${d.id}`;

        const postHtml = `
          <div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:15px; background:white;">
            <a href="${detailPath}" style="text-decoration:none; color:inherit;">
              <h3 style="margin:0; color:#ff6b35;">${post.title}</h3>
              <p style="color:#444; margin: 8px 0;">${
                post.description ? post.description.substring(0, 100) : ""
              }...</p>
              <small style="color:#888;">By ${
                post.authorName || "Guest"
              } | ${formatTimestamp(post.createdAt)}</small>
            </a>
          </div>`;

        if (forumContainer) forumContainer.innerHTML += postHtml;
        if (feedContainer) feedContainer.innerHTML += postHtml;
      }
    });
  } catch (e) {
    console.error("Forum loading error:", e);
  }
}

// --- CREATE TOPIC HANDLER ---
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
      alert("Post Error: " + e.message);
    }
  };
}

// --- PROFILE & CROP LOGIC ---
async function setupProfilePage(user) {
  const profileName = document.getElementById("profile-name");
  const avatarImg = document.getElementById("display-avatar");
  if (!profileName) return;

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const data = userDoc.exists() ? userDoc.data() : {};

  // 1. Set Public View
  profileName.innerText = data.displayName || "Pack Member";
  if (data.photoURL) avatarImg.src = data.photoURL;
  document.getElementById("public-city").innerText = data.city || "Not set";
  document.getElementById("public-bio").innerText = data.bio || "No bio yet.";

  // 2. FIX: Pre-populate Edit Fields BEFORE click
  const fields = {
    "edit-username": data.displayName || "",
    "edit-city": data.city || "",
    "edit-postcode": data.postcode || "",
    "edit-bio": data.bio || "",
    "edit-dog-name": data.dogName || "",
    "edit-dog-age": data.dogAge || "",
    "edit-dog-breed": data.dogBreed || "",
    "edit-email": user.email || "",
  };

  Object.keys(fields).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = fields[id];
  });

  const badge = document.getElementById("public-dog-badge");
  if (badge) {
    if (data.dogName || data.dogBreed) {
      badge.style.display = "inline-flex";
      document.getElementById("public-dog-name").innerText = data.dogName || "";
      document.getElementById("public-dog-breed").innerText =
        data.dogBreed || "";
      document.getElementById("public-dog-age").innerText = data.dogAge
        ? `${data.dogAge} yrs`
        : "";
    } else {
      badge.style.display = "none";
    }
  }

  // Toggles
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
    if (previewImg) {
      previewImg.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px)) scale(${currentScale})`;
    }
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
          if (zoomSlider) zoomSlider.value = 1;
          updateTransform();
          if (cropModal) cropModal.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
      }
    };
  }

  if (zoomSlider) {
    zoomSlider.oninput = (e) => {
      currentScale = e.target.value;
      updateTransform();
    };
  }

  if (previewImg) {
    previewImg.onmousedown = (e) => {
      isDragging = true;
      startX = e.clientX - currentX;
      startY = e.clientY - currentY;
      previewImg.style.cursor = "grabbing";
    };
  }

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

  const cancelCrop = document.getElementById("cancel-crop");
  if (cancelCrop) {
    cancelCrop.onclick = () => {
      cropModal.classList.add("hidden");
      avatarInput.value = "";
    };
  }

  const saveCrop = document.getElementById("save-crop");
  if (saveCrop) {
    saveCrop.onclick = async () => {
      showToast("Setting your new look...");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const size = 300;
      canvas.width = size;
      canvas.height = size;

      const imgWidth = previewImg.naturalWidth;
      const imgHeight = previewImg.naturalHeight;
      const drawWidth = size * currentScale * (imgWidth / 280);
      const drawHeight = drawWidth / (imgWidth / imgHeight);

      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();

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
            );
            avatarImg.src = downloadURL;
            cropModal.classList.add("hidden");
            showToast("Profile picture updated!");
          } catch (err) {
            alert("Upload failed.");
          }
        },
        "image/jpeg",
        0.9
      );
    };
  }

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
      // FIX: Ensure dog info is merged correctly
      await setDoc(doc(db, "users", user.uid), updatedData, { merge: true });
      showToast("Profile and Dog Info Saved!");
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
  try {
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
            <small style="color:#888;">${formatTimestamp(
              post.createdAt
            )}</small>
            <button onclick="deletePost('${
              d.id
            }')" style="color:#ff4d4d; background:none; border:none; cursor:pointer; font-weight:bold;">Delete Bark</button>
          </div>
        </div>`;
    });
  } catch (e) {
    console.error(e);
  }
}

window.deletePost = async (id) => {
  if (confirm("Delete bark forever?")) {
    try {
      await deleteDoc(doc(db, "posts", id));
      location.reload();
    } catch (e) {
      console.error(e);
    }
  }
};

window.logoutUser = () =>
  signOut(auth).then(() => (location.href = "index.html"));
