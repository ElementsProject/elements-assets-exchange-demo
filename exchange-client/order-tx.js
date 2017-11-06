import iferr from 'iferr'

module.exports = elements => {
  const { newAddress, listUnspent, createTx, signTx, broadcastTx, mutateTx, sendTo } = require('./rpc')(elements)

  , parsePrevOut = id => ((p=id.split(':')) => ({ txid: p[0], vout: +p[1] }))()

  , createOrderTx = ({ utxo, want_asset, want_amount }, cb) =>
      newAddress(iferr(cb, addr =>
        createTx([ parsePrevOut(utxo) ], { [addr]: want_amount }, 0, { [addr]: want_asset }, iferr(cb, tx =>
          signTx(tx, 'SINGLE|ANYONECANPAY', cb)))))

  , findUtxo = (asset, amount, cb) =>
      listUnspent(undefined, undefined, null, true, asset, iferr(cb, utxos =>
        cb(null, utxos.filter(o => o.amount === amount)[0])))

  , makeUtxo = (asset, amount, cb) =>
      newAddress(iferr(cb, addr =>
        sendTo(addr, asset, amount, iferr(cb, tx =>
          findUtxo(asset, amount, cb))))) // @XXX could figure this out from `tx` directly

  , getSizedUtxo = (asset, amount, cb) =>
      findUtxo(asset, amount, iferr(cb, utxo =>
        utxo ? cb(null, utxo) : makeUtxo(asset, amount, cb)))

  , completeTx = (partialtx, utxo, addr, recv_asset, recv_amount, cb) =>
      mutateTx(partialtx, [ [ 'in', utxo.txid, utxo.vout ]
                          , [ 'outaddr', recv_amount, addr, recv_asset ] ]
      , cb)

  , fulfillOrder = (order, cb) =>
      makeUtxo(order.want_asset, +order.want_amount, iferr(cb, utxo =>
        !utxo ? cb(new Error('no matching output'))
        : newAddress(iferr(cb, addr =>
            completeTx(order.partialtx, utxo, addr, order.have_asset, order.have_amount, iferr(cb, tx =>
              signTx(tx, 'ALL', iferr(cb, signedTx =>
                broadcastTx(signedTx, cb)))))))))

  return { createOrderTx, fulfillOrder }
}
