// Image-recognition adapter. Replace with a real model/API (e.g. Google Vision) via VISION_API_KEY.
const keywords = { lamp: 'lighting', candle: 'lighting', vase: 'decor', cushion: 'decor', rug: 'decor', shelf: 'furniture', mug: 'kitchen', print: 'art' };
export function recognize(hint = '') {
  const h = hint.toLowerCase();
  const hit = Object.keys(keywords).find(k => h.includes(k));
  return hit ? { label: hit, category: keywords[hit], confidence: 0.8 } : { label: 'unknown', category: 'uncategorised', confidence: 0.1 };
}
