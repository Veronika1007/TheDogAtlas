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
  arrayUnion,
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

// --- 1. HELPERS ---
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
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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
    if (document.getElementById("friends-grid")) {
      loadMyPack();
      loadMemberDirectory();
      populateBreeds();
      setupCommunityListeners();
    }

    // Core Loaders
    loadForumPosts();
    loadVisualFeed(user.uid);

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
    const protectedPages = [
      "profile.html",
      "community.html",
      "forum-detail.html",
    ];
    if (protectedPages.some((p) => window.location.pathname.includes(p)))
      window.location.href = "login.html";
  }
});

// --- 3. PACK FEED (VISUAL INSTAGRAM STYLE) ---
async function loadVisualFeed(myUid) {
  const feedContainer = document.getElementById("pack-feed");
  if (!feedContainer) return;

  // 1. Get following list to filter the private feed
  const followingSnap = await getDocs(
    collection(db, "users", myUid, "following")
  );
  const followingIds = followingSnap.docs.map((doc) => doc.id);
  followingIds.push(myUid);

  onSnapshot(
    query(collection(db, "feedPosts"), orderBy("createdAt", "desc")),
    (snapshot) => {
      feedContainer.innerHTML = "";
      let hasPosts = false;
      // Show global feed if following list is empty (just contains user)
      const showGlobal = followingIds.length <= 1;

      snapshot.forEach((d) => {
        const post = d.data();
        if (showGlobal || followingIds.includes(post.authorId)) {
          hasPosts = true;
          feedContainer.innerHTML += `
          <div class="feed-card" style="background: white; border-radius: 12px; border: 1px solid #ddd; overflow: hidden; margin-bottom: 20px;">
            <div style="padding: 10px; display: flex; align-items: center; gap: 8px;">
                <img src="${
                  post.authorPhoto || "https://via.placeholder.com/40"
                }" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover;">
                <span style="font-weight: bold; font-size: 13px;">${
                  post.authorName
                }</span>
            </div>
            <img src="${
              post.imageUrl
            }" style="width: 100%; aspect-ratio: 1/1; object-fit: cover; cursor: pointer;" onclick="woofPost('${
            d.id
          }')">
            <div style="padding: 12px;">
                <div style="margin-bottom: 8px; display: flex; gap: 15px; font-size: 18px;">
                    <span onclick="woofPost('${
                      d.id
                    }')" class="woof-btn" style="cursor:pointer;"><i class="fa fa-paw"></i> <small style="font-size:12px;">${
            post.woofs || 0
          }</small></span>
                    <span onclick="openComments('${
                      d.id
                    }')" class="comment-btn" style="cursor:pointer;"><i class="fa-regular fa-comment"></i></span>
                </div>
                <p style="margin: 0; font-size: 13px; line-height: 1.4;"><strong>${
                  post.authorName
                }</strong> ${post.caption || ""}</p>
                <small style="color:#999; font-size:10px;">${formatTimestamp(
                  post.createdAt
                )}</small>
            </div>
          </div>`;
        }
      });
      if (!hasPosts)
        feedContainer.innerHTML =
          "<p style='text-align:center; padding:40px; color:#999;'>Be the first to share a bark! Your pack feed is currently empty.</p>";
    }
  );
}

window.woofPost = async (postId) => {
  if (!auth.currentUser) return alert("Log in to woof!");
  await updateDoc(doc(db, "feedPosts", postId), { woofs: increment(1) });
  showToast("Woof!");
};

window.openComments = async (postId) => {
  const modal = document.getElementById("comment-modal");
  const list = document.getElementById("comments-list");
  const submitBtn = document.getElementById("submit-comment");
  modal.classList.remove("hidden");
  list.innerHTML = "Loading...";

  const postSnap = await getDoc(doc(db, "feedPosts", postId));
  const comments = postSnap.data().comments || [];
  list.innerHTML = comments.length ? "" : "No woof-comments yet.";
  comments.forEach(
    (c) =>
      (list.innerHTML += `<div style="margin-bottom:8px; font-size:14px; border-bottom:1px solid #eee; padding-bottom:4px;"><strong>${c.user}:</strong> ${c.text}</div>`)
  );

  submitBtn.onclick = async () => {
    const text = document.getElementById("new-comment-text").value;
    if (!text) return;
    const comment = {
      user: auth.currentUser.displayName || "Member",
      text: text,
      date: Date.now(),
    };
    await updateDoc(doc(db, "feedPosts", postId), {
      comments: arrayUnion(comment),
    });
    document.getElementById("new-comment-text").value = "";
    openComments(postId);
  };
};

