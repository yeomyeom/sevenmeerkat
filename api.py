# -- coding: utf-8 --
from flask import request, jsonify, session, redirect, send_from_directory, make_response, Response, stream_with_context, render_template
from label_app.task_code import database, storage, utils
from flask_bcrypt import Bcrypt
from redis import Redis
from rq import Queue, Worker
from datetime import timedelta
from functools import wraps
from label_app import app
import tensorflow as tf
from tensorflow.models.research.object_detection.utils import dataset_util
import os
import shutil
import json
from dotenv import load_dotenv

# config 디렉토리에 있는 환경설정 파일 불러오기
# aws 에서는 직접 환경변수를 입력할 수 있어서 사실상 필요가 없다.
load_dotenv(dotenv_path='config/.env')
# 암호화 https://flask-bcrypt.readthedocs.io/en/latest/
bcrypt = Bcrypt()
# session 설정을 위한 키값이다. 
# https://flask.palletsprojects.com/en/1.1.x/quickstart/#sessions
app.secret_key = os.getenv('SECRET_KEY')
# mongodb, s3 storage 연결함
db = database.db_open()
s3 = storage.s3_connect()
# 작업이 오래걸리는 작업(tensorflow record 다운, 이미지 다운)을 비동기적으로 처리하기 위해
# redis 추가 물론 thread로 해도 되긴 하다
# worker 가 실제로 작업을 처리하는 객체이다. 다른 터미널에서 worker를 실행시켜야한다.
redis = Redis()
redis_queue = Queue(connection=redis)
Worker([redis_queue], connection=redis)

@app.before_request
def before_request():
    # 매 요청마다 session 30분 갱신
    session.permanent = True
    app.permanent_session_lifetime = timedelta(minutes=30)
    # ACCESS-CONTROL-ALLOW-CREDENTIALS 문제로 인해 밑에 코드 추가
    session.modified = True


def error_handler(where, what):
    # 에러가 발생할때마다 경고창을 띄워준다.
    # status_code를 바꾸거나 make_response 키값을 바꾸면 동작하지 않는다.
    response = make_response({'message': 'Error page : {}\nError describe : {}'.format(where, what)})
    response.status_code = 400
    return response


def login_required(function):
    # flask에서 session이 흔히 아는 세션이 아니라 시간 제한이 있는 cookie이다.
    # postman이나 chrome 개발자 모드로 열어보면 세션이 유저한테 저장되어있다.
    @wraps(function)
    def check_session(*args, **kwargs):
        if 'username' not in session:
            # 세션에 username 이라는 키 값이 없을때 (세션에 로그인 정보가 없을때)
            return redirect('/login')
        return function(*args, **kwargs)
    return check_session


def admin_required(function):
    # 유저가 준 session username 에 admin 키값이 들어가 있으면 관리자 권한이다
    @login_required
    @wraps(function)
    def check_username(*args, **kwargs):
        if 'admin' not in session['username']:
            return error_handler('로그인', '관리자 계정으로 접속해야합니다.')
        return function(*args, **kwargs)
    return check_username


@app.route('/api/img_upload', methods=['POST'])
@admin_required
def img_upload():
    # 이미지를 여러장 업로드하여 이미지 그룹을 만드는 api이다.
    # file_num(총 이미지 개수) file_success(업로드 성공한 파일 이름), file_fail(실패개수)은 사용하지 않지만 추후 사용 가능하다
    group = database.db_find_group(db)
    result = {'file_num': 0, 'file_success': [], 'file_fail': [], 'image_group': group}
    # 이미지 여러장 가져오는 것은 files.getlist 파일 하나만 가져오는 것은 files 만 해주면 된다.
    file_list = request.files.getlist('')
    # request.files [파일 여러개] -> 이거는 S3 에 이미지 파일 여러개 업로드하는 용
    if len(file_list) > 0:
        try:
            group_name = request.values['group']
            group_comment = request.values['group_comment']
            gen_user = session['username']
            count = len(file_list)
            file_fail = []
            file_success = []
            for file in file_list:
                # s3에 파일을 업로드하면 이름이 고유한 값으로 바뀐다.
                filename, H, W = storage.upload_img(s3, file)
                if filename:
                    # 바뀐 이름으로 mondoDB에 이미지 관련 정보 저장
                    database.db_insert_dataset(db, filename, group_name, H, W)
                    file_success.append(filename)
                else:
                    file_fail.append(file.filename)
            if len(file_success) > 0:
                database.db_insert_group(db, group_name, group_comment, gen_user)
            # 등록에 성공한 그룹 return
            group = database.db_find_group(db)
            result = {'file_num': count, 'file_success': file_success, 'file_fail': file_fail,
                      'image_group': group}
            return result
        except KeyError:
            return error_handler('이미지 업로드', '이미지 그룹에 대해서 이미지 그룹명과 설명을 적어주세요')
    else:
        return error_handler('이미지 업로드', '업로드할 이미지 파일이 없습니다.확장자를 확인해주세요.')



