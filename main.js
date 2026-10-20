// Meem Typing & Stamps — progressive enhancement only; every page works without this file.
document.documentElement.classList.add("js");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches || location.search.includes("still");

// Header shadow + mobile menu
const header = document.querySelector(".site-header");
addEventListener("scroll", () => header.classList.toggle("scrolled", scrollY > 8), { passive: true });
const menuBtn = document.querySelector(".menu-btn");
const nav = document.getElementById("nav");
menuBtn?.addEventListener("click", () => {
  const open = nav.classList.toggle("open");
  menuBtn.setAttribute("aria-expanded", open);
});

// Reveal on scroll
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
}, { rootMargin: "0px 0px -10% 0px" });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

document.querySelectorAll("[data-year]").forEach((el) => (el.textContent = new Date().getFullYear()));

// Services page: highlight the chip for the section in view
const chipLinks = [...document.querySelectorAll(".chips a")];
if (chipLinks.length) {
  const spy = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) chipLinks.forEach((a) => a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id)); }), { rootMargin: "-40% 0px -50% 0px" });
  document.querySelectorAll(".row").forEach((r) => spy.observe(r));
}

// Opening hours, in Ajman time. Index 0 = Sunday. Minutes from midnight.
// Source: the existing site's Contact page. "Sunday: Closed" wins over the "Saturday – Thursday" range.
const AM = [[510, 840], [1020, 1260]]; // 8:30–2:00, 5:00–9:00
const HOURS = [[], AM, AM, AM, AM, [[510, 705], [1020, 1260]], AM];
const fmt = (m) => { const h = Math.floor(m / 60), mm = String(m % 60).padStart(2, "0"); return `${((h + 11) % 12) + 1}:${mm} ${h < 12 ? "AM" : "PM"}`; };
function ajmanNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dubai", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23" }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday), min: +p.hour * 60 + +p.minute };
}
function status() {
  const { day, min } = ajmanNow();
  const open = HOURS[day].find(([a, b]) => min >= a && min < b);
  if (open) return { open: true, text: "Open now", sub: `Until ${fmt(open[1])}` };
  const later = HOURS[day].find(([a]) => a > min);
  if (later) return { open: false, text: "Closed now", sub: `Opens ${fmt(later[0])} today` };
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (HOURS[d].length) return { open: false, text: "Closed now", sub: `Opens ${i === 1 ? "tomorrow" : ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d]} ${fmt(HOURS[d][0][0])}` };
  }
}
const st = status();
document.querySelectorAll("[data-status]").forEach((el) => {
  el.querySelector(".v").innerHTML = `<span class="dot${st.open ? " open" : ""}"></span>${st.text}`;
  el.querySelector(".l").textContent = st.sub;
});
const today = ajmanNow().day;
document.querySelectorAll("[data-days]").forEach((tr) => { if (tr.dataset.days.split(",").includes(String(today))) tr.classList.add("today"); });

