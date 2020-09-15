const tableBody = document.getElementById('table_body');

function genTaskManagementTable(){
    $.ajax({
        url: '/api/task_management_list',
        //url: '/api/task_management',
        method: 'GET',
        dataType: 'json',
        crossDomain: true,
        success: function(data) { 
        }
    }).done(function(data){
        data.forEach(
            element => 
            tableBody.appendChild(genRecord(
                element.is_activate,
                element.kind,
                element.name,
                element.group,
                element.gen_user,
                element.gen_date
            ))
        )
    }).fail(errorHandler)
}

window.onload = genTaskManagementTable;

function genRecord(
    is_activate,
    kind,
    task_name,
    assigned_dataset,
    gen_user,
    gen_date
){
    var recordWrapper = document.createElement('tr');

    // var col1 = document.createElement('td');
    // col1.setAttribute('class', 'column1');
    // col1.innerHTML = is_activate; // 여긴 나중에 if statement로 버튼만들기 

    var col1 = document.createElement('span');
    if (is_activate == 1) {
        col1.setAttribute('class', 'badge badge-success');
        col1.innerText = '활성상태';
    } else {
        col1.setAttribute('class', 'badge badge-danger');
        col1.innerText = '비활성상태';
    }
    
    var col2 = document.createElement('td');
    col2.setAttribute('class', 'column2');
    col2.innerHTML = kind;

    var col3 = document.createElement('td');
    col3.setAttribute('class', 'column3');
    col3.innerHTML = task_name;

    var col4 = document.createElement('td');
    col4.setAttribute('class', 'column4');
    col4.innerHTML = assigned_dataset;

    var col5 = document.createElement('td');
    col5.setAttribute('class', 'column5');
    col5.innerHTML = gen_user;

    var col6 = document.createElement('td');
    col6.setAttribute('class', 'column6');
    col6.innerHTML = gen_date;


    var col7 = document.createElement('button');
    col7.setAttribute('type', 'button');
    col7.setAttribute('class', 'btn btn-info');
    col7.setAttribute('value', task_name);
    col7.setAttribute('onclick', 'enterTaskModify(this);');
    col7.innerHTML = '수정하기';

    recordWrapper.appendChild(col1);
    recordWrapper.appendChild(col2);
    recordWrapper.appendChild(col3);
    recordWrapper.appendChild(col4);
    recordWrapper.appendChild(col5);
    recordWrapper.appendChild(col6);
    recordWrapper.appendChild(col7);

    return recordWrapper;
}

function enterTaskModify(ele){
    var uri = "/task_modify/" + ele.value;
    window.location.replace(uri);
}
