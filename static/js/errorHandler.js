var errorHandler = function(xhr, textStatus){
    var message;
    var responseMessage = xhr.responseJSON.message;
    switch(xhr.status){
        case 400:
            message = "잘못된 요청입니다."
            break;
        case 401:
            message = "로그인 오류입니다"
            break;
        case 403:
            message = "권한이 없습니다."
            break;
        case 404:
            location.href="/404";
            return;
        case 422:
            message = "요청을 수행할 수 없습니다."
            break;
        case 500:
            location.href="/500";
            return;
    }
    alert(message +"\n"+responseMessage);
}