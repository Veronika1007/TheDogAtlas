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
  increment,
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
  const R = 3958.8;
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
      localStorage.setItem(
        "activeCommunityTab",
        tab.id.replace("tab-", "").replace("-btn", "")
      );
    });
  });

  const savedTab = localStorage.getItem("activeCommunityTab") || "posts";
  const targetTab = document.getElementById(`tab-${savedTab}-btn`);
  if (targetTab) targetTab.click();
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
      populateBreeds();
      setupCommunityListeners();
      setupTabPersistence();
    }

    if (document.getElementById("dynamic-forum-list")) loadForumPosts();
    if (document.getElementById("pack-feed")) loadVisualFeed();
    if (document.getElementById("post-detail-container")) loadPostDetails();

    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists() && userDoc.data().photoURL) {
      const smAvatar = document.getElementById("feed-avatar-small");
      if (smAvatar) smAvatar.src = userDoc.data().photoURL;
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

// --- VISUAL FEED LOGIC  ---
async function loadVisualFeed() {
  const feedContainer = document.getElementById("pack-feed");
  if (!feedContainer) return;

  const q = query(collection(db, "feedPosts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    feedContainer.innerHTML = "";
    if (snapshot.empty)
      feedContainer.innerHTML =
        "<p style='text-align:center; padding:20px; color:#666;'>No posts yet. Be the first to share!</p>";

    snapshot.forEach((d) => {
      const post = d.data();
      feedContainer.innerHTML += `
<div class="feed-card">
    <div style="padding: 12px; display: flex; align-items: center; gap: 10px;">
        <img src="${
          post.authorPhoto || "https://via.placeholder.com/40"
        }" style="width: 35px; height: 35px; border-radius: 50%; object-fit: cover;">
        <span style="font-weight: bold;">${post.authorName}</span>
        <small style="color: #999; margin-left: auto;">${formatTimestamp(
          post.createdAt
        )}</small>
    </div>
    <img src="${
      post.imageUrl
    }" style="width: 100%; display: block; background: #eee;">
    <div style="padding: 15px;">
        <div style="margin-bottom: 10px; display: flex; gap: 15px;">
            <span class="woof-btn" onclick="likeFeedPost('${d.id}', this)">
                <i class="fa-solid fa-paw"></i> 
                <small style="font-size:14px;">${post.likes || 0}</small>
            </span>
            <i class="fa-regular fa-comment" style="cursor:pointer; font-size: 20px;"></i>
        </div>
        <p style="margin: 0; line-height: 1.4;"><strong>${
          post.authorName
        }</strong> ${post.caption || ""}</p>
    </div>
</div>`;
    });
  });
}

window.likeFeedPost = async (postId, element) => {
  try {
    // Toggle the active class for immediate feedback
    element.classList.toggle("active");

    await updateDoc(doc(db, "feedPosts", postId), {
      likes: increment(1),
    });
  } catch (e) {
    console.error("Error liking post:", e);
  }
};

const feedFileInput = document.getElementById("feed-file-input");
if (document.getElementById("feed-image-preview")) {
  document.getElementById("feed-image-preview").onclick = () =>
    feedFileInput.click();
  feedFileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById("img-to-upload").src = ev.target.result;
        document.getElementById("img-to-upload").classList.remove("hidden");
        document.getElementById("preview-text").classList.add("hidden");
      };
      reader.readAsDataURL(file);
    }
  };
}

const feedPostForm = document.getElementById("create-feed-post-form");
if (feedPostForm) {
  feedPostForm.onsubmit = async (e) => {
    e.preventDefault();
    const file = feedFileInput.files[0];
    const caption = document.getElementById("feed-caption").value;
    if (!file) return alert("Select a photo!");

    showToast("Uploading to the pack...");
    try {
      const user = auth.currentUser;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      const userData = userDoc.data() || {};

      const imgRef = ref(storage, `feed/${user.uid}_${Date.now()}`);
      const snapshot = await uploadBytes(imgRef, file);
      const url = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, "feedPosts"), {
        imageUrl: url,
        caption: caption,
        authorId: user.uid,
        authorName: userData.displayName || "Anonymous",
        authorPhoto: userData.photoURL || "",
        createdAt: serverTimestamp(),
        likes: 0,
      });

      document.getElementById("feed-post-modal").classList.add("hidden");
      feedPostForm.reset();
      document.getElementById("img-to-upload").classList.add("hidden");
      document.getElementById("preview-text").classList.remove("hidden");
      showToast("Shared successfully!");
    } catch (err) {
      alert("Post error: " + err.message);
    }
  };
}

