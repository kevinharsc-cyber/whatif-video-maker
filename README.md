# 🎬 Was-wäre-wenn Video Maker

Eine Web-App, die automatisch deutschsprachige **„Was wäre, wenn …?“-Videos** für TikTok und YouTube Shorts erstellt – direkt auf dem iPhone, ohne Installation und ohne laufende Kosten.

**Was die App macht:**

1. Du gibst ein Thema ein, z. B. *„Was wäre, wenn die Erde plötzlich stehen bleibt?“*
2. Eine KI schreibt ein spannendes deutsches Skript für etwa 60 Sekunden, aufgeteilt in Szenen.
3. Du kannst das Skript ansehen und ändern.
4. Für jede Szene wird ein KI-Bild gemalt.
5. Eine deutsche KI-Stimme liest den Text vor.
6. Die Untertitel laufen automatisch mit der Stimme mit, das gerade gesprochene Wort ist gelb.
7. Alles wird zu einem **MP4-Video im Hochformat 9:16** (1080 × 1920), das du in deinen Fotos speicherst.

---

## 💶 Kosten: 0 €

| Baustein | Dienst | Kosten |
|---|---|---|
| Skript | [Pollinations.ai](https://pollinations.ai), ohne Anmeldung; optional **Google Gemini** | kostenlos |
| Bilder | Pollinations.ai (Modell „Flux“), **kostenloser Schlüssel nötig** | kostenlos |
| Stimme | **Piper**, eine Open-Source-Stimme, die direkt auf deinem iPhone läuft; optional Gemini-Stimmen | kostenlos |
| Untertitel und Video | entstehen im Browser auf deinem iPhone | kostenlos |
| Webseite | GitHub Pages | kostenlos |

Es gibt keinen eigenen Server, also auch keine Serverkosten. Die ganze Arbeit passiert in Safari auf deinem iPhone.

---

## 🚀 Einrichtung nur mit dem iPhone (einmalig, ca. 5 Minuten)

Öffne diese Seiten in **Safari** auf deinem iPhone. Tipp: In Safari unten auf **„aA“** tippen und **„Desktop-Website anfordern“** wählen, dann findest du alle Knöpfe von GitHub leichter.

### Schritt 1 – Repository öffentlich machen

GitHub Pages ist kostenlos, aber nur für **öffentliche** Repositories. Das ist unbedenklich: Im Code stehen keine Passwörter. Deinen optionalen API-Schlüssel trägst du später nur in der App auf deinem iPhone ein.

1. Öffne `https://github.com/kevinharsc-cyber/whatif-video-maker`
2. Tippe auf **Settings**, ganz unten auf **Change visibility** und dann auf **Make public**.

> Willst du das Repository lieber privat lassen? Dann lies weiter unten [Alternative: Vercel](#alternative-vercel-repository-bleibt-privat).

### Schritt 2 – GitHub Pages einschalten

1. Im Repository: **Settings → Pages** (links im Menü)
2. Unter **Build and deployment → Source** wählst du **GitHub Actions**.

### Schritt 3 – Veröffentlichung starten

1. Tippe oben auf **Actions**.
2. Wähle links **„Veröffentlichen (GitHub Pages)“**, dann **Run workflow** und noch einmal **Run workflow**.
3. Warte etwa 1–2 Minuten, bis ein grüner Haken ✅ erscheint.
4. Deine App ist jetzt unter dieser Adresse erreichbar:
   **`https://kevinharsc-cyber.github.io/whatif-video-maker/`**

Danach wird die App bei jeder Änderung auf `main` automatisch neu veröffentlicht.

### Schritt 4 – Als App auf den Home-Bildschirm

1. Öffne die Adresse oben in **Safari**.
2. Tippe auf **Teilen** (Quadrat mit Pfeil) und dann auf **„Zum Home-Bildschirm“**.
3. Jetzt hast du ein App-Symbol **„?!“** wie bei einer echten App.

---

## 📱 Benutzung

1. **Thema eingeben** oder einen der Vorschläge antippen und dann auf **✨ Skript erstellen** tippen.
2. **Skript prüfen:** Du kannst jeden Satz ändern, Szenen löschen oder hinzufügen. Unter „Bildbeschreibung“ steht, was auf dem Bild zu sehen sein soll.
3. Auf **🎬 Video erstellen** tippen. Die App
   - malt die Bilder (ca. 5–15 Sekunden pro Bild),
   - erzeugt die Stimme (**beim allerersten Mal** wird die Stimme einmalig geladen, ca. 60 MB, am besten im WLAN),
   - nimmt das Video in Echtzeit auf (ein 60-Sekunden-Video dauert also 60 Sekunden).

   ⚠️ **Lass die App dabei geöffnet und den Bildschirm an.** Wenn das iPhone in den Ruhezustand geht, wird die Aufnahme unterbrochen.
4. **📲 Auf iPhone speichern / teilen** antippen und dann **„Video sichern“** wählen. Das Video liegt jetzt in deiner Fotos-App und kann bei TikTok oder YouTube hochgeladen werden.
5. Mit **📋 Beschreibung kopieren** bekommst du Titel und Hashtags für den Post.

### Einstellungen (⚙️ oben rechts)

- **Stimme:** mehrere kostenlose deutsche Stimmen (männlich und weiblich). Mit **🔊 Stimme testen** hörst du eine Probe. *(Kein Ton? Prüfe den Stummschalter an der Seite deines iPhones.)*
- **Sprechtempo:** 1,10× wirkt oft „TikTok-typischer“.
- **Bildstil:** Kinofilm, Foto, Sci-Fi, Anime oder Comic.
- **Videoqualität:** 1080p (empfohlen) oder 720p (schneller).
- **Hintergrund-Sound:** ein leiser, selbst erzeugter Klangteppich mit „Whoosh“-Effekten, ohne Urheberrechtsprobleme.
- **Google-Gemini-Schlüssel (optional, empfohlen):** Damit werden die Skripte besser und zuverlässiger, und du bekommst sehr natürliche Gemini-Stimmen.
  So bekommst du ihn kostenlos:
  1. [aistudio.google.com/apikey](https://aistudio.google.com/apikey) öffnen und mit deinem Google-Konto anmelden.
  2. **„Create API key“** antippen und den Schlüssel (beginnt mit `AIza…`) kopieren.
  3. In der App unter ⚙️ einfügen und **Speichern** antippen.

- **Pollinations-Schlüssel (für KI-Bilder, kostenlos):**
  1. [enter.pollinations.ai](https://enter.pollinations.ai) öffnen und anmelden (z. B. **mit GitHub**).
  2. Einen Schlüssel erstellen und kopieren.
  3. In der App unter ⚙️ bei „Pollinations-Schlüssel“ einfügen → **Speichern**.

---

## 🛟 Probleme und Lösungen

| Problem | Lösung |
|---|---|
| „Hinweis: Es wurde die eingebaute Vorlage genutzt“ | Der kostenlose Skript-Dienst war gerade überlastet. Versuche es noch einmal oder trage einen Gemini-Schlüssel ein. |
| Bilder sind nur bunte „Planeten“ / „HTTP 402“ | Der Bilddienst Pollinations gibt ohne Schlüssel kaum noch Bilder heraus. Hol dir einen kostenlosen Schlüssel (siehe unten) und trag ihn unter ⚙️ ein. |
| Aufnahme hängt bei „0 / 47 s“ oder „⏸️ iOS hat den Ton pausiert“ | Tippe auf **„▶️ Aufnahme fortsetzen“**. Hilft das nicht: Musik, Podcasts oder Videos in anderen Apps stoppen (die belegen den Ton) und erneut tippen. |
| Die Stimme lädt sehr lange | Beim ersten Mal werden etwa 60 MB geladen. Am besten im WLAN. Danach bleibt die Stimme gespeichert. Die Stimme „Eva“ ist kleiner. |
| Kein Ton beim Stimmtest | Den Stummschalter am iPhone ausschalten und die Lautstärke erhöhen. |
| Das Video ist abgebrochen | Den Bildschirm nicht sperren und nicht in eine andere App wechseln. |
| Das Video ist kürzer oder länger als 60 Sekunden | Im Skript Sätze kürzen oder ergänzen. Über den Szenen siehst du die geschätzte Dauer. Oder das Sprechtempo anpassen. |

---

## Alternative: Vercel (Repository bleibt privat)

1. Öffne [vercel.com](https://vercel.com) und melde dich mit **„Continue with GitHub“** an.
2. Tippe auf **Add New → Project**, wähle `whatif-video-maker` und tippe auf **Deploy**. Vercel erkennt alles automatisch.
3. Nach etwa einer Minute bekommst du eine Adresse wie `https://whatif-video-maker.vercel.app`.

---

## 🧠 Wie es technisch funktioniert (für Neugierige)

```
index.html            Oberfläche (die 4 Schritte + Einstellungen)
src/main.js           Steuert den Ablauf: Thema → Skript → Bilder → Stimme → Video
src/script.js         Skript-KI: Gemini → Pollinations → eingebaute Vorlage (Notfall)
src/images.js         KI-Bilder von Pollinations + Ersatzbild, falls ein Bild fehlt
src/tts.js            Stimme: Piper (läuft im Browser) oder Gemini TTS
src/subtitles.js      Verteilt die Wörter zeitlich passend auf die Sprachspur
src/renderer.js       Zeichnet jedes Videobild (Zoom, Überblendung, Untertitel) und nimmt es als MP4 auf
src/vendor/           Lautschrift-Umwandlung für die Piper-Stimme (MIT-Lizenz)
scripts/copy-ort.js   Kopiert die Stimm-Programmdateien beim Bauen in den Ordner der App
.github/workflows/    Automatische Veröffentlichung auf GitHub Pages
```

- **Synchrone Untertitel:** Jede Szene wird einzeln vertont. Dadurch weiß die App auf die Millisekunde, wann eine Szene beginnt und endet. Innerhalb einer Szene werden die Wörter nach ihrer Länge und nach Satzzeichen-Pausen verteilt.
- **MP4 auf dem iPhone:** Safari nimmt das Video mit dem eingebauten Video-Encoder des iPhones direkt als MP4 (H.264 + AAC) auf.

### Lokal am Computer entwickeln (optional)

```bash
npm install
npm run dev      # startet die App unter http://localhost:5173
npm run build    # baut die fertige Version in den Ordner dist/
```
