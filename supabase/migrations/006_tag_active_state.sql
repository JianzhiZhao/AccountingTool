alter table public.tags
  add column is_active boolean not null default true;

drop index if exists public.tags_user_sort_idx;

create index tags_user_sort_idx
  on public.tags(user_id, is_active desc, sort_order, name);
