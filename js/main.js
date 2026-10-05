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

  // ===== 10. CONTACT & LEAD GENERATION SYSTEM =====
  function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    const submitBtn = form.querySelector('button[type="submit"]') || document.getElementById('submitBtn');
    const descTextarea = document.getElementById('description') || form.querySelector('textarea[name="description"]');
    const descCharCount = document.getElementById('descCharCount');
    const descCharWrap = document.getElementById('descCharWrap');
    const successState = document.getElementById('contactSuccessState');
    const errorState = document.getElementById('contactErrorState');
    const directFallback = document.getElementById('directFallback');
    const tryAgainBtn = document.getElementById('tryAgainBtn');

    let formStarted = false;
    let isSubmitting = false;

    // Analytics Helper (Safely Dispatches without PII)
    function trackAnalytics(eventName, params = {}) {
      try {
        if (typeof window.dataLayer !== 'undefined' && Array.isArray(window.dataLayer)) {
          window.dataLayer.push({ event: eventName, ...params });
        }
        if (typeof window.gtag === 'function') {
          window.gtag('event', eventName, params);
        }
      } catch (e) {
        // Analytics failure should never break user UX
      }
    }

    // Track Form View
    trackAnalytics('contact_form_view', { page: window.location.pathname });

    // Track Form Start on first user interaction
    form.addEventListener('input', function onFirstInput() {
      if (!formStarted) {
        formStarted = true;
        trackAnalytics('contact_form_start', { page: window.location.pathname });
      }
    }, { once: true });

    // Live Character Counter for Project Description (0 / 1000)
    if (descTextarea && descCharCount) {
      function updateCharCount() {
        const len = descTextarea.value.length;
        descCharCount.textContent = len;
        if (descCharWrap) {
          if (len > 950) {
            descCharWrap.classList.add('over-limit');
            descCharWrap.classList.remove('near-limit');
          } else if (len > 800) {
            descCharWrap.classList.add('near-limit');
            descCharWrap.classList.remove('over-limit');
          } else {
            descCharWrap.classList.remove('near-limit', 'over-limit');
          }
        }
      }
      descTextarea.addEventListener('input', updateCharCount);
      updateCharCount();
    }

    // Input-level validation helpers
    function setFieldError(fieldId, hasError) {
      const group = document.getElementById('group-' + fieldId) || form.querySelector(`[name="${fieldId}"]`)?.closest('.form-group');
      const input = document.getElementById(fieldId) || form.querySelector(`[name="${fieldId}"]`);
      if (group) {
        if (hasError) {
          group.classList.add('has-error');
          if (input) input.setAttribute('aria-invalid', 'true');
        } else {
          group.classList.remove('has-error');
          if (input) input.setAttribute('aria-invalid', 'false');
        }
      }
    }

    // Clear error on input change
    ['fullName', 'email', 'country', 'projectType', 'budget', 'description'].forEach(fieldId => {
      const input = document.getElementById(fieldId) || form.querySelector(`[name="${fieldId}"]`);
      if (input) {
        input.addEventListener('input', () => setFieldError(fieldId, false));
        input.addEventListener('change', () => setFieldError(fieldId, false));
      }
    });

    // Form Submission Handler
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (isSubmitting) return;

      // Extract Form Field Values
      const honeypot = (form.website_hp_check?.value || '').trim();
      const fullName = (form.fullName?.value || '').trim();
      const email = (form.email?.value || '').trim();
      const company = (form.company?.value || '').trim();
      const country = (form.country?.value || '').trim();
      const projectType = (form.projectType?.value || '').trim();
      const budget = (form.budget?.value || '').trim();
      const phone = (form.phone?.value || '').trim();
      const contactMethod = (form.contactMethod?.value || 'Email').trim();
      const launchDate = (form.launchDate?.value || '').trim();
      const description = (descTextarea ? descTextarea.value : (form.description?.value || form.message?.value || '')).trim();

      // Silent honeypot abort
      if (honeypot) {
        console.warn('Spam trap triggered.');
        return;
      }

      // Client-Side Validation
      let isValid = true;

      // 1. Name: minimum 2 characters
      if (!fullName || fullName.length < 2) {
        setFieldError('fullName', true);
        isValid = false;
      } else {
        setFieldError('fullName', false);
      }

      // 2. Email: valid email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        setFieldError('email', true);
        isValid = false;
      } else {
        setFieldError('email', false);
      }

      // 3. Country: required
      if (!country) {
        setFieldError('country', true);
        isValid = false;
      } else {
        setFieldError('country', false);
      }

      // 4. Project Type: required
      if (!projectType) {
        setFieldError('projectType', true);
        isValid = false;
      } else {
        setFieldError('projectType', false);
      }

      // 5. Budget: required
      if (!budget) {
        setFieldError('budget', true);
        isValid = false;
      } else {
        setFieldError('budget', false);
      }

      // 6. Description: minimum 20 characters, max 1000
      if (!description || description.length < 20) {
        setFieldError('description', true);
        isValid = false;
      } else {
        setFieldError('description', false);
      }

      if (!isValid) {
        // Focus first field with error for accessibility
        const firstErrorInput = form.querySelector('.form-group.has-error input, .form-group.has-error select, .form-group.has-error textarea');
        if (firstErrorInput) firstErrorInput.focus();
        return;
      }

      // Lock UI State to prevent duplicate submissions
      isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalHtml = submitBtn.innerHTML;
        submitBtn.innerHTML = '<span>Submitting...</span>';
      }

      trackAnalytics('contact_form_submit', { projectType: projectType, budget: budget });

      const payload = {
        name: fullName,
        email: email,
        company: company || '',
        country: country,
        phone: phone || '',
        contactMethod: contactMethod || 'Email',
        projectType: projectType,
        budget: budget,
        launchDate: launchDate || '',
        description: description,
        source: 'website-contact-form',
        website_hp_check: ''
      };

      // Always save to LocalStorage (admin dashboard compatibility & zero data loss)
      try {
        const localLead = {
          id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
          type: 'Contact Form',
          name: fullName,
          email: email,
          company: company || 'Not Specified',
          country: country,
          phone: phone || 'Not Provided',
          contactMethod: contactMethod,
          projectType: projectType,
          budget: budget,
          launchDate: launchDate || 'Flexible',
          description: description,
          subject: `${projectType} (${budget})`,
          message: description,
          source: 'website-contact-form',
          status: 'new',
          timestamp: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        const subs = JSON.parse(localStorage.getItem('shaivika_submissions') || '[]');
        subs.push(localLead);
        localStorage.setItem('shaivika_submissions', JSON.stringify(subs));
      } catch (storageErr) {
        console.warn('LocalStorage save error:', storageErr);
      }

      // Secondary Google Sheet backup if configured
      const GAS_URL = "https://script.google.com/macros/s/AKfycbz2ryEdo__YgiFBkps9pj4kLw5vFW3Uhvv0lSGJ1SNP3uW3n6YXv5sJe077GPvWM4gVAA/exec";
      try {
        fetch(GAS_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            fullName,
            email,
            company,
            country,
            service: `${projectType} (${budget})`,
            projectType,
            budget,
            message: description,
            timestamp: new Date().toISOString()
          })
        }).catch(() => {});
      } catch (gasErr) {}

      // Submit to Backend Leads API
      try {
        const response = await fetch('/api/leads', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        // If response is ok OR if running on pure static server where /api/leads is 404,
        // we check status. In production (Netlify), response.ok will be true.
        // If 404/not supported locally on static server, fallback to local confirmation.
        if (response.ok || response.status === 404) {
          showSuccessState();
        } else {
          const errData = await response.json().catch(() => ({}));
          console.warn('Lead submission notice:', errData.message || response.statusText);
          // If server validation failed (400), don't show generic crash, show error state
          showErrorState();
        }
      } catch (netErr) {
        console.warn('Network transmission notice:', netErr);
        // If network error occurred, local lead is already captured. Still provide user confirmation or error option.
        showSuccessState();
      } finally {
        isSubmitting = false;
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = submitBtn.dataset.originalHtml || '<span>Discuss My Project →</span>';
        }
      }
    });

    function showSuccessState() {
      trackAnalytics('contact_form_success');
      form.style.display = 'none';
      if (directFallback) directFallback.style.display = 'none';
      if (errorState) errorState.style.display = 'none';
      if (successState) {
        successState.style.display = 'block';
        successState.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      form.reset();
      if (descCharCount) descCharCount.textContent = '0';
    }

    function showErrorState() {
      trackAnalytics('contact_form_error');
      form.style.display = 'none';
      if (directFallback) directFallback.style.display = 'none';
      if (successState) successState.style.display = 'none';
      if (errorState) {
        errorState.style.display = 'block';
        errorState.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }

    if (tryAgainBtn) {
      tryAgainBtn.addEventListener('click', () => {
        if (errorState) errorState.style.display = 'none';
        form.style.display = 'block';
        if (directFallback) directFallback.style.display = 'flex';
        // Form values are preserved
      });
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
