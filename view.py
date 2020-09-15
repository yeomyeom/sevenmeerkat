from flask import render_template
from label_app import app
from label_app.api import login_required, admin_required


@app.route('/')
@app.route('/home')
@app.route('/index')
@login_required
def home_view():
    return render_template('index.html')


@app.route('/task_list')
@login_required
def task_list_view():
    return render_template("task_list.html")


@app.route('/label/<task_name>')
@login_required
def task_view(task_name):
    return render_template("task.html")


@app.route('/task_management')
@admin_required
def task_management_view():
    return render_template("task_management.html")


@app.route('/task_modify/<task_name>')
@admin_required
def task_modify_view(task_name):
    return render_template("task_modify.html")


@app.route('/dataset_management')
@admin_required
def dataset_management_view():
    return render_template("dataset_management.html")


@app.route('/dataset_modify/<datasetname>')
@admin_required
def dataset_modify_view(datasetname):
    return render_template("dataset_modify.html")


@app.route('/login')
def login_view():
    return render_template("login.html")


@app.route('/register')
def register_view():
    return render_template("register.html")


# 일단 나중에 blueprint로 묶어서 관리하도록 한다.
@app.route('/tfrecord')
@admin_required
def tfrecord_view():
    return render_template("tfrecord.html")


@app.route('/tfrecord/download')
@admin_required
def download_tf_view():
    return render_template("download_tf.html")

@app.route('/download')
@admin_required
def download_raw_view():
    return render_template("download_raw.html")

@app.route('/tfrecord/reservation')
@admin_required
def reservation_view():
    return render_template("reservation.html")

@app.route('/404')
def render_404():
    return render_template("404.html")

@app.route('/error')
def render_500():
    return render_template("500.html")

