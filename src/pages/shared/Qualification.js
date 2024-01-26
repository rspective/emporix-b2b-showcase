import { useAuth } from '../../context/auth-provider'
import React, { useEffect, useState } from 'react'
import { useCart } from '../../context/cart-provider'
import Box from '@mui/material/Box'
import { Button, Link } from '@mui/material'
import { CircularProgress } from '@material-ui/core'
import { getCart, getProduct } from '../../integration/emporix/emporixApi'
import {
  asyncMap,
  getQualificationsWithItemsExtended,
  redeemReward,
} from '../../integration/voucherify/voucherifyApi'
import CartService from '../../services/cart.service'
import priceService from '../../services/product/price.service'
import category from '../home/Category'
import pencil from '../../assets/pencil.svg'
import pencilGreen from '../../assets/pencil_green.svg'
import checkCircle from '../../assets/check_circle.svg'
import { buildIntegrationCartFromEmporixCart } from '../../integration/buildIntegrationCartFromEmporixCart'
import { mapEmporixUserToVoucherifyCustomer } from '../../integration/voucherify/mappers/mapEmporixUserToVoucherifyCustomer'
import { mapItemsToVoucherifyOrdersItems } from '../../integration/voucherify/validateCouponsAndGetAvailablePromotions/mappers/product'
import { mapEmporixItemsToVoucherifyProducts } from '../../integration/voucherify/mappers/mapEmporixItemsToVoucherifyProducts'
import { useCurrency } from '../../context/currency-context'
import { isEqual } from 'lodash'

const getUserId = (user) => {
  return user?.id || 'anonymous'
}

const getSavedQualifications = () => {
  const rawLocalStorageSavedQualifications = localStorage.getItem(
    'savedQualifications'
  )
  try {
    const localStorageSavedQualifications = JSON.parse(
      rawLocalStorageSavedQualifications
    )
    return localStorageSavedQualifications instanceof Object
      ? localStorageSavedQualifications
      : {}
  } catch (e) {
    return {}
  }
}

export const getUsersSavedQualifications = (user) => {
  const userId = getUserId(user)
  const localStorageSavedQualifications = getSavedQualifications()
  const usersSavedQualifications =
    localStorageSavedQualifications?.[userId]?.filter?.(
      (qualification) => qualification?.code
    ) || []
  return Array.isArray(usersSavedQualifications) ? usersSavedQualifications : []
}

const setUsersSavedQualifications = (user, codes) => {
  const userId = getUserId(user)
  const localStorageSavedQualifications = getSavedQualifications()
  localStorageSavedQualifications[userId] = codes
  localStorage.setItem(
    'savedQualifications',
    JSON.stringify(localStorageSavedQualifications)
  )
  return localStorageSavedQualifications[userId]
}

