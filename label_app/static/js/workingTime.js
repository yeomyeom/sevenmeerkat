// NOTE: 아직 기능 구현 되지 않음

var stTime;
var timerStart;

function workingStart() {
    $.ajax({
        url: "/api/time_setting",
        dataType: "json",
        data: {act: "start"},
        type: "POST",
        xhrFields:{
            withCredentials: true
        },
    })
}


function workingEnd() {
    $.ajax({
        url: '/api/time_setting',
        data: {act: 'end'},
        method: 'POST',
        xhrFields:{
            withCredentials: true
        },
    })
}


function printTime(){
    $.get("/api/time_setting", function(data) {
        document.getElementById('working_time').innerHTML = data + "Not yet";
    });
}

function print_count(){

}