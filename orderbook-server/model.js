import iferr from 'iferr'

const toBuff = x => new Buffer(x, 'hex')

module.exports = db => ({
  listOrders: cb => db('v_orderbook').select('*').asCallback(cb)

, findOrder: (id, cb) =>
    db('v_orderbook').where({ id })
      .first().asCallback(cb)

, closeSpentOrders: (tx, cb) =>
    Promise.all(tx.vin.map((vin, i) => !vin.coinbase && // skip coinbase inputs
      db('d_order').where({ txid: toBuff(vin.txid), vout: vin.vout })
                   .update({ spend_txid: toBuff(tx.txid), spend_vin: i })
    )).then(_ => cb(null)).catch(cb)

, saveOrder: (rawtx, tx, prevOut, cb) => {
    // destruct first (and only) in/out
    const { vin: [vin], vout: [vout] } = tx

    const insert = db('d_order').insert({
      txid:        toBuff(vin.txid)
    , vout:        vin.vout
    , blockhash:   toBuff(prevOut.bestblock)
    , partialtx:   toBuff(rawtx)
    , have_asset:  toBuff(prevOut.asset)
    , have_amount: prevOut.value
    , want_asset:  toBuff(vout.asset)
    , want_amount: vout.value
    , _partialtx:  tx
    , _prevout:    prevOut
    })

    // wrap the insert query as an upsert
    // @XXX should users be able to update orders for existing utxos?
    const upsert = db.raw(`
      ? ON CONFLICT (txid, vout)
      DO UPDATE SET blockhash=EXCLUDED.blockhash, partialtx=EXCLUDED.partialtx
                  , want_asset=EXCLUDED.want_asset, want_amount=EXCLUDED.want_amount
                  , _partialtx=EXCLUDED._partialtx, _prevout=EXCLUDED._prevout
                  , updated_at=now()
      RETURNING encode(txid, 'hex') || ':' || vout as id
    `, [ insert ])

    // save and re-read from v_orderbook, to get additional fields and proper formatting
    upsert.asCallback(iferr(cb, r =>
      db('v_orderbook').where({ id: r.rows[0].id })
        .first().asCallback(cb)))
  }
})
