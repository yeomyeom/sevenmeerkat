var stTime;
var timerStart;


function post_to_url(path, params, method) {
    method = method || "post"; // Set method to post by default, if not specified.
    // The rest of this code assumes you are not using a library.
    // It can be made less wordy if you use one.
    var form = document.createElement("form");
    form.setAttribute("method", method);
    form.setAttribute("action", path);
    for(var key in params) {
        var hiddenField = document.createElement("input");
        hiddenField.setAttribute("type", "hidden");
        hiddenField.setAttribute("name", key);
        hiddenField.setAttribute("value", params[key]);
        form.appendChild(hiddenField);
    }
    document.body.appendChild(form);
    form.submit();
}


document.getElementById('start_btn').addEventListener('click', function(){
    if (!stTime) {
        stTime = new Date().getTime();
    }

    timeStart = setInterval(function(){
        var nowTime = new Date().getTime();
        newTime = new Date(nowTime - stTime);

        function humanReadable(seconds) {
            var pad = function(x) { return (x < 10) ? "0"+x : x; }
            return pad(parseInt(seconds / (60*60))) + ":" +
                   pad(parseInt(seconds / 60 % 60)) + ":" +
                   pad(seconds % 60)
          }
        document.getElementById('working_time').innerHTML = humanReadable(Math.round(newTime/1000));
    }, 1000)
})

document.getElementById('end_btn').addEventListener('click', function(){
    if(timeStart){
        clearInterval(timeStart);
    }
})
