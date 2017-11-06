import iferr from 'iferr'

const notifyToken = process.env.WALLETNOTIFY_TOKEN

const db       = require('knex')({ client: 'pg', connection: process.env.DATABASE_URI })
    , elements = require('elementsd-rpc')(process.env.ELEMENTSD_URI)
    , app      = require('express')()

const { listOrders, findOrder, saveOrder, closeSpentOrders } = require('./model')(db)
    , { getTx, watchAddress, parseVerifyOrderTx } = require('./rpc')(elements)

// Settings
app.set('port', process.env.PORT || 8009)
app.set('host', process.env.HOST || 'localhost')
app.set('trust proxy', !!process.env.PROXIED)

// Middlewares
app.use(require('morgan')('dev'))
app.use(require('body-parser').json())
app.use(require('body-parser').urlencoded({ extended: false }))

// List orders
app.get('/', (req, res, next) =>
  listOrders(iferr(next, orders =>
    res.send(orders))))

// Fetch order
app.get('/:order', (req, res, next) =>
  findOrder(req.params.order, iferr(next, order =>
    order ? res.send(order) : res.sendStatus(404))))

// New order
app.post('/', (req, res, next) =>
  parseVerifyOrderTx(req.body.tx, iferr(next, ({ tx, prevOut, address }) =>
    saveOrder(req.body.tx, tx, prevOut, iferr(next, order =>
      watchAddress(address, iferr(next, _ =>
        res.send(order))))))))

// Close spent orders
app.post('/walletnotify/'+notifyToken, (req, res, next) =>
  getTx(req.body.txid, iferr(next, tx =>
    closeSpentOrders(tx, iferr(next, _ =>
      res.sendStatus(204))))))

// Error handler @XXX hide internal errors from users
app.use((err, req, res, next) => {
  console.error('error', err)
  res.status(500).send(err.response && (err.response.text || err.response.body) || err.message || err)
})

app.listen(app.settings.port, app.settings.host, _ =>
  console.log(`HTTP server running on ${ app.settings.host }:${ app.settings.port }`))