// --- 4. FEED UPLOAD LOGIC ---
const feedFileInput = document.getElementById("feed-file-input");
if (document.getElementById("feed-image-preview")) {
  document.getElementById("feed-image-preview").onclick = () =>
    feedFileInput.click();
  feedFileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const preview = document.getElementById("img-to-upload");
        preview.src = ev.target.result;
        preview.classList.remove("hidden");
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
    if (!file) return alert("Select a photo!");
    showToast("Sharing your bark...");
    const user = auth.currentUser;
    const userDoc = await getDoc(doc(db, "users", user.uid));
    const userData = userDoc.data() || {};
    const imgRef = ref(storage, `feed/${user.uid}_${Date.now()}`);
    const snapshot = await uploadBytes(imgRef, file);
    const url = await getDownloadURL(snapshot.ref);
    await addDoc(collection(db, "feedPosts"), {
      imageUrl: url,
      caption: document.getElementById("feed-caption").value,
      authorId: user.uid,
      authorName: userData.displayName || "Anonymous",
      authorPhoto: userData.photoURL || "",
      createdAt: serverTimestamp(),
      woofs: 0,
      comments: [],
    });
    document.getElementById("feed-post-modal").classList.add("hidden");
    feedPostForm.reset();
    document.getElementById("img-to-upload").classList.add("hidden");
    document.getElementById("preview-text").classList.remove("hidden");
  };
}

// --- 5. PROFILE LOGIC (SNIPPETS & TOGGLES) ---
async function setupProfilePage(user) {
  const profileName = document.getElementById("profile-name");
  const avatarImg = document.getElementById("display-avatar");
  if (!profileName) return;

  const userDoc = await getDoc(doc(db, "users", user.uid));
  const data = userDoc.exists() ? userDoc.data() : {};

  profileName.innerText = data.displayName || "Pack Member";
  if (data.photoURL) avatarImg.src = data.photoURL;
  document.getElementById("public-city").innerText = data.city || "Not set";
  document.getElementById("public-bio").innerText = data.bio || "No bio yet.";

  // Dog Badge restoration with color logic
  const badge = document.getElementById("public-dog-badge");
  if (badge && (data.dogName || data.dogBreed)) {
    badge.style.display = "inline-flex";
    document.getElementById("public-dog-name").innerText = data.dogName || "";
    document.getElementById("public-dog-breed").innerText = data.dogBreed || "";
    document.getElementById("public-dog-age").innerText = data.dogAge
      ? `${data.dogAge} yrs`
      : "";
    const emoji = document.getElementById("dog-emoji");
    if (emoji)
      emoji.style.color = data.dogGender === "Boy" ? "#3498db" : "#e91e63";
  }

  // Pre-fill fields for editing
  const fields = {
    "edit-username": data.displayName || "",
    "edit-city": data.city || "",
    "edit-postcode": data.postcode || "",
    "edit-bio": data.bio || "",
    "edit-dog-name": data.dogName || "",
    "edit-dog-age": data.dogAge || "",
    "edit-dog-breed": data.dogBreed || "",
    "edit-dog-gender": data.dogGender || "",
    "edit-email": user.email || "",
  };
  Object.keys(fields).forEach((id) => {
    if (document.getElementById(id))
      document.getElementById(id).value = fields[id];
  });

  // RE-ATTACHING TOGGLE LISTENERS
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

  document.getElementById("profile-edit-form").onsubmit = async (e) => {
    e.preventDefault();
    const updated = {
      displayName: document.getElementById("edit-username").value,
      city: document.getElementById("edit-city").value,
      postcode: document.getElementById("edit-postcode").value,
      bio: document.getElementById("edit-bio").value,
      dogName: document.getElementById("edit-dog-name").value,
      dogBreed: document.getElementById("edit-dog-breed").value,
      dogAge: document.getElementById("edit-dog-age").value,
      dogGender: document.getElementById("edit-dog-gender").value,
    };
    await setDoc(doc(db, "users", user.uid), updated, { merge: true });
    showToast("Profile saved!");
    setTimeout(() => location.reload(), 800);
  };

  renderUserPosts(user.uid);
}

