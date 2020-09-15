# -- coding: utf-8 --
from flask import request, jsonify, session, redirect, render_template, send_from_directory
from label_app.task_code import database, storage, utils
from flask_bcrypt import Bcrypt
from datetime import timedelta
from functools import wraps
from label_app import app
import tensorflow as tf
from tensorflow.models.research.slim.datasets import dataset_utils as dataset_util
import os
import json
from dotenv import load_dotenv

load_dotenv(dotenv_path='config/.env')

bcrypt = Bcrypt()
app.secret_key = os.getenv('SECRET_KEY')
db = database.db_open()
s3 = storage.s3_connect()


@app.before_request
def before_request():
    # 매 요청마다 session 갱신
    session.permanent = True
    app.permanent_session_lifetime = timedelta(minutes=30)
    # ACCESS-CONTROL-ALLOW-CREDENTIALS 문제로 인해 밑에 코드 추가
    session.modified = True


def error_handler(where, what):
    result = {'where': where, 'what': what}
    return render_template('error.html', result=result)


def login_required(function):
    @wraps(function)
    def check_session(*args, **kwargs):
        if 'username' not in session:
            # 세션에 username 이라는 키 값이 없을때 (세션에 로그인 정보가 없을때)
            return redirect('/login')
        return function(*args, **kwargs)
    return check_session


def admin_required(function):
    @login_required
    @wraps(function)
    def check_username(*args, **kwargs):
        if 'admin' not in session['username']:
            return error_handler('로그인', '관리자 계정으로 접속해야합니다.')
        return function(*args, **kwargs)
    return check_username


@app.route('/api/img_upload', methods=['GET', 'POST'])
@admin_required
def img_upload():
    group = database.db_find_group(db)
    result = {'file_num': 0, 'file_success': [], 'file_fail': [], 'image_group': group}
    if request.method == 'POST':
        '''
        input
        upload 에서는 {group: 그룹이름, group_comment: 그룹 설명, gen_user: 만든사람ID} + file_list 를 보내주면 된다.

        해당 정보들을 DB에 저장함

        output
        {file_fail: [업로드 실패한 파일 이름], file_num: 업로드 시도하는 파일 갯수 int, 
        file_success: [업로드 성공한 파일이름], image_group: {이미지그룹이름:그룹설명}}
        '''
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
                    filename, H, W = storage.upload_img(s3, file)
                    if filename:
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
            except KeyError:
                return error_handler('이미지 업로드', '이미지 그룹에 대해서 이미지 그룹명과 설명을 적어주세요')
        else:
            return error_handler('이미지 업로드', '업로드할 이미지 파일이 없습니다.\n확장자를 확인해주세요.')
    return result


@app.route('/api/img_list', methods=['GET'])
@admin_required
def img_list():
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
    tasks = database.db_find_task(db)
    result = []
    for task in tasks:
        img_url = task['example']
        if img_url:
            task['example'] = storage.download_img_to_base64(img_url, 'example/')
        else:
            task['example'] = None
        result.append(task)
    return jsonify(result)


def insert_task_group(result, example_img, session_name):
    # 이 함수는 task_create 에서만 불리는데 task_create는 login_required 가 들어가 있으므로 session['username']에 값이 반드시 있다.
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


@app.route('/api/task_create', methods=['GET', 'POST'])
@admin_required
def task_create():
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
    if request.method == 'POST':
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
            if task_status == 'create':
                insert_task_group(result, label_example, session_name)
            elif task_status == 'update':
                # task 그룹을 수정할때 과거에 저장된 예시 이미지들을 지우는 작업
                # create 함수에 수정하는 코드도 함께들어가 있네 ㅋㅋㅋㅋㅋ 
                example = database.db_find_example_img(db, result['name'])
                if example:
                    storage.delete_img(s3, example, 'example/')
                # 새로 바뀐 이미지들로 업데이트
                insert_task_group(result, label_example, session_name)
            else:
                # task_status == drop
                return error_handler('task 생성', 'task 이름이 중복되었습니다.\n이름을 변경하거나 \
                                      수정을 원한다면 라벨링타입, 이미지 그룹을 동일하게 해주세요')
        else:
            return error_handler('task 생성', '선택된 이미지 그룹이 존재하지 않습니다. 데이터베이스를 확인해주세요')
    return ''


