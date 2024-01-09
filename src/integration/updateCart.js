import {
  applyCouponOnCart,
  createCoupon,
  deleteDiscount,
  getCart,
  removeAllDiscountsFromCart,
  updateCartMetadataMixins,
} from './emporix/emporixApi'
import { buildIntegrationCartFromEmporixCart } from './buildIntegrationCartFromEmporixCart'
import { validateCouponsAndGetAvailablePromotions } from './voucherify/validateCouponsAndGetAvailablePromotions/validateCouponsAndGetAvailablePromotions'
import { getDiscountsValues } from './voucherify/mappers/getDiscountsValues'
import { compact } from 'lodash'

export const updateCart = async ({
  emporixCartId,
  newCode,
  codeToRemove,
  newPromotionCode,
  customer,
  context,
  rewardId,
}) => {
  if (!emporixCartId) {
    return {
      cart: {},
      inapplicableCoupons: [],
    }
  }
  const emporixCart = await getCart(emporixCartId)
  try {
    const validationResult = await validateCouponsAndGetAvailablePromotions(
      buildIntegrationCartFromEmporixCart({
        emporixCart,
        newCode,
        codeToRemove,
        newPromotionCode,
        customer,
        context,
        rewardId,
      })
    )
    const { applicableCoupons, order } = validationResult
    const { items } = buildIntegrationCartFromEmporixCart({ emporixCart })
    if (emporixCart.discounts?.length) {
      await removeAllDiscountsFromCart(emporixCart.id)
      emporixCart.discounts.forEach((discount) => {
        //don't wait
        deleteDiscount(discount.code)
      })
    }
    await updateCartMetadataMixins(
      emporixCart,
      validationResult,
      compact([codeToRemove]),
      order?.items || []
    )
    if (applicableCoupons.length > 0) {
      const createdCoupon = await createCoupon(
        emporixCart,
        validationResult.applicableCoupons
      )
      if (createdCoupon?.id) {
        await applyCouponOnCart(createdCoupon.id, emporixCart.id)
      }
    }
    return {
      cart: await getCart(emporixCartId),
      inapplicableCoupons: validationResult.inapplicableCoupons,
    }
  } catch (error) {
    console.log('error', error)
    return {
      cart: await getCart(emporixCartId),
      inapplicableCoupons: [],
    }
  }
}
