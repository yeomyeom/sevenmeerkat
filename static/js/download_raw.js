window.onload = function(){
    this.getTaskList();
}

function getTaskList(){
    $.ajax({
        //이 /api/task_list 가 task 예시 이미지도 같이 가져와서 응답이 오래걸린다.
        url: '/api/task_list',
        method: 'GET',
        dataType: 'JSON',
        data: {"option": "no_example_image"},
        async: false
    }).done(function(data){
        // bootstrap 예제 https://getbootstrap.com/docs/4.0/components/list-group/
        var list = document.getElementById('list-group')
        var form_down_json = document.createElement('form')
        var form_down_image = document.createElement('form')
        var form_delete_image = document.createElement('form')
        form_down_json.setAttribute("action", "/api/download/json")
        form_down_json.setAttribute("method", "POST")
        form_down_image.setAttribute("action", "/api/download/image")
        form_down_image.setAttribute("method", "POST")
        form_delete_image.setAttribute("action", "/api/delete/image")
        form_delete_image.setAttribute("method", "POST")
        if (data){
            for (idx in data){
                var name = data[idx].name
                var total = data[idx].total
                var count = data[idx].count
                form_down_json.appendChild(makeBtn('json', name, total, count))
                form_down_image.appendChild(makeBtn('image', name, total, count))
                del_btn = makeDelBtn('delete', name)
                if (del_btn){
                    form_delete_image.appendChild(del_btn)
                }
            }
        }else{
            form_down_json.innerHTML = 'no Task'
            form_down_image.innerHTML = 'no Task'
            form_delete_image.innerHTML = 'no image file to delete'
        }
        list.appendChild(form_down_json)
        list.appendChild(form_down_image)
        list.appendChild(form_delete_image)
    })
}

function makeBtn(kind, name, total, count){
    var list_element = document.createElement('div')
    var button = document.createElement('button')
    button.setAttribute("type", "submit")
    if (kind == 'json'){
        //애초에 json 파일을 안만들어서 file_exist를 할 필요가 없다.
        button.setAttribute("class", "list-group-item list-group-item-secondary")
    }else{
        button.setAttribute("class", "list-group-item list-group-item-warning")
        if (check_file_exist(name) == 1){
            button.setAttribute("class", "list-group-item list-group-item-success")
        }
    }
    button.setAttribute("name", "name")
    button.setAttribute("value", name)
    button.innerHTML ="\[" + kind + "\] " + name + " 총 이미지 개수: " + total + " 라벨링된 이미지 개수: " + count
    list_element.appendChild(button)
    return list_element
}

function makeDelBtn(kind, name){
    if (check_file_exist(name) == 1){
        var button = document.createElement('button')
        button.setAttribute("type", "submit")
        button.setAttribute("class", "list-group-item list-group-item-danger")
        button.setAttribute("name", "name")
        button.setAttribute("value", name)
        button.innerHTML ="\[" + kind + "\] " + name
        return button
    }else{
        return null;
    }

}

function deleteimage(name){
    //html에서는 PUT DELETE 메소드가 있는데 브라우저에서는 이 기능을 ajax를 통해야 가능
    //따라서 form method = delete 로 안됨

}

function download_json(name){

}

function download_image(name){
    
}

function check_file_exist(name){
    var status
    $.ajax({
        url: '/api/download/file_exist',
        method: 'POST',
        dataType: 'JSON',
        data: {"name": name},
        async: false
    }).done(function(response){
        if (response["is_exist"] == "image_saved"){
            status = 1
        }else{
            status = 0
        }
    })
    return status
}