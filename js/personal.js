/* ============ shared chrome: grain / cursor glow / nav / reveal ============ */

const nav = document.getElementById("nav");
const navInner = document.querySelector(".nav-inner");
window.addEventListener("scroll", () => {
  if (window.scrollY > 40) {
    navInner.style.background = "rgba(6,6,8,0.75)";
    navInner.style.borderColor = "rgba(255,255,255,0.12)";
  } else {
    navInner.style.background = "rgba(8,8,10,0.55)";
    navInner.style.borderColor = "rgba(255,255,255,0.08)";
  }
});

const navBurger = document.getElementById("navBurger");
const navMobile = document.getElementById("navMobile");
navBurger.addEventListener("click", () => {
  const isOpen = navMobile.classList.toggle("open");
  navBurger.setAttribute("aria-expanded", String(isOpen));
});
navMobile.querySelectorAll("a").forEach((a) =>
  a.addEventListener("click", () => {
    navMobile.classList.remove("open");
    navBurger.setAttribute("aria-expanded", "false");
  })
);

const glow = document.getElementById("cursorGlow");
let glowActive = false;
window.addEventListener("pointermove", (e) => {
  glow.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
  if (!glowActive) {
    glow.classList.add("active");
    glowActive = true;
  }
});
window.addEventListener("pointerleave", () => {
  glow.classList.remove("active");
  glowActive = false;
});

const revealTargets = document.querySelectorAll(".reveal");
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
);
revealTargets.forEach((el) => revealObserver.observe(el));

/* ============ audio player ============ */

const audio = document.getElementById("audioEl");
const seekBar = document.getElementById("seekBar");
const volBar = document.getElementById("volBar");
const timeCurrent = document.getElementById("timeCurrent");
const timeDuration = document.getElementById("timeDuration");
const nowPlayingBar = document.getElementById("nowPlayingBar");
const npProgressFill = document.getElementById("npProgressFill");
const npProgressTrack = document.querySelector(".np-progress");

const playButtons = [
  document.getElementById("playBtnMain"),
  document.getElementById("playBtn"),
  document.getElementById("trackPlayBtn0"),
  document.getElementById("npPlayBtn"),
].filter(Boolean);

audio.volume = 0.8;

