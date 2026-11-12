# GRANDPA'S CASINO – Prototyp Phase 1

3D-Mobile-Spiel im Toy-Diorama-Stil (Hochformat, Touch). Technik: **Three.js im Browser** (läuft auf jedem Smartphone ohne App-Store, auch als Home-Bildschirm-App).
Nur virtuelles Spielgeld – kein echtes Glücksspiel, keine Echtgeld-Käufe.

## Ordnerstruktur

```
casino.html                 Seite + komplette Oberfläche (HUD, Menüs, Dialoge, CSS)
public/casino-icon-180.png  App-Icon für den Home-Bildschirm
src/casino/
  main.js        Spielablauf: verbindet alle Systeme, Spielmodi (Menü / Intro / Spiel / Pause)
  models.js      alle 3D-Modelle prozedural (Figuren, Häuser, Automaten, Möbel, Texturen)
  world.js       BuildingSystem: Stadt (1 Straße, 10 Häuser), Casino außen/innen, Kollision, Renovierungen, Diorama-Schnitt
  player.js      PlayerController (Laufen) + CameraController (Ego-Perspektive, Wischen, leichtes Kopfwippen)
  input.js       MobileJoystick (links unten) + Kamera-Wischen (rechts) + Tastatur/Maus zum Testen am PC
  interact.js    InteractionSystem (benutzt wird, was im Fadenkreuz ist)
  placement.js   ObjectPlacementSystem (Objekt erscheint, wo man hinschaut; zeigt automatisch zum Spieler) + platzierte Objekte
  economy.js     EconomyManager – ALLE Preise/Werte zentral (Automaten, Möbel, Renovierungen, Level)
  quests.js      QuestManager – Aufgaben mit Belohnung
  save.js        SaveSystem – Spielstand + Einstellungen im Gerät (localStorage)
  ui.js          UIManager – HUD, Meldungen, Bau-Menü
  menu.js        MainMenuManager – Hauptmenü, Einstellungen, Intro (Opas Brief)
  guests.js      Gäste, die kommen, an freien Automaten spielen, zahlen und gehen
  audio.js       Soundeffekte (WebAudio, ohne Dateien)
  music.js       entspannte Lounge-Musik (Endlosschleife, WebAudio)
```

## Starten (am PC)

```
npm install
npm run dev
```
Dann `http://localhost:5173/casino.html` öffnen. Steuerung am PC: **WASD** laufen, **Maus ziehen** Kamera, **E** interagieren.

## Auf dem Smartphone testen

- Online: `https://kevinharsc-cyber.github.io/whatif-video-maker/casino.html`
- Im gleichen WLAN: `npm run dev -- --host` und die angezeigte Netzwerk-Adresse + `/casino.html` am Handy öffnen.
- Als App: Safari → Teilen → „Zum Home-Bildschirm“.

Steuerung (Ego-Perspektive): Joystick links unten = laufen, rechts wischen = umschauen, Punkt in der Mitte = Fadenkreuz, runder Knopf rechts unten = benutzen, was man anschaut.

Bauen: im Casino 🔨 BAUEN → unten ein Objekt antippen → auf den Boden schauen → PLATZIEREN (kostet direkt, wenn nicht im Inventar; man kann gleich weiterbauen). ⟳ dreht. Im Bau-Modus ein Objekt anschauen → VERSCHIEBEN oder 📦 Einlagern. 🧰 = Renovieren.

## Spielablauf Phase 1

Brief vom Opa → Schlüssel, 1.000 $, erster Automat → Tür aufschließen → Gebäude erkunden → Automat aufstellen → Hebel „Casino eröffnen“ → Gäste spielen → Einnahmen einsammeln → 2. Automat (500 $) → Kassentresen (750 $, sammelt automatisch) → Sitzbereich, Licht, Deko → Renovierungen (Tür, Schild, Licht, Boden, Wände).

## Nächste Phasen (geplant)

Pokertische & Roulette, Mitarbeiter einstellen, zweiter Raum / Erweiterung, Tag-Nacht-Wechsel, Musik.
