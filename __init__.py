from flask import Flask
# from flask_cors import CORS
app = Flask(__name__)
import label_app.api
import label_app.view
import label_app.times
