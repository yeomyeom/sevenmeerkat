window.onload = function(){
    this.getTfrecordList();
}

function getTfrecordList(){
    $.ajax({
        url: '/api/tfrecord/list',
        method: 'GET',
    }).done(function(data){
        // bootstrap ?? https://getbootstrap.com/docs/4.0/components/list-group/
        var list = document.getElementById('list-group');
        var form = document.createElement('form');
        var del_form = document.createElement('form')
        form.setAttribute("action", "/api/tfrecord/download");
        form.setAttribute("method", "POST");
        del_form.setAttribute("action", '/api/tfrecord/delete');
        del_form.setAttribute('method', 'POST');
        if (data.filename){
            for (idx in data.filename){
                form.appendChild(makeBtn(data.filename[idx]));
                del_form.appendChild(makeDelBtn(data.filename[idx]));
            }
        }else{
            form.innerHTML = 'no tfrecord file';
            del_form.innerHTML = 'no tfrecord file';
        }
        list.appendChild(form);
        list.appendChild(del_form);
    })
}


function makeBtn(filename){
    var button = document.createElement('button');
    button.setAttribute("type","submit");
    button.setAttribute("class", "list-group-item list-group-item-action");
    button.setAttribute("name", "filename");
    button.setAttribute("value", filename);
    button.innerHTML = filename;
    return button
}

function makeDelBtn(filename){
    var del_button = document.createElement("button");
    del_button.setAttribute("type", "submit");
    del_button.setAttribute("class", "list-group-item list-group-item-danger");
    del_button.setAttribute("name", "filename");
    del_button.setAttribute("value", filename);
    del_button.innerHTML = '\[delete\] ' + filename;
    return del_button;
}