@app.route('/api/task_management_list', methods=['GET', 'POST'])
@admin_required
def task_management_list():
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
        if task_info['example']:
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
                return error_handler('라벨링', '라벨링 종류가 classification인데 selection list 가 존재하지 않습니다. \
                                      task 를 확인바랍니다.')
    else:
        return error_handler('라벨링', '해당 task가 없습니다. task 를 확인해주세요')
    if request.method == 'POST':
        # 사이트에서 라벨링 한 결과가 POST 로 들어오면 db에 추가
        # '''
        #
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


@app.route('/api/login', methods=['POST'])
def login():
    try:
        email = request.values['email']
        password = request.values['password']
        if email and password:
            user = database.db_check_login(db, bcrypt, email, password)
            if user['status'] is True:
                session['username'] = user['username']
                return redirect('/task_list')
            else:
                return error_handler('로그인', '아이디 또는 비밀번호가 틀립니다.')
    except KeyError:
        return redirect('/login')


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


def make_tf_record(task_name, task_group, task_object, tfrecord_path):
    dataset_list = database.db_find_dataset_group(db, task_name, task_group)
    # dataset_list = {'filename': 1, 'height': 1, 'width': 1, task_name: 1}
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
            # 사진 한장에 물체가 한가지 종류밖에 없음 만약 tf record 파일 여러개인데 하나는 자동차, 다른 하나는 번호판이 되면
            # class_indices 가 0 ,1 이 되야하는데 이걸 어떻게 구분하지? 여러개 다운로드로 해야할거 같기도 하고....
            # class_name = ['car', 'plate'] 라고 하면
            # class_indices = ['0', '1'] 이런식으로 저장되야 car 랑 plate 두가지 물체가 서로 다르다라고 앎
            class_indices.append(0)
            class_names.append(task_object)
        feature = tf.train.Features(feature={
            'image/height': dataset_util.int64_feature(dataset['height']),
            'image/width': dataset_util.int64_feature(dataset['width']),
            'image/filename': dataset_util.bytes_feature(dataset['filename']),
            'image/source_id': dataset_util.bytes_feature(dataset['filename']),
            'image/encoded': dataset_util.bytes_feature(img),
            'image/format': dataset_util.bytes_feature(img_format),
            'image/object/bbox/xmin': dataset_util.float_list_feature(xmins),
            'image/object/bbox/xmax': dataset_util.float_list_feature(xmaxs),
            'image/object/bbox/ymin': dataset_util.float_list_feature(ymins),
            'image/object/bbox/ymax': dataset_util.float_list_feature(ymaxs),
            'image/object/class/text': dataset_util.bytes_list_feature(class_names),
            'image/object/class/label': dataset_util.int64_list_feature(class_indices)
        })
        sample = tf.train.Example(features=feature)
        writer.write(sample.SerializeToString())
        # response 객체 생성하기 (프론트에 progress bar 보여주기)
        # https://stackoverflow.com/questions/26514583/text-event-stream-recognised-as-a-download
    writer.close()
    # return Response(progress(), mimetype='text/event-stream')
    return ''


@app.route('/api/download', methods=['GET', 'POST'])
#@admin_required
def download():
    try:
        task_name = request.values['task_name']
        if not task_name:
            return {'message':'task 이름이 비어있습니다.'}
        task_object = request.values['task_object']
        if not task_object:
            return {'message':'object 이름이 비어있습니다.'}
    except KeyError:
        return '키 값 에러가 발생했습니다.'
    tfrecord_name = '{}.record'.format(task_name)
    tfrecord_path = os.path.dirname(os.path.realpath(__file__))
    tfrecord_path = os.path.join(tfrecord_path, os.getenv('DOWNLOAD_PATH'))
    if tfrecord_name in os.listdir(tfrecord_path):
        return {'message':'이미 tfrecord 파일이 만들어져 있습니다.'}
        # return send_from_directory(dircetory=tfrecord_path, filename=tfrecord_name)
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
        make_tf_record(task_name, task_status['group'], task_object, tfrecord_path)
        return {'message':'다운로드중입니다. 완료되면 tensorflow record 페이지에서 다운로드 받을 수 있습니다}
    