@app.route('/api/img_list', methods=['GET'])
@admin_required
def img_list():
    # 현재 생성되어있는 이미지 그룹 중에서 GET 으로 들어온 task_name을 
    # task_group collection 에서 검색해서 어떤 task 그룹에 활성화 되어있는지 알려준다.
    img_group = database.db_find_group(db)
    if request.args:
        img_check = []
        result = database.db_find_task(db, {'name': request.args['task_name']})
        for img in img_group:
            try:
                if result[0]['group'] == img['group']:
                    img['is_checked'] = 1
                else:
                    img['is_checked'] = 0
            except IndexError:
                img['is_checked'] = 0
            img_check.append(img)
        img_group = img_check
    return jsonify(img_group)


@app.route('/api/task_list', methods=['GET'])
@login_required
def task_list():
    # 현재 등록되어있는 모든 task 들의 정보
    # name: task 이름, group: 이미지 그룹이름, comment: 설명, kind: 라벨링 종류
    # example,size : 예시 이미지 정보, gen_date: 만든날, gen_user: 만든이, 
    # is_activate: task 활성화 여부, total: 총 이미지 개수, count: 라벨링된 이미지 개수
    # 정보를 반환한다.
    # 예시 이미지 가지고 오는것 때문에 이 api 응답시간이 오래 걸린다.
    # 그래서 download 페이지랑 task 목록 보여주는 페이지에 부하가 걸린다.
    try:
        # 위 문제를 방지하기 위해 option 키 값에 no_image 문자열이 오면 예시 이미지를 
        # 다운로드 받지 않는다.
        option = request.args['option']
    except KeyError:
        option = ''
    tasks = database.db_find_task(db)
    result = []
    for task in tasks:
        if option == 'no_example_image':
            task['example'] = None
        else:
            img_url = task.get('example')
            if img_url:
                task['example'] = storage.download_img_to_base64(img_url, 'example/')
            else:
                task['example'] = None
        taskname = task['name']
        total, count = database.db_count_taskimage(db, taskname)
        task['total'] = total
        task['count'] = count
        result.append(task)
    return jsonify(result)


def insert_task_group(result, example_img, session_name):
    if example_img:
        image_name, h, w = storage.upload_img(s3, example_img, 'example/')
    else:
        image_name, h, w = None, 0, 0
    if result['kind'] == 'classification':
        select_list = result['selection_list']
        database.db_insert_taskgroup(db, result['name'], result['choose_group'], result['comment'],
                                     result['kind'], result['is_activate'], image_name, [h, w], session_name,
                                     select_list)
    else:
        database.db_insert_taskgroup(db, result['name'], result['choose_group'], result['comment'],
                                     result['kind'], result['is_activate'], image_name, [h, w], session_name)


