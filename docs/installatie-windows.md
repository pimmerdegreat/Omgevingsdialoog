# Dialoogkaart installeren op een Windows-server

Deze beschrijving is voor de beheerder van de server waarop ook GeoServer draait. Dialoogkaart is een kleine Node.js-toepassing met een PostgreSQL-database met PostGIS. Ze draait naast GeoServer en heeft daar geen invloed op.

Reken op ongeveer een uur. Je hebt beheerrechten op de server nodig.

Deze stappen zijn getest op Linux met PostgreSQL 16, PostGIS 3.4 en Node.js 22. De Windows-specifieke onderdelen (de dienst en de reverse proxy) zijn beschreven volgens de documentatie van die programma's, maar niet op een Windows-server uitgeprobeerd. Meld het als een stap anders uitpakt.

## Wat er komt te staan

| Onderdeel | Doel | Poort |
|---|---|---|
| PostgreSQL met PostGIS | Opslag van trajecten en inzendingen | 5432 |
| Node.js met Dialoogkaart | De website en de API | 3000, alleen lokaal |
| Bestaande webserver of proxy | Zet het openbare https-adres door naar poort 3000 | 443 |

## 1. PostgreSQL en PostGIS

1. Download PostgreSQL 16 of nieuwer voor Windows van postgresql.org en installeer het. Onthoud het wachtwoord van de gebruiker `postgres`.
2. Start na de installatie Stack Builder, kies bij Spatial Extensions de PostGIS-bundel en installeer die.

Staat er al een PostgreSQL met PostGIS op de server, dan kun je die gebruiken.

## 2. Database inrichten

Open `server/installatie.sql` in pgAdmin of psql, ingelogd als `postgres`.

1. Vervang de twee wachtwoorden in het bestand door eigen, sterke wachtwoorden en bewaar ze.
2. Voer stap 1 en 2 uit het bestand uit. Die maken de gebruiker `dialoog` en de database `dialoogkaart`.
3. Verbind met de database `dialoogkaart` en voer de rest uit. Dat zet PostGIS aan en maakt de alleen-lezen gebruiker `qgis_lezer`.

De tabellen maakt Dialoogkaart bij de eerste start zelf aan. De gebruiker `dialoog` heeft geen beheerrechten nodig.

## 3. Node.js

Download de LTS-versie van Node.js voor Windows van nodejs.org (versie 22.13 of nieuwer) en installeer die met de standaardinstellingen.

Controleer in een nieuw PowerShell-venster:

```
node --version
```

## 4. Dialoogkaart neerzetten en bouwen

Zet de code in een eigen map, bijvoorbeeld `C:\dialoogkaart`. Dat kan met Git of door het zip-bestand van GitHub uit te pakken.

```
cd C:\dialoogkaart
npm ci
npm run build
```

## 5. Instellingen

```
copy .env.example .env
notepad .env
```

Vul in elk geval in:

| Instelling | Waarde |
|---|---|
| `DATABASE_URL` | Het wachtwoord van de gebruiker `dialoog` uit stap 2 |
| `BEHEER_WACHTWOORD` | Het wachtwoord waarmee Buro SRO inlogt in beheer |
| `SESSIE_GEHEIM` | Een willekeurige tekst van minstens 32 tekens |

Een willekeurige tekst maak je met:

```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Laat `HOST=127.0.0.1` staan. De server is dan alleen via de proxy bereikbaar.

## 6. Proefdraaien

```
npm start
```

Open op de server zelf `http://localhost:3000`. Je ziet de startpagina. Bij een lege database staat er een voorbeeldtraject klaar. Log in via Beheer met het wachtwoord uit stap 5. Stop de server daarna met Ctrl+C.

## 7. Als Windows-dienst laten draaien

Dialoogkaart moet vanzelf starten met de server. Dat kan met NSSM (nssm.cc), een klein hulpprogramma dat een programma als dienst registreert.

```
nssm install Dialoogkaart "C:\Program Files\nodejs\node.exe" "--env-file-if-exists=.env server\index.js"
nssm set Dialoogkaart AppDirectory C:\dialoogkaart
nssm set Dialoogkaart AppStdout C:\dialoogkaart\dialoogkaart.log
nssm set Dialoogkaart AppStderr C:\dialoogkaart\dialoogkaart.log
nssm set Dialoogkaart Start SERVICE_AUTO_START
nssm start Dialoogkaart
```

