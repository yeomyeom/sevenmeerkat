function submitLogin() {
    var loginForm = document.loginform;
    var userId = document.getElementById('user-id').value;
    var password = document.getElementById('user-password').value;

    if (!userId || !password) {
        alert ("아이디 및 패스워드 입력 확인하시오.")
        return false;
    }
    loginForm.submit();

}

function moveToRegister() {
    window.location.href = "/register";
}
