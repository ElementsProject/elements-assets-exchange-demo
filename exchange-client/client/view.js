import { div, p, h2, table, thead, tr, td, tbody, select, option, button, optgroup, label, span, input, form, img, a } from '@cycle/dom'

const
  formatNum   = require('format-number')({ round: 5 })
, formatAsset = (asset, labels) => labels[asset] || asset.substr(0, 16)
, txLink      = txid => a({ attrs:{ href: 'tx/'+txid } }, txid.substr(0, 7))

module.exports = state$ => state$.map(({ utxos, orders, labels, formDom }) => div('.row', [
  div('.make-order.col-md-4', formDom)
, div('.orders.col-md-8', [
    h2('Order book')
  , !orders.length ? p('No orders') : table('.table.orders', [
      thead(tr([ td('ID'), td('Sell'), td('For'), td('Rate') ]))
    , tbody(orders.map(orderItem({ labels, utxos })))
    ])
  ])
]))

const orderItem = ({ labels, utxos }) => o => {
  const haveAsset = formatAsset(o.have_asset, labels)
      , wantAsset = formatAsset(o.want_asset, labels)
      , isOwn     = utxos.some(utxo => utxo.id == o.id)
      , isSpent   = !!o.spend_txid
      , classes   = [ isSpent && 'bg-danger' || isOwn && 'bg-warning' ]

  return tr({ attrs: { class: classes } }, [
    td([ o.txid.substr(0, 7), o.vout ].join(':'))
  , td([ formatNum(o.have_amount), haveAsset ].join(' '))
  , td([ formatNum(o.want_amount), wantAsset ].join(' '))
  , td([ p(`${formatNum(o.buy_rate)} ${wantAsset}/${haveAsset}`)
       , p(`${formatNum(o.sell_rate)} ${haveAsset}/${wantAsset}`) ])
  , isSpent ? td('.text-danger', [ 'Spent by ', txLink(o.spend_txid) ])
    : isOwn ? td('.text-info', 'Placed by you')
    : td(button('.fulfill.btn.btn-default.btn-lg', { attrs: { type: 'button', 'data-order': o.id } }, 'Fulfill'))
  ])
}
