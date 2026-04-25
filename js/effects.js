/* ============================================================
   BIFROST WINES — effects.js
   Scroll Animations, Particles, Ripple Effects
   ============================================================ */

const EFFECTS_STATE = {
  revealObserver: null,
  tiltMutationObserver: null,
  floatingMutationObserver: null,
  cameraBound: false,
  depthBound: false,
  heroBottleBound: false,
  heroDepthBound: false,
  parallaxBound: false,
  rippleBound: false,
  navbarScrollBound: false,
  cursorSpotlightBound: false,
  scrollDriftBound: false,
  performanceMode: null,
};

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function detectPerformanceMode() {
  if (EFFECTS_STATE.performanceMode) return EFFECTS_STATE.performanceMode;

  const nav = navigator;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const reducedMotion = prefersReducedMotion();
  const lowCores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4;
  const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  const saveData = Boolean(connection?.saveData);
  const smallViewport = Math.min(window.innerWidth, window.innerHeight) < 900;

  const lite = reducedMotion || coarsePointer || lowCores || lowMemory || saveData || smallViewport;
  EFFECTS_STATE.performanceMode = lite ? 'lite' : 'full';
  document.documentElement.dataset.effectsMode = EFFECTS_STATE.performanceMode;
  document.body.classList.toggle('effects-lite', lite);
  return EFFECTS_STATE.performanceMode;
}

function isLiteMode() {
  return detectPerformanceMode() === 'lite';
}

/* ── Scroll Reveal (Intersection Observer) ──────────────────── */
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  if (EFFECTS_STATE.revealObserver) {
    EFFECTS_STATE.revealObserver.disconnect();
  }

  elements.forEach((el) => {
    if (!el.dataset.reveal) {
      if (el.classList.contains('scale-in')) {
        el.dataset.reveal = 'depth';
      } else if (el.classList.contains('from-left')) {
        el.dataset.reveal = 'left-3d';
      } else if (el.classList.contains('from-right')) {
        el.dataset.reveal = 'right-3d';
      }
    }
  });

  EFFECTS_STATE.revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        } else if (entry.intersectionRatio < 0.04) {
          entry.target.classList.remove('visible');
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  elements.forEach(el => EFFECTS_STATE.revealObserver.observe(el));
}

/* ── Staggered Children Reveal ──────────────────────────────── */
function initStaggerReveal(containerSelector = '.stagger-parent', childSelector = '.stagger-child') {
  const containers = document.querySelectorAll(containerSelector);

  containers.forEach(container => {
    const children = container.querySelectorAll(childSelector);
    children.forEach((child, i) => {
      child.style.transitionDelay = `${i * 80}ms`;
    });
  });
}

/* ── Particles Generator ────────────────────────────────────── */
function initParticles(layerSelector = '.particles-layer') {
  if (isLiteMode()) return;
  const layers = document.querySelectorAll(layerSelector);

  layers.forEach(layer => {
    const count = parseInt(layer.dataset.count || '12');
    layer.innerHTML = '';

    for (let i = 0; i < count; i++) {
      const particle = document.createElement('span');
      particle.className = 'particle';

      const left     = Math.random() * 100;
      const duration = 6 + Math.random() * 10;
      const delay    = Math.random() * 8;
      const drift    = (Math.random() - 0.5) * 60;
      const size     = 1 + Math.random() * 3;

      particle.style.cssText = `
        left: ${left}%;
        --duration: ${duration}s;
        --delay: ${delay}s;
        --drift-x: ${drift}px;
        width: ${size}px;
        height: ${size}px;
        opacity: 0;
      `;

      layer.appendChild(particle);
    }
  });
}

/* ── Ripple Button Effect ───────────────────────────────────── */
function initRipple() {
  if (EFFECTS_STATE.rippleBound) return;
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('.btn-ripple');
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const wave = document.createElement('span');
    wave.className = 'ripple-wave';
    wave.style.cssText = `
      left: ${x}px;
      top: ${y}px;
      width: 10px;
      height: 10px;
      margin-left: -5px;
      margin-top: -5px;
    `;

    btn.appendChild(wave);
    setTimeout(() => wave.remove(), 700);
  });
  EFFECTS_STATE.rippleBound = true;
}

