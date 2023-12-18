import {
  stackableRedeemablesResponseToUnitStackableRedeemablesResultDiscountUnitWithCodes,
  stackableResponseToUnitTypeRedeemables,
} from './redeemableOperationFunctions'
import { couponsStatusNew } from './couponsOperationFunctions'

export function getProductsToAdd(validatedCoupons, couponsFromRequest) {
  const newCoupons =
    couponsFromRequest ||
    couponsStatusNew(couponsFromRequest).map((couponData) => couponData.code)
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
  console.log(unitsToAdd)
  return []
  // return getCtProductsWithCurrentPriceAmount(
  //   stackableRedeemablesResponseToUnitStackableRedeemablesResultDiscountUnitWithCodes(
  //     stackableResponseToUnitTypeRedeemables(validatedCoupons)
  //   ),
  //   validatedCoupons.order.items
  // ).map((productToAdd) => {
  //   return {
  //     code: productToAdd.unit.code,
  //     effect: productToAdd.unit.effect,
  //     quantity: productToAdd.unit.unit_off,
  //     product: productToAdd.unit.sku.source_id,
  //     initial_quantity: productToAdd.item.initial_quantity,
  //     discount_quantity: productToAdd.item.discount_quantity,
  //     discount_difference:
  //       productToAdd.item?.applied_discount_amount -
  //         productToAdd.currentPriceAmount *
  //           productToAdd.item?.discount_quantity !==
  //       0,
  //     applied_discount_amount: productToAdd.currentPriceAmount,
  //   }
  // })
}

// export function getCtProductsWithCurrentPriceAmount(freeUnits, orderItems) {
//   return ctProducts
//     .map((ctProduct) => {
//       return freeUnits.map((unit) => {
//         console.log(orderItems, unit)
//         const item = orderItems?.find(
//           (item) => item?.sku?.source_id === unit.sku.source_id
//         )
//         return {
//           ...ctProduct,
//           currentPriceAmount: ctProduct.price,
//           unit,
//           item,
//           code: ctProduct.id,
//         }
//       })
//     })
//     .flat()
// }
