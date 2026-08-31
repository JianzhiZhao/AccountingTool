do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'enabled_currencies_default_rate_positive'
      and conrelid = 'public.enabled_currencies'::regclass
  ) then
    alter table public.enabled_currencies
      add constraint enabled_currencies_default_rate_positive
      check (default_exchange_rate_to_twd > 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'enabled_currencies_twd_default_rate_check'
      and conrelid = 'public.enabled_currencies'::regclass
  ) then
    alter table public.enabled_currencies
      add constraint enabled_currencies_twd_default_rate_check
      check (code <> 'TWD' or default_exchange_rate_to_twd = 1);
  end if;
end;
$$;

update public.enabled_currencies
set default_exchange_rate_to_twd = 1
where code = 'TWD';

alter table public.categories
  add column sort_order integer not null default 0;

alter table public.tags
  add column sort_order integer not null default 0;

with ranked as (
  select id, (row_number() over (
    partition by user_id order by is_active desc, lower(trim(name)), created_at
  ) - 1)::integer as position
  from public.categories
)
update public.categories
set sort_order = ranked.position
from ranked
where public.categories.id = ranked.id;

with ranked as (
  select id, (row_number() over (
    partition by user_id order by lower(trim(name)), created_at
  ) - 1)::integer as position
  from public.tags
)
update public.tags
set sort_order = ranked.position
from ranked
where public.tags.id = ranked.id;

create index categories_user_sort_idx
  on public.categories(user_id, sort_order, name);

create index tags_user_sort_idx
  on public.tags(user_id, sort_order, name);
