import {
  stackableRedeemablesResponseToUnitStackableRedeemablesResultDiscountUnitWithCodes,
  stackableResponseToUnitTypeRedeemables,
} from './redeemableOperationFunctions'
import { couponsStatusNew } from './couponsOperationFunctions'

export async function getProductsToAdd(
  validatedCoupons,
  couponsFromRequest,
  itemsInCart
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

  return Object.values(groupedUnitsToAdd)
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
}
