// This part handles what happens after a successful login
onAuthStateChanged(auth, (user) => {
  const authLinks = document.getElementById("auth-links");
  if (user) {
    console.log("User is logged in:", user.email);

    // 1. Update Navigation Links
    if (authLinks) {
      authLinks.innerHTML = `
                <li><a href="profile.html">Profile</a></li>
                <li><a href="#" id="logout-btn">Logout</a></li>
            `;
      document.getElementById("logout-btn").onclick = () => {
        signOut(auth).then(() => {
          window.location.href = "login.html";
        });
      };
    }

    // 2. Recall Community Data
    if (document.getElementById("pack-feed")) {
      console.log("Loading Pack Feed...");
      loadFeed();
    }
  } else {
    console.log("No user logged in.");
    if (authLinks) {
      authLinks.innerHTML = `<li><a href="login.html" class="login-btn">Login</a></li>`;
    }
  }
});
