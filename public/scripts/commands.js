function sonyTVPowerOn() {
    $.ajax({
        type: "PUT",
        url: "http://localhost:8000/buildings/ITB/rooms/1110",
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        data: {
            "displays": [{
                "name": "dp1",
                "power": "on"
            }]
        },
        success: sweetAlert("Yay!", "Command sent successfully!", "success"),
        contentType: "application/json; charset=utf-8"
    });
}

function sonyTVPowerOff() {
    $.ajax({
        type: "PUT",
        url: "http://localhost:8000/buildings/ITB/rooms/1110",
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        data: {
            "displays": [{
                "name": "dp1",
                "power": "standby"
            }]
        },
        success: sweetAlert("Yay!", "Command sent successfully!", "success"),
        contentType: "application/json; charset=utf-8"
    });
}

function switchInput(inputName) {
    var inputBody = {
        "currentVideoInput": inputName
    };

    $.ajax({
        type: "PUT",
        url: "http://localhost:8000/buildings/ITB/rooms/1110",
        headers: {
            'Access-Control-Allow-Origin': '*'
        },
        data: JSON.stringify(inputBody),
        success: sweetAlert("Yay!", "Command sent successfully!", "success"),
        contentType: "application/json; charset=utf-8"
    });
}