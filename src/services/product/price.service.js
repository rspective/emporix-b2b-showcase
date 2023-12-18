import ApiRequest from '../index'
import { ACCESS_TOKEN, TENANT } from '../../constants/localstorage'
import { priceApiByContext } from '../service.config'

const PriceService = () => {
  const getPriceWithProductIds = async (product_ids = []) => {
    if (!product_ids?.length) {
      return []
    }
    const accessToken = localStorage.getItem(ACCESS_TOKEN)
    const headers = {
      'X-Version': 'v2',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
    let data = {
      items: [],
    }
    product_ids.map((id) => {
      data['items'].push({
        itemId: {
          itemType: 'PRODUCT',
          includesTax: false,
          id: id,
        },
        quantity: {
          quantity: 1,
        },
      })
    })

    let res = await ApiRequest(priceApiByContext(), 'post', data, headers)
    return res.data || []
  }
  return {
    getPriceWithProductIds,
  }
}

export default PriceService()