Een taak in Taakplanner die bij het opstarten `npm start` uitvoert in `C:\dialoogkaart` werkt ook.

## 8. Openbaar adres met https

Dialoogkaart luistert zelf alleen lokaal. De webserver die nu het https-adres van GeoServer afhandelt, zet een adres door naar `http://127.0.0.1:3000`.

Er zijn twee manieren. Beide werken, omdat de site alleen relatieve adressen gebruikt.

- **Eigen subdomein**, bijvoorbeeld `dialoog.voorbeeld.nl`. Alles op dat adres gaat naar poort 3000. Dit is de eenvoudigste vorm.
- **Pad onder het bestaande adres**, bijvoorbeeld `geo.voorbeeld.nl/dialoog/`. De proxy haalt het voorvoegsel `/dialoog` weg voordat het verzoek naar poort 3000 gaat. Deelnemers gebruiken het adres met de schuine streep aan het eind.

Met IIS heb je de modules URL Rewrite en Application Request Routing nodig. Zet in Application Request Routing de proxy aan en voeg voor een pad deze regel toe aan `web.config` van de site:

```xml
<rule name="Dialoogkaart" stopProcessing="true">
  <match url="^dialoog/(.*)" />
  <action type="Rewrite" url="http://127.0.0.1:3000/{R:1}" />
</rule>
```

Met Apache:

```
ProxyPass        /dialoog/ http://127.0.0.1:3000/
ProxyPassReverse /dialoog/ http://127.0.0.1:3000/
RequestHeader set X-Forwarded-Proto "https"
```

Laat in `.env` de instellingen `ACHTER_PROXY=1` en `HTTPS_ALTIJD=1` staan en herstart de dienst.

Controleer daarna van buiten het netwerk:

- de startpagina opent op het openbare adres;
- het voorbeeldtraject opent via Probeer het voorbeeld;
- inloggen in beheer werkt.

## 9. QGIS en GeoServer laten meelezen

De gebruiker `qgis_lezer` kan alleen het schema `qgis` lezen. Daarin staan de bijdragen en planonderdelen in RD New (EPSG:28992), zonder e-mailadressen.

- **QGIS op kantoor.** Sta in de Windows-firewall poort 5432 toe voor het vaste IP-adres van kantoor, en alleen daarvoor. Voeg in `pg_hba.conf` een regel toe voor dat adres en de gebruiker `qgis_lezer`, en zet in `postgresql.conf` `listen_addresses` op `*`. Herstart PostgreSQL.
- **GeoServer.** Voeg een PostGIS-store toe met host `localhost`, database `dialoogkaart`, schema `qgis` en gebruiker `qgis_lezer`. De zes lagen zijn daarna als WMS en WFS te publiceren. De firewall hoeft daarvoor niet open.

## Bijwerken

```
cd C:\dialoogkaart
git pull
npm ci
npm run build
nssm restart Dialoogkaart
```

## Reservekopie

Alle gegevens staan in de database `dialoogkaart`, ook de geüploade kaartlagen. Een dagelijkse kopie maak je met:

```
"C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U postgres -Fc -f C:\backup\dialoogkaart.dump dialoogkaart
```

## Als het niet werkt

| Verschijnsel | Oorzaak en oplossing |
|---|---|
| De dienst stopt direct | Kijk in `dialoogkaart.log`. Meestal ontbreekt een instelling in `.env` of klopt het databasewachtwoord niet |
| "De website is nog niet gebouwd" | Voer `npm run build` uit in de map van Dialoogkaart |
| Startpagina werkt, voorbeeld of beheer niet | De proxy stuurt `/api/` niet door, of haalt het voorvoegsel van het pad niet weg |
| Inloggen lukt niet over http | `HTTPS_ALTIJD=1` staat aan terwijl de site nog niet via https bereikbaar is |
| QGIS krijgt geen verbinding | Controleer de firewallregel, `pg_hba.conf` en `listen_addresses` |
