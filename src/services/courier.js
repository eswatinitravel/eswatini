// Pakistani courier adapters (TCS, Leopards, Trax). Sandbox tracking numbers until API keys are configured.
const couriers = ['tcs', 'leopards', 'trax'];
export function bookShipment({ orderId, city, courier = 'tcs' }) {
  if (!couriers.includes(courier)) throw new Error('Unknown courier');
  return { courier, tracking: `${courier.toUpperCase()}${String(orderId).padStart(8, '0')}`, city };
}
export const supportedCouriers = couriers;
