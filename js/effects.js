/* ============================================================
   BIFROST WINES — effects.js
   Scroll Animations, Particles, Ripple Effects
   ============================================================ */

/* ── Scroll Reveal (Intersection Observer) ──────────────────── */
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          // Don't unobserve if we want re-animation on scroll back
        }
      });
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  elements.forEach(el => observer.observe(el));
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
}

/* ── Parallax Micro Effect ──────────────────────────────────── */
function initParallax() {
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
}

/* ── Cursor Spotlight (luxury feel) ────────────────────────── */
function initCursorSpotlight() {
  // Only on pointer devices
  if (window.matchMedia('(hover: none)').matches) return;

  const spotlight = document.createElement('div');
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
  }, 1600);
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
  if (window.matchMedia('(hover: none)').matches) return; // skip on touch devices

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
      card.addEventListener('mousemove', e => applyTilt(card, e), { passive: true });
      card.addEventListener('mouseleave', () => resetTilt(card));
    });
  }

  // Bind after dynamic content may load
  const observe = new MutationObserver(() => {
    bindTilt('.product-card');
    bindTilt('.value-card.glass');
  });
  observe.observe(document.body, { childList: true, subtree: true });

  bindTilt('.product-card');
  bindTilt('.value-card.glass');
}

/* ── Scroll-Driven Horizontal Drift ─────────────────────────── */
function initScrollDrift() {
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
}

/* ── Floating 3D Classes for Featured Cards ──────────────────── */
function initFloatingFeatured() {
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
    const obs = new MutationObserver(assignFloats);
    obs.observe(grid, { childList: true });
    assignFloats();
  }
}

/* ── Hero Depth Parallax (mouse-based) ───────────────────────── */
function initHeroDepth() {
  const hero = document.getElementById('hero');
  if (!hero || window.matchMedia('(hover: none)').matches) return;

  const logo   = hero.querySelector('.hero__logo-img');
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

      if (logo) {
        logo.style.transform =
          `translateX(${mx * 18}px) translateY(${my * 10}px) rotateY(${mx * 8}deg)`;
      }
      if (orbG) orbG.style.transform = `translate(${mx * 40}px, ${my * 30}px)`;
      if (orbF) orbF.style.transform = `translate(${mx * -30}px, ${my * 20}px)`;
      if (orbP) orbP.style.transform = `translate(${mx * 25}px, ${my * -25}px)`;
    });
  });

  hero.addEventListener('mouseleave', () => {
    if (logo) logo.style.transform = '';
    if (orbG) orbG.style.transform = '';
    if (orbF) orbF.style.transform = '';
    if (orbP) orbP.style.transform = '';
  });
}

/* ── Init All Effects ───────────────────────────────────────── */
function initAllEffects() {
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
};
