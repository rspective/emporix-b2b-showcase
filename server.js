//app modules
const express = require('express')
const app = express()
const dotenv = require('dotenv')
const path = require('path')
const {
  migrateCampaignsToContentful,
} = require('./CLI/migrate-campaigns-to-contentfull')
const {
  migratePromotionTiersToContentful,
} = require('./CLI/migrate-promotion-tiers-to-contentfull')
const {
  migrateStandaloneVouchersToContentful,
} = require('./CLI/migrate-standalone-vouchers-to-contentfull')
const {
  migrateProductsToVoucherify,
} = require('./CLI/migrate-products-to-voucherify')
dotenv.config()
// const checkExpiredEmailValidation = require("./modules/checkExpiredEmailValidation");
app.use(express.urlencoded({ extended: false }))

app.use((req, res, next) => {
  express.json()(req, res, next)
})

const options = {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['htm', 'html'],
  index: false,
  maxAge: '1d',
  redirect: false,
}
app.use(express.static('build', options))

app.get(`/${process.env.SECRET_PATH}*`, (req, res) => {
  res.sendFile(path.resolve(__dirname, 'build', 'index.html'))
})

app.get('/migrate-all-promotions', async (req, res) => {
  res.json({ success: true, operation: 'started' })
  try {
    await migrateCampaignsToContentful()
    await migratePromotionTiersToContentful()
    await migrateStandaloneVouchersToContentful()
  } catch (e) {
    console.log(e)
  }
  return
})

app.get('/migrate-all-products', async (req, res) => {
  res.json({ success: true, operation: 'started' })
  try {
    await migrateProductsToVoucherify()
  } catch (e) {
    console.log(e)
  }
  return
})

const PORT = process.env.PORT || 5555

const main = (async () => {
  app.listen(PORT, () => console.log(`Server started on port ${PORT}!`))
})()
