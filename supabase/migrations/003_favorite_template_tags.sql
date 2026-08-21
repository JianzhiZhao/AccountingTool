alter table public.favorite_templates
  add constraint favorite_templates_id_user_unique unique (id, user_id);

create table public.favorite_template_tags (
  favorite_template_id uuid not null,
  tag_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (favorite_template_id, tag_id),
  foreign key (favorite_template_id, user_id) references public.favorite_templates(id, user_id) on delete cascade,
  foreign key (tag_id, user_id) references public.tags(id, user_id) on delete cascade
);

create index favorite_template_tags_user_tag_idx
  on public.favorite_template_tags(user_id, tag_id, favorite_template_id);

alter table public.favorite_template_tags enable row level security;

create policy "own favorite template tags" on public.favorite_template_tags for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on public.favorite_template_tags from anon;
grant select, insert, update, delete on public.favorite_template_tags to authenticated;