// --- 6. FORUM LOGIC (SNIPPETS RESTORED) ---
async function renderUserPosts(uid) {
  const container = document.getElementById("my-posts-list");
  if (!container) return;
  const q = query(
    collection(db, "posts"),
    where("authorId", "==", uid),
    orderBy("createdAt", "desc")
  );
  const snap = await getDocs(q);
  container.innerHTML = snap.empty ? "<p>No barks in the forum yet.</p>" : "";

  snap.forEach((d) => {
    const post = d.data();
    container.innerHTML += `
      <div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:15px; background:white; position:relative;">
        <h3 style="margin:0; color:#ff6b35;">${post.title}</h3>
        <small style="color:#888;">${formatTimestamp(post.createdAt)}</small>
        <p style="color:#444; margin: 10px 0;">${
          post.description ? post.description.substring(0, 150) : ""
        }...</p>
        <div style="display:flex; gap:10px;">
            <button onclick="editBark('${d.id}', \`${
      post.description
    }\`)" class="follow-btn-small" style="padding: 4px 10px; font-size:11px;">Edit Bark</button>
            <button onclick="deletePost('${
              d.id
            }')" style="background:none; border:none; color:#ff4d4d; cursor:pointer; font-size:11px;">Delete Bark</button>
        </div>
      </div>`;
  });
}

window.editBark = (id, oldText) => {
  const newText = prompt("Update your forum bark:", oldText);
  if (newText && newText !== oldText) {
    updateDoc(doc(db, "posts", id), { description: newText }).then(() =>
      location.reload()
    );
  }
};

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

async function loadPostDetails() {
  const urlParams = new URLSearchParams(window.location.search);
  const postId = urlParams.get("id");
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

// --- 7. COMMUNITY, DIRECTORY & SEARCH ---
function setupCommunityListeners() {
  const toggleBtn = document.getElementById("toggle-pack-btn");
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      const grid = document.getElementById("following-grid");
      const isHidden = grid.classList.toggle("hidden");
      toggleBtn.innerText = isHidden ? "Show Pack" : "Hide Pack";
    };
  }
  document.getElementById("friends-search-btn").onclick = () => {
    loadMemberDirectory(
      document.getElementById("member-search").value.toLowerCase(),
      document.getElementById("filter-breed").value,
      document.getElementById("filter-distance")?.value
    );
  };
  document.getElementById("forum-search-btn").onclick = () => {
    loadForumPosts(document.getElementById("forum-search").value.toLowerCase());
  };
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
    .forEach(
      (b) => (breedSelect.innerHTML += `<option value="${b}">${b}</option>`)
    );
}

async function loadMemberDirectory(term = "", breed = "", maxDist = "") {
  const container = document.getElementById("friends-grid");
  if (!container) return;
  const myUid = auth.currentUser?.uid;
  const myData = (await getDoc(doc(db, "users", myUid))).data() || {};
  const followedIds = (
    await getDocs(collection(db, "users", myUid, "following"))
  ).docs.map((d) => d.id);
  const snap = await getDocs(collection(db, "users"));
  container.innerHTML = "";
  snap.forEach((d) => {
    const member = d.data();
    if (d.id === myUid || followedIds.includes(d.id)) return;
    const nameMatch =
      !term || (member.displayName || "").toLowerCase().includes(term);
    const breedMatch = !breed || member.dogBreed === breed;
    let distMatch = true;
    if (maxDist && myData.lat && member.lat) {
      if (
        calculateDistance(myData.lat, myData.lng, member.lat, member.lng) >
        parseFloat(maxDist)
      )
        distMatch = false;
    } else if (maxDist) distMatch = false;
    if (nameMatch && breedMatch && distMatch)
      container.innerHTML += createFriendCard(d.id, member, false);
  });
}

