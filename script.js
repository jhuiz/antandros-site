const header = document.querySelector('[data-header]');
const navToggle = document.querySelector('[data-nav-toggle]');
const navMenu = document.querySelector('[data-nav-menu]');
const yearElements = document.querySelectorAll('[data-year]');
const contactForm = document.querySelector('[data-contact-form]');

const updateHeader = () => {
  if (!header) return;
  header.classList.toggle('is-scrolled', window.scrollY > 12);
};

updateHeader();
window.addEventListener('scroll', updateHeader, { passive: true });

yearElements.forEach((element) => {
  element.textContent = new Date().getFullYear();
});

if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('is-open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

const revealElements = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -80px 0px' });

  revealElements.forEach((element) => observer.observe(element));
} else {
  revealElements.forEach((element) => element.classList.add('is-visible'));
}

if (contactForm) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData(contactForm);
    const name = formData.get('name') || '';
    const organization = formData.get('organization') || '';
    const email = formData.get('email') || '';
    const topic = formData.get('topic') || 'Antandros inquiry';
    const message = formData.get('message') || '';

    const subject = encodeURIComponent(`Antandros inquiry: ${topic}`);
    const body = encodeURIComponent([
      `Name: ${name}`,
      `Organization: ${organization}`,
      `Email: ${email}`,
      `Topic: ${topic}`,
      '',
      message,
    ].join('\n'));

    window.location.href = `mailto:hello@antandros.space?subject=${subject}&body=${body}`;
  });
}
