-- Eenmalige inrichting van de database voor Dialoogkaart.
-- Uitvoeren als beheerder van PostgreSQL (gebruiker postgres), bijvoorbeeld in pgAdmin of met psql.
-- Vervang de twee wachtwoorden door eigen, sterke wachtwoorden.

-- 1. De gebruiker waarmee Dialoogkaart zelf werkt.
create role dialoog login password 'VERVANG-DIT-WACHTWOORD';

-- 2. De database.
create database dialoogkaart owner dialoog encoding 'UTF8';

-- 3. Verbind nu met de database dialoogkaart (in psql: \c dialoogkaart) en voer de rest daar uit.

-- PostGIS aanzetten. Dit kan alleen de beheerder; de tabellen maakt Dialoogkaart daarna zelf aan.
create extension if not exists postgis;

-- 4. Alleen-lezen gebruiker voor QGIS en GeoServer. Dialoogkaart geeft deze gebruiker bij het starten
--    leesrecht op het schema qgis. Daarin staan de bijdragen in RD New, zonder e-mailadressen.
create role qgis_lezer login password 'VERVANG-DIT-OOK';
grant connect on database dialoogkaart to qgis_lezer;
