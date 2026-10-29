const NS = 'http://www.w3.org/2000/svg';

// Builds an <svg> that points at one icon in assets/icons.svg.
export function icon(name, extra = '') {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', `icon ${extra}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(NS, 'use');
  use.setAttribute('href', `assets/icons.svg#${name}`);
  svg.appendChild(use);
  return svg;
}

// Sets a button to "[icon] text".
export function setButton(el, iconName, text) {
  el.textContent = '';
  if (iconName) el.appendChild(icon(iconName));
  const span = document.createElement('span');
  span.textContent = text;
  el.appendChild(span);
}

const STATUS_ICONS = { good: 'check-circle', bad: 'lightbulb', warn: 'info' };

// Fills a .feedback element with an icon badge and a message.
export function setStatus(el, message, type = '', iconName = '') {
  el.textContent = '';
  el.className = type ? `feedback ${type}` : 'feedback';
  if (!message) return;
  const badge = document.createElement('span');
  badge.className = 'fb-ico';
  badge.appendChild(icon(iconName || STATUS_ICONS[type] || 'info'));
  const text = document.createElement('span');
  text.textContent = message;
  el.append(badge, text);
}

// Keeps the session progress bar in step with the "Word 3 of 10" label.
export function watchProgressBar() {
  const label = document.getElementById('progress');
  const fill = document.getElementById('barFill');
  const track = document.getElementById('progressTrack');
  if (!label || !fill) return;

  const update = () => {
    const m = /(\d+)\s+of\s+(\d+)/.exec(label.textContent || '');
    if (!m) return;
    const pct = Math.min(100, Math.round((Number(m[1]) / Number(m[2])) * 100));
    fill.style.width = `${pct}%`;
    if (track) track.setAttribute('aria-valuenow', String(pct));
  };

  new MutationObserver(update).observe(label, { childList: true, characterData: true, subtree: true });
  update();
}