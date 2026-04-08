// ==========================================
// 1. FIREBASE IMPORTS & INITIALIZATION
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
  apiKey: "AIzaSyAUzPfsLsh5bCsso7DMLDlmuyb-PR0JeeY",
  authDomain: "thedogatlas.firebaseapp.com",
  projectId: "thedogatlas",
  storageBucket: "thedogatlas.firebasestorage.app",
  messagingSenderId: "313338994397",
  appId: "1:313338994397:web:cc18283775082fa0194534",
  measurementId: "G-RFSFBEKSS9",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ==========================================
// 2. AUTHENTICATION (LOGIN & SIGNUP)
// ==========================================
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
// 3. COMMUNITY & SOCIAL LOGIC
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
                        <span class="woof-btn ${hasLiked ? "active" : ""}" onclick="likeFeedPost('${d.id}', this)">
                            <i class="fa-solid fa-paw"></i> <small>${post.likes || 0}</small>
                        </span>
                        <p><strong>${post.authorName}</strong> ${post.caption || ""}</p>
                    </div>
                </div>`;
    });
  });
}

window.likeFeedPost = async (postId, element) => {
  const user = auth.currentUser;
  if (!user) return alert("Login to woof!");
  const postRef = doc(db, "feedPosts", postId);
  element.classList.toggle("active");
  const isLiked = element.classList.contains("active");
  await updateDoc(postRef, {
    likes: increment(isLiked ? 1 : -1),
    likedBy: isLiked ? arrayUnion(user.uid) : arrayRemove(user.uid),
  });
};

// ==========================================
// 4. CALENDAR & EVENTS
// ==========================================
async function initEventsCalendar() {
  const calendarEl = document.getElementById("calendar");
  if (!calendarEl) return;

  try {
    const calendar = new FullCalendar.Calendar(calendarEl, {
      initialView: "dayGridMonth",
      height: "auto",
      headerToolbar: { left: "prev,next", center: "title", right: "today" },
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

window.addEventListener("load", () => {
  if (document.getElementById("calendar")) initEventsCalendar();
});
