// Hand-drawn Christmas pictures used around the app. Colours come from the theme in styles.css.
const ART = {};

// A snowy hill with a tree, presents and a snowman.
ART.scene = `
<svg class="scene" viewBox="0 0 340 132" role="img" aria-label="A snowy hill with a Christmas tree, presents and a snowman">
  <g class="flakes" fill="var(--flake)">
    <circle cx="22" cy="18" r="2.5"/><circle cx="64" cy="40" r="2"/><circle cx="48" cy="72" r="1.8"/>
    <circle cx="176" cy="16" r="2.4"/><circle cx="206" cy="48" r="1.8"/><circle cx="232" cy="22" r="2"/>
    <circle cx="300" cy="34" r="2.5"/><circle cx="322" cy="70" r="2"/><circle cx="160" cy="62" r="1.6"/>
    <circle cx="14" cy="92" r="2"/><circle cx="288" cy="10" r="1.6"/>
  </g>
  <ellipse cx="80" cy="150" rx="190" ry="44" fill="var(--snow2)"/>
  <ellipse cx="270" cy="154" rx="170" ry="42" fill="var(--snow)"/>

  <g transform="rotate(-3 118 110)">
    <rect x="112" y="104" width="12" height="14" rx="3" fill="var(--ginger)"/>
    <g fill="var(--pine)" stroke="var(--pine)" stroke-width="7" stroke-linejoin="round">
      <path d="M118 66 L152 106 H84 Z"/><path d="M118 46 L144 80 H92 Z"/><path d="M118 28 L137 54 H99 Z"/>
    </g>
    <path d="M96 74 Q118 88 141 72 M88 98 Q118 114 149 96" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="108" cy="50" r="3.5" fill="var(--cran)"/><circle cx="128" cy="62" r="3.5" fill="var(--gold)"/>
    <circle cx="104" cy="88" r="4" fill="var(--snowman)"/><circle cx="132" cy="92" r="4" fill="var(--cran)"/>
    <circle cx="119" cy="72" r="3.5" fill="var(--teal)"/>
    <path d="M118 6 l3.6 7.6 8.2 1 -6 5.8 1.5 8.2 -7.3 -4 -7.3 4 1.5 -8.2 -6 -5.8 8.2 -1z" fill="var(--gold)" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round"/>
  </g>

  <g transform="rotate(-7 60 108)">
    <rect x="46" y="98" width="26" height="20" rx="4" fill="var(--teal)"/>
    <rect x="56" y="98" width="6" height="20" fill="var(--snowman)"/>
    <path d="M59 98 c-8 -10 -14 -2 0 0 c14 -2 8 -10 0 0" fill="var(--snowman)"/>
  </g>
  <g transform="rotate(4 178 106)">
    <rect x="160" y="92" width="34" height="28" rx="5" fill="var(--cran)"/>
    <rect x="174" y="92" width="7" height="28" fill="var(--gold)"/>
    <rect x="160" y="102" width="34" height="6" fill="var(--gold)"/>
    <path d="M177 92 c-11 -13 -18 -2 0 0 c18 -2 11 -13 0 0" fill="var(--gold)"/>
  </g>
  <rect x="194" y="104" width="22" height="17" rx="4" fill="var(--gold)"/>
  <rect x="202" y="104" width="5" height="17" fill="var(--cran)"/>

  <g transform="rotate(3 270 100)">
    <path d="M252 84 l-16 -10 M236 74 l-2 -7 M288 84 l15 -12 M303 72 l6 2" stroke="var(--ginger)" stroke-width="3" stroke-linecap="round" fill="none"/>
    <circle cx="270" cy="100" r="22" fill="var(--snowman)" stroke="var(--line)" stroke-width="1.5"/>
    <circle cx="270" cy="68" r="15" fill="var(--snowman)" stroke="var(--line)" stroke-width="1.5"/>
    <path d="M256 78 q14 9 28 0 l1 6 q-15 9 -30 0z" fill="var(--cran)"/>
    <path d="M279 84 l5 16 -7 1 -3 -15z" fill="var(--cran)"/>
    <rect x="259" y="40" width="22" height="16" rx="3" fill="var(--pine)"/>
    <rect x="253" y="53" width="34" height="5" rx="2.5" fill="var(--pine)"/>
    <rect x="259" y="48" width="22" height="4" fill="var(--gold)"/>
    <circle cx="265" cy="65" r="2" fill="var(--coal)"/><circle cx="276" cy="65" r="2" fill="var(--coal)"/>
    <path d="M270 69 l13 3 -13 3z" fill="var(--carrot)" stroke="var(--carrot)" stroke-width="1.5" stroke-linejoin="round"/>
    <circle cx="270" cy="96" r="2.2" fill="var(--coal)"/><circle cx="270" cy="106" r="2.2" fill="var(--coal)"/>
  </g>
</svg>`;

