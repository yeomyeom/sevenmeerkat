/*
요약
1) load되는 타겟 html 
    ../templates/task.html

2) 타겟 URI
    /label/<task_name>

3) 기능
    (1) Task의 kind (ex. detection, classfication, text, segementation)에 따라 
    작업자가 다른 업무를 수행해야 하므로 각 kind에 맞는 다른 js 파일을 불러온다.
    (2) Label 예시 이미지 및 comment를 좌측에 출력한다.
*/
var hrefArray = window.location.href.split("/");
const task_name = hrefArray[hrefArray.length - 1];
let jsonData = 0;

function getData() {
    var header = new XMLHttpRequest();
    header.open('get', '/api/label/' + task_name)
    header.setRequestHeader("Access-Control-Allow-Credentials", 'true');
    header.setRequestHeader("Access-Control-Allow-Origin", '*');

    $.ajax({
        url: '/api/label/' + task_name,
        method: 'GET',
        dataType: "json",
        crossDomain: true,
        xhrFields:{
            withCredentials: true
        },
        success: function (data) { 
        }
    }).done(function (data) {
        jsonData = data;
        genElemFunc(jsonData);
    }).fail(errorHandler)
}

window.onload = getData();

function genElemFunc(jsonData) {
    var contentsWrapper = document.getElementById("contentsWrapper");
    var addJS = document.createElement("script");
    addJS.setAttribute("type", "text/javascript");

    var addJS2 = document.createElement("script");
    addJS2.setAttribute("type", "text/javascript");


    if (jsonData.kind == "detection") {
        addJS.setAttribute("src", "/static/js/genDetectionTask.js");
    } else if (jsonData.kind == "segmentation") {
        addJS.setAttribute("src", "/static/js/genSegmentationTask.js");
    } else if (jsonData.kind == "text") {
        addJS.setAttribute("src", "/static/js/genTextTask.js");
    } else if (jsonData.kind == "classification") {
        addJS.setAttribute("src", "/static/js/genSelectionTask.js");
        addJS2.setAttribute("src", "/static/js/multiple-select.js");
    } else {
        alert("잘못된 KIND.")
        return false;
    }
    contentsWrapper.appendChild(addJS);
    contentsWrapper.appendChild(addJS2);


    var leftSidebar = document.getElementById('label_example_image');
    let example_imageData = "data:image/"+jsonData.example_image_ext+";base64,"+jsonData.example_image;
    var leftImg = document.createElement("img");
    leftImg.setAttribute("src", example_imageData);
    leftImg.setAttribute("width", "250");
    leftImg.setAttribute("height", "150");
    
    leftSidebar.appendChild(leftImg);

    var leftComment = document.getElementById("label_example_text");
    leftComment.innerText = jsonData.comment;

    let imgwrapper = document.getElementById("workspace");
    var imageData = "data:image/"+jsonData.image_ext+";base64,"+jsonData.image;
    var imageBody = document.createElement("img");
    imageBody.setAttribute("src", imageData);
    imageBody.setAttribute("id", "img_result");
    imageBody.setAttribute("style", "display:none");
    
    var cvs = document.createElement("canvas");
    cvs.setAttribute("id", "canvas_result");
    
    imgwrapper.appendChild(cvs);
    imgwrapper.appendChild(imageBody);

    var encode_task_name = decodeURI(task_name)
    document.getElementById("task_name").innerHTML = encode_task_name;
    document.getElementById("kind").innerHTML = jsonData.kind;

    // label 작업 대상 이미지 출력 및 resize 
    // 참고) 위의 imgBody 에서는 display:none처리
    canvasResize(jsonData);
}

function canvasResize(jsonData){
    let cvs = document.getElementById("canvas_result");
    let img_result = document.getElementById("img_result");
    let ctx = cvs.getContext("2d");
    W = jsonData.width;
    H = jsonData.height;
    cvs.width = W;
    cvs.height = H;

    ctx.drawImage(
        img_result,
        0, 0, W, H,
        );
}