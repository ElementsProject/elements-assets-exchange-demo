create table d_order (
  txid bytea not null,
  vout smallint not null,
  blockhash bytea default null,
  partialtx bytea not null,
  _partialtx json not null,
  _prevout json not null,
  have_asset bytea not null, have_amount numeric(30,8) not null,
  want_asset bytea not null, want_amount numeric(30,8) not null,
  spend_txid bytea default null, spend_vin smallint default null,
  created_at timestamp not null default now(),
  updated_at timestamp default null,
  primary key(txid, vout)
);

create index idx_order_buy_rate on d_order((want_amount / have_amount));
create index idx_order_sell_rate on d_order((have_amount / want_amount));

create or replace view v_orderbook as
  select
    encode(txid, 'hex') || ':' || vout as id,
    encode(txid, 'hex') as txid,
    vout,
    encode(blockhash, 'hex') as blockhash,
    encode(partialtx, 'hex') as partialtx,
    encode(have_asset, 'hex') as have_asset, have_amount,
    encode(want_asset, 'hex') as want_asset, want_amount,
    encode(spend_txid, 'hex') as spend_txid, spend_vin,
    want_amount/have_amount as buy_rate, have_amount/want_amount as sell_rate,
    _partialtx, _prevout,
    created_at, updated_at
  from d_order
  order by coalesce(updated_at, created_at) desc
;
