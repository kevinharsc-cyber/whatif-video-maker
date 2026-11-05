# Produktions-Review: Video-Pipeline (App-Version 26)

## 1. Bestandsaufnahme (vorher)

| Bereich | Befund |
|---|---|
| Aufnahme | Standard war die Echtzeit-Aufnahme per `MediaRecorder` (Safari). Ergebnis: **fragmentierte MP4** (moof/mdat-Stücke, kein Index am Anfang) mit **variabler Bildrate**. |
| Ton/Bild-Sync | Zeitstempel kommen vom Recorder. Hängt die AudioContext-Uhr, wird `rec.pause()/resume()` genutzt – das erzeugt Sprünge in der Datei. TikTok verarbeitet fragmentierte VFR-Dateien teilweise fehlerhaft → Ton hängt/stockt. |
| WebCodecs-Export | Saubere CFR-Datei möglich, aber auf dem iPhone des Nutzers meldete die App „H.264-Encoder nicht verfügbar“ (es wurde nur eine Profil-Variante probiert). |
| Grafik | 2D-Canvas-Comic. Speicherprobleme kamen von großen Vollbild-Füllungen (Soft-Light/Vignette), Neuzeichnen mit 120 Hz, Schatten-Blur und Körnung – bereits in früheren Versionen behoben. |
| Storyboard | Ein Shot pro Satz über `guessShot` (Regex) bzw. Gemini-Vorgabe. |
| Qualitätskontrolle | Keine. |

## 2. Umgesetzte Änderungen

1. **Low-Poly-3D-Stil** (`src/three/lowpoly.js`, Three.js): eine durchgehend gleiche Figur (lila Hoodie), 17 Orte (Schlafzimmer, Wohnzimmer, Fenster, Hausfront, Straße, Stadt, leere Stadt, Supermarkt, Dach, Wiese, Strand, Wald, Wüste, Schnee, Weltall, Erde …), Kameras *wide / medium / close / over-the-shoulder / follow / room / low*. Performance: flache Lambert-Materialien, geteilte Geometrie-/Material-Caches, Instancing, Blob-Schatten statt Shadow-Maps, Pixelratio 1, 720p.
2. **Storyboard**: neue Shots (Meer, Park, Parkbank, Supermarkt betreten, Bank, Geld, Wald, Tiere kehren zurück); Kontinuität (kein Treffer = vorheriger Shot bleibt), Kamerawahl je Aktion.
3. **Remux zu normaler MP4** (`src/mp4tools.js`): Die Recorder-Datei wird ohne Neukodierung in eine progressive MP4 (moov vor mdat, „Fast Start“) umgepackt. Gemeinsamer Nullpunkt für Bild und Ton, Video wird am Tonende gekürzt.
4. **Automatische Qualitätskontrolle**: Container, Fast Start, H.264, 9:16, ~30 fps, eingefrorene Bilder, AAC, 48 kHz, Ton-Lücken, gleiche Länge, Ton vollständig – wird im Ergebnis angezeigt.
5. **Encoder-Suche**: WebCodecs-Export probiert jetzt 8 H.264-Profile × Varianten; „🔍 Gerät prüfen“ zeigt, was das Gerät wirklich kann.
6. Aufnahme-Zeichenschleife auf 30 fps gedrosselt.

## 3. Tests (in der Cloud-VM)

- Build ok, kompletter Ablauf Thema → Skript → Stimme → 3D → Aufnahme → Remux → QC → Download ok.
- Remux-Ergebnis: nicht fragmentiert, moov vor mdat, Start bei 0/0, fehlerfrei decodierbar.
- 3D-Testbilder aller Shots geprüft.

## 4. Grenzen (ehrlich)

- **Echtzeit-Aufnahme bleibt VFR**: Der Remux repariert Container und Index, macht aber keine konstante Bildrate. Echte CFR 30 fps gibt es nur mit dem WebCodecs-Export – falls das iPhone einen H.264-Encoder meldet.
- **3D läuft in 720 × 1280**, nicht 1080 × 1920 (Arbeitsspeicher/GPU des iPhones).
- **Szenenweises Fortsetzen** nach Absturz ist nur beim WebCodecs-Export möglich.
- **GPU-Leistung nicht messbar** in der VM (Software-Rendering ≈ 7 fps, Chromium nimmt VP9/Opus auf). Auf dem iPhone liefert Safari H.264/AAC; die echte Bildrate muss dort geprüft werden.
- **TikTok-Verhalten** konnte nicht auf einem echten Gerät getestet werden.
