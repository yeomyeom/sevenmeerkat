from bson.json_util import dumps
from bson.json_util import loads
from pymongo import MongoClient
from datetime import datetime
import os
from dotenv import load_dotenv
load_dotenv(dotenv_path='config/.env')

db_image_group = os.getenv('DB_IMAGE_GROUP')
db_dataset = os.getenv('DB_DATASET')
db_profile = os.getenv('DB_PROFILE')
db_task_group = os.getenv('DB_TASK_GROUP')


def db_open():
    DB_URI = os.getenv('DB_URI')
    client = MongoClient(DB_URI)
    db = client[os.getenv('DB_NAME')]
    return db


def col_open(db, COLLECTION_NAME):
    return db[COLLECTION_NAME]


def db_select(db, where, query=None, field=None, sort_rank=None):
    collection = col_open(db, where)
    if field is None:
        field = {'_id': 0}
    if query is None:
        query = {}
    if sort_rank is None:
        sort_rank = [('_id', 1)]
    # db_select에 값이 list 형태로 나가게 된다.
    return loads(dumps(collection.find(query, field).sort(sort_rank)))


def db_insert_group(db, group_name, group_comment, gen_user):
    group_col = col_open(db, db_image_group)
    document = {
        'group': group_name,
        'group_comment': group_comment,
        'gen_user': gen_user,
        'gen_date': datetime.now().replace(microsecond=0)
    }
    group_col.update({'group': group_name}, document, upsert=True)


def db_find_group(db, query=None, field=None):
    if query is None:
        query = {}
    if field is None:
        field = {'_id': 0}
    group = db_select(db, db_image_group, query, field)
    return group


def db_check_taskgroup(db, task_name, group_name, kind):
    is_exist = db_select(db, db_task_group, {'name': task_name})
    if is_exist:
        is_exist = db_select(db, db_task_group, {'name': task_name, 'group': group_name, 'kind': kind})
        if is_exist:
            # task 이름, task 그룹, task 라벨링 종류 3가지 값이 같으면 task 수정으로
            return 'update'
        else:
            # task 이름만 같고 나머지 2가지가 다르면 해당 수정 요청 거부
            return 'drop'
        # 새로운 task 이름이니까 새로운 task 생성
    return 'create'


def db_find_example_img(db, task_name):
    result = db_select(db, db_task_group, {'name': task_name})
    # db_select 결과가 하나만 있어도 계속 list로 나와버리니깐 하나만 필요할때는 result[0] 이런식으로 해줘야하는구만
    try:
        filename = result[0]['example']
    except KeyError:
        filename = None
    return filename


def db_insert_taskgroup(db, task_name, group_name, comment, kind, is_activate, ex_img, size, gen_user, select=None):
    collection = col_open(db, db_task_group)
    document = {
        'name': task_name,
        'group': group_name,
        'comment': comment,
        'kind': kind,
        'example': ex_img,
        'size': size,
        'gen_date': datetime.now().replace(microsecond=0),
        'gen_user': gen_user,
        'is_activate': is_activate
    }
    if ex_img is None:
        del document['example']
        del document['size']
    if kind == 'classification':
        if select is None:
            select = []
        document['selection_list'] = select
    value = {
        '$set':document
    }
    collection.update_one({'name': task_name}, value, upsert=True)


def db_find_task(db, query=None, field=None):
    if query is None:
        query = {}
    if field is None:
        field = {'_id': 0}
    task_list = db_select(db, db_task_group, query, field)
    return task_list


def db_count_taskimage(db, task_name):
    # task_name 에 이미지들이 몇장이 있고 몇장이 라벨링 되었는가 출력해줌
    total, count = 0, 0
    # task에 있는 이미지 그룹 이름
    image_group_name = db_find_task(db, {'name': task_name}, {'_id': 0, 'group': 1})
    image_group_name = image_group_name[0]['group']
    # dataset에 등록되어있는 이미지 총 개수
    dataset = col_open(db, db_dataset)
    total = dataset.count({'group': image_group_name})
    count = dataset.count({'group': image_group_name, task_name: {'$exists': 1}})
    # dataset에 등록된 이미지들 중에서 label이 완료된거 개수
    return total, count


def db_insert_dataset(db, filename, group_name, height, width):
    collection = col_open(db, db_dataset)
    document = {
        'filename': filename,
        'group': group_name,
        'height': height,
        'width': width
    }
    collection.insert_one(document)


def db_find_dataset_filenames(db, group_name):
    # dataset 에 저장되어 있는 이미지 중 group_name 으로 묶여있는 모든 이미지 filename 만 불러오기
    filename_list = db_select(db, db_dataset, {'group': group_name}, {'_id': 0, 'filename': 1})
    filename_list = [filename['filename'] for filename in filename_list]
    return filename_list


