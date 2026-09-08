begin;

alter table public.expenses
  add column expense_type text not null default 'general',
  add column parent_expense_id uuid,
  add column amortization_unit text,
  add column amortization_periods integer,
  add column amortization_start_date date,
  add column amortization_sequence integer;

alter table public.expenses
  add constraint expenses_type_check check (expense_type in ('general', 'prepaid', 'amortized')),
  add constraint expenses_amortization_unit_check check (amortization_unit in ('month', 'day') or amortization_unit is null),
  add constraint expenses_amortization_shape_check check (
    (expense_type = 'general' and parent_expense_id is null and amortization_unit is null and amortization_periods is null and amortization_start_date is null and amortization_sequence is null)
    or (expense_type = 'prepaid' and parent_expense_id is null and amortization_unit is not null and amortization_periods is not null and amortization_start_date is not null and amortization_sequence is null)
    or (expense_type = 'amortized' and parent_expense_id is not null and amortization_unit is null and amortization_periods is null and amortization_start_date is null and amortization_sequence is not null)
  ),
  add constraint expenses_prepaid_periods_check check (
    expense_type <> 'prepaid'
    or (amortization_unit = 'month' and amortization_periods between 1 and 120)
    or (amortization_unit = 'day' and amortization_periods between 1 and 366)
  ),
  add constraint expenses_prepaid_start_check check (expense_type <> 'prepaid' or amortization_start_date >= expense_date),
  add constraint expenses_prepaid_integer_amount_check check (expense_type <> 'prepaid' or amount = trunc(amount)),
  add constraint expenses_prepaid_positive_installments_check check (expense_type <> 'prepaid' or amortization_periods <= amount),
  add constraint expenses_parent_user_fk foreign key (parent_expense_id, user_id) references public.expenses(id, user_id) on delete cascade;

create index expenses_user_type_date_idx on public.expenses(user_id, expense_type, expense_date desc);
create index expenses_parent_idx on public.expenses(parent_expense_id, amortization_sequence);
create unique index expenses_parent_sequence_unique on public.expenses(parent_expense_id, amortization_sequence) where parent_expense_id is not null;

create or replace function public.amortization_date(p_start_date date, p_unit text, p_sequence integer)
returns date
language plpgsql
immutable
set search_path = public
as $$
declare
  v_month_start date;
  v_target_last date;
  v_start_last date;
  v_target_day integer;
begin
  if p_sequence < 1 or p_unit not in ('month', 'day') then raise exception 'Invalid amortization date input'; end if;
  if p_unit = 'day' then return p_start_date + (p_sequence - 1); end if;
  v_month_start := (date_trunc('month', p_start_date)::date + make_interval(months => p_sequence - 1))::date;
  v_target_last := (v_month_start + interval '1 month - 1 day')::date;
  v_start_last := (date_trunc('month', p_start_date)::date + interval '1 month - 1 day')::date;
  if p_start_date = v_start_last then return v_target_last; end if;
  v_target_day := least(extract(day from p_start_date)::integer, extract(day from v_target_last)::integer);
  return v_month_start + (v_target_day - 1);
end;
$$;

create or replace function public.amortization_amount(p_total numeric, p_periods integer, p_sequence integer)
returns numeric
language plpgsql
immutable
set search_path = public
as $$
declare
  v_regular_amount numeric;
begin
  if p_total <= 0 or p_periods < 1 or p_sequence < 1 or p_sequence > p_periods then raise exception 'Invalid amortization amount input'; end if;
  if p_total <> trunc(p_total) then raise exception 'Prepaid total must be an integer'; end if;
  v_regular_amount := trunc(p_total / p_periods);
  if v_regular_amount < 1 then raise exception 'Installment amount must be positive'; end if;
  if p_sequence = p_periods then return p_total - v_regular_amount * (p_periods - 1); end if;
  return v_regular_amount;
end;
$$;

create or replace function public.validate_expense_amortization()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parent public.expenses%rowtype;
begin
  if new.expense_type = 'general' then
    if new.parent_expense_id is not null or new.amortization_unit is not null or new.amortization_periods is not null or new.amortization_start_date is not null or new.amortization_sequence is not null then raise exception 'General expenses cannot contain amortization data'; end if;
  elsif new.expense_type = 'prepaid' then
    perform public.amortization_amount(new.amount, new.amortization_periods, 1);
  elsif new.expense_type = 'amortized' then
    select * into v_parent from public.expenses where id = new.parent_expense_id and user_id = new.user_id and expense_type = 'prepaid';
    if not found then raise exception 'Amortized expense must reference an owned prepaid expense'; end if;
    if new.item_name <> v_parent.item_name or new.currency_code <> v_parent.currency_code or new.category_id <> v_parent.category_id or new.note <> v_parent.note or new.exchange_rate_to_twd <> v_parent.exchange_rate_to_twd then raise exception 'Amortized expense must inherit parent fields'; end if;
    if new.amortization_sequence > v_parent.amortization_periods then raise exception 'Amortization sequence exceeds parent periods'; end if;
    if new.expense_date <> public.amortization_date(v_parent.amortization_start_date, v_parent.amortization_unit, new.amortization_sequence) then raise exception 'Amortization date does not match parent schedule'; end if;
    if new.amount <> public.amortization_amount(v_parent.amount, v_parent.amortization_periods, new.amortization_sequence) then raise exception 'Amortization amount does not match parent schedule'; end if;
  end if;
  return new;
