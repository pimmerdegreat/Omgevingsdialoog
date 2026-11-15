# De resultaten in QGIS

Er zijn twee manieren om de bijdragen van een traject in QGIS te zien. Beide leveren lagen in RD New (EPSG:28992).

## Snel: het GeoPackage

1. Open het traject in beheer en ga naar QGIS en export.
2. Kies Download GeoPackage voor QGIS.
3. Sleep het bestand in QGIS en vink de lagen aan die je wilt zien.

QGIS kleurt de bijdragen vanzelf per categorie, in dezelfde kleuren als het traject. Voor de nieuwste inzendingen download je het bestand opnieuw.

| Laag | Inhoud |
|---|---|
| `bijdragen_punten`, `bijdragen_lijnen`, `bijdragen_vlakken` | Wat deelnemers op de kaart zetten, met categorie, toelichting, datum, leeftijdsgroep en de vier cijfers van de postcode |
| `planonderdelen_punten`, `planonderdelen_lijnen`, `planonderdelen_vlakken` | De planonderdelen met het aantal keer goed idee, twijfel en geen goed idee |
| `inzendingen` | Tabel zonder kaart met de antwoorden per deelnemer |

Alleen lagen met inhoud staan in het bestand. Koppel de tabel `inzendingen` aan de bijdragen via de kolom `inzending_id`. Zo kleur je bijvoorbeeld de punten naar het rapportcijfer dat een deelnemer gaf.

E-mailadressen staan niet in het GeoPackage.

## Altijd actueel: rechtstreeks verbinden

Met een PostGIS-verbinding ziet QGIS steeds de laatste stand. De beheerder van de server moet hiervoor de toegang hebben geregeld; zie de installatiebeschrijving.

1. Kies in QGIS Laag, Laag toevoegen, PostGIS-lagen toevoegen en maak een nieuwe verbinding.
2. Vul de gegevens in die in beheer staan bij QGIS en export. Het wachtwoord krijg je van de beheerder.
3. Kies in het schema `qgis` de lagen die je wilt zien.
4. In deze lagen staan alle trajecten bij elkaar. Zet per laag een filter op de kolom `traject`, bijvoorbeeld `"traject" = 'voorbeeld-goylaan'`.

Ververs de kaart in QGIS om nieuwe inzendingen te zien.

## Eigen plantekening in een traject zetten

Andersom werkt het ook. Exporteer een laag uit QGIS als GeoJSON en lees die in beheer in:

- als **kaartlaag**, om je plan over de ondergrond te leggen;
- als **planonderdelen**, zodat deelnemers per onderdeel hun oordeel geven. Een kolom `naam` of `titel` wordt de titel van het onderdeel.

Het bestand mag in graden (WGS84) of in RD New staan. Dialoogkaart rekent RD New zelf om.
