let task_name;
let jsonData = 0;


function getTaskList() {
    $.ajax({
        url: '/api/task_list',
        method: 'GET',
        dataType: "json",
        crossDomain: true,
    }).done(function(data){
        var targetData = new Array();
        var target = document.getElementById("task_list");
        for(idx in data) {
            if (data[idx].is_activate == "1"){
                targetData.push(data[idx])
            }
        }
        targetData.forEach(
            element =>
            target.appendChild(
                makeCard(element)
            )
        )
    })
}

function enterTask(ele){
    var redirectUrl = "/label/" + ele.name
    window.location.replace(redirectUrl)
}

window.onload = function(){
    this.getTaskList();
}

function loadImage(jsonData){
    var imageData = "data:image/"+jsonData.image_ext+";base64,"+jsonData.example;
    var imageBody = document.createElement("img");
    imageBody.setAttribute("src", imageData);
    imageBody.setAttribute("id", "img_result");
    imageBody.setAttribute("width", jsonData.size[0]);
    imageBody.setAttribute("height", jsonData.size[1]);
    return imageBody;
}

function makeCard(jsonData) {
    // 2020.05.19 이 카드에 type과 task_name도 출력되도록 처리 
    
    var card = document.createElement('div');
    card.setAttribute("class", "card");
    card.setAttribute("style", "width: 18rem;");

    // var child_img = document.createElement("img");
    // child_img.setAttribute("src", image_url);
    // child_img.setAttribute("class", "card-img-top")
    var child_img = loadImage(jsonData);

    var child_body = document.createElement("div");
    child_body.setAttribute("class", "card-body d-flex flex-column")


    var child_title = document.createElement("h5");
    child_title.setAttribute("class", "card-title");
    child_title.innerHTML = jsonData.name;

    var typeName= document.createElement("span");
    typeName.setAttribute("class", "badge badge-pill badge-danger");
    typeName.setAttribute("style", "width:90px;height:20px;");
    typeName.innerHTML = jsonData.kind;


    var child_text = document.createElement("p");
    child_text.setAttribute("class", "card-text");
    child_text.innerHTML = jsonData.comment;

    var child_btn = document.createElement("a");
    child_btn.setAttribute("class", "btn btn-primary");
    child_btn.setAttribute("id", "enter_button");

    child_btn.setAttribute("type", jsonData.kind);
    child_btn.setAttribute("name", jsonData.name);

    child_btn.setAttribute("onclick", "enterTask(this);");
    child_btn.innerHTML = "입장하기";

    child_body.appendChild(child_title);
    child_body.appendChild(typeName);
    child_body.appendChild(child_text);
    child_body.appendChild(child_btn);

    card.appendChild(child_img);
    card.appendChild(child_body);
    return card;
}
