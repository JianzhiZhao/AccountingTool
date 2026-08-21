alter table public.enabled_currencies
  add column default_exchange_rate_to_twd numeric(18, 8) not null default 1
  check (default_exchange_rate_to_twd > 0);

alter table public.enabled_currencies
  add constraint enabled_currencies_twd_default_rate_check
  check (code <> 'TWD' or default_exchange_rate_to_twd = 1);

update public.enabled_currencies
set default_exchange_rate_to_twd = 1
where code = 'TWD';
