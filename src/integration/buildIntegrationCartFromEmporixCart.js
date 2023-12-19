import { uniqBy } from 'lodash'
import { mapEmporixUserToVoucherifyCustomer } from './voucherify/mappers/mapEmporixUserToVoucherifyCustomer'
import { mapEmporixItemsToVoucherifyProducts } from './voucherify/mappers/mapEmporixItemsToVoucherifyProducts'

export const buildIntegrationCartFromEmporixCart = ({
  emporixCart,
  newCode,
  codeToRemove,
  newPromotionCode,
  customer,
  voucherifyCustomer,
  context,
  rewardId,
}) => {
  const newPromotionsObjects = newPromotionCode
    ? [
        {
          code: newPromotionCode,
          status: 'NEW',
          type: 'promotion_tier',
        },
      ]
    : []
  const newCodesObjects = newCode
    ? [
        {
          code: newCode,
          status: 'NEW',
          rewardId,
        },
      ]
    : []
  const currentlyAppliedCoupons = Array.isArray(
    emporixCart?.mixins?.voucherify?.appliedCoupons
  )
    ? emporixCart?.mixins?.voucherify?.appliedCoupons
    : []
  const deletedCodesObjects = codeToRemove
    ? [
        {
          code: codeToRemove,
          status: 'DELETED',
          type: currentlyAppliedCoupons
            .filter((coupon) => coupon.type === 'promotion_tier')
            .map((coupon) => coupon.code)
            .includes(codeToRemove)
            ? 'promotion_tier'
            : 'voucher',
        },
      ]
    : []
  const coupons = uniqBy(
    [
      ...deletedCodesObjects,
      ...currentlyAppliedCoupons,
      ...newCodesObjects,
      ...newPromotionsObjects,
    ],
    'code'
  )

  return {
    id: emporixCart.id,
    customer:
      voucherifyCustomer || mapEmporixUserToVoucherifyCustomer(customer),
    sessionKey: emporixCart?.mixins?.voucherify?.sessionKey,
    items: mapEmporixItemsToVoucherifyProducts(emporixCart?.items || []),
    coupons,
    context,
  }
}