export const Qualification = ({
  qualification,
  addProducts,
  cartId,
  allowVoucherApply,
  voucherifyCustomer,
  setVoucherifyCustomer,
  addToQualifications,
}) => {
  const { activeCurrency } = useCurrency()
  const [loyaltyBalance, setLoyaltyBalance] = useState(
    qualification.loyalty_card?.balance || 0
  )
  const isLoyalty = qualification.type === 'LOYALTY_CARD'

  const { user } = useAuth()
  const [usersSavedQualificationsState, setUsersSavedQualificationsState] =
    useState(getUsersSavedQualifications(user))

  useEffect(() => {
    setUsersSavedQualificationsState(getUsersSavedQualifications(user))
  }, [user])

  function addToUsersSavedQualifications(qualification) {
    const usersSavedQualifications = getUsersSavedQualifications(user)
    usersSavedQualifications.push(qualification)
    setUsersSavedQualificationsState(usersSavedQualifications)
    setUsersSavedQualifications(user, usersSavedQualifications)
  }

  function removeFromUsersSavedQualifications(code) {
    const usersSavedQualifications = getUsersSavedQualifications(user)
    const updatedUsersSavedQualifications = usersSavedQualifications.filter(
      (qualification) => qualification?.code !== code
    )
    setUsersSavedQualificationsState(updatedUsersSavedQualifications)
    setUsersSavedQualifications(user, updatedUsersSavedQualifications)
  }

  const [isBeingApplied, setIsBeingApplied] = useState(false)
  const [areProductsBeingAdded, setAreProductsBeingAdded] = useState(false)
  const {
    applyPromotion,
    applyDiscount,
    applyReward,
    cartAccount,
    recheckCart,
  } = useCart()
  const cartMixins = cartAccount?.mixins?.voucherify || {}
  const { availablePromotions, appliedCoupons } = cartMixins
  const availablePromotionsCodes = (availablePromotions || []).map(
    (availablePromotion) => availablePromotion.code
  )

  const name = qualification?.cmsFields?.name
  const description = qualification?.cmsFields?.description
  const termsAndConditions = qualification?.cmsFields?.termsAndConditions
  const canApply =
    qualification.object === 'voucher' ||
    availablePromotionsCodes.includes(qualification.id)
  const [error, setError] = useState('')
  const alreadyAppliedCodes = (appliedCoupons || []).map(
    (appliedCoupon) => appliedCoupon.code
  )
  const isAlreadyApplied =
    qualification.object === 'voucher'
      ? alreadyAppliedCodes.includes(qualification.code)
      : alreadyAppliedCodes.includes(qualification.id)
  // const background = isAlreadyApplied
  //   ? qualification.object === 'voucher'
  //     ? '#caf8cd'
  //     : '#cee8f8'
  //   : qualification.object === 'voucher'
  //   ? '#9fe7a5'
  //   : '#9bcfef'
  const background = '#F6F7F9'
  const addMissingProducts = async () => {
    if (areProductsBeingAdded || !cartId) {
      return
    }
    setAreProductsBeingAdded(true)
    const products = (
      await Promise.all(
        await asyncMap(addProducts, async (productId) => {
          const product = await getProduct(productId)
          const prices = await priceService.getPriceWithProductIds([productId])
          return { ...product, price: prices?.[0] }
        })
      )
    ).filter((product) => product)
    for (const product of products) {
      await CartService.addProductToCart(cartId, { ...product, quantity: 1 })
    }
    await recheckCart()
    setAreProductsBeingAdded(false)
  }

  const apply = async (code, user, rewardId) => {
    if (!code || isBeingApplied) {
      return
    }
    setError('')
    setIsBeingApplied(true)
    let result
    try {
      result =
        code instanceof Object && 'reward' in code
          ? await applyReward(code, user)
          : qualification.object === 'voucher'
          ? await applyDiscount(code, user, rewardId)
          : await applyPromotion(code, user)
      if (result.inapplicableCoupons?.length) {
        const { inapplicableCoupons } = result
        const error = inapplicableCoupons
          .map?.(
            (inapplicableCoupon) => inapplicableCoupon?.result?.error?.details
          )
          .filter((e) => e)
          .join(', ')
        setError(error)
      }
    } catch (e) {
      console.error(e)
    }
    setIsBeingApplied(false)
    return result
  }

  const categoriesNames = (qualification.categories || [])
    .map((category) => category.name)
    .filter((e) => e)

  const [infoText, setInfoText] = useState()

  useEffect(() => {
    ;(async () => {
      if (!infoText) {
        return
      }
      await new Promise((r) => setTimeout(r, 3000))
      return setInfoText((prev) => (isEqual(prev, infoText) ? undefined : prev))
    })()
  }, [infoText])

  return (
    <Box
      sx={{
        background,
        p: '10px!important',
        color: isAlreadyApplied ? '#7e7e7e' : '#222',
        borderRadius: '4px',
        display: 'flex',
      }}
    >
      <img src={pencilGreen} className="w-8 h-8 mt-6 ml-4 mr-2" alt="pencil" />
      <Box sx={{ m: 2, flex: '1' }}>
        <Box sx={{ fontWeight: 600, fontSize: '22px', lineHeight: '32px' }}>
          {qualification.type === 'LOYALTY_CARD'
            ? 'Loyalty card'
            : qualification.object === 'voucher'
            ? `Voucher code: ${qualification.code}`
            : name || qualification.banner || qualification.name}
        </Box>
        <Box sx={{ fontWeight: '600', fontSize: '16px', lineHeight: '24px' }}>
          <span style={{ fontWeight: 800 }}>
            {qualification.object === 'voucher'
              ? name || description
              : description}
          </span>
        </Box>
        {isLoyalty && (
          <Box sx={{ fontSize: '14px', fontWeight: 600 }}>
            {loyaltyBalance ? (
              <>
                Loyalty balance: {loyaltyBalance}
                <br />
              </>
            ) : undefined}
          </Box>
        )}
        {termsAndConditions && (
          <Box
            sx={{
              fontWeight: '600',
              mt: 1,
              fontSize: '16px',
              lineHeight: '24px',
            }}
          >
            Terms & Conditions:
            <br />
            <span
              style={{
                fontWeight: 400,
              }}
            >
              {termsAndConditions}
            </span>
          </Box>
        )}
        {isLoyalty && isAlreadyApplied ? <Box>Pay with points</Box> : undefined}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {isAlreadyApplied ? (
            <Box
              sx={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Button
                className="cta-button-checked"
                title="Applied"
                disabled={true}
                variant={'contained'}
                sx={{ mt: 1, mb: '14px', borderRadius: 0 }}
              >
                <img src={checkCircle} className="w-4 h-4 mr-4" alt="pencil" />
                Applied
              </Button>
              {addProducts?.length > 0 ? (
                <Box sx={{ display: 'flex' }}>
                  <Button
                    title="Apply Coupon"
                    disabled={!addProducts}
                    variant={'contained'}
                    sx={{
                      mt: 1,
                      mb: '14px',
                      borderRadius: 0,
                      background: '#097e12',
                      '&:hover': {
                        backgroundColor: '#07670f',
                      },
                    }}
                    onClick={() => addMissingProducts()}
                  >
                    Add missing product{addProducts?.length > 1 ? 's' : ''}
                  </Button>
                  {areProductsBeingAdded && (
                    <Box sx={{ mb: '-60px', mt: '9px', ml: 1 }}>
                      <CircularProgress size={36.5} />
                    </Box>
                  )}
                </Box>
              ) : undefined}
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: '10px', flexDirection: 'column' }}>
              {qualification.type === 'LOYALTY_CARD' ? (
                <>
                  <Box sx={{ fontWeight: 500, mt: 3 }}>
                    {qualification.rewards?.length
                      ? 'Rewards:'
                      : 'No rewards found'}
                  </Box>
                  {(qualification.rewards || [])
                    .filter((reward) => reward?.reward?.type === 'COIN')
                    .map((reward) => (
                      <Box key={reward.reward.id}>
                        <Box>
                          {reward.reward.name}
                          {reward?.reward?.parameters?.coin && (
                            <>
                              <br />
                              {reward?.reward?.parameters?.coin.exchange_ratio?.toString()}
                              {activeCurrency?.symbol} for{' '}
                              {reward?.reward?.parameters?.coin.points_ratio}{' '}
                              points points
                            </>
                          )}
                        </Box>
                        <Box>
                          <Button
                            className="cta-button"
                            title="Apply Coupon"
                            disabled={
                              isBeingApplied ||
                              alreadyAppliedCodes.length >= 5 ||
                              loyaltyBalance <
                                (reward?.reward?.parameters?.coin
                                  .exchange_ratio || 0)
                            }
                            variant={'contained'}
                            sx={{
                              mt: 1,
                              mb: '14px',
                              borderRadius: 0,
                              backgroundColor: '#FAC420',
                              '&:hover': {
                                backgroundColor: '#FAC420',
                              },
                            }}
                            onClick={() =>
                              alreadyAppliedCodes.length < 5 &&
                              apply(
                                qualification.object === 'voucher'
                                  ? qualification.code
                                  : qualification.id,
                                user,
                                reward.reward.id
                              )
                            }
                          >
                            <img
                              src={pencil}
                              className="w-4 h-4 mr-4"
                              alt="pencil"
                            />
                            {alreadyAppliedCodes.length >= 5
                              ? 'You have reached coupon limit'
                              : loyaltyBalance <
                                (reward?.reward?.parameters?.coin
                                  .exchange_ratio || 0)
                              ? 'not enough points'
                              : 'Apply Reward'}
                          </Button>
                        </Box>
                      </Box>
                    ))}
                  {(qualification.rewards || [])
                    .filter((reward) => reward?.reward?.type !== 'COIN')
                    .map((reward) => (
                      <Box key={reward.reward.id}>
                        <Box>
                          {reward.reward.name}
                          {reward?.assignment?.parameters?.loyalty?.points && (
                            <>
                              <br />
                              {
                                reward?.assignment?.parameters?.loyalty?.points
                              }{' '}
                              points
                            </>
                          )}
                        </Box>
                        {infoText?.rewardId === reward.reward.id && (
                          <Box
                            sx={{
                              fontWeight: 800,
                              color: infoText?.error ? 'red' : undefined,
                            }}
                          >
                            {infoText?.error}
                            {infoText?.info}
                          </Box>
                        )}
                        <Box>
                          <Button
                            className="cta-button"
                            title="Apply Reward"
                            disabled={
                              isBeingApplied ||
                              alreadyAppliedCodes.length >= 5 ||
                              loyaltyBalance <
                                (reward?.assignment?.parameters?.loyalty
                                  ?.points || 0)
                            }
                            variant={'contained'}
                            sx={{
                              mt: 1,
                              mb: '14px',
                              borderRadius: 0,
                              backgroundColor: '#FAC420',
                              '&:hover': {
                                backgroundColor: '#FAC420',
                              },
                            }}
                            onClick={async () => {
                              setIsBeingApplied(true)
                              try {
                                const result = await redeemReward(
                                  qualification.campaign_id,
                                  qualification.id,
                                  {
                                    reward: { id: reward.reward.id },
                                    order: buildIntegrationCartFromEmporixCart({
                                      emporixCart: cartAccount
                                        ? await getCart(cartAccount.id)
                                        : {},
                                      voucherifyCustomer,
                                    }),
                                  }
                                )
                                if (
                                  typeof result.voucher?.loyalty_card
                                    ?.balance === 'number'
                                ) {
                                  setLoyaltyBalance(
                                    result.voucher.loyalty_card.balance
                                  )
                                }
                                if (
                                  result?.reward?.voucher instanceof Object &&
                                  typeof addToQualifications === 'function'
                                ) {
                                  addToQualifications({
                                    ...result.reward.voucher,
                                    qualification: {
                                      id: result.voucher.code,
                                      object: 'voucher',
                                    },
                                  })
                                  setInfoText({
                                    rewardId: reward.reward.id,
                                    info: 'Reward Applied',
                                  })
                                } else {
                                  setInfoText({
                                    rewardId: reward.reward.id,
                                    error: 'Could not apply this reward',
                                  })
                                }
                              } catch (e) {
                                console.log(e)
                              }
                              setIsBeingApplied(false)
                            }}
                          >
                            <img
                              src={pencil}
                              className="w-4 h-4 mr-4"
                              alt="pencil"
                            />
                            {loyaltyBalance <
                            (reward?.assignment?.parameters?.loyalty?.points ||
                              0)
                              ? 'not enough points'
                              : alreadyAppliedCodes.length >= 5
                              ? 'You have reached promotions limit'
                              : 'Apply reward'}
                          </Button>
                        </Box>
                      </Box>
                    ))}
                </>
              ) : (
                <Box sx={{ display: 'flex' }}>
                  {qualification.object === 'voucher' && !allowVoucherApply ? (
                    <Box>
                      <Button
                        className="cta-button"
                        title="Save voucher"
                        variant={'contained'}
                        sx={{
                          mt: 1,
                          mb: '14px',
                          borderRadius: 0,
                          background: !usersSavedQualificationsState
                            .map((qualification) => qualification?.code)
                            .includes(qualification.code)
                            ? '#FAC420'
                            : '#219653',
                          '&:hover': {
                            background: !usersSavedQualificationsState
                              .map((qualification) => qualification?.code)
                              .includes(qualification.code)
                              ? '#FAC420'
                              : '#219653',
                          },
                        }}
                        onClick={() => {
                          if (
                            !usersSavedQualificationsState
                              .map((qualification) => qualification?.code)
                              .includes(qualification.code)
                          ) {
                            addToUsersSavedQualifications(qualification)
                          } else {
                            removeFromUsersSavedQualifications(
                              qualification.code
                            )
                          }
                        }}
                      >
                        {usersSavedQualificationsState
                          .map((qualification) => qualification?.code)
                          .includes(qualification.code) ? (
                          <>
                            <img
                              src={checkCircle}
                              className="w-4 h-4 mr-4"
                              alt="checkCircle"
                            />
                            Saved for later
                          </>
                        ) : (
                          <>
                            <img
                              src={pencil}
                              className="w-4 h-4 mr-4"
                              alt="pencil"
                            />
                            Save for later
                          </>
                        )}
                      </Button>
                    </Box>
                  ) : (
                    <>
                      {canApply && (
                        <Box>
                          <Button
                            className="cta-button"
                            title="Apply Coupon"
                            disabled={
                              isBeingApplied || alreadyAppliedCodes.length >= 5
                            }
                            variant={'contained'}
                            sx={{
                              mt: 1,
                              mb: '14px',
                              borderRadius: 0,
                              backgroundColor: '#FAC420',
                              '&:hover': {
                                backgroundColor: '#FAC420',
                              },
                            }}
                            onClick={() =>
                              alreadyAppliedCodes.length < 5 &&
                              apply(
                                qualification.object === 'voucher'
                                  ? qualification.code
                                  : qualification.id,
                                user
                              )
                            }
                          >
                            <img
                              src={pencil}
                              className="w-4 h-4 mr-4"
                              alt="pencil"
                            />
                            {alreadyAppliedCodes.length >= 5
                              ? 'You have reached coupon limit'
                              : 'Apply'}
                          </Button>
                        </Box>
                      )}
                    </>
                  )}
                  {isBeingApplied && (
                    <Box sx={{ mb: '-60px', mt: '9px', ml: 1 }}>
                      <CircularProgress size={36.5} />
                    </Box>
                  )}
                </Box>
              )}
              {addProducts?.length > 0 ? (
                <Box sx={{ display: 'flex' }}>
                  <Button
                    title="Apply Coupon"
                    disabled={!addProducts}
                    variant={'contained'}
                    sx={{
                      mt: 1,
                      mb: '14px',
                      borderRadius: 0,
                      background: '#097e12',
                      '&:hover': {
                        backgroundColor: '#FAC420',
                      },
                    }}
                    onClick={() => addMissingProducts()}
                  >
                    Add missing product{addProducts?.length > 1 ? 's' : ''}
                  </Button>
                  {areProductsBeingAdded && (
                    <Box sx={{ mb: '-60px', mt: '9px', ml: 1 }}>
                      <CircularProgress size={36.5} />
                    </Box>
                  )}
                </Box>
              ) : undefined}
              <Box sx={{ color: 'red' }}>{error}</Box>
            </Box>
          )}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            {categoriesNames.map((categoryName) => (
              <Box
                key={`qualification-${qualification.id}-${categoryName}`}
                sx={{
                  m: 0,
                  background: 'rgb(180,97,1)',
                  color: 'white',
                  padding: '10px!important',
                  paddingTop: '5px!important',
                  paddingBottom: '5px!important',
                  mt: 1,
                  mb: '14px',
                  maxHeight: '36.5px',
                  borderRadius: '3px',
                }}
              >
                {categoryName}
              </Box>
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
