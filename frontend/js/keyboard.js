import { icon } from './ui.js';

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
const MAX_LENGTH = 30;

export function keyboardWanted() {
  try {
    const forced = new URLSearchParams(location.search).get('kb');

    if (forced === 'on') return true;
    if (forced === 'off') return false;

    return !!(
      window.matchMedia &&
      window.matchMedia('(pointer: coarse)').matches
    );
  } catch {
    return false;
  }
}

function makeKey(content, className, onPress, ariaLabel) {
  const button = document.createElement('button');

  button.type = 'button';
  button.className = `kb-key ${className}`.trim();

  if (typeof content === 'string') {
    button.textContent = content;
  } else {
    button.appendChild(content);
  }

  if (ariaLabel) {
    button.setAttribute('aria-label', ariaLabel);
  }

  button.addEventListener('click', onPress);

  button.addEventListener('mousedown', (event) => {
    event.preventDefault();
  });

  const down = () => button.classList.add('down');
  const up = () => button.classList.remove('down');

  button.addEventListener('pointerdown', down);

  ['pointerup', 'pointercancel', 'pointerleave', 'blur']
    .forEach((event) => button.addEventListener(event, up));

  return button;
}

function mountOne(host) {
  const input = document.getElementById(
    host.dataset.keyboardInput
  );

  const action = document.getElementById(
    host.dataset.keyboardAction
  );

  if (!input || host.dataset.kbMounted) return;

  host.dataset.kbMounted = '1';

  const before = {
    readOnly: input.readOnly,
    inputmode: input.getAttribute('inputmode')
  };

  // Prevent the native mobile keyboard from appearing.
  input.readOnly = true;
  input.setAttribute('inputmode', 'none');

  if (!input.getAttribute('aria-label')) {
    input.setAttribute('aria-label', 'Your spelling');
  }

  const setValue = (value) => {
    input.value = value;
    input.scrollLeft = input.scrollWidth;

    input.dispatchEvent(
      new Event('input', { bubbles: true })
    );
  };

  const add = (character) => {
    if (
      !input.disabled &&
      input.value.length < MAX_LENGTH
    ) {
      setValue(input.value + character);
    }
  };

  const back = () => {
    if (!input.disabled) {
      setValue(input.value.slice(0, -1));
    }
  };

  const clear = () => {
    if (!input.disabled) {
      setValue('');
    }
  };

  const rows = document.createElement('div');
  rows.className = 'kb-rows';

  ROWS.forEach((letters, index) => {
    const row = document.createElement('div');
    row.className = 'kb-row';

    if (index === 1) {
      const gap = document.createElement('span');
      gap.className = 'kb-gap';
      row.appendChild(gap);
    }

    if (index === 2) {
      row.appendChild(
        makeKey(
          'Clear',
          'kb-wide kb-func',
          clear,
          'Clear the answer'
        )
      );
    }

    for (const character of letters) {
      row.appendChild(
        makeKey(
          character.toUpperCase(),
          '',
          () => add(character)
        )
      );
    }

    if (index === 1) {
      const gap = document.createElement('span');
      gap.className = 'kb-gap';
      row.appendChild(gap);
    }

    if (index === 2) {
      row.appendChild(
        makeKey(
          icon('arrow-left'),
          'kb-wide kb-func kb-back',
          back,
          'Backspace'
        )
      );
    }

    rows.appendChild(row);
  });

  const enter = makeKey(
    '',
    'kb-enter',
    () => {
      if (action && !action.disabled) {
        action.click();
      }
    }
  );

  host.textContent = '';

  host.setAttribute('role', 'group');
  host.setAttribute('aria-label', 'Spelling keyboard');

  host.append(rows, enter);
  host.hidden = false;

  const syncEnter = () => {
    enter.textContent = (
      (action && action.textContent) || 'Check'
    ).trim();

    enter.disabled = !action || action.disabled;
  };

  const syncLocked = () => {
    const locked = input.disabled;

    host.classList.toggle('kb-locked', locked);

    host.querySelectorAll('.kb-rows .kb-key')
      .forEach((key) => {
        key.disabled = locked;
      });
  };

  syncEnter();
  syncLocked();

  const watchers = [];

  if (action) {
    const observer = new MutationObserver(syncEnter);

    observer.observe(action, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['disabled']
    });

    watchers.push(observer);
  }

  const inputObserver = new MutationObserver(syncLocked);

  inputObserver.observe(input, {
    attributes: true,
    attributeFilter: ['disabled']
  });

  watchers.push(inputObserver);

  const onKeydown = (event) => {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    if (/^[a-z]$/i.test(event.key)) {
      event.preventDefault();
      add(event.key.toLowerCase());
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      back();
    }
  };

  input.addEventListener('keydown', onKeydown);

  host._kbCleanup = () => {
    watchers.forEach((observer) => observer.disconnect());

    input.removeEventListener('keydown', onKeydown);

    input.readOnly = before.readOnly;

    if (before.inputmode === null) {
      input.removeAttribute('inputmode');
    } else {
      input.setAttribute('inputmode', before.inputmode);
    }
  };
}

function unmountOne(host) {
  if (!host.dataset.kbMounted) return;

  if (host._kbCleanup) {
    host._kbCleanup();
  }

  delete host.dataset.kbMounted;

  host.textContent = '';
  host.hidden = true;
}

export function mountKeyboards() {
  const hosts = [
    ...document.querySelectorAll('[data-keyboard-input]')
  ];

  if (!hosts.length) return;

  let resizeObserver = null;
  let frame = 0;

  const updateDockMetrics = () => {
    cancelAnimationFrame(frame);

    frame = requestAnimationFrame(() => {
      const activeHost = hosts.find((host) =>
        !host.hidden &&
        host.isConnected &&
        host.getBoundingClientRect().height > 0
      );

      if (activeHost) {
        const height = Math.ceil(
          activeHost.getBoundingClientRect().height
        );

        document.documentElement.style.setProperty(
          '--kb-height',
          `${height}px`
        );
      }

      const viewportHeight =
        window.visualViewport?.height ||
        window.innerHeight;

      document.body.classList.toggle(
        'kb-compact',
        viewportHeight < 560
      );
    });
  };

  const apply = () => {
    const enabled = keyboardWanted();

    hosts.forEach((host) => {
      if (enabled) {
        mountOne(host);
      } else {
        unmountOne(host);
      }
    });

    document.body.classList.toggle(
      'kb-active',
      enabled
    );

    if (enabled) {
      if (
        !resizeObserver &&
        'ResizeObserver' in window
      ) {
        resizeObserver = new ResizeObserver(
          updateDockMetrics
        );

        hosts.forEach((host) => {
          resizeObserver.observe(host);
        });
      }

      updateDockMetrics();

    } else {
      resizeObserver?.disconnect();
      resizeObserver = null;

      document.documentElement.style.removeProperty(
        '--kb-height'
      );

      document.body.classList.remove('kb-compact');
    }
  };

  apply();

  const mediaQuery = window.matchMedia &&
    window.matchMedia('(pointer: coarse)');

  if (mediaQuery) {
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', apply);
    } else if (mediaQuery.addListener) {
      mediaQuery.addListener(apply);
    }
  }

  window.addEventListener(
    'resize',
    updateDockMetrics,
    { passive: true }
  );

  window.visualViewport?.addEventListener(
    'resize',
    updateDockMetrics,
    { passive: true }
  );

  window.visualViewport?.addEventListener(
    'scroll',
    updateDockMetrics,
    { passive: true }
  );
}