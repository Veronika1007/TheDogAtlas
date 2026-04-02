// ==========================================
// 1. IMPORTS & INITIALIZATION
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
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDEctacZYlmdnQt2ZITO9bsH54tkxvTXE4",
  authDomain: "thedogatlas.firebaseapp.com",
  projectId: "thedogatlas",
  storageBucket: "thedogatlas.appspot.com",
  messagingSenderId: "367375171167",
  appId: "1:367375171167:web:6e326e64d73347f9f79e8a",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// ==========================================
// 2. AUTHENTICATION (MOVED TO TOP)
// ==========================================
// 1. Core Auth Logic
const loginForm = document.getElementById("login-form");

if (loginForm) {
  console.log("Login form detected and active."); // This helps us verify in console
  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const email = document.getElementById("login-email").value;
    const pass = document.getElementById("login-password").value;

    console.log("Attempting login for:", email);

    signInWithEmailAndPassword(auth, email, pass)
      .then((userCredential) => {
        console.log("Login success!");
        window.location.href = "index.html";
      })
      .catch((err) => {
        console.error("Login failed:", err.code);
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
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        pass,
      );
      await updateProfile(userCredential.user, { displayName: name });
      await setDoc(doc(db, "users", userCredential.user.uid), {
        displayName: name,
        email: email,
        createdAt: serverTimestamp(),
        following: [],
        followers: [],
      });
      window.location.href = "index.html";
    } catch (err) {
      alert("Signup error: " + err.message);
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
// 3. SOCIAL & CORE LOGIC (FEED / TRAILS / PROFILES)
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
  if (!user) return alert("Login to woof!");
  const postRef = doc(db, "feedPosts", postId);
  const snap = await getDoc(postRef);
  const likedBy = snap.data().likedBy || [];
  if (likedBy.includes(user.uid)) {
    await updateDoc(postRef, {
      likes: increment(-1),
      likedBy: arrayRemove(user.uid),
    });
  } else {
    await updateDoc(postRef, {
      likes: increment(1),
      likedBy: arrayUnion(user.uid),
    });
  }
};

async function loadUserProfile() {
  const user = auth.currentUser;
  const userDoc = await getDoc(doc(db, "users", user.uid));
  if (userDoc.exists()) {
    const data = userDoc.data();
    document.getElementById("profile-name").innerText =
      data.displayName || "Explorer";
    if (data.photoURL)
      document.getElementById("profile-pic").src = data.photoURL;
  }
}

// ==========================================
// 4. CALENDAR & EVENTS (BOTTOM FOR SAFETY)
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
    setTimeout(() => {
      calendar.updateSize();
    }, 500);
  } catch (err) {
    console.error("Calendar fail:", err);
  }
}

window.addEventListener("load", () => {
  if (document.getElementById("calendar")) initEventsCalendar();
});
