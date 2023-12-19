import { getCustomerAdditionalMetadata } from '../../../../helpers/getCustomerAdditionalMetadata'

export function buildValidationsValidateStackableParamsForVoucherify(
  coupons,
  cart,
  items,
  orderId,
  status
) {
  const customerMetadata = cart.customer?.metadata || {}

  return {
    // options?: StackableOptions;
    redeemables: coupons.map((code) => {
      if (code.rewardId) {
        return {
          object: code.type ? code.type : 'voucher',
          reward: { id: code.rewardId },
          id: code.code,
        }
      }
      return {
        object: code.type ? code.type : 'voucher',
        id: code.code,
      }
    }),
    session: {
      type: 'LOCK',
      ...(cart.sessionKey && { key: cart.sessionKey }),
    },
    order: {
      source_id: orderId || cart.id,
      customer: cart.customer,
      amount: items.reduce((acc, item) => acc + item.amount, 0),
      discount_amount: 0,
      items,
      status,
      metadata: {
        ...getCustomerAdditionalMetadata(),
        preferredCurrency: customerMetadata.preferredCurrency,
        preferredLanguage: customerMetadata.preferredLanguage,
      },
    },
    customer: cart.customer,
  }
}
