/****************************************************************/
/*      Vestax VCI-400 MIDI controller script v2.00             */
/*   Copyright (C) 2011-2014, Owen Williams, Tobias Rafreider   */
/*      but feel free to tweak this to your heart's content!    */
/*      For Mixxx version 1.12                                  */
/****************************************************************/

// TODO
// XML file: wiki link, forum link
// licensing etc.
// https://community.risingstack.com/using-es6-modern-language-tools-to-program-midi-controller/
// https://www.mixxx.org/wiki/doku.php/controller_script_modules


///////////////////////////////////////////////////////////////
//               Helper stuff / Generic Components           //
///////////////////////////////////////////////////////////////

var ButtonState = {"released":0x00, "pressed":0x7F};


var LoadButton = function (options) {
    components.Button.call(this, options);
};
LoadButton.prototype = new components.Button({
    unshift: function () {
        this.inKey = 'LoadSelectedTrack';
    },
    shift: function () {
        this.inKey = 'eject';
    }
});


///////////////////////////////////////////////////////////////
//             Controller Definition                         //
///////////////////////////////////////////////////////////////

VCI400 = new function () {
    this.controllerName = "VCI400";   // same string as the name of the object!
    // Shift handling
    this.shiftActivate = function (channel, control, value, status, group) {
        if (value === ButtonState.pressed) {
            this.shift();
        } else {
            this.unshift();
        }};
  
    // Library Scroll Button
    this.scrollKnobButton = new components.Button({
        group: "[Library]",
        unshift: function() {
            this.inKey = "GoToItem";
            this.disconnect();
            this.connect(); },
        shift: function() {
            this.inKey = "MoveFocusBackward";
            this.disconnect();
            this.connect(); }});

    // Waveform zoom

    this.waveformZoom = function (channel, control, value) {
        // value is from 0x00 to 0x7F (0 to 127)
        // value to set is from 1 to 10
        // Also, if the slider is up, zoom should be 100%
        value = (1 - (value / 0x7F)) * 9 + 1
        engine.setValue("[Channel1]", "waveform_zoom", value);
    };
  
    // Common Channel functionality.  This includes "Deck" functionality
    // The hardware controllers sends different control codes depending on the
    // "DECK SELECT" switch
    this.Channel = function (group, internalName, midiOffset, deckNumber) {
        components.ComponentContainer.call(this);

        // Central Vertical Channel unit

        this.loadButton = new LoadButton({
            midi: [0x92 + midiOffset, 0x02]});
        this.syncButton = new components.SyncButton({
            midi: [0x92 + midiOffset, 0x01]});
    
        this.onVuMeterChanged = function (value) {
            var normalizedVal = parseInt(value*127);
            midi.sendShortMsg(0xB2 + midiOffset, 17, normalizedVal);
        };

                // hotcue buttons, the 8 pad buttons
        var hotcues = [];
        for (var i = 0; i < 8; i++) {
            hotcues[i] = new components.HotcueButton({
                number: i + 1,
                midi: [0x092 + midiOffset, 0x07 + i]});
        }
        this.hotcue1Button = hotcues[0];
        this.hotcue2Button = hotcues[1];
        this.hotcue3Button = hotcues[2];
        this.hotcue4Button = hotcues[3];
        this.hotcue5Button = hotcues[4];
        this.hotcue6Button = hotcues[5];
        this.hotcue7Button = hotcues[6];
        this.hotcue8Button = hotcues[7];
    
        
        // Vinyl Scratch handling
        this.vinylButton = function (ch, ctrl, value, s, group) {
            // just do nothing, this button is weird.  It's a toggle, maybe that's useful?
        };
    
        // called when the wheel is touched, i.e. the led goes from white to red.
        this.wheelTouch = function(ch, ct, value) {
            if(value === ButtonState.pressed) {
                var alpha = 1.0/8;
                var beta = alpha/32;
                engine.scratchEnable(deckNumber, 2048, 33+1/3, alpha, beta, true);
            } else {
                engine.scratchDisable(deckNumber, true)
            }
        };
    
        // The wheel was moved.  If it is touched as well, we scratch, otherwise we jog
        this.wheelMove = function (ch, ctrl, value) {
            var newValue = value - 0x40;  // 0x40 is zero for this controller
            if (engine.isScratching(deckNumber)) {
                engine.scratchTick(deckNumber, newValue); // Scratch!
            } else {
                engine.setValue(group, 'jog', newValue);
            }
        };
    
        // Transport Knob
        this.transportKnobPressed = false;
        this.transportKnobStepSizes = [1, 4, 16, 64];
        this.transportKnobStepIndex = 1;
        this.transportKnobPress = function (channel, control, value) {
            if (value === ButtonState.pressed) {
                this.transportKnobPressed = true;
            } else {
                this.transportKnobPressed = false;
            }
        };
        this.transportKnobTwist = function (channel, control, value) {
            var jogValue = value - 0x40;      // neg if forwards, pos if backwards!!
            if (this.transportKnobPressed) {  // adjust step size instead of transporting
                x = this.transportKnobStepIndex;
                if (jogValue < 0) {
                    x += 1;
                } else {
                    x -= 1;
                }
                x = Math.max(0, x);
                x = Math.min(x, this.transportKnobStepSizes.length - 1);
                this.transportKnobStepIndex = x;
                engine.setValue(group, "beatjump_size",
                                this.transportKnobStepSizes[this.transportKnobStepIndex]);
            } else {                          // jump
                if (jogValue < 0) {
                    engine.setValue(group, "beatjump_forward", 1);
                    engine.setValue(group, "beatjump_forward", 0);
                } else {
                    engine.setValue(group, "beatjump_backward", 1);
                    engine.setValue(group, "beatjump_backward", 0);
                }
            }
        };
    
        // Loop Resizing Knob
        this.loopKnobPressed = false;
        this.loopKnobPress = function (channel, control, value) {
            if (value === ButtonState.pressed) {
                this.loopKnobPressed = true;
                if (this.isShifted) {
                    engine.setValue(group, "beatloop_size", 4); // TODO put this constant somewhere
                }
            } else {
                this.loopKnobPressed = false;
            }
        };
        this.loopKnobTwist = function (channel, control, value) {
            // not pressed, not shifted: move loop by 1 / -1
            //     pressed, not shifted: double / halve loop
            // not pressed,     shifted: resize loop by 1 / -1
            var rightTwist = (value - 0x40) < 0;
            if (this.loopKnobPressed) {
                if (this.isShifted) {
                    // shifted and pressed -> we do nothing
                } else {
                    // not shifted, but knob is pressed -> double / halve
                    if (rightTwist) {
                        engine.setValue(group, "loop_double", 1);
                        engine.setValue(group, "loop_double", 0);
                    } else {
                        engine.setValue(group, "loop_halve", 1);
                        engine.setValue(group, "loop_halve", 0);
                    }
                }
            } else {
                if (this.isShifted) {
                    // just shifted -> resize
                    var newSize = engine.getValue(group, "beatloop_size");
                    print(newSize);
                    if (rightTwist) {
                        newSize += 1;
                    } else {
                        newSize -= 1;
                    }
                    engine.setValue(group, "beatloop_size", newSize);
                } else {
                    // not shifted and knob not pressed -> move loop by 1
                    if (rightTwist) {
                        engine.setValue(group, "loop_move", 1);
                    } else {
                        engine.setValue(group, "loop_move", -1);
                    }
                }
            }
        };


        this.init = function () {
            // turn of vinyl button
            engine.connectControl(group, "VuMeter", internalName + ".onVuMeterChanged");
            
        };

        // set the group for all the components inside the deck
        this.reconnectComponents(function (c) { c.group = group; });
    };
    this.Channel.prototype = new components.ComponentContainer();
    
    
    // Initialize Channels
    this.channelA = new this.Channel("[Channel1]", this.controllerName + ".channelA", 0, 1);
    this.channelB = new this.Channel("[Channel2]", this.controllerName + ".channelB", 1, 2);
    this.channelC = new this.Channel("[Channel3]", this.controllerName + ".channelC", 2, 3);
    this.channelD = new this.Channel("[Channel4]", this.controllerName + ".channelD", 3, 4);


    // Groups the 6 Buttons on the left and right bottom of the controller.
    // These are not affected by the hardware "DECK SELECT" switch, so these need to
    // be managed as a "Deck"
    this.BottomSection = function (deckNumbers, midiOffset) {
        // Initialize this as a deck, to use the flipping mechanism
        components.Deck.call(this, deckNumbers);

        // Play and Cue Button
        this.playButton = new components.PlayButton([0x92 + midiOffset, 0x1A]);
        this.cueButton = new components.CueButton([0x92 + midiOffset, 0x19]);
    
        // Loop Controls
        this.loopInButton = new components.Button({
            midi: [0x94 + midiOffset, 0x1B + (midiOffset * 2)],
            key: "loop_in"});
        this.loopOutButton = new components.Button({
            midi: [0x94 + midiOffset, 0x1C + (midiOffset * 2)],
            key: "loop_out"});
        this.loopDefaultButton = new components.Button({
            midi: [0x94 + midiOffset, 0x1D - (midiOffset * 2)],
            key: "beatloop_activate",
            off: 0x7F, on: 0x00});  // make the button lit up by default
        this.loopExitButton = new components.Button({
            midi: [0x94 + midiOffset, 0x1E - (midiOffset * 2)],
            key: "reloop_toggle",
            off: 0x7F, on: 0x00});  // make the button lit up by default

        // Beatgrid adjust buttons
        // These are actually not in the bottom section but are treated as if they were
        this.beatsTranslateCurPosButton = new components.Button({
            midi: [0x9E, 0x6B + midiOffset],
            key: "beats_translate_curpos"});
        this.beatsTranslateMatchAlignmentButton = new components.Button({
            midi: [0x9E, 0x6D + midiOffset],
            key: "beats_translate_match_alignment"});
        
        // Deck Select Switch:
        // helper Function, because we cannot use Deck.toggle
        this.setCurrentDeckByIndex = function(i) {
            this.setCurrentDeck("[Channel" + this.deckNumbers[i] + "]");
        };
        this.deckSelect = function (channel, control, value) {
            // This should be mapped to control 0x22
            // 0x22 works like a button that is held down.
            // If it is activated we are in A/B mode, if it is 0 we are in C/D mode
            if (value === ButtonState.pressed) {
                this.setCurrentDeckByIndex(0)
            } else {
                this.setCurrentDeckByIndex(1)
            }
        };

        // set the group for all the components inside the deck
        this.reconnectComponents(function (c) {
            if (c.group === undefined) {
                // 'this' inside a function passed to reconnectComponents refers to the ComponentContainer
                // so 'this' refers to the custom Deck object being constructed
                c.group = this.currentDeck;
            }
        });
    };
    this.BottomSection.prototype = new components.Deck();

    // Create bottom sections
    this.leftBottomSection = new this.BottomSection([1, 3], 0);
    this.rightBottomSection = new this.BottomSection([2, 4], 1);

    // Effects Rack
    this.RevEchoEffectRack = function (unitId) {
        components.ComponentContainer.call(this);
        var unit = "[EffectRack1_EffectUnit" + unitId + "]";
        var reverbEffect = "[EffectRack1_EffectUnit" + unitId + "_Effect1]";
        var echoEffect = "[EffectRack1_EffectUnit" + unitId + "_Effect2]";

        // Dry/Wet Knob / Knob 1
        this.dryWetKnob = function (channel, control, value) {
            value = value / 0x7F;
            engine.setValue(unit, "mix", value);
        };

        this.reverbKnob = function (channel, control, value) {
            value = value / 0x7F;
            engine.setValue(reverbEffect, "meta", value);
        };

        this.echoKnob = function (channel, control, value) {
            // the function is split in two parts
            if (value < 0x40) {
                value = value / 0x3F;
                engine.setValue(echoEffect, "parameter2", value);
                engine.setValue(echoEffect, "parameter4", value);
            } else {
                value = value - 0x40;
                value = value / 0x3F;
                value = 1 - value;
                engine.setValue(echoEffect, "parameter2", value);
                engine.setValue(echoEffect, "parameter4", 0);
            }
        };

        this.echoTimeEncoder = function (channel, control, value) {
            var jogValue = value - 0x40;      // neg if forwards, pos if backwards!!
            var echoTimeExp = Math.log(engine.getValue(echoEffect, "parameter1")) * Math.LOG2E;
            if (jogValue < 0) {
                echoTimeExp = Math.min(echoTimeExp + 1, 1);
            } else {
                echoTimeExp = Math.max(echoTimeExp - 1, -4);
            }
            engine.setValue(echoEffect, "parameter1", Math.pow(2, echoTimeExp));
            // TODO press functionality:
            // - button press -> reset to 0.5 (or 1, doesn't matter)
            // - if scrolled while pressed: halve or double time
            //   -> pressing allows for exact echos
            // - normal scroll: 0.03 (or similar) increments
        };

        this.pingPongValueStore = 0.3;
        this.echoPingPongToggle = function (channel, control, value, status) {
            if (value == ButtonState.pressed) {
                var pingPongValue = engine.getValue(echoEffect, "parameter3");
                if (pingPongValue == 0) {
                    pingPongValue = pingPongValueStore;
                    pingPongValueStore = 0;
                } else {
                    pingPongValueStore = pingPongValue;
                    pingPongValue = 0;
                }
                engine.setValue(echoEffect, "parameter3", pingPongValue);
                midi.sendShortMsg(status, control, pingPongValue > 0);
            }
        };
    };
    this.RevEchoEffectRack.prototype = new components.ComponentContainer();

    this.rightEffectRack = new this.RevEchoEffectRack(2);


    this.SingleEffectRack = function(unitId, midiOffset) {
        components.ComponentContainer.call(this);
        var pot = new components.Pot();

        this.knob1 = function (channel, control, value) {
            // lfoPeriod
            value = value/0x7F;         // 0 .. 1
            value = 1 - value;          // 1 .. 0
            value = value * 7 - 2;      // 5 .. -2
            value = Math.pow(2, value); // 32 .. 0.25
            engine.setValue("[EffectRack1_EffectUnit" + unitId + "_Effect2]", "parameter1", value);
        };

        this.knob2 = function (channel, control, value) {
            value = value / 0x7F;           // map to 0 .. 1
            engine.setValue("[EffectRack1_EffectUnit" + unitId + "_Effect2]", "meta", value);
        };

        this.knob3 = function (channel, control, value) {
            value = value / 0x7F;           // map to 0 .. 1
            engine.setValue("[EffectRack1_EffectUnit" + unitId + "_Effect2]", "parameter4", value);
        };

        // Dry/Wet Knob
        var stepSize = 0.08;
        this.dryWetKnob = function (channel, control, value) {
            var group = "[EffectRack1_EffectUnit" + unitId + "]";
            var jogValue = value - 0x40;      // neg if forwards, pos if backwards!!
            var mix = engine.getValue(group, "mix");
            if (jogValue < 0) {
                mix = Math.min(mix + stepSize, 1);
            } else {
                mix = Math.max(mix - stepSize, 0);
            }
            engine.setValue(group, "mix", mix);
        };
        
    };
    this.SingleEffectRack.prototype = new components.ComponentContainer();

    this.leftEffectRack = new this.SingleEffectRack(1, 0);
    

    
    // Handle Master VU Meter
    this.enableMasterVu = true;   // TODO define this initialization constant elsewhere
    this.onMasterVuMeterRChanged = function (value) {
        if (this.enableMasterVu) {
            var normalizedVal = parseInt(value*127);
            midi.sendShortMsg(0xBE, 44, normalizedVal);
        }
    };
    this.onMasterVuMeterLChanged = function (value) {
        if (this.enableMasterVu) {
            var normalizedVal = parseInt(value*127);
            midi.sendShortMsg(0xBE, 43, normalizedVal);
        }
    };
    this.resetMasterVu = function () {
        if (this.enableMasterVu) {
            this.onMasterVuMeterRChanged(0);
            this.onMasterVuMeterLChanged(0);
        }
    };
    

    // Initialization called at the very beginning
    this.init = function () {
        // Set this.  I don't know what it does but it's probably useful
        engine.setValue("[Master]", "num_decks", 4);
        
        this.channelA.init();
        this.channelB.init();
        this.channelC.init();
        this.channelD.init();

        // connect controls
        engine.connectControl("[Master]", "VuMeterL", this.controllerName + ".onMasterVuMeterLChanged");
        engine.connectControl("[Master]", "VuMeterR", this.controllerName + ".onMasterVuMeterRChanged");
    
        // Reset VU Meters
        this.resetMasterVu();
    };
    
    
    // Called at shutdown of Mixxx
    this.shutdown = function () {
        // Reset VU Meters
        this.resetMasterVu();
    };
};
// make it a ComponentContainer, so we can use the shift functionality
VCI400.__proto__ = new components.ComponentContainer();
