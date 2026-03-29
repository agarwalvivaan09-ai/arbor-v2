import { signUp, login, resetPassword, observeAuth, logout } from "./firebase/auth.js";
import { createProfile, getProfiles } from "./profiles/profiles.js";
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

// AUTH STATE LISTENER
observeAuth(async (user) => {
    console.log("Auth state changed:", user);
    if (user) {
    try {
        const profiles = await getProfiles(user.uid);

        let profileHTML = "";

        profiles.forEach(p => {
            profileHTML += `<li>${p.name} (${p.type})</li>`;
        });

       let selectedType = "personal";

document.body.innerHTML = `
<div class="container">
  <div class="card">

    <h1>Arbor</h1>
    <p>${user.email}</p>


   <div class="profiles-grid">
  ${profiles.length === 0 
    ? "<p>No profiles yet</p>" 
    : profiles.map(p => `
    <div class="profile-card">
        <div class="profile-left">
            <div class="profile-icon">
                ${p.name ? p.name.charAt(0).toUpperCase() : "P"}
            </div>
            <div class="profile-info">
                <div class="profile-name">${p.name || "Untitled"}</div>
                <div class="profile-sub">${p.type}</div>
            </div>
        </div>
    </div>
`).join("")
  }
</div>

    <h2>Create Profile</h2>

    <input id="profileName" placeholder="e.g. Personal, Investing" />

    <div class="select">
      <button id="personalBtn" class="active">Personal</button>
      <button id="businessBtn">Business</button>
      <button id="familyBtn">Family</button>
    </div>

    <button id="createProfile" class="primary">Create Profile</button>

    <button id="logout" class="secondary">Logout</button>

  </div>
</div>
`;
const buttons = {
    personal: document.getElementById("personalBtn"),
    business: document.getElementById("businessBtn"),
    family: document.getElementById("familyBtn")
};

Object.keys(buttons).forEach(type => {
    buttons[type].onclick = () => {
        selectedType = type;

        Object.values(buttons).forEach(btn => btn.classList.remove("active"));
        buttons[type].classList.add("active");
    };
});

        // CREATE PROFILE
        document.getElementById("createProfile").onclick = async () => {
            const name = document.getElementById("profileName").value;
            const type = selectedType;

            await createProfile(user.uid, type, name);

            location.reload();
        };

        // LOGOUT
        document.getElementById("logout").onclick = async () => {
            await logout();
        };

    } catch (error) {
        console.error("PROFILE ERROR:", error);

        document.body.innerHTML = `
            <h1>Error loading profiles</h1>
            <p>Check console</p>
        `;
    }
}else {
    document.body.innerHTML = `
    <div class="container">

        <div class="hero">
            <h1 class="hero-title">Arbor</h1>
            <p class="hero-sub">Quant Financial Operating System</p>
            <p class="hero-mini">Built by Vivaan Agarwal</p>
        </div>

        <div class="card auth-card">

            <input id="email" placeholder="Email" />
            <input id="password" type="password" placeholder="Password" />

            <button id="login" class="primary">Login</button>
            <button id="signup" class="secondary">Create Account</button>
            <button id="reset" class="link">Forgot Password?</button>

        </div>

    </div>
    `;

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");

    document.getElementById("signup").onclick = async () => {
        try {
            await signUp(emailInput.value, passwordInput.value);
            alert("Account created!");
        } catch (e) {
            alert(e.message);
        }
    };

    document.getElementById("login").onclick = async () => {
        try {
            await login(emailInput.value, passwordInput.value);
        } catch (e) {
            alert(e.message);
        }
    };

    document.getElementById("reset").onclick = async () => {
        try {
            await resetPassword(emailInput.value);
            alert("Password reset email sent!");
        } catch (e) {
            alert(e.message);
        }
    };
}
});

// SIGN UP
document.getElementById("signup").onclick = async () => {
    try {
        await signUp(emailInput.value, passwordInput.value);
        alert("Account created!");
    } catch (e) {
        alert(e.message);
    }
};

// LOGIN
document.getElementById("login").onclick = async () => {
    try {
        await login(emailInput.value, passwordInput.value);
        alert("Logged in!");
    } catch (e) {
        alert(e.message);
    }
};

// RESET PASSWORD
document.getElementById("reset").onclick = async () => {
    try {
        await resetPassword(emailInput.value);
        alert("Password reset email sent!");
    } catch (e) {
        alert(e.message);
    }
};