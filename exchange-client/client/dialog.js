import { Observable as O } from 'rxjs'
import qruri from 'qruri'

const makeQR = addr => qruri('bitcoin:'+addr, { margin: 3, modulesize: 7 })

module.exports = S => O.merge(
  S.myAddr$.map(showAddress)
, S.myOrder$.map(orderPlaced)
, S.fulfilled$.map(orderFulfilled)
, S.error$.map(showError))

const
  showAddress = addr => ({
    method: 'alert'
  , unsafeMessage: `<img src="${ makeQR(addr) }"><p>${ addr }</p>`
  , className: 'vex-theme-default deposit-dialog'
  })

, orderFulfilled = ({ txid }) => ({
    method: 'alert'
  , message: `Trade completed succesfully in tx ${ txid }`
  , className: 'vex-theme-default fulfill-dialog'
  })

, orderPlaced = o => ({
    method: 'alert'
  , message: `Order ${ [ o.txid.substr(0, 7), o.vout ].join(':') } placed succesfully!`
  , className: 'vex-theme-default fulfill-dialog'
  })

, showError = err => ({
    method: 'alert'
  , message: err.response && (err.response.text || err.response.body) || err.message || err
  , className: 'vex-theme-default fulfill-dialog'
  })
