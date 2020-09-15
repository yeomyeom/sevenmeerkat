db.createUser({user: "test", pwd: "test", roles: [{role: "readWrite", db: "meerkat"}]})
db.createCollection('dataset')
db.createCollection('profile')
db.profile.insert({'username': 'test', 'email': 'test@yeom.com', 'password': '$2a$12$xJQtRc/RdS4l5pYoVpgtB.bSDM96Hc3yNg2HvmHdxFe5T8CNZMdgK', 'gen_date': ISODate("2020-06-02T15:53:52.000Z"), 'counts': {}, 'connect':[]})
db.profile.insert({'username': 'admin', 'email': 'admin1234@yeom.com', 'password': '$2a$12$AcSSIXvspINkFxc4dRkmk.9Xw8qWYAbX51hdNCRoa2Om88/IXe0PO', 'gen_date': ISODate("2020-06-05T17:33:33.000Z"), 'counts': {}, 'connect': []})
db.createCollection('task_group')
db.createCollection('image_group')
