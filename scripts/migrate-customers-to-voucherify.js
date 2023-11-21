const { VoucherifyServerSide } = require('@voucherify/sdk')
const fetch = require('node-fetch')
require('dotenv').config()

const mapEmporixUserToVoucherifyCustomer = (
    user
) => {
  if (!(user instanceof Object)) {
    return undefined
  }
  const customer = {
    source_id: user.id ? `emporix-user-${user.id}` : undefined,
    name: user.contactName,
    email: user.contactEmail,
    phone: user.customerNumber || user.contactPhone,
    address: {
      city: user.addresses?.[0]?.city,
      line_1: user.addresses?.[0]?.street,
      line_2: user.addresses?.[0]?.streetNumber,
      country: user.addresses?.[0]?.country,
      postal_code: user.addresses?.[0]?.zipCode,
    },
    description: 'emporix customer',
    metadata: {
      preferredCurrency: user.preferredCurrency,
      preferredLanguage: user.preferredLanguage,
      ...(user.metadata || {}),
    },
  }
  return customer.source_id ? customer : undefined
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

const getCustomers = async (page, emporixAccessToken) => {
  const resultRaw = await fetch(
    `${process.env.REACT_APP_API_URL}/customer/${process.env.REACT_APP_EMPORIX_TENANT}/customers?pageNumber=${page}`,
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

exports.migrateCustomersToVoucherify = async () => {
  const emporixAccessToken = await getEmporixAPIAccessToken()
  let customerNumber = 1
  let page = 1
  let customers = []
  const voucherifyClient = VoucherifyServerSide({
    applicationId: process.env.REACT_APP_VOUCHERIFY_APP_ID,
    secretKey: process.env.REACT_APP_VOUCHERIFY_SECRET_KEY,
    apiUrl: process.env.REACT_APP_VOUCHERIFY_API_URL,
  })
  do {
    customers = await getCustomers(page, emporixAccessToken)
    for (const customer of customers) {
      const voucherifyCustomer= mapEmporixUserToVoucherifyCustomer(customer)
      if(!voucherifyCustomer){
        continue;
      }
      const createdCustomer = await voucherifyClient.customers.create(voucherifyCustomer)
      if(!createdCustomer){
        // ?
        continue;
      }
      if (customerNumber % 80 === 0) {
        console.log('Waiting 5 seconds due to emporix rate limiter')
        await sleep(5000)
      }
      console.log(`Customer ${customerNumber} created/updated successfully`)
      customerNumber++
    }
    page++
  } while (customers.length !== 0)
  console.log('creating/updating customers job was finished.')
}
