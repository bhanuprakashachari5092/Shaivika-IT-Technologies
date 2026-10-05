/**
 * SHAIVIKA IT TECHNOLOGIES - Modern Core JavaScript
 * Lottie Integrations • Preloader • Route Transitions • Micro-Interactions
 */

(function () {
  'use strict';

  // ===== 1. PRELOADER & INITIAL LOAD CHOREOGRAPHY =====
  function initPreloader() {
    const loader = document.getElementById('global-preloader');
    if (!loader) return;

    let isDismissed = false;
    function dismiss() {
      if (isDismissed) return;
      isDismissed = true;
      loader.classList.add('preloader-hidden');
      loader.setAttribute('aria-hidden', 'true');
      setTimeout(() => {
        loader.style.display = 'none';
      }, 550);
    }

    // Dismiss when DOM & assets load
    if (document.readyState === 'complete') {
      setTimeout(dismiss, 500);
    } else {
      window.addEventListener('load', () => {
        setTimeout(dismiss, 500);
      });
      // Safety safeguard: never block screen longer than 1.4s on slow connections
      setTimeout(dismiss, 1400);
    }
  }

  // ===== 2. ROUTE & PAGE TRANSITIONS =====
  function initRouteTransitions() {
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    document.querySelectorAll('a[href]').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (
          !href ||
          href.startsWith('#') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          href.startsWith('http') ||
          href.startsWith('//') ||
          link.getAttribute('target') === '_blank' ||
          e.ctrlKey || e.metaKey || e.shiftKey
        ) {
          return;
        }

        // Trigger swift, smooth exit transition
        e.preventDefault();
        document.body.classList.add('page-transitioning');
        setTimeout(() => {
          window.location.href = href;
        }, 180);
      });
    });

    // Reset transition state on back/forward browser cache navigation
    window.addEventListener('pageshow', () => {
      document.body.classList.remove('page-transitioning');
    });
  }

  // ===== 3. THEME MANAGEMENT =====
  const root = document.documentElement;
  const currentTheme = localStorage.getItem('theme') || 'dark';

  function setTheme(theme) {
    root.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      if (theme === 'light') {
        btn.innerHTML = '🌙';
        btn.setAttribute('aria-label', 'Switch to dark theme');
        btn.setAttribute('title', 'Switch to dark theme');
      } else {
        btn.innerHTML = '☀️';
        btn.setAttribute('aria-label', 'Switch to light theme');
        btn.setAttribute('title', 'Switch to light theme');
      }
    });
    localStorage.setItem('theme', theme);
    try {
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    } catch (_) {}
  }

  setTheme(currentTheme);

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-toggle-btn');
    if (btn) {
      e.preventDefault();
      const isLight = root.getAttribute('data-theme') === 'light';
      setTheme(isLight ? 'dark' : 'light');
    }
  });

  // ===== 4. NAVBAR & SCROLL BEHAVIOR =====
  const navbar = document.getElementById('navbar') || document.querySelector('.navbar');
  const hamburger = document.getElementById('hamburger') || document.querySelector('.hamburger');
  const mobileNav = document.getElementById('mobileNav') || document.querySelector('.mobile-nav');

  function handleScroll() {
    if (window.scrollY > 20) {
      navbar?.classList.add('scrolled');
    } else {
      navbar?.classList.remove('scrolled');
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  if (hamburger && mobileNav) {
    hamburger.addEventListener('click', () => {
      const isOpen = hamburger.classList.toggle('open');
      mobileNav.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    mobileNav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('open');
        mobileNav.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  // ===== 5. ACTIVE NAV LINK HIGHLIGHT =====
  function setActiveNav() {
    const currentPath = window.location.pathname.toLowerCase();
    const pageName = currentPath.split('/').filter(Boolean).pop() || 'index.html';

    document.querySelectorAll('.nav-link, .mobile-nav a').forEach(link => {
      const href = (link.getAttribute('href') || '').toLowerCase();
      const targetPage = href.split('/').filter(Boolean).pop() || 'index.html';

      if (
        pageName === targetPage ||
        (pageName === 'index.html' && (targetPage === '' || targetPage === 'index.html' || href === '/')) ||
        (pageName.startsWith('work') && targetPage.startsWith('work')) ||
        (pageName.startsWith('solutions') && targetPage.startsWith('solutions')) ||
        (pageName.startsWith('services') && targetPage.startsWith('solutions'))
      ) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
  setActiveNav();

  // ===== 6. SCROLL REVEAL OBSERVER =====
  function initScrollReveal() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal, .reveal-left, .reveal-right').forEach(el => observer.observe(el));
  }

  // ===== 7. MICRO-INTERACTION: 3D LOGO TILT =====
  function initLogoTilt() {
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (window.innerWidth < 1024 || prefersReducedMotion) return;

    const logos = document.querySelectorAll('[data-logo-tilt], .nav-brand');
    logos.forEach(logo => {
      logo.addEventListener('mousemove', (e) => {
        const rect = logo.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        logo.style.transform = `perspective(600px) rotateX(${-y * 0.08}deg) rotateY(${x * 0.08}deg)`;
      });

      logo.addEventListener('mouseleave', () => {
        logo.style.transform = '';
      });
    });
  }

  // ===== 8. NUMERIC COUNTER ANIMATIONS =====
  function initCounters() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.target, 10);
          if (!isNaN(target)) {
            let start = 0;
            const duration = 1600;
            const step = (timestamp) => {
              if (!start) start = timestamp;
              const progress = Math.min((timestamp - start) / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              el.textContent = Math.floor(eased * target) + (el.dataset.suffix || '');
              if (progress < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
            observer.unobserve(el);
          }
        }
      });
    }, { threshold: 0.4 });

    document.querySelectorAll('[data-target]').forEach(el => observer.observe(el));
  }

  // ===== 9. INTERACTIVE DASHBOARD TELEMETRY (HERO) =====
  function initHeroDashboard() {
    const pipelineNodes = document.querySelectorAll('.pipeline-node');
    if (!pipelineNodes.length) return;

    let activeIdx = 0;
    setInterval(() => {
      pipelineNodes.forEach((node, i) => {
        node.classList.toggle('active', i === activeIdx);
      });
      activeIdx = (activeIdx + 1) % pipelineNodes.length;
    }, 2800);
  }

  // ===== 10. CONTACT FORM SUBMISSION TO GOOGLE APPS SCRIPT =====
  function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    const GAS_URL = "https://script.google.com/macros/s/AKfycbz2ryEdo__YgiFBkps9pj4kLw5vFW3Uhvv0lSGJ1SNP3uW3n6YXv5sJe077GPvWM4gVAA/exec";
    const submitBtn = form.querySelector('button[type="submit"]') || document.getElementById('submitBtn');

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      const fullName = (form.fullName?.value || form.name?.value || '').trim();
      const email = (form.email?.value || '').trim();
      const company = (form.company?.value || '').trim();
      const country = (form.country?.value || '').trim();
      const projectType = (form.projectType?.value || form.service?.value || '').trim();
      const budget = (form.budget?.value || '').trim();
      const message = (form.message?.value || '').trim();

      if (!fullName || !email || !message) {
        showStatus('error', 'Please fill in all required fields (Name, Work Email, and Description).');
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showStatus('error', 'Please provide a valid business email address.');
        return;
      }

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>Sending Request...</span>';
      }

      const payload = {
        fullName: fullName,
        email: email,
        company: company || 'Not Specified',
        country: country || 'Not Specified',
        service: projectType ? `${projectType} (${budget || 'Budget TBD'})` : 'General Inquiry',
        projectType: projectType,
        budget: budget,
        message: message,
        timestamp: new Date().toISOString()
      };

      fetch(GAS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      })
      .then(response => response.text())
      .then(() => {
        showStatus('success', 'Thank you! Your project request has been received. A senior engineer will review and respond within 24 hours.');
        form.reset();
      })
      .catch(error => {
        console.error('Submission error:', error);
        showStatus('error', 'Transmission note: Please message us directly via WhatsApp (+91 7981431094) or email (shaivikagroups@gmail.com).');
      })
      .finally(() => {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = submitBtn.dataset.originalText || 'Discuss My Project';
        }
      });
    });

    function showStatus(type, msg) {
      let statusBox = document.getElementById('formStatus');
      if (!statusBox) {
        statusBox = document.createElement('div');
        statusBox.id = 'formStatus';
        form.appendChild(statusBox);
      }

      statusBox.style.cssText = [
        'margin-top: 18px',
        'padding: 14px 18px',
        'border-radius: 12px',
        'font-size: 14px',
        'font-weight: 500',
        'line-height: 1.5',
        type === 'success'
          ? 'background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399;'
          : 'background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171;'
      ].join(';');

      statusBox.textContent = msg;

      if (type === 'success') {
        setTimeout(() => {
          statusBox?.remove();
        }, 9000);
      }
    }
  }

  // ===== 9. TIMELINE PROGRESS & STEP OBSERVER =====
  function initTimelineObserver() {
    const steps = document.querySelectorAll('.timeline-step-card, .timeline-mobile-item');
    if (!steps.length) return;

    const timelineObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('step-active');
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -20px 0px' });

    steps.forEach(step => timelineObserver.observe(step));
  }

  // ===== INITIALIZE ALL =====
  initPreloader();
  document.addEventListener('DOMContentLoaded', () => {
    initRouteTransitions();
    initScrollReveal();
    initLogoTilt();
    initCounters();
    initHeroDashboard();
    initContactForm();
    initTimelineObserver();
  });
})();
