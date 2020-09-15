from flask import request, jsonify
from label_app import app

import os
import cv2
import base64


@app.route('/api/time_setting', methods=['GET', 'POST'])
def ts():
    if request.method == 'POST':
        print(request.values)
    return ""

@app.route('/api/task_list', methods=['GET'])
def tl():
    if request.method == 'GET':
        print(request.args.get('t_type'))
        return jsonify([
            {
                "kind": "detection",
                "task_name": "hamster_labeling",
                "comment": "Hamster is so cute!!",
                "image_url": 'https://trello-attachments.s3.amazonaws.com/5ea627ed1f6efd7a21ef51a0/5ebca6a724f261272ee16498/524884e5d7235545d26d27297f313c35/main.png'
            },
            {
                "kind": "text",
                "task_name": "cat_labeling",
                "comment": "Hamster is so cute!!",
                "image_url": 'https://trello-attachments.s3.amazonaws.com/5ea627ed1f6efd7a21ef51a0/5ebca6a724f261272ee16498/524884e5d7235545d26d27297f313c35/main.png'
            },
            {
                "kind": "classification",
                "task_name": "dog_labeling",
                "comment": "Hamster is so cute!!",
                "image_url": 'https://image.dongascience.com/Photo/2020/02/660b6c867334b842ab7f0258d1e35865.jpg'
            },
            {
                "kind": "segmentation",
                "task_name": "quokka_labeling",
                "comment": "Hamster is so cute!!",
                "image_url": 'https://ichef.bbci.co.uk/news/1024/cpsprodpb/11A59/production/_107518227_hamster.png'
            }
        ])


@app.route('/api/label/<task_name>', methods=['GET', 'POST'])
def t(task_name):
    if request.method == 'GET':
        if task_name == 'hamster_labeling':
            img_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                "static/images/test1.jpg"
            )
            image = cv2.imread(img_path)
            H, W = image.shape[:2]

            _, buffer = cv2.imencode(".{}".format('jpg'), image)
            base64_image = base64.b64encode(buffer)
            base64_image = base64_image.decode()

            return jsonify(
                {
                    "file_name": "hamster.jpg",
                    "kind": "detection",
                    "height": H,
                    "width": W,
                    "image": base64_image,
                    "image_ext": 'jpg',
                    "selection_list": [
                        "hamster",
                        "cat",
                        "dog",
                        "quokka",
                        "kangaroo",
                        "dolphine"
                        ]
                }
            )

    elif request.method == 'POST':
        print(request.values)
        for i, val in request.values.items():
            print(i)
        return ""


@app.route('/api/task_management', methods=['GET', 'POST'])
def tm():
    if request.method == 'GET':
        """
        Request method GET이면서  전달해주는 데이터가 00 일때
        """
        if request.values['check'] == "generate_task_management_table":
            """
            그리고 is_activate 되어있는게 우선적으로 와야함
            """
            return jsonify([
                {
                    "is_activate": 1,
                    "kind": "detection",
                    "task_name": "hamster_labeling",
                    "assigned_dataset": "cue_hamsters",
                    "gen_user": "shinjisoo",
                    "date": "2020-05-25 16:00:00"
                }
            ])
    return ""


@app.route('/api/dataset_list', methods=['GET', 'POST'])
def dl():
    if request.method == 'GET':
        return jsonify([
            {
                "dataset_name": "hamster_data",
                "dataset_idx": 0,
                "gen_user": "shinjisoo",
                "gen_date": "2020-06-05 16:00:00",
                "assigned_task": "hamster_labeling",
            }
        ])
    return ""


@app.route('/api/task_create', methods=['POST', 'GET'])
def hamster():

    if request.method == 'POST':
        print(request.values)
        return ""

    elif request.method == 'GET':
        return jsonify([
            {
                "group": 'hamster',
                "group_comment": 'hamster data',
                "gen_user": "shinjisoo",
                "gen_date": "2020-20-20 10:00:00",
                "is_checked": 0
            },
            {
                "group": 'hamster',
                "group_comment": 'hamster data',
                "gen_user": "shinjisoo",
                "gen_date": "2020-20-20 10:00:00",
                "is_checked": 0
            },
            {
                "group": 'starex',
                "group_comment": 'hamster data',
                "gen_user": "shinjisoo",
                "gen_date": "2020-20-20 10:00:00",
                "is_checked": 0
            }
        ])

@app.route('/api/img_list', methods=['GET'])
def get_img_list():
    return ""


@app.route('/api/img_upload', methods=['POST'])
def upload_img():
    return ""