// --- SEARCH & COMMUNITY LISTENERS ---
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
      const term = document.getElementById("member-search").value.toLowerCase();
      const breed = document.getElementById("filter-breed").value;
      const dist = document.getElementById("filter-distance")?.value;
      loadMemberDirectory(term, breed, dist);
    };
  }

  const forumSearchBtn = document.getElementById("forum-search-btn");
  if (forumSearchBtn) {
    forumSearchBtn.onclick = () => {
      const term = document.getElementById("forum-search").value.toLowerCase();
      loadForumPosts(term);
    };
  }
}

async function populateBreeds() {
  const breedSelect = document.getElementById("filter-breed");
  if (!breedSelect) return;
  const snap = await getDocs(collection(db, "users"));
  const breeds = new Set();
  snap.forEach((d) => {
    if (d.data().dogBreed) breeds.add(d.data().dogBreed);
  });
  breedSelect.innerHTML = '<option value="">All Breeds</option>';
  Array.from(breeds)
    .sort()
    .forEach((b) => {
      breedSelect.innerHTML += `<option value="${b}">${b}</option>`;
    });
}

async function loadMemberDirectory(term = "", breed = "", maxDist = "") {
  const container = document.getElementById("friends-grid");
  if (!container) return;

  const myUid = auth.currentUser?.uid;
  const myDoc = await getDoc(doc(db, "users", myUid));
  const myData = myDoc.data() || {};

  const followSnap = await getDocs(collection(db, "users", myUid, "following"));
  const followedIds = followSnap.docs.map((d) => d.id);

  const snap = await getDocs(collection(db, "users"));
  container.innerHTML = "";
  let found = false;

  snap.forEach((d) => {
    const member = d.data();
    if (d.id === myUid || followedIds.includes(d.id)) return;

    const nameMatch =
      !term || (member.displayName || "").toLowerCase().includes(term);
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
      found = true;
      container.innerHTML += createFriendCard(d.id, member, false);
    }
  });
  if (!found)
    container.innerHTML =
      "<p style='text-align:center; color:gray; width:100%'>No matches found.</p>";
}

async function loadMyPack() {
  const container = document.getElementById("following-grid");
  if (!container) return;
  const myUid = auth.currentUser?.uid;
  const snap = await getDocs(collection(db, "users", myUid, "following"));
  container.innerHTML = snap.empty ? "<p>Your pack is empty.</p>" : "";
  for (const f of snap.docs) {
    const userDoc = await getDoc(doc(db, "users", f.id));
    if (userDoc.exists())
      container.innerHTML += createFriendCard(f.id, userDoc.data(), true);
  }
}

