FROM python:3.6-slim-stretch

RUN pip install -U pip setuptools
RUN mkdir meerkat
WORKDIR /meerkat

RUN apt-get update && apt-get install -y libsm6 libxext6 libxrender-dev libglib2.0-0 -y

COPY requirements.txt requirements.txt

RUN pip install -r requirements.txt -i http://ftp.daumkakao.com/pypi/simple --trusted-host ftp.daumkakao.com


COPY label_app label_app
COPY run.py run.py

EXPOSE 8000

CMD [ "/usr/local/bin/gunicorn", "run:app", "--bind", "0.0.0.0:8000",  "--workers", "5"]