const { VoucherifyServerSide } = require('@voucherify/sdk')
const fetch = require('node-fetch')
require('dotenv').config()

const getEmporixAPIAccessToken = async () => {
  const formData = {
    client_id: process.env.REACT_APP_EMPORIX_CLIENT_ID,
    client_secret: process.env.REACT_APP_EMPORIX_CLIENT_SECRET,
    grant_type: 'client_credentials',
  }
  const responseRaw = await fetch(
    `${process.env.REACT_APP_API_URL}/oauth/token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(formData).toString(),
    }
  )
  if (responseRaw.status !== 200) {
    throw {
      error: 'Could not get access token',
    }
  }
  const { access_token } = await responseRaw.json()
  if (!access_token) {
    throw 'could not get Emporix access token'
  }
  return access_token
}

const brands = {}
const getBrand = async (id) => {
  if (brands[id]?.name) {
    return brands[id]
  }
  const brandRaw = await fetch(
    `${process.env.REACT_APP_API_URL}/brand/brands/${id}`,
    {
      method: 'Get',
      headers: {
        Authorization: `Bearer ${emporixAccessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )
  if (brandRaw.status !== 200) {
    console.log('could not get brand')
    return {}
  }
  brands[id] = brandRaw.json()
  return brands[id]
}

const getProducts = async (page, emporixAccessToken) => {
  const resultRaw = await fetch(
    `${process.env.REACT_APP_API_URL}/product/${process.env.REACT_APP_EMPORIX_TENANT}/products?pageNumber=${page}`,
    {
      method: 'Get',
      headers: {
        Authorization: `Bearer ${emporixAccessToken}`,
        'Content-Type': 'application/json',
      },
    }
  )
  if (resultRaw.status !== 200) {
    throw 'could not get products'
  }
  return await resultRaw.json()
}

;(async () => {
  const emporixAccessToken = await getEmporixAPIAccessToken()
  let productNumber = 1
  let page = 1
  let products = []
  const voucherifyClient = VoucherifyServerSide({
    applicationId: process.env.REACT_APP_VOUCHERIFY_APP_ID,
    secretKey: process.env.REACT_APP_VOUCHERIFY_SECRET_KEY,
    apiUrl: process.env.REACT_APP_VOUCHERIFY_API_URL,
  })
  do {
    products = await getProducts(page, emporixAccessToken)
    throw ''
    for (const product of products) {
      const name =
        product.name?.en || product.name instanceof Object
          ? Object.entries(product.name)?.[0]?.[1]
          : undefined
      const productBrandId =
        product?.data?.mixins?.productCustomAttributes?.brand
      let brandId, brandName
      if (productBrandId) {
        const brand = await getBrand(brandId)
        brandId = brand?.id
        brandName = brand?.name
      }
      const productCreated = await voucherifyClient.products.create({
        name,
        source_id: product.id,
        metadata: {
          description: product.description,
          brandId,
          brandName,
        },
        image_url: product.media?.[0]?.url,
      })
      if (productCreated) {
        console.log(`Product ${productNumber} created successfully`)
        productNumber++
      }
    }
    page++
  } while (products.length !== 0)
})()
