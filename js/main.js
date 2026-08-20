import * as THREE from "three";

/* ============ Hero: 3D video cylinder ============ */

const canvas = document.getElementById("heroCanvas");
const heroSection = document.getElementById("hero");

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  42,
  heroSection.clientWidth / heroSection.clientHeight,
  0.1,
  100
);
camera.position.set(0, 0.4, 9);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(heroSection.clientWidth, heroSection.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;

/* soft ambient + rim light so plane edges read as 3D, not flat billboards */
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const rim = new THREE.PointLight(0x0a84ff, 8, 20);
rim.position.set(0, 2, 4);
scene.add(rim);

const VIDEO_SOURCES = [
  "assets/videos/clip1_ondes.mp4",
  "assets/videos/clip2_sweep.mp4",
  "assets/videos/clip3_rings.mp4",
  "assets/videos/clip4_aurora.mp4",
];

const cylinderGroup = new THREE.Group();
scene.add(cylinderGroup);

const PANEL_COUNT = 10;
const RADIUS = 4.6;
const PANEL_W = 1.55;
const PANEL_H = 2.35;

const videos = [];
const panels = [];

function makeVideoTexture(src) {
  const video = document.createElement("video");
  video.src = src;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute("crossorigin", "anonymous");
  video.play().catch(() => {});
  videos.push(video);

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

for (let i = 0; i < PANEL_COUNT; i++) {
  const src = VIDEO_SOURCES[i % VIDEO_SOURCES.length];
  const texture = makeVideoTexture(src);

  const geometry = new THREE.PlaneGeometry(PANEL_W, PANEL_H, 1, 1);
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.5,
    metalness: 0.1,
    emissive: 0x0a84ff,
    emissiveIntensity: 0.08,
    side: THREE.DoubleSide,
  });

  const mesh = new THREE.Mesh(geometry, material);

  const angle = (i / PANEL_COUNT) * Math.PI * 2;
  mesh.position.set(Math.sin(angle) * RADIUS, 0, Math.cos(angle) * RADIUS);
  mesh.rotation.y = angle;
  mesh.userData.targetScale = 1;
  mesh.userData.baseEmissive = 0.08;

  cylinderGroup.add(mesh);
  panels.push(mesh);

  // thin glowing frame edge for a sleek "screen" feel
  const edgeGeo = new THREE.EdgesGeometry(geometry);
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x0a84ff,
    transparent: true,
    opacity: 0.35,
  });
  const edges = new THREE.LineSegments(edgeGeo, edgeMat);
  mesh.add(edges);
}

cylinderGroup.rotation.x = 0.08;

/* subtle floating particles behind the cylinder for depth */
const particleCount = 140;
const particleGeo = new THREE.BufferGeometry();
const positions = new Float32Array(particleCount * 3);
for (let i = 0; i < particleCount; i++) {
  positions[i * 3] = (Math.random() - 0.5) * 20;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 20 - 4;
}
particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
const particleMat = new THREE.PointsMaterial({
  color: 0x64d2ff,
  size: 0.02,
  transparent: true,
  opacity: 0.5,
});
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

/* ---- interaction: drag-to-spin, hover highlight, click-to-navigate, idle autorotate ---- */
let pointerX = 0;
let pointerY = 0;
let targetRotX = 0.08;
const AUTO_SPEED = 0.0016;
let autoAngle = 0;
let idleSince = 0;
const RESUME_DELAY = 1200;

let isDragging = false;
let dragMoved = false;
let dragStartX = 0;
let dragStartY = 0;
let dragStartRotY = 0;

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
let hoveredPanel = null;

