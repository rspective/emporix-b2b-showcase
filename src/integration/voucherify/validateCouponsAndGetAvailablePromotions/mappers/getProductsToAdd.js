import {
  stackableRedeemablesResponseToUnitStackableRedeemablesResultDiscountUnitWithCodes,
  stackableResponseToUnitTypeRedeemables,
} from './redeemableOperationFunctions'
import { couponsStatusNew } from './couponsOperationFunctions'
import ApiRequest from '../../../../services'
import { priceApi } from '../../../../services/service.config'
import { getEmporixAPIAccessToken } from '../../../emporix/getEmporixAPIAccessToken'

export async function getProductsToAdd(
  validatedCoupons,
  couponsFromRequest,
  itemsInCart,
  context
) {
  const newCoupons = couponsStatusNew(couponsFromRequest).map(
    (couponData) => couponData.code
  )
  if (newCoupons.length === 0) {
    return []
  }
  const newFreeUnits =
    stackableRedeemablesResponseToUnitStackableRedeemablesResultDiscountUnitWithCodes(
      stackableResponseToUnitTypeRedeemables(validatedCoupons)
    ).filter((freeUnit) => freeUnit.code && newCoupons.includes(freeUnit.code))
  const unitsToAdd = [].concat.apply(
    [],
    newFreeUnits.map((unitModel) =>
      unitModel.units ? unitModel.units : unitModel
    )
  )
  const groupedUnitsToAdd = unitsToAdd.reduce((accumulator, unitOffData) => {
    const source_id = unitOffData.product.source_id
    const { effect, unit_off } = unitOffData
    if (!source_id) {
      return accumulator
    }
    if (accumulator[source_id]) {
      if (effect === 'ADD_MISSING_ITEMS') {
        accumulator[source_id].min_units =
          accumulator[source_id].min_units + unit_off
      } else {
        accumulator[source_id].min_units =
          accumulator[source_id].must_add + unit_off
      }
    } else {
      accumulator[source_id] = {
        source_id,
        price: itemsInCart.find((item) => item.source_id === source_id)?.price,
        currentQuantity:
          itemsInCart.find((item) => item.source_id === source_id)?.quantity ||
          0,
        min_units: effect === 'ADD_MISSING_ITEMS' ? unit_off : 0,
        must_add: effect !== 'ADD_MISSING_ITEMS' ? unit_off : 0,
      }
    }
    return accumulator
  }, {})

  const calculatedGroupedUnitsToAdd = Object.values(groupedUnitsToAdd)
    .filter(
      (groupedUnitToAdd) =>
        groupedUnitToAdd.must_add > 0 ||
        groupedUnitToAdd.min_units > groupedUnitToAdd.currentQuantity
    )
    .map((groupedUnitToAdd) => ({
      ...groupedUnitToAdd,
      newQuantity:
        (groupedUnitToAdd.min_units > groupedUnitToAdd.currentQuantity
          ? groupedUnitToAdd.min_units
          : groupedUnitToAdd.currentQuantity) + groupedUnitToAdd.must_add,
    }))
  return calculatedGroupedUnitsToAdd
  const missingPricesFor = calculatedGroupedUnitsToAdd
    .filter((calculatedGroupedUnitToAdd) => !calculatedGroupedUnitToAdd.price)
    .map((calculatedGroupedUnitsToAdd) => calculatedGroupedUnitsToAdd.source_id)
  if (!missingPricesFor.length) {
    return calculatedGroupedUnitsToAdd
  }
  try {
    const missingPrices = missingPricesFor.length
      ? (
          await ApiRequest(
            priceApi(),
            'post',
            {
              targetCurrency: context.currency,
              siteCode: context.siteCode,
              targetLocation: { countryCode: context.targetLocation },
              items: missingPricesFor.map((source_id) => ({
                itemId: {
                  itemType: 'PRODUCT',
                  includesTax: false,
                  id: source_id,
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
      : []

    return calculatedGroupedUnitsToAdd.map((calculatedGroupedUnitToAdd) => {
      const { source_id, price } = calculatedGroupedUnitToAdd
      if (price) {
        return calculatedGroupedUnitToAdd
      }

      const priceObject = missingPrices.find(
        (priceObject) => priceObject.itemId?.id === source_id
      )
      return {
        ...calculatedGroupedUnitToAdd,
        price:
          priceObject.effectiveAmount ||
          priceObject.originalValue ||
          priceObject.totalValue,
      }
    })
  } catch (e) {
    console.log(e)
    return calculatedGroupedUnitsToAdd
  }
}
