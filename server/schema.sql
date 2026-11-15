-- Datamodel van Dialoogkaart. Wordt bij elke start uitgevoerd en is daarom herhaalbaar geschreven.

create extension if not exists postgis;

create table if not exists traject (
	id uuid primary key default gen_random_uuid(),
	slug text not null unique,
	titel text not null,
	status text not null default 'concept' check (status in ('concept', 'open', 'gesloten')),
	definitie jsonb not null,
	voorbeeld boolean not null default false,
	aangemaakt timestamptz not null default now(),
	gewijzigd timestamptz not null default now(),
	gesloten_op timestamptz,
	geanonimiseerd_op timestamptz
);

create table if not exists inzending (
	id uuid primary key default gen_random_uuid(),
	traject_id uuid not null references traject (id) on delete cascade,
	ingediend timestamptz not null default now(),
	antwoorden jsonb not null default '{}'::jsonb,
	postcode text,
	leeftijd text,
	email text,
	op_de_hoogte boolean not null default false,
	mobiel boolean
);
create index if not exists inzending_traject on inzending (traject_id);

create table if not exists bijdrage (
	id uuid primary key default gen_random_uuid(),
	inzending_id uuid not null references inzending (id) on delete cascade,
	traject_id uuid not null references traject (id) on delete cascade,
	stap_id text not null,
	categorie_id text not null,
	toelichting text not null default '',
	geom geometry(Geometry, 4326) not null
);
create index if not exists bijdrage_traject on bijdrage (traject_id);
create index if not exists bijdrage_geom on bijdrage using gist (geom);

create table if not exists reactie (
	id uuid primary key default gen_random_uuid(),
	inzending_id uuid not null references inzending (id) on delete cascade,
	traject_id uuid not null references traject (id) on delete cascade,
	stap_id text not null,
	onderdeel_id text not null,
	oordeel text not null check (oordeel in ('goed', 'twijfel', 'niet')),
	toelichting text not null default ''
);
create index if not exists reactie_traject on reactie (traject_id);

create table if not exists bestand (
	id uuid primary key default gen_random_uuid(),
	traject_id uuid not null references traject (id) on delete cascade,
	naam text not null,
	mime text not null,
	inhoud bytea not null,
	aangemaakt timestamptz not null default now()
);

-- Lagen voor QGIS, in RD New (EPSG:28992). Zonder e-mailadres; postcode alleen de vier cijfers.
create schema if not exists qgis;

create or replace view bijdrage_plat as
select
	b.id,
	t.slug as traject,
	t.titel as traject_titel,
	coalesce((
		select c ->> 'label'
		from jsonb_array_elements(t.definitie -> 'stappen') s,
			jsonb_array_elements(coalesce(s -> 'categorieen', '[]'::jsonb)) c
		where s ->> 'id' = b.stap_id and c ->> 'id' = b.categorie_id
		limit 1
	), b.categorie_id) as categorie,
	b.toelichting,
	i.ingediend,
	i.leeftijd,
	left(i.postcode, 4) as postcode4,
	b.inzending_id,
	b.geom
from bijdrage b
join traject t on t.id = b.traject_id
join inzending i on i.id = b.inzending_id;

create or replace view qgis.bijdragen_punten as
select id, traject, traject_titel, categorie, toelichting, ingediend, leeftijd, postcode4, inzending_id,
	st_transform(geom, 28992)::geometry(Point, 28992) as geom
from bijdrage_plat where geometrytype(geom) = 'POINT';

create or replace view qgis.bijdragen_lijnen as
select id, traject, traject_titel, categorie, toelichting, ingediend, leeftijd, postcode4, inzending_id,
	st_transform(geom, 28992)::geometry(LineString, 28992) as geom
from bijdrage_plat where geometrytype(geom) = 'LINESTRING';

create or replace view qgis.bijdragen_vlakken as
select id, traject, traject_titel, categorie, toelichting, ingediend, leeftijd, postcode4, inzending_id,
	st_transform(geom, 28992)::geometry(Polygon, 28992) as geom
from bijdrage_plat where geometrytype(geom) = 'POLYGON';

create or replace view planonderdeel_plat as
select
	t.slug || ':' || (s ->> 'id') || ':' || (o ->> 'id') as id,
	t.slug as traject,
	t.titel as traject_titel,
	o ->> 'titel' as titel,
	o ->> 'tekst' as omschrijving,
	(select count(*) from reactie r where r.traject_id = t.id and r.stap_id = s ->> 'id' and r.onderdeel_id = o ->> 'id' and r.oordeel = 'goed')::int as goed,
	(select count(*) from reactie r where r.traject_id = t.id and r.stap_id = s ->> 'id' and r.onderdeel_id = o ->> 'id' and r.oordeel = 'twijfel')::int as twijfel,
	(select count(*) from reactie r where r.traject_id = t.id and r.stap_id = s ->> 'id' and r.onderdeel_id = o ->> 'id' and r.oordeel = 'niet')::int as niet,
	st_setsrid(st_geomfromgeojson(o ->> 'geometrie'), 4326) as geom
from traject t,
	jsonb_array_elements(t.definitie -> 'stappen') s,
	jsonb_array_elements(coalesce(s -> 'onderdelen', '[]'::jsonb)) o
where o -> 'geometrie' is not null and jsonb_typeof(o -> 'geometrie') = 'object';

create or replace view qgis.planonderdelen_punten as
select id, traject, traject_titel, titel, omschrijving, goed, twijfel, niet,
	st_transform(geom, 28992)::geometry(Point, 28992) as geom
from planonderdeel_plat where geometrytype(geom) = 'POINT';

create or replace view qgis.planonderdelen_lijnen as
select id, traject, traject_titel, titel, omschrijving, goed, twijfel, niet,
	st_transform(geom, 28992)::geometry(LineString, 28992) as geom
from planonderdeel_plat where geometrytype(geom) = 'LINESTRING';

create or replace view qgis.planonderdelen_vlakken as
select id, traject, traject_titel, titel, omschrijving, goed, twijfel, niet,
	st_transform(geom, 28992)::geometry(Polygon, 28992) as geom
from planonderdeel_plat where geometrytype(geom) = 'POLYGON';
