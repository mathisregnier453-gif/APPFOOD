-- =============================================================================
-- Sauge — schéma initial
-- Toutes les données métier appartiennent à un FOYER (household). Chaque
-- utilisateur reçoit automatiquement un foyer personnel à l'inscription :
-- le partage (offre Famille, phase 5) ne demandera donc aucune migration.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.storage_kind       as enum ('fridge', 'freezer', 'pantry');
create type public.food_unit          as enum ('piece', 'g', 'kg', 'ml', 'l', 'pack');
create type public.expiry_kind        as enum ('dlc', 'ddm');          -- DLC / DDM
create type public.plan_code          as enum ('free', 'premium', 'family');
create type public.billing_period     as enum ('monthly', 'yearly');
create type public.household_role     as enum ('owner', 'member');
create type public.scan_status        as enum ('draft', 'processing', 'analyzed', 'confirmed', 'failed', 'cancelled');
create type public.item_source        as enum ('manual', 'scan', 'barcode', 'shopping');
create type public.consumption_reason as enum ('consumed', 'finished', 'discarded', 'recipe', 'adjusted', 'moved');
create type public.meal_slot          as enum ('breakfast', 'lunch', 'dinner');
create type public.ai_feature         as enum ('scan', 'recipe', 'meal_plan', 'anti_waste');

-- -----------------------------------------------------------------------------
-- Référentiels (lecture seule pour les utilisateurs)
-- -----------------------------------------------------------------------------
create table public.food_categories (
  id        text primary key,           -- slug stable utilisé par l'IA
  label_fr  text not null,
  icon      text not null,              -- nom d'icône Ionicons
  position  smallint not null
);

