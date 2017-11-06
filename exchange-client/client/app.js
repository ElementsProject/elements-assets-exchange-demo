import { Observable as O } from 'rxjs'
import { makeDOMDriver }   from '@cycle/dom'
import { makeHTTPDriver }  from '@cycle/http'
import run                 from '@cycle/rxjs-run'
import makeVexDriver       from 'cycle-vex-driver'
import serialize           from 'form-serialize'

import { dbg, combine, extractErrors, checkedItem, ticker, updateWhere, upsert } from './util'
import view   from './view'
import dialog from './dialog'

import OrderForm from './order-form'

function main({ DOM, HTTP }) {
  const

    reply = category => HTTP.select(category).flatMap(r$ => r$.catch(_ => O.empty())) // drop errors
  , dom   = (el, ev) => DOM.select(el).events(ev)

  // Intent
  , fulfill$   = dom('.fulfill', 'click').map(e => e.target.dataset.order)
  , newAddr$   = dom('.deposit', 'click')

  // State
  , utxos$     = reply('unspent').map(r => r.body)
  , labels$    = reply('labels').map(r => r.body)
  , myAddr$    = reply('newAddr').map(r => r.text)
  , myOrder$   = reply('makeOrder').map(r => r.body)
  , fulfilled$ = reply('fulfill').map(r => r.body)
  , error$     = extractErrors(HTTP.select())
  , orders$    = O.merge(
      reply('orders')   .map(r => _  => r.body)
    , reply('makeOrder').map(r => xs => upsert(xs, r.body))
    , reply('fulfill')  .map(r => xs => updateWhere(xs, x => x.id == r.body.order
                                                     , x => ({ ...x, spend_txid: r.body.txid }))) // @XXX spend_vin is missing
    ).startWith([]).scan((S, mod) => mod(S))

  // Components
  , { vdom$: formDom$, makeOrder$ } = OrderForm({ DOM: DOM.select('.make-order'), utxos$, orders$, labels$ })
  //, { vdom$: listDom$, fulfill$ }   = OrderList({ DOM: DOM.select('.orders'), labels$, utxos$, orders$ })

  // Sinks
  , vdom$    = view(combine({ utxos$, orders$, labels$, formDom$ }))
  , dialog$  = dialog({ myAddr$, fulfilled$, myOrder$, error$  })
  , request$ = O.merge(
      makeOrder$.map(o => ({ category: 'makeOrder', method: 'POST', url: 'order', send: o }))
    , fulfill$.map(id =>  ({ category: 'fulfill',   method: 'POST', url: 'order/'+id }))
    , newAddr$.mapTo(      { category: 'newAddr',   method: 'POST', url: 'address' })
    , ticker(5000,         { category: 'unspent',   method: 'GET',  url: 'unspent' })
    , ticker(5000,         { category: 'orders',    method: 'GET',  url: 'orders' })
    , O.of(                { category: 'labels',    method: 'GET',  url: 'labels' }))

  dom('form', 'submit').subscribe(e => e.preventDefault())

  dbg({ utxos$, orders$, request$, dialog$, error$, labels$, makeOrder$
      , reply$: reply().map(r => [ r.request.category, r.req.method, r.req.url, r.body||r.text, r ]) })

  return { DOM: vdom$, HTTP: request$, dialog: dialog$ }
}

run(main, { DOM: makeDOMDriver('#app'), HTTP: makeHTTPDriver(), dialog: makeVexDriver() })
