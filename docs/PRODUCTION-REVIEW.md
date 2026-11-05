# Produktions-Review: Video-Pipeline

## Version 27 – Speicher-Umbau (iPhone-Abstürze bei ~50 %)

### 1. Wo läuft was? (geprüft im Code)

| Aufgabe | Ort |
|---|---|
| Skript (Pollinations/Gemini) | Server von Google/Pollinations |
| Gemini-Stimme | Server von Google |
| Piper-Stimme | **lokal im iPhone** (Safari, WebAssembly) |
| 3D-Grafik (Three.js/WebGL) | **lokal im iPhone** (Safari, Grafikchip) |
| 2D-Untertitel/Pop-ups | **lokal im iPhone** (Canvas in Safari) |
| Video-Kodierung (H.264/AAC) | **lokal im iPhone** (Safari: WebCodecs bzw. MediaRecorder) |
| Zusammensetzen der MP4 | **lokal im iPhone** (mp4-muxer) |

Die App ist eine statische Seite auf GitHub Pages. Es gibt **keinen eigenen Server**.

### 2. Gefundener Engpass (gemessen)

Messung: Chromium (Cloud-VM), komplette Erstellung, RSS aller Prozesse alle 2 s.
Da Hugging Face aus der VM gesperrt ist, wurde ein synthetisches Modell in
Piper-Größe (65 MB, gleiche Ein-/Ausgänge) verwendet.

| Phase | v26 (vorher) | v27 (nachher) |
|---|---|---|
| Seitenprozess während der Videoerstellung | **≈ 645 MB** | **≈ 275 MB** |
| nach Fertigstellung | ≈ 632 MB | ≈ 222 MB |
| Grafikprozess nach Fertigstellung | ≈ 170 MB | ≈ 104 MB |

**Hauptursache:** Die Piper-Stimme (onnxruntime + Lautschrift als WebAssembly) lief
direkt in der App. WebAssembly-Speicher wird nie zurückgegeben → rund 300 MB blieben
während der gesamten Aufnahme belegt. Das passt zum Absturz „bei ca. 50 %“.
Während der Aufnahme selbst wuchs der Speicher nicht (kein klassisches Leck).

### 3. Umgesetzte Änderungen

1. **Stimme im Hintergrund-Prozess** (`src/piper-worker.js`): Lautschrift + Modell laufen
   in einem Worker, der danach beendet wird (gibt den WebAssembly-Speicher frei). Das Modell
   wird nicht mehr in die App kopiert, der Worker liest es direkt aus dem Cache. Beim ersten
   Download keine Doppelkopien mehr.
2. **Szenenweiser Export** (`src/exporter.js`, Standard):
   - Ton offline mischen → AAC (WebCodecs-AudioEncoder; falls nicht vorhanden: einmalige
     reine Ton-Aufnahme per MediaRecorder `audio/mp4`).
   - Video Szene für Szene (Abschnitte ≤ 6 s) in **konstanten 24 fps**, H.264, 720 × 1280.
   - `VideoFrame.close()` sofort nach `encode()`, `AudioData.close()` sofort.
   - Encoder-Warteschlange begrenzt (`encodeQueueSize ≤ 2`, Gegendruck mit Zeitlimit).
   - Nach jeder Szene: `flush()`, kodierte Daten in **IndexedDB** (Gerätespeicher),
     Fortschritt speichern, kurze Pause.
   - Am Ende werden die Abschnitte nacheinander zu einer progressiven MP4 zusammengesetzt
     (moov vorne). Es liegt nie das ganze Rohvideo im RAM.
   - **Fortsetzen nach Absturz:** Beim nächsten Öffnen erscheint „▶️ Fortsetzen ab Szene X“.
     Fertige Szenen und der Ton bleiben erhalten.
   - **Abbrechen-Knopf** (sauberes Aufräumen).
3. **3D-Speicher** (`src/three/lowpoly.js`):
   - Umgebungen werden freigegeben, sobald keine spätere Szene sie braucht. Geteilte Teile
     (Figur, Himmel, gemeinsame Formen) bleiben.
   - `dispose3D()` gibt am Ende den kompletten Grafikspeicher frei (inklusive WebGL-Kontext).
   - `preserveDrawingBuffer` ist aus (ein Bildspeicher weniger), Nebel-Objekte werden
     wiederverwendet, und der WebGL-Test-Kontext wird sofort freigegeben.