/* ── Parallax Micro Effect ──────────────────────────────────── */
function initParallax() {
  if (EFFECTS_STATE.parallaxBound || isLiteMode()) return;
  const parallaxEls = document.querySelectorAll('[data-parallax]');
  if (!parallaxEls.length) return;

  let ticking = false;

  function onScroll() {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        parallaxEls.forEach(el => {
          const speed  = parseFloat(el.dataset.parallax || '0.3');
          const offset = scrollY * speed;
          el.style.transform = `translateY(${offset}px)`;
        });
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  EFFECTS_STATE.parallaxBound = true;
}

/* ── Hero Text Animated Entrance ────────────────────────────── */
function initHeroEntrance() {
  const heroElements = document.querySelectorAll('.hero-animate');
  heroElements.forEach((el, i) => {
    el.style.animationDelay = `${0.2 + i * 0.15}s`;
    el.style.animationFillMode = 'both';
    el.classList.add('animate-in');
  });
}

/* ── Navbar Scroll Behavior ─────────────────────────────────── */
function initNavbarScroll() {
  if (EFFECTS_STATE.navbarScrollBound) return;
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  let lastScroll = 0;
  let ticking = false;

  function handleScroll() {
    const currentScroll = window.scrollY;

    if (!ticking) {
      requestAnimationFrame(() => {
        // Add scrolled class for blur effect
        if (currentScroll > 20) {
          navbar.classList.add('scrolled');
        } else {
          navbar.classList.remove('scrolled');
        }

        // Auto-hide on deep scroll (optional)
        // if (currentScroll > lastScroll && currentScroll > 200) {
        //   navbar.style.transform = 'translateY(-100%)';
        // } else {
        //   navbar.style.transform = '';
        // }

        lastScroll = currentScroll;
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();
  EFFECTS_STATE.navbarScrollBound = true;
}

/* ── Cursor Spotlight (luxury feel) ────────────────────────── */
function initCursorSpotlight() {
  if (EFFECTS_STATE.cursorSpotlightBound || isLiteMode()) return;
  // Only on pointer devices
  if (window.matchMedia('(hover: none)').matches) return;

  const spotlight = document.createElement('div');
  spotlight.className = 'cursor-spotlight';
  spotlight.style.cssText = `
    position: fixed;
    width: 320px; height: 320px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(212,175,55,0.04) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
    transform: translate(-50%, -50%);
    transition: opacity 0.3s ease;
    opacity: 0;
  `;
  document.body.appendChild(spotlight);

  let animFrame;
  document.addEventListener('mousemove', (e) => {
    if (animFrame) cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(() => {
      spotlight.style.left = e.clientX + 'px';
      spotlight.style.top  = e.clientY + 'px';
      spotlight.style.opacity = '1';
    });
  });

  document.addEventListener('mouseleave', () => {
    spotlight.style.opacity = '0';
  });
  EFFECTS_STATE.cursorSpotlightBound = true;
}

/* ── Number Counter Animation ───────────────────────────────── */
function animateCounter(el, target, duration = 1500) {
  const start = parseInt(el.textContent) || 0;
  const range = target - start;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed  = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(start + range * eased);

    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = target;
    }
  }

  requestAnimationFrame(update);
}

/* ── Loading Screen Dismiss ─────────────────────────────────── */
function dismissLoadingScreen() {
  const screen = document.getElementById('loading-screen');
  if (!screen) return;

  setTimeout(() => {
    screen.classList.add('hidden');
    document.body.style.overflow = '';
  }, isLiteMode() ? 450 : 900);
}

/* ── Typed Text Effect ──────────────────────────────────────── */
function initTypedText() {
  const el = document.querySelector('[data-typed]');
  if (!el) return;

  const words = JSON.parse(el.dataset.typed || '[]');
  if (!words.length) return;

  let wordIndex = 0;
  let charIndex = 0;
  let deleting  = false;
  let paused    = false;

  function type() {
    if (paused) return;

    const word = words[wordIndex];

    if (!deleting && charIndex < word.length) {
      el.textContent = word.slice(0, charIndex + 1);
      charIndex++;
      setTimeout(type, 80);
    } else if (!deleting && charIndex === word.length) {
      paused = true;
      setTimeout(() => {
        paused = false;
        deleting = true;
        type();
      }, 1800);
    } else if (deleting && charIndex > 0) {
      el.textContent = word.slice(0, charIndex - 1);
      charIndex--;
      setTimeout(type, 40);
    } else {
      deleting = false;
      wordIndex = (wordIndex + 1) % words.length;
      setTimeout(type, 400);
    }
  }

  type();
}

/* ── 3D Mouse Tilt for Cards ─────────────────────────────────── */
function init3DTilt() {
  if (window.matchMedia('(hover: none)').matches || prefersReducedMotion() || isLiteMode()) return;

  function applyTilt(card, e) {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cx = rect.width  / 2;
    const cy = rect.height / 2;
    const rotX = ((y - cy) / cy) * -10;
    const rotY = ((x - cx) / cx) *  10;
    card.style.transform =
      `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateZ(12px) scale(1.03)`;
    card.style.boxShadow =
      `0 ${30 + Math.abs(rotX) * 3}px ${70 + Math.abs(rotY) * 4}px rgba(0,0,0,0.55),
       0 0 ${40 + Math.abs(rotY) * 3}px rgba(212,175,55,${0.1 + Math.abs(rotY) * 0.02})`;
  }

  function resetTilt(card) {
    card.style.transform = '';
    card.style.boxShadow = '';
  }

  function bindTilt(selector) {
    document.querySelectorAll(selector).forEach(card => {
      if (card.dataset.tiltBound === 'true') return;
      card.dataset.tiltBound = 'true';
      card.addEventListener('mousemove', e => applyTilt(card, e), { passive: true });
      card.addEventListener('mouseleave', () => resetTilt(card));
    });
  }

  // Bind after dynamic content may load
  if (!EFFECTS_STATE.tiltMutationObserver) {
    EFFECTS_STATE.tiltMutationObserver = new MutationObserver(() => {
      bindTilt('.product-card');
      bindTilt('.value-card.glass');
    });
    EFFECTS_STATE.tiltMutationObserver.observe(document.body, { childList: true, subtree: true });
  }

  bindTilt('.product-card');
  bindTilt('.value-card.glass');
}

/* ── Scroll-Driven Horizontal Drift ─────────────────────────── */
function initScrollDrift() {
  if (EFFECTS_STATE.scrollDriftBound || isLiteMode()) return;
  const driftEls = document.querySelectorAll('[data-drift]');
  if (!driftEls.length) return;

  let ticking = false;

  function updateDrift() {
    driftEls.forEach(el => {
      const rect      = el.getBoundingClientRect();
      const centerY   = rect.top + rect.height / 2;
      const vH        = window.innerHeight;
      // progress: -1 when below viewport, 0 at center, +1 above viewport
      const progress  = (vH / 2 - centerY) / vH;
      const dir       = el.dataset.drift === 'right' ? 1 : -1;
      const intensity = parseFloat(el.dataset.driftIntensity || '55');
      const drift     = progress * intensity * dir;
      el.style.transform = `translateX(${drift}px)`;
    });
    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateDrift);
      ticking = true;
    }
  }, { passive: true });

  updateDrift(); // initial
  EFFECTS_STATE.scrollDriftBound = true;
}

