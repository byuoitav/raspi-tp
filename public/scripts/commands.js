var outputDisplay; // defaults are the first valid options in the displays array
var outputAudio; // set in main.js
var displayBlanked = false;

function setDisplayOutput(device) {
    console.log("set display output to:", device);
    outputDisplay = device;
}

function setAudioOutput(device) {
    console.log("set audio output to:", device);
    outputAudio = device;
}

function switchDisplayInput(input) {
    console.log("switching display input of", outputDisplay, "to", input);

    var body = {};

    body = {
        displays: [{
            name: outputDisplay,
            input: input
        }]
    };

    console.log(body);

    put(body);
}

function switchAudioInput(input) {
    console.log("switching audio input of", outputAudio, "to", input);

    var body = {};

    body = {
        audioDevices: [{
            name: outputAudio,
            input: input
        }]
    };

    console.log(body);

    put(body);
}

function blankDisplay() {
    console.log("blank/unblank display");

    var body = {};

    body = {
        displays: [{
            name: outputDisplay,
            blanked: true
        }]
    };

    if (displayBlanked == true) {
        body.displays[0].blanked = false;
        displayBlanked = false;
    } else {
        displayBlanked = true;
    }

    console.log(body);

    put(body);
    showVolume();
}

var volumeIncrement = 1;

function increaseVolume() {
    if (volume == "MUTED") {
        volume = previousVolume;
    }

    if (volume < 100) {
        volume += volumeIncrement;
    }

    console.log("pressed volume up");

    var body = {
        audioDevices: [{
            name: outputAudio,
            volume: volume
        }]
    };

    console.log(body);

    quietPut(body);
    showVolume();
}

function decreaseVolume() {
    if (volume == "MUTED") {
        volume = previousVolume;
    }

    if (volume > 0) {
        volume -= volumeIncrement;
    }

    console.log("pressed volume down");

    var body = {
        audioDevices: [{
            name: outputAudio,
            volume: volume
        }]
    };

    console.log(body);

    quietPut(body);
    showVolume();
}

function muteVolume() {
    console.log("mute/unmute volume");

    var body = {
        audioDevices: [{
            name: outputAudio,
            muted: true
        }]
    };

    if (volume == "MUTED") {
        volume = previousVolume;
        body.audioDevices[0].muted = false;
    } else {
        previousVolume = volume;
        volume = "MUTED";
    }

    console.log(body);

    put(body);
    showVolume();
}

function powerOn() {
    if (outputDisplay == "room") {
        body = {
            power: "on"
        };
    } else {
        body = {
            displays: [{
                name: outputDisplay,
                power: "on"
            }]
        };
    }

    put(body);
}

function powerOff() {
    if (outputDevice == "room") {
        body = {
            power: "standby"
        };
    } else {
        body = {
            displays: [{
                name: outputDisplay,
                power: "standby"
            }]
        };
    }

    put(body);
}

function put(body) {
    $.ajax({
        type: "PUT",
        url: url,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        data: JSON.stringify(body),
        success: pleaseWait(),
        contentType: "application/json; charset=utf-8"
    });
}

function quietPut(body) {
    $.ajax({
        type: "PUT",
        url: url,
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        data: JSON.stringify(body),
        contentType: "application/json; charset=utf-8"
    });
}
