# -- coding: utf-8 --
from label_app import app
from flask import request, jsonify, session, redirect, make_response, render_template
from label_app.task_code import database, storage, utils
from bson.json_util import dumps
from dotenv import load_dotenv
import json
import datetime

load_dotenv(dotenv_path='config/.env')
db = database.db_open()


def error_handler(status_code, where, what):
    response = make_response({'success': False, 'where':where, 'message': what})
    response.status_code = status_code
    return response


@app.route("/api/times", methods=['POST'])
def setTimes():
    time_type = request.values['act']
    time_now = datetime.datetime.now()

    condition = {
        'username': session['username'],
        'work_date': datetime.datetime.today().strftime('%Y-%m-%d'),
    }

    try:
        time_docs = db.working_time.find_one(condition)

        if time_type == 'start' and time_docs is None:
            value = {
                'username': session['username'],
                'work_date': datetime.datetime.today().strftime('%Y-%m-%d'),
                'start_time': time_now
            }
            db.working_time.insert_one(value)
        elif time_type == 'end' and time_docs:
            value = {
                '$set': { 'end_time': time_now }
            }
            db.working_time.update_one(condition, value, upsert=False)
        else:
            return error_handler(400, '시간설정', '오늘 시작버튼을 이미 눌렀거나, \n시작을 하지않은 상태에서 종료버튼을 눌렀습니다.')
    except Exception as err:
        return error_handler(500, '작업 시간 설정', 'DB 작업 시간 설정 오류')

    response = make_response({'success': True})
    response.status_code = 201
    return response


@app.route("/api/times", methods=['GET'])
def getTimes():
    condition = {
        'username': session['username'],
        'work_date': datetime.datetime.today().strftime('%Y-%m-%d')
    }
   
    try:
        working_time = db.working_time.find_one(condition)
    except Exception as err:
        return error_handler(500, '작업 시간 조회', 'DB 작업 시간 조회 오류')

    response = make_response({'items': json.loads(dumps(working_time))})
    response.status_code = 200
    return response


#충돌방지를 위해 여기다가 만듦.
@app.route("/api/tasks/<task_name>", methods=['GET'])
def get_task_detail(task_name):

    condition = {'name': task_name}
   
    try:
        task_group = db.task_group.find_one(condition)
    except Exception as err:
        return error_handler(500, '그룹 상세정보 조회', '상세정보 조회 오류')

    if task_group is None:
        return error_handler(404, '그룹 상세정보 조회', '해당하는 그룹이 없습니다')
    response = make_response({'items': json.loads(dumps(task_group))})
    response.status_code = 200
    return response