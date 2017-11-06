import debug               from 'debug'
import { Observable as O } from 'rxjs'

const

  checkedItem = select => select.querySelector('option:checked')

, updateWhere = (xs, cond, map) => xs.map(x => cond(x) ? map(x) : x)
, upsert      = (xs, x, key='id') => [ x, ...xs.filter(c => c[key] !== x[key]) ]

, ticker = (s, val) => O.interval(s).startWith(-1).mapTo(val)

, combine = obj => {
    const keys = Object.keys(obj).map(k => k.replace(/\$$/, ''))
    return O.combineLatest(...Object.values(obj), (...xs) =>
      xs.reduce((o, x, i) => (o[keys[i]] = x, o), {}))
  }

, extractErrors = x$$ =>
    x$$.flatMap(x$ => x$.catch(err => O.of({ err })))
       .filter(x => x.err).pluck('err')

, dbg = (obj, label='stream', dbg=debug(label)) =>
    Object.keys(obj).forEach(k => obj[k] && obj[k].subscribe(
      x   => dbg(`${k} ->`, x),
      err => dbg(`${k} \x1b[91mError:\x1b[0m`, err.stack || err),
      _   => dbg(`${k} completed`)))

module.exports = { checkedItem, updateWhere, upsert, ticker, combine, extractErrors, dbg }
