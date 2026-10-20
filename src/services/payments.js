// Adapters for EasyPaisa and JazzCash. Without credentials in env they run in sandbox mode.
export const gateways = {
  easypaisa: {
    async charge({ orderId, amount, phone }) {
      if (!process.env.EASYPAISA_STORE_ID) return { ok: true, sandbox: true, ref: `EP-${orderId}-${Date.now()}` };
      throw new Error('Wire EasyPaisa HTTPS API call here (storeId, hashKey).');
    }
  },
  jazzcash: {
    async charge({ orderId, amount, phone }) {
      if (!process.env.JAZZCASH_MERCHANT_ID) return { ok: true, sandbox: true, ref: `JC-${orderId}-${Date.now()}` };
      throw new Error('Wire JazzCash API call here (merchantId, password, integritySalt).');
    }
  },
  cod: { async charge({ orderId }) { return { ok: true, ref: `COD-${orderId}` }; } }
};