function formatTime(seconds) {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function setPlayingIcons(isPlaying) {
  playButtons.forEach((btn) => {
    const playIcon = btn.querySelector(".icon-play");
    const pauseIcon = btn.querySelector(".icon-pause");
    if (!playIcon || !pauseIcon) return;
    playIcon.classList.toggle("icon-hidden", isPlaying);
    pauseIcon.classList.toggle("icon-hidden", !isPlaying);
  });
}

function togglePlay() {
  if (audio.paused) {
    audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

playButtons.forEach((btn) => btn.addEventListener("click", togglePlay));

audio.addEventListener("play", () => {
  setPlayingIcons(true);
  nowPlayingBar.classList.add("visible");
  nowPlayingBar.setAttribute("aria-hidden", "false");
});
audio.addEventListener("pause", () => setPlayingIcons(false));
audio.addEventListener("ended", () => setPlayingIcons(false));

audio.addEventListener("loadedmetadata", () => {
  timeDuration.textContent = formatTime(audio.duration);
});

let isSeeking = false;
audio.addEventListener("timeupdate", () => {
  timeCurrent.textContent = formatTime(audio.currentTime);
  if (audio.duration) {
    const pct = (audio.currentTime / audio.duration) * 100;
    if (!isSeeking) seekBar.value = String(pct * 10);
    npProgressFill.style.width = `${pct}%`;
  }
});

seekBar.addEventListener("input", () => {
  isSeeking = true;
  const pct = Number(seekBar.value) / 1000;
  timeCurrent.textContent = formatTime(pct * (audio.duration || 0));
});
seekBar.addEventListener("change", () => {
  if (audio.duration) audio.currentTime = (Number(seekBar.value) / 1000) * audio.duration;
  isSeeking = false;
});

volBar.addEventListener("input", () => {
  audio.volume = Number(volBar.value) / 100;
});

npProgressTrack.addEventListener("click", (e) => {
  if (!audio.duration) return;
  const rect = npProgressTrack.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  audio.currentTime = pct * audio.duration;
});

/* ============ game modal ============ */

const GAMES = {
  carrenoir: {
    logo: "Carré Noir",
    logoLines: ["CARRÉ", "NOIR"],
    cover: "assets/img/games/carre-noir-cover.jpg",
    platforms: ["Clockwork GameShell", "Sony PSP", "PC (Windows / Mac / Linux)"],
    blurb:
      "Un jeu d'action en monde ouvert façon GTA IV, situé à Genève, en Suisse. On y incarne un immigré qui se retrouve happé par la criminalité locale. Le personnage est personnalisable : homme ou femme, peau et vêtements au choix. Le jeu propose un mode deathmatch multijoueur à 12, ainsi qu'une toute nouvelle implémentation de la physique Bullet pour les dégâts de véhicules et les ragdolls des personnages.",
    tags: ["Deathmatch 12 joueurs", "Bullet Physics", "Personnage personnalisable"],
  },
  horror: {
    logo: "Sans nom",
    cover: "assets/img/games/horror-game-cover.jpg",
    platforms: ["TBA"],
    blurb: "Tout est encore à définir pour ce projet : nom, plateformes, univers et mécaniques de jeu sont TBA (to be announced).",
    tags: ["TBA"],
  },
};

const modalBackdrop = document.getElementById("gameModalBackdrop");
const modalHero = document.getElementById("modalHero");
const modalLogo = document.getElementById("modalLogo");
const modalPlatforms = document.getElementById("modalPlatforms");
const modalBlurb = document.getElementById("modalBlurb");
const modalTags = document.getElementById("modalTags");
const modalClose = document.getElementById("gameModalClose");

/* deterministic hand-cut jitter, cycled per letter — avoids a perfectly
   mechanical baseline without reshuffling on every modal open */
const JITTER_ROT = [-4, 3, -2, 4, -3, 2, -4, 1, 3, -1];
const JITTER_Y = [-3, 2, -4, 1, 3, -2, 2, -3, 1, 2];

function buildPricedownLogo(lines) {
  let i = 0;
  const lineHtml = lines
    .map((line) => {
      const letters = line
        .split("")
        .map((ch) => {
          if (ch === " ") return " ";
          const rot = JITTER_ROT[i % JITTER_ROT.length];
          const ty = JITTER_Y[i % JITTER_Y.length];
          i++;
          return `<span class="lp-letter" style="transform: rotate(${rot}deg) translateY(${ty}px)">${ch}</span>`;
        })
        .join("");
      return `<span class="lp-line">${letters}</span>`;
    })
    .join("");
  return `${lineHtml}<span class="lp-underline"></span>`;
}

function openGameModal(key) {
  const game = GAMES[key];
  if (!game) return;

  if (game.logoLines) {
    modalLogo.className = "game-modal-logo logo-pricedown";
    modalLogo.innerHTML = buildPricedownLogo(game.logoLines);
  } else {
    modalLogo.className = "game-modal-logo";
    modalLogo.textContent = game.logo;
  }
  modalHero.style.backgroundImage = `url(${game.cover})`;
  modalPlatforms.innerHTML = game.platforms
    .map((p) => `<span class="platform-badge">${p}</span>`)
    .join("");
  modalBlurb.textContent = game.blurb;
  modalTags.innerHTML = game.tags.map((t) => `<span class="tag">${t}</span>`).join("");

  modalBackdrop.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeGameModal() {
  modalBackdrop.classList.remove("open");
  document.body.style.overflow = "";
}

document.querySelectorAll(".game-card").forEach((card) => {
  card.addEventListener("click", () => openGameModal(card.dataset.game));
});
modalClose.addEventListener("click", closeGameModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeGameModal();
});
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && modalBackdrop.classList.contains("open")) closeGameModal();
});