@app.route('/api/task_create', methods=['POST'])
@admin_required
def task_create():
    # task 생성 함수인데 task 수정, 조건에 맞지 않는 task 수정 요청 무시 
    # 3가지 기능을 모두 가지고 있다...
    """
    input
    선택된 그룹 이름, 라벨링 타입(ocr, seg,...), Task 이름, Task 설명, 설명 첨부 이미지(example 이라는 이름으로 되어있음)

    사용자가 새로운 task 를 만들었다면 database에 해당 정보들을 저장

    output
    선택된 그룹 이름, 라벨링 타입(ocr, seg,...), Task 이름, Task 설명
    """
    # {선택된 그룹, 라벨링 타입, Task 이름, Task 설명, 설명 이름 }
    result = {'choose_group': '', 'kind': '', 'name': '', 'comment': '',
              'img_group': database.db_find_group(db),
              'task_group': database.db_find_task(db)}
    # 선택된 이미지 그룹 group , 라벨링 kind, Task 이름 name
    result = utils.request_mapping(request.values, result)
    try:
        # 프론트엔드에서 이미지가 1장만 오도록 되어있어서 file.getlist 를 안해도 된다.
        label_example = request.files['']
    except KeyError:
        # 예시 이미지가 없으면 무시한다.
        label_example = None
    filename_list = database.db_find_dataset_filenames(db, result['choose_group'])
    # 선택된 이미지 그룹(dataset)이 존재 하면 새로운 Task 등록
    if len(filename_list) > 0:
        # test_task_group 에 이름이 중복되는 것이랑 수정 명령인지 구분하는 코드
        task_status = database.db_check_taskgroup(db, result['name'], result['choose_group'], result['kind'])
        session_name = session['username']
        # task_status 설명은 database.db_check_taskgroup 에
        if task_status == 'create':
            insert_task_group(result, label_example, session_name)
        elif task_status == 'update':
            # task 그룹을 수정할때 과거에 저장된 예시 이미지들을 지우는 작업
            # create 함수에 수정하는 코드도 함께들어가 있네
            example = database.db_find_example_img(db, result['name'])
            # 기존에 있던 예시 이미지 파일을 지우고
            if label_example:
                storage.delete_img(s3, example, 'example/')
            # 새로 바뀐 예시 이미지로 업데이트
            insert_task_group(result, label_example, session_name)
        else:
            # task_status == drop
            return error_handler('task 생성', "task 이름이 중복되었습니다. 이름을 변경하거나" +
                                 "수정을 원한다면 라벨링타입, 이미지 그룹을 동일하게 해주세요")
    else:
        return error_handler('task 생성', '선택된 이미지 그룹이 존재하지 않습니다. 데이터베이스를 확인해주세요')
    return ''


@app.route('/api/task_management_list', methods=['GET', 'POST'])
@admin_required
def task_management_list():
    # task 그룹 전체 출력 
    # task_group DB에 저장되어있는 그대로 출력한다.
    result = database.db_find_task(db)
    return jsonify(result)


@app.route('/api/label/<task_name>', methods=['GET', 'POST'])
@login_required
def labelling(task_name):
    img_info = database.db_find_one_label(db, task_name)
    task_info = database.db_find_task(db, {'name': task_name})
    task_info = task_info[0]
    result = {}
    if img_info:
        try:
            label = img_info[task_name]['label']
            is_label = 1
        except KeyError:
            # 라벨링 안되어있는 경우
            label = []
            is_label = 0
        img_base64 = storage.download_img_to_base64(img_info['filename'])
        if task_info.get('example'):
            # 예시 이미지가 있으면 예시 이미지 출력
            example_base64 = storage.download_img_to_base64(task_info['example'], 'example/')
        else:
            # 예시 이미지가 없으면 예시 이미지 출력 안함
            example_base64 = None
        result = {
            'filename': img_info['filename'],
            'label': label,
            'is_labeled': is_label,
            'width': img_info['width'],
            'height': img_info['height'],
            'kind': img_info['kind'],
            'image': img_base64,
            'image_ext': 'jpg',
            'comment': task_info['comment'],
            'example_image': example_base64
        }
        if result['kind'] == 'classification':
            try:
                result['selection_list'] = task_info['selection_list']
            except KeyError:
                return error_handler('라벨링', "라벨링 종류가 classification인데 selection list 가 존재하지 않습니다." +
                                     "task 를 확인바랍니다.")
    else:
        return error_handler('라벨링', '해당 task가 없습니다. task 를 확인해주세요')
    if request.method == 'POST':
        # 사이트에서 라벨링 한 결과가 POST 로 들어오면 db에 추가
        # '''
        def post_request_to_json(req):
            json_str = next(req.values.keys())
            return json.loads(json_str)
        values = post_request_to_json(request)
        # '''
        # values = request.values
        label = values['label']
        if img_info:
            kind = img_info['kind']
            filename = img_info['filename']
            # 프론트엔드에서 request.values 가 string 으로 전송하는 바람에 post_requets_to_json이라는 특이한 함수를 필요로 한다.
            database.db_update_one_label(db, task_name, filename, kind, label)
        else:
            return error_handler('라벨링', 'task에 등록된 이미지가 없습니다. DB를 확인해 주세요')
        # 현재 접속한 user count 와 최근 로그인 정보 저장
        status = database.db_count_user(db, session['username'], task_name)
        if not status:
            return error_handler('라벨링', '로그인한 사용자가 DB에 등록되어있지 않습니다.')
    return jsonify(result)


