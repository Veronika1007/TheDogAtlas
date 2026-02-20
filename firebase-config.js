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

// --- 1. CORE HELPERS ---
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

// --- 2. GLOBAL AUTH & INITIALIZATION ---
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

// --- 3. VISUAL PACK FEED (2-COLUMN + PACK FILTER) ---
async function loadVisualFeed(myUid) {
  const feedContainer = document.getElementById("pack-feed");
  if (!feedContainer) return;

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
      const showGlobal = followingIds.length <= 1;

      snapshot.forEach((d) => {
        const post = d.data();
        if (showGlobal || followingIds.includes(post.authorId)) {
          hasPosts = true;
          feedContainer.innerHTML += `
          <div class="feed-card" style="background: white; border-radius: 12px; border: 1px solid #ddd; overflow: hidden; margin-bottom: 10px;">
            <div style="padding: 10px; display: flex; align-items: center; gap: 8px;">
                <img src="${
                  post.authorPhoto || "https://via.placeholder.com/40"
                }" style="width: 25px; height: 25px; border-radius: 50%; object-fit: cover;">
                <span style="font-weight: bold; font-size: 12px;">${
                  post.authorName
                }</span>
            </div>
            <img src="${
              post.imageUrl
            }" style="width: 100%; aspect-ratio: 1/1; object-fit: cover;">
            <div style="padding: 10px;">
                <div style="margin-bottom: 5px; display: flex; gap: 12px; font-size: 16px;">
                    <span onclick="woofPost('${
                      d.id
                    }')" class="woof-btn"><i class="fa fa-paw"></i> <small>${
            post.woofs || 0
          }</small></span>
                    <span onclick="openComments('${
                      d.id
                    }')" class="comment-btn"><i class="fa-regular fa-comment"></i></span>
                </div>
                <p style="margin: 0; font-size: 12px; line-height: 1.3;"><strong>${
                  post.authorName
                }</strong> ${post.caption || ""}</p>
            </div>
          </div>`;
        }
      });
      if (!hasPosts)
        feedContainer.innerHTML =
          "<p style='grid-column: span 2; text-align:center; padding:40px; color:#999;'>No pack updates. Follow friends to see their barks!</p>";
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
      (list.innerHTML += `<div style="margin-bottom:8px; font-size:14px;"><strong>${c.user}:</strong> ${c.text}</div>`)
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

// --- 4. FEED UPLOADS ---
const feedFileInput = document.getElementById("feed-file-input");
if (document.getElementById("feed-image-preview")) {
  document.getElementById("feed-image-preview").onclick = () =>
    feedFileInput.click();
  feedFileInput.onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById("img-to-upload");
      preview.src = ev.target.result;
      preview.classList.remove("hidden");
      document.getElementById("preview-text").classList.add("hidden");
    };
    reader.readAsDataURL(e.target.files[0]);
  };
}

const feedPostForm = document.getElementById("create-feed-post-form");
if (feedPostForm) {
  feedPostForm.onsubmit = async (e) => {
    e.preventDefault();
    const file = feedFileInput.files[0];
    if (!file) return alert("Select a photo!");
    showToast("Posting...");
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
  };
}

// --- 5. PROFILE LOGIC (FIXED TOGGLES & GENDER) ---
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

  // RESTORED TOGGLES
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
    showToast("Profile Saved!");
    setTimeout(() => location.reload(), 800);
  };

  renderUserPosts(user.uid);
}

// --- 6. FORUM LOGIC (BARK SNIPPETS) ---
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
    container.innerHTML += `
      <div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:15px; background:white;">
        <h3 style="margin:0; color:#ff6b35;">${post.title}</h3>
        <small style="color:#888;">${formatTimestamp(post.createdAt)}</small>
        <p style="color:#444; margin: 10px 0; font-size:14px;">${
          post.description ? post.description.substring(0, 150) : ""
        }...</p>
        <div style="display:flex; gap:10px;">
            <button onclick="editBark('${d.id}', \`${
      post.description
    }\`)" class="follow-btn-small" style="font-size:11px;">Edit</button>
            <button onclick="deletePost('${
              d.id
            }')" style="background:none; border:none; color:#ff4d4d; font-size:11px; cursor:pointer;">Delete</button>
        </div>
      </div>`;
  });
}

window.editBark = (id, oldText) => {
  const nt = prompt("Update your forum bark:", oldText);
  if (nt)
    updateDoc(doc(db, "posts", id), { description: nt }).then(() =>
      location.reload()
    );
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

// --- 7. COMMUNITY, DIRECTORY & DISTANCE ---
function setupCommunityListeners() {
  document.getElementById("toggle-pack-btn").onclick = () => {
    const grid = document.getElementById("following-grid");
    const isHidden = grid.classList.toggle("hidden");
    document.getElementById("toggle-pack-btn").innerText = isHidden
      ? "Show Pack"
      : "Hide Pack";
  };
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
  return `<div class="friend-row-card"><img src="${
    member.photoURL || "https://via.placeholder.com/80"
  }" class="row-avatar" onclick="openUserModal('${id}')"><div style="flex:1"><div class="row-header"><span class="username" onclick="openUserModal('${id}')">${
    member.displayName || "Anonymous"
  }</span>${btn}</div><div class="breed-tag">${
    member.dogBreed || "Dog Lover"
  }</div></div></div>`;
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
  showToast("Following!");
  loadMyPack();
  loadMemberDirectory();
};

window.unfollowUser = async (uid, name) => {
  if (confirm(`Unfollow ${name}?`)) {
    await deleteDoc(doc(db, "users", auth.currentUser.uid, "following", uid));
    await deleteDoc(doc(db, "users", uid, "followers", auth.currentUser.uid));
    showToast("Unfollowed");
    loadMyPack();
    loadMemberDirectory();
  }
};

window.deletePost = async (id) => {
  if (confirm("Delete bark?")) {
    await deleteDoc(doc(db, "posts", id));
    location.reload();
  }
};
window.logoutUser = () =>
  signOut(auth).then(() => (location.href = "index.html"));

window.openUserModal = async (uid) => {
  const data = (await getDoc(doc(db, "users", uid))).data();
  if (!data) return;
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
  } else document.getElementById("modal-dog-info").style.display = "none";
  document.getElementById("user-modal").classList.remove("hidden");
};
