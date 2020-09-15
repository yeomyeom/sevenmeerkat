function getTaskName(){
    var task = document.getElementById('task_name').value;
    return task;
}
function getObjectName(){
    var object = document.getElementById('object_name').value;
    return object;
}

document.getElementById('send_task').onclick = function sendData(){
    var postData = new FormData();
    let task_name = getTaskName();
    let object_name = getObjectName();
    postData.append('task_name', task_name);
    postData.append('task_object', object_name);
    $.ajax({
        url: '/api/download',
        method: 'POST',
        cache: false,
        contentType: false,
        processData: false,
        data: postData,
        success: function(response){
            document.getElementById("message").innerHTML = response['message']
        }
    })
}