alter table public.expenses
  add constraint expenses_id_user_unique unique (id, user_id);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create unique index tags_user_name_unique on public.tags(user_id, lower(trim(name)));

create table public.expense_tags (
  expense_id uuid not null,
  tag_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (expense_id, tag_id),
  foreign key (expense_id, user_id) references public.expenses(id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags(id, user_id) on delete cascade
);

create index expense_tags_user_tag_idx on public.expense_tags(user_id, tag_id, expense_id);

create trigger tags_updated before update on public.tags
for each row execute function public.set_updated_at();

alter table public.tags enable row level security;
alter table public.expense_tags enable row level security;

create policy "own tags" on public.tags for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own expense tags" on public.expense_tags for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.tags, public.expense_tags from anon;
grant select, insert, update, delete on public.tags, public.expense_tags to authenticated;
