// Adapters for EasyPaisa and JazzCash (api mode). Without credentials in env they run in sandbox mode.
// `merchantId` comes from the admin-managed payment_config table.
export const gateways = {
  easypaisa: {
    async charge({ orderId, amount, phone, merchantId }) {
      if (!process.env.EASYPAISA_STORE_ID) return { ok: true, sandbox: true, ref: `EP-${orderId}-${Date.now()}` };
      throw new Error(`Wire EasyPaisa HTTPS API call here (store ${merchantId}, hashKey).`);
    }
  },
  jazzcash: {
    async charge({ orderId, amount, phone, merchantId }) {
      if (!process.env.JAZZCASH_MERCHANT_ID) return { ok: true, sandbox: true, ref: `JC-${orderId}-${Date.now()}` };
      throw new Error(`Wire JazzCash API call here (merchant ${merchantId}, password, integritySalt).`);
    }
  },
  cod: { async charge({ orderId }) { return { ok: true, ref: `COD-${orderId}` }; } }
};