function createFriendCard(id, member, isFollowing) {
  const btn = isFollowing
    ? `<button class="follow-btn-small" style="background:#ddd; color:#444;" onclick="unfollowUser('${id}', '${member.displayName}')">Following</button>`
    : `<button class="follow-btn-small" onclick="followUser('${id}', '${member.displayName}')">Follow</button>`;

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
          ${btn}
        </div>
        <div class="breed-tag">${member.dogBreed || "Dog Lover"}</div>
      </div>
    </div>`;
}

// --- PROFILE LOGIC (FIXED DISPLAY NAME & DOG INFO) ---
async function setupProfilePage(user) {
  const profileName = document.getElementById("profile-name");
  const avatarImg = document.getElementById("display-avatar");

  if (!profileName) return;

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const data = userDoc.exists() ? userDoc.data() : {};

  // Display Public Data
  const displayName = data.displayName || "Pack Member";
  document.getElementById("profile-name").innerText = displayName;
  document.getElementById("public-city").innerText = data.city || "Not set";
  document.getElementById("public-bio").innerText = data.bio || "No bio yet.";

  if (data.photoURL && avatarImg) {
    avatarImg.src = data.photoURL;
  }
  // --- NEW DOG INFO & GENDER LOGIC ---
  const dogBadge = document.getElementById("public-dog-badge");
  const dogInfoText = document.getElementById("public-dog-info");
  const genderIcon = document.getElementById("dog-gender-icon");

  if (data.dogName || data.dogBreed) {
    dogBadge.style.display = "inline-flex";

    // Set text: "Name (Breed)"
    const name = data.dogName || "My Dog";
    const breed = data.dogBreed ? ` (${data.dogBreed})` : "";
    dogInfoText.innerText = `${name}${breed}`;

    // Apply Gender Colors
    if (data.dogGender === "Boy") {
      genderIcon.style.color = "#3498db"; // Blue
    } else if (data.dogGender === "Girl") {
      genderIcon.style.color = "#e91e63"; // Pink
    } else {
      genderIcon.style.color = "var(--primary)"; // Default Orange
    }
  }

  // Populate Edit Fields with fresh data
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

  // ADD THIS LINE: Explicitly set the gender dropdown value
  const genderSelect = document.getElementById("edit-dog-gender");
  if (genderSelect && data.dogGender) {
    genderSelect.value = data.dogGender;
  }

  // --- BUTTON CLICK HANDLERS ---
  const editBtn = document.getElementById("btn-edit-toggle");
  const loginToggle = document.getElementById("btn-login-details-toggle");
  const cancelBtn = document.getElementById("btn-cancel-edit");
  const editView = document.getElementById("view-edit");
  const viewPublic = document.getElementById("view-public");
  const loginSection = document.getElementById("login-credentials-section");
  const generalSection = document.getElementById("general-info-section");

  if (editBtn) {
    editBtn.onclick = () => {
      viewPublic.classList.add("hidden");
      viewEdit.classList.remove("hidden");
    };
  }

  if (loginToggle) {
    loginToggle.onclick = () => {
      // Switch to edit mode if currently on public view
      if (viewEdit.classList.contains("hidden")) {
        viewPublic.classList.add("hidden");
        viewEdit.classList.remove("hidden");
      }
      // Toggle only the login section
      loginSection.classList.toggle("hidden");
    };
  }

  if (cancelBtn) {
    cancelBtn.onclick = () => {
      viewPublic.classList.remove("hidden");
      viewEdit.classList.add("hidden");
      loginSection.classList.add("hidden");
    };
  }

  // Logic for the Edit Profile button
  document.getElementById("btn-edit-toggle").onclick = () => {
    viewPublic.classList.add("hidden");
    editView.classList.remove("hidden");
    generalSection.classList.remove("hidden"); // Show profile fields
    loginSection.classList.add("hidden"); // Hide login fields
  };

  // Logic for the Login Details button
  document.getElementById("btn-login-details-toggle").onclick = () => {
    viewPublic.classList.add("hidden");
    editView.classList.remove("hidden");
    loginSection.classList.remove("hidden"); // Show login fields
    generalSection.classList.add("hidden"); // Hide profile fields
  };

  // Cancel Button Logic
  document.getElementById("btn-cancel-edit").onclick = () => {
    viewPublic.classList.remove("hidden");
    editView.classList.add("hidden");
  };
  // --- FIXED SAVE FORM LOGIC ---
  document.getElementById("profile-edit-form").onsubmit = async (e) => {
    e.preventDefault();
    const user = auth.currentUser;

    try {
      // 1. Collect all data including the specific Dog Bio fields
      const updatedData = {
        displayName: document.getElementById("edit-username").value,
        city: document.getElementById("edit-city").value,
        postcode: document.getElementById("edit-postcode").value,
        bio: document.getElementById("edit-bio").value,
        dogName: document.getElementById("edit-dog-name").value,
        dogBreed: document.getElementById("edit-dog-breed").value,
        dogAge: document.getElementById("edit-dog-age").value,
        dogGender: document.getElementById("edit-dog-gender").value,
        updatedAt: serverTimestamp(),
      };

      // 2. Save to Firestore (using merge:true so we don't overwrite other fields)
      await setDoc(doc(db, "users", user.uid), updatedData, { merge: true });

      // 3. Immediately update the visual Header so the user sees the change
      document.getElementById("profile-name").innerText =
        updatedData.displayName || "Pack Member";
      document.getElementById("public-city").innerText =
        updatedData.city || "Not set";
      document.getElementById("public-bio").innerText =
        updatedData.bio || "No bio yet.";

      showToast("Profile and Dog Info Updated!");

      // 4. Return to public view and reload to ensure all data is synced
      document.getElementById("view-public").classList.remove("hidden");
      document.getElementById("view-edit").classList.add("hidden");
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      console.error("Update Error:", err);
      alert("Error saving: " + err.message);
    }
  };

  renderUserPosts(user.uid); // Render the "Barks"
}

// --- FORUM DETAIL + EDIT ---
async function loadPostDetails() {
  const postId = new URLSearchParams(window.location.search).get("id");
  if (!postId) return;
  const postSnap = await getDoc(doc(db, "posts", postId));
  if (postSnap.exists()) {
    const post = postSnap.data();
    document.getElementById("detail-title").innerText = post.title;
    document.getElementById("detail-author").innerText = `By ${
      post.authorName
    } | ${formatTimestamp(post.createdAt)}`;
    document.getElementById("detail-description").innerText = post.description;

    if (auth.currentUser && auth.currentUser.uid === post.authorId) {
      const editBtn = document.createElement("button");
      editBtn.innerText = "Edit Bark";
      editBtn.className = "follow-btn-small";
      editBtn.onclick = () => {
        const area = document.createElement("textarea");
        area.value = post.description;
        area.style.width = "100%";
        document.getElementById("detail-description").replaceWith(area);
        editBtn.innerText = "Save";
        editBtn.onclick = async () => {
          await updateDoc(doc(db, "posts", postId), {
            description: area.value,
          });
          location.reload();
        };
      };
      document.getElementById("post-detail-container").appendChild(editBtn);
    }
  }
}

// --- FORUM & FEED LISTING ---
async function loadForumPosts(searchTerm = "") {
  const forumContainer = document.getElementById("dynamic-forum-list");
  if (!forumContainer) return;
  const q = query(collection(db, "posts"), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  forumContainer.innerHTML = "";
  snap.forEach((d) => {
    const post = d.data();
    if (
      !searchTerm ||
      post.title.toLowerCase().includes(searchTerm) ||
      post.description.toLowerCase().includes(searchTerm)
    ) {
      forumContainer.innerHTML += `
          <div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:15px; background:white;">
            <a href="Forum Post/forum-detail.html?id=${
              d.id
            }" style="text-decoration:none; color:inherit;">
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
    }
  });
}

