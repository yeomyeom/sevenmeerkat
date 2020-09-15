// NOTE: 아직 기능 구현 되지 않음

var stTime;
var timerStart;

function working(act) {
    var msg;
    if (act == 'start')
        msg = "업무시작 하시겠습니까?"
    else
        msg = "정말로 업무종료 하시겠습니까?"

    var result = confirm(msg);
    if (result) {
        $.ajax({
            url: "/api/times",
            dataType: "json",
            data: { act: act },
            type: "POST",
            xhrFields: {
                withCredentials: true
            },
        })
        .done(function (data) {
            printTime()
        })
        .fail(errorHandler)
    }else {
        return;
    }

}

function printTime() {
    $.get("/api/times", function (data) {
        obj = data.items;
        if (!obj) {
            return;
        }
        var d1 = new Date(obj.start_time.$date);
        var d2 = null;
        if (!obj.end_time) {
            d2 = new Date(Date.now())
        }
        else {
            d2 = new Date(obj.end_time.$date);
        }
        var date = new Date(d2 - d1);
        var hour = date.getUTCHours();
        var min = date.getUTCMinutes();
        var sec = date.getUTCSeconds();
        var innerContents = hour + "시간" + min + "분"
        document.getElementById('working_time').innerHTML = innerContents
    });
}

function print_count() {

}