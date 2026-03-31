// ==========================================
// 1. FIREBASE INITIALIZATION & IMPORTS
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyAsd9ZeAjF-Byk27mwC85_pE6ci1euKEXk",
  authDomain: "thedogatlas.firebaseapp.com",
  projectId: "thedogatlas",
  storageBucket: "thedogatlas.appspot.com",
  messagingSenderId: "367375171167",
  appId: "1:367375171167:web:6e326e64d73347f9f79e8a",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================================
// 2. AUTHENTICATION (RE-ORDERED TO TOP)
// ==========================================

// Login Logic
const loginForm = document.getElementById("login-form");
if (loginForm) {
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-password").value;
    signInWithEmailAndPassword(auth, email, pass)
      .then(() => {
        window.location.href = "index.html";
      })
      .catch((err) => {
        alert("Login Error: " + err.message);
      });
  });
}

// Signup Logic
const signupForm = document.getElementById("signup-form");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("signup-email").value;
    const pass = document.getElementById("signup-password").value;
    const name = document.getElementById("signup-name").value;
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCred.user, { displayName: name });
      await setDoc(doc(db, "users", userCred.user.uid), {
        displayName: name,
        email: email,
        createdAt: serverTimestamp(),
        following: [],
        followers: [],
      });
      window.location.href = "index.html";
    } catch (err) {
      alert("Signup Error: " + err.message);
    }
  });
}

// Global Auth State
onAuthStateChanged(auth, (user) => {
  const authLinks = document.getElementById("auth-links");
  if (user) {
    if (authLinks) {
      authLinks.innerHTML = `<li><a href="profile.html">Profile</a></li><li><a href="#" onclick="logoutUser()">Logout</a></li>`;
    }
    if (document.getElementById("pack-feed")) loadVisualFeed();
    if (document.getElementById("user-profile-data")) loadUserProfile();
  } else {
    if (authLinks) {
      authLinks.innerHTML = `<li><a href="login.html" class="login-btn">Login</a></li>`;
    }
  }
});

window.logoutUser = () => {
  signOut(auth).then(() => {
    window.location.href = "login.html";
  });
};

// ==========================================
// 3. SOCIAL & COMMUNITY (FEED/FOLLOW)
// ==========================================

async function loadVisualFeed() {
  const feedContainer = document.getElementById("pack-feed");
  if (!feedContainer) return;
  const q = query(collection(db, "feedPosts"), orderBy("createdAt", "desc"));
  onSnapshot(q, (snapshot) => {
    feedContainer.innerHTML = "";
    snapshot.forEach((d) => {
      const post = d.data();
      const user = auth.currentUser;
      const hasLiked = post.likedBy && user && post.likedBy.includes(user.uid);
      feedContainer.innerHTML += `
                <div class="feed-card">
                    <div class="feed-header" style="padding:12px; display:flex; align-items:center; gap:10px;">
                        <img src="${post.authorPhoto || "Media/Milo.png"}" style="width:35px; height:35px; border-radius:50%;">
                        <strong>${post.authorName}</strong>
                    </div>
                    <img src="${post.imageUrl}" style="width:100%; aspect-ratio:1/1; object-fit:cover;">
                    <div style="padding:15px;">
                        <div style="display:flex; gap:15px; margin-bottom:10px;">
                            <span class="woof-btn ${hasLiked ? "active" : ""}" onclick="likeFeedPost('${d.id}', this)">
                                <i class="fa-solid fa-paw"></i> <small>${post.likes || 0}</small>
                            </span>
                        </div>
                        <p><strong>${post.authorName}</strong> ${post.caption || ""}</p>
                    </div>
                </div>`;
    });
  });
}

window.likeFeedPost = async (postId, element) => {
  const user = auth.currentUser;
  if (!user) return;
  const postRef = doc(db, "feedPosts", postId);
  element.classList.toggle("active");
  await updateDoc(postRef, {
    likes: increment(element.classList.contains("active") ? 1 : -1),
    likedBy: element.classList.contains("active")
      ? arrayUnion(user.uid)
      : arrayRemove(user.uid),
  });
};

// ==========================================
// 4. CALENDAR & EVENTS (ISOLATED AT BOTTOM)
// ==========================================

async function initEventsCalendar() {
  const calendarEl = document.getElementById("calendar");
  // SAFETY GATE: Stops the script from crashing on Login page
  if (!calendarEl) return;

  try {
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      height: "auto",
      aspectRatio: 1.35,
      headerToolbar: { left: "prev,next", center: "title", right: "today" },
      themeSystem: "standard",
      events: async function (info, successCallback) {
        const snap = await getDocs(collection(db, "events"));
        const events = snap.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title,
          start: doc.data().start,
          color: "#ff6b35",
        }));
        successCallback(events);
      },
    });
    calendar.render();
    setTimeout(() => calendar.updateSize(), 500);
  } catch (e) {
    console.error("Calendar fail:", e);
  }
}

// Unified Trigger
window.addEventListener("load", () => {
  if (document.getElementById("calendar")) initEventsCalendar();
});
