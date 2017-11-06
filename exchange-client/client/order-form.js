import { Observable as O } from 'rxjs'
import { dbg, combine }    from './util'

const parseNum = n => n == '' ? '' : +parseFloat(n).toFixed(8)

export default function OrderForm({ DOM, utxos$, orders$, labels$ }) {
  const // @XXX DRY
    input = name => DOM.select(`[name=${name}]`).events('input').map(e => e.target.value).startWith(undefined)

  , inputAll = name => input(name)
      .merge(DOM.select(`[name=${name}]`).elements().filter(x => x.length).map(x => x[0].value))
      .distinctUntilChanged()

  , utxo$  = O.combineLatest(inputAll('utxo'), utxos$, (id, utxos) => utxos.find(u => u.id == id) || {}).distinctUntilKeyChanged('id')
  , asset$ = inputAll('asset')

  // bind amount<->rate<->total  @XXX unsafe math, use bigint library
  , rate$  = input('rate') // updates when total changes, remains static when amount changes
      .merge(input('total').withLatestFrom(utxo$, (total, utxo) => parseNum(+total / utxo.amount)))
      .merge(utxo$.distinctUntilKeyChanged('asset').mapTo('')) // reset rate when utxo asset type changes

  , total$ = input('total') // updates when either the rate or amount changes
      .merge(input('rate').withLatestFrom(utxo$, (rate, utxo) => parseNum(rate * utxo.amount)))
      .merge(utxo$.withLatestFrom(rate$,         (utxo, rate) => parseNum(rate * utxo.amount)))

  , vdom$  = view(combine({ utxos$, orders$, labels$, utxo$, rate$, asset$, total$ }))

  , order$ = DOM.select('form').events('submit').withLatestFrom(utxo$, asset$, total$.map(parseNum)
    , (_, utxo, want_asset, want_amount) => ({ utxo: utxo.id, want_asset, want_amount }))

  dbg({ utxo$, rate$, asset$, total$, order$ }, 'order-form')

  return { vdom$, makeOrder$: order$ }
}

import { form, div, span, h2, input, optgroup, select, option, button, p, label } from '@cycle/dom'

const
  formatAsset = (asset, labels) => labels[asset] || asset.substr(0, 16)
, formatNum   = require('format-number')({ round: 8 })
, groupUtxos  = utxos => utxos.reduce((o, c) => ((o[c.asset]=o[c.asset]||[]).push(c), o), {})

, view = state$ => state$.map(({ utxos, orders, labels, utxo, rate, asset, total }) => form([
    h2('Place order')

  , div('.form-group', div('.input-group.input-group-lg', [
      span('.input-group-addon', 'Sell:')
    , outputSelection(groupUtxos(utxos), utxo.id, { orders, labels })
    , span('.input-group-btn', button('.btn.btn-default.deposit', { attrs: { type: 'button'  } }, span('.glyphicon.glyphicon-plus-sign')))
    ]))

  , !total && false ? null: div('.form-group', [
      div('.input-group.input-group-lg', [
        span('.input-group-addon', 'For:')
      , input('.form-control', { attrs: { type: 'number', name: 'total', step: 0.00000001 }, props: { value: total } })
      , span('.input-group-addon', assetSelection(labels, asset, utxo.asset))
      ])
    ])

  , div('.form-group', div('.input-group.input-group-lg', [
      span('.input-group-addon', 'Rate:')
    , input('.form-control', { attrs: { name: 'rate', type: 'number', required: true, step: 0.00000001 }, props: { value: rate }})
    , div('.input-group-addon', asset && formatAsset(asset, labels))
    ]))

  , button('.btn.btn-primary.btn-lg', { attrs: { type: 'submit' } }, 'Place order')
  ]))

, assetSelection = (labels, selected, exclude) =>
    select({ attrs: { name: 'asset', required: true } }, Object.keys(labels)
      .filter(k => k != exclude)
      .map(k => option({ attrs: { value: k, selected: (selected === k) } }, labels[k])))

, outputSelection = (groups, selected, { labels, orders }) =>
    select('.form-control', { attrs: { name: 'utxo', required: true } }, [
      ...Object.keys(groups).map(asset =>
        optgroup({ attrs: { label: formatAsset(asset, labels) } }
               , groups[asset].map(c => option({ attrs: { value: c.id, 'data-asset': c.asset
                                                        , class:(orders.some(o => o.id == c.id) && 'bg-warning') } }
                                             , `${ formatNum(c.amount) } ${ formatAsset(c.asset, labels) }`)))
    ) ])
