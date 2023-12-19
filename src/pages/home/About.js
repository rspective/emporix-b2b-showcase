import React, { useEffect, useState } from 'react'
import { useContentful } from '../../context/contentful-provider'
import landingBg from '../../assets/landing_bg.png'
import { useAuth } from '../../context/auth-provider'
import { mapEmporixUserToVoucherifyCustomer } from '../../integration/voucherify/mappers/mapEmporixUserToVoucherifyCustomer'
import { Box } from '@mui/system'
import {
  getCustomer,
  getQualificationsWithItemsExtended,
  listLoyaltyTierRewards,
  listMemberLoyaltyTiers,
} from '../../integration/voucherify/voucherifyApi'
import { Qualification } from '../shared/Qualification'
import './about.css'
import Collapse from '@mui/material/Collapse'
import { mapItemsToVoucherifyOrdersItems } from '../../integration/voucherify/validateCouponsAndGetAvailablePromotions/mappers/product'
import { mapEmporixItemsToVoucherifyProducts } from '../../integration/voucherify/mappers/mapEmporixItemsToVoucherifyProducts'
import { getCart } from '../../integration/emporix/emporixApi'
import { useCart } from '../../context/cart-provider'
import { uniqBy } from 'lodash'
import { groupAndSortQualifications } from '../../utils/groupAndSortQualifications'

const About = () => {
  const { cartAccount } = useCart()
  const { fields } = useContentful()
  const [introImageUrl, setIntroImageUrl] = useState('')
  const [showMoreOpen, setShowMoreOpen] = useState(false)
  const { mainImageRight } = fields

  useEffect(() => {
    ;(async () => {
      if (
        mainImageRight &&
        mainImageRight.fields &&
        mainImageRight.fields.file &&
        mainImageRight.fields.file.url
      ) {
        setIntroImageUrl(mainImageRight.fields.file.url)
      }
    })()
  }, [mainImageRight])

  const { user } = useAuth()
  const [qualifications, setQualifications] = useState([])
  const [voucherifyCustomer, setVoucherifyCustomer] = useState()
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    ;(async () => {
      const customer = mapEmporixUserToVoucherifyCustomer(user)
      if (customer?.source_id) {
        try {
          const voucherifyCustomer = await getCustomer(customer.source_id)
          if (voucherifyCustomer.id) {
            setVoucherifyCustomer(voucherifyCustomer)
          }
        } catch (err) {
          console.log(err)
        }
      }
      const emporixCart = cartAccount?.id ? await getCart(cartAccount.id) : {}
      const items = mapItemsToVoucherifyOrdersItems(
        mapEmporixItemsToVoucherifyProducts(emporixCart?.items || [])
      )
      const qualifications = uniqBy(
        items
          ? await getQualificationsWithItemsExtended(
              'AUDIENCE_ONLY',
              items,
              customer || voucherifyCustomer
            )
          : [].concat(
              ...(await Promise.all([
                await getQualificationsWithItemsExtended(
                  'AUDIENCE_ONLY',
                  items,
                  customer || voucherifyCustomer
                ),
                await getQualificationsWithItemsExtended(
                  'PRODUCTS_DISCOUNT',
                  items,
                  customer || voucherifyCustomer
                ),
              ]))
            )
      )
      console.log(qualifications)
      console.log(groupAndSortQualifications(qualifications))
      setQualifications(groupAndSortQualifications(qualifications))
      setIsLoading(false)
    })()
  }, [user])

  return (
    <>
      <div
        // style={{ backgroundImage: `url(${landingBg})` }}
        className="home_about"
      >
        <div className="mx-6 md:ml-16 mt-[48px] md:mt-[114px] w-[492px]">
          <div className="text-[48px] md:text-[48px] font-inter font-semibold md:leading-[64px] leading-[56px]">
            {fields.mainTitle}
          </div>
          <div className="text-[18px] leading-[30px] font-inter font-normal pt-[24px] md:max-w-[525px]">
            {fields.companyMission}
          </div>

          <div className="pt-[44px] desktop_only text-sm">
            <button className="px-6 py-4 font-semibold bg-yellow text-eerieBlack rounded">
              {fields.startShoppingButtonLabel}
            </button>
          </div>
        </div>
        {/* <div className="mt-[60px] hidden xl:block w-[530px] h-[818px] flex min-w-[50%]">
        <img alt="intro image" src={introImageUrl} className="mx-auto" />
      </div>  */}
      </div>
      <Collapse
        children={
          <Box
            sx={{
              mt: -2,
              mb: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <div className="text-[32px]/[64px] font-semibold w-full text-center">
              Promotions
            </div>
            {qualifications.map((qualification, index) => (
              <Qualification
                key={qualification.id + voucherifyCustomer?.loyalty?.points}
                qualification={qualification}
                voucherifyCustomer={voucherifyCustomer}
                addToQualifications={(voucher) => {
                  setQualifications([
                    ...qualifications.slice(0, index + 1),
                    voucher,
                    ...qualifications.slice(index + 1),
                  ])
                }}
                setVoucherifyCustomer={setVoucherifyCustomer}
              />
            ))}
            {qualifications.length === 0 && (
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <div>{isLoading ? 'Loading...' : 'No promotions found'}</div>
              </Box>
            )}
          </Box>
        }
        collapsedSize={550}
        in={showMoreOpen}
        className="px-20 pt-20"
      ></Collapse>
      <div className="show-more_container">
        <div
          className="show-more_button"
          onClick={() => setShowMoreOpen(!showMoreOpen)}
        >
          Show {showMoreOpen ? 'less' : 'more'}
        </div>
        <div className={`show-more_fade ${showMoreOpen ? 'hidden' : ''}`}></div>
      </div>
    </>
  )
}

export default About
