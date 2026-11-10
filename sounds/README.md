# Alarm sounds

Drop audio files here (`.mp3`, `.wav`, `.ogg`, `.m4a`, `.aac`, `.flac`, `.webm`) and they appear in the
**Focus → Alarm sound** dropdown after you press **Refresh** there. The file name becomes the label:
`soft-bell_02.mp3` shows as "soft bell 02".

Files in this folder are git-ignored (only this README is committed), so your downloads are never
pushed to GitHub. Check a sound's licence before redistributing it.

Good free sources:

- [Pixabay sound effects](https://pixabay.com/sound-effects/search/alarm/): free to use, no attribution required.
- [Mixkit](https://mixkit.co/free-sound-effects/alarm/): free sound effects under the Mixkit licence.
- [Freesound](https://freesound.org/search/?q=bell): huge library; each file has its own Creative Commons licence.

Short sounds (1–5 s) work best: the alarm loops until you dismiss it, for up to a minute.
To use another folder, set `SOUNDS_DIR` when starting the API.