/* ── Floating 3D Classes for Featured Cards ──────────────────── */
function initFloatingFeatured() {
  if (isLiteMode()) return;
  // Re-bind whenever the featured grid is updated
  function assignFloats() {
    const cards = document.querySelectorAll('#featured-grid .product-card');
    const floatClasses = ['float-3d-1', 'float-3d-2', 'float-3d-3'];
    cards.forEach((card, i) => {
      // Remove existing float classes
      floatClasses.forEach(c => card.classList.remove(c));
      card.classList.add(floatClasses[i % 3]);
    });
  }

  // Watch for grid content changes (dynamic load)
  const grid = document.getElementById('featured-grid');
  if (grid) {
    if (!EFFECTS_STATE.floatingMutationObserver) {
      EFFECTS_STATE.floatingMutationObserver = new MutationObserver(assignFloats);
      EFFECTS_STATE.floatingMutationObserver.observe(grid, { childList: true });
    }
    assignFloats();
  }
}

/* ── Hero Depth Parallax (mouse-based) ───────────────────────── */
function initHeroDepth() {
  if (EFFECTS_STATE.heroDepthBound || isLiteMode()) return;

  const hero = document.getElementById('hero');
  if (!hero || window.matchMedia('(hover: none)').matches || prefersReducedMotion()) return;

  const orbG   = hero.querySelector('.vortex-orb--gold');
  const orbF   = hero.querySelector('.vortex-orb--frost');
  const orbP   = hero.querySelector('.vortex-orb--purple');

  let af;
  hero.addEventListener('mousemove', (e) => {
    if (af) cancelAnimationFrame(af);
    af = requestAnimationFrame(() => {
      const rect = hero.getBoundingClientRect();
      const mx = (e.clientX - rect.left) / rect.width  - 0.5; // -0.5 to 0.5
      const my = (e.clientY - rect.top)  / rect.height - 0.5;

      if (orbG) orbG.style.transform = `translate(${mx * 40}px, ${my * 30}px)`;
      if (orbF) orbF.style.transform = `translate(${mx * -30}px, ${my * 20}px)`;
      if (orbP) orbP.style.transform = `translate(${mx * 25}px, ${my * -25}px)`;
    });
  });

  hero.addEventListener('mouseleave', () => {
    if (orbG) orbG.style.transform = '';
    if (orbF) orbF.style.transform = '';
    if (orbP) orbP.style.transform = '';
  });
  EFFECTS_STATE.heroDepthBound = true;
}

