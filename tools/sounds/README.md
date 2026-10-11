# Sound pipeline

Real recordings from Freesound (CC0) and Wikimedia Commons (public domain / CC BY-SA), cut into short clips and embedded in `js/sounds.js`.

1. `python -m venv venv && venv/Scripts/pip install imageio-ffmpeg numpy` (ffmpeg comes with imageio-ffmpeg)
2. `node dl.mjs raw commons.json` downloads the Wikimedia Commons sources into `raw/` (rename audio files to `<key>.audio` if the extension comes out wrong)
3. `venv/Scripts/python fsdl.py fspicks.txt fsraw` downloads the Freesound previews into `fsraw/`
4. `venv/Scripts/python cut.py` cuts every clip listed in `cuts.txt` (source, start, length), high-passes, normalises and encodes MP3
5. `venv/Scripts/python build_js.py` writes `js/sounds.js` with the audio and the credits shown in the game

To change which recording a gun uses, edit the `GUN` table in `js/audio.js`.