// Hero service deck. With WebGL (and no reduced-motion preference) a 3D ring takes over (hero3d.js);
// otherwise the CSS card row drifts by itself. Either way the HTML cards stay in the DOM for keyboard and screen readers.
const deck = document.querySelector(".deck");
if (deck) {
  const originals = [...deck.querySelectorAll(".card")];
  originals.forEach((c, i) => (c.dataset.i = i));
  let cards = originals.slice();
  const bgs = [...document.querySelectorAll(".hero-bg img")];
  const box = document.querySelector(".hero-service");
  const cur = document.querySelector(".pager .cur");
  const bar = document.querySelector(".pager i");
  const wrapEl = deck.parentElement;
  const hero = document.querySelector(".hero");
  const canGL = (() => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } })();
  let ring = null;
  let active = -1;

  function setActive(i) {
    if (i === active) return;
    active = i;
    const c = originals[i];
    cards.forEach((k) => k.setAttribute("aria-pressed", +k.dataset.i === i));
    bgs.forEach((b) => b.classList.toggle("on", b.dataset.bg === c.dataset.bg));
    box.querySelector(".t").textContent = c.querySelector(".c-title").textContent;
    box.querySelector(".d").textContent = c.dataset.desc;
    box.classList.remove("swap"); void box.offsetWidth; box.classList.add("swap");
    if (cur) cur.textContent = String(i + 1).padStart(2, "0");
    if (ring) bar?.style.setProperty("--p", (i + 1) / originals.length);
  }

  // ---- CSS fallback: endless drift, centre card is active ----
  let cssOn = false;
  function startCss() {
    if (cssOn) return; cssOn = true;
    deck.classList.add("auto");
    originals.forEach((c) => { const k = c.cloneNode(true); k.setAttribute("aria-hidden", "true"); k.tabIndex = -1; deck.append(k); });
    cards = [...deck.querySelectorAll(".card")];
    cards.forEach((k) => k.addEventListener("click", () => {
      pauseFor(5000);
      deck.scrollTo({ left: k.offsetLeft - deck.offsetLeft - (deck.clientWidth - k.offsetWidth) / 2, behavior: reduced ? "auto" : "smooth" });
    }));
    const SPEED = 38;
    let pos = deck.scrollLeft, last = 0, over = false;
    const setWidth = () => cards[originals.length].offsetLeft - cards[0].offsetLeft;
    const centreCard = () => {
      const mid = deck.scrollLeft + deck.clientWidth / 2; let best = cards[0], d = Infinity;
      for (const k of cards) { const dk = Math.abs(k.offsetLeft - deck.offsetLeft + k.offsetWidth / 2 - mid); if (dk < d) { d = dk; best = k; } }
      return +best.dataset.i;
    };
    deck.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") over = true; });
    deck.addEventListener("pointerleave", () => (over = false));
    deck.addEventListener("touchstart", () => pauseFor(3000), { passive: true });
    deck.addEventListener("wheel", () => pauseFor(3000), { passive: true });
    deck.addEventListener("focusin", () => (over = true));
    deck.addEventListener("focusout", () => (over = false));
    deck.addEventListener("scroll", () => setActive(centreCard()), { passive: true });
    if (!reduced) {
      const tick = (now) => {
        const dt = Math.min(now - (last || now), 50) / 1000; last = now;
        const w = setWidth();
        if (over || document.hidden || now < hold) pos = deck.scrollLeft; else { pos += SPEED * dt; deck.scrollLeft = pos; }
        if (pos >= w) { pos -= w; deck.scrollLeft = pos; } else if (pos < 1 && now < hold) { pos += w; deck.scrollLeft = pos; }
        bar?.style.setProperty("--p", (pos % w) / w);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }
  }
  let hold = 0;
  const pauseFor = (ms) => (hold = Math.max(hold, performance.now() + ms));
  const step = () => originals[1].offsetLeft - originals[0].offsetLeft;
  function nudge(dir) { pauseFor(4000); deck.scrollBy({ left: dir * step(), behavior: reduced ? "auto" : "smooth" }); }

  originals.forEach((c, i) => c.addEventListener("click", () => { if (ring) ring.goTo(i); }));
  document.querySelector("[data-prev]")?.addEventListener("click", () => (ring ? ring.step(-1) : nudge(-1)));
  document.querySelector("[data-next]")?.addEventListener("click", () => (ring ? ring.step(1) : nudge(1)));

  setActive(0);
  if (canGL && !reduced && !location.search.includes("nogl")) {
    // Load three.js only after the page has painted, so the text appears first.
    const host = document.createElement("div");
    host.className = "ring"; host.setAttribute("aria-hidden", "true");
    const boot = () => import("/hero3d.js")
      .then((m) => {
        wrapEl.insertBefore(host, deck);
        return m.start({
          host, hero, onActive: setActive,
          onFail: () => { ring = null; wrapEl.classList.remove("three"); host.remove(); startCss(); },
          items: originals.map((c) => ({ title: c.querySelector(".c-title").textContent, sub: c.querySelector(".c-sub").textContent, img: c.querySelector("img").getAttribute("src") })),
        });
      })
      .then((api) => { ring = api; wrapEl.classList.add("three"); if (location.search.includes("debug")) window.meemRing = api; })
      .catch(() => { host.remove(); startCss(); });
    addEventListener("load", () => setTimeout(boot, 300), { once: true });
    if (document.readyState === "complete") setTimeout(boot, 300);
  } else startCss();
}

// Contact form → WhatsApp message to the shop (no server, nothing stored).
const form = document.getElementById("enquiry");
form?.addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(form);
  const text = [
    `Hello Meem Typing & Stamps,`,
    ``,
    `Name: ${f.get("name")}`,
    `Phone: ${f.get("phone")}`,
    `Service: ${f.get("service")}`,
    f.get("message") ? `\n${f.get("message")}` : "",
  ].join("\n").trim();
  window.open(`https://wa.me/971559900507?text=${encodeURIComponent(text)}`, "_blank", "noopener");
});
