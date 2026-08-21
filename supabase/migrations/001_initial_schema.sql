create extension if not exists pgcrypto;

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_currency text not null default 'TWD' check (base_currency = 'TWD'),
  timezone text not null default 'Asia/Taipei',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.enabled_currencies (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null check (code ~ '^[A-Z]{3}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, code),
  constraint twd_must_remain_active check (code <> 'TWD' or is_active)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index categories_user_name_unique on public.categories(user_id, lower(trim(name)));

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null check (char_length(trim(item_name)) between 1 and 100),
  expense_date date not null,
  amount numeric(18, 4) not null check (amount > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  category_id uuid not null,
  note text not null default '' check (char_length(trim(note)) <= 500),
  exchange_rate_to_twd numeric(18, 8) not null check (exchange_rate_to_twd > 0),
  amount_twd numeric(26, 8) generated always as (amount * exchange_rate_to_twd) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expenses_twd_rate_check check (currency_code <> 'TWD' or exchange_rate_to_twd = 1),
  foreign key (category_id, user_id) references public.categories(id, user_id) on delete restrict,
  foreign key (user_id, currency_code) references public.enabled_currencies(user_id, code) on delete restrict
);
create index expenses_user_date_idx on public.expenses(user_id, expense_date desc, created_at desc);
create index expenses_user_category_idx on public.expenses(user_id, category_id);
create index expenses_user_currency_idx on public.expenses(user_id, currency_code);

create table public.favorite_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null check (char_length(trim(item_name)) between 1 and 100),
  default_amount numeric(18, 4) not null check (default_amount > 0),
  currency_code text not null check (currency_code ~ '^[A-Z]{3}$'),
  category_id uuid not null,
  note text not null default '' check (char_length(trim(note)) <= 500),
  default_exchange_rate_to_twd numeric(18, 8) not null check (default_exchange_rate_to_twd > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint favorites_twd_rate_check check (currency_code <> 'TWD' or default_exchange_rate_to_twd = 1),
  foreign key (category_id, user_id) references public.categories(id, user_id) on delete restrict,
  foreign key (user_id, currency_code) references public.enabled_currencies(user_id, code) on delete restrict
);
create index favorite_templates_user_sort_idx on public.favorite_templates(user_id, sort_order, created_at);
create unique index favorite_templates_user_item_unique on public.favorite_templates(user_id, lower(trim(item_name)));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger user_settings_updated before update on public.user_settings for each row execute function public.set_updated_at();
create trigger enabled_currencies_updated before update on public.enabled_currencies for each row execute function public.set_updated_at();
create trigger categories_updated before update on public.categories for each row execute function public.set_updated_at();
create trigger expenses_updated before update on public.expenses for each row execute function public.set_updated_at();
create trigger favorite_templates_updated before update on public.favorite_templates for each row execute function public.set_updated_at();

create or replace function public.bootstrap_private_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_settings (user_id) values (new.id) on conflict do nothing;
  insert into public.enabled_currencies (user_id, code) values (new.id, 'TWD') on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.bootstrap_private_user();

insert into public.user_settings (user_id) select id from auth.users on conflict do nothing;
insert into public.enabled_currencies (user_id, code) select id, 'TWD' from auth.users on conflict do nothing;

alter table public.user_settings enable row level security;
alter table public.enabled_currencies enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.favorite_templates enable row level security;

create policy "own user settings" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own enabled currencies" on public.enabled_currencies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own categories" on public.categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own expenses" on public.expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own favorite templates" on public.favorite_templates for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.user_settings, public.enabled_currencies, public.categories, public.expenses, public.favorite_templates from anon;
grant select, insert, update, delete on public.user_settings, public.enabled_currencies, public.categories, public.expenses, public.favorite_templates to authenticated;
