-- RIMS 2022 research application schema, v1. Run in Supabase SQL editor.
-- All application reads/writes go through authenticated, authorized server endpoints.
-- Tables have RLS enabled and no direct client grants/policies (deny by default).
create extension if not exists pgcrypto;

create table if not exists public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null, activity_type text not null,
 construction_sector text not null, size_label text, years_active integer check(years_active is null or years_active between 0 and 200),
 created_at timestamptz not null default now()
);
create table if not exists public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 organization_id uuid not null references public.organizations(id),
 role text not null default 'respondent' check (role in ('respondent','admin')),
 full_name text not null, job_title text not null, specialization text,
 experience_years numeric(5,1) check (experience_years between 0 and 80),
 risk_experience_years numeric(5,1) check (risk_experience_years between 0 and 80),
 erm_familiarity text,
 consent_at timestamptz not null, consent_version text not null default '1.0',
 created_at timestamptz not null default now()
);
create table if not exists public.invites (
 id uuid primary key default gen_random_uuid(),
 code_hash text not null unique,
 organization_id uuid not null references public.organizations(id),
 created_by uuid references auth.users(id),
 expires_at timestamptz not null,
 used_by uuid unique references auth.users(id),
 used_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.dimensions (
 key text primary key, title text not null, position integer not null unique,
 weight numeric(5,4) not null check(weight>0 and weight<=1),
 item_count integer not null check(item_count>0)
);
create table if not exists public.questions (
 id text primary key, questionnaire_version text not null,
 position integer not null unique, dimension_key text references public.dimensions(key),
 kind text not null check(kind in ('baseline','attribute','target')),
 text text not null, original_number integer,
 constraint question_dimension check ((kind='baseline' and dimension_key is null) or (kind<>'baseline' and dimension_key is not null))
);
create table if not exists public.answer_options (
 question_id text not null references public.questions(id) on delete restrict,
 option_index integer not null check(option_index between 0 and 4),
 label text not null, text text not null,
 primary key(question_id,option_index)
);
create table if not exists public.assessments (
 id uuid primary key default gen_random_uuid(),
 respondent_id uuid not null references public.profiles(id),
 organization_id uuid not null references public.organizations(id),
 questionnaire_version text not null default 'rims-2022-fa-v1',
 status text not null default 'draft' check(status in ('draft','submitted')),
 started_at timestamptz not null default now(),
 submitted_at timestamptz
);
create unique index if not exists only_one_draft_per_person on public.assessments(respondent_id) where status='draft';
create index if not exists assessments_organization on public.assessments(organization_id,submitted_at);
create table if not exists public.answers (
 assessment_id uuid not null references public.assessments(id) on delete restrict,
 question_id text not null references public.questions(id),
 selected_index integer not null check(selected_index between 0 and 4),
 question_text_snapshot text not null,
 option_label_snapshot text not null,
 option_text_snapshot text not null,
 updated_at timestamptz not null default now(),
 primary key (assessment_id,question_id)
);
create table if not exists public.scoring_rules (
 id uuid primary key default gen_random_uuid(),
 label text not null, evidence_reference text not null,
 evidence_kind text not null check(evidence_kind in ('official_verified','research_decision')),
 -- JSON array of five {tier,min,max}, lower-inclusive, upper-exclusive except final 5 inclusive.
 boundaries jsonb not null,
 is_active boolean not null default false,
 approved_at timestamptz,
 approved_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
create unique index if not exists only_one_active_ruleset on public.scoring_rules(is_active) where is_active=true;
create table if not exists public.dimension_scores (
 assessment_id uuid not null references public.assessments(id),
 dimension_key text not null references public.dimensions(key),
 average_score numeric(14,8) not null,
 weighted_score numeric(14,8) not null,
 item_count integer not null,
 algorithm_version text not null,
 calculated_at timestamptz not null default now(),
 primary key(assessment_id,dimension_key)
);
create table if not exists public.maturity_results (
 assessment_id uuid primary key references public.assessments(id),
 total_score numeric(14,8) not null check(total_score between 1 and 5),
 tier text,
 scoring_rules_id uuid references public.scoring_rules(id),
 algorithm_version text not null,
 calculated_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
 id bigint generated always as identity primary key,
 actor_id uuid references auth.users(id),
 action text not null,
 entity_id text,
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

-- Security: no anon/authenticated policies; the service role is only used server-side
-- after verifying JWT and ownership/role. RLS is enabled on every research table.
do $$ declare t text; begin
 for t in select unnest(array['organizations','profiles','invites','dimensions','questions','answer_options','assessments','answers','scoring_rules','dimension_scores','maturity_results','audit_logs']) loop
   execute format('alter table public.%I enable row level security',t);
 end loop;
end $$;

-- Block modifying any submitted answer even by the server (no service-role bypass of triggers).
create or replace function public.protect_submitted_answers() returns trigger language plpgsql set search_path=public as $$
declare cur_status text;
begin
 select status into cur_status from public.assessments where id=coalesce(new.assessment_id,old.assessment_id) for update;
 if cur_status <> 'draft' then raise exception 'Submitted responses are immutable'; end if;
 if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
drop trigger if exists lock_submitted_answers on public.answers;
create trigger lock_submitted_answers before insert or update or delete on public.answers
for each row execute function public.protect_submitted_answers();

-- Transactional, single-use invitation redemption. Call via server service-role RPC only.
create or replace function public.redeem_invite(
 p_code_hash text,p_user_id uuid,p_name text,p_job text,p_specialization text,
 p_experience numeric,p_risk_experience numeric,p_familiarity text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_inv public.invites%rowtype;
begin
 if exists(select 1 from public.profiles where id=p_user_id) then raise exception 'Profile already exists'; end if;
 select * into v_inv from public.invites where code_hash=p_code_hash for update;
 if not found or v_inv.used_by is not null or v_inv.expires_at <= now() then raise exception 'Invalid or expired invitation'; end if;
 insert into public.profiles(id,organization_id,role,full_name,job_title,specialization,
 experience_years,risk_experience_years,erm_familiarity,consent_at)
 values(p_user_id,v_inv.organization_id,'respondent',p_name,p_job,p_specialization,
 p_experience,p_risk_experience,p_familiarity,now());
 update public.invites set used_by=p_user_id, used_at=now() where id=v_inv.id;
 return jsonb_build_object('organization_id',v_inv.organization_id);
end $$;

-- Tier computation uses ONLY explicitly approved, sourced thresholds, never invented defaults.
create or replace function public.score_to_tier(p_total numeric,p_boundaries jsonb) returns text
language plpgsql immutable set search_path=public as $$
declare b jsonb;
begin
 if p_boundaries is null then return null; end if;
 for b in select value from jsonb_array_elements(p_boundaries) loop
  if p_total >= (b->>'min')::numeric and
     (p_total < (b->>'max')::numeric or ((b->>'tier')='Tier 5' and p_total <= (b->>'max')::numeric)) then
     return b->>'tier';
  end if;
 end loop;
 return null;
end $$;

-- Atomic finalization: exact 42 questions, 35 attributes, dimensional means and weighted total.
create or replace function public.submit_rims_assessment(p_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_a public.assessments%rowtype; v_d record; v_count int; v_total numeric:=0;
 v_rules public.scoring_rules%rowtype; v_tier text; v_mean numeric;
begin
 select * into v_a from public.assessments where id=p_id for update;
 if not found or v_a.respondent_id <> p_actor or v_a.status <> 'draft' then
  raise exception 'Assessment not owned by you or already submitted'; end if;
 select count(*) into v_count from public.answers where assessment_id=p_id;
 if v_count<>42 then raise exception '42 answers required; found %',v_count; end if;
 if (select count(*) from public.answers a join public.questions q on q.id=a.question_id where a.assessment_id=p_id and q.kind='attribute')<>35 then
  raise exception 'All 35 attributes are required'; end if;
 if (select count(*) from public.answers a join public.questions q on q.id=a.question_id where a.assessment_id=p_id and q.questionnaire_version<>v_a.questionnaire_version)>0 then
  raise exception 'Questionnaire version mismatch'; end if;
 for v_d in select * from public.dimensions order by position loop
  select avg(a.selected_index+1)::numeric, count(*) into v_mean,v_count
  from public.answers a join public.questions q on q.id=a.question_id
  where a.assessment_id=p_id and q.kind='attribute' and q.dimension_key=v_d.key;
  if v_count<>v_d.item_count then raise exception 'Incomplete dimension %',v_d.key; end if;
  v_total:=v_total+(v_mean*v_d.weight);
  insert into public.dimension_scores(assessment_id,dimension_key,average_score,weighted_score,item_count,algorithm_version)
   values(p_id,v_d.key,v_mean,v_mean*v_d.weight,v_count,'rims-2022-weighted-v1');
 end loop;
 select * into v_rules from public.scoring_rules where is_active=true;
 if found then v_tier:=public.score_to_tier(v_total,v_rules.boundaries); else v_tier:=null; end if;
 insert into public.maturity_results(assessment_id,total_score,tier,scoring_rules_id,algorithm_version)
 values(p_id,v_total,v_tier,case when v_rules.is_active then v_rules.id else null end,'rims-2022-weighted-v1');
 update public.assessments set status='submitted', submitted_at=now() where id=p_id;
 return jsonb_build_object('score',v_total,'tier',v_tier);
end $$;

-- Safe remapping if an admin approves a new documented threshold set after assessments exist.
create or replace function public.activate_rims_rules(p_id uuid,p_actor uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_rules public.scoring_rules%rowtype;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='admin') then raise exception 'Admin required'; end if;
 select * into v_rules from public.scoring_rules where id=p_id for update;
 if not found or length(trim(v_rules.evidence_reference))<8 then raise exception 'Documented evidence required'; end if;
 update public.scoring_rules set is_active=false where is_active=true;
 update public.scoring_rules set is_active=true,approved_at=now(),approved_by=p_actor where id=p_id;
 update public.maturity_results set tier=public.score_to_tier(total_score,v_rules.boundaries),scoring_rules_id=p_id,calculated_at=now();
end $$;

revoke all on function public.redeem_invite(text,uuid,text,text,text,numeric,numeric,text) from public,anon,authenticated;
revoke all on function public.submit_rims_assessment(uuid,uuid) from public,anon,authenticated;
revoke all on function public.activate_rims_rules(uuid,uuid) from public,anon,authenticated;
grant execute on function public.redeem_invite(text,uuid,text,text,text,numeric,numeric,text) to service_role;
grant execute on function public.submit_rims_assessment(uuid,uuid) to service_role;
grant execute on function public.activate_rims_rules(uuid,uuid) to service_role;
