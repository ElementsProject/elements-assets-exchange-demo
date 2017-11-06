import { execFile } from 'child_process'
import iferr from 'iferr'

const [ txExe, ...txArgs ] = (process.env.TX_CLI||'').split(' ') // optional if you don't need mutateTx()

module.exports = elements => {
  // Thin wrappers around the Elements RPC functionality, for a more fluent API
  const

    watchAddress = (address, cb) =>
      elements.importaddress(address, 'orders', false, (err, r) =>
        (!err || err.message && err.message.indexOf('The wallet already contains') == 0)
          ? cb(null)
          : cb(err))

  , newAddress = cb => // unconfidential
      elements.getnewaddress(iferr(cb, r =>
        elements.validateaddress(r.result, iferr(cb, r =>
          cb(null, r.result.unconfidential)))))

  , listUnspent = (min=0, max=9999999, addresses, unsafe, asset, cb) =>
      elements.listunspent(min, max, addresses, unsafe, asset, iferr(cb, r =>
        cb(null, formatOutputs(r.result))))

  , getTx = (txid, cb) =>
      elements.getrawtransaction(txid, true, iferr(cb, r =>
        cb(null, r.result)))

  , decodeTx = (rawtx, cb) =>
      elements.decoderawtransaction(rawtx, iferr(cb, r =>
        cb(null, r.result)))

  , createTx = (inputs, outputs, locktime, assets, cb) =>
      elements.createrawtransaction(inputs, outputs, locktime, assets, iferr(cb, r =>
        cb(null, r.result)))

  , signTx = (tx, sighash, cb) =>
      elements.signrawtransaction(tx, null, null, sighash
      , iferr(cb, r => cb(null, r.result.hex)))

  , broadcastTx = (tx, cb) =>
      elements.sendrawtransaction(tx, iferr(cb, r =>
        cb(null, r.result)))

  , sendTo = (addr, asset, amount, cb) =>
      elements.sendtoaddress(addr, amount, '', '', false, asset, iferr(cb, r =>
        cb(null, r.result)))

  , mutateTx = (tx, ops, cb) =>
      execFile(txExe, [ ...txArgs, tx, ...ops.map(x => x[0] + '=' + x.slice(1).join(':')) ]
      , iferr(cb, (stdout, stderr) => stderr ? cb(''+stderr) : cb(null, ''+stdout.replace(/\n$/m, ''))))

  , getOutput = ({ txid, vout }, cb) => // @XXX mempool optional?
      elements.gettxout(txid, vout, true, iferr(cb, r =>
        cb(null, r.result)))

  , dumpAssetLabels = cb => // reversed to { asset_id: asset_name }
      elements.dumpassetlabels(iferr(cb, ({ result }) =>
        cb(null, Object.keys(result).reduce((o, k) => (o[result[k]] = k, o), {}))))

  return { watchAddress, newAddress, listUnspent
         , getTx, decodeTx, createTx, signTx, broadcastTx
         , sendTo, mutateTx, getOutput, dumpAssetLabels }
}

const formatOutputs = outs => outs
  .filter(o => !o.amountcommitment) // @XXX blinded outputs are currently ignored
  .map(o => ({ id: o.txid+':'+o.vout, txid: o.txid, vout: o.vout, asset: o.asset, amount: o.amount }))
