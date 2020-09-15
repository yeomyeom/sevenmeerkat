
function getDatasetName(){
    var name = document.getElementById('dataset-name').value;
    return name;
}

function getDatasetComment(){
    var comment = document.getElementById('dataset-comment').value;
    return comment;
}


document.getElementById('save-dataset').onclick = function(){
    let datasetName = getDatasetName();
    let datasetComment = getDatasetComment();
    var postData = new FormData();

    checkR = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
    if (checkR.test(datasetName)) {
        alert("Dataset Name에 한글이 포함되어있습니다.")
        return false;
    }
    
    checkS = /[ !@#$%^&*()+\\]/;
    if (checkS.test(datasetName)) {    
        alert("Dataset name에는 오직 _(underscore)특수문자만 가능합니다.");
        return false;
    }

    $.each($("input[type='file']")[0].files, function(i, file) {
        postData.append('', file);
    });

    postData.append('group', datasetName);
    postData.append('group_comment', datasetComment);

    // POST 보낼때 는 credential을 안겨서
    $.ajax({
        url: '/api/img_upload',
        method: 'POST',
        cache: false,
        contentType: false,
        processData: false,
        xhrFields:{
            withCredentials: true
        },
        data: postData,
        success: function(data) { 
        }
    }).done(function(){
        window.location.replace("/dataset_management")
    })
}

