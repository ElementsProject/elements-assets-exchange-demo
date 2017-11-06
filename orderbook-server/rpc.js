import iferr from 'iferr'
import bufferRev from 'buffer-reverse'

// https://github.com/ElementsProject/elements/issues/222
const fixAsset = asset => bufferRev(new Buffer(asset, 'hex').slice(1)).toString('hex')

module.exports = elements => {
  const

    getTx = (txid, cb) =>
      elements.getrawtransaction(txid, true, iferr(cb, r =>
        cb(null, r.result)))

  , decodeTx = (rawtx, cb) =>
      elements.decoderawtransaction(rawtx, iferr(cb, r =>
        cb(null, r.result)))

  , getOutput = ({ txid, vout }, cb) => // @XXX mempool optional?
      elements.gettxout(txid, vout, true, iferr(cb, r =>
        cb(null, r.result)))

  , watchAddress = (address, cb) =>
      elements.importaddress(address, 'orders', false, (err, r) =>
        (!err || err.message && err.message.indexOf('The wallet already contains') == 0)
          ? cb(null)
          : cb(err))

  , parseVerifyOrderTx = (rawtx, cb) =>
      decodeTx(rawtx, iferr(cb, tx => {
        if (tx.vin.length != 1 || tx.vout.length != 1) return cb(new Error('invalid input/output count'))
        const { vin: [vin] } = tx
        if (!~vin.scriptSig.asm.indexOf('[SINGLE|ANYONECANPAY]')) return cb(new Error('invalid sighash'))

        getOutput(vin, iferr(cb, prevOut => {
          if (!prevOut) return cb(new Error(`invalid input ${tx.txid}:0, prevOut ${vin.txid}:${vin.vout}`))
          if (!(prevOut.asset && prevOut.value)) return cb(new Error('blinding is currently unsupported'))
          /* @FIXME verify sig  */
          prevOut.asset = fixAsset(prevOut.asset)
          cb(null, { tx, prevOut, address: prevOut.scriptPubKey.addresses[0] }) // @XXX assumes address-able scripts
        }))
      }))

  return { getTx, watchAddress, parseVerifyOrderTx }
}
