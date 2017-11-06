import express from 'express'
import iferr   from 'iferr'

const labelsOverride = { '09f663de96be771f50cab5ded00256ffe63773e2eaa9a604092951cc3d7c6621': 'BTC' }

const elements = require('elementsd-rpc')(process.env.ELEMENTSD_URI)
    , book     = require('superagent-baseuri')(process.env.ORDERBOOK_URI)
    , app      = express()

const { createOrderTx, fulfillOrder } = require('./order-tx')(elements)
    , { newAddress, listUnspent, dumpAssetLabels, getTx } = require('./rpc')(elements)

// Settings
app.set('port', process.env.PORT || 8001)
app.set('host', process.env.HOST || 'localhost')
app.set('trust proxy', !!process.env.PROXIED)
app.set('url', process.env.URL || `http://localhost:${ app.get('port') }/`)
app.set('static_url', process.env.STATIC_URL || `http://localhost:${ app.get('port')  }/static/`)

// Middlewares
app.use(require('morgan')('dev'))
app.use(require('body-parser').json())

// Serve assets (@XXX pre-compile for dist?)
app.use('/static', (r => (
    r.get('/app.js', require('browserify-middleware')('./client/app.js'))
  , r.use(require('stylus').middleware({ src: './styl', serve: true  }))
  , r.use('/styl', express.static('./styl'))
  , r.use('/', express.static('./static'))
  , r
))(express.Router()))

// Serve index SPA
app.get('/', (req, res) => res.render(__dirname + '/index.pug'))

// List orders
app.get('/orders', (req, res, next) =>
  book.get('/', iferr(next, r => res.send(r.body))))

// New order
app.post('/order', (req, res, next) =>
  createOrderTx(req.body, iferr(next, tx =>
    book.post('/').type('json').send({ tx: tx })
      .end(iferr(next, r => res.send(r.body))))))

// Fulfill order
app.post('/order/:order', (req, res, next) =>
  book.get('/'+encodeURIComponent(req.params.order), iferr(next, r =>
    !r.ok ? res.sendStatus(404)
    : fulfillOrder(r.body, iferr(next, txid => res.send({ order: r.body.id, txid }))))))

// Get new address
app.post('/address', (req, res, next) =>
  newAddress(iferr(next, addr => res.send(addr))))

// List own unspent outputs
app.get('/unspent', (req, res, next) =>
  listUnspent(req.query.min||0, req.query.max||9999999, null, true, req.query.asset
            , iferr(next, utxos => res.send(utxos))))

// Get asset labels
app.get('/labels', (req, res, next) =>
  dumpAssetLabels(iferr(next, labels => res.send({ ...labels, ...labelsOverride }))))

// Mini tx explorer, just to have something to link txs to
app.get('/tx/:txid', (req, res, next) =>
  getTx(req.params.txid, iferr(next, tx =>
    res.type('txt').send(JSON.stringify(tx, null, 2)))))

// Error handler @XXX hide internal errors from users
app.use((err, req, res, next) => {
  console.error('error', err)
  res.status(500).send(err.response && (err.response.text || err.response.body) || err.message || err)
})

// All ready, go!
app.listen(app.settings.port, app.settings.host, _ =>
  console.log(`HTTP server running on ${ app.settings.host }:${ app.settings.port }`))
