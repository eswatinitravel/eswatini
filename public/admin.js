const $ = id => document.getElementById(id);
let last = '', lastAt = 0;

async function addStock(barcode) {
  const r = await fetch('/api/inventory/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${$('token').value}` },
    body: JSON.stringify({ barcode, qty: Number($('qty').value) || 1 })
  });
  const j = await r.json();
  $('out').textContent = r.ok ? `${j.name}: stock now ${j.stock}` : `${barcode}: ${j.error}`;
}

$('add').onclick = () => $('manual').value && addStock($('manual').value.trim());

$('start').onclick = async () => {
  if (!('BarcodeDetector' in window)) { $('out').textContent = 'Camera scanning is not supported in this browser; type the barcode instead.'; return; }
  try {
    $('cam').srcObject = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch { $('out').textContent = 'Camera permission denied.'; return; }
  const det = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'code_128'] });
  const tick = async () => {
    try {
      const [hit] = await det.detect($('cam'));
      // Ignore repeats of the same code within 3 seconds so one scan adds stock once.
      if (hit && (hit.rawValue !== last || Date.now() - lastAt > 3000)) {
        last = hit.rawValue; lastAt = Date.now();
        await addStock(last);
      }
    } catch {}
    requestAnimationFrame(tick);
  };
  tick();
};
