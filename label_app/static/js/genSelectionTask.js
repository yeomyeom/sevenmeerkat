//////////////////////////////////////////////////
// typeSelectionControl에서  이미 jsonData 불러옴 ///
// typeSelectionControl에서  이미 task_name 불러옴 //
//////////////////////////////////////////////////


let wrapper = document.getElementById("workspace");


function genSelectOption(){
    var sWrapper = document.createElement("select");
    sWrapper.setAttribute("id", "select-item");
    //sWrapper.setAttribute("placeholder", jsonData.label);

    if (jsonData.is_labeld == 0){
        
        sWrapper.setAttribute("placeholder", "검색 또는 드롭다운 메뉴를 통해 선택하시면 됩니다.");
    } else {

        sWrapper.setAttribute("placeholder",jsonData.label)
    }

    var o1 = document.createElement("option");
    o1.setAttribute("value", "");
    o1.innerHTML = "여기에서 Label선택하세요" 
    sWrapper.appendChild(o1);
    
    var sList = jsonData.selection_list.split(",");

    sList.forEach(
        element => 
        sWrapper.appendChild(genOptionItem(element))
    );
    function genOptionItem(item){
        var obj = document.createElement("option");
        obj.setAttribute("value", item);
        obj.innerHTML = item;
        return obj
    }
    
    wrapper.appendChild(sWrapper);
}

///////////////////////
//// select wrapper ///
///////////////////////
$(document).ready(function () {
    $('select').selectize({
        sortField: 'text'
    });
});


document.getElementById("submit").onclick = function(){

    var selectControl = document.getElementsByClassName("selectize-control single")
    var targetString = selectControl.item(0).innerHTML;
    var checkString = '<div class="item"';
    var boolCheck = targetString.includes(checkString);

    var firstBag = targetString.split(checkString,2)[1];
    firstBag = firstBag.split("<", 2)[0];
    var secondBag = firstBag.split(">", 2)[1];


    let lastData = new Object();
    lastData.label = secondBag;
    lastData.kind = jsonData.kind;


    $.ajax({
        method: "POST",
        url: "/api/label/" + task_name,
        data: JSON.stringify(lastData),
        xhrFields:{
            withCredentials: true
        },
        dataType: 'json',
    }).done(function(){
        location.href = "/label/" + task_name;
    })

}

document.getElementById("next_button").onclick = function(){
    location.href = "/label/" + task_name;
}

window.onload = canvasResize(jsonData);
window.onload = genSelectOption();