def db_find_dataset_group(db, task_name, image_group):
    # dataset 에 저장되어 있는 이미지 중 image_group 이름으로 묶여있고 task_name 라벨링이 완료된 모든 이미지 document 불러오기
    return db_select(db, db_dataset, {'group': image_group, task_name: {'$exists': True}},
                     {'_id': 0, 'filename': 1, 'height': 1, 'width': 1, task_name: 1})


def db_find_one_label(db, task_name):
    task = db_find_task(db, {'name': task_name})
    if task:
        task = task[0]
        kind = task['kind']
        group_name = task['group']
        # 라벨링할 이미지 파일을 하나
        filename_list = db_select(db, db_dataset, {'group': group_name, task_name: {'$exists': False}}, {'_id': 0})
        if not filename_list:
            rank = '{}.is_checked'.format(task_name)
            find_result = db_select(db, db_dataset,
                                    {'group': group_name, task_name: {'$exists': True}}, {'_id': 0}, [(rank, 1)])
            result = find_result[0]
        else:
            result = filename_list[0]
        # kind 저장
        result['kind'] = kind
    else:
        result = {}
    return result


def db_update_one_label(db, task_name, filename, kind, label):
    col = col_open(db, db_dataset)
    update_document = db_select(db, db_dataset, {'filename': filename, task_name: {'$exists': True}})
    if update_document:
        # dataset에 filename에 task 이름이 같은 애가 있으면 해당 task labels 덮어 씌우고 is_checked +1
        # 웹에서 json 형식으로 보내준 것을 그대로 DB에 저장한다.
        key = '{}.label'.format(task_name)
        col.update({'filename': filename, task_name: {'$exists': True}}, {'$set': {key: label}})
        key = '{}.kind'.format(task_name)
        col.update({'filename': filename, task_name: {'$exists': True}}, {'$set': {key: kind}})
        key = '{}.is_checked'.format(task_name)
        col.update({'filename': filename, task_name: {'$exists': True}}, {'$inc': {key: 1}})
    else:
        # dataset에 filename에 task 이름이 같은 애가 없으면 해당 task labels 새로 만들고 is_checked 1
        document = {
            task_name: {
                'label': label,
                'kind': kind,
                'is_checked': 1
            }
        }
        col.update({'filename': filename}, {'$set': document})


def db_insert_user(db, bcrypt, username, password, email):
    col = col_open(db, db_profile)
    document = {
        'username': username,
        'email': email,
        'password': bcrypt.generate_password_hash(password),
        'gen_date': datetime.now().replace(microsecond=0),
        'counts': {},
        'connect': []
    }
    result = db_select(db, db_profile, {'username': username})
    if result:
        return False
    else:
        col.insert_one(document)
        return True


def db_check_login(db, bcrypt, email, password):
    # 아이디 페스워드 입력했을때 맞는 아이디 페스워드인지 확인
    result = db_select(db, db_profile, {'email': email})
    userinfo = {'status': False}
    if len(result) == 1:
        if bcrypt.check_password_hash(result[0]['password'], password):
            # 로그인 성공
            col = col_open(db, db_profile)
            username = result[0]['username']
            now_time = datetime.now().replace(microsecond=0)
            document = {
                'connect': {'start': now_time, 'finish': now_time}
            }
            col.update({'username': username}, {'$push': document})
            userinfo['username'] = username
            userinfo['login'] = now_time
            userinfo['status'] = True
    return userinfo


def db_find_user(db, username):
    userinfo = db_select(db, db_profile, {'username': username})
    try:
        userinfo = userinfo[0]
    except IndexError:
        return {}
    time = 0
    for connect in userinfo['connect']:
        start = connect['start']
        finish = connect['finish']
        time += (finish - start).seconds
    # second to minutes
    time = time // 60
    return {
        'username': userinfo['username'],
        'email': userinfo['email'],
        'gen_date': userinfo['gen_date'],
        'counts': userinfo['counts'],
        'connect': userinfo['connect'],
        'total': time
    }


def db_count_user(db, username, taskname):
    col = col_open(db, db_profile)
    # 라벨링한 횟수 +1
    result = db_select(db, db_profile, {'username': username})
    if result:
        index = 'counts.{}'.format(taskname)
        col.update({'username': username}, {'$inc': {index: 1}})
        # 라벨링 이후 제출 버튼을 눌러야 user의 finish 시간이 갱신됨
        last_time = datetime.now().replace(microsecond=0)
        last_action = db_select(db, db_profile, {'username': username}, {'connect': 1})
        last_action = last_action[0]
        last_index = len(last_action['connect']) - 1
        # profile 에 가장 최근에 접속한 정보 갱신
        index = 'connect.{}.finish'.format(last_index)
        col.update({'username': username}, {'$set': {index: last_time}})
        return True
    else:
        return False