4. **Prüfung ohne Kopie:** Die Qualitätskontrolle liest nur Zeitstempel (keine Video-Daten).
   Neu geprüft wird „Konstante Bildrate (CFR)“.
5. **Absturz-Protokoll:** Phase, Szene und ms pro Bild werden laufend gespeichert und nach
   einem Absturz angezeigt.
6. **Selbsttest** (⚙️ → „🧪 Test: 2 kurze Szenen“): Er läuft zweimal hintereinander und
   umfasst
   - 2 × 5 s mit Stimme und 3D
   - Kodieren und Zusammensetzen
   - Abspieltest (Laden, Springen)
   - Messung der Ton-Synchronität (Einsatz des 2. Satzes)
7. Echtzeit-Aufnahme bleibt als Rückfall (jetzt 24 fps).

### 4. Tests (Cloud-VM, Chromium)

- **Selbsttest:** 2 × bestanden.
  - Datei spielt ab, und Springen funktioniert.
  - Der 2. Satz liegt bei 5,447 s (geplant 5,450 s, also −3 ms).
- **ffprobe:** H.264 High, 720 × 1280, 24/1 fps. Alle Bilddauern sind exakt 0,041667 s (CFR).
  moov steht vor mdat, die Datei ist nicht fragmentiert, und ffmpeg dekodiert sie fehlerfrei.
- **Absturz-Simulation:**
  1. Seite nach Szene 5 von 10 neu geladen.
  2. „Fortsetzen ab Szene 6“ angetippt.
  3. Ergebnis: vollständige 40-s-Datei, 967 Bilder, alle CFR, fehlerfrei dekodierbar.
- **Echtzeit-Rückfall** funktioniert. In der VM zeigt die QC ehrlich 7 fps und VFR, weil
  die VM keine echte Grafikkarte hat.

### 5. Grenzen (ehrlich)

- **Nicht auf dem iPhone getestet.** Ob die Abstürze weg sind, zeigt erst der Selbsttest auf
  dem Gerät.
- Safari bietet keine Speicher-Messung (`performance.memory` fehlt). Auf dem iPhone werden
  deshalb nur Fortschritt und Zeichenzeit protokolliert, kein RAM-Wert.
- Ob Safari auf dem iPhone den **H.264-VideoEncoder** und den **AAC-AudioEncoder** anbietet,
  ist offen. Ohne H.264-Encoder fällt die App auf die Echtzeit-Aufnahme zurück (VFR). Ohne
  AAC-Encoder wird der Ton einmal in Echtzeit aufgenommen; das kostet die Videolänge an Zeit.
- Bei der Ton-Aufnahme als Rückfall ist ein kleiner Versatz möglich (Startverzögerung des
  Recorders, typischerweise < 50 ms). Der Selbsttest misst ihn.
- Der Pixel-Wertebereich (voll/begrenzt) wird vom Encoder des Geräts bestimmt. In Chromium
  meldet ffprobe `yuvj420p`, auf dem iPhone (VideoToolbox) üblicherweise `yuv420p`.
- KI-Bilder-Modus: szenenweiser Export, aber ohne Fortsetzen (Bilder müssten neu geladen
  werden).

### 6. Server-Rendering (bewertet, nicht umgesetzt)

Es gibt keine Server-Infrastruktur. Eine kostenlose Möglichkeit wäre **GitHub Actions**.
Ein Workflow startet Chromium ohne Bildschirm, rendert mit genau diesem Code und packt die
MP4 mit ffmpeg. Das iPhone würde nur das Skript senden und die fertige MP4 laden.

Dafür bräuchte das iPhone einen GitHub-Token mit Schreibrechten, gespeichert im Browser. Das
ist ein Sicherheitsrisiko, und Wartezeit kommt dazu (Start ≈ 1–2 min, Rendern in Software).
Erst sinnvoll, falls der lokale Weg nach diesem Umbau auf dem iPhone weiterhin abstürzt.

---

## Version 26 – Low-Poly-3D, Remux, QC (vorherige Runde)

- Three.js-Low-Poly-Renderer, Storyboard-Shots, Kamera-Presets.
- Fragmentierte Recorder-MP4 wird zu einer progressiven MP4 umgepackt, plus automatische QC
  und Geräte-Check.
