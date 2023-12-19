import {
  codesFromCoupons,
  couponsStatusDeleted,
  filterCouponsStatusAppliedAndNewByLimit,
  filterOutCouponsIfCodeIn,
  filterOutCouponsTypePromotionTier,
  uniqueCouponsByCodes,
} from './mappers/couponsOperationFunctions'
import {
  filterOutRedeemablesIfCodeIn,
  getRedeemablesByStatus,
  redeemablesToCodes,
  stackableRedeemablesResponseToUnitStackableRedeemablesResultDiscountUnitWithCodes,
  stackableResponseToUnitTypeRedeemables,
} from './mappers/redeemableOperationFunctions'
import { getCodesIfProductNotFoundIn } from './mappers/getCodesIfProductNotFoundIn'
import { buildValidationsValidateStackableParamsForVoucherify } from './mappers/buildValidationsValidateStackableParamsForVoucherify'
import { mapItemsToVoucherifyOrdersItems } from './mappers/product'
import { getItemsWithCorrectedPrices } from './mappers/getItemsWithPricesCorrected'
import {
  calculateTotalDiscountAmount,
  checkIfAllInapplicableCouponsArePromotionTier,
  getPromotions,
  setBannerOnValidatedPromotions,
} from './mappers/helperFunctions'
import { replaceCodesWithInapplicableCoupons } from './mappers/replaceCodesWithInapplicableCoupons'
import {
  getClient,
  releaseValidationSession,
  validateStackableVouchers,
} from '../voucherifyApi'
import { getProductsToAdd } from './mappers/getProductsToAdd'
import ApiRequest from '../../../services'
import {
  cartProductsApi,
  getCartById,
  priceApi,
} from '../../../services/service.config'
import { getEmporixAPIAccessToken } from '../../emporix/getEmporixAPIAccessToken'
import { compact, pick } from 'lodash'
import { TENANT } from '../../../constants/localstorage'
import { mapEmporixItemsToVoucherifyProducts } from '../mappers/mapEmporixItemsToVoucherifyProducts'
import { getCart } from '../../emporix/emporixApi'

const defaultResponse = {
  availablePromotions: [],
  totalDiscountAmount: 0,
  productsToAdd: [],
  applicableCoupons: [],
  inapplicableCoupons: [],
  sessionKey: undefined,
  allInapplicableCouponsArePromotionTier: undefined,
}