@app.route('/api/register', methods=['POST'])
def register():
    try:
        username = request.values['username']
        password = request.values['password']
        email = request.values['email']
        if username or password or email or 'admin' not in username:
            status = database.db_insert_user(db, bcrypt, username, password, email)
            if not status:
                return error_handler('새로운 사용자 등록', '아이디가 중복되었습니다.')
            return redirect('/login')
        else:
            # ID 에 admin 문자열이 들어간경우는 표시하지 않습니다.
            return error_handler('새로운 사용자 등록', '누락된 정보가 있습니다. 다른 username으로 시도하세요.')
    except KeyError:
        return error_handler('새로운 사용자 등록', '누락된 정보가 있습니다.')


# 로그인을 Ajax요청으로 바꿔서 응답형식을 수정했습니다.
@app.route('/api/login', methods=['POST'])
def login():
    def response_handler(status_code, obj):
        response = make_response(obj)
        response.status_code = status_code
        return response
    try:
        email = request.values['email']
        password = request.values['password']
        if email and password:
            user = database.db_check_login(db, bcrypt, email, password)
            if user['status'] is True:
                session['username'] = user['username']
                #return redirect('/task_list')
                return response_handler(200, {'success':True, 'message': '로그인성공'})
            else:
                #return error_handler('로그인', '아이디 또는 비밀번호가 틀립니다.')
                return response_handler(401, {'success':False, 'message': '아이디 또는 비밀번호가 틀립니다.'})
      
    except KeyError:
        return response_handler(400,{'success':False, 'message': '누락된 정보가 있습니다'})


@app.route('/api/user_info', methods=['GET'])
def user_info():
    try:
        if request.args['username']:
            info = database.db_find_user(db, request.args['username'])
            if info:
                return info
            else:
                return error_handler('유저 접속 정보', '해당 아이디를 가진 유저는 없습니다.')
        else:
            return error_handler('유저 접속 정보', '아이디를 입력해주세요')
    except KeyError:
        return error_handler('유저 접속 정보', '키값은 username 입니다.')


@app.route('/api/logout', methods=['GET', 'POST'])
@login_required
def logout():
    session.pop('username', None)
    return redirect('/login')


def make_tf_record(dataset_list, task_name, task_object, tfrecord_path):
    tot = len(dataset_list)
    old_percent, percent, iterator= 0, 0, 0
    writer = tf.python_io.TFRecordWriter(tfrecord_path)
    for dataset in dataset_list:
        # 이미지 하나당 tf record feature 하나씩
        img = storage.download_img_to_bytes(dataset['filename'])
        img_format = dataset['filename'].split('.')[-1]
        xmins, ymins, xmaxs, ymaxs, class_names, class_indices = [], [], [], [], [], []
        for label in dataset[task_name]['label']:
            xmins.append(label['x_min'])
            ymins.append(label['y_min'])
            xmaxs.append(label['x_max'])
            ymaxs.append(label['y_max'])
            # 사진 한장에 물체가 한가지 종류밖에 없음 만약 
            # tf record 파일 여러개인데 하나는 자동차, 다른 하나는 번호판이 되면
            # class_indices 가 0 ,1 이 되야하는데 이걸 어떻게 구분하지? 여러개 다운로드로 해야할거 같기도 하고
            # class_name = ['car', 'plate'] 라고 하면
            # class_indices = ['0', '1'] 이런식으로 저장되야 car 랑 plate 두가지 물체가 서로 다르다라고 앎
            class_indices.append(0)
            class_names.append(task_object.encode('utf-8'))
        feature = tf.train.Features(feature={
            'image/height': dataset_util.int64_feature(dataset['height']),
            'image/width': dataset_util.int64_feature(dataset['width']),
            'image/filename': dataset_util.bytes_feature(dataset['filename'].encode('utf-8')),
            'image/source_id': dataset_util.bytes_feature(dataset['filename'].encode('utf-8')),
            'image/encoded': dataset_util.bytes_feature(img),
            'image/format': dataset_util.bytes_feature(img_format.encode('utf-8')),
            'image/object/bbox/xmin': dataset_util.float_list_feature(xmins),
            'image/object/bbox/xmax': dataset_util.float_list_feature(xmaxs),
            'image/object/bbox/ymin': dataset_util.float_list_feature(ymins),
            'image/object/bbox/ymax': dataset_util.float_list_feature(ymaxs),
            'image/object/class/text': dataset_util.bytes_list_feature(class_names),
            'image/object/class/label': dataset_util.int64_list_feature(class_indices)
        })
        sample = tf.train.Example(features=feature)
        writer.write(sample.SerializeToString())
        # 확인용 코드
        iterator += 1
        percent = iterator * 100 // tot
        if old_percent != percent:
            print(percent)
            old_percent = percent
    writer.close()


