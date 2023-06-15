//app modules
const express = require('express')
const app = express()
const dotenv = require('dotenv')
const path = require('path')
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

const PORT = process.env.PORT || 5555

const main = (async () => {
  app.listen(PORT, () => console.log(`Server started on port ${PORT}!`))
})()