function updatePointerNDC(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function setHover(mesh) {
  if (hoveredPanel === mesh) return;
  if (hoveredPanel) hoveredPanel.userData.targetScale = 1;
  hoveredPanel = mesh;
  if (hoveredPanel) hoveredPanel.userData.targetScale = 1.12;
  canvas.style.cursor = isDragging ? "grabbing" : hoveredPanel ? "pointer" : "grab";
}

canvas.style.cursor = "grab";
canvas.style.touchAction = "pan-y";

const dragHint = document.getElementById("dragHint");

canvas.addEventListener("pointerdown", (e) => {
  isDragging = true;
  dragMoved = false;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragStartRotY = cylinderGroup.rotation.y;
  canvas.style.cursor = "grabbing";
  canvas.setPointerCapture(e.pointerId);
  dragHint?.classList.add("hidden");
});

window.addEventListener("pointermove", (e) => {
  pointerX = (e.clientX / window.innerWidth) * 2 - 1;
  pointerY = (e.clientY / window.innerHeight) * 2 - 1;

  if (isDragging) {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true;
    cylinderGroup.rotation.y = dragStartRotY + dx * 0.006;
    idleSince = performance.now();
    return;
  }

  updatePointerNDC(e.clientX, e.clientY);
  raycaster.setFromCamera(pointerNDC, camera);
  const hits = raycaster.intersectObjects(panels);
  setHover(hits.length ? hits[0].object : null);
});

function endDrag(e) {
  if (!isDragging) return;
  isDragging = false;
  autoAngle = cylinderGroup.rotation.y;
  idleSince = performance.now();
  canvas.style.cursor = hoveredPanel ? "pointer" : "grab";

  if (!dragMoved && hoveredPanel) {
    document.getElementById("projets").scrollIntoView({ behavior: "smooth" });
  }
}
window.addEventListener("pointerup", endDrag);
window.addEventListener("pointercancel", endDrag);

function resize() {
  const w = heroSection.clientWidth;
  const h = heroSection.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
window.addEventListener("resize", resize);

let lastTime = 0;
function animate(time) {
  const dt = Math.min(time - lastTime, 50);
  lastTime = time;

  if (!isDragging && time - idleSince > RESUME_DELAY) {
    autoAngle += AUTO_SPEED * dt;
    const targetRotY = autoAngle + pointerX * 0.35;
    cylinderGroup.rotation.y += (targetRotY - cylinderGroup.rotation.y) * 0.04;
  }

  targetRotX = 0.08 + pointerY * 0.15;
  cylinderGroup.rotation.x += (targetRotX - cylinderGroup.rotation.x) * 0.04;

  panels.forEach((mesh) => {
    const s = mesh.scale.x + (mesh.userData.targetScale - mesh.scale.x) * 0.15;
    mesh.scale.setScalar(s);
    mesh.material.emissiveIntensity =
      mesh.userData.baseEmissive +
      (mesh.userData.targetScale - 1) * 1.4;
  });

  particles.rotation.y += 0.0002 * dt;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
resize();

/* pause videos when hero is off-screen to save resources */
const heroObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      videos.forEach((v) => {
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      });
    });
  },
  { threshold: 0.05 }
);
heroObserver.observe(heroSection);

/* ============ Nav: blur intensifies on scroll + mobile menu ============ */
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

/* ============ Cursor glow ============ */
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

/* ============ Scroll reveal ============ */
const revealTargets = document.querySelectorAll(
  ".about-text, .about-stats .stat, .timeline-item, .project-card, .skill-card, .contact-box, .formations"
);
revealTargets.forEach((el) => el.classList.add("reveal"));

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

/* stagger timeline / project / skill cards slightly for polish */
document.querySelectorAll(".timeline-item").forEach((el, i) => {
  el.style.transitionDelay = `${Math.min(i * 60, 240)}ms`;
});
document.querySelectorAll(".project-card").forEach((el, i) => {
  el.style.transitionDelay = `${i * 100}ms`;
});
document.querySelectorAll(".skill-card").forEach((el, i) => {
  el.style.transitionDelay = `${i * 70}ms`;
});

/* ============ Animated stat counters ============ */
const statNumbers = document.querySelectorAll(".stat-number");
const countObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count, 10);
      const duration = 1200;
      const start = performance.now();
      function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
      countObserver.unobserve(el);
    });
  },
  { threshold: 0.5 }
);
statNumbers.forEach((el) => countObserver.observe(el));
