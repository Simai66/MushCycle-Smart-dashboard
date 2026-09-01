create table if not exists public.sensor_readings (
  id bigint generated always as identity primary key,
  device_id text not null,
  recorded_at timestamptz not null default now(),
  temperature double precision not null check (temperature between -40 and 80),
  humidity double precision not null check (humidity between 0 and 100),
  mq2 integer not null check (mq2 between 0 and 4095),
  mq9 integer not null check (mq9 between 0 and 4095),
  mode text not null check (mode in ('AUTO', 'MANUAL')),
  pump boolean not null,
  relay4 boolean not null,
  version text not null
);

create index if not exists sensor_readings_device_time_idx
  on public.sensor_readings (device_id, recorded_at desc);

create table if not exists public.device_controls (
  device_id text primary key,
  mode text not null check (mode in ('AUTO', 'MANUAL')),
  pump boolean not null default false,
  relay4 boolean not null default false,
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.api_secrets (
  name text primary key,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$')
);

alter table public.sensor_readings enable row level security;
alter table public.device_controls enable row level security;
alter table public.api_secrets enable row level security;

revoke all on table public.sensor_readings from anon, authenticated;
revoke all on table public.device_controls from anon, authenticated;
revoke all on table public.api_secrets from anon, authenticated;
grant select, insert on table public.sensor_readings to service_role;
grant select, insert, update on table public.device_controls to service_role;
grant select on table public.api_secrets to service_role;
grant usage, select on sequence public.sensor_readings_id_seq to service_role;

create or replace function public.get_sensor_readings(
  p_device_id text,
  p_since timestamptz,
  p_bucket_seconds integer
)
returns table (
  recorded_at timestamptz,
  temperature double precision,
  humidity double precision,
  mq2 integer,
  mq9 integer,
  mode text,
  pump boolean,
  relay4 boolean,
  version text
)
language sql
stable
set search_path = public
as $$
  with filtered as (
    select *,
      to_timestamp(floor(extract(epoch from recorded_at) / p_bucket_seconds) * p_bucket_seconds) as bucket_start
    from public.sensor_readings
    where device_id = p_device_id and recorded_at >= p_since
  ),
  latest as (
    select * from filtered order by recorded_at desc limit 1
  ),
  history as (
    select
      bucket_start as recorded_at,
      avg(temperature)::double precision as temperature,
      avg(humidity)::double precision as humidity,
      round(avg(mq2))::integer as mq2,
      round(avg(mq9))::integer as mq9,
      (array_agg(mode order by filtered.recorded_at desc))[1] as mode,
      (array_agg(pump order by filtered.recorded_at desc))[1] as pump,
      (array_agg(relay4 order by filtered.recorded_at desc))[1] as relay4,
      (array_agg(version order by filtered.recorded_at desc))[1] as version
    from filtered
    where bucket_start < (select bucket_start from latest)
    group by bucket_start
  )
  select * from history
  union all
  select latest.recorded_at, latest.temperature, latest.humidity, latest.mq2, latest.mq9,
    latest.mode, latest.pump, latest.relay4, latest.version
  from latest
  order by recorded_at;
$$;

revoke execute on function public.get_sensor_readings(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.get_sensor_readings(text, timestamptz, integer) to service_role;
