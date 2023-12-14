import React, { useEffect, useState } from 'react'
import { useContentful } from '../../context/contentful-provider'
import landingBg from '../../assets/landing_bg.png'
import { useAuth } from '../../context/auth-provider'
import { mapEmporixUserToVoucherifyCustomer } from '../../integration/voucherify/mappers/mapEmporixUserToVoucherifyCustomer'
import { Box } from '@mui/system'
import {
  getCustomer,
  getQualificationsWithItemsExtended,
  listMemberRewards,
} from '../../integration/voucherify/voucherifyApi'
import { Qualification } from '../shared/Qualification'
import { CUSTOMER_ADDITIONAL_METADATA } from '../../constants/localstorage'
import { getCustomerAdditionalMetadata } from '../../helpers/getCustomerAdditionalMetadata'
import './about.css'
import Collapse from '@mui/material/Collapse'
import { mapItemsToVoucherifyOrdersItems } from '../../integration/voucherify/validateCouponsAndGetAvailablePromotions/mappers/product'
import { mapEmporixItemsToVoucherifyProducts } from '../../integration/voucherify/mappers/mapEmporixItemsToVoucherifyProducts'
import { getCart } from '../../integration/emporix/emporixApi'
import { useCart } from '../../context/cart-provider'
import { uniqBy } from 'lodash'

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

  useEffect(() => {
    ;(async () => {
      const customer = mapEmporixUserToVoucherifyCustomer(user)
      if (customer.source_id) {
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
      const qualifications = items
        ? await getQualificationsWithItemsExtended(
            'AUDIENCE_ONLY',
            items,
            customer
          )
        : [].concat(
            ...(await Promise.all([
              await getQualificationsWithItemsExtended(
                'AUDIENCE_ONLY',
                items,
                customer
              ),
              await getQualificationsWithItemsExtended(
                'PRODUCTS_DISCOUNT',
                items,
                customer
              ),
            ]))
          )
      setQualifications(uniqBy(qualifications, 'id'))
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
              mb: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Box sx={{ fontWeight: 600, fontSize: 20 }}>
              Your loyalty points: {voucherifyCustomer?.loyalty?.points || 0}
            </Box>
            <div className="text-[32px]/[64px] font-semibold w-full text-center">
              Promotions
            </div>
            {qualifications.map((qualification) => (
              <Qualification
                key={qualification.id}
                qualification={qualification}
              />
            ))}
            {qualifications.length === 0 && (
              <Box sx={{ flex: 1, textAlign: 'center' }}>
                <div>No promotions found</div>
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
