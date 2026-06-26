const html = document.documentElement;
const iconEl = document.getElementById('toggleIcon');
const canvas = document.getElementById('stars');
const ctx = canvas.getContext('2d');
const ICONS = { light: '☾︎', dark: '☀︎' };

function getSystemPref() {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

let theme = localStorage.getItem('cosmobot-theme') || getSystemPref();

function applyTheme() {
  html.setAttribute('data-theme', theme);
  iconEl.textContent = ICONS[theme];
}

applyTheme();

document.getElementById('themeToggle').addEventListener('click', () => {
  theme = theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('cosmobot-theme', theme);
  applyTheme();
});

document.querySelectorAll('.js-email').forEach((link) => {
  const email = `${link.dataset.user}@${link.dataset.domain}`;
  link.href = `mailto:${email}`;
});

const scrollUp = document.getElementById('scrollUp');
const scrollDown = document.getElementById('scrollDown');

function updateScrollNav() {
  const doc = document.documentElement;
  const canScroll = doc.scrollHeight > window.innerHeight + 8;
  const nearTop = window.scrollY < 24;
  const nearBottom = window.scrollY + window.innerHeight >= doc.scrollHeight - 24;
  scrollUp.classList.toggle('is-visible', canScroll && !nearTop);
  scrollDown.classList.toggle('is-visible', canScroll && !nearBottom);
}

scrollUp.addEventListener('click', () => {
  window.scrollBy({ top: -window.innerHeight * 0.85, behavior: 'smooth' });
});

scrollDown.addEventListener('click', () => {
  window.scrollBy({ top: window.innerHeight * 0.85, behavior: 'smooth' });
});

window.addEventListener('scroll', updateScrollNav, { passive: true });
window.addEventListener('resize', updateScrollNav);
updateScrollNav();

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function resolveAssetUrl(url, baseUrl) {
  const cleanUrl = url.trim().replace(/^<|>$/g, '').split(/\s+/)[0];
  if (/^(https?:|data:|blob:)/i.test(cleanUrl)) return cleanUrl;

  const rawMatch = baseUrl.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.*)$/);
  if (rawMatch && cleanUrl.startsWith('/')) {
    return `https://raw.githubusercontent.com/${rawMatch[1]}/${rawMatch[2]}/${rawMatch[3]}${cleanUrl}`;
  }

  try {
    return new URL(cleanUrl, baseUrl).href;
  } catch (_) {
    return cleanUrl;
  }
}

function mediaHtml(alt, url, baseUrl) {
  const src = resolveAssetUrl(url, baseUrl);
  const safeAlt = escapeHtml(alt);
  const safeSrc = escapeHtml(src);
  const lower = src.split('?')[0].toLowerCase();

  if (/\.(mp4|webm|ogg|mov)$/.test(lower)) {
    return `<video class="readme-media" controls preload="metadata"><source src="${safeSrc}">Votre navigateur ne prend pas en charge la vidéo intégrée.</video>`;
  }

  return `<img class="readme-media" src="${safeSrc}" alt="${safeAlt}" loading="lazy">`;
}

function inlineMarkdown(value, baseUrl) {
  return escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => mediaHtml(alt, url, baseUrl))
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, text, url) => `<a href="${escapeHtml(resolveAssetUrl(url, baseUrl))}">${text}</a>`);
}