export const validateCouponsAndGetAvailablePromotions = async (cart) => {
  const {
    id,
    customerId,
    anonymousId,
    sessionKey,
    coupons: couponsFromRequest,
    items,
    customer,
    context,
  } = cart

  if (customer) {
    try {
      //don't wait
      getClient().customers.create(customer)
    } catch (err) {
      console.log('Could not update Customer')
    }
  }

  const uniqueCoupons = uniqueCouponsByCodes(couponsFromRequest)
  if (couponsFromRequest.length !== uniqueCoupons.length) {
    console.log({
      msg: 'COUPONS: Duplicates found and deleted',
    })
  }

  const { promotions, availablePromotions } = await getPromotions(
    cart,
    uniqueCoupons
  )

  if (!uniqueCoupons.length) {
    console.log({
      msg: 'No coupons applied, skipping voucherify call',
    })
    return { ...defaultResponse, availablePromotions }
  }

  const deletedCoupons = couponsStatusDeleted(uniqueCoupons)
  //don't wait
  releaseValidationSession(
    codesFromCoupons(filterOutCouponsTypePromotionTier(deletedCoupons)),
    sessionKey
  )

  if (deletedCoupons.length === uniqueCoupons.length) {
    console.log({
      msg: 'Deleting coupons only, skipping voucherify call',
    })

    return { ...defaultResponse, availablePromotions }
  }

  const couponsAppliedAndNewLimitedByConfig =
    filterCouponsStatusAppliedAndNewByLimit(
      uniqueCoupons,
      5 //Voucherify max limit
    )
  let validatedCoupons = await validateStackableVouchers(
    buildValidationsValidateStackableParamsForVoucherify(
      couponsAppliedAndNewLimitedByConfig,
      cart,
      mapItemsToVoucherifyOrdersItems(items)
    )
  )

  const inapplicableRedeemables = getRedeemablesByStatus(
    validatedCoupons.redeemables,
    'INAPPLICABLE'
  )
  const inapplicableCodes = redeemablesToCodes(inapplicableRedeemables)

  if (validatedCoupons.valid === false) {
    const applicableCodes = couponsAppliedAndNewLimitedByConfig.filter(
      (coupon) => !inapplicableCodes.includes(coupon.code)
    )
    if (applicableCodes.length === 0) {
      return {
        ...defaultResponse,
        availablePromotions,
        inapplicableCoupons: inapplicableRedeemables,
      }
    }
    //We need to do another call to V% if there is any applicable coupon in the cart
    //to get definitions of discounts we should apply on the cart
    validatedCoupons = await validateStackableVouchers(
      buildValidationsValidateStackableParamsForVoucherify(
        applicableCodes,
        cart,
        mapItemsToVoucherifyOrdersItems(items)
      )
    )
  }

  const unitTypeRedeemables =
    stackableResponseToUnitTypeRedeemables(validatedCoupons)
  const stackableRedeemablesResultDiscountUnitWithPriceAndCodes =
    stackableRedeemablesResponseToUnitStackableRedeemablesResultDiscountUnitWithCodes(
      unitTypeRedeemables
    )

  const { found: currentPricesOfProducts, notFound: notFoundProductSourceIds } =
    { found: [], notFound: [] }

  const codesWithMissingProductsToAdd = getCodesIfProductNotFoundIn(
    stackableRedeemablesResultDiscountUnitWithPriceAndCodes,
    notFoundProductSourceIds
  )

  const productsToAdd = await getProductsToAdd(
    validatedCoupons,
    couponsFromRequest,
    items
  )

  //addProductsToEmporix
  if (productsToAdd.length > 0) {
    try {
      const emporixPrices = (
        await ApiRequest(
          priceApi(),
          'post',
          {
            targetCurrency: context.currency,
            siteCode: context.siteCode,
            targetLocation: { countryCode: context.targetLocation },
            items: productsToAdd.map((productToAdd) => ({
              itemId: {
                itemType: 'PRODUCT',
                includesTax: false,
                id: productToAdd.source_id,
              },
              quantity: {
                quantity: 1,
              },
            })),
          },
          {
            'X-Version': 'v2',
            Authorization: `Bearer ${await getEmporixAPIAccessToken()}`,
            'Content-Type': 'application/json',
          }
        )
      ).data
      const dataForAddingProductsToEmporixCart = compact(
        productsToAdd.map((productsToAdd) => {
          const { source_id } = productsToAdd
          const priceObject = emporixPrices.find(
            (priceObject) => priceObject.itemId?.id === source_id
          )
          if (!priceObject) {
            return
          }
          return {
            quantity: productsToAdd.newQuantity - productsToAdd.currentQuantity,
            price: {
              priceId: priceObject.priceId,
              originalAmount: priceObject.originalValue,
              effectiveAmount: priceObject.effectiveValue,
              currency: priceObject.currency,
            },
            itemYrn: `urn:yaas:saasag:caasproduct:product:${localStorage.getItem(
              TENANT
            )};${source_id}`,
          }
        })
      )
      await ApiRequest(
        getCartById(id) + '/itemsBatch',
        'post',
        dataForAddingProductsToEmporixCart,
        {
          'X-Version': 'v2',
          Authorization: `Bearer ${await getEmporixAPIAccessToken()}`,
          'Content-Type': 'application/json',
        }
      )
    } catch (e) {
      console.log(e)
      console.log('could not add products')
    }
  }

  //don't wait
  releaseValidationSession(
    codesWithMissingProductsToAdd,
    validatedCoupons?.session?.key ?? sessionKey
  )

  if (productsToAdd.length) {
    validatedCoupons = await validateStackableVouchers(
      buildValidationsValidateStackableParamsForVoucherify(
        filterOutCouponsIfCodeIn(
          couponsAppliedAndNewLimitedByConfig,
          codesWithMissingProductsToAdd
        ),
        cart,
        mapEmporixItemsToVoucherifyProducts((await getCart(id))?.items || [])
      )
    )
  }

  const applicableCoupons = setBannerOnValidatedPromotions(
    filterOutRedeemablesIfCodeIn(
      getRedeemablesByStatus(validatedCoupons.redeemables, 'APPLICABLE'),
      codesWithMissingProductsToAdd
    ),
    promotions,
    uniqueCoupons
  )
  const inapplicableCoupons = [
    ...inapplicableRedeemables,
    ...replaceCodesWithInapplicableCoupons(codesWithMissingProductsToAdd),
  ]

  return {
    ...defaultResponse,
    availablePromotions,
    applicableCoupons,
    inapplicableCoupons,
    newSessionKey: validatedCoupons?.session?.key ?? null,
    totalDiscountAmount: calculateTotalDiscountAmount(validatedCoupons),
    productsToAdd,
    allInapplicableCouponsArePromotionTier:
      applicableCoupons.length || inapplicableCoupons.length
        ? checkIfAllInapplicableCouponsArePromotionTier(inapplicableCoupons)
        : undefined,
  }
}