const forumPostForm = document.getElementById("create-post-form");
if (forumPostForm) {
  forumPostForm.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      const userData = userDoc.data() || {};
      const docRef = await addDoc(collection(db, "posts"), {
        title: document.getElementById("post-title").value,
        description: document.getElementById("post-description").value,
        authorId: auth.currentUser.uid,
        authorName: userData.displayName || "Anonymous",
        createdAt: serverTimestamp(),
      });
      window.location.href = `Forum Post/forum-detail.html?id=${docRef.id}`;
    } catch (e) {
      alert(e.message);
    }
  };
}

// --- AUTH HANDLERS ---
const authForm = document.getElementById("auth-form");
if (authForm) {
  authForm.onsubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value;
    const password = document.getElementById("auth-password").value;
    const isLogin =
      document.getElementById("auth-submit").innerText === "Login";
    try {
      if (isLogin) {
        // Log in existing user
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Register new user
        const userCred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        const usernameInput = document.getElementById("auth-username").value;

        // Save username to Firestore immediately so it's not the email
        await setDoc(doc(db, "users", userCred.user.uid), {
          displayName: usernameInput || "Member",
          email: email,
          createdAt: serverTimestamp(),
        });
      }
      // Redirect to profile upon success
      window.location.href = "profile.html";
    } catch (error) {
      console.error("Auth Error:", error);
      alert(error.message);
    }
  };
}