-- Offres commerciales : modifiables depuis l'espace admin, jamais en dur dans l'app.
create table public.plans (
  code                   public.plan_code primary key,
  label                  text not null,
  monthly_scan_quota     integer not null check (monthly_scan_quota >= 0),
  monthly_recipe_quota   integer,                        -- null = usage raisonnable (fair use)
  fair_use_recipe_cap    integer not null default 300,   -- garde-fou anti-abus pour "illimité"
  max_members            smallint not null default 1,
  max_photos_per_scan    smallint not null default 6,
  price_monthly_cents    integer not null default 0,
  price_yearly_cents     integer,
  features               jsonb not null default '{}'::jsonb,
  updated_at             timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Utilisateurs & foyers
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  display_name          text check (char_length(display_name) <= 60),
  locale                text not null default 'fr-FR',
  current_household_id  uuid,
  household_size        smallint not null default 1 check (household_size between 1 and 20),
  notification_prefs    jsonb not null default
    '{"expiry": true, "meal_reminder": true, "missing_ingredient": true, "shopping_update": true, "household_activity": true, "quota": true}'::jsonb,
  expiry_alert_days     smallint not null default 2 check (expiry_alert_days between 0 and 14),
  privacy_consent_at    timestamptz,      -- consentement RGPD (photos & traitement IA)
  is_admin              boolean not null default false,
  suspended_at          timestamptz,
  suspended_reason      text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default 'Mon foyer' check (char_length(name) between 1 and 60),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.profiles
  add constraint profiles_current_household_fk
  foreign key (current_household_id) references public.households (id) on delete set null;

create table public.household_members (
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          public.household_role not null default 'member',
  joined_at     timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

create table public.household_invitations (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  code          text not null unique,
  created_by    uuid not null references auth.users (id) on delete cascade,
  expires_at    timestamptz not null default now() + interval '7 days',
  accepted_by   uuid references auth.users (id) on delete set null,
  accepted_at   timestamptz,
  created_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Inventaire
-- -----------------------------------------------------------------------------
create table public.storage_locations (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  kind          public.storage_kind not null,
  name          text not null check (char_length(name) between 1 and 40),
  position      smallint not null default 0,
  created_at    timestamptz not null default now()
);
create index storage_locations_household_idx on public.storage_locations (household_id);

create table public.food_items (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references public.households (id) on delete cascade,
  storage_location_id    uuid not null references public.storage_locations (id) on delete restrict,
  category_id            text not null default 'other' references public.food_categories (id),
  name                   text not null check (char_length(name) between 1 and 80),
  -- quantity null = inconnue : l'IA ne doit jamais inventer une quantité exacte.
  quantity               numeric(10,2) check (quantity is null or quantity >= 0),
  unit                   public.food_unit not null default 'piece',
  quantity_is_estimate   boolean not null default false,
  expiry_date            date,             -- null = inconnue (jamais inventée)
  expiry_kind            public.expiry_kind,
  opened_at              date,
  barcode                text,
  image_path             text,
  notes                  text check (char_length(notes) <= 280),
  source                 public.item_source not null default 'manual',
  scan_detection_id      uuid,
  created_by             uuid references auth.users (id) on delete set null,
  finished_at            timestamptz,      -- non null = terminé (conservé pour l'historique)
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint food_items_expiry_kind_requires_date check (expiry_kind is null or expiry_date is not null)
);
create index food_items_household_active_idx on public.food_items (household_id) where finished_at is null;
create index food_items_expiry_idx on public.food_items (household_id, expiry_date) where finished_at is null and expiry_date is not null;

create table public.consumption_logs (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households (id) on delete cascade,
  food_item_id     uuid references public.food_items (id) on delete set null,
  user_id          uuid references auth.users (id) on delete set null,
  item_name        text not null,
  category_id      text references public.food_categories (id),
  quantity_delta   numeric(10,2),
  unit             public.food_unit,
  reason           public.consumption_reason not null,
  recipe_id        uuid,
  created_at       timestamptz not null default now()
);
create index consumption_logs_household_idx on public.consumption_logs (household_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Scanner IA
-- -----------------------------------------------------------------------------
create table public.scan_sessions (
  id                   uuid primary key default gen_random_uuid(),
  household_id         uuid not null references public.households (id) on delete cascade,
  user_id              uuid not null references auth.users (id) on delete cascade,
  storage_kind         public.storage_kind not null,
  status               public.scan_status not null default 'draft',
  photo_count          smallint not null default 0,
  images_hash          text,               -- empreinte des photos (cache anti double-appel)
  ai_provider          text,
  ai_model             text,
  input_tokens         integer,
  output_tokens        integer,
  estimated_cost_usd   numeric(10,6),
  scans_consumed       smallint not null default 0,
  from_cache           boolean not null default false,
  result_summary       jsonb,
  error_code           text,
  created_at           timestamptz not null default now(),
  analyzed_at          timestamptz,
  confirmed_at         timestamptz
);
create index scan_sessions_household_idx on public.scan_sessions (household_id, created_at desc);
create index scan_sessions_hash_idx on public.scan_sessions (household_id, images_hash) where images_hash is not null;

create table public.scan_photos (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.scan_sessions (id) on delete cascade,
  household_id  uuid not null references public.households (id) on delete cascade,
  storage_path  text not null unique,
  width         integer,
  height        integer,
  bytes         integer,
  position      smallint not null default 0,
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz             -- photo purgée du stockage (politique de conservation)
);
create index scan_photos_session_idx on public.scan_photos (session_id);
create index scan_photos_retention_idx on public.scan_photos (created_at) where deleted_at is null;

create table public.scan_detections (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references public.scan_sessions (id) on delete cascade,
  household_id          uuid not null references public.households (id) on delete cascade,
  name                  text not null,
  category_id           text not null references public.food_categories (id),
  quantity              numeric(10,2),
  unit                  public.food_unit not null default 'piece',
  quantity_is_estimate  boolean not null default true,
  expiry_date           date,
  expiry_kind           public.expiry_kind,
  confidence            numeric(3,2) not null check (confidence between 0 and 1),
  photo_index           smallint,
  accepted              boolean,
  food_item_id          uuid references public.food_items (id) on delete set null,
  created_at            timestamptz not null default now()
);
create index scan_detections_session_idx on public.scan_detections (session_id);

alter table public.food_items
  add constraint food_items_scan_detection_fk
  foreign key (scan_detection_id) references public.scan_detections (id) on delete set null;

-- -----------------------------------------------------------------------------
-- Recettes, planning, courses (utilisées à partir des phases 2-3)
-- -----------------------------------------------------------------------------
create table public.dietary_preferences (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  diets          text[] not null default '{}',   -- ex: vegetarian, vegan, pescatarian
  allergies      text[] not null default '{}',
  dislikes       text[] not null default '{}',
  budget_level   smallint check (budget_level between 1 and 3),
  max_prep_minutes smallint,
  updated_at     timestamptz not null default now()
);

create table public.recipes (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households (id) on delete cascade,
  created_by       uuid references auth.users (id) on delete set null,
  title            text not null,
  summary          text,
  image_path       text,
  prep_minutes     smallint,
  cook_minutes     smallint,
  servings         smallint not null default 2,
  difficulty       smallint check (difficulty between 1 and 3),
  budget_level     smallint check (budget_level between 1 and 3),
  meal_type        text,
  tags             text[] not null default '{}',
  steps            jsonb not null default '[]'::jsonb,
  nutrition        jsonb,
  source           text not null default 'ai',
  ai_model         text,
  created_at       timestamptz not null default now()
);
create index recipes_household_idx on public.recipes (household_id, created_at desc);

create table public.recipe_ingredients (
  id             uuid primary key default gen_random_uuid(),
  recipe_id      uuid not null references public.recipes (id) on delete cascade,
  household_id   uuid not null references public.households (id) on delete cascade,
  name           text not null,
  quantity       numeric(10,2),
  unit           public.food_unit,
  category_id    text references public.food_categories (id),
  food_item_id   uuid references public.food_items (id) on delete set null, -- correspondance stock
  is_optional    boolean not null default false,
  position       smallint not null default 0
);
create index recipe_ingredients_recipe_idx on public.recipe_ingredients (recipe_id);

create table public.favorites (
  user_id     uuid not null references auth.users (id) on delete cascade,
  recipe_id   uuid not null references public.recipes (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table public.meal_plans (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  plan_date     date not null,
  slot          public.meal_slot not null,
  recipe_id     uuid references public.recipes (id) on delete set null,
  custom_title  text,
  servings      smallint not null default 2,
  is_cooked     boolean not null default false,
  created_by    uuid references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  unique (household_id, plan_date, slot)
);

create table public.shopping_lists (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null default 'Courses',
  is_archived   boolean not null default false,
  created_at    timestamptz not null default now()
);

create table public.shopping_list_items (
  id                uuid primary key default gen_random_uuid(),
  list_id           uuid not null references public.shopping_lists (id) on delete cascade,
  household_id      uuid not null references public.households (id) on delete cascade,
  name              text not null,
  normalized_name   text generated always as (lower(trim(name))) stored,
  quantity          numeric(10,2),
  unit              public.food_unit,
  category_id       text not null default 'other' references public.food_categories (id),
  recipe_id         uuid references public.recipes (id) on delete set null,
  is_checked        boolean not null default false,
  added_by          uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (list_id, normalized_name, unit)          -- anti-doublons
);

-- -----------------------------------------------------------------------------
-- Monétisation & quotas (écritures réservées au serveur)
-- -----------------------------------------------------------------------------
create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  household_id           uuid not null references public.households (id) on delete cascade,
  user_id                uuid not null references auth.users (id) on delete cascade, -- payeur
  plan                   public.plan_code not null,
  period                 public.billing_period not null,
  status                 text not null,       -- active, in_grace_period, cancelled, expired, billing_issue
  store                  text,                -- app_store, play_store
  revenuecat_app_user_id text,
  product_id             text,
  current_period_end     timestamptz,
  will_renew             boolean,
  price_paid_cents       integer,
  currency               text,
  updated_at             timestamptz not null default now(),
  created_at             timestamptz not null default now()
);
create index subscriptions_household_idx on public.subscriptions (household_id);

create table public.usage_quotas (
  household_id   uuid not null references public.households (id) on delete cascade,
  period_start   date not null,            -- 1er jour du mois (UTC)
  scans_used     integer not null default 0 check (scans_used >= 0),
  recipes_used   integer not null default 0 check (recipes_used >= 0),
  updated_at     timestamptz not null default now(),
  primary key (household_id, period_start)
);

create table public.ai_usage_logs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users (id) on delete set null,
  household_id     uuid references public.households (id) on delete set null,
  feature          public.ai_feature not null,
  provider         text not null,
  model            text not null,
  input_tokens     integer not null default 0,
  output_tokens    integer not null default 0,
  image_count      smallint not null default 0,
  cost_usd         numeric(10,6) not null default 0,
  latency_ms       integer,
  success          boolean not null,
  error_code       text,
  scan_session_id  uuid references public.scan_sessions (id) on delete set null,
  created_at       timestamptz not null default now()
);
create index ai_usage_logs_created_idx on public.ai_usage_logs (created_at desc);
create index ai_usage_logs_user_idx on public.ai_usage_logs (user_id, created_at desc);
