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

// --- HELPERS ---
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
    }

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

// --- PACK FEED LOGIC (FIXED) ---
async function loadVisualFeed(myUid) {
  const feedContainer = document.getElementById("pack-feed");
  if (!feedContainer) return;

  // 1. Get the list of people I am following
  const followingSnap = await getDocs(
    collection(db, "users", myUid, "following")
  );
  const followingIds = followingSnap.docs.map((doc) => doc.id);
  followingIds.push(myUid);

  // 2. Set up real-time listener
  const q = query(collection(db, "feedPosts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    feedContainer.innerHTML = "";
    let hasPosts = false;

    snapshot.forEach((d) => {
      const post = d.data();
      // If followingIds only contains ME, show everyone to prevent empty screen
      // Otherwise, show only the pack
      const showEveryone = followingIds.length <= 1;

      if (showEveryone || followingIds.includes(post.authorId)) {
        hasPosts = true;
        feedContainer.innerHTML += `
                    <div class="feed-card" style="background: white; border-radius: 12px; border: 1px solid #ddd; overflow: hidden; margin-bottom: 20px;">
                        <div style="padding: 10px; display: flex; align-items: center; gap: 8px;">
                            <img src="${
                              post.authorPhoto ||
                              "https://via.placeholder.com/40"
                            }" style="width: 25px; height: 25px; border-radius: 50%; object-fit: cover;">
                            <span style="font-weight: bold; font-size: 13px;">${
                              post.authorName
                            }</span>
                        </div>
                        <img src="${
                          post.imageUrl
                        }" style="width: 100%; aspect-ratio: 1/1; object-fit: cover;">
                        <div style="padding: 12px;">
                            <div style="margin-bottom: 8px; display: flex; gap: 12px;">
                                <span onclick="woofPost('${
                                  d.id
                                }')" class="woof-btn"><i class="fa fa-paw"></i> <small>${
          post.woofs || 0
        }</small></span>
                                <span onclick="openComments('${
                                  d.id
                                }')" class="comment-btn"><i class="fa-regular fa-comment"></i></span>
                            </div>
                            <p style="margin: 0; font-size: 13px;"><strong>${
                              post.authorName
                            }</strong> ${post.caption || ""}</p>
                        </div>
                    </div>`;
      }
    });

    if (!hasPosts) {
      feedContainer.innerHTML =
        "<p style='text-align:center; padding:40px; color:#999;'>Be the first to share a bark! Your feed is currently empty.</p>";
    }
  });
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
      (list.innerHTML += `<div style="margin-bottom:5px; font-size:14px;"><strong>${c.user}:</strong> ${c.text}</div>`)
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

// --- FILE UPLOAD LOGIC ---
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
    if (!file) return alert("Select a photo!");
    showToast("Sharing...");
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

// --- PROFILE SETUP & EDIT ---
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
    if (document.getElementById(id))
      document.getElementById(id).value = fields[id];
  });

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
    };
    await setDoc(doc(db, "users", user.uid), updated, { merge: true });
    showToast("Profile Saved!");
    setTimeout(() => location.reload(), 800);
  };

  // --- IMAGE CROPPER ---
  const avatarInput = document.getElementById("avatar-upload");
  const cropModal = document.getElementById("crop-modal");
  const previewImg = document.getElementById("preview-to-crop");
  const zoomSlider = document.getElementById("zoom-slider");
  let isDragging = false,
    startX,
    startY,
    currentX = 0,
    currentY = 0,
    currentScale = 1;

  if (avatarInput) {
    avatarInput.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          previewImg.src = ev.target.result;
          currentX = 0;
          currentY = 0;
          currentScale = 1;
          zoomSlider.value = 1;
          previewImg.style.transform = `translate(-50%, -50%) scale(1)`;
          cropModal.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
      }
    };
  }
  zoomSlider.oninput = (e) => {
    currentScale = e.target.value;
    previewImg.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px)) scale(${currentScale})`;
  };
  previewImg.onmousedown = (e) => {
    isDragging = true;
    startX = e.clientX - currentX;
    startY = e.clientY - currentY;
  };
  document.onmousemove = (e) => {
    if (isDragging) {
      currentX = e.clientX - startX;
      currentY = e.clientY - startY;
      previewImg.style.transform = `translate(calc(-50% + ${currentX}px), calc(-50% + ${currentY}px)) scale(${currentScale})`;
    }
  };
  document.onmouseup = () => (isDragging = false);

  document.getElementById("save-crop").onclick = async () => {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const size = 300;
    canvas.width = size;
    canvas.height = size;
    const drawWidth = size * currentScale * (previewImg.naturalWidth / 280);
    const drawHeight =
      drawWidth / (previewImg.naturalWidth / previewImg.naturalHeight);
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
        const storageRef = ref(storage, `profile_pictures/${user.uid}`);
        await uploadBytes(storageRef, blob);
        const url = await getDownloadURL(storageRef);
        await setDoc(
          doc(db, "users", user.uid),
          { photoURL: url },
          { merge: true }
        );
        location.reload();
      },
      "image/jpeg",
      0.9
    );
  };
  renderUserPosts(user.uid);
}

// --- FORUM LOGIC ---
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

// --- DIRECTORY & SEARCH ---
function setupCommunityListeners() {
  const toggleBtn = document.getElementById("toggle-pack-btn");
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      const grid = document.getElementById("following-grid");
      const isHidden = grid.classList.toggle("hidden");
      toggleBtn.innerText = isHidden ? "Show Pack" : "Hide Pack";
    };
  }

  const friendsSearchBtn = document.getElementById("friends-search-btn");
  if (friendsSearchBtn) {
    friendsSearchBtn.onclick = () => {
      loadMemberDirectory(
        document.getElementById("member-search").value.toLowerCase(),
        document.getElementById("filter-breed").value,
        document.getElementById("filter-distance")?.value
      );
    };
  }

  const forumSearchBtn = document.getElementById("forum-search-btn");
  if (forumSearchBtn) {
    forumSearchBtn.onclick = () => {
      loadForumPosts(
        document.getElementById("forum-search").value.toLowerCase()
      );
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

// --- AUTH & FORUM POSTING ---
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

const forumPostForm = document.getElementById("create-post-form");
if (forumPostForm) {
  forumPostForm.onsubmit = async (e) => {
    e.preventDefault();
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
  showToast("Following!");
  loadMyPack();
  loadMemberDirectory();
  loadVisualFeed(auth.currentUser.uid);
};

window.unfollowUser = async (uid, name) => {
  if (confirm(`Unfollow ${name}?`)) {
    await deleteDoc(doc(db, "users", auth.currentUser.uid, "following", uid));
    await deleteDoc(doc(db, "users", uid, "followers", auth.currentUser.uid));
    showToast("Unfollowed");
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

// RESTORED SNIPPET LOGIC
async function renderUserPosts(uid) {
  const container = document.getElementById("my-posts-list");
  if (!container) return;
  const snap = await getDocs(
    query(
      collection(db, "posts"),
      where("authorId", "==", uid),
      orderBy("createdAt", "desc")
    )
  );
  container.innerHTML = snap.empty ? "<p>No barks yet.</p>" : "";
  snap.forEach((d) => {
    const post = d.data();
    container.innerHTML += `<div class="forum-topic-card" style="border:1px solid #ddd; padding:15px; border-radius:8px; margin-bottom:15px; background:white;">
        <h3 style="margin:0; color:#ff6b35;">${post.title}</h3>
        <p style="color:#444; margin: 8px 0;">${
          post.description ? post.description.substring(0, 100) : ""
        }...</p>
        <button onclick="deletePost('${
          d.id
        }')" style="color:#ff4d4d; background:none; border:none; cursor:pointer;">Delete</button>
      </div>`;
  });
}

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

window.deletePost = async (id) => {
  if (confirm("Delete bark?")) {
    await deleteDoc(doc(db, "posts", id));
    location.reload();
  }
};
window.logoutUser = () =>
  signOut(auth).then(() => (location.href = "index.html"));
