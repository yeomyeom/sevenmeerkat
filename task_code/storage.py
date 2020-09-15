from . import utils
import time
import boto3
import uuid
import base64
import os
from urllib.request import urlopen
from urllib.error import HTTPError
from dotenv import load_dotenv
load_dotenv(dotenv_path='config/.env')

# string(os.getenv) to dictionary(eval 함수 통하면 자동으로 변환됨)
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

# aws 관련 키 값들은 aws configure 명령어를 통해서 확인 가능하다
# 라벨링할 이미지는 s3에 standard 디렉토리에 예시 이미지는 s3에 example 디렉토리에 저장된다.
image_path = os.getenv('AWS_IMG_SAVE_PATH')
example_path = os.getenv('AWS_EXAMPLE_SAVE_PATH')
aws_url = os.getenv('AWS_URL')


def s3_connect():
    s3 = boto3.resource(os.getenv('AWS_NAME'))
    bucket = s3.Bucket(os.getenv('AWS_BUCKET_NAME'))
    return bucket


def upload_img(s3, file, upload_path=None):
    # request에서 파일은 다음과 같이 온다. <FileStorage: 'kcarM_60344872_004.jpg' ('image/jpeg')>
    if file.mimetype.split('/')[-1] in ALLOWED_EXTENSIONS:
        if upload_path:
            upload_path = example_path
        else:
            upload_path = image_path
        filename = file.filename
        extension = filename.split('.')[-1]
        file_bytes = file.read()
        img = utils.bytes_to_cv_image(file_bytes)
        base64_img = utils.cv_image_to_base64(img, extension)
        file_extension = "." + file.filename.rsplit(".", 1)[1]
        filename = str(uuid.uuid4()) + file_extension
        (H, W) = img.shape[:2]
        upload_filename = upload_path + filename
        try:
            s3.put_object(Body=base64.b64decode(base64_img), Key=upload_filename, ACL='public-read',
                          ContentType=utils.extension_to_mime_type(extension))
        except Exception:
            # botocore.exceptions.ClientError: An error occurred (AccessDenied) when calling the PutObject operation: Access Denied
            return '', -1, -1
        # s3 업로드 성공시 이미지 가로 세로 길이 나옴
        return filename, H, W
    else:
        return '', -1, -1


def download_img_to_base64(file_name, download_path=None):
    if download_path:
        download_path = example_path
    else:
        download_path = image_path
    Data_URL = aws_url + download_path
    download_url = '{}{}'.format(Data_URL, file_name)
    try:
        connect = urlopen(download_url)
        img_byte = connect.read()
        img_base64 = utils.bytes_to_base64(img_byte)
    except HTTPError:
        img_base64 = None
    return img_base64


def download_img_to_bytes(filename):
    download_path = image_path
    Data_URL = aws_url + download_path
    download_url = '{}{}'.format(Data_URL, filename)
    try:
        connect = urlopen(download_url)
        img_byte = connect.read()
    except HTTPError:
        img_byte = None
    return img_byte


def download_img_to_save(path, filename):
    # path 에 filename 이미지를 저장해라
    download_path = image_path
    Data_URL = aws_url + download_path
    download_url = '{}{}'.format(Data_URL, filename)
    path = os.path.join(path, filename)
    utils.save_image(path, download_url)

    
def delete_img(s3, file_name, download_path=None):
    if download_path:
        download_path = example_path
    else:
        download_path = image_path
    delete_path = download_path + file_name
    try:
        s3.delete_objects(Delete={'Objects': [{'Key': delete_path}]})
    except Exception:
        return delete_path


def estimate_time_arrival(filename):
    start = time.time()
    _ = download_img_to_bytes(filename)
    second = time.time() - start
    # 0초가 나오면 안되니까
    return int(second) + 1