function renderMarkdown(markdown, baseUrl) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let inCode = false;
  let code = [];
  let inList = false;

  function closeList() {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
  }

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        closeList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!line.trim()) {
      closeList();
      continue;
    }

    if (/^---+$/.test(line.trim())) {
      closeList();
      out.push('<hr>');
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineMarkdown(heading[2], baseUrl)}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (bullet) {
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${inlineMarkdown(bullet[1], baseUrl)}</li>`);
      continue;
    }

    const directMedia = line.trim().match(/^(\S+\.(?:png|jpe?g|gif|webp|svg|mp4|webm|ogg|mov)(?:\?\S*)?)$/i);
    if (directMedia) {
      closeList();
      out.push(mediaHtml('', directMedia[1], baseUrl));
      continue;
    }

    closeList();
    out.push(`<p>${inlineMarkdown(line, baseUrl)}</p>`);
  }

  closeList();
  if (inCode) out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  return out.join('\n');
}

async function loadReadme() {
  const main = document.querySelector('main');
  const target = document.getElementById('readme');
  const primary = main.dataset.readmeUrl;
  const fallback = main.dataset.fallbackReadme;

  async function fetchText(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return response.text();
  }

  try {
    const markdown = await fetchText(primary);
    target.innerHTML = renderMarkdown(markdown, primary);
    updateScrollNav();
  } catch (primaryError) {
    if (fallback) {
      try {
        const markdown = await fetchText(fallback);
        target.innerHTML = renderMarkdown(markdown, fallback);
        updateScrollNav();
        return;
      } catch (_) {}
    }
    target.innerHTML = `<p>README indisponible.</p><p><a href="${primary}">${primary}</a></p>`;
    updateScrollNav();
  }
}

loadReadme();

let w, h, stars = [], shootingStar = null, shootingTimer = 0, lastTime = 0;

function resize() {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
  initStars();
}

function initStars() {
  stars = [];
  const count = Math.floor((w * h) / 2500);
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 0.7 + 0.2,
      baseAlpha: Math.random() * 0.05 + 0.02,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 1.2 + 0.3,
      amplitude: Math.random() * 0.95 + 0.4
    });
  }
}

function starColor() {
  return html.getAttribute('data-theme') === 'light' ? '0, 0, 0' : '255, 255, 255';
}

function launchShootingStar() {
  shootingStar = {
    x: Math.random() * w * 0.7,
    y: Math.random() * h * 0.3,
    angle: Math.PI / 7 + Math.random() * Math.PI / 8,
    speed: 7 + Math.random() * 3,
    life: 1,
    length: 140 + Math.random() * 80,
    maxAlpha: 0.3 + Math.random() * 0.2
  };
}

function draw(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;
  ctx.clearRect(0, 0, w, h);
  const c = starColor();
  const isLight = html.getAttribute('data-theme') === 'light';

  for (const s of stars) {
    s.phase += s.speed * dt;
    const twinkle = (Math.sin(s.phase) + 1) / 2;
    const alpha = s.baseAlpha + s.amplitude * twinkle;
    const a = isLight ? Math.min(alpha * 1.2, 0.40) : alpha;
    const r = isLight ? s.r * 1.2 : s.r;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${c}, ${a})`;
    ctx.fill();
  }

  shootingTimer += dt;
  const shootInterval = shootingStar === null && lastTime < 3000 ? 1 : 6 + Math.random() * 6;
  if (shootingTimer > shootInterval && !shootingStar) {
    launchShootingStar();
    shootingTimer = 0;
  }

  if (shootingStar) {
    const ss = shootingStar;
    ss.x += Math.cos(ss.angle) * ss.speed;
    ss.y += Math.sin(ss.angle) * ss.speed;
    ss.life -= dt * 0.4;
    if (ss.life > 0 && ss.x < w + 100 && ss.y < h + 100) {
      const tailX = ss.x - Math.cos(ss.angle) * ss.length * ss.life;
      const tailY = ss.y - Math.sin(ss.angle) * ss.length * ss.life;
      const a = ss.life * (isLight ? ss.maxAlpha * 0.5 : ss.maxAlpha);
      const grad = ctx.createLinearGradient(tailX, tailY, ss.x, ss.y);
      grad.addColorStop(0, `rgba(${c}, 0)`);
      grad.addColorStop(0.8, `rgba(${c}, ${a * 0.3})`);
      grad.addColorStop(1, `rgba(${c}, ${a})`);
      ctx.beginPath();
      ctx.moveTo(tailX, tailY);
      ctx.lineTo(ss.x, ss.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ss.x, ss.y, 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${c}, ${a * 1.2})`;
      ctx.fill();
    } else {
      shootingStar = null;
    }
  }

  requestAnimationFrame(draw);
}

window.addEventListener('resize', resize);
resize();
requestAnimationFrame(draw);
