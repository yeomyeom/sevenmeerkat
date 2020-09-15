from urllib.parse import quote, urlparse
from urllib.request import urlopen, urlretrieve
import os
import cv2
import numpy as np
import base64
import shutil


def extension_to_mime_type(extension):
    if extension.lower() == 'jpg' or extension == 'jpeg':
        out = 'jpeg'
    elif extension.lower() == 'png':
        out = 'png'
    return 'image' + '/' + out


def cv_image_to_base64(np_image, extension):
    _, buffer = cv2.imencode(".{}".format(extension), np_image)
    base64_image = base64.b64encode(buffer)
    base64_image = base64_image.decode()
    return base64_image


def bytes_to_base64(img_bytes):
    base64_image = base64.b64encode(img_bytes)
    base64_image = base64_image.decode()
    return base64_image


def bytes_to_cv_image(img_bytes):
    image = np.asarray(bytearray(img_bytes), dtype="uint8")
    image = cv2.imdecode(image, cv2.IMREAD_COLOR)
    return image


def url_to_image(url):
    parsed_url = urlparse(url)
    after_url = 'https://' + parsed_url.netloc + quote(parsed_url.path)
    resp = urlopen(after_url)
    img_bytes = resp.read()
    image = bytes_to_cv_image(img_bytes)
    return image


def save_image(path, file_url):
    # import pdb; pdb.set_trace()
    try:
        urlretrieve(file_url, path)
    except Exception:
        print(file_url)


def zip_directory(path):
    shutil.make_archive(path, 'zip', path)


def rotate_img(img, angle):
    """각도가 주어졌을 때 회전만 하는 함수
    process의 함수와는 다름
    param:
      img: cv2 image
      angle: float, int 등의 실수값
    """
    if angle is None:
        angle = 0
    height, width = img.shape[:2]
    M = cv2.getRotationMatrix2D((width / 2, height / 2), angle, 1)
    rotated = cv2.warpAffine(img, M, (0, 0), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    # 회전 이후 너비 높이 갱신
    return rotated


def request_mapping(request, result):
    # 프론트에서 넘어온 json(request) 를 백엔드에서 사용할 수 있도록 result 라는 json으로 전환해준다.
    # result 가 나중에 프론트로 또 넘어갈것
    for key in request.keys():
        result[key] = request[key]
    return result

def is_saved(path, filename):
    if filename in os.listdir(path):
        return 1
    else:
        return 0