// --- FOLLOW/UNFOLLOW ---
window.followUser = async (uid, name) => {
  const myUid = auth.currentUser.uid;
  await setDoc(
    doc(db, "users", myUid, "following", uid),
    { displayName: name, followedAt: serverTimestamp() },
    { merge: true }
  );
  await setDoc(
    doc(db, "users", uid, "followers", myUid),
    {
      displayName: auth.currentUser.displayName || "Member",
      followedAt: serverTimestamp(),
    },
    { merge: true }
  );
  showToast(`Following ${name}`);
  loadMyPack();
  loadMemberDirectory();
};

window.unfollowUser = async (uid, name) => {
  if (confirm(`Unfollow ${name}?`)) {
    const myUid = auth.currentUser.uid;
    await deleteDoc(doc(db, "users", myUid, "following", uid));
    await deleteDoc(doc(db, "users", uid, "followers", myUid));
    showToast("Unfollowed");
    loadMyPack();
    loadMemberDirectory();
  }
};

async function updateCounter(uid) {
  const fCount = document.getElementById("count-following"),
    pCount = document.getElementById("count-pack"),
    sCount = document.getElementById("count-posts");
  if (fCount) {
    const s = await getDocs(collection(db, "users", uid, "following"));
    fCount.innerText = s.size;
  }
  if (pCount) {
    const s = await getDocs(collection(db, "users", uid, "followers"));
    pCount.innerText = s.size;
  }
  if (sCount) {
    const q = query(collection(db, "posts"), where("authorId", "==", uid));
    const s = await getDocs(q);
    sCount.innerText = s.size;
  }
}

// --- UPDATED FORUM BARKS RENDERING ---
async function renderUserPosts(uid) {
  const container = document.getElementById("my-posts-list");
  if (!container) return;

  // Query posts authored by this user
  const q = query(
    collection(db, "posts"),
    where("authorId", "==", uid),
    orderBy("createdAt", "desc")
  );

  try {
    const snap = await getDocs(q);
    container.innerHTML = snap.empty
      ? "<p style='text-align:center;'>No barks yet.</p>"
      : "";

    snap.forEach((d) => {
      const post = d.data();
      container.innerHTML += `
          <div class="forum-topic-card" style="border:1px solid #ddd; padding:20px; border-radius:12px; margin-bottom:15px; background:white; text-align:left;">
            <h3 style="margin:0 0 10px 0; color:var(--primary);">${
              post.title
            }</h3>
            <p style="color:#444; font-size:0.95rem; margin-bottom:10px;">${
              post.description || ""
            }</p>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <small style="color:#888;">Posted on: ${formatTimestamp(
                post.createdAt
              )}</small>
              <div style="display:flex; gap:10px;">
                <button onclick="window.location.href='Forum Post/forum-detail.html?id=${
                  d.id
                }'" 
                        class="follow-btn-small" style="font-size:12px;">Edit</button>
                <button onclick="deletePost('${d.id}')" 
                        style="color:#ff4d4d; background:none; border:1px solid #ff4d4d; border-radius:20px; padding:4px 12px; cursor:pointer; font-size:12px; font-weight:600;">Delete</button>
              </div>
            </div>
          </div>`;
    });
  } catch (error) {
    console.error("Error loading user barks:", error);
  }
}

window.openUserModal = async (uid) => {
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
    if (data.dogName) {
      document.getElementById("modal-dog-info").style.display = "flex";
      document.getElementById(
        "modal-dog-details"
      ).innerText = `${data.dogName} (${data.dogBreed}) • ${data.dogAge} yrs`;
    } else {
      document.getElementById("modal-dog-info").style.display = "none";
    }
    document.getElementById("user-modal").classList.remove("hidden");
  }
};

// Ensure logout is globally accessible for the HTML onclick attribute
window.logoutUser = () => {
  signOut(auth)
    .then(() => {
      window.location.href = "index.html";
    })
    .catch((error) => {
      console.error("Logout Error:", error);
    });
};
