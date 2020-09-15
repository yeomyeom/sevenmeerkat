function submitRegister() {
    var registerForm =document.registerform;
    var userId = document.getElementById('user-id').value;
    var password1 = document.getElementById('user-password').value;
    var password2 = document.getElementById('user-password-conf').value;

    checkR = /(?:admin)/;

    if(checkR.test(userId)){
        alert("");
        return false;
    }

    if (!userId || !password1 || !password2) {
        alert ("아이디 및 패스워드 입력 확인하시오.")
        return false;
    }

    if (password1 != password2) {
        alert("패스워드와 확인 패스워드가 서로 다릅니다.")
        return false;
    }
    registerForm.submit();
}