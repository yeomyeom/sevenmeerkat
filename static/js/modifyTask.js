let targetUri = window.location.toString().split("/")
var tName = targetUri[targetUri.length-1];

function genDatasetTable(){
    $.ajax({
        url: '/api/img_list',
        method: 'GET',
        data: {task_name: tName}
    }).done(function(data){
        var target = document.getElementById('table-body');
        var idx = 0;
        var is_new = true;
        if (tName!='new'){
            is_new = false;
        }
        data.forEach(
            element=>
            target.appendChild(
                genDatasetRow(
                    is_new,
                    idx++, 
                    element.is_checked,
                    element.group,
                    element.group_comment,
                    element.gen_user,
                    element.gen_date
                )
            )
        )
    }).fail(errorHandler)
}

function genDatasetRow(
    is_new,
    idx,
    isChecked, //bool 현재 선택이 되어있는 dataset인지 체크
    datasetName,
    datasetDesc,
    genUser,
    genDate) {
    // 그리고 지정영역 무한스크롤 되도록 하자

    let rowWrapper = document.createElement('tr');
    rowWrapper.setAttribute('class', 'selectee');
        

    // column1 
    var col1 = document.createElement('td');
    col1.setAttribute('class', 'column1');

    var check = document.createElement('input');
    check.setAttribute('type', 'checkbox');
    check.setAttribute('class', 'check-attr')
    check.setAttribute('name', idx)
    check.setAttribute('onclick', 'checkCount(this);')
    if(isChecked==1){
        check.checked = true;
    }

    if (is_new != true) {
        check.setAttribute('disabled', 'disabled')
    }
    col1.appendChild(check);

    //column2
    var col2 = document.createElement('td');
    col2.setAttribute('class', 'column2');
    col2.setAttribute('name', idx);
    col2.innerText = datasetName;

    //column3
    var col3 = document.createElement('td');
    col3.setAttribute('class', 'column3');
    col3.innerText = datasetDesc;

    //column4
    var col4 = document.createElement('td');
    col4.setAttribute('class', 'column4');
    col4.innerText = genUser;
        
    //column5
    var col5 = document.createElement('td');
    col5.setAttribute('class', 'column5');
    col5.innerText = genDate;

    rowWrapper.appendChild(col1);
    rowWrapper.appendChild(col2);
    rowWrapper.appendChild(col3);
    rowWrapper.appendChild(col4);
    rowWrapper.appendChild(col5);

    return rowWrapper;
}





// selecting 한것 체크 
function getKind(){
    var selection = document.getElementById('kind_selector');
    var selectedText = selection.options[selection.selectedIndex].value;
    return selectedText;
}
// Task name 
function getTaskName(){
    var inputVal = document.getElementById("task_name").value;
    return inputVal;
}
// 활성화 체크 
function getAct(){
    var impVal = $("span.badge");
    var deact = impVal[1].style.display;
    if (deact) {
        return 1;
    } else {
        return 0;
    }
}

// comment 가져오기
function getComment(){
    var com = document.getElementById('task_comment').value;
    return com; 
}

// check된 데이터셋 선택하기 
let setOfChecked = new Set(); 
function checkCount(cb){
    if (cb.checked){
        if (setOfChecked.has(cb.name) != true){
            setOfChecked.add(cb.name);
        }
    } else {
        if (setOfChecked.has(cb.name) == true){
            setOfChecked.delete(cb.name)
        }
    }
}

document.getElementById('save_task').onclick = function(){
    var kind = getKind();
    var taskName = getTaskName();
    if (taskName) {
        taskName = taskName;
    } else {
        taskName = tName;
    }
    var active = getAct();
    var comment = getComment();

    var postData = new FormData();
    $.each($("input[type='file']")[0].files, function(i, file) {
        postData.append('', file);
    });
    postData.append('kind', kind);

    if (taskName == 'new'){
        alert("Task 이름은 반드시 지정해야 합니다.")
        return false;
    }

    checkR = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
    if (checkR.test(taskName)) {
        alert("Task Name에 한글이 포함되어있습니다.")
        return false;
    }

    checkS = /[ !@#$%^&*()+\\ ]/;
    if (checkS.test(taskName)) {    
        alert("Task Name에는 오직 _(underscore)특수문자만 가능합니다.");
        return false;
    }


    postData.append('name', taskName);
    postData.append('is_activate', active);
    postData.append('comment', comment);

    // 자 여기에 어떤 데이터셋을 보낼 것인지 결정

    if (taskName=='new'){
        if (setOfChecked.size != 1 ) {
            alert("반드시 task 1개에는 1개의 데이터셋이 할당되어야 합니다.")
            return false;
        }
    }
    var checkArr = Array.from(setOfChecked);
    checkArr = checkArr[0];

    var tmpObj = document.querySelectorAll('td[name="' + checkArr +'"]')
    if (tmpObj[0]){
        selectedDataset = tmpObj[0].innerText;
    } else {
        var cList = document.getElementsByClassName("check-attr");
        for(var idx = 0; idx < cList.length; idx++){
            if (cList[idx].checked) {
                var dNameList = document.getElementsByClassName("column2");
                selectedDataset = dNameList[idx+1].innerText;  // column heade때
            }
        }
    }


    postData.append('choose_group', selectedDataset);
    postData.append('selection_list', document.getElementById('selection_list').value)

    $.ajax({  
        url: '/api/task_create',
        method: 'POST', 
        cache: false,
        contentType: false,
        xhrFields:{
            withCredentials: true
        },
        crossDomain:true, 
        processData: false,
        data: postData,
        success: function(data) { 
        }
    }).done(function(){
        window.location.replace('/task_management')
    }).fail(errorHandler)
}


$("button#toggle_importance").click(function(){
    $("span.badge").toggle();
})

if (tName!="new"){
    var targetElem = document.getElementById('task_name');
    targetElem.placeholder = tName;
    targetElem.disabled = true;
}


function getTaskDetail(){
    $.ajax({
        url: '/api/tasks/'+tName,
        method: 'GET',
        crossDomain: true
    }).done(setDetail)
}

function setDetail(data){
    obj = data.items;
    $("#kind_selector").val(obj.kind);
    $("#task_comment").val(obj.comment);
    $("#selection_list").val(obj.selection_list)
    var is_activate = obj.is_activate;

    if(is_activate==0){
        $("span.badge").toggle();
    }

}

window.onload = function() {
    this.genDatasetTable();
    this.getTaskDetail();
}