/* ── Hero Bottle Scroll Parallax ────────────────────────────── */
function initHeroBottleParallax() {
  if (EFFECTS_STATE.heroBottleBound || prefersReducedMotion() || isLiteMode()) return;

  const hero = document.getElementById('hero');
  const bottleL = document.getElementById('hero-bottle-left');
  const bottleR = document.getElementById('hero-bottle-right');
  if (!hero || !bottleL || !bottleR) return;

  const TILT_L = -12;
  const TILT_R = 12;
  const MAX_SLIDE = 220;
  let ticking = false;

  function updateBottles() {
    const heroRect = hero.getBoundingClientRect();
    const progress = Math.min(Math.max((window.innerHeight - heroRect.top) / (heroRect.height + window.innerHeight * 0.35), 0), 1);
    const exitProgress = Math.min(Math.max(window.scrollY / Math.max(hero.offsetHeight, 1), 0), 1);
    const slide = exitProgress * MAX_SLIDE;
    const lift = progress * 36;

    bottleL.style.transform = `rotate(${TILT_L - exitProgress * 8}deg) translate3d(${-slide}px, ${-lift}px, ${60 + progress * 120}px)`;
    bottleL.style.opacity = String(Math.max(1 - exitProgress * 0.9, 0.12));

    bottleR.style.transform = `rotate(${TILT_R + exitProgress * 8}deg) translate3d(${slide}px, ${-lift}px, ${60 + progress * 120}px)`;
    bottleR.style.opacity = String(Math.max(1 - exitProgress * 0.9, 0.12));

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateBottles);
      ticking = true;
    }
  }, { passive: true });

  window.addEventListener('resize', updateBottles, { passive: true });
  EFFECTS_STATE.heroBottleBound = true;
  updateBottles();
}

/* ── Depth Parallax Layers ──────────────────────────────────── */
function initDepthParallax() {
  if (EFFECTS_STATE.depthBound || prefersReducedMotion() || isLiteMode()) return;

  const layeredEls = Array.from(document.querySelectorAll('[data-depth]'));
  if (!layeredEls.length) return;

  const hero = document.getElementById('hero');
  let pointerX = 0;
  let pointerY = 0;
  let ticking = false;

  function updateDepth() {
    layeredEls.forEach((el) => {
      const depth = parseFloat(el.dataset.depth || '0.1');
      const rect = el.getBoundingClientRect();
      const viewportCenter = window.innerHeight / 2;
      const elementCenter = rect.top + rect.height / 2;
      const scrollFactor = (viewportCenter - elementCenter) / window.innerHeight;
      const px = pointerX * depth * 36;
      const py = pointerY * depth * 28;
      const pz = (depth * 180) + (scrollFactor * depth * 90);
      const rx = pointerY * depth * -12;
      const ry = pointerX * depth * 14;

      el.style.setProperty('--parallax-x', `${px.toFixed(2)}px`);
      el.style.setProperty('--parallax-y', `${(py + scrollFactor * depth * 28).toFixed(2)}px`);
      el.style.setProperty('--parallax-z', `${pz.toFixed(2)}px`);
      el.style.setProperty('--parallax-rx', `${rx.toFixed(2)}deg`);
      el.style.setProperty('--parallax-ry', `${ry.toFixed(2)}deg`);
    });
    ticking = false;
  }

  function requestDepthUpdate() {
    if (!ticking) {
      requestAnimationFrame(updateDepth);
      ticking = true;
    }
  }

  if (hero && !window.matchMedia('(hover: none)').matches) {
    hero.addEventListener('mousemove', (e) => {
      const rect = hero.getBoundingClientRect();
      pointerX = ((e.clientX - rect.left) / rect.width) - 0.5;
      pointerY = ((e.clientY - rect.top) / rect.height) - 0.5;
      requestDepthUpdate();
    });

    hero.addEventListener('mouseleave', () => {
      pointerX = 0;
      pointerY = 0;
      requestDepthUpdate();
    });
  }

  window.addEventListener('scroll', requestDepthUpdate, { passive: true });
  window.addEventListener('resize', requestDepthUpdate, { passive: true });
  EFFECTS_STATE.depthBound = true;
  updateDepth();
}

