const tableBody = document.getElementById('table_body');

function genDatasetManagementTable() {
    $.ajax({
        url: '/api/img_list',
        // url: '/api/task_create', // 일단 여기로 보내놓자
        method: 'GET', 
        dataType: 'json',
        crossDomain: true,
        success: function(data) { 
        }
    }).done(function(data){
        data.forEach(
            element =>
            tableBody.appendChild(genDatasetRecord(element))
        )
    })
    

}

window.onload = function() {
    this.genDatasetManagementTable();
}


function genDatasetRecord(jsonData){
    var recordWrapper = document.createElement('tr');
    
    var col1 = document.createElement('td');
    col1.setAttribute('class', 'column1');
    col1.innerHTML = jsonData.group;

    var col2 = document.createElement('td');
    col2.setAttribute('class', 'column2');
    col2.innerHTML = jsonData.group_comment;

    var col3 = document.createElement('td');
    col3.setAttribute('class', 'column3');
    col3.innerHTML = jsonData.gen_user;

    var col4 = document.createElement('td');
    col4.setAttribute('class', 'column4');
    col4.innerHTML = jsonData.gen_date;


    var col5 = document.createElement('button');
    col5.setAttribute('type', 'button');
    col5.setAttribute('class', 'btn btn-info');
    col5.setAttribute('value', jsonData.group);
    col5.setAttribute('onclick', 'enterTaskModify(this);');
    col5.innerHTML = '기능 개발중';

    recordWrapper.appendChild(col1);
    recordWrapper.appendChild(col2);
    recordWrapper.appendChild(col3);
    recordWrapper.appendChild(col4);
    recordWrapper.appendChild(col5);
    
    return recordWrapper;
}

function enterTaskModify(ele){
    alert("아직 개발중인 기능이므로 작동하지 않습니다.");
}