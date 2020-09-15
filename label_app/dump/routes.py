from flask import json, render_template, request, redirect, url_for, jsonify, Response

from label_app import app
from label_app.task_code import database, storage

db = database.db_open()
s3 = storage.s3_connect()



@app.route('/')
@app.route('/home')
def home_view():
    return render_template('index.html')


@app.route('/time_setting', methods=['POST', 'GET'])
def setting_time():
    if request.method == "POST":
        if request.values.get('act') == 'start':
            database.db_user_login(db, 'Test_user_data', 'kim')

    if request.method == 'GET':
        time = request.args.get('time')
        print(dir(time))
    return ""


@app.route('/task_list', methods=['GET', 'POST'])
def task_list_view():
    if request.method == 'POST':
        print("post success")
    return render_template("task_list.html")


@app.route('/task', methods=['GET', 'POST'])
@app.route('/task/<ano_type>/<taskname>', methods=['GET', 'POST'])
def task_view(ano_type, taskname):

    ano_type = ano_type
    taskname = taskname

    img_path = os.path.join(
        os.path.dirname(__file__),
        'static/images/test1.jpg')

    image = cv2.imread(img_path)
    h, w = image.shape[:2]
    # 여기서 image 비율 맞춰서 수정해서 전달해주면 좋을듯

    _, buffer = cv2.imencode(".{}".format('jpg'), image)
    base64_image = base64.b64encode(buffer)
    base64_image = base64_image.decode()

    # 여기서 json object로 변경하여 넘겨주기
    data = json.dumps(
        {
            'image': base64_image,
            'id': 32,
            'image_ext': 'jpg',
            'height': h,
            'width': w,
            "type": "segmentation"
        })

    return render_template(
        "task.html",
        taskname=taskname,
        ano_type=ano_type,
        data=data)


"""
@app.route('/task/<ano_type>/<taskname>', methods=['GET'])
def getting_task(ano_type, taskname):
    ano_type = ano_type
    taskname = taskname
    img_path = os.path.join(
        os.path.dirname(__file__),
        'static/images/test1.jpg')

    image = cv2.imread(img_path)
    # 여기서 image 비율 맞춰서 수정해서 전달해주면 좋을듯
    image = cv2.resize(image, (1000, 500))

    _, buffer = cv2.imencode(".{}".format('jpg'), image)
    base64_image = base64.b64encode(buffer)
    base64_image = base64_image.decode()

    return jsonify([
        {
            "image": base64_image,
            "id": 32
        }
    ])
"""


@app.route('/task/get_task', methods=['GET'])
def getting_task_list():
    """
    여기서 현재 활성화 된 task list를  json 으로 보낸다.
    여러개의 task list를 보낼 수 있게 하면 됨 최종적으로는 json 양식으로 하면 됨.

    DB 상에서 Task에 대한 이름과 Task 설명 list 형태의 json 파일을 return 해주면 됨
    """
    return jsonify(
        {
            "title": "Hamster", "text": "Hamster is so cute."
        }
    )


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        var = [
            {"title": "Dog1",
             "text": "Transition seamlessly between eager and graph modes with TorchScript, and accelerate the path to production with TorchServe.",
             "type": "classification", "task_name": "hamster task"},
            {"title": "Dog2",
             "text": "Transition seamlessly between eager and graph modes with TorchScript, and accelerate the path to production with TorchServe.",
             "type": "classification", "task_name": "hamster task"},
            {"title": "Dog3",
             "text": "Transition seamlessly between eager and graph modes with TorchScript, and accelerate the path to production with TorchServe.",
             "type": "classification", "task_name": "hamster task"},

        ]


@app.route('/task_management', methods=['GET', 'POST'])
def task_manage_view():
    return render_template('task_management.html')


@app.route('/dataset_management', methods=['GET', 'POST'])
def dataset_manage_view():
    return "hamster data"


###############################
@app.route('/Test_New_task', methods=['GET', 'POST'])
def Test_New_task():
    # request.values {'group_name': 'A', 'kind': 'ocr', 'comment': '어쩌구'} 각 정보 dataset 에 등록
    # request.files [파일 여러개] -> 이거는 S3 업로드
    if request.method == 'POST':
        # 요 코드는 postman 에서 테스트 용으로 했을 때
        file_list = request.files.getlist('')
        # 요 코드는 실제 name='file_list' 라고 줬을 때 오는것
        # file_list = request.files.getlist('file_list[]')
        if len(file_list) > 0:
            success_count = len(file_list)
            file_fail = []
            file_name = []
            for file in file_list:
                filename, H, W = storage.upload_img(s3, file)

    return "Hello"
