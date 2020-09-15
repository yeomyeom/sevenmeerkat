function submitLogin() {
    var userId = document.getElementById('user-id').value;
    var password = document.getElementById('user-password').value;

    if (!userId || !password) {
        alert ("아이디 및 패스워드 입력 확인하시오.")
        return false;
    }
    var formData = {
        email:userId,
        password:password
    }
    $.ajax({
        type : 'post',
        url : '/api/login',
        data : formData,
        dataType : 'json'
    }).done(function(data){
        if(data.success === true){
            location.href="/task_list"
        }
    }).fail(errorHandler);

}

function moveToRegister() {
    window.location.href = "/register";
}
