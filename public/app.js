const $ = id => document.getElementById(id);
const client = localStorage.client ||= Math.random().toString(36).slice(2);
let products = [], cart = {};

const sel = $('theme');
const setTheme = t => { document.documentElement.dataset.theme = t; sel.value = t; };
sel.onchange = () => { localStorage.theme = sel.value; setTheme(sel.value); };
fetch('/api/themes').then(r => r.json()).then(({ default: def, themes }) => {
  sel.innerHTML = themes.map(t => `<option>${t.id}</option>`).join('');
  setTheme(themes.some(t => t.id === localStorage.theme) ? localStorage.theme : def);
});

// 3D rotating hero: a wireframe cube projected on a 2D canvas (no external lib needed).
const cv = $('hero3d'), ctx = cv.getContext('2d');
const V = [-1,1].flatMap(x => [-1,1].flatMap(y => [-1,1].map(z => [x,y,z])));
const E = V.flatMap((a,i) => V.map((b,j) => [i,j,a.filter((v,k) => v !== b[k]).length]).filter(e => e[1] > e[0] && e[2] === 1));
let ang = 0;
(function draw() {
  ang += 0.015; ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent'); ctx.lineWidth = 2;
  const P = V.map(([x,y,z]) => {
    const X = x*Math.cos(ang) - z*Math.sin(ang), Z = x*Math.sin(ang) + z*Math.cos(ang);
    const Y = y*Math.cos(ang*.7) - Z*Math.sin(ang*.7), Z2 = y*Math.sin(ang*.7) + Z*Math.cos(ang*.7);
    const s = 90 / (4 - Z2); return [300 + X*s*2, 150 + Y*s*2];
  });
  E.forEach(([i,j]) => { ctx.beginPath(); ctx.moveTo(...P[i]); ctx.lineTo(...P[j]); ctx.stroke(); });
  requestAnimationFrame(draw);
})();

const card = (p, extra) => `<div class="card"><h3>${p.name}</h3><p>Rs ${p.price}</p><small>${p.stock} in stock</small><br>${extra}</div>`;
async function load() {
  products = await (await fetch('/api/products')).json();
  $('grid').innerHTML = products.map(p => card(p, `<button data-cart="${p.id}">Add to cart</button><button data-wish="${p.id}">♡</button>`)).join('');
  const w = await (await fetch(`/api/wishlist/${client}`)).json();
  $('wish').innerHTML = w.map(p => card(p, `<button data-unwish="${p.id}">Remove</button>`)).join('') || '<p>Empty</p>';
  $('cart').textContent = Object.entries(cart).map(([id,q]) => `${products.find(p => p.id == id)?.name} x${q}`).join(', ') || 'Empty';
  const b = await (await fetch('/api/banners')).json();
  $('banner').textContent = b.map(x => x.text).join(' | '); $('banner').hidden = !b.length;
}
document.addEventListener('click', async e => {
  const d = e.target.dataset;
  if (d.cart) cart[d.cart] = (cart[d.cart] || 0) + 1;
  if (d.wish) await fetch(`/api/wishlist/${client}/${d.wish}`, { method: 'POST' });
  if (d.unwish) await fetch(`/api/wishlist/${client}/${d.unwish}`, { method: 'DELETE' });
  if (Object.keys(d).length) load();
});
$('checkout').onsubmit = async e => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  const items = Object.entries(cart).map(([id,qty]) => ({ id: +id, qty }));
  const r = await fetch('/api/orders', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ ...f, items }) });
  const j = await r.json();
  $('msg').textContent = !r.ok ? j.error
    : j.status === 'awaiting_payment' ? `Order #${j.id} received. ${j.instructions}`
    : `Order #${j.id} placed. Tracking ${j.shipment.tracking}`;
  if (r.ok) cart = {}; load();
};
load();

// Show where to send money when a manual-payment wallet is selected.
let methods = [];
const showPayInfo = () => {
  const m = methods.find(x => x.method === document.querySelector('[name=method]').value);
  $('payinfo').textContent = m && m.mode === 'manual'
    ? `Send payment to ${m.method} account ${m.account || '(not set yet)'}${m.account_title ? ` (${m.account_title})` : ''}. We ship once it is confirmed.`
    : '';
};
document.querySelector('[name=method]').onchange = showPayInfo;
fetch('/api/payments/methods').then(r => r.json()).then(m => { methods = m; showPayInfo(); });
