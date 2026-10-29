import { icon } from './ui.js';

const LINKS = [
  ['index', 'Home', 'home'],
  ['practice', 'Practice', 'zap'],
  ['bee', 'Bee', 'trophy'],
  ['learn', 'Learn', 'book-open'],
  ['progress', 'Progress', 'bar-chart'],
  ['premium', 'Premium', 'crown'],
  ['settings', 'Settings', 'sliders'],
];

export function renderNavigation() {
  const host = document.getElementById('site-header');
  if (!host) return;

  const current = (location.pathname.split('/').pop() || 'index').replace('.html', '') || 'index';

  const bar = document.createElement('div');
  bar.className = 'nav';

  // logo and name
  const brand = document.createElement('a');
  brand.className = 'brand';
  brand.href = 'index.html';
  const logo = new Image(44, 48);
  logo.src = 'assets/bee.svg';
  logo.alt = '';
  const text = document.createElement('span');
  text.className = 'brand-text';
  const name = document.createElement('span');
  name.className = 'brand-name';
  name.append('Spell ');
  const gold = document.createElement('b');
  gold.textContent = 'Buddy';
  name.appendChild(gold);
  const tagline = document.createElement('small');
  tagline.textContent = 'Better Spelling · Bigger Dreams';
  text.append(name, tagline);
  brand.append(logo, text);

  // menu button (phones and tablets)
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-controls', 'nav-menu');
  const burger = document.createElement('span');
  burger.className = 'burger';
  burger.setAttribute('aria-hidden', 'true');
  burger.innerHTML = '<i></i><i></i><i></i>';
  const label = document.createElement('span');
  label.textContent = 'Menu';
  toggle.append(burger, label);

  // the links (a dropdown on small screens, inline on wide screens)
  const menu = document.createElement('nav');
  menu.id = 'nav-menu';
  menu.className = 'nav-menu';
  menu.setAttribute('aria-label', 'Main');
  LINKS.forEach(([page, title, iconName]) => {
    const a = document.createElement('a');
    a.href = `${page}.html`;
    const ico = document.createElement('span');
    ico.className = 'ico';
    ico.appendChild(icon(iconName));
    const t = document.createElement('span');
    t.textContent = title;
    a.append(ico, t);
    if (page === current) a.setAttribute('aria-current', 'page');
    menu.appendChild(a);
  });

  bar.append(brand, toggle, menu);
  host.appendChild(bar);

  const backdrop = document.createElement('div');
  backdrop.className = 'nav-backdrop';
  document.body.appendChild(backdrop);

  function setOpen(open) {
    menu.classList.toggle('open', open);
    backdrop.classList.toggle('show', open);
    toggle.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Close' : 'Menu';
  }

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  backdrop.addEventListener('click', () => setOpen(false));
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 980px)').addEventListener('change', () => setOpen(false));
}