end;
$$;

create trigger expenses_validate_amortization before insert or update on public.expenses
for each row execute function public.validate_expense_amortization();

create or replace function public.prevent_locked_expense_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.expense_type <> 'general' or new.expense_type <> 'general' then raise exception 'Prepaid and amortized expenses are immutable'; end if;
  return new;
end;
$$;

create trigger expenses_prevent_locked_update before update on public.expenses
for each row execute function public.prevent_locked_expense_update();

drop policy "own expenses" on public.expenses;
create policy "select own expenses" on public.expenses for select using (auth.uid() = user_id);
create policy "insert own general expenses" on public.expenses for insert with check (auth.uid() = user_id and expense_type = 'general');
create policy "update own general expenses" on public.expenses for update using (auth.uid() = user_id and expense_type = 'general') with check (auth.uid() = user_id and expense_type = 'general');
create policy "delete own general or prepaid expenses" on public.expenses for delete using (auth.uid() = user_id and expense_type in ('general', 'prepaid'));

drop policy "own expense tags" on public.expense_tags;
create policy "select own expense tags" on public.expense_tags for select using (auth.uid() = user_id);
create policy "insert tags on own general expenses" on public.expense_tags for insert with check (
  auth.uid() = user_id and exists (select 1 from public.expenses where id = expense_id and user_id = auth.uid() and expense_type = 'general')
);
create policy "delete tags on own general expenses" on public.expense_tags for delete using (
  auth.uid() = user_id and exists (select 1 from public.expenses where id = expense_id and user_id = auth.uid() and expense_type = 'general')
);

create or replace function public.create_prepaid_expense(
  p_item_name text,
  p_expense_date date,
  p_amount numeric,
  p_currency_code text,
  p_category_id uuid,
  p_note text,
  p_exchange_rate_to_twd numeric,
  p_tag_ids uuid[],
  p_amortization_unit text,
  p_amortization_periods integer,
  p_amortization_start_date date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_parent_id uuid;
  v_child_id uuid;
  v_sequence integer;
  v_tag_id uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.categories where id = p_category_id and user_id = v_uid) then raise exception 'Invalid category'; end if;
  if not exists (select 1 from public.enabled_currencies where user_id = v_uid and code = p_currency_code) then raise exception 'Invalid currency'; end if;
  if exists (select 1 from unnest(coalesce(p_tag_ids, '{}'::uuid[])) tag_id where not exists (select 1 from public.tags where id = tag_id and user_id = v_uid)) then raise exception 'Invalid tag'; end if;
  perform public.amortization_amount(p_amount, p_amortization_periods, 1);

  insert into public.expenses (user_id,item_name,expense_date,amount,currency_code,category_id,note,exchange_rate_to_twd,expense_type,amortization_unit,amortization_periods,amortization_start_date)
  values (v_uid,trim(p_item_name),p_expense_date,p_amount,p_currency_code,p_category_id,trim(p_note),p_exchange_rate_to_twd,'prepaid',p_amortization_unit,p_amortization_periods,p_amortization_start_date)
  returning id into v_parent_id;

  foreach v_tag_id in array coalesce(p_tag_ids, '{}'::uuid[]) loop
    insert into public.expense_tags (expense_id,tag_id,user_id) values (v_parent_id,v_tag_id,v_uid) on conflict do nothing;
  end loop;

  for v_sequence in 1..p_amortization_periods loop
    insert into public.expenses (user_id,item_name,expense_date,amount,currency_code,category_id,note,exchange_rate_to_twd,expense_type,parent_expense_id,amortization_sequence)
    values (v_uid,trim(p_item_name),public.amortization_date(p_amortization_start_date,p_amortization_unit,v_sequence),public.amortization_amount(p_amount,p_amortization_periods,v_sequence),p_currency_code,p_category_id,trim(p_note),p_exchange_rate_to_twd,'amortized',v_parent_id,v_sequence)
    returning id into v_child_id;
    foreach v_tag_id in array coalesce(p_tag_ids, '{}'::uuid[]) loop
      insert into public.expense_tags (expense_id,tag_id,user_id) values (v_child_id,v_tag_id,v_uid) on conflict do nothing;
    end loop;
  end loop;
  return v_parent_id;
end;
$$;

create or replace function public.import_prepaid_expense_group(p_rows jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_parent jsonb;
  v_row jsonb;
  v_parent_id uuid;
  v_tag_id uuid;
  v_parent_tags uuid[];
  v_row_tags uuid[];
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) < 2 then raise exception 'A prepaid import group must contain a parent and installments'; end if;
  select value into v_parent from jsonb_array_elements(p_rows) where value->>'expense_type' = 'prepaid';
  if v_parent is null or (select count(*) from jsonb_array_elements(p_rows) where value->>'expense_type' = 'prepaid') <> 1 then raise exception 'Exactly one prepaid parent is required'; end if;
  v_parent_id := (v_parent->>'id')::uuid;
  if exists (select 1 from public.expenses e join jsonb_array_elements(p_rows) r on e.id = (r.value->>'id')::uuid) then raise exception 'Imported expense ID already exists'; end if;
  if not exists (select 1 from public.categories where id = (v_parent->>'category_id')::uuid and user_id = v_uid) then raise exception 'Invalid imported category'; end if;
  if not exists (select 1 from public.enabled_currencies where user_id = v_uid and code = v_parent->>'currency_code') then raise exception 'Invalid imported currency'; end if;
  select coalesce(array_agg(value::uuid order by value), '{}'::uuid[]) into v_parent_tags from jsonb_array_elements_text(coalesce(v_parent->'tag_ids', '[]'::jsonb));

  insert into public.expenses (id,user_id,item_name,expense_date,amount,currency_code,category_id,note,exchange_rate_to_twd,expense_type,amortization_unit,amortization_periods,amortization_start_date,created_at,updated_at)
  values (v_parent_id,v_uid,v_parent->>'item_name',(v_parent->>'expense_date')::date,(v_parent->>'amount')::numeric,v_parent->>'currency_code',(v_parent->>'category_id')::uuid,v_parent->>'note',(v_parent->>'exchange_rate_to_twd')::numeric,'prepaid',v_parent->>'amortization_unit',(v_parent->>'amortization_periods')::integer,(v_parent->>'amortization_start_date')::date,(v_parent->>'created_at')::timestamptz,(v_parent->>'updated_at')::timestamptz);

  foreach v_tag_id in array v_parent_tags loop
    if not exists (select 1 from public.tags where id = v_tag_id and user_id = v_uid) then raise exception 'Invalid imported tag'; end if;
    insert into public.expense_tags (expense_id,tag_id,user_id,created_at) values (v_parent_id,v_tag_id,v_uid,(v_parent->>'created_at')::timestamptz);
  end loop;

  for v_row in select value from jsonb_array_elements(p_rows) where value->>'expense_type' = 'amortized' order by (value->>'amortization_sequence')::integer loop
    if (v_row->>'parent_expense_id')::uuid <> v_parent_id then raise exception 'Imported child references another parent'; end if;
    select coalesce(array_agg(value::uuid order by value), '{}'::uuid[]) into v_row_tags from jsonb_array_elements_text(coalesce(v_row->'tag_ids', '[]'::jsonb));
    if v_row_tags <> v_parent_tags then raise exception 'Imported child tags must match parent tags'; end if;
    insert into public.expenses (id,user_id,item_name,expense_date,amount,currency_code,category_id,note,exchange_rate_to_twd,expense_type,parent_expense_id,amortization_sequence,created_at,updated_at)
    values ((v_row->>'id')::uuid,v_uid,v_row->>'item_name',(v_row->>'expense_date')::date,(v_row->>'amount')::numeric,v_row->>'currency_code',(v_row->>'category_id')::uuid,v_row->>'note',(v_row->>'exchange_rate_to_twd')::numeric,'amortized',v_parent_id,(v_row->>'amortization_sequence')::integer,(v_row->>'created_at')::timestamptz,(v_row->>'updated_at')::timestamptz);
    foreach v_tag_id in array v_row_tags loop
      insert into public.expense_tags (expense_id,tag_id,user_id,created_at) values ((v_row->>'id')::uuid,v_tag_id,v_uid,(v_row->>'created_at')::timestamptz);
    end loop;
  end loop;

  if (select count(*) from public.expenses where parent_expense_id = v_parent_id) <> (v_parent->>'amortization_periods')::integer then raise exception 'Imported installment count does not match parent periods'; end if;
  if (select sum(amount) from public.expenses where parent_expense_id = v_parent_id) <> (v_parent->>'amount')::numeric then raise exception 'Imported installment total does not match parent amount'; end if;
  return v_parent_id;
end;
$$;

revoke all on function public.amortization_date(date,text,integer) from public, anon, authenticated;
revoke all on function public.amortization_amount(numeric,integer,integer) from public, anon, authenticated;
revoke all on function public.create_prepaid_expense(text,date,numeric,text,uuid,text,numeric,uuid[],text,integer,date) from public, anon;
revoke all on function public.import_prepaid_expense_group(jsonb) from public, anon;
grant execute on function public.create_prepaid_expense(text,date,numeric,text,uuid,text,numeric,uuid[],text,integer,date) to authenticated;
grant execute on function public.import_prepaid_expense_group(jsonb) to authenticated;

commit;
