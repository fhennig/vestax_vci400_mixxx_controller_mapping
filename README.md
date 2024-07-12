> [!NOTE]
> I do not own this controller anymore, I'm not going to work on the controller mapping anymore.

# Vestax VCI 400 Mixxx MIDI Controller Mapping

A MIDI mapping for the Vestax-VCI 400 DJ controller.  In contrast to
the default setting, this controller has more mappings for loop
control (loop in/out buttons, adjustable loop sizes), a reworked
transport knob and controls for setting the beatgrid.

The mapping uses the Mixxx 2.0 MIDI mapping controls.

## Controls

The main controls are identical to the default mapping, identical to
what the buttons are labeled for.  This means the central controls for
individual channels: loading and syncing tracks, fading in and out,
the filter knob and the individual low/mid/high filters etc.

The other buttons are described below.  All 4 decks can be controlled
with the deck select switch.  If the alternate (C/D) deck is selected,
all individual deck buttons are controlling the alternate deck
(transport and loop controls, play and pause).

<p align="center">
  <img width="80%" src="controller.png"/>
</p>

- 1: Play/Pause button
- 2: Cue Button

Pink/Purple: Loop Controls
- 3: loop in
- 4: loop out
- 5: activate loop
- 6: deactivate loop
- 7
  - rotate: move loop region
  - press + rotate: halve/double loop region size
  - shift + rotate: adjust loop region size by 1

Blue: Transport Controls
- 8: Cue buttons 1 to 8. 
  - shift + press: delete cue point
- 9
  - rotate: move cursor through track
  - shift + rotate: change stepsize
  
Turquise & Green: Effects
- 10
  - knob: effect chain crossfade
  - button: activate/deactivate on master
- 11
  - knob: reverb strength
  - button: activate/deactivate reverb
- 12
  - knob 1: echo feedback strength
  - button 1: activate/deactivate echo
  - knob 2: echo delay time
  - button 2: ping-pong on/off
  
Gold
- 13
  - rotate: select track in library
  - click: load track into next free deck
  - shift + click: switch to playlist selection
    - rotate: switch through playlists
    - click: focus back on track selection in playlist
- 14: select waveform zoom
- 15:
  - top buttons: set beatgrid to cursor (left/right deck)
  - bottom buttons: sync beatgrid to other deck (left/right deck)

## Installation

Drop the files `Vestax-VCI-400_alternative-scripts.js` and `
Vestax-VCI-400_alternative.midi.xml` in your controller script
directory.  On linux this is `~/.mixxx/controllers`.

## Effects Setup

The effect controls are mapped to specific effects. In the second
effects rack the first effect should be `Reverb` and the second should
be `Echo`.