/* ── Camera Path Animation ──────────────────────────────────── */
function initCameraPathAnimation() {
  if (EFFECTS_STATE.cameraBound || prefersReducedMotion() || isLiteMode()) return;

  const sections = Array.from(document.querySelectorAll('[data-camera-section]'));
  if (!sections.length) return;

  document.body.classList.add('camera-path-active');
  let ticking = false;

  function updateCamera() {
    let backgroundShift = 0;

    sections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      const intensity = parseFloat(section.dataset.cameraIntensity || '1');
      const progress = Math.min(Math.max((window.innerHeight - rect.top) / (window.innerHeight + rect.height), 0), 1);
      const centered = ((rect.top + rect.height / 2) - window.innerHeight / 2) / window.innerHeight;
      const distance = Math.abs(centered);
      const active = distance < 0.72;

      const shiftY = centered * -32 * intensity;
      const rotateX = centered * -7 * intensity;
      const rotateY = centered * 9 * intensity;
      const scale = 1 - Math.min(distance * 0.08, 0.08) + (active ? 0.018 : 0);
      const saturation = 1 + (active ? 0.14 : 0) - Math.min(distance * 0.12, 0.12);
      const brightness = 1 + (active ? 0.06 : 0) - Math.min(distance * 0.08, 0.08);

      section.style.setProperty('--camera-progress', progress.toFixed(3));
      section.style.setProperty('--camera-shift-y', `${shiftY.toFixed(2)}px`);
      section.style.setProperty('--camera-rotate-x', `${rotateX.toFixed(2)}deg`);
      section.style.setProperty('--camera-rotate-y', `${rotateY.toFixed(2)}deg`);
      section.style.setProperty('--camera-scale', scale.toFixed(3));
      section.style.setProperty('--camera-saturation', saturation.toFixed(3));
      section.style.setProperty('--camera-brightness', brightness.toFixed(3));
      section.style.setProperty('--camera-sheen', active ? '1' : '0');
      section.classList.toggle('camera-active', active);

      if (section.id === 'hero') {
        backgroundShift = shiftY * 1.35;
      }
    });

    document.body.style.setProperty('--camera-background-shift', `${backgroundShift.toFixed(2)}px`);
    ticking = false;
  }

  function requestCameraUpdate() {
    if (!ticking) {
      requestAnimationFrame(updateCamera);
      ticking = true;
    }
  }

  window.addEventListener('scroll', requestCameraUpdate, { passive: true });
  window.addEventListener('resize', requestCameraUpdate, { passive: true });
  EFFECTS_STATE.cameraBound = true;
  updateCamera();
}

/* ── Init All Effects ───────────────────────────────────────── */
function initAllEffects() {
  detectPerformanceMode();
  initScrollReveal();
  initStaggerReveal();
  initParticles();
  initRipple();
  initParallax();
  initHeroEntrance();
  initNavbarScroll();
  initCursorSpotlight();
  initTypedText();
  dismissLoadingScreen();
  // ── 3D Premium Effects ──
  initHeroBottleParallax();
  initDepthParallax();
  initCameraPathAnimation();
  init3DTilt();
  initScrollDrift();
  initFloatingFeatured();
  initHeroDepth();
}

// Auto-init on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAllEffects);
} else {
  initAllEffects();
}

// Re-init scroll reveals after dynamic content injection
window.reinitReveal = function() {
  initScrollReveal();
  initParticles();
  initFloatingFeatured();
  init3DTilt();
  initCameraPathAnimation();
};