async function loadMyPack() {
  const container = document.getElementById("following-grid");
  if (!container) return;
  const snap = await getDocs(
    collection(db, "users", auth.currentUser.uid, "following")
  );
  container.innerHTML = snap.empty ? "<p>Pack is empty.</p>" : "";
  for (const f of snap.docs) {
    const userDoc = await getDoc(doc(db, "users", f.id));
    if (userDoc.exists())
      container.innerHTML += createFriendCard(f.id, userDoc.data(), true);
  }
}

function createFriendCard(id, member, isFollowing) {
  const btn = isFollowing
    ? `<button class="follow-btn-small" style="background:#ddd" onclick="unfollowUser('${id}', '${member.displayName}')">Following</button>`
    : `<button class="follow-btn-small" onclick="followUser('${id}', '${member.displayName}')">Follow</button>`;
  return `
    <div class="friend-row-card">
      <img src="${
        member.photoURL || "https://via.placeholder.com/80"
      }" class="row-avatar" onclick="openUserModal('${id}')">
      <div style="flex:1">
        <div class="row-header"><span class="username" onclick="openUserModal('${id}')">${
    member.displayName || "Anonymous"
  }</span>${btn}</div>
        <div class="breed-tag">${member.dogBreed || "Dog Lover"}</div>
      </div>
    </div>`;
}

// --- 8. AUTH HANDLERS & COUNTERS ---
const authForm = document.getElementById("auth-form");
if (authForm) {
  authForm.onsubmit = async (e) => {
    e.preventDefault();
    const isLogin =
      document.getElementById("auth-submit").innerText === "Login";
    try {
      if (isLogin) {
        await signInWithEmailAndPassword(
          auth,
          document.getElementById("auth-email").value,
          document.getElementById("auth-password").value
        );
      } else {
        const cred = await createUserWithEmailAndPassword(
          auth,
          document.getElementById("auth-email").value,
          document.getElementById("auth-password").value
        );
        await setDoc(doc(db, "users", cred.user.uid), {
          displayName: document.getElementById("auth-username").value,
          email: document.getElementById("auth-email").value,
          createdAt: serverTimestamp(),
        });
      }
      window.location.href = "profile.html";
    } catch (error) {
      alert(error.message);
    }
  };
}

window.followUser = async (uid, name) => {
  await setDoc(
    doc(db, "users", auth.currentUser.uid, "following", uid),
    { displayName: name, followedAt: serverTimestamp() },
    { merge: true }
  );
  await setDoc(
    doc(db, "users", uid, "followers", auth.currentUser.uid),
    {
      displayName: auth.currentUser.displayName,
      followedAt: serverTimestamp(),
    },
    { merge: true }
  );
  showToast("Following your new friend!");
  loadMyPack();
  loadMemberDirectory();
  loadVisualFeed(auth.currentUser.uid);
};

window.unfollowUser = async (uid, name) => {
  if (confirm(`Unfollow ${name}?`)) {
    await deleteDoc(doc(db, "users", auth.currentUser.uid, "following", uid));
    await deleteDoc(doc(db, "users", uid, "followers", auth.currentUser.uid));
    showToast("Unfollowed.");
    loadMyPack();
    loadMemberDirectory();
    loadVisualFeed(auth.currentUser.uid);
  }
};

async function updateCounter(uid) {
  const fCount = document.getElementById("count-following"),
    pCount = document.getElementById("count-pack"),
    sCount = document.getElementById("count-posts");
  if (fCount)
    fCount.innerText = (
      await getDocs(collection(db, "users", uid, "following"))
    ).size;
  if (pCount)
    pCount.innerText = (
      await getDocs(collection(db, "users", uid, "followers"))
    ).size;
  if (sCount)
    sCount.innerText = (
      await getDocs(
        query(collection(db, "posts"), where("authorId", "==", uid))
      )
    ).size;
}

window.deletePost = async (id) => {
  if (confirm("Delete bark forever?")) {
    await deleteDoc(doc(db, "posts", id));
    location.reload();
  }
};
window.logoutUser = () =>
  signOut(auth).then(() => (location.href = "index.html"));