// A string of coloured lights that sags between four pegs.
ART.lights = (() => {
  const cols = ['cran', 'gold', 'pine', 'teal'];
  let wire = 'M0 5', bulbs = '', n = 0;
  for (let s = 0; s < 4; s++) {
    const x0 = s * 85, x1 = x0 + 85;
    wire += ` Q${x0 + 42.5} 25 ${x1} 5`;
    for (const t of [0.2, 0.5, 0.8]) {
      const x = (1 - t) * (1 - t) * x0 + 2 * t * (1 - t) * (x0 + 42.5) + t * t * x1;
      const y = 5 * ((1 - t) * (1 - t) + t * t) + 2 * t * (1 - t) * 25;
      bulbs += `<g class="bulb" style="animation-delay:${(n % 4) * 0.6}s"><rect x="${x - 2}" y="${y}" width="4" height="3.5" rx="1" fill="var(--muted)"/>` +
        `<ellipse cx="${x}" cy="${y + 8}" rx="4" ry="5.5" fill="var(--${cols[n % 4]})"/></g>`;
      n++;
    }
  }
  return `<svg class="lights" viewBox="0 0 340 32" aria-hidden="true" preserveAspectRatio="xMidYMin meet">
    <path d="${wire}" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round"/>${bulbs}</svg>`;
})();

// A friendly reindeer for empty lists.
ART.reindeer = `
<svg class="deer" viewBox="0 0 90 84" role="img" aria-label="A reindeer">
  <g fill="none" stroke="var(--ginger)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M32 32 C24 24 21 15 23 5 M26 19 l-10 -5 M24 11 l-7 -9"/>
    <path d="M58 32 C66 24 69 15 67 5 M64 19 l10 -5 M66 11 l7 -9"/>
  </g>
  <ellipse cx="20" cy="40" rx="9" ry="5.5" fill="var(--ginger)" transform="rotate(-24 20 40)"/>
  <ellipse cx="70" cy="40" rx="9" ry="5.5" fill="var(--ginger)" transform="rotate(24 70 40)"/>
  <ellipse cx="45" cy="52" rx="23" ry="26" fill="var(--ginger)"/>
  <ellipse cx="45" cy="65" rx="14" ry="11" fill="var(--ginger2)"/>
  <circle cx="45" cy="60" r="6.5" fill="var(--cran)"/><circle cx="43" cy="58" r="1.8" fill="var(--snowman)"/>
  <circle cx="36" cy="46" r="3" fill="var(--coal)"/><circle cx="54" cy="46" r="3" fill="var(--coal)"/>
  <circle cx="37" cy="45" r="1" fill="var(--snowman)"/><circle cx="55" cy="45" r="1" fill="var(--snowman)"/>
  <path d="M39 70 q6 5 12 0" fill="none" stroke="var(--coal)" stroke-width="2" stroke-linecap="round"/>
</svg>`;

// Small pictures that sit beside headings and in the tab bar.
const icon = (body) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
ART.gift = icon(`<rect x="3" y="10" width="18" height="11" rx="2.5" fill="var(--cran)"/><rect x="2" y="7" width="20" height="5" rx="2" fill="var(--cran)"/>
  <rect x="10.2" y="7" width="3.6" height="14" fill="var(--gold)"/><path d="M12 7 c-6 -7 -9 0 0 0 c9 0 6 -7 0 0" fill="var(--gold)"/>`);
ART.stocking = icon(`<path d="M8 6 h9 v8 c0 2 .6 2.6 2 3.4 c3.6 2 2 5.600 -1.500 5.600 H10 c-3 0 -5 -2 -4.500 -5 z" fill="var(--cran)" transform="translate(0 -1)"/>
  <rect x="6.500" y="2" width="12" height="5.500" rx="2.500" fill="var(--snowman)" stroke="var(--line)" stroke-width="1"/>
  <circle cx="10" cy="17" r="1.300" fill="var(--snowman)"/><circle cx="14" cy="13" r="1.300" fill="var(--snowman)"/>`);
ART.tree = icon(`<rect x="10.500" y="18" width="3" height="4" rx="1" fill="var(--ginger)"/>
  <g fill="var(--pine)" stroke="var(--pine)" stroke-width="2" stroke-linejoin="round"><path d="M12 9 L19 18 H5 Z"/><path d="M12 4 L17 11 H7 Z"/></g>
  <circle cx="12" cy="3.200" r="1.800" fill="var(--gold)"/><circle cx="10" cy="14" r="1.200" fill="var(--cran)"/><circle cx="14.500" cy="15.500" r="1.200" fill="var(--gold)"/>`);
ART.list = icon(`<rect x="4" y="3" width="16" height="18" rx="3" fill="var(--snowman)" stroke="currentColor" stroke-width="1.800"/>
  <path d="M8 9 l1.500 1.500 3 -3 M8 15 l1.500 1.500 3 -3" fill="none" stroke="var(--pine)" stroke-width="1.800" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M15 9.500 h2 M15 15.500 h2" stroke="currentColor" stroke-width="1.800" stroke-linecap="round"/>`);
ART.bauble = icon(`<rect x="10" y="2" width="4" height="3.500" rx="1" fill="var(--gold)"/><circle cx="12" cy="13.500" r="8" fill="var(--teal)"/>
  <path d="M4.500 11.500 q7.500 4 15 0" fill="none" stroke="var(--snowman)" stroke-width="1.800" stroke-linecap="round"/>
  <circle cx="9" cy="16.500" r="1.100" fill="var(--gold)"/><circle cx="15" cy="16.500" r="1.100" fill="var(--gold)"/><circle cx="12" cy="18" r="1.100" fill="var(--gold)"/>`);
