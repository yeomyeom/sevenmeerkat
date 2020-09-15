//////////////////////////////////////////////////
// typeSelectionControl에서  이미 jsonData 불러옴 ///
// typeSelectionControl에서  이미 task_name 불러옴 //
//////////////////////////////////////////////////
let wrapper = document.getElementById("workspace");

function loadInputBox(jsonData){
    var inputgroup = document.createElement("div");
    inputgroup.setAttribute("class", "form-group col-xs-5 col-lg-1");
    var inputbox = document.createElement("input");

    var guidetext = '';
    if (jsonData.is_labeled == 1)
    {
        guidetext += jsonData.label;
        inputbox.value = guidetext;
    } else {
        guidetext += "왼편에 있는 label 양식을 잘 확인하고 작성해주세요.";
    }

    inputbox.setAttribute("type", "text");
    inputbox.setAttribute("class", "form-control");
    inputbox.setAttribute("id", "textinput");
    inputbox.setAttribute("style", "max-width:500px;");
    inputbox.setAttribute("placeholder", guidetext);

    inputgroup.appendChild(inputbox);
    wrapper.appendChild(inputgroup);

}


document.getElementById("submit").onclick = function(){
    var outputText = document.getElementById("textinput").value;
    let lastData = new Object();
    lastData.label = outputText;
    lastData.kind = jsonData.kind;

    
    $.ajax({
        method: "POST",
        url: "/api/label/" + task_name,
        data: JSON.stringify(lastData),
        xhrFields:{
            withCredentials: true
        },
        dataType: 'json',
        success: function() {
            location.reload();
        },
        error: function(err) {
        }
    }).done(function(){

        location.href = "/label/" + task_name;
    })
}

document.getElementById("next_button").onclick = function(){
    location.href = "/label/" + task_name;
}

window.onload = canvasResize(jsonData);
window.onload = loadInputBox(jsonData);