@app.route('/api/tfrecord/reservation', methods=['POST'])
@admin_required
def reservation():
    try:
        task_name = request.values['task_name']
        if not task_name:
            return {'message':'task 이름이 비어있습니다.'}
        task_object = request.values['object_name']
        if not task_object:
            return {'message':'object 이름이 비어있습니다.'}
    except KeyError:
        return {'message':'키 값 에러가 발생했습니다.'}
    tfrecord_name = '{}.tfrecord'.format(task_name)
    tfrecord_path = os.path.dirname(os.path.realpath(__file__))
    tfrecord_path = os.path.join(tfrecord_path, os.getenv('TFR_SAVE_PATH'))
    if tfrecord_name in os.listdir(tfrecord_path):
        return {'message':'이미 tfrecord 파일이 만들어져 있습니다. 다시하기 위해서 서버에서 제거해 주시기 바랍니다.'}
    else:
        # task 이름이 db에 있는지 확인
        task_status = database.db_find_task(db, {'name': task_name}, {'_id': 0, 'group': 1, 'kind': 1})
        if len(task_status) == 0:
            return {'message':'{} task 가 존재하지 않습니다.'.format(task_name)}
        task_status = task_status[0]
        # task kind 가 detection 인 경우에만 tf record 만듬
        if task_status['kind'] != 'detection':
            return {'message':'아직은 detection 다운로드만 가능합니다'}
        tfrecord_path = os.path.join(tfrecord_path, tfrecord_name)
        dataset_list = database.db_find_dataset_group(db, task_name, task_status['group'])
        total = len(dataset_list)//3 + 1
        redis_queue.enqueue(make_tf_record, result_ttl=0, job_timeout=total + 300, args=(dataset_list, task_name, task_object, tfrecord_path))
        return {'message':'다운로드중입니다. 완료되면 tensorflow record 페이지에서 다운로드 받을 수 있습니다\n\
                종료까지 {} 남았습니다.'.format('{} 시 {} 분'.format(total//3600, (total - (total//3600)*3600)//60))}     
    # response 객체 생성하기 (프론트에 progress bar 보여주기)
    # https://stackoverflow.com/questions/26514583/text-event-stream-recognised-as-a-download


@app.route('/api/tfrecord/list', methods=['GET'])
@admin_required
def tfrecord_list():
    # tf record 파일이 만들어졌는지 확인하는 api 이다.
    tfrecord_path = os.path.dirname(os.path.realpath(__file__))
    tfrecord_path = os.path.join(tfrecord_path, os.getenv('TFR_SAVE_PATH'))
    # 파일 용량이 0보다 큰가? 0 인 경우는 redis에서 오류난 경우이다.
    record_list = [x for x in os.listdir(tfrecord_path) 
                   if (os.path.getsize(os.path.join(tfrecord_path,x)) >> 10) > 1]
    # >> 10 연산은 byte 로 나온거 kb 로 바꾸는 연산이다.
    # 파일 확장자가 tfrecord 인가
    record_list = [x for x in record_list if 'tfrecord' == x.split('.')[-1]]
    return {'filename': record_list, 'message': len(record_list)}


@app.route('/api/tfrecord/delete', methods=['POST','DELETE'])
@admin_required
def delete_tfr():
    tfrecord_path = os.path.dirname(os.path.realpath(__file__))
    tfrecord_path = os.path.join(tfrecord_path, os.getenv('TFR_SAVE_PATH'))
    filename = request.values['filename']
    if os.path.exists(os.path.join(tfrecord_path, filename)):
        os.remove(os.path.join(tfrecord_path, filename))
        return render_template('download_tf.html', message='삭제 완료')
    else:
        return render_template('download_tf.html', message='파일이 존재하지 않습니다')

@app.route('/api/tfrecord/download', methods=['POST'])
@admin_required
def download_tfr():
    tfrecord_path = os.path.dirname(os.path.realpath(__file__))
    tfrecord_path = os.path.join(tfrecord_path, os.getenv('TFR_SAVE_PATH'))
    filename = request.values['filename']
    return send_from_directory(tfrecord_path, filename, as_attachment=True)


@app.route('/api/download/json', methods=['POST'])
@admin_required
def download_raw_json():
    taskname = request.values['name']
    task_info = database.db_find_task(db, {'name': taskname})
    image_group = task_info[0]['group']
    label_end_document = database.db_find_dataset_group(db, taskname, image_group)
    json_file = {'kind': label_end_document[0][taskname]['kind']}
    annotations = []
    def work():
        for document in label_end_document:
            result = {'filename': document['filename'],
                      'height': document['height'],
                      'width': document['width'],
                      'label': document[taskname]['label']}
            annotations.append(result)
        json_file['annotations'] = annotations
        return str(json_file).replace("\'", "\"")
    return Response(stream_with_context(work()), mimetype='application/octet-stream', 
                    headers={'Content-Disposition': 'attachment;filename={}.json'.format(taskname)})
    
    
def work(download_path, filename_list):
    try:
        os.mkdir(download_path)
    except FileExistsError:
        pass
    for filename in filename_list:
        storage.download_img_to_save(download_path, filename)
    utils.zip_directory(download_path)
    

@app.route('/api/download/image', methods=['GET','POST'])
@admin_required
def download_raw_image():
    try:
        taskname = request.values['name']
        task_info = database.db_find_task(db, {'name': taskname})
        image_group = task_info[0]['group']
        filename_list = database.db_find_dataset_filenames(db, image_group)
        total = len(filename_list)
        current_path = os.path.dirname(os.path.realpath(__file__))
        save_path = os.path.join(current_path,os.getenv('IMAGE_SAVE_PATH'))
        download_path = os.path.join(save_path, taskname)
        if taskname + '.zip' in os.listdir(save_path):
            return send_from_directory(save_path, taskname + '.zip', as_attachment=True)
        else:
            t = storage.estimate_time_arrival(filename_list[0])
            try:
                if Worker.all(queue=redis_queue):
                    redis_queue.enqueue(work, result_ttl=0, job_timeout=total*t + 300, args=(download_path, filename_list))
                    return render_template('download_raw.html', message='{} 시간 {} 분 남았습니다.'.format(total//3600, (total - (total//3600)*3600)//60))
                else:
                    return render_template('download_raw.html', message='Redis worker가 동작하지 않습니다.')
            except Exception:
                return render_template('download_raw.html', message='Redis docker가 동작하지 않습니다.')
    except KeyError:
        return error_handler('raw 데이터 다운로드 페이지','task_name이 유효하지 않습니다.')


@app.route('/api/delete/image', methods=['POST','DELETE'])
@admin_required
def delete_raw_image():
    taskname = request.values['name']
    current_path = os.path.dirname(os.path.realpath(__file__))
    save_path = os.path.join(current_path,os.getenv('IMAGE_SAVE_PATH'))
    download_path = os.path.join(save_path, taskname)
    if taskname + '.zip' in os.listdir(save_path):
        try:
            shutil.rmtree(download_path)
        except OSError:
            return render_template('download_raw.html', message='이미지 디렉토리 제거에 실패했습니다.')
        try:
            os.remove(download_path + '.zip')
        except OSError:
            return render_template('download_raw.html', message='압축파일 제거에 실패했습니다.')
        return render_template('download_raw.html', message='제거를 완료했습니다.')
    else:
        return render_template('download_raw.html', message='지울 파일이 없습니다.')
    
    
@app.route('/api/download/file_exist', methods=['POST'])
@admin_required
def file_exist():
    current_path = os.path.dirname(os.path.realpath(__file__))
    image_save_path = os.path.join(current_path,os.getenv('IMAGE_SAVE_PATH'))
    tfrecord_path = os.path.join(current_path, os.getenv('TFR_SAVE_PATH'))
    taskname = request.values['name']
    if taskname + '.zip' in os.listdir(image_save_path):
        return {"is_exist": "image_saved"}
    elif taskname + '.tfrecord' in os.listdir(tfrecord_path):
        return {"is_exist": "tfr_saved"}
    else:
        return {"is_exist